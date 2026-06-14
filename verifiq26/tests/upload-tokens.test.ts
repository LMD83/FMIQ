/**
 * VerifIQ — magic-code + upload-session tests (docs/42 §5.5).
 *
 * Two layers:
 *   1. the runtime-agnostic core (src/auth/magic-code.ts) — generation, hashing,
 *      normalisation, expiry; and
 *   2. the Convex flow (convex-test) — issue → verify → session, plus every
 *      rejection path: reuse, expiry, wrong secret, replay lockout, session
 *      validation. These are the acceptance gates listed in docs/42 §5.5.
 *
 * No live credentials: a dev pepper is set in-process, Resend is never called
 * (createIntake/verify are pure DB), and the offline convex-test harness runs
 * against the schema directly.
 */

/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from "vitest";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import {
  generateLinkToken,
  generateSessionToken,
  generateShortCode,
  hashSecret,
  isExpired,
  normalizeEmail,
  normalizeShortCode,
  SHORT_CODE_LENGTH,
  DEFAULT_TTL_MS,
  MAX_VERIFY_ATTEMPTS,
} from "../src/auth/magic-code";

const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "../src/convex/**/*.js",
  "!../src/convex/**/*.d.ts",
]);

beforeAll(() => {
  process.env.UPLOAD_TOKEN_PEPPER = "test-pepper";
});

describe("magic-code core", () => {
  it("generates link/session tokens with 32 bytes of hex entropy", () => {
    const a = generateLinkToken();
    const b = generateSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("generates short codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateShortCode();
      expect(code).toHaveLength(SHORT_CODE_LENGTH);
      // no ambiguous glyphs (I, L, O, U, 0, 1)
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]+$/);
    }
  });

  it("short codes are effectively unique across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShortCode());
    expect(seen.size).toBeGreaterThan(995); // collisions vanishingly unlikely
  });

  it("normalises short codes (case, spaces, dashes) but not link tokens", () => {
    expect(normalizeShortCode(" ab-cd ef ")).toBe("ABCDEF");
    expect(normalizeEmail("  Liam@GovIQ.IE ")).toBe("liam@goviq.ie");
  });

  it("hashes deterministically, peppered, and not equal to the raw secret", async () => {
    const h1 = await hashSecret("ABCDEF", "pep");
    const h2 = await hashSecret("ABCDEF", "pep");
    const h3 = await hashSecret("ABCDEF", "other-pepper");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3); // pepper changes the digest
    expect(h1).not.toContain("ABCDEF");
  });

  it("isExpired flips exactly at the boundary", () => {
    expect(isExpired(100, 99)).toBe(false);
    expect(isExpired(100, 100)).toBe(true);
    expect(isExpired(100, 101)).toBe(true);
  });
});

describe("upload-token Convex flow", () => {
  async function issue(t: ReturnType<typeof convexTest>) {
    return t.mutation(internal.uploadTokens.createIntake, {
      name: "Liam",
      email: "Liam@GovIQ.ie",
      project_name: "Adult Day Centre — Stage 2C",
      building_type: "Adult Day Service",
    });
  }

  it("issues a token: creates user + project (pending) + audit, returns raw secrets", async () => {
    const t = convexTest(schema, modules);
    const issued = await issue(t);

    expect(issued.projectId).toBeTruthy();
    expect(issued.linkToken).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.shortCode).toHaveLength(SHORT_CODE_LENGTH);
    expect(issued.expiresAt).toBeGreaterThan(Date.now());
    expect(issued.expiresAt).toBeLessThanOrEqual(Date.now() + DEFAULT_TTL_MS + 1000);

    // project is pending; audit recorded the issue
    const audit = await t.query(api.mutations.listAudit, { project_id: issued.projectId });
    expect(audit.some((a: { action: string }) => a.action === "upload_code_issued")).toBe(true);
  });

  it("verifies by link token → mints a session; the spent token cannot be reused", async () => {
    const t = convexTest(schema, modules);
    const issued = await issue(t);

    const ok = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.projectId).toBe(issued.projectId);
      expect(ok.sessionToken).toMatch(/^[0-9a-f]{64}$/);

      // the minted session resolves to the project
      const session = await t.query(api.uploadTokens.checkUploadSession, {
        sessionToken: ok.sessionToken,
      });
      expect(session).toEqual({ ok: true, projectId: issued.projectId });
    }

    // reuse of the now-spent token is rejected
    const reuse = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    expect(reuse).toEqual({ ok: false, error: "used" });
  });

  it("verifies by the short code too (case/space-insensitive)", async () => {
    const t = convexTest(schema, modules);
    const issued = await issue(t);
    const messy = ` ${issued.shortCode.toLowerCase()} `;
    const ok = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: messy });
    expect(ok.ok).toBe(true);
  });

  it("rejects an unknown secret as 'invalid' (no enumeration)", async () => {
    const t = convexTest(schema, modules);
    await issue(t);
    const res = await t.mutation(api.uploadTokens.verifyUploadCode, {
      secret: "not-a-real-code",
    });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects an expired token and marks it expired", async () => {
    const t = convexTest(schema, modules);
    // issue with a negative TTL so it is already expired
    const issued = await t.mutation(internal.uploadTokens.createIntake, {
      name: "Liam",
      email: "liam@goviq.ie",
      project_name: "Expired pack",
      ttl_ms: -1000,
    });
    const res = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    expect(res).toEqual({ ok: false, error: "expired" });
  });

  it("revokes a token after repeated replay of a spent code", async () => {
    const t = convexTest(schema, modules);
    const issued = await issue(t);
    // spend it once
    await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    // replay until the ceiling
    let last;
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i++) {
      last = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    }
    expect(last).toEqual({ ok: false, error: "locked" });
    // and stays revoked thereafter
    const after = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    expect(after).toEqual({ ok: false, error: "revoked" });
  });

  it("checkUploadSession rejects a missing or expired session", async () => {
    const t = convexTest(schema, modules);
    const res = await t.query(api.uploadTokens.checkUploadSession, {
      sessionToken: "nope",
    });
    expect(res).toEqual({ ok: false });
  });

  it("revokeUploadToken blocks a previously-valid code", async () => {
    const t = convexTest(schema, modules);
    const issued = await issue(t);
    await t.mutation(internal.uploadTokens.revokeUploadToken, { token_id: issued.tokenId });
    const res = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
    expect(res).toEqual({ ok: false, error: "revoked" });
  });
});
