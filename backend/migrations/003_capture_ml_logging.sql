CREATE TYPE capture_status_enum AS ENUM ('accepted', 'blocked', 'warning');

CREATE TABLE report_capture_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id         UUID REFERENCES reports(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id         UUID REFERENCES user_devices(id) ON DELETE SET NULL,
  source_ip         INET,
  capture_status    capture_status_enum NOT NULL,
  quality_ready     BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason    TEXT,
  downgraded_reason TEXT,
  quality_score     NUMERIC(5, 4) NOT NULL DEFAULT 0,
  quality_flags     JSONB NOT NULL DEFAULT '{}'::jsonb,
  detection         JSONB NOT NULL DEFAULT '{}'::jsonb,
  review            JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version     VARCHAR(80),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_capture_logs_report_id ON report_capture_logs(report_id);
CREATE INDEX idx_report_capture_logs_user_id ON report_capture_logs(user_id, created_at DESC);
CREATE INDEX idx_report_capture_logs_status ON report_capture_logs(capture_status, created_at DESC);

ALTER TABLE report_images
  ADD COLUMN source_storage_key TEXT,
  ADD COLUMN source_url TEXT,
  ADD COLUMN source_mime_type VARCHAR(50),
  ADD COLUMN source_file_size_bytes INTEGER,
  ADD COLUMN exif_metadata JSONB,
  ADD COLUMN capture_metadata JSONB,
  ADD COLUMN quality_assessment JSONB,
  ADD COLUMN ml_inference JSONB,
  ADD COLUMN processing_pipeline JSONB;
