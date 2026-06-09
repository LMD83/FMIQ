/**
 * VerifIQ — document text-extraction ports (Phase 5, file 20 §1).
 *
 * The upload pipeline extracts page-1 text (and, where rendered, the title-block
 * region) from each PDF so the classifier has its content + title-block sources.
 * The raw PDF parse is injectable so the shaping logic is unit-tested without the
 * optional `pdf-parse` native dependency or any file I/O.
 *
 * Version: 0.8.0-phase5
 */

/** The extracted text + page count for a document (plus an optional render). */
export interface PdfExtraction {
  text: string;
  pageCount: number;
  /** Rendered bottom-right title-block region of page 1 (Source 2), if produced. */
  titleBlockImage?: Uint8Array;
  titleBlockMediaType?: "image/png" | "image/jpeg";
}

export interface PdfExtractor {
  extract(bytes: Uint8Array): Promise<PdfExtraction>;
}

/**
 * Injectable raw PDF parse. The default binds `pdf-parse` (Node only); tests and
 * custom wiring inject a fake so the module needs neither the dependency nor a
 * real PDF.
 */
export type RawPdfParse = (bytes: Uint8Array) => Promise<{ text: string; pageCount: number }>;
