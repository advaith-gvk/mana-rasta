-- ============================================================
-- Hyderabad Pothole Reporter – Full Database Schema
-- Requires: PostgreSQL 14+ with PostGIS 3+
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for fuzzy text search

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'supervisor', 'field_officer');
CREATE TYPE report_status AS ENUM (
  'submitted', 'under_review', 'verified', 'assigned',
  'in_progress', 'fixed', 'rejected', 'fraudulent'
);
CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE road_type AS ENUM ('local', 'arterial', 'highway', 'expressway');
CREATE TYPE moderation_verdict AS ENUM ('approved', 'rejected', 'flagged_for_review');
CREATE TYPE fraud_reason AS ENUM (
  'duplicate_location', 'duplicate_image', 'ip_limit', 'device_limit',
  'impossible_travel', 'burst_submission', 'user_limit', 'manual_review'
);
CREATE TYPE ban_type AS ENUM ('temporary', 'permanent');
CREATE TYPE reward_event_type AS ENUM (
  'report_submitted', 'report_verified', 'report_fixed',
  'acknowledgment_given', 'first_ward_report', 'community_verified',
  'streak_bonus', 'redemption', 'penalty_reversal'
);
CREATE TYPE notification_type AS ENUM (
  'status_update', 'reward_earned', 'badge_unlocked',
  'streak_reminder', 'system_announcement'
);

-- ============================================================
-- GHMC SPATIAL TABLES
-- ============================================================

CREATE TABLE ghmc_zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_code     VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  boundary      GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  area_sq_km    NUMERIC(10, 4),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ghmc_zones_boundary ON ghmc_zones USING GIST(boundary);

CREATE TABLE ghmc_circles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id       UUID NOT NULL REFERENCES ghmc_zones(id),
  circle_code   VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  boundary      GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  area_sq_km    NUMERIC(10, 4),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ghmc_circles_boundary  ON ghmc_circles USING GIST(boundary);
CREATE INDEX idx_ghmc_circles_zone_id   ON ghmc_circles(zone_id);

CREATE TABLE ghmc_wards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id     UUID NOT NULL REFERENCES ghmc_circles(id),
  zone_id       UUID NOT NULL REFERENCES ghmc_zones(id),
  ward_number   INTEGER UNIQUE NOT NULL,  -- 1–150 GHMC wards
  name          VARCHAR(100) NOT NULL,
  boundary      GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  area_sq_km    NUMERIC(10, 4),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ghmc_wards_boundary  ON ghmc_wards USING GIST(boundary);
CREATE INDEX idx_ghmc_wards_circle_id ON ghmc_wards(circle_id);
CREATE INDEX idx_ghmc_wards_zone_id   ON ghmc_wards(zone_id);

-- ============================================================
-- USER TABLES
-- ============================================================

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone             VARCHAR(15) UNIQUE,
  email             VARCHAR(255) UNIQUE,
  name              VARCHAR(100),
  role              user_role NOT NULL DEFAULT 'citizen',
  is_active         BOOLEAN DEFAULT TRUE,
  is_verified       BOOLEAN DEFAULT FALSE,
  risk_score        SMALLINT DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  last_login_at     TIMESTAMPTZ
);
CREATE INDEX idx_users_phone   ON users(phone);
CREATE INDEX idx_users_email   ON users(email);
CREATE INDEX idx_users_role    ON users(role);

CREATE TABLE user_profiles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url        TEXT,
  preferred_lang    VARCHAR(10) DEFAULT 'en',
  ward_id           UUID REFERENCES ghmc_wards(id),
  total_reports     INTEGER DEFAULT 0,
  verified_reports  INTEGER DEFAULT 0,
  streak_days       INTEGER DEFAULT 0,
  last_report_date  DATE,
  fcm_token         TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint     VARCHAR(255) UNIQUE NOT NULL,
  platform        VARCHAR(20),           -- android | ios | web
  device_model    VARCHAR(100),
  app_version     VARCHAR(20),
  is_banned       BOOLEAN DEFAULT FALSE,
  banned_at       TIMESTAMPTZ,
  ban_reason      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_devices_user_id     ON user_devices(user_id);
CREATE INDEX idx_user_devices_fingerprint ON user_devices(fingerprint);

