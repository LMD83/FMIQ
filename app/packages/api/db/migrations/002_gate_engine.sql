-- FMIQ migration 002 — gate engine (shared, declarative readiness / approval gates)
-- Target: PostgreSQL 16 (production). Pairs with 002_gate_engine.dev.sql — keep in sync.
--
-- The gate engine is the platform primitive behind "no paperwork, no work": a work
-- order (and, later, an approval requisition) cannot progress until every required
-- check is green. Gate *configuration* (mode / on-block / override roles) lives here as
-- data; gate *check implementations* live in code (src/domain/gateEngine.ts).
-- See docs/FMIQ-master-build-plan.md §3.2 + §5.2 and docs/SPRINT-1-KICKOFF.md (GOV-70).
BEGIN;

-- A configurable gate. One row per (tenant, code), e.g. ('ssow_readiness').
CREATE TABLE gate_definition (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  code           text NOT NULL,                        -- 'ssow_readiness' | 'capex_approval_band_2'
  name           text NOT NULL,
  applies_to     text NOT NULL DEFAULT 'work_order',   -- the entity / task type this gate guards
  checks         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- optional declarative params for code checks
  mode           text NOT NULL DEFAULT 'ALL'  CHECK (mode IN ('ALL','ANY')),
  on_block       text NOT NULL DEFAULT 'HARD' CHECK (on_block IN ('HARD','SOFT')),
  override_roles text[] NOT NULL DEFAULT '{}',         -- roles allowed to record a documented override
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- An immutable, per-check snapshot of every gate evaluation / override on a work order.
-- The audited record HSA / FOI inspection is served from (alongside core_audit_log).
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

-- =====================================================================
-- Row-Level Security — every new tenant table gets the 001 treatment.
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gate_definition','wo_gate_check'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id, id);', t, t);
  END LOOP;
END $$;

-- Least-privilege app role: DML only (audit append-only is enforced on core_audit_log in 001).
GRANT SELECT, INSERT, UPDATE, DELETE ON gate_definition, wo_gate_check TO fmiq_app;

COMMIT;
