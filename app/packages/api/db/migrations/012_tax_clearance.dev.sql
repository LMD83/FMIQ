-- FMIQ migration 012 — Revenue eTax Clearance on contractors (P1 legal gate).
-- DEV variant. Mirrors 012_tax_clearance.sql.
-- A public body cannot engage a non-tax-compliant contractor (S.I. 463/2012). The SSoW
-- Readiness Gate reads tax_clearance_status; src/domain/taxClearance.ts records it via
-- the Revenue verification web service (adapter). See FMIQ-integration-map.md §2.
BEGIN;

ALTER TABLE wo_contractor ADD COLUMN tcan                  text;  -- Tax Clearance Access Number
ALTER TABLE wo_contractor ADD COLUMN tax_clearance_status  text CHECK (tax_clearance_status IN ('valid','expired','revoked','suspended','unknown'));
ALTER TABLE wo_contractor ADD COLUMN tax_clearance_checked_at timestamptz;

COMMIT;
