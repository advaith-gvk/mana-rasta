# Mana Rasta Security and Privacy Threat Model

## Current Sensitive Areas

The current product handles:

- phone numbers
- OTP flows
- precise location data
- pothole images
- admin operations

## Current Technical Surfaces

- mobile auth and reporting
- backend auth, reports, admin, analytics
- dashboard admin access
- object storage
- notification infrastructure

## Main Risks

### Citizen Risks

- OTP abuse
- account takeover via weak auth handling
- exposure of phone number or report history
- unnecessary retention of location-linked data

### Operational Risks

- unauthorized admin access
- unsafe status changes without auditability
- report tampering

### Abuse Risks

- spam submissions
- duplicate image abuse
- fake location or fake image submissions
- manipulation of rewards

## Current Mitigations Already Present In Code

- auth middleware
- rate limiting
- fraud service
- moderation service
- structured backend roles and admin route separation

Reference:

- [backend/src/middleware](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/middleware)
- [backend/src/services/fraudService.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/services/fraudService.js)
- [backend/src/services/moderationService.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/services/moderationService.js)

## Current Gaps

- no single privacy inventory document
- no consolidated admin threat model
- no documented retention / deletion policy in engineering docs

## What Comes Next

- document data inventory and retention rules
- document admin role boundaries
- define security review checklist for release

