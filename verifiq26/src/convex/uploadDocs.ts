/**
 * VerifIQ — direct-upload document registration + seal (docs/42 §5.2 A4/A6, Sprint 2).
 *
 * After the browser PUTs a file to R2 (signed URL from `uploadDirect.ts`), it
 * calls `registerUploadedDocument` to record the `documents` row (server is the
 * source of truth for the manifest), and `sealUploadSession` once the whole pack
 * is in — which advances the project's scan-state and lets the council pipeline
 * take over (docs/39 §1).
 *
 * Every entry point is session-authed: the caller proves possession of a valid,
 * unexpired upload session (minted by `uploadTokens.verifyUploadCode`) bound to
 * exactly one project. No ambient identity, no project id from the client.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashSecret, isExpired } from "../auth/magic-code";

function pepper(): string {
  return process.env.UPLOAD_TOKEN_PEPPER ?? "verifiq-dev-pepper-unsafe";
}

interface RegisterResult {
  ok: boolean;
  documentId?: string;
  error?: "unauthorized";
}

interface SealResult {
  ok: boolean;
  projectId?: string;
  documentCount?: number;
  error?: "unauthorized" | "no_documents";
}

/**
 * Record a file that was just uploaded to R2 under the session's project. The
 * SHA-256 is the client-computed digest; a server-side re-hash/verify against
 * the stored object is a follow-up (docs/42 §5.2 A4) handled out of band.
 */
export const registerUploadedDocument = mutation({
  args: {
    sessionToken: v.string(),
    filename: v.string(),
    sha256: v.string(),
    size_bytes: v.number(),
    r2_key: v.string(),
    discipline: v.optional(v.string()),
    doc_type: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RegisterResult> => {
    const session_hash = await hashSecret(args.sessionToken.trim(), pepper());
    const session = await ctx.db
      .query("upload_sessions")
      .withIndex("by_session_hash", (q) => q.eq("session_hash", session_hash))
      .unique();
    if (!session || isExpired(session.expires_at, Date.now())) {
      return { ok: false, error: "unauthorized" };
    }
    const projectId = session.project_id;
    const now = Date.now();

    // First file moves the pack from pending → uploading (docs/39 §1).
    const project = await ctx.db.get(projectId);
    if (project && project.scan_state === "pending") {
      await ctx.db.patch(projectId, { scan_state: "uploading", updated_at: now });
    }

    const documentId = await ctx.db.insert("documents", {
      project_id: projectId,
      filename: args.filename,
      sha256: args.sha256,
      size_bytes: args.size_bytes,
      r2_key: args.r2_key,
      discipline: args.discipline,
      doc_type: args.doc_type,
      status: "uploaded",
      created_at: now,
    });

    await ctx.db.insert("audit_log", {
      project_id: projectId,
      actor: "customer",
      action: "document_uploaded",
      target_type: "document",
      target_id: documentId,
      payload_json: JSON.stringify({
        filename: args.filename,
        sha256: args.sha256,
        size_bytes: args.size_bytes,
        r2_key: args.r2_key,
      }),
      occurred_at: now,
    });

    return { ok: true, documentId };
  },
});

/**
 * Seal the pack: with at least one document in, advance uploading → classifying
 * so the existing pipeline picks it up (docs/42 §5.2 A6, docs/39 §1). The actual
 * classify-job dispatch is wired when the classify action lands (CLAUDE.md
 * Phase 6); this transition is the trigger point and is audit-logged.
 */
export const sealUploadSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args): Promise<SealResult> => {
    const session_hash = await hashSecret(args.sessionToken.trim(), pepper());
    const session = await ctx.db
      .query("upload_sessions")
      .withIndex("by_session_hash", (q) => q.eq("session_hash", session_hash))
      .unique();
    if (!session || isExpired(session.expires_at, Date.now())) {
      return { ok: false, error: "unauthorized" };
    }
    const projectId = session.project_id;

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("project_id", projectId))
      .collect();
    if (docs.length === 0) return { ok: false, error: "no_documents" };

    const now = Date.now();
    await ctx.db.patch(projectId, { scan_state: "classifying", updated_at: now });
    await ctx.db.insert("audit_log", {
      project_id: projectId,
      actor: "customer",
      action: "upload_sealed",
      target_type: "project",
      target_id: projectId,
      payload_json: JSON.stringify({ documentCount: docs.length }),
      occurred_at: now,
    });

    return { ok: true, projectId, documentCount: docs.length };
  },
});

/**
 * The live manifest for the upload UI — the documents recorded against the
 * session's project. Session-authed; returns an empty list for an invalid
 * session rather than leaking whether the project exists.
 */
export const listSessionDocuments = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session_hash = await hashSecret(args.sessionToken.trim(), pepper());
    const session = await ctx.db
      .query("upload_sessions")
      .withIndex("by_session_hash", (q) => q.eq("session_hash", session_hash))
      .unique();
    if (!session || isExpired(session.expires_at, Date.now())) return [];
    return ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("project_id", session.project_id))
      .collect();
  },
});
