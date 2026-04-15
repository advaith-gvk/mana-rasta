# Mana Rasta DevOps and Deployment Runbook

## Current Local Stack

The repo already includes a Docker Compose setup for major local services.

Reference:

- [docker-compose.yml](/C:/Users/ADMIN/Downloads/mana-rasta/docker-compose.yml)

## Current Deployable Components

- backend service
- dashboard service
- PostgreSQL / PostGIS
- Redis
- ML service

Dockerfiles exist in:

- [backend/Dockerfile](/C:/Users/ADMIN/Downloads/mana-rasta/backend/Dockerfile)
- [dashboard/Dockerfile](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/Dockerfile)
- [ml-service/Dockerfile](/C:/Users/ADMIN/Downloads/mana-rasta/ml-service/Dockerfile)

## Current Environment Notes

- backend and mobile both include `.env.example`
- dashboard depends on API URL configuration
- ML service depends on service URL wiring from backend

## Current Operational Requirements

- database must be available
- Redis must be available for cache / limits
- object storage integration must be configured
- Firebase / notification config must be present if push is enabled

## Current Gaps

- no staging / production runbook in docs
- no incident or rollback guide
- no deployment topology note beyond local compose

## What Comes Next

- define staging and production environment maps
- define deploy / rollback steps
- define monitoring and backup expectations

