/**
 * VerifIQ — filename classifier (Source 1, file 20 §3).
 *
 * Filename-only classification yields ~50–60% accuracy (file 20), so this is the
 * lowest-weight source — used as the fallback and to seed drawing-number /
 * revision when the title block and content are unavailable.
 *
 * Version: 0.6.0-phase4
 */

import { DISCIPLINE_BY_CODE, type ClassificationResult } from "./types.js";

const DISCIPLINE_TOKENS: { re: RegExp; discipline: string }[] = [
  { re: /\b(arc|arch|architect)\w*/i, discipline: "architectural" },
  { re: /\b(str|struct)\w*/i, discipline: "structural" },
  { re: /\b(mep|mech)\w*/i, discipline: "mechanical" },
  { re: /\b(elec|ee)\b/i, discipline: "electrical" },
  { re: /\b(civ|civil)\w*/i, discipline: "civil" },
  { re: /\bfire\w*/i, discipline: "fire" },
  { re: /\b(qs|boq|cost)\b/i, discipline: "quantity-surveying" },
];

/** Best-effort field extraction from a filename. */
export function parseFilename(filename: string): ClassificationResult {
  const base = filename.replace(/\.[a-z0-9]+$/i, "");

  // Drawing number like A-100, ARC-100, 24-001-ARC-100.
  const drawingMatch = base.match(/\b([A-Z]{1,4})[-_ ]?(\d{2,4})\b/i);
  const drawing_number = drawingMatch ? `${drawingMatch[1]!.toUpperCase()}-${drawingMatch[2]}` : undefined;

  // Revision like "Rev B", "-rev-c", trailing "-B".
  const revMatch = base.match(/rev[-_ ]?([A-Z0-9]{1,3})\b/i) ?? base.match(/[-_ ]([A-Z])\b\s*$/);
  const revision = revMatch ? revMatch[1]!.toUpperCase() : undefined;

  // Discipline: single-letter code prefix wins, else token match.
  let discipline = "unsorted";
  let confidence = 0.3;
  const codeMatch = base.match(/^([A-Z])[-_ ]?\d/i);
  if (codeMatch && DISCIPLINE_BY_CODE[codeMatch[1]!.toUpperCase()]) {
    discipline = DISCIPLINE_BY_CODE[codeMatch[1]!.toUpperCase()]!;
    confidence = 0.55;
  } else {
    for (const { re, discipline: d } of DISCIPLINE_TOKENS) {
      if (re.test(base)) {
        discipline = d;
        confidence = 0.5;
        break;
      }
    }
  }

  return {
    discipline,
    doc_type: inferDocType(base),
    drawing_number,
    revision,
    classifier_confidence: discipline === "unsorted" ? 0.2 : confidence,
    source: "filename",
  };
}

/** Infer a coarse document type from a title or filename. */
export function inferDocType(text: string): string {
  const t = text.toLowerCase();
  if (/(spec|specification)/.test(t)) return "specification";
  if (/(schedule)/.test(t)) return "schedule";
  if (/(report|strategy|statement)/.test(t)) return "report";
  if (/(bo[qm]|bill of)/.test(t)) return "bill-of-quantities";
  if (/(plan|elevation|section|detail|layout|drawing|ga)/.test(t)) return "drawing";
  return "unknown";
}
