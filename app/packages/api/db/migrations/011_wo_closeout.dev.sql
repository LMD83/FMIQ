-- FMIQ migration 011 — reactive lifecycle: failure coding + confirmation on close.
-- DEV variant. Mirrors 011_wo_closeout.sql.
-- See docs/FMIQ-master-build-plan.md §4.2.
BEGIN;

ALTER TABLE wo_work_order ADD COLUMN failure_mode   text;
ALTER TABLE wo_work_order ADD COLUMN failure_cause  text;
ALTER TABLE wo_work_order ADD COLUMN failure_remedy text;
ALTER TABLE wo_work_order ADD COLUMN confirmed_by   uuid REFERENCES core_user(id);
ALTER TABLE wo_work_order ADD COLUMN confirmed_at   timestamptz;
ALTER TABLE wo_work_order ADD COLUMN sla_breached   boolean NOT NULL DEFAULT false;

COMMIT;
