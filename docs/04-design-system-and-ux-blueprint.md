# Mana Rasta Design System and UX Blueprint

## Design Intent

Mana Rasta should feel:

- civic
- trustworthy
- clear
- action-oriented

It should not feel like a generic complaint form or a noisy social app.

## Current Visual Direction In The Product

From the implemented mobile screens and HTML prototype, the current design language is built around:

- navy as the trust anchor
- gold as the action and reward accent
- green for success/fixed states
- light neutral surfaces for content areas
- rounded cards, chips, and pills

Observed colors already used in the project:

- Navy: `#002B5C`
- Gold: `#F5A623`
- Green: `#058541`
- Red: `#EF4444`

## Current UX Priorities Already Visible

### Mobile

- strong report CTA
- camera-first reporting
- progressive report flow
- visible success / tracking path
- separate informational and profile screens

### Dashboard

- operational pages split by function
- reports and detail views as core workflow
- analytics, fraud, SLA, and officers as supporting surfaces

## Current Component Patterns

Already evident in code and prototype:

- cards
- stat tiles
- status badges
- severity badges
- filter chips
- tabbed reward views
- timeline / workflow indicators
- form inputs and toggles

References:

- [mobile/src/screens](/C:/Users/ADMIN/Downloads/mana-rasta/mobile/src/screens)
- [dashboard/src/components](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/components)
- [mana-rasta-app.html](/C:/Users/ADMIN/Downloads/mana-rasta/mana-rasta-app.html)

## UX Rules

### Citizen App

- primary action should always be obvious
- camera guidance should use short prompts
- report submission should feel sequential, not dense
- status should be understandable at a glance

### Dashboard

- operational clarity over visual decoration
- filters and detail inspection should be fast
- statuses, severity, and fraud signals should be immediately legible

## Tone

Use copy that is:

- direct
- reassuring
- non-technical

Examples:

- Report a pothole
- Hold steady
- Move closer
- Image ready
- Report submitted

## Accessibility Baseline

- high contrast on primary actions
- status not conveyed by color alone
- clear labels for inputs and toggles
- readable mobile text sizes

## What Comes Next

- extract design tokens into shared documentation
- align mobile and dashboard component naming
- define spacing, typography, and icon rules explicitly
- document loading, empty, and error states as a full system

