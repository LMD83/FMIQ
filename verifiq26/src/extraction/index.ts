/**
 * VerifIQ — document extraction module (Phase 5, file 20 §1).
 *
 * Page-1 text (and optional title-block render) extraction feeding the
 * classifier. The raw parse is an injectable port; the text→input shaping is
 * pure + tested.
 *
 * Version: 0.8.0-phase5
 */

export type { PdfExtraction, PdfExtractor, RawPdfParse } from "./types.js";
export type { PdfExtractorOptions } from "./pdf.js";
export {
  PdfTextExtractor,
  defaultPdfParse,
  firstTokens,
  normaliseWhitespace,
  extractionToInput,
} from "./pdf.js";
