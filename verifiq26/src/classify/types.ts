/**
 * VerifIQ — document classifier types (file 20 §3).
 *
 * The 3-source title-block classifier determines a document's discipline,
 * type, drawing number, revision, date and author with a confidence score.
 * PDF rendering and text extraction are injected so the classifier logic is
 * runtime-agnostic and unit-testable (the heavy pdf libs stay at the edge).
 *
 * Version: 0.6.0-phase4
 */

export type ClassifierSource = "title-block" | "content" | "filename";

export interface ClassificationResult {
  discipline: string;
  doc_type: string;
  drawing_number?: string;
  revision?: string;
  date?: string;
  author?: string;
  classifier_confidence: number;
  source: ClassifierSource;
}

export interface ClassifyInput {
  filename: string;
  /** Raw file bytes (for title-block vision / content extraction). */
  bytes?: Uint8Array;
  /** Pre-extracted first-page text, if the caller already has it. */
  firstPageText?: string;
}

/** Renders the first page of a PDF to a PNG for title-block vision. */
export interface PdfRenderer {
  renderFirstPagePng(bytes: Uint8Array): Promise<Uint8Array>;
}

/** Extracts the first N characters/tokens of text from a document. */
export interface TextExtractor {
  firstText(bytes: Uint8Array, maxChars: number): Promise<string>;
}

/** Discipline code → discipline name (title-block convention, file 20 §3). */
export const DISCIPLINE_BY_CODE: Record<string, string> = {
  A: "architectural",
  S: "structural",
  M: "mechanical",
  E: "electrical",
  C: "civil",
  F: "fire",
  L: "landscape",
  Q: "quantity-surveying",
};
