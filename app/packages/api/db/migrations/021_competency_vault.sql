-- FMIQ migration 021 — Contractor competency/document vault enrichment
-- Target: PostgreSQL 16 (production). Pairs with 021_competency_vault.dev.sql — keep in sync.
--
-- Folds the document-vault model into the EXISTING hs_competency table (008_ssow) rather
-- than standing up a parallel wo_contractor_document table. hs_competency already carries
-- comp_type + expiry and is auto-blocked by the SSoW Readiness Gate's competencies_valid
-- check. This adds the vault's richer document fields: a reference (cert/policy number),
-- the issue date, and a verified flag for back-office sign-off. comp_type stays free-text
-- and now also covers public_liability / employer_liability insurances.

ALTER TABLE hs_competency ADD COLUMN reference  text;
ALTER TABLE hs_competency ADD COLUMN issued_on  date;
ALTER TABLE hs_competency ADD COLUMN verified   boolean NOT NULL DEFAULT false;
ALTER TABLE hs_competency ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

-- hs_competency already has RLS ENABLE+FORCE + tenant_isolation + GRANT from 008_ssow;
-- new columns inherit row-level protection automatically. No policy/grant change needed.
