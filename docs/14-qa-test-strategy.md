# Mana Rasta QA Test Strategy

## Current Test Surface

The backend already includes API tests.

Reference:

- [backend/tests/api.test.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/tests/api.test.js)

## Core Flows To Test

### Citizen Flows

- OTP login
- camera/report flow
- location validation
- successful report submission
- blocked report due to quality/moderation
- My Reports visibility
- notifications and profile flows

### Dashboard Flows

- admin login
- reports list
- report detail
- analytics page load
- fraud page load
- officer and SLA views

### Backend Flows

- auth
- report create/list/detail
- geo validation
- rewards fetches
- analytics fetches
- admin workflows

## High-Risk Areas

- report submission edge cases
- ML service failure behavior
- duplicate / fraud handling
- role-restricted admin behavior
- out-of-region submissions

## Current Gaps

- no documented mobile QA matrix
- no documented dashboard QA matrix
- no release checklist

## What Comes Next

- define test matrix by feature
- define device coverage for mobile
- define regression checklist for pilot release

