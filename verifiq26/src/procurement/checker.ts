/**
 * VerifIQ — procurement pack-completeness checker (proof of concept).
 *
 * Deterministic rule engine: given a declared pack scenario and the documents
 * actually present, it emits §05.1 Findings for every required document that is
 * missing — so tender-pack gaps flow into the same council register / report as
 * design findings. This is a code-rules reviewer that complements the LLM
 * discipline agents (no model call, fully reproducible).
 *
 * Reproduces the HSE SAQ review's headline gaps (Appendix B1; the 3.4a/3.4b CV
 * pro-formas) from the matrix, deterministically.
 *
 * Version: 0.8.0-phase5
 */

import type { Finding } from "../types/index.js";
import { getScenario, type PackScenario, type RequiredDoc } from "./pack-matrix.js";

export interface PackCheckInput {
  /** Scenario id from EXPECTED_PACK_MATRIX (e.g. "QW1-restricted-works-pscs"). */
  scenarioId: string;
  /** Doc codes present in the uploaded/assembled pack. */
  presentDocCodes: string[];
  /** SAQ selection tokens the buyer ticked (drives conditional requirements). */
  selectedOptions?: string[];
}

export interface PackCheckResult {
  scenario: PackScenario;
  findings: Finding[];
  /** Codes required (after conditionals) but absent. */
  missing: string[];
}

const DISCIPLINE = "Procurement / Tender Pack";
const OWNER = "Contracting Authority";

/** Check a pack against its expected-document matrix; emit findings for gaps. */
export function checkPackCompleteness(input: PackCheckInput): PackCheckResult {
  const scenario = getScenario(input.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown pack scenario: ${input.scenarioId}`);
  }
  const present = new Set(input.presentDocCodes);
  const selected = new Set(input.selectedOptions ?? []);

  const findings: Finding[] = [];
  const missing: string[] = [];
  let seq = 1;

  for (const doc of scenario.requires) {
    const required = doc.criticality === "must" || (doc.condition !== undefined && selected.has(doc.condition));
    if (!required || present.has(doc.code)) continue;

    missing.push(doc.code);
    findings.push(toFinding(scenario, doc, seq++));
  }

  return { scenario, findings, missing };
}

function toFinding(scenario: PackScenario, doc: RequiredDoc, seq: number): Finding {
  const issue_id = `PROC-PRE-${String(seq).padStart(4, "0")}`;
  const proForma = doc.buyerIssued
    ? " It must be generated as a blank buyer-issued pro-forma, not left as applicant-supplied."
    : "";
  const conditionNote =
    doc.criticality === "conditional" && doc.condition
      ? ` (required because "${doc.condition}" is selected)`
      : "";

  return {
    issue_id,
    discipline_origin: DISCIPLINE,
    interface_disciplines: [],
    stage: "pre-tender",
    project_area: scenario.label,
    location: scenario.saqForm,
    source_document: "SAQ pack manifest",
    source_reference: doc.code,
    related_documents: [],
    requirement: `CWMF Pillar 3 requires ${doc.title} for ${scenario.label}.`,
    finding: `${doc.title} (${doc.code}) is required for this ${scenario.saqForm} pack but is not present.${conditionNote}${proForma}`,
    status: "Not demonstrated",
    risk: doc.riskIfMissing,
    build_readiness_impact: "Pre-tender close-out",
    question: `Is ${doc.title} included in the pack before issue?`,
    required_evidence: [`Include ${doc.title} (${doc.code}) in the pack before issue to eTenders`],
    owner: OWNER,
    close_out_stage: "pre-tender",
  };
}
