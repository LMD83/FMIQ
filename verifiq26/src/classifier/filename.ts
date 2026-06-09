/**
 * VerifIQ — filename parser (classifier Source 1, file 20 §3).
 *
 * Filename classification alone yields ~50–60% accuracy, so this is the lowest
 * weight source and the final fallback. It recognises the common Irish-practice
 * conventions: `A-100`, `A-101 Rev B`, `24-001-ARC-100-rev-B`, `Plan-Ground.pdf`.
 *
 * Version: 0.6.0-phase4
 */

import { DISCIPLINE_BY_CODE, DISCIPLINE_BY_TOKEN, inferDocType } from "./types.js";

export interface FilenameParse {
  discipline?: string;
  drawing_number?: string;
  revision?: string;
  doc_type?: string;
  /** 0..1 — how much signal the filename gave. */
  confidence: number;
}

export function parseFilename(filename: string): FilenameParse {
  const base = stripExtension(filename);
  const result: FilenameParse = { confidence: 0.2 };

  // Discipline word token, e.g. "...-ARC-..." or "Architectural...".
  const tokenMatch = base.toLowerCase().match(/\b(arch?|struct?|mech?|elec?|civ|fire?)\b/);
  if (tokenMatch) {
    const disc = DISCIPLINE_BY_TOKEN[tokenMatch[1]!];
    if (disc) result.discipline = disc;
  }

  // Drawing number with a leading discipline letter, e.g. "A-100", "S007".
  const dwg = base.match(/\b([ASMECFPL])[-\s]?(\d{2,4})\b/);
  if (dwg) {
    result.drawing_number = `${dwg[1]!.toUpperCase()}-${dwg[2]}`;
    if (!result.discipline) result.discipline = DISCIPLINE_BY_CODE[dwg[1]!.toUpperCase()];
  }

  // Revision, e.g. "Rev B", "-rev-c", "RevA".
  const rev = base.match(/\brev[\s_-]?([A-Za-z0-9]{1,3})\b/i);
  if (rev) result.revision = rev[1]!.toUpperCase();

  const docType = inferDocType(base);
  if (docType) result.doc_type = docType;

  // Confidence: discipline + drawing number is a strong filename signal.
  if (result.discipline && result.drawing_number) result.confidence = 0.55;
  else if (result.discipline || result.drawing_number) result.confidence = 0.4;
  else if (result.doc_type) result.confidence = 0.3;

  return result;
}

function stripExtension(filename: string): string {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const name = slash >= 0 ? filename.slice(slash + 1) : filename;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
