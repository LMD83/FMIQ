-- FMIQ migration 019 — document / O&M management (the "golden thread").
-- DEV variant. Mirrors 019_documents.sql.
-- Closes a core CAFM gap: a versioned document register linked to assets, certs,
-- handover and work orders so the BCAR/CWMF golden thread is surfaced, not scattered
-- across drives. See FMIQ-system-review.md §4 and CAFM-COVERAGE.md item 2.
BEGIN;

-- The register: one row per logical document (its identity), pointing at its current version.
CREATE TABLE doc_document (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  title              text NOT NULL,
  doc_type           text NOT NULL DEFAULT 'other'
                       CHECK (doc_type IN ('om_manual','drawing','certificate','warranty','policy','rams','datasheet','report','specification','other')),
  discipline         text,
  reference          text,
  status             text NOT NULL DEFAULT 'current' CHECK (status IN ('draft','current','superseded','archived')),
  golden_thread      boolean NOT NULL DEFAULT false,
  current_version_id uuid,
  created_by         uuid REFERENCES core_user(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_doc_document_type ON doc_document (tenant_id, doc_type, status);

-- Immutable versions: each upload is a new row; the latest is_current=true.
CREATE TABLE doc_version (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES core_tenant(id),
  document_id  uuid NOT NULL REFERENCES doc_document(id) ON DELETE CASCADE,
  version_no   int NOT NULL,
  blob_uri     text NOT NULL,
  file_name    text,
  mime_type    text,
  size_bytes   bigint,
  checksum     text,
  notes        text,
  is_current   boolean NOT NULL DEFAULT true,
  uploaded_by  uuid REFERENCES core_user(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);
CREATE INDEX ix_doc_version_document ON doc_version (tenant_id, document_id, version_no DESC);

ALTER TABLE doc_document
  ADD CONSTRAINT fk_doc_current_version FOREIGN KEY (current_version_id) REFERENCES doc_version(id);

-- Polymorphic links — one document can be attached to many estate/compliance entities.
CREATE TABLE doc_link (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES core_tenant(id),
  document_id uuid NOT NULL REFERENCES doc_document(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('asset','building','space','site','certificate','handover','work_order','project')),
  entity_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, entity_type, entity_id)
);
CREATE INDEX ix_doc_link_entity ON doc_link (tenant_id, entity_type, entity_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['doc_document','doc_version','doc_link'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON doc_document, doc_version, doc_link TO fmiq_app;

COMMIT;
