-- FMIQ migration 002 — gate engine — DEV variant for vanilla Postgres (embedded / Neon / Azure PG).
-- Identical to 002_gate_engine.sql; the prod/dev split exists only because 001 differs
-- (TimescaleDB/PostGIS/role-creation are production-only). RLS is KEPT and FORCED here too,
-- so tenant isolation is genuinely enforced in dev and in the RLS isolation test suite.
BEGIN;

CREATE TABLE gate_definition (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  code           text NOT NULL,
  name           text NOT NULL,
  applies_to     text NOT NULL DEFAULT 'work_order',
  checks         jsonb NOT NULL DEFAULT '[]'::jsonb,
  mode           text NOT NULL DEFAULT 'ALL'  CHECK (mode IN ('ALL','ANY')),
  on_block       text NOT NULL DEFAULT 'HARD' CHECK (on_block IN ('HARD','SOFT')),
  override_roles text[] NOT NULL DEFAULT '{}',
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE wo_gate_check (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id      uuid NOT NULL REFERENCES wo_work_order(id),
  gate_definition_id uuid REFERENCES gate_definition(id),
  gate_code          text NOT NULL,
  check_id           text NOT NULL,
  status             text NOT NULL CHECK (status IN ('pass','fail','override')),
  blocking_detail    text,
  checked_at         timestamptz NOT NULL DEFAULT now(),
  override_by        uuid REFERENCES core_user(id),
  override_reason    text
);
CREATE INDEX ix_wo_gate_check_wo ON wo_gate_check (tenant_id, work_order_id, checked_at DESC);

-- Row-Level Security (kept in dev — this is the whole point) -----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gate_definition','wo_gate_check'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON gate_definition, wo_gate_check TO fmiq_app;

COMMIT;
