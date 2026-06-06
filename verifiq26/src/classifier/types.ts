/**
 * VerifIQ — classifier types (file 20 §3).
 *
 * The 3-source document classifier (filename + title-block vision + content)
 * outputs the metadata the `documents` table records. Confidence drives the
 * classification-confirmation gate (file 20 §4): rows below the threshold are
 * forced to the customer for confirmation.
 *
 * Version: 0.6.0-phase4
 */

/** Inputs available for one file. Higher-signal inputs are optional. */
export interface ClassificationInput {
  filename: string;
  sizeBytes?: number;
  folder?: string;
  /** Rendered bottom-right title-block region of page 1 (Source 2). */
  titleBlockImage?: Uint8Array;
  titleBlockMediaType?: "image/png" | "image/jpeg";
  /** First ~500 tokens of extracted text (Source 3). */
  contentText?: string;
}

export type ClassificationSource = "title-block" | "content" | "filename";

/** Output written to `documents` (discipline, doc_type, drawing_number, …). */
export interface ClassificationResult {
  discipline: string;
  doc_type: string;
  drawing_number?: string;
  revision?: string;
  date?: string;
  author?: string;
  /** 0..1 — below the confirm threshold means "needs confirmation" (file 20 §4). */
  classifier_confidence: number;
  source: ClassificationSource;
}

/** Below this, the row is pre-selected for forced confirmation (file 20 §4). */
export const CONFIRM_THRESHOLD = 0.7;

/** Title-block discipline codes → names (file 20 §3). */
export const DISCIPLINE_BY_CODE: Record<string, string> = {
  A: "Architectural",
  S: "Structural",
  M: "Mechanical",
  E: "Electrical",
  C: "Civil",
  F: "Fire",
  P: "Public Health",
  L: "Landscape",
};

/** Longer discipline tokens sometimes embedded in filenames. */
export const DISCIPLINE_BY_TOKEN: Record<string, string> = {
  arc: "Architectural",
  arch: "Architectural",
  str: "Structural",
  struct: "Structural",
  mec: "Mechanical",
  mech: "Mechanical",
  ele: "Electrical",
  elec: "Electrical",
  civ: "Civil",
  fir: "Fire",
  fire: "Fire",
};

/** Map a discipline code/word to a canonical discipline name, or undefined. */
export function disciplineFromCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const c = code.trim();
  if (c.length === 1 && DISCIPLINE_BY_CODE[c.toUpperCase()]) {
    return DISCIPLINE_BY_CODE[c.toUpperCase()];
  }
  const token = DISCIPLINE_BY_TOKEN[c.toLowerCase()];
  if (token) return token;
  // Already a full name (e.g. "Architectural").
  return c.length > 1 ? c : undefined;
}

/** Infer a document type from a drawing title / filename keywords. */
export function inferDocType(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/general arrangement|\bga\b|ga plan/.test(t)) return "GA Plan";
  if (/site plan|location plan|block plan/.test(t)) return "Site Plan";
  if (/floor plan|\bplan\b/.test(t)) return "Plan";
  if (/section/.test(t)) return "Section";
  if (/elevation/.test(t)) return "Elevation";
  if (/detail/.test(t)) return "Detail";
  if (/schedule/.test(t)) return "Schedule";
  if (/specification|\bspec\b/.test(t)) return "Specification";
  if (/strategy/.test(t)) return "Strategy";
  if (/layout/.test(t)) return "Layout";
  if (/report/.test(t)) return "Report";
  return undefined;
}
