-- FMIQ migration 009 — gated approvals + budget-commitment tracking.
-- DEV variant. Mirrors 009_approvals.sql.
-- FMIQ owns *authorised commitment*; PO issuance/invoice are deferred to the ERP via a
-- ProcurementGateway port. See docs/FMIQ-master-build-plan.md §6.
BEGIN;

CREATE TABLE apr_chain (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES core_tenant(id),
  name       text NOT NULL,
  category   text NOT NULL DEFAULT 'revenue' CHECK (category IN ('capital','revenue','emergency')),
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,                       -- null = no upper bound
  steps      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ordered array of approver-role strings
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE apr_requisition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  chain_id      uuid REFERENCES apr_chain(id),
  work_order_id uuid REFERENCES wo_work_order(id),
  project_id    uuid REFERENCES prj_project(id),
  cost_centre   text,
  supplier_id   uuid,
  amount_net    numeric NOT NULL,
  category      text NOT NULL DEFAULT 'revenue',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','committed','rejected')),
  current_step  int NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES core_user(id),
  po_reference  text,
  po_issued_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE apr_step (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  requisition_id uuid NOT NULL REFERENCES apr_requisition(id),
  step_order     int NOT NULL,
  approver_role  text NOT NULL,
  approver_id    uuid REFERENCES core_user(id),
  decision       text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected')),
  decided_at     timestamptz,
  comment        text,
  delegated_to   uuid REFERENCES core_user(id)
);

CREATE TABLE apr_commitment (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  requisition_id uuid NOT NULL REFERENCES apr_requisition(id),
  cost_centre    text,
  project_id     uuid REFERENCES prj_project(id),
  amount_net     numeric NOT NULL,
  status         text NOT NULL DEFAULT 'committed' CHECK (status IN ('committed','released','converted')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['apr_chain','apr_requisition','apr_step','apr_commitment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON apr_chain, apr_requisition, apr_step, apr_commitment TO fmiq_app;

COMMIT;
