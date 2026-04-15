# Mana Rasta Analytics Plan and Metrics Dictionary

## Current Analytics Surface

The current system already includes analytics routes and dashboard analytics views.

Reference:

- [backend/src/routes/analytics.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/analytics.js)
- [dashboard/src/pages/AnalyticsPage.tsx](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/pages/AnalyticsPage.tsx)

## Core Metric Areas

### Report Metrics

- reports submitted
- reports by status
- reports by ward / zone
- reports by severity

### Operational Metrics

- acknowledgment timing
- in-progress volume
- fixed volume
- SLA-related counts and trends

### Quality / Trust Metrics

- blocked capture count
- moderation rejection count
- duplicate / fraud signal counts

### Engagement Metrics

- rewards usage
- leaderboard views / outcomes where relevant
- repeat reporting behavior

## Current Source Areas

- reports data
- capture logs
- fraud events
- rewards data
- officer / SLA-related views

## Current Gaps

- no single metrics dictionary in repo
- event naming and analytic definitions are not centralized
- source-of-truth ownership by metric is not documented

## What Comes Next

- define each KPI precisely
- define source table / endpoint for each metric
- define pilot dashboard metric set

