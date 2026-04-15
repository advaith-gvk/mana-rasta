# Mana Rasta — Hyderabad Pothole Reporting

**Mana Rasta** ("Our Road" in Telugu) is a production-ready civic reporting platform that enables Hyderabad citizens to report road potholes directly to GHMC ward engineers. The platform includes a gamified mobile app, a role-based admin web portal, fraud prevention, SLA tracking, and spatial analytics powered by PostGIS.

---

## What's in this repo

| Artefact | Path | Description |
|---|---|---|
| Mobile app (React Native) | `mobile/` | Citizen-facing Expo app, 13 screens |
| Admin portal (React) | `dashboard/` | GHMC officer dashboard (React + Vite + Tailwind) |
| Admin portal (HTML demo) | `mana-rasta-web-portal-fix.html` | Self-contained interactive portal demo |
| Mobile app (HTML demo) | `mana-rasta-app.html` | Self-contained interactive mobile preview |
| Backend API (Node.js) | `backend/` | Express + PostgreSQL/PostGIS + Redis |
| ML service (Python) | `ml-service/` | FastAPI pothole classifier sidecar |
| Docs | `docs/` | 17 spec documents (architecture → QA) |
| Assets | `gif-assets/`, `investor-assets/`, `video-assets/` | Screen recordings, walkthroughs, screenshots |

---

## Architecture

```
Citizen App (React Native / Expo)
Admin Portal (React + Vite + Tailwind)
        │
        ▼
API Gateway (Express + JWT + rate-limiter)
        │
   ┌────┴──────────────────────────────┐
Reports  Auth/Users  Geo/PostGIS  Rewards  Admin
Service  Service     Service      Service  Service
   └────┬──────────────────────────────┘
        │
Background workers (node-cron)
  • Priority score refresh    (hourly)
  • Leaderboard refresh       (every 6 h)
  • SLA escalation alerts     (hourly)
  • Ban expiry                (daily)
  • OTP cleanup               (daily)
        │
   ┌────┴─────────────────────────────┐
PostgreSQL+PostGIS   Redis    AWS S3   Moderation API
(spatial data,       (cache,  (images) (Sightengine /
 ward polygons)      rate               Rekognition)
                     limits)
```

---

## Project structure

