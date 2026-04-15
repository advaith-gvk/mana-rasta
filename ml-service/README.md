# ML Service

Python inference service for pothole capture quality analysis, detection, and lightweight segmentation.

## Endpoints

- `GET /health`
- `POST /analyze`

## Local run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Request shape

```json
{
  "image_base64": "<base64>",
  "mimetype": "image/jpeg",
  "capture_context": {},
  "device_context": {}
}
```
