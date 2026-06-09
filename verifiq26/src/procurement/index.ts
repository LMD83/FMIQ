/**
 * VerifIQ — procurement pack-review module (proof of concept).
 *
 * A reusable "paperwork checking" capability on the same council engine: a
 * deterministic completeness checker over an expected-document matrix, emitting
 * §05.1 Findings for missing tender/SAQ documents. See
 * docs/37-procurement-pack-review-module.md.
 *
 * Version: 0.8.0-phase5
 */

export {
  EXPECTED_PACK_MATRIX,
  GOODS_SERVICES_FALLBACK_NOTE,
  getScenario,
  type PackCategory,
  type PackProcedure,
  type PackScenario,
  type RequiredDoc,
  type DocCriticality,
} from "./pack-matrix.js";
export {
  checkPackCompleteness,
  type PackCheckInput,
  type PackCheckResult,
} from "./checker.js";
