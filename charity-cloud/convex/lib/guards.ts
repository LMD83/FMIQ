/**
 * Charity Cloud — content guards used by mutations.
 *
 * - Category whitelist (rule 8): mutation-layer check, not just UI.
 * - PPSN rejection/redaction (rule 4) on every free-text field.
 * - TTLs for requester content (rule 5).
 */
import { isAllowedCategory, scanPii, redactPpsn } from "../../packages/shared/src/index";

export const NEED_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
export const MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const PRIVATE_NOTE_MAX = 280;

/** Throws unless category/subcategory is in the taxonomy whitelist. */
export function assertAllowedCategory(category: string, subcategory: string): void {
  if (!isAllowedCategory(category, subcategory)) {
    throw new Error("Category not permitted (whitelist check)");
  }
}

/** Rule 4: PPSNs never stored — redact, and report whether one was present. */
export function cleanFreeText(text: string): { text: string; hadPpsn: boolean } {
  const scan = scanPii(text);
  return { text: scan.hasPpsn ? redactPpsn(text) : text, hadPpsn: scan.hasPpsn };
}

export { scanPii };
