# Mana Rasta Dashboard Technical Spec

## Current App

The dashboard is a React + Vite admin app for report operations, analytics, fraud review, officers, SLA, and leaderboard views.

Reference:

- [dashboard/package.json](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/package.json)
- [dashboard/src/pages](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/pages)
- [dashboard/src/components](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/components)

## Current Pages

- DashboardPage
- ReportsPage
- ReportDetailPage
- AnalyticsPage
- FraudPage
- OfficersPage
- SLAPage
- LeaderboardPage
- LoginPage

## Current Shared Components

- layout
- report drawer
- severity badge
- status badge
- stat card

## Current Data Access

- API access through [dashboard/src/services/api.ts](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/services/api.ts)
- auth support through [useAuth.ts](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard/src/hooks/useAuth.ts)

## Current Dashboard Role

- inspect incoming and historical reports
- review workflow status
- review analytics and SLA views
- inspect fraud-oriented views
- manage officer-related operations

## Current Gaps

- page-by-page ownership and route map are undocumented
- role model and permission boundaries are not summarized here
- report detail and queue interactions are defined in code only

## What Comes Next

- define page responsibilities and primary API dependencies
- document admin roles and permission boundaries
- document filtering, sorting, and report detail workflows

