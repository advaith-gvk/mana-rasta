# Mana Rasta Data Model and Schema Spec

## Current State

The current backend schema is migration-driven and centered on reports, users, rewards, admin operations, and capture logging.

Reference:

- [001_initial_schema.sql](/C:/Users/ADMIN/Downloads/mana-rasta/backend/migrations/001_initial_schema.sql)
- [002_officers_and_redressal.sql](/C:/Users/ADMIN/Downloads/mana-rasta/backend/migrations/002_officers_and_redressal.sql)
- [003_capture_ml_logging.sql](/C:/Users/ADMIN/Downloads/mana-rasta/backend/migrations/003_capture_ml_logging.sql)

## Core Data Areas Already Present

- users and auth-related records
- reports
- report workflow / redressal structures
- officers and admin-facing operational entities
- rewards-related entities
- spatial / ward support
- capture analysis logging

## Key Logical Entities

### Users

- citizen identity
- auth linkage
- device / session-related context where applicable

### Reports

- image-linked pothole reports
- location and severity
- current status
- submission metadata

### Officers / Admin

- operational users
- assignment and redressal support

### Rewards

- points
- badges
- leaderboard / voucher-related data

### Fraud / Moderation / Capture Logs

- fraud signals
- moderation decisions
- ML / capture quality outputs

## Geo Model

The current architecture assumes spatial support through PostgreSQL/PostGIS for:

- Hyderabad region checks
- ward / zone mapping
- geo-based analytics

## Current Strengths

- migrations exist instead of undocumented manual schema
- capture logging has already been added as a separate migration
- officer and redressal concerns are represented in schema evolution

## Current Gaps

- no single ERD or entity list document
- status lifecycle and table ownership are not summarized in one place
- analytics-facing derived data is not documented here yet

## What Comes Next

- produce a compact ERD
- list each table with ownership and purpose
- document status lifecycle columns and audit behavior

