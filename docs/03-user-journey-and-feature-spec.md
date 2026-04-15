# Mana Rasta User Journey and Feature Spec

## Primary Citizen Journey

1. Open app
2. Sign in with OTP
3. Land on Home
4. Start report
5. Capture pothole image
6. Confirm location and details
7. Submit report
8. View success state
9. Track report in My Reports

## Current Implemented Citizen Features

### Login

- phone number entry
- OTP entry and verification

Reference: [LoginScreen.tsx](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens/LoginScreen.tsx)

### Home

- primary reporting entry
- user-facing summary / navigation

Reference: [HomeScreen.tsx](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens/HomeScreen.tsx)

### Camera

- dedicated camera flow
- quality-state logic exists in camera modules

Reference:
- [CameraScreen.tsx](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens/CameraScreen.tsx)
- [mobile/src/camera](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/camera)

### Report

- image
- location capture
- severity
- road type
- description
- submission

Reference: [ReportScreen.tsx](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens/ReportScreen.tsx)

### Success

- confirmation screen after report submission

Reference: [ReportSuccessScreen.tsx](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens/ReportSuccessScreen.tsx)

### Tracking and Account

- My Reports
- Rewards
- Profile
- Edit Profile
- Notifications
- How It Works
- Privacy & Terms

Reference: [mobile/src/screens](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens)

## Primary Admin Journey

1. Log in to dashboard
2. Open reports queue
3. Inspect report detail
4. Update or review workflow state
5. Monitor analytics / SLA / fraud views

## Current Implemented Admin Features

- report list and detail
- analytics page
- fraud page
- officers page
- leaderboard page
- SLA page

Reference: [dashboard/src/pages](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/pages)

## Backend Feature Support

- auth and OTP support
- report creation and lookup
- geo validation
- rewards endpoints
- admin endpoints
- analytics endpoints
- fraud and moderation services
- ML capture-analysis integration

Reference: [backend/src/routes](/C:/Users/ADMIN/Downloads/mana-rasta/backend/src/routes)

## Critical Rules Already Reflected In Code

- report requires image
- report requires valid coordinates
- Hyderabad region validation exists
- capture analysis can block submission
- moderation can reject image
- duplicate/fraud checks exist

## What Comes Next

- write flow-level acceptance criteria
- document exact status transitions
- define failure-state UX per screen
- document notification triggers and reward triggers

