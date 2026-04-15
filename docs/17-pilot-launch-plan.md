# Mana Rasta Pilot Launch Plan

## Goal

Launch Mana Rasta as a controlled pothole reporting pilot using the product that already exists in this repo.

## Current Launchable Pieces

- citizen mobile app with reporting flow
- backend API with report, geo, fraud, moderation, rewards, and analytics support
- admin dashboard with report and operational pages
- local infrastructure via Docker Compose

## Recommended Pilot Scope

- limited geography within Hyderabad
- controlled admin / operator access
- manual monitoring of submission quality and workflow behavior
- limited user cohort before wider rollout

## Pilot Readiness Areas

### Product

- validate end-to-end login and report submission
- validate My Reports and status visibility

### Operations

- confirm report review workflow
- confirm status handling path
- confirm dashboard usability for operators

### Technical

- confirm backend, DB, Redis, and ML service are stable
- confirm object storage and notifications configuration

### Measurement

- define pilot KPIs
- define failure thresholds

## Pilot Risks

- poor report quality
- dashboard workflow friction
- ML false blocks
- weak operational ownership
- noisy rewards behavior

## Current Gaps

- no written pilot operating model
- no documented go/no-go checklist
- no rollout timeline document

## What Comes Next

- define pilot wards / users
- define launch checklist and owner per function
- define support and escalation path during pilot

