-- ============================================================
-- Migration 002 – Officers, Redressal Chain & Analytics Views
-- Requires: 001_initial_schema.sql already applied
-- ============================================================

-- ============================================================
-- OFFICER TABLES
-- ============================================================

-- Seniority / designation levels
CREATE TYPE officer_designation AS ENUM (
  'AE',          -- Assistant Engineer  (ward level, first contact)
  'DEE',         -- Deputy Executive Engineer (ward level, alternate first contact)
  'EE',          -- Executive Engineer  (circle level, second contact)
  'SE',          -- Superintending Engineer (zone level, optional)
  'CE',          -- Chief Engineer      (HQ, final escalation)
  'AC_PW'        -- Additional Commissioner (Public Works) – HQ peer of CE
);

CREATE TABLE ghmc_officers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150) NOT NULL,
  designation     officer_designation NOT NULL,
  employee_id     VARCHAR(30) UNIQUE,
  email           VARCHAR(255),
  phone           VARCHAR(15),
  -- Scope: exactly one of ward / circle / zone / null (HQ) must be set
  ward_id         UUID REFERENCES ghmc_wards(id)   ON DELETE SET NULL,
  circle_id       UUID REFERENCES ghmc_circles(id) ON DELETE SET NULL,
  zone_id         UUID REFERENCES ghmc_zones(id)   ON DELETE SET NULL,
  -- is_hq = TRUE for CE / AC_PW (no spatial scope)
  is_hq           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at       DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Enforce: ward-level officers must have ward_id; circle-level must have circle_id; etc.
  CONSTRAINT chk_officer_scope CHECK (
    (designation IN ('AE','DEE') AND ward_id IS NOT NULL)
    OR (designation = 'EE'  AND circle_id IS NOT NULL)
    OR (designation = 'SE'  AND zone_id   IS NOT NULL)
    OR (designation IN ('CE','AC_PW') AND is_hq = TRUE)
  )
);

CREATE INDEX idx_officers_ward_id   ON ghmc_officers(ward_id)   WHERE ward_id   IS NOT NULL;
CREATE INDEX idx_officers_circle_id ON ghmc_officers(circle_id) WHERE circle_id IS NOT NULL;
CREATE INDEX idx_officers_zone_id   ON ghmc_officers(zone_id)   WHERE zone_id   IS NOT NULL;
CREATE INDEX idx_officers_desig     ON ghmc_officers(designation);

CREATE TRIGGER trg_officers_updated_at
  BEFORE UPDATE ON ghmc_officers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- REDRESSAL CHAIN on reports
-- Stores the full 3-level authority chain resolved at submit time
-- so it is immutable even if officers change later.
-- ============================================================

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS ae_officer_id   UUID REFERENCES ghmc_officers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ee_officer_id   UUID REFERENCES ghmc_officers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hq_officer_id   UUID REFERENCES ghmc_officers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS igs_complaint_id VARCHAR(30),   -- set after IGS sync
  ADD COLUMN IF NOT EXISTS igs_synced_at    TIMESTAMPTZ;   -- set after IGS sync

CREATE INDEX idx_reports_ae_officer ON reports(ae_officer_id) WHERE ae_officer_id IS NOT NULL;
CREATE INDEX idx_reports_igs        ON reports(igs_complaint_id) WHERE igs_complaint_id IS NOT NULL;

-- ============================================================
-- UPDATED resolve_report_location — now also returns officers
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_report_location(lat NUMERIC, lng NUMERIC)
RETURNS TABLE(
  ward_id         UUID,
  circle_id       UUID,
  zone_id         UUID,
  is_outside_ghmc BOOLEAN,
  ae_officer_id   UUID,   -- AE or DEE for the ward
  ee_officer_id   UUID,   -- EE for the circle
  hq_officer_id   UUID    -- CE or AC_PW (first active HQ officer)
) AS $$
DECLARE
  pt        GEOMETRY;
  w         RECORD;
  ae_id     UUID;
  ee_id     UUID;
  hq_id     UUID;
