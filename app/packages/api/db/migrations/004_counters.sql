-- FMIQ migration 004 — per-tenant monotonic counters (human-friendly reference numbers)
-- Target: PostgreSQL 16 (production). Pairs with 004_counters.dev.sql — keep in sync.
--
-- Replaces the placeholder random WO refs with stable, sequential, per-tenant refs
-- (e.g. WO-2026-00042). A row per (tenant, scope) incremented atomically inside the
-- caller's transaction. See src/domain/workOrders.ts (nextRef).
BEGIN;

CREATE TABLE core_counter (
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  scope     text NOT NULL,                 -- e.g. 'work_order'
  value     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, scope)
);

-- RLS — standard tenant isolation (PK already leads with tenant_id, so no extra index).
ALTER TABLE core_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_counter FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON core_counter
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON core_counter TO fmiq_app;

COMMIT;
