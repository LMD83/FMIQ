/**
 * VerifIQ — procurement pack: expected-document matrix (proof of concept).
 *
 * The canonical "required documents" rule-set for a tender/SAQ pack, keyed by
 * {category, procedure, SAQ form}. This is the deterministic source of truth the
 * pack-completeness checker asserts an uploaded pack against — the VerifIQ
 * *review* counterpart to a generator's pack-mapper. Seeded from the HSE SAQ
 * review (Disability Day Services Unit, Rathbeale Rd — QW1 Restricted, Works +
 * PSCS).
 *
 * Anchors: CWMF Pillar 3 (Suitability Assessment); OGP RFT; SI 284/2016
 * (EU procurement regs, Reg. 57–58); ESPD.
 * See docs/37-procurement-pack-review-module.md.
 *
 * Version: 0.8.0-phase5
 */

import type { Risk } from "../types/index.js";

export type PackCategory = "works" | "consultancy" | "goods" | "services";
export type PackProcedure = "open" | "restricted";

/** "must" = always required; "conditional" = required only if `condition` is selected. */
export type DocCriticality = "must" | "conditional";

export interface RequiredDoc {
  /** Stable doc code, e.g. "cwmf_appendix_b1". */
  code: string;
  title: string;
  criticality: DocCriticality;
  /** For `conditional` docs: the SAQ selection token that triggers the requirement. */
  condition?: string;
  /**
   * True when the contracting authority must include a BLANK pro-forma in the
   * pack (buyer-issued), not merely accept an applicant-supplied file.
   */
  buyerIssued?: boolean;
  /** Risk if a required doc is absent (drives the emitted finding). */
  riskIfMissing: Risk;
}

export interface PackScenario {
  id: string;
  category: PackCategory;
  procedure: PackProcedure;
  saqForm: string;
  label: string;
  requires: RequiredDoc[];
}

const must = (code: string, title: string, riskIfMissing: Risk = "Critical", buyerIssued = false): RequiredDoc => ({
  code,
  title,
  criticality: "must",
  riskIfMissing,
  ...(buyerIssued ? { buyerIssued: true } : {}),
});
const cond = (code: string, title: string, condition: string, riskIfMissing: Risk = "High"): RequiredDoc => ({
  code,
  title,
  criticality: "conditional",
  condition,
  riskIfMissing,
});

/**
 * QW1 · Restricted · Works Contractor + PSCS — the 12-item reference pack from
 * the HSE SAQ review. The two CV pro-formas and Appendix B1 are the gaps that
 * review surfaced (B1 seeded-but-not-surfaced; CVs modelled applicant-supplied).
 */
const QW1_RESTRICTED_WORKS_PSCS: PackScenario = {
  id: "QW1-restricted-works-pscs",
  category: "works",
  procedure: "restricted",
  saqForm: "QW1",
  label: "Works Contractor + PSCS · Restricted procedure (PW-CF1)",
  requires: [
    must("cwmf_qw1_part1", "QW1 Part 1 — Suitability Assessment Questionnaire"),
    must("cwmf_qw_part2", "QW Part 2 — Declaration"),
    must("cwmf_appendix_a", "Appendix A — Reg. 57 self-declaration / ESPD route"),
    must("cwmf_appendix_b1", "Appendix B1 — List of Previous Works Projects"),
    must("cwmf_appendix_d1", "Appendix D1 — Financial / insurance details"),
    must("cwmf_hs_3_4_1", "H&S 3.4.1 — Contractor competence supplement"),
    must("cwmf_hs_3_4_2", "H&S 3.4.2 — PSCS competence supplement"),
    must("cwmf_appendix_cv_3_4a", "Appendix — CV pro-forma 3.4a (Management)", "Critical", true),
    must("cwmf_appendix_cv_3_4b", "Appendix — CV pro-forma 3.4b (Personnel)", "Critical", true),
    cond("cwmf_appendix_b2", "Appendix B2 — Comparable works projects", "comparable_projects"),
    cond("cwmf_appendix_b3", "Appendix B3 — Comparable PSCS service", "comparable_assignments"),
    cond("cwmf_appendix_c", "Appendix C — Turnover statement", "min_turnover"),
  ],
};

/** QC1 · consultancy (also the current fallback for goods/services — see docs/37). */
const QC1_RESTRICTED_CONSULTANCY: PackScenario = {
  id: "QC1-restricted-consultancy",
  category: "consultancy",
  procedure: "restricted",
  saqForm: "QC1",
  label: "Consultancy · Restricted procedure",
  requires: [
    must("cwmf_qc1_part1", "QC1 Part 1 — Suitability Assessment Questionnaire"),
    must("cwmf_qc_part2", "QC Part 2 — Declaration"),
    must("cwmf_appendix_a", "Appendix A — Reg. 57 self-declaration / ESPD route"),
    cond("cwmf_appendix_b3", "Appendix B3 — Comparable assignments", "comparable_assignments"),
    cond("cwmf_appendix_c", "Appendix C — Turnover statement", "min_turnover"),
  ],
};

export const EXPECTED_PACK_MATRIX: Record<string, PackScenario> = {
  [QW1_RESTRICTED_WORKS_PSCS.id]: QW1_RESTRICTED_WORKS_PSCS,
  [QC1_RESTRICTED_CONSULTANCY.id]: QC1_RESTRICTED_CONSULTANCY,
};

/**
 * Goods and non-construction services have NO dedicated suitability form — they
 * currently borrow QC1/QC2. Flagged as a statutory gap (docs/37 §Goods/Services).
 */
export const GOODS_SERVICES_FALLBACK_NOTE =
  "No dedicated QG/QS suitability form exists; goods and services fall back to the " +
  "consultancy form (QC1/QC2). Statutory gap — see docs/37.";

export function getScenario(id: string): PackScenario | undefined {
  return EXPECTED_PACK_MATRIX[id];
}