```
mana-rasta/
├── backend/                        Node.js + Express API
│   ├── src/
│   │   ├── app.js                  Entry point, middleware setup
│   │   ├── config/
│   │   │   ├── db.js               PostgreSQL pool
│   │   │   ├── redis.js            Redis client + cache helpers
│   │   │   └── firebase.js         FCM push notifications
│   │   ├── controllers/
│   │   │   ├── authController.js   OTP, JWT, profile
│   │   │   ├── reportsController.js Submit, list, nearby, confirm fix
│   │   │   └── adminController.js  Queue, status, ban, analytics
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── reports.js
│   │   │   ├── acknowledgments.js
│   │   │   ├── rewards.js
│   │   │   ├── admin.js
│   │   │   ├── analytics.js
│   │   │   └── geo.js
│   │   ├── services/
│   │   │   ├── fraudService.js     All fraud detection checks
│   │   │   ├── moderationService.js Image safety + perceptual hash
│   │   │   ├── rewardsService.js   Points, badges, leaderboard
│   │   │   ├── storageService.js   S3 presigned upload + thumbnails
│   │   │   └── smsService.js       Twilio OTP
│   │   ├── middleware/
│   │   │   ├── auth.js             JWT verify, role guards
│   │   │   ├── rateLimiter.js      Global + endpoint rate limits
│   │   │   ├── validate.js         Joi body/query validators
│   │   │   └── errorHandler.js     Structured error responses
│   │   ├── jobs/
│   │   │   └── index.js            node-cron background jobs
│   │   └── utils/
│   │       ├── errors.js           AppError class
│   │       ├── logger.js           Winston logger
│   │       └── seed.js             GHMC zones/wards/achievements seed
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  Full schema with PostGIS + triggers
│   │   ├── 002_officers_and_redressal.sql
│   │   └── 003_capture_ml_logging.sql
│   └── tests/
│       └── api.test.js             Jest integration tests
│
├── dashboard/                      React + Vite + Tailwind admin UI
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.tsx   Overview map + priority queue
│       │   ├── ReportsPage.tsx     Filterable table + drawer
│       │   ├── AnalyticsPage.tsx   Charts, zone breakdown, CSV export
│       │   ├── FraudPage.tsx       Fraud events + ban/suspend actions
│       │   ├── SLAPage.tsx         SLA tracker + breach escalation
│       │   ├── LeaderboardPage.tsx Weekly/monthly/alltime
│       │   ├── OfficersPage.tsx    Ward officer management
│       │   └── LoginPage.tsx
│       ├── components/
│       │   ├── Layout.tsx          Collapsible sidebar, role-aware nav
│       │   ├── ReportDrawer.tsx    Slide-in detail + officer notes
│       │   ├── SeverityBadge.tsx
│       │   ├── StatusBadge.tsx
│       │   └── StatCard.tsx
│       ├── hooks/
│       │   └── useAuth.ts          Auth context + provider
│       └── services/
│           └── api.ts              Axios client + all API helpers
│
├── mobile/                         React Native + Expo citizen app
│   ├── app/                        Expo Router v3 file-based routes
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx           → LoginScreen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx         Tab bar (Home, Reports, FAB, Rewards, Profile)
│   │   │   ├── home.tsx            → HomeScreen
│   │   │   ├── my-reports.tsx      → MyReportsScreen
│   │   │   ├── rewards.tsx         → RewardsScreen
│   │   │   └── profile.tsx         → ProfileScreen
│   │   ├── camera/
│   │   │   ├── _layout.tsx         fullScreenModal presentation
│   │   │   └── index.tsx           → CameraScreen
│   │   ├── notifications/
│   │   │   ├── _layout.tsx
│   │   │   └── index.tsx           → NotificationsScreen
│   │   ├── profile/
│   │   │   ├── _layout.tsx         Stack navigator for profile sub-screens
│   │   │   ├── edit-profile/       → EditProfileScreen
│   │   │   ├── how-it-works/       → HowItWorksScreen
│   │   │   └── privacy-terms/      → PrivacyTermsScreen
│   │   ├── report/
│   │   │   ├── index.tsx           → ReportScreen
│   │   │   └── success.tsx         → ReportSuccessScreen
│   │   └── _layout.tsx             Root layout (auth gate)
│   └── src/
│       ├── screens/                All 13 screen components
│       │   ├── LoginScreen.tsx     Phone + OTP auth, 30 s countdown
│       │   ├── HomeScreen.tsx      Greeting, level progress, CTA, stats
│       │   ├── CameraScreen.tsx    Quality state machine, manual shutter
│       │   ├── ReportScreen.tsx    GPS, camera-only, severity, submit
│       │   ├── ReportSuccessScreen.tsx  Points animation, share badge
│       │   ├── MyReportsScreen.tsx Filter tabs, timeline, verify fix
│       │   ├── RewardsScreen.tsx   Badges + share modal, leaderboard, vouchers
│       │   ├── ProfileScreen.tsx   Stats, menu, sign out
│       │   ├── EditProfileScreen.tsx   Name/email, notif toggle, delete account
│       │   ├── NotificationsScreen.tsx  5 preference toggles + recent feed
│       │   ├── HowItWorksScreen.tsx     5-step guide, points table, level ladder
│       │   └── PrivacyTermsScreen.tsx   Privacy Policy + Terms of Use tabs
│       ├── camera/                 Camera quality state machine
│       │   ├── types.ts
│       │   ├── FrameAnalyzer.ts
│       │   ├── QualityStateMachine.ts
│       │   ├── CaptureRepository.ts
│       │   └── cameraStore.ts
│       ├── services/
│       │   └── api.ts              Mobile API client (TanStack Query v5)
│       ├── store/
│       │   └── authStore.ts        Zustand auth state
│       ├── assets/
│       │   ├── splash.png          App splash image
│       │   └── pothole-sample.webp Sample pothole image (demo/testing)
│       └── utils/
│           └── device.ts           Device fingerprint + push token
│
├── ml-service/                     Python FastAPI pothole classifier
│   ├── app/main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── docs/                           Technical documentation (17 documents)
│   ├── 01-strategy-brief.md
│   ├── 02-product-requirements-document.md
│   ├── 03-user-journey-and-feature-spec.md
│   ├── 04-design-system-and-ux-blueprint.md
│   ├── 05-technical-architecture.md
│   ├── 06-api-contract.md
│   ├── 07-data-model-and-schema-spec.md
│   ├── 08-mobile-app-technical-spec.md
│   ├── 09-dashboard-technical-spec.md
│   ├── 10-ml-problem-definition-and-data-spec.md
│   ├── 11-annotation-guidelines.md
│   ├── 12-security-and-privacy-threat-model.md
│   ├── 13-devops-and-deployment-runbook.md
│   ├── 14-qa-test-strategy.md
│   ├── 15-admin-and-operations-sop.md
│   ├── 16-analytics-plan-and-metrics-dictionary.md
│   └── 17-pilot-launch-plan.md
│
├── mana-rasta-app.html             Interactive mobile app HTML demo
├── mana-rasta-web-portal-fix.html  Interactive admin portal HTML demo
├── PORTAL_PROGRESS.md              Web portal fix tracker (source of truth)
├── docker-compose.yml              Local dev: Postgres+PostGIS, Redis, API, dashboard
└── package.json                    Monorepo root
```

