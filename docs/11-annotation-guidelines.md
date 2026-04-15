# Mana Rasta Annotation Guidelines

## Purpose

This document defines the minimum labeling guidance needed for a future pothole dataset aligned to the current product.

## Current Product Context

The current app and ML service imply the need to distinguish:

- real potholes
- poor-quality captures
- hard negatives
- severity levels

## Minimum Labels

Per image:

- pothole present: yes / no
- pothole box: one or more boxes if present
- hard negative type: puddle, patch, manhole, shadow, speed breaker, none
- quality flags: blurry, glare, cropped, off-center, occluded, too small
- severity: low, medium, high, critical

## Basic Rules

### What Counts As A Pothole

- visible cavity or road-surface failure that matches reportable pothole criteria

### What Does Not Count

- flat patch repairs
- painted markings
- shadows
- standing water without road failure
- manhole covers

### Boxing Rule

- draw the box tightly around the pothole area
- include the full visible pothole
- avoid excessive surrounding road

### Quality Labels

- blurry: pothole boundaries unclear
- glare: bright reflections obscure useful detail
- cropped: pothole cut off by frame edge
- off-center: pothole outside intended capture area
- occluded: object blocks useful view
- too small: pothole occupies too little of frame

## Current Gap

This is a seed document only. No labeling pipeline exists in repo yet.

## What Comes Next

- add visual examples
- define double-review process
- define disagreement resolution
- define export format for training

