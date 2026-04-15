# Mana Rasta API Contract

## Current API Surface

The backend currently exposes route groups for:

- auth
- reports
- geo
- rewards
- analytics
- admin
- acknowledgments

Reference: [backend/src/routes](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes)

## Current Contract Shape

### Auth

- OTP request / verify flow
- user session and profile-related operations

Primary reference:
- [auth.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/auth.js)
- [authController.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/controllers/authController.js)

### Reports

- capture analysis
- create report
- list reports
- report detail and related views

Primary reference:
- [reports.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/reports.js)
- [reportsController.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/controllers/reportsController.js)

### Geo

- Hyderabad / ward / spatial lookups

Reference:
- [geo.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/geo.js)

### Rewards

- badges
- leaderboard
- vouchers / reward-related reads

Reference:
- [rewards.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/rewards.js)

### Analytics

- operational and performance views for dashboard consumption

Reference:
- [analytics.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/analytics.js)

### Admin

- report operations
- officers
- workflow/admin actions

Reference:
- [admin.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes/admin.js)

## Current Cross-Cutting Rules

- auth-protected routes use middleware
- validation middleware exists
- rate limiting exists
- error handler is centralized

Reference:
- [middleware/auth.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/middleware/auth.js)
- [middleware/validate.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/middleware/validate.js)
- [middleware/rateLimiter.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/middleware/rateLimiter.js)
- [middleware/errorHandler.js](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/middleware/errorHandler.js)

## Current Gaps

- no single API reference file for consumers
- request/response examples are spread across controllers
- auth and admin role requirements are not centrally documented

## What Comes Next

- publish endpoint-by-endpoint request/response examples
- document auth requirements and role rules
- define stable response envelopes and error codes