---

## Quick start (local development)

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- Expo CLI for mobile (optional): `npm install -g expo-cli`

### 1. Clone and install

```bash
git clone <repo>          # or: git clone mana-rasta-full.bundle mana-rasta
cd mana-rasta
npm install               # installs backend + dashboard workspace deps
```

### 2. Start databases

```bash
docker-compose up -d postgres redis
```

Starts PostgreSQL 16 with PostGIS 3 and Redis 7.

### 3. Run migrations and seed

```bash
cd backend
cp .env.example .env
# Edit .env — minimum: set JWT_SECRET to a 64-char random string

psql -h localhost -U postgres -d pothole_reporter \
  -f migrations/001_initial_schema.sql \
  -f migrations/002_officers_and_redressal.sql \
  -f migrations/003_capture_ml_logging.sql

node src/utils/seed.js    # seeds GHMC zones, wards, achievements, admin user
```

### 4. Start the backend

```bash
cd backend && npm run dev
# API → http://localhost:4000
```

### 5. Start the admin dashboard

```bash
cd dashboard
cp .env.example .env      # set VITE_API_URL=http://localhost:4000/api/v1
npm run dev
# Dashboard → http://localhost:3000
```

### 6. Run the mobile app

```bash
cd mobile
cp .env.example .env      # set EXPO_PUBLIC_API_URL=http://<your-ip>:4000/api/v1
npm install
npx expo start
# Scan QR code with Expo Go on your device
```

### 7. Run tests

```bash
cd backend && npm test
```

---

## HTML demos (no server required)

Open either file directly in a browser for an interactive demo:

### Mobile app — `mana-rasta-app.html`
Full phone-frame mockup of all 13 screens. Opens on the Mana Rasta splash screen, auto-advances to Login after 2.5 s.

### Admin portal — `mana-rasta-web-portal-fix.html`
Full desktop admin portal with role-based access. Login with any of the credentials below:

| Role | Email | Password | Scope |
|---|---|---|---|
| System Admin | sysadmin@ghmc.gov.in | admin | All features + Fraud + Admin panel |
| Commissioner | commissioner@ghmc.gov.in | comm | All data, all 6 zones |
| Zone EE | ee.kukatpally@ghmc.gov.in | ee | Kukatpally zone only |
| Circle DEE | dee.kukatpally@ghmc.gov.in | dee | Kukatpally circle only |
| Ward AE | ae.ward14@ghmc.gov.in | ae | Ward 14 only |

---

## Full Docker Compose stack

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Backend API | http://localhost:4000 |
| Admin Dashboard | http://localhost:3000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Mobile app — screen inventory

| Screen | Route | Key features |
|---|---|---|
| Login | `/(auth)/login` | Phone + OTP, 30 s countdown, auto-advance boxes |
| Home | `/(tabs)/home` | Time-aware greeting, level + XP bar, stats, FAB |
| Camera | `/camera` | 6-chip quality state machine, manual shutter, RAW mode |
| Report form | `/report` | GPS auto-detect, camera-only, road type, severity, submit |
| Report success | `/report/success` | Points animation, share badge |
| My Reports | `/(tabs)/my-reports` | Filter tabs, 4-step timeline, verify fix |
| Rewards — Badges | `/(tabs)/rewards` | Earned + locked badges, share to social |
| Rewards — Leaderboard | `/(tabs)/rewards` | 9-combo (period × scope), live data |
| Rewards — Vouchers | `/(tabs)/rewards` | Swiggy/Zomato/Amazon Pay, BETA |
| Profile | `/(tabs)/profile` | Stats row, account menu, sign out |
| Edit Profile | `/profile/edit-profile` | Name/email, notif toggle, delete account |
| Notifications | `/notifications` | 5 preference toggles + recent activity feed |
| How it Works | `/profile/how-it-works` | 5-step guide, points table, level ladder |
| Privacy & Terms | `/profile/privacy-terms` | Privacy Policy / Terms of Use sub-tabs |

---

