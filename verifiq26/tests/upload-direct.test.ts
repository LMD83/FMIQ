/**
 * VerifIQ — direct-upload backend tests (docs/42 §5.2/§5.3, Sprint 2).
 *
 * Covers the session-authed upload spine: signed-URL minting, document
 * registration with scan-state advance, sealing, and the manifest query —
 * plus the rejection path for an invalid/forged session on every entry point.
 */

/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from "vitest";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";

const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "../src/convex/**/*.js",
  "!../src/convex/**/*.d.ts",
]);

beforeAll(() => {
  process.env.UPLOAD_TOKEN_PEPPER = "test-pepper";
  // Dummy R2 config — the presigner signs offline, no network needed.
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_BUCKET_NAME = "verifiq-prod-eu-west";
});

/** Issue a code and verify it to obtain a live upload session. */
async function session(t: ReturnType<typeof convexTest>) {
  const issued = await t.mutation(internal.uploadTokens.createIntake, {
    name: "Liam",
    email: "liam@goviq.ie",
    project_name: "Upload Test Pack",
  });
  const ok = await t.mutation(api.uploadTokens.verifyUploadCode, { secret: issued.linkToken });
  return { sessionToken: ok.sessionToken as string, projectId: issued.projectId as string };
}

describe("direct-upload signed URLs", () => {
  it("mints a signed PUT URL for a valid session", async () => {
    const t = convexTest(schema, modules);
    const { sessionToken } = await session(t);
    const res = await t.action(api.uploadDirect.getUploadUrlForSession, {
      sessionToken,
      filename: "A-100.pdf",
      sha256: "b".repeat(64),
      size_bytes: 2_000_000,
      discipline: "architectural",
    });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("PUT");
    expect(res.uploadUrl).toMatch(/^https:\/\//);
    expect(res.uploadUrl).toContain("X-Amz-Signature");
    expect(res.key).toContain("disc/architectural/");
  });

  it("rejects an invalid session", async () => {
    const t = convexTest(schema, modules);
    const res = await t.action(api.uploadDirect.getUploadUrlForSession, {
      sessionToken: "not-a-session",
      filename: "x.pdf",
      sha256: "b".repeat(64),
      size_bytes: 10,
    });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("document registration + seal", () => {
  it("registers a document, advances pending → uploading, and lists it", async () => {
    const t = convexTest(schema, modules);
    const { sessionToken, projectId } = await session(t);

    const reg = await t.mutation(api.uploadDocs.registerUploadedDocument, {
      sessionToken,
      filename: "A-100.pdf",
      sha256: "b".repeat(64),
      size_bytes: 2_000_000,
      r2_key: "proj/p/disc/architectural/" + "b".repeat(64) + ".pdf",
      discipline: "architectural",
    });
    expect(reg.ok).toBe(true);

    const project = await t.run(async (ctx) => ctx.db.get(projectId as never));
    expect((project as { scan_state: string }).scan_state).toBe("uploading");

    const manifest = await t.query(api.uploadDocs.listSessionDocuments, { sessionToken });
    expect(manifest).toHaveLength(1);
    expect(manifest[0].filename).toBe("A-100.pdf");
  });

  it("rejects registration with a forged session", async () => {
    const t = convexTest(schema, modules);
    const res = await t.mutation(api.uploadDocs.registerUploadedDocument, {
      sessionToken: "forged",
      filename: "x.pdf",
      sha256: "b".repeat(64),
      size_bytes: 10,
      r2_key: "k",
    });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });

  it("seals the pack and advances uploading → classifying", async () => {
    const t = convexTest(schema, modules);
    const { sessionToken, projectId } = await session(t);

    // sealing with no documents is rejected
    const empty = await t.mutation(api.uploadDocs.sealUploadSession, { sessionToken });
    expect(empty).toEqual({ ok: false, error: "no_documents" });

    await t.mutation(api.uploadDocs.registerUploadedDocument, {
      sessionToken,
      filename: "A-100.pdf",
      sha256: "b".repeat(64),
      size_bytes: 2_000_000,
      r2_key: "proj/p/disc/architectural/x.pdf",
    });

    const sealed = await t.mutation(api.uploadDocs.sealUploadSession, { sessionToken });
    expect(sealed.ok).toBe(true);
    expect(sealed.documentCount).toBe(1);

    const project = await t.run(async (ctx) => ctx.db.get(projectId as never));
    expect((project as { scan_state: string }).scan_state).toBe("classifying");
  });

  it("listSessionDocuments returns [] for an invalid session (no leak)", async () => {
    const t = convexTest(schema, modules);
    const docs = await t.query(api.uploadDocs.listSessionDocuments, { sessionToken: "nope" });
    expect(docs).toEqual([]);
  });
});
