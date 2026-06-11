-- FMIQ migration 013 — ERP procurement callback fields on requisitions.
-- Target: PostgreSQL 16 (production). Pairs with 013_erp.dev.sql.
-- FMIQ owns authorised commitment; the ERP (Agresso/SAP) issues the PO and writes back
-- po_reference / grn_number / payment_status. FMIQ never holds invoice data. See §6 / §7.2.
BEGIN;

ALTER TABLE apr_requisition ADD COLUMN grn_number     text;
ALTER TABLE apr_requisition ADD COLUMN payment_status text;

COMMIT;