## Admin portal — page inventory

| Page | Role access | Key features |
|---|---|---|
| Dashboard | All | Stat cards + sparklines, zone bar chart, donut, quick actions, report drawer |
| Reports | All (role-scoped) | Working filters, CSV export, sort, bulk select, pagination, report drawer |
| Live Map | All (role-scoped) | Pin/cluster click popup, heatmap, ward boundaries, zoom, address search |
| Officers | All (role-scoped) | 6-zone tabs, contact info, performance badges, edit modal |
| SLA Tracker | All (role-scoped) | Breach table, escalation modals, compliance progress bars |
| Fraud Detection | System Admin only | Confirm modals, history tab, auto-flag rules, risk score tooltip |
| Analytics | All (role-scoped) | 12-month trend SVG, zone comparison, peak hours heatmap, PDF export |
| Leaderboard | All (role-scoped) | Period × scope toggles, badge icons, profile modals |
| Admin Panel | Commissioner + SysAdmin | Role assignment, add officer, remove user |

---

## Production deployment

### Backend

```bash
cd backend
npm ci --only=production

# PM2 cluster mode
pm2 start src/app.js -i max --name mana-rasta-api
pm2 save && pm2 startup
```

Key production environment variables:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Minimum 64 random characters, rotate annually |
| `DB_*` | Managed PostgreSQL 16 with PostGIS extension (e.g. Supabase, RDS) |
| `REDIS_URL` | Managed Redis (ElastiCache, Upstash) |
| `AWS_*` | S3 bucket in `ap-south-1` for image storage |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | From Firebase console, store in secrets manager |
| `MODERATION_PROVIDER` | `sightengine` or `rekognition` |

### Dashboard

```bash
cd dashboard && npm run build
# Deploy dist/ to S3 + CloudFront, Netlify, or Vercel
```

### Mobile (Expo EAS)

```bash
cd mobile
eas build -p android    # APK / AAB for Play Store
eas build -p ios        # IPA for App Store
eas submit              # Submit to stores
```

---

## API reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/send-otp` | Send OTP to +91 phone number |
| POST | `/api/v1/auth/verify-otp` | Verify OTP, receive JWT |
| POST | `/api/v1/auth/refresh` | Refresh JWT |
| GET  | `/api/v1/auth/me` | Current user profile |
| PATCH| `/api/v1/auth/profile` | Update name / email / FCM token |

### Reports
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/reports` | Submit report (multipart with image) |
| GET  | `/api/v1/reports` | My reports (paginated) |
| GET  | `/api/v1/reports/nearby` | Reports near GPS coordinate |
| GET  | `/api/v1/reports/:id` | Report detail with history |
| POST | `/api/v1/reports/:id/acknowledge` | Confirm fix / verify |

### Geo
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/geo/resolve` | GPS → ward / circle / zone |
| GET | `/api/v1/geo/viewport` | Reports in bounding box |
| GET | `/api/v1/geo/hotspots` | Cluster hotspots |
| GET | `/api/v1/geo/wards` | Wards with open report counts |

### Rewards
| Method | Path | Description |
|---|---|---|
| GET  | `/api/v1/rewards/wallet` | Points balance + recent events |
| GET  | `/api/v1/rewards/badges` | All badges (earned / locked) |
| GET  | `/api/v1/rewards/leaderboard` | Weekly / monthly / alltime |
| GET  | `/api/v1/rewards/catalog` | Redeemable reward catalog |
| POST | `/api/v1/rewards/redeem` | Redeem a reward |

### Admin (Commissioner / System Admin role required)
| Method | Path | Description |
|---|---|---|
| GET   | `/api/v1/admin/reports` | Priority queue with filters |
| PATCH | `/api/v1/admin/reports/:id/status` | Update status + notify citizen |
| POST  | `/api/v1/admin/users/:id/ban` | Ban a user |
| POST  | `/api/v1/admin/devices/:fp/ban` | Ban a device |
| GET   | `/api/v1/admin/fraud` | Fraud events dashboard |
| GET   | `/api/v1/admin/sla` | SLA-breached reports |
| GET   | `/api/v1/admin/analytics` | Summary analytics |
| GET   | `/api/v1/analytics/reports/trend` | Daily trend data |
| GET   | `/api/v1/analytics/zones/summary` | Zone performance table |
| GET   | `/api/v1/analytics/csv` | Export all reports as CSV |

---

## Fraud prevention

