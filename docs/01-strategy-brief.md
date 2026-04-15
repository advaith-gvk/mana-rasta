# Mana Rasta Strategy Brief

## Purpose

Mana Rasta is a focused pothole reporting platform for Hyderabad. It combines:

- a citizen mobile app in [mobile](/C:/Users/ADMIN/Downloads/mana-rasta/mobile)
- an admin dashboard in [dashboard](/C:/Users/ADMIN/Downloads/mana-rasta/dashboard)
- a backend API in [backend](/C:/Users/ADMIN/Downloads/mana-rasta/backend)
- a lightweight capture-analysis service in [ml-service](/C:/Users/ADMIN/Downloads/mana-rasta/ml-service)

## What Is Already Built

- OTP-based auth flow on mobile and backend
- mobile reporting flow with camera, location, severity, notes, and success state
- My Reports, Rewards, Profile, Notifications, How It Works, and Privacy/Terms screens in mobile
- admin dashboard pages for reports, analytics, fraud, officers, SLA, leaderboard, and report detail
- backend routes for auth, reports, geo, rewards, analytics, acknowledgments, and admin
- fraud, moderation, storage, rewards, and ML-service integration in backend
- Postgres migrations, including schema and capture log support
- Docker setup for backend, dashboard, database, Redis, and ML service

## Core Product Bet

The product is betting that better pothole reporting outcomes come from:

- better capture quality
- stronger location fidelity
- tighter workflow visibility
- lower duplicate and fraud noise
- clearer citizen feedback after submission

## Primary Users

- Citizen reporter
- GHMC officer / admin user
- Operations / moderation team

## Current Product Shape

### Citizen Side

- sign in with mobile OTP
- report a pothole through a guided flow
- track reports
- view rewards and profile information
- manage notification preferences

### Operational Side

- review incoming reports
- inspect report detail
- manage officers and statuses
- monitor analytics and SLA-related views
- inspect fraud-related signals

## Current Strategic Strengths

- narrow, clear product scope
- full-stack implementation already exists
- strong emphasis on structured report intake
- quality/fraud thinking is already present in code

## Current Strategic Weaknesses

- repo is not yet cleanly packaged as a handoff-ready product
- ML layer is still heuristic, not trained-model based
- dashboard and mobile appear stronger than current documented operating process
- project still mixes production code with prototype/demo artifacts at repo root

## Success Measures

Near-term measures:

- completed report submissions
- usable image rate
- duplicate rejection rate
- report-to-status-update rate
- dashboard workflow adoption

Operational measures:

- acknowledgment time
- fix time
- SLA compliance
- ward / zone-level report volume and closure performance

## What Comes Next

- clean the repo and define a single source of truth
- formalize pilot scope and ward rollout plan
- document operational workflow with GHMC-facing assumptions
- upgrade the ML service from heuristic gating to real trained inference over time

