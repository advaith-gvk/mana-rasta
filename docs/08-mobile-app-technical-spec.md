# Mana Rasta Mobile App Technical Spec

## Current App

The mobile app is an Expo / React Native app with screen-based flows for login, reporting, tracking, rewards, and profile/settings.

Reference:

- [mobile/package.json](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/package.json)
- [mobile/app](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/app)
- [mobile/src/screens](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens)

## Current Technical Areas

### Navigation

- Expo router entry
- auth and tab structure in `mobile/app`

### Screens

- login
- home
- camera
- report
- report success
- My Reports
- Rewards
- Profile
- Edit Profile
- Notifications
- How It Works
- Privacy & Terms

### State

- auth state via Zustand
- camera-specific state in dedicated camera store

Reference:

- [authStore.ts](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/store/authStore.ts)
- [cameraStore.ts](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/camera/cameraStore.ts)

### Services

- backend API client
- device-related utilities

Reference:

- [api.ts](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/services/api.ts)
- [device.ts](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/utils/device.ts)

### Camera Stack

- capture repository
- frame analyzer
- quality state machine

Reference:

- [mobile/src/camera](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/camera)

## Current Product Assumptions In Code

- reporting is mobile-first
- camera flow is central
- location is part of report creation
- notifications and rewards are product surfaces, not just future ideas

## Current Gaps

- no single mobile architecture note
- screen contracts are implied by implementation, not summarized
- offline and retry behavior are not documented in one place

## What Comes Next

- document navigation map and screen ownership
- define API dependency per screen
- define offline/error/retry behavior for submission flow

