/**
 * VerifIQ — document classifier barrel (file 20 §3).
 * Version: 0.6.0-phase4
 */

export {
  type ClassificationResult,
  type ClassifyInput,
  type ClassifierSource,
  type PdfRenderer,
  type TextExtractor,
  DISCIPLINE_BY_CODE,
} from "./types.js";
export { parseFilename, inferDocType } from "./filename.js";
export { classifyDocument, type ClassifierDeps } from "./classifier.js";
