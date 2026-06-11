-- FMIQ migration 006 — QR mobile issue capture
-- Target: PostgreSQL 16 (production). Pairs with 006_issue_capture.dev.sql — keep in sync.
--
-- Snapfix's differentiator, native: scan the QR on an asset → photo + one line of
-- text → a work order in seconds, location pre-filled from the asset. Reuses
-- est_asset.qr_uid (001) and the wo_work_order spine. docs/roadmap.md (NOW — mobile).
BEGIN;

-- Provenance of a reported issue (who/how) without forcing every reporter to be a
-- full named user — frontline adoption depends on near-zero-friction capture.
ALTER TABLE wo_work_order ADD COLUMN reported_via  text CHECK (reported_via IN ('qr','web','system'));
ALTER TABLE wo_work_order ADD COLUMN reporter_name text;

-- Photos attached at capture (or later). url → Blob/object storage in production.
CREATE TABLE wo_issue_photo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid NOT NULL REFERENCES wo_work_order(id),
  url           text NOT NULL,
  caption       text,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_wo_issue_photo_wo ON wo_issue_photo (tenant_id, work_order_id);

-- Fast lookup for QR resolution (scan → asset). qr_uid is unique per tenant.
CREATE UNIQUE INDEX ix_est_asset_qr ON est_asset (tenant_id, qr_uid) WHERE qr_uid IS NOT NULL;

-- =====================================================================
-- Row-Level Security — every new tenant table gets the 001 treatment.
-- =====================================================================
ALTER TABLE wo_issue_photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE wo_issue_photo FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON wo_issue_photo
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE INDEX ix_wo_issue_photo_tenant ON wo_issue_photo (tenant_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON wo_issue_photo TO fmiq_app;

COMMIT;
