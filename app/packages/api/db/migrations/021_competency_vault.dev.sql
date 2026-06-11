-- FMIQ migration 021 — Contractor competency/document vault enrichment — DEV variant.
-- Identical to 021_competency_vault.sql (pure ALTER, no per-tenant index). RLS on
-- hs_competency is kept and forced exactly as in production (set up in 008_ssow).
--
-- Folds the document-vault model into the EXISTING hs_competency table rather than a
-- parallel wo_contractor_document table. Adds a reference (cert/policy number), issue
-- date, and a verified flag for back-office sign-off. comp_type stays free-text and now
-- also covers public_liability / employer_liability insurances.

ALTER TABLE hs_competency ADD COLUMN reference  text;
ALTER TABLE hs_competency ADD COLUMN issued_on  date;
ALTER TABLE hs_competency ADD COLUMN verified   boolean NOT NULL DEFAULT false;
ALTER TABLE hs_competency ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
