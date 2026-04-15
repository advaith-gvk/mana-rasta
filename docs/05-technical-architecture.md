# Mana Rasta Technical Architecture

## Current System

Mana Rasta currently consists of four main application layers:

- mobile app in [mobile](/C:/Users/ADMIN/Downloads/mana-rasta/mobile)
- admin dashboard in [dashboard](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard)
- backend API in [backend](/C:/Users/ADMIN/Downloads/mana-rasta/backend)
- ML analysis service in [ml-service](/C:/Users/ADMIN/Downloads/mana-rasta/ml-service)

Supporting infrastructure already present:

- PostgreSQL / PostGIS
- Redis
- object storage integration
- Docker Compose local stack

Reference: [docker-compose.yml](/C:/Users/ADMIN/Downloads/mana-rasta/docker-compose.yml)

## Mobile

Current role:

- citizen auth
- camera capture
- report flow
- profile and rewards surfaces
- notification/settings surfaces

Key implementation areas:

- [mobile/app](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/app)
- [mobile/src/screens](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens)
- [mobile/src/camera](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/camera)

## Dashboard

Current role:

- report operations
- analytics
- officer management
- fraud review
- SLA review

Key implementation areas:

- [dashboard/src/pages](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/pages)
- [dashboard/src/components](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/components)

## Backend API

Current role:

- auth
- report lifecycle
- geo validation
- moderation and fraud checks
- rewards
- analytics
- admin workflows

Key implementation areas:

- [backend/src/routes](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes)
- [backend/src/controllers](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/controllers)
- [backend/src/services](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/services)

## ML Service

Current role:

- capture-quality and pothole-candidate analysis

Current state:

- FastAPI service
- heuristic inference, not trained-model inference yet

Key implementation areas:

- [ml-service/app/main.py](/C:/Users/ADMIN/Downloads/mana-rasta/ml-service/app/main.py)
- [backend/src/services/potholeMlService.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/services/potholeMlService.js)

## Current Data Flow

### Citizen Report Submission

1. mobile authenticates user
2. mobile captures image and details
3. backend validates request
4. backend calls ML service
5. backend runs moderation / fraud / duplicate checks
6. backend stores image and report data
7. backend returns report result to mobile

### Admin Review

1. dashboard loads report lists and filters
2. dashboard fetches report details
3. backend returns structured report and workflow data
4. admin updates status or reviews signals

## Current Persistence and Infra

- schema migrations in [backend/migrations](/C:/Users/ADMIN/Downloads/mana-rasta/backend/migrations)
- DB config in [backend/src/config/db.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/config/db.js)
- Redis config in [backend/src/config/redis.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/config/redis.js)
- Firebase integration in [backend/src/config/firebase.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/config/firebase.js)

## Current Strengths

- clear separation between mobile, dashboard, backend, and ML service
- routes, controllers, services, and migrations already exist
- geospatial and fraud concerns are already reflected in code
- local stack is containerized

## Current Gaps

- ML service is still heuristic
- repo includes duplicate/prototype/generated artifacts at root
- source-of-truth boundaries are less clean than the application architecture itself
- some documentation still describes the system more ideally than operationally

## What Comes Next

- clean repo structure and remove accidental/duplicate artifacts
- document API contracts and status lifecycle explicitly
- harden the ML service contract and fallback behavior
- define staging/production deployment architecture more formally

