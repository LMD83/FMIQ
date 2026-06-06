/**
 * VerifIQ — finding parser + shape validation.
 *
 * Turns an LLM response into well-formed §05.1 Finding objects. Strips code
 * fences, parses JSON, and validates each object against the controlled
 * vocabularies. Malformed candidates are collected (with a reason) rather than
 * emitted — a finding that doesn't conform to the schema never reaches the
 * self-check gate.
 *
 * Version: 0.4.0-phase2
 */

import type {
  BuildReadinessImpact,
  Finding,
  FindingStatus,
  Risk,
  Stage,
} from "../types/index.js";

const STATUSES: FindingStatus[] = [
  "Compliant",
  "Non-compliant",
  "Not demonstrated",
  "Clarification required",
  "Coordination issue",
  "Construction evidence required",
  "Handover evidence required",
  "Outside current scope",
];
const RISKS: Risk[] = ["Critical", "High", "Medium", "Low", "Advisory"];
const IMPACTS: BuildReadinessImpact[] = [
  "Build blocker",
  "Proceed with condition",
  "Pre-tender close-out",
  "Pre-construction close-out",
  "Construction hold point",
  "Handover requirement",
  "Advisory",
];
const STAGES: Stage[] = ["design", "pre-tender", "pre-build", "construction", "handover"];

export interface ParseResult {
  findings: Finding[];
  invalid: { raw: unknown; reason: string }[];
}

/** Strip markdown code fences and locate the JSON array/object payload. */
function stripToJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  return t;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Parse and shape-check findings from an LLM response. */
export function parseFindings(text: string): ParseResult {
  const findings: Finding[] = [];
  const invalid: { raw: unknown; reason: string }[] = [];

  let data: unknown;
  try {
    data = JSON.parse(stripToJson(text));
  } catch {
    return { findings, invalid: [{ raw: text, reason: "response was not valid JSON" }] };
  }

  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { findings?: unknown }).findings)
      ? (data as { findings: unknown[] }).findings
      : [data];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      invalid.push({ raw, reason: "not an object" });
      continue;
    }
    const o = raw as Record<string, unknown>;
    const status = str(o.status) as FindingStatus;
    const risk = str(o.risk) as Risk;
    const impact = str(o.build_readiness_impact) as BuildReadinessImpact;
    const stage = str(o.stage) as Stage;

    const reason = firstInvalid([
      [STATUSES.includes(status), `invalid status "${str(o.status)}"`],
      [RISKS.includes(risk), `invalid risk "${str(o.risk)}"`],
      [IMPACTS.includes(impact), `invalid build_readiness_impact "${str(o.build_readiness_impact)}"`],
      [STAGES.includes(stage), `invalid stage "${str(o.stage)}"`],
      [str(o.requirement).trim().length > 0, "missing requirement"],
      [str(o.finding).trim().length > 0, "missing finding"],
    ]);
    if (reason) {
      invalid.push({ raw, reason });
      continue;
    }

    findings.push({
      issue_id: str(o.issue_id),
      discipline_origin: str(o.discipline_origin),
      interface_disciplines: asStringArray(o.interface_disciplines),
      stage,
      project_area: str(o.project_area) || undefined,
      location: str(o.location) || undefined,
      source_document: str(o.source_document),
      source_reference: str(o.source_reference),
      related_documents: asStringArray(o.related_documents),
      requirement: str(o.requirement),
      finding: str(o.finding),
      status,
      risk,
      build_readiness_impact: impact,
      question: str(o.question) || undefined,
      required_evidence: asStringArray(o.required_evidence),
      owner: str(o.owner),
      secondary_owner: str(o.secondary_owner) || undefined,
      close_out_stage: str(o.close_out_stage) || undefined,
    });
  }

  return { findings, invalid };
}

function firstInvalid(checks: [boolean, string][]): string | null {
  for (const [ok, reason] of checks) if (!ok) return reason;
  return null;
}
