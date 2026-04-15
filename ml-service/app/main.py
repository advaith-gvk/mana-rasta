import base64
import io
import os
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageOps
from pydantic import BaseModel, Field


MODEL_VERSION = os.getenv("POTHOLE_ML_MODEL_VERSION", "python-road-heuristic-v1")

app = FastAPI(title="Mana Rasta ML Service", version=MODEL_VERSION)


class AnalyzeRequest(BaseModel):
    image_base64: str
    mimetype: str
    capture_context: dict[str, Any] = Field(default_factory=dict)
    device_context: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model_version": MODEL_VERSION}


@app.post("/analyze")
def analyze(payload: AnalyzeRequest) -> dict[str, Any]:
    try:
        buffer = base64.b64decode(payload.image_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload") from exc

    try:
        image = Image.open(io.BytesIO(buffer))
        image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unreadable image") from exc

    return analyze_capture(
        image=image,
        mimetype=payload.mimetype,
        capture_context=payload.capture_context,
        device_context=payload.device_context,
    )


def analyze_capture(
    image: Image.Image,
    mimetype: str,
    capture_context: dict[str, Any],
    device_context: dict[str, Any],
) -> dict[str, Any]:
    full_width, full_height = image.size
    gray = image.convert("L")
    resized = ImageOps.contain(gray, (160, 160))
    pixels = np.asarray(resized, dtype=np.float32)

    if pixels.ndim != 2:
        raise HTTPException(status_code=400, detail="Invalid grayscale image")

    height, width = pixels.shape
    pixel_count = float(width * height)
    mean = float(np.mean(pixels))
    std_dev = float(np.std(pixels))
    sharpness_raw = compute_laplacian_variance(pixels)
    sharpness_score = clamp(sharpness_raw / 2200.0)
    exposure_score = compute_exposure_score(pixels, mean)
    glare_ratio = float(np.mean(pixels >= 245))
    glare_score = clamp(1.0 - glare_ratio / 0.08)

    candidate = detect_candidate(pixels, mean, std_dev)
    candidate_area_ratio = candidate["area"] / pixel_count if candidate else 0.0
    boundary_fit_score = compute_boundary_fit(candidate, width, height) if candidate else 0.0
    size_coverage_score = clamp(candidate_area_ratio / 0.09)
    angle_score = compute_angle_score(candidate, width, height) if candidate else 0.2
    occlusion_score = clamp(candidate["fill_ratio"] * 1.4) if candidate else 0.2

    quality_flags = {
        "framed": boundary_fit_score >= 0.75,
        "sharp": sharpness_score >= 0.32,
        "well_lit": exposure_score >= 0.45,
        "low_glare": glare_score >= 0.45,
        "stable": sharpness_score >= 0.28,
        "not_cropped": (not candidate["touches_edge"]) if candidate else False,
        "scale_ok": size_coverage_score >= 0.22,
        "angle_ok": angle_score >= 0.45,
        "occlusion_ok": occlusion_score >= 0.35,
    }

    hard_negative_scores = score_hard_negatives(candidate, glare_ratio) if candidate else {
        "puddle": 0.12,
        "road_patch": 0.2,
        "manhole_cover": 0.08,
        "shadow": 0.15,
        "speed_breaker": 0.05,
    }
    max_negative_risk = max(hard_negative_scores.values())
    candidate_score = candidate["score"] if candidate else 0.0
    confidence = (
        clamp(
            candidate_score * 0.56
            + sharpness_score * 0.12
            + exposure_score * 0.1
            + boundary_fit_score * 0.1
            + size_coverage_score * 0.08
            + occlusion_score * 0.04
            - max_negative_risk * 0.18
        )
        if candidate
        else 0.06
    )

    pothole_present = bool(candidate) and confidence >= 0.48 and max_negative_risk < 0.82
    mandatory_checks = [
        ("pothole_candidate_missing", bool(candidate)),
        ("pothole_outside_boundary", quality_flags["framed"]),
        ("pothole_too_small", quality_flags["scale_ok"]),
        ("pothole_cropped", quality_flags["not_cropped"]),
        ("low_sharpness", quality_flags["sharp"]),
        ("excessive_motion", quality_flags["stable"]),
        ("poor_exposure", quality_flags["well_lit"]),
        ("severe_glare", quality_flags["low_glare"]),
        ("bad_capture_angle", quality_flags["angle_ok"]),
        ("partial_occlusion", quality_flags["occlusion_ok"]),
    ]

    blocked_reason = detect_source_violation(capture_context)
    if not blocked_reason:
        for reason, passed in mandatory_checks:
            if not passed:
                blocked_reason = reason
                break
    if not blocked_reason and not pothole_present:
        blocked_reason = "pothole_not_confident"

    soft_warning_reason = None
    if not blocked_reason and max_negative_risk >= 0.52:
        soft_warning_reason = "ambiguous_surface_pattern"
    elif not blocked_reason and confidence < 0.72:
        soft_warning_reason = "low_detection_confidence"

    capture_status = "blocked" if blocked_reason else "warning" if soft_warning_reason else "accepted"
    quality_ready = not blocked_reason
    quality_score = clamp(
        sharpness_score * 0.2
        + exposure_score * 0.16
        + glare_score * 0.1
        + boundary_fit_score * 0.18
        + size_coverage_score * 0.14
        + occlusion_score * 0.1
        + angle_score * 0.12
    )

    severity = estimate_severity(candidate_area_ratio, candidate["irregularity"], confidence) if pothole_present and candidate else None
    review_reason = None
    if confidence < 0.72:
        review_reason = "low_detection_confidence"
    elif max_negative_risk >= 0.58:
        review_reason = "hard_negative_risk"
    elif capture_status == "warning":
        review_reason = soft_warning_reason

    normalized_box = [normalize_box(candidate["bbox"], width, height)] if candidate else []
    mask_polygon = [normalize_polygon(candidate["bbox"], width, height)] if candidate else []

    return {
        "capture_status": capture_status,
        "quality_ready": quality_ready,
        "quality_score": round4(quality_score),
        "blocked_reason": blocked_reason,
        "downgraded_reason": soft_warning_reason,
        "guidance_prompt": build_guidance_prompt(blocked_reason, soft_warning_reason),
        "quality_flags": quality_flags,
        "quality_metrics": {
            "sharpness_score": round4(sharpness_score),
            "exposure_score": round4(exposure_score),
            "glare_score": round4(glare_score),
            "boundary_fit_score": round4(boundary_fit_score),
            "size_coverage_score": round4(size_coverage_score),
            "occlusion_score": round4(occlusion_score),
            "angle_score": round4(angle_score),
            "hard_negative_risk": round4(max_negative_risk),
        },
        "detection": {
            "pothole_present": pothole_present,
            "confidence": round4(confidence),
            "boxes": normalized_box,
            "mask_available": bool(candidate),
            "masks": mask_polygon,
            "severity": severity,
            "reportable": quality_ready and pothole_present and confidence >= 0.62,
            "hard_negative_scores": {key: round4(value) for key, value in hard_negative_scores.items()},
        },
        "review": {
            "needs_human_review": bool(review_reason),
            "reason": review_reason,
        },
        "metadata": {
            "device_model": device_context.get("deviceModel") or "captured_if_available",
            "image_source": derive_image_source(capture_context),
            "filters_applied": False,
            "capture_mode": capture_context.get("capture_mode", "assisted_manual"),
            "raw_available": bool(capture_context.get("raw_available")),
            "raw_used": bool(capture_context.get("raw_used")),
            "raw_conversion": "deterministic_rgb_derivative" if capture_context.get("raw_used") else "n/a",
            "original_mime_type": mimetype,
            "dimensions": {
                "width": full_width,
                "height": full_height,
            },
            "exif_preserved": True,
            "os_version": device_context.get("osVersion") or capture_context.get("os_version"),
        },
        "model": {
            "version": MODEL_VERSION,
            "pipeline": "python_quality_gate -> python_detector -> python_segmentation -> validation -> severity_estimator",
        },
    }


def detect_candidate(pixels: np.ndarray, mean: float, std_dev: float) -> dict[str, Any] | None:
    threshold = max(18.0, mean - max(16.0, std_dev * 0.55))
    dark_mask = pixels <= threshold
    visited = np.zeros_like(dark_mask, dtype=bool)
    best = None
    height, width = dark_mask.shape
    min_area = width * height * 0.0015

    for y in range(1, height - 1):
        for x in range(1, width - 1):
            if visited[y, x] or not dark_mask[y, x]:
                continue
            component = flood_fill(dark_mask, pixels, visited, x, y)
            if component is None or component["area"] < min_area:
                continue

            bbox_width = component["max_x"] - component["min_x"] + 1
            bbox_height = component["max_y"] - component["min_y"] + 1
            area_ratio = component["area"] / float(width * height)
            bbox_area = float(bbox_width * bbox_height)
            fill_ratio = component["area"] / bbox_area if bbox_area else 0.0
            center_x = (component["min_x"] + component["max_x"]) / 2.0 / width
            center_y = (component["min_y"] + component["max_y"]) / 2.0 / height
            centrality = clamp(1.0 - (abs(center_x - 0.5) * 1.25 + abs(center_y - 0.58) * 1.1))
            contrast = clamp((mean - component["mean"]) / 70.0)
            irregularity = clamp(1.0 - fill_ratio)
            touches_edge = (
                component["min_x"] <= round(width * 0.03)
                or component["min_y"] <= round(height * 0.03)
                or component["max_x"] >= round(width * 0.97)
                or component["max_y"] >= round(height * 0.97)
            )

            score = area_ratio * 3.4 + centrality * 0.28 + contrast * 0.26 + irregularity * 0.16 + (0.0 if touches_edge else 0.14)
            candidate = {
                "area": float(component["area"]),
                "mean": component["mean"],
                "bbox": [component["min_x"], component["min_y"], component["max_x"], component["max_y"]],
                "touches_edge": touches_edge,
                "fill_ratio": fill_ratio,
                "irregularity": irregularity,
                "score": clamp(score),
            }
            if best is None or candidate["score"] > best["score"]:
                best = candidate
    return best


def flood_fill(mask: np.ndarray, pixels: np.ndarray, visited: np.ndarray, start_x: int, start_y: int) -> dict[str, Any] | None:
    height, width = mask.shape
    stack = [(start_x, start_y)]
    area = 0
    pixel_sum = 0.0
    min_x = max_x = start_x
    min_y = max_y = start_y

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        if visited[y, x]:
            continue
        visited[y, x] = True
        if not mask[y, x]:
            continue

        area += 1
        pixel_sum += float(pixels[y, x])
        min_x = min(min_x, x)
        max_x = max(max_x, x)
        min_y = min(min_y, y)
        max_y = max(max_y, y)

        stack.append((x - 1, y))
        stack.append((x + 1, y))
        stack.append((x, y - 1))
        stack.append((x, y + 1))

    if area == 0:
        return None
    return {
        "area": area,
        "mean": pixel_sum / area,
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
    }


def compute_laplacian_variance(pixels: np.ndarray) -> float:
    center = pixels[1:-1, 1:-1]
    laplacian = pixels[:-2, 1:-1] + pixels[1:-1, :-2] + pixels[1:-1, 2:] + pixels[2:, 1:-1] - 4 * center
    return float(np.var(laplacian))


def compute_exposure_score(pixels: np.ndarray, mean: float) -> float:
    bright_ratio = float(np.mean(pixels >= 245))
    dark_ratio = float(np.mean(pixels <= 12))
    centered_mean = 1.0 - min(abs(mean - 118.0) / 118.0, 1.0)
    return clamp(centered_mean * 0.65 + (1.0 - bright_ratio) * 0.2 + (1.0 - dark_ratio) * 0.15)


def compute_boundary_fit(candidate: dict[str, Any], width: int, height: int) -> float:
    x1, y1, x2, y2 = candidate["bbox"]
    center_x = (x1 + x2) / 2.0 / width
    center_y = (y1 + y2) / 2.0 / height
    box_width = (x2 - x1 + 1) / width
    box_height = (y2 - y1 + 1) / height
    center_score = clamp(1.0 - (abs(center_x - 0.5) + abs(center_y - 0.58)))
    size_penalty = 0.3 if box_width > 0.72 or box_height > 0.72 else 0.0
    return clamp(center_score - size_penalty - (0.35 if candidate["touches_edge"] else 0.0))


def compute_angle_score(candidate: dict[str, Any], width: int, height: int) -> float:
    x1, y1, x2, y2 = candidate["bbox"]
    box_width = (x2 - x1 + 1) / width
    box_height = (y2 - y1 + 1) / height
    aspect = box_width / max(box_height, 0.0001)
    aspect_score = 1.0 if 0.35 <= aspect <= 2.8 else 0.35
    vertical_score = clamp(1.0 - abs((y1 + y2) / 2.0 / height - 0.58))
    return clamp(aspect_score * 0.55 + vertical_score * 0.45)


def score_hard_negatives(candidate: dict[str, Any], glare_ratio: float) -> dict[str, float]:
    x1, y1, x2, y2 = candidate["bbox"]
    aspect = (x2 - x1 + 1) / max(y2 - y1 + 1, 1)
    compact = 1.0 - candidate["irregularity"]
    return {
        "puddle": clamp(glare_ratio * 6.0 + compact * 0.22, 0.0, 0.95),
        "road_patch": clamp(compact * 0.42 + candidate["fill_ratio"] * 0.18, 0.0, 0.95),
        "manhole_cover": clamp((0.42 if abs(aspect - 1.0) < 0.18 else 0.12) + compact * 0.22, 0.0, 0.9),
        "shadow": clamp(compact * 0.2 + (0.26 if candidate["mean"] < 40 else 0.08), 0.0, 0.9),
        "speed_breaker": clamp((0.45 if aspect > 2.4 else 0.08) + compact * 0.14, 0.0, 0.9),
    }


def estimate_severity(area_ratio: float, irregularity: float, confidence: float) -> str:
    severity_score = area_ratio * 4.8 + irregularity * 0.8 + confidence * 0.6
    if severity_score >= 1.4:
        return "high"
    if severity_score >= 0.85:
        return "medium"
    return "low"


def detect_source_violation(capture_context: dict[str, Any]) -> str | None:
    if capture_context.get("live_capture_required") and capture_context.get("source_type") not in (None, "live_camera"):
        return "live_capture_required"
    if capture_context.get("filters_applied"):
        return "filters_not_allowed"
    if capture_context.get("overlay_baked_in"):
        return "overlay_not_allowed"
    return None


def build_guidance_prompt(blocked_reason: str | None, downgraded_reason: str | None) -> str:
    reason = blocked_reason or downgraded_reason
    if reason == "pothole_outside_boundary":
        return "Center pothole in frame."
    if reason == "pothole_too_small":
        return "Move closer."
    if reason == "pothole_cropped":
        return "Keep full pothole inside boundary."
    if reason in {"low_sharpness", "excessive_motion"}:
        return "Hold steady."
    if reason == "poor_exposure":
        return "Too dark, find better light."
    if reason == "severe_glare":
        return "Reduce glare."
    if reason == "bad_capture_angle":
        return "Lower camera angle slightly."
    if reason == "partial_occlusion":
        return "Clear the view."
    if reason in {"pothole_candidate_missing", "pothole_not_confident"}:
        return "Center pothole in frame."
    return "Image ready."


def derive_image_source(capture_context: dict[str, Any]) -> str:
    if capture_context.get("raw_used"):
        return "raw_or_least_processed"
    if capture_context.get("raw_available"):
        return "least_processed_rgb_from_raw_path"
    return "least_processed_native_camera" if capture_context.get("source_type") == "live_camera" else "uploaded_image"


def normalize_box(bbox: list[int], width: int, height: int) -> list[float]:
    x1, y1, x2, y2 = bbox
    return [round4(x1 / width), round4(y1 / height), round4(x2 / width), round4(y2 / height)]


def normalize_polygon(bbox: list[int], width: int, height: int) -> list[list[float]]:
    x1, y1, x2, y2 = bbox
    return [
        [round4(x1 / width), round4(y1 / height)],
        [round4(x2 / width), round4(y1 / height)],
        [round4(x2 / width), round4(y2 / height)],
        [round4(x1 / width), round4(y2 / height)],
    ]


def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(value, max_value))


def round4(value: float) -> float:
    return round(float(value), 4)
