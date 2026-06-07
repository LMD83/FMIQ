/**
 * VerifIQ — classifier barrel (Phase 4).
 *
 * The 3-source title-block document classifier (file 20 §3) that produces the
 * metadata the `documents` table records and the confidence the
 * classification-confirmation gate (file 20 §4) reads.
 *
 * Version: 0.6.0-phase4
 */

export { TitleBlockClassifier, createClassifier, type ClassifierDeps } from "./classifier.js";
export { parseFilename, type FilenameParse } from "./filename.js";
export {
  type ClassificationInput,
  type ClassificationResult,
  type ClassificationSource,
  CONFIRM_THRESHOLD,
  DISCIPLINE_BY_CODE,
  disciplineFromCode,
  inferDocType,
} from "./types.js";
