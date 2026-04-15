# Mana Rasta ML Problem Definition and Data Spec

## Current ML Scope

The current ML service is a Python inference service used for capture quality and pothole-candidate analysis.

Reference:

- [ml-service/app/main.py](/C:/Users/ADMIN/Downloads/mana-rasta/ml-service/app/main.py)
- [backend/src/services/potholeMlService.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/services/potholeMlService.js)

## Current Tasks Already Reflected In Code

- image readability validation
- quality scoring
- pothole-candidate detection
- hard-negative risk scoring
- capture guidance prompts
- basic severity estimation
- capture log persistence

## Current Input Shape

- image payload
- mimetype
- capture context
- device context

Reference:

- [ml-service/README.md](/C:/Users/ADMIN/Downloads/mana-rasta/ml-service/README.md)

## Current Output Shape

- capture status
- quality readiness
- blocked or downgraded reason
- guidance prompt
- quality flags and metrics
- detection confidence and boxes/masks
- review recommendation
- metadata and model version

## Current Reality

- the service is heuristic-based
- there is no trained-model pipeline in repo yet
- there is no labeled dataset in repo yet

## Data Need Implied By Current Product

To move beyond heuristics, the product will need labels for:

- pothole present / absent
- pothole location
- hard negatives such as puddles and patches
- capture quality issues
- severity

## Current Gap

- no data collection process documented
- no label schema documented
- no model evaluation document yet

## What Comes Next

- define label schema
- define dataset collection workflow
- separate heuristic service from future trained-model path
- define evaluation metrics and rollout thresholds