| Check | Threshold | Action |
|---|---|---|
| IP hourly | 8 reports | Block submission |
| IP daily | 20 reports | Block submission |
| Device hourly | 4 reports | Block submission |
| User hourly | 5 reports | Block submission |
| Cooldown | 120 s between submissions | 429 response |
| Burst | 3 in 60 s | Block + fraud event |
| Impossible travel | > 200 km/h | Block + risk increase |
| Duplicate location | Within 50 m | Cluster link |
| Duplicate image | Perceptual hash match | Block + fraud event |
| Risk score ≥ 80 | Automated | Temporary 7-day ban |

---

## Priority scoring

```
score = severity_weight         (critical=40, high=25, medium=12, low=4)
      + road_type_weight         (highway=15, main road=8, local=2)
      + age_decay                (hours_since_created × 0.5, capped at 36)
      + acknowledgment_boost     (acks × 3, capped at 30)
      + cluster_size_boost       (reports in cluster × 2, capped at 20)
```

Recomputed hourly for all open reports.

---

## SLA deadlines

| Severity | SLA |
|---|---|
| Critical | 24 hours |
| High | 48 hours |
| Medium | 96 hours (4 days) |
| Low | 168 hours (7 days) |

---

## Points & level system

| Level | Name | Points |
|---|---|---|
| 1 | 🔍 Pothole Spotter | 0 – 99 |
| 2 | 🚦 Road Watcher | 100 – 299 |
| 3 | 🏗 Street Guardian | 300 – 599 |
| 4 | 🌟 City Hero | 600 – 999 |
| 5 | 👑 Rasta Legend | 1000+ |

Events: `report_submitted` +20 · `fix_confirmed` +10 · `daily_first_report` +5 · `streak_7d` +25 · `quality_photo` +5

---

## GHMC boundary data

The seed script uses approximate polygons for development. Before going to production, replace with real ward boundary data:

```bash
# Convert official GHMC shapefiles to PostGIS
shp2pgsql -s 4326 ghmc_wards.shp public.ghmc_wards_import | psql -d pothole_reporter

# Verify — should return 150 wards
SELECT COUNT(*) FROM ghmc_wards;
SELECT * FROM resolve_report_location(17.4401, 78.4986);  -- Secunderabad test point
```

Sources: [GHMC GIS Portal](https://www.ghmc.gov.in/gisdata) · [Telangana Open Data](https://data.telangana.gov.in) · [CDAC Bhuvan](https://bhuvan.nrsc.gov.in)

---

## Security checklist

- [ ] `JWT_SECRET` is ≥ 64 random characters, rotated annually
- [ ] S3 bucket is private; access only via signed URLs / CloudFront OAI
- [ ] Database in private VPC subnet, not publicly accessible
- [ ] Redis password-protected and not publicly accessible
- [ ] HTTPS enforced (TLS 1.2+), HSTS headers set
- [ ] Helmet.js + CORS configured for known origins only
- [ ] Joi input validation on every endpoint
- [ ] Image file-type validation via magic bytes (not just MIME header)
- [ ] Rate limiting at both API gateway and application layer
- [ ] Firebase service account key in secrets manager, not `.env` in prod
- [ ] Audit log (`admin_actions`) retained for at least 1 year
- [ ] Admin credentials rotated after each staff departure

---

## Scaling notes

- **Database**: PgBouncer connection pooling in front of PostgreSQL. Read replicas for analytics. Partition `reports` by `created_at` monthly beyond ~1M rows.
- **Redis**: Redis Cluster or Upstash for HA. Separate instances for cache vs. rate limiting if needed.
- **Images**: S3 + CloudFront for global edge delivery. S3 lifecycle → Glacier after 1 year.
- **Jobs**: Migrate from node-cron to BullMQ (Redis-backed) as job volume grows — enables retries, DLQ, horizontal scaling.
- **Moderation**: Queue moderation API calls via Redis rather than calling synchronously at submit time under high load.
- **Mobile**: Expo OTA updates for JS-layer hotfixes without App Store review cycles.

---

## Roadmap

- **Real-time dashboard**: WebSocket / SSE live map updates
- **ML severity suggestion**: Pre-fill severity from image analysis (MobileNet sidecar in `ml-service/`)
- **GHMC GIS integration**: Sync live ward boundary polygons
- **Offline-first mobile**: Cache ward boundaries, queue reports without connectivity
- **WhatsApp reporting**: Bot integration for non-smartphone users
- **Automated assignment**: Route reports to field officers by ward + workload
- **Predictive maintenance**: Monsoon + historical data to forecast pothole hotspots
- **GHMC SAP/ERP sync**: Bi-directional work order integration
