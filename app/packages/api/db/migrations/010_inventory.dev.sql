-- FMIQ migration 010 — spare parts / stores / inventory.
-- DEV variant. Mirrors 010_inventory.sql.
-- See docs/FMIQ-master-build-plan.md §4.3.
BEGIN;

CREATE TABLE inv_part (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  code           text NOT NULL,
  name           text NOT NULL,
  manufacturer   text,
  supplier       text,
  unit_cost      numeric,
  lead_time_days int,
  critical       boolean NOT NULL DEFAULT false
);

CREATE TABLE inv_stock (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES core_tenant(id),
  part_id        uuid NOT NULL REFERENCES inv_part(id),
  store_location text,
  bin            text,
  qty_on_hand    numeric NOT NULL DEFAULT 0,
  qty_reserved   numeric NOT NULL DEFAULT 0,
  min_qty        numeric NOT NULL DEFAULT 0,
  max_qty        numeric
);

CREATE TABLE inv_movement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  part_id       uuid NOT NULL REFERENCES inv_part(id),
  movement_type text NOT NULL CHECK (movement_type IN ('receipt','issue','adjust','return')),
  work_order_id uuid REFERENCES wo_work_order(id),
  qty           numeric NOT NULL,
  unit_cost     numeric,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inv_requisition (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES core_tenant(id),
  part_id            uuid NOT NULL REFERENCES inv_part(id),
  qty                numeric NOT NULL,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ordered','fulfilled','cancelled')),
  apr_requisition_id uuid REFERENCES apr_requisition(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inv_part','inv_stock','inv_movement','inv_requisition'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON inv_part, inv_stock, inv_movement, inv_requisition TO fmiq_app;

COMMIT;