-- OTP / phone verification
CREATE TABLE otp_verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(15) NOT NULL,
  otp_hash    VARCHAR(255) NOT NULL,
  attempts    SMALLINT DEFAULT 0,
  verified    BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_otp_phone ON otp_verifications(phone, expires_at);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  location          GEOMETRY(POINT, 4326) NOT NULL,
  latitude          NUMERIC(10, 7) NOT NULL,
  longitude         NUMERIC(11, 7) NOT NULL,
  address_text      TEXT,
  ward_id           UUID REFERENCES ghmc_wards(id),
  circle_id         UUID REFERENCES ghmc_circles(id),
  zone_id           UUID REFERENCES ghmc_zones(id),
  severity          severity_level NOT NULL DEFAULT 'medium',
  road_type         road_type DEFAULT 'local',
  status            report_status NOT NULL DEFAULT 'submitted',
  description       TEXT,
  priority_score    NUMERIC(8, 4) DEFAULT 0,
  acknowledgment_count INTEGER DEFAULT 0,
  cluster_id        UUID,                   -- for duplicate grouping
  is_cluster_master BOOLEAN DEFAULT FALSE,
  assigned_to       UUID REFERENCES users(id),
  assigned_at       TIMESTAMPTZ,
  fixed_at          TIMESTAMPTZ,
  sla_deadline      TIMESTAMPTZ,
  source_ip         INET,
  device_id         UUID REFERENCES user_devices(id),
  is_outside_ghmc   BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Critical indexes for dashboard queries
CREATE INDEX idx_reports_location     ON reports USING GIST(location);
CREATE INDEX idx_reports_ward_id      ON reports(ward_id);
CREATE INDEX idx_reports_zone_id      ON reports(zone_id);
CREATE INDEX idx_reports_status       ON reports(status);
CREATE INDEX idx_reports_severity     ON reports(severity);
CREATE INDEX idx_reports_priority     ON reports(priority_score DESC);
CREATE INDEX idx_reports_user_id      ON reports(user_id);
CREATE INDEX idx_reports_created_at   ON reports(created_at DESC);
CREATE INDEX idx_reports_assigned_to  ON reports(assigned_to) WHERE assigned_to IS NOT NULL;
-- Composite index for dashboard filter queries
CREATE INDEX idx_reports_zone_status_created ON reports(zone_id, status, created_at DESC);
CREATE INDEX idx_reports_ward_status         ON reports(ward_id, status);
-- Partial index for open issues only
CREATE INDEX idx_reports_open ON reports(priority_score DESC, created_at)
  WHERE status NOT IN ('fixed', 'rejected', 'fraudulent');

CREATE TABLE report_images (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id           UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  storage_key         TEXT NOT NULL,
  url                 TEXT NOT NULL,
  thumbnail_url       TEXT,
  file_size_bytes     INTEGER,
  mime_type           VARCHAR(50),
  phash               VARCHAR(64),      -- perceptual hash for dup detection
  moderation_verdict  moderation_verdict,
  moderation_reason   TEXT,
  moderation_score    JSONB,            -- {nudity: 0.01, violence: 0.02, ...}
  moderation_provider VARCHAR(50),
  is_reviewed_manually BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_report_images_report_id ON report_images(report_id);
CREATE INDEX idx_report_images_phash     ON report_images(phash) WHERE phash IS NOT NULL;

CREATE TABLE report_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status report_status,
  to_status   report_status NOT NULL,
  changed_by  UUID REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_report_history_report_id ON report_status_history(report_id);

-- ============================================================
-- ACKNOWLEDGMENTS
-- ============================================================

CREATE TABLE acknowledgments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_id, user_id)
);
CREATE INDEX idx_ack_report_id ON acknowledgments(report_id);
CREATE INDEX idx_ack_user_id   ON acknowledgments(user_id);

-- ============================================================
-- REWARDS & GAMIFICATION
-- ============================================================

CREATE TABLE reward_wallets (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned  INTEGER NOT NULL DEFAULT 0,
  total_spent   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reward_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  event_type  reward_event_type NOT NULL,
  points      INTEGER NOT NULL,
  report_id   UUID REFERENCES reports(id),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reward_events_user_id    ON reward_events(user_id);
CREATE INDEX idx_reward_events_created_at ON reward_events(created_at DESC);

CREATE TABLE achievements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url    TEXT,
  points      INTEGER DEFAULT 0,
  criteria    JSONB          -- {"min_reports": 10, "ward_id": null}
);

CREATE TABLE user_achievements (
  user_id       UUID NOT NULL REFERENCES users(id),
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  earned_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, achievement_id)
);

CREATE TABLE reward_catalog (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  partner_name  VARCHAR(100),
  points_cost   INTEGER NOT NULL,
  stock         INTEGER,          -- NULL = unlimited
  is_active     BOOLEAN DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  image_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reward_redemptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id),
  catalog_id    UUID NOT NULL REFERENCES reward_catalog(id),
  points_spent  INTEGER NOT NULL,
  coupon_code   TEXT,
  status        VARCHAR(20) DEFAULT 'pending',  -- pending|fulfilled|cancelled
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_redemptions_user_id ON reward_redemptions(user_id);

-- ============================================================
-- LEADERBOARDS
-- ============================================================

CREATE TABLE leaderboard_snapshots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_type VARCHAR(10) NOT NULL,   -- weekly | monthly | alltime
  period_key  VARCHAR(20) NOT NULL,   -- 2024-W03 | 2024-01 | all
  user_id     UUID NOT NULL REFERENCES users(id),
  rank        INTEGER NOT NULL,
  score       INTEGER NOT NULL,
  zone_id     UUID REFERENCES ghmc_zones(id),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_type, period_key, user_id)
);
CREATE INDEX idx_leaderboard_period ON leaderboard_snapshots(period_type, period_key, rank);

