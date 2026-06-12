/**
 * Charity Cloud — PII detection guards (CLAUDE.md rules 4 & 7).
 *
 * Chat mutations run these regexes on every message: matches flag the message,
 * warn the sender, and enqueue a moderation item. PPSNs are rejected/redacted
 * EVERYWHERE (rule 4) — never collected, never stored.
 */

/** Irish Eircode: routing key + unique identifier, e.g. "D02 X285". */
export const EIRCODE_RE = /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/g;

/** Irish phone numbers: mobiles (08x...), geographic, and +353 forms. */
export const IE_PHONE_RE =
  /(?:\+353\s?|0)(?:8[35679]|1|2[1-9]|4[0-9]|5[1-9]|6[1-9]|7[14]|9[0-9])[\s-]?\d{3}[\s-]?\d{3,4}\b/g;

/** PPSN: 7 digits + 1–2 check letters, e.g. "1234567FA". Rejected everywhere. */
export const PPSN_RE = /\b\d{7}[A-Za-z]{1,2}\b/g;

export interface PiiScan {
  hasEircode: boolean;
  hasPhone: boolean;
  hasPpsn: boolean;
  /** Any PII hit at all (drives the chat flag + moderation enqueue). */
  flagged: boolean;
}

export function scanPii(text: string): PiiScan {
  const hasEircode = new RegExp(EIRCODE_RE.source).test(text);
  const hasPhone = new RegExp(IE_PHONE_RE.source).test(text);
  const hasPpsn = new RegExp(PPSN_RE.source).test(text);
  return { hasEircode, hasPhone, hasPpsn, flagged: hasEircode || hasPhone || hasPpsn };
}

/** Redact PPSNs in place (rule 4: reject/redact if pasted into any field). */
export function redactPpsn(text: string): string {
  return text.replace(new RegExp(PPSN_RE.source, "g"), "[redacted]");
}
