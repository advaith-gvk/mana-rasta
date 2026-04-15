# Mana Rasta Product Requirements Document

## Product

Mana Rasta is a Hyderabad pothole reporting product with a citizen mobile app and an admin dashboard.

## Goal

Enable a citizen to submit a high-quality pothole report quickly and enable an admin or officer to process it with enough context to act.

## In Scope Today

Based on the current repo, the product already includes:

### Mobile

- OTP login
- home screen
- camera screen
- report screen
- report success screen
- My Reports
- Rewards
- Profile
- Edit Profile
- Notifications
- How It Works
- Privacy & Terms

Reference: [mobile/src/screens](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens)

### Backend

- auth APIs
- reports APIs
- geo APIs
- rewards APIs
- analytics APIs
- admin APIs
- acknowledgments APIs
- fraud checks
- moderation service
- storage service
- rewards service
- ML-service integration

Reference: [backend/src](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src)

### Dashboard

- login
- dashboard overview
- reports page
- report detail page
- analytics page
- fraud page
- officers page
- SLA page
- leaderboard page

Reference: [dashboard/src/pages](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/pages)

## Primary Requirements

### Citizen Reporting

- user can authenticate by OTP
- user can capture and submit a pothole report
- report includes image, coordinates, severity, and optional description
- invalid or out-of-region reports are rejected
- user sees a success state and can review report history

### Admin Workflow

- admin can list, filter, and inspect reports
- admin can review report details and workflow status
- admin can access analytics, fraud, officers, and SLA views

### Quality and Trust

- report quality is evaluated before acceptance
- fraud and duplicate checks exist in backend
- moderation exists for uploaded images

## Non-Goals For This Document

- broad civic complaint categories
- public social feed
- multilingual rollout details
- field crew routing

## Key Constraints

- current ML service is heuristic-based
- current product is centered on Hyderabad / GHMC geography
- object storage, Postgres, Redis, and containerized local dev are assumed

## Success Criteria

- report submission flow is stable
- reports are structured and reviewable
- admin queue is actionable
- user can track report outcomes

## What Comes Next

- tighten acceptance criteria per flow
- define explicit status lifecycle and SLA rules
- define reward eligibility rules more formally
- formalize pilot metrics and operational ownership

