/**
 * VerifIQ — magic-code core (runtime-agnostic).
 *
 * The "advanced magic code" that replaces the old `mailto:` concierge intake
 * (docs/42 §1.2). Pure logic only — no Convex, no Resend, no Node-only APIs —
 * so it runs identically in the Convex isolate and under vitest, and is
 * exhaustively unit-testable in isolation.
 *
 * Two secrets per intake, per the locked D4 decision (link + code):
 *   - a high-entropy LINK token (32 bytes) embedded in the one-click URL, and
 *   - a 6-char human SHORT code (typeable if the link is mangled or spam-binned).
 * Neither is ever stored raw: only their salted SHA-256 hashes are persisted
 * (docs/42 §4, §5.4 N1). Verification looks a secret up by its hash, so a wrong
 * guess simply matches nothing — there is no oracle to enumerate against.
 *
 * Uses Web Crypto (`crypto.getRandomValues`, `crypto.subtle.digest`) and
 * `btoa`/hex only, all available in both the Convex default runtime and Node 20+.
 */

/** Default token lifetime — 72 hours (docs/42 §4 `expires_at`). */
export const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;

/** Upload-session lifetime once a code is verified — 4 hours (docs/42 §4). */
export const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

/**
 * Replay ceiling: how many times a single (already-resolved) token may be
 * re-presented before it is revoked. Brute-force defence for the short code
 * itself is entropy (30^6 ≈ 7.3e8) plus per-IP/email throttling at the HTTP
 * boundary — not this counter (docs/42 §5.4 N1).
 */
export const MAX_VERIFY_ATTEMPTS = 5;

/** Length of the human-typeable short code. */
export const SHORT_CODE_LENGTH = 6;

/**
 * Crockford-ish alphabet with the ambiguous glyphs removed (no I, L, O, U, and
 * no 0/1) so a code read off a screen or phone is unambiguous. 30 symbols.
 */
const SHORT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/** Bytes of entropy in the one-click link token. */
const LINK_TOKEN_BYTES = 32;

/** Bytes of entropy in a minted upload-session token. */
const SESSION_TOKEN_BYTES = 32;

/** Lower-case hex encoding of a byte array (no Buffer dependency). */
function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Cryptographically-random bytes. */
function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

/** A high-entropy, URL-safe token (hex) for the one-click link / session. */
export function generateLinkToken(): string {
  return toHex(randomBytes(LINK_TOKEN_BYTES));
}

/** A minted upload-session bearer token (same shape as a link token). */
export function generateSessionToken(): string {
  return toHex(randomBytes(SESSION_TOKEN_BYTES));
}

/**
 * A short, human-typeable code drawn uniformly from {@link SHORT_CODE_ALPHABET}.
 * Uses rejection sampling so the result is unbiased despite 256 not being a
 * multiple of the alphabet size.
 */
export function generateShortCode(length: number = SHORT_CODE_LENGTH): string {
  const n = SHORT_CODE_ALPHABET.length; // 30
  const ceiling = Math.floor(256 / n) * n; // largest multiple of n ≤ 256
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b >= ceiling) continue; // reject the biased tail
      out += SHORT_CODE_ALPHABET[b % n];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Normalise a user-supplied short code: trim, upper-case, and drop separators
 * so "abcd-ef" and "ABCDEF" hash identically. Link tokens are left untouched
 * (they are exact hex and case-sensitive).
 */
export function normalizeShortCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** Lower-case an intake email for stable lookup/hashing. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Salted SHA-256 of a secret, returned as hex. The pepper is a server-side
 * secret (env `UPLOAD_TOKEN_PEPPER`) so a database leak alone cannot be used to
 * verify guessed codes offline (docs/42 §5.4 N1).
 */
export async function hashSecret(secret: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${pepper}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

/** True once `now` has passed `expiresAt`. */
export function isExpired(expiresAt: number, now: number): boolean {
  return now >= expiresAt;
}