BEGIN
  pt := ST_SetSRID(ST_MakePoint(lng, lat), 4326);

  SELECT w2.id, w2.circle_id, w2.zone_id INTO w
  FROM ghmc_wards w2
  WHERE ST_Contains(w2.boundary, pt)
  LIMIT 1;

  IF w IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::UUID, TRUE,
                        NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- First-contact: AE for this ward (prefer AE over DEE)
  SELECT id INTO ae_id
  FROM ghmc_officers
  WHERE ward_id = w.id AND is_active = TRUE
    AND designation IN ('AE','DEE')
  ORDER BY CASE designation WHEN 'AE' THEN 1 ELSE 2 END
  LIMIT 1;

  -- Second-contact: EE for this circle
  SELECT id INTO ee_id
  FROM ghmc_officers
  WHERE circle_id = w.circle_id AND is_active = TRUE
    AND designation = 'EE'
  LIMIT 1;

  -- HQ escalation: CE first, then AC_PW
  SELECT id INTO hq_id
  FROM ghmc_officers
  WHERE is_hq = TRUE AND is_active = TRUE
    AND designation IN ('CE','AC_PW')
  ORDER BY CASE designation WHEN 'CE' THEN 1 ELSE 2 END
  LIMIT 1;

  RETURN QUERY SELECT w.id, w.circle_id, w.zone_id, FALSE,
                      ae_id, ee_id, hq_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MATERIALIZED VIEW: officer SLA performance
-- Refreshed by cron job (see jobs/index.js update)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_officer_performance AS
SELECT
  o.id                        AS officer_id,
  o.name                      AS officer_name,
  o.designation,
  o.ward_id,
  o.circle_id,
  o.zone_id,
  -- AE-level: ward reports
  COUNT(r.id) FILTER (WHERE r.ae_officer_id = o.id)                           AS total_assigned,
  COUNT(r.id) FILTER (WHERE r.ae_officer_id = o.id AND r.status = 'fixed')    AS fixed_count,
  COUNT(r.id) FILTER (
    WHERE r.ae_officer_id = o.id
    AND r.status NOT IN ('fixed','rejected','fraudulent')
    AND r.sla_deadline < NOW()
  )                                                                             AS sla_breached,
  COUNT(r.id) FILTER (
    WHERE r.ae_officer_id = o.id
    AND r.status = 'fixed'
    AND r.fixed_at <= r.sla_deadline
  )                                                                             AS fixed_within_sla,
  ROUND(
    100.0 * COUNT(r.id) FILTER (
      WHERE r.ae_officer_id = o.id AND r.status = 'fixed' AND r.fixed_at <= r.sla_deadline
    ) / NULLIF(COUNT(r.id) FILTER (WHERE r.ae_officer_id = o.id AND r.status = 'fixed'), 0),
  1)                                                                            AS sla_compliance_pct,
  AVG(
    EXTRACT(EPOCH FROM (r.fixed_at - r.created_at)) / 3600.0
  ) FILTER (WHERE r.ae_officer_id = o.id AND r.status = 'fixed')               AS avg_fix_hours,
  NOW()                                                                         AS computed_at
FROM ghmc_officers o
LEFT JOIN reports r ON (
  r.ae_officer_id = o.id
  OR r.ee_officer_id = o.id
)
WHERE o.is_active = TRUE
  AND r.created_at > NOW() - INTERVAL '90 days'
GROUP BY o.id, o.name, o.designation, o.ward_id, o.circle_id, o.zone_id
WITH DATA;

CREATE UNIQUE INDEX ON mv_officer_performance(officer_id);

-- ============================================================
-- MATERIALIZED VIEW: SLA heatmap by zone
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sla_heatmap AS
SELECT
  z.id                        AS zone_id,
  z.name                      AS zone_name,
  COUNT(r.id)                 AS total_open,
  COUNT(r.id) FILTER (WHERE r.sla_deadline < NOW())   AS sla_breached,
  COUNT(r.id) FILTER (WHERE r.sla_deadline >= NOW())  AS sla_ok,
  ROUND(
    100.0 * COUNT(r.id) FILTER (WHERE r.sla_deadline < NOW())
    / NULLIF(COUNT(r.id), 0),
  1)                          AS breach_pct,
  -- RAG: red >40%, amber 15–40%, green <15%
  CASE
    WHEN COUNT(r.id) = 0 THEN 'green'
    WHEN ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.sla_deadline < NOW())
         / COUNT(r.id), 1) > 40 THEN 'red'
    WHEN ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.sla_deadline < NOW())
         / COUNT(r.id), 1) > 15 THEN 'amber'
    ELSE 'green'
  END                         AS rag_status,
  NOW()                       AS computed_at
FROM ghmc_zones z
LEFT JOIN reports r ON r.zone_id = z.id
  AND r.status NOT IN ('fixed','rejected','fraudulent')
  AND r.created_at > NOW() - INTERVAL '90 days'
GROUP BY z.id, z.name
WITH DATA;

CREATE UNIQUE INDEX ON mv_sla_heatmap(zone_id);

-- ============================================================
-- FUNCTION: refresh both materialized views (called by cron)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_officer_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sla_heatmap;
END;
$$ LANGUAGE plpgsql;