-- ============================================================
-- FRAUD PREVENTION
-- ============================================================

CREATE TABLE ip_rate_limits (
  ip            INET PRIMARY KEY,
  daily_count   INTEGER DEFAULT 0,
  hourly_count  INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_rate_limits (
  fingerprint   VARCHAR(255) PRIMARY KEY,
  daily_count   INTEGER DEFAULT 0,
  hourly_count  INTEGER DEFAULT 0,
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  last_reset_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fraud_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id),
  device_id     UUID REFERENCES user_devices(id),
  report_id     UUID REFERENCES reports(id),
  source_ip     INET,
  reason        fraud_reason NOT NULL,
  details       JSONB,
  auto_actioned BOOLEAN DEFAULT FALSE,
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fraud_events_user_id   ON fraud_events(user_id);
CREATE INDEX idx_fraud_events_created_at ON fraud_events(created_at DESC);

CREATE TABLE banned_devices (
  fingerprint   VARCHAR(255) PRIMARY KEY,
  ban_type      ban_type NOT NULL DEFAULT 'temporary',
  reason        TEXT,
  banned_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  banned_by     UUID REFERENCES users(id)
);

CREATE TABLE banned_users (
  user_id     UUID PRIMARY KEY REFERENCES users(id),
  ban_type    ban_type NOT NULL DEFAULT 'temporary',
  reason      TEXT,
  banned_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  banned_by   UUID REFERENCES users(id)
);

-- ============================================================
-- MODERATION
-- ============================================================

CREATE TABLE moderation_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id     UUID REFERENCES reports(id),
  image_id      UUID REFERENCES report_images(id),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(50) NOT NULL,
  actor_id      UUID REFERENCES users(id),
  reason        TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mod_logs_report_id ON moderation_logs(report_id);
CREATE INDEX idx_mod_logs_user_id   ON moderation_logs(user_id);

-- ============================================================
-- ADMIN ACTIONS AUDIT LOG
-- ============================================================

CREATE TABLE admin_actions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),   -- report | user | device
  target_id   UUID,
  payload     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_admin_actions_admin_id  ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        notification_type NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: map GPS point to ward/circle/zone
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_report_location(lat NUMERIC, lng NUMERIC)
RETURNS TABLE(
  ward_id   UUID,
  circle_id UUID,
  zone_id   UUID,
  is_outside_ghmc BOOLEAN
) AS $$
DECLARE
  pt GEOMETRY;
  w  RECORD;
BEGIN
  pt := ST_SetSRID(ST_MakePoint(lng, lat), 4326);

  SELECT w2.id, w2.circle_id, w2.zone_id INTO w
  FROM ghmc_wards w2
  WHERE ST_Contains(w2.boundary, pt)
  LIMIT 1;

  IF w IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::UUID, TRUE;
  ELSE
    RETURN QUERY SELECT w.id, w.circle_id, w.zone_id, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: compute priority score for a report
-- ============================================================

CREATE OR REPLACE FUNCTION compute_priority_score(report_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  r           RECORD;
  severity_w  NUMERIC;
  road_w      NUMERIC;
  age_decay   NUMERIC;
  ack_boost   NUMERIC;
  cluster_w   NUMERIC;
  score       NUMERIC;
BEGIN
  SELECT r2.severity, r2.road_type, r2.acknowledgment_count,
         r2.created_at, r2.cluster_id
  INTO r FROM reports r2 WHERE r2.id = report_id;

  severity_w := CASE r.severity
    WHEN 'critical' THEN 40
    WHEN 'high'     THEN 25
    WHEN 'medium'   THEN 12
    WHEN 'low'      THEN 4
    ELSE 0 END;

  road_w := CASE r.road_type
    WHEN 'expressway' THEN 20
    WHEN 'highway'    THEN 15
    WHEN 'arterial'   THEN 8
    WHEN 'local'      THEN 2
    ELSE 2 END;

  -- Age decay: older reports score higher (overdue penalty)
  age_decay := LEAST(EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0, 72) * 0.5;

  -- Acknowledgment boost: community validation
  ack_boost := LEAST(r.acknowledgment_count * 3, 30);

  -- Cluster size boost
  IF r.cluster_id IS NOT NULL THEN
    SELECT COUNT(*) * 2 INTO cluster_w FROM reports WHERE cluster_id = r.cluster_id;
    cluster_w := LEAST(cluster_w, 20);
  ELSE
    cluster_w := 0;
  END IF;

  score := severity_w + road_w + age_decay + ack_boost + cluster_w;
  RETURN ROUND(score, 4);
END;
$$ LANGUAGE plpgsql;
