/**
 * VerifIQ — magic-code intake + upload-session functions (docs/42, Sprint 1).
 *
 * The server side of the "advanced magic code" handoff that replaces the old
 * `mailto:` concierge intake:
 *
 *   createIntake (internal)   — find/create user, create project (pending),
 *                               issue a hashed link+code token, audit. Returns
 *                               the RAW secrets to the calling action ONLY so it
 *                               can build the email; they are never persisted raw
 *                               nor returned over HTTP.
 *   verifyUploadCode (public) — verify a link token or short code, mint a
 *                               project-scoped upload session, audit.
 *   checkUploadSession (public) — validate a session token → project id. The
 *                               upload UI calls this before requesting signed URLs.
 *   revokeUploadToken (internal) — kill a token (abuse / admin).
 *
 * Secrets are only ever compared by hash (src/auth/magic-code.ts), so a wrong
 * guess matches nothing — there is no enumeration oracle (docs/42 §5.4 N1).
 * Real per-IP / per-email rate limiting lives at the HTTP boundary (http.ts).
 */

import { mutation, internalMutation, internalAction, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { sendUploadLinkEmail } from "./email";
import {
  DEFAULT_TTL_MS,
  SESSION_TTL_MS,
  MAX_VERIFY_ATTEMPTS,
  generateLinkToken,
  generateSessionToken,
  generateShortCode,
  hashSecret,
  isExpired,
  normalizeEmail,
  normalizeShortCode,
} from "../auth/magic-code";

/**
 * Server-side pepper for code hashing. MUST be set in any deployed environment
 * (docs/42 §5.4 N1); the dev fallback keeps offline tests + `convex dev`
 * working but is unsafe for production.
 */
function pepper(): string {
  return process.env.UPLOAD_TOKEN_PEPPER ?? "verifiq-dev-pepper-unsafe";
}

const PURPOSE = v.union(v.literal("first_read"), v.literal("pilot_upload"));

/**
 * Create the project + issue a magic code for a website intake. Internal: only
 * the `submitIntake` action (which also sends the email) may call it.
 */
export const createIntake = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    project_name: v.string(),
    building_type: v.optional(v.string()),
    purpose: v.optional(PURPOSE),
    ttl_ms: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const now = Date.now();

    // Find or create the customer (data-minimised stub identity; Convex Auth
    // attaches the real subject when the code is verified — docs/42 §3).
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    const userId =
      existing?._id ??
      (await ctx.db.insert("users", {
        email,
        name: args.name,
        role: "customer",
        is_stub: true,
        created_at: now,
      }));

    const projectId = await ctx.db.insert("projects", {
      owner_user_id: userId,
      name: args.project_name,
      building_type: args.building_type,
      scan_state: "pending",
      created_at: now,
      updated_at: now,
    });

    // Generate both secrets; persist only their salted hashes.
    const linkToken = generateLinkToken();
    const shortCode = generateShortCode();
    const p = pepper();
    const link_hash = await hashSecret(linkToken, p);
    const short_code_hash = await hashSecret(normalizeShortCode(shortCode), p);
    const expires_at = now + (args.ttl_ms ?? DEFAULT_TTL_MS);

    const tokenId = await ctx.db.insert("upload_tokens", {
      project_id: projectId,
      email,
      link_hash,
      short_code_hash,
      purpose: args.purpose ?? "first_read",
      status: "issued",
      attempts: 0,
      expires_at,
      created_at: now,
    });

    await ctx.db.insert("audit_log", {
      project_id: projectId,
      actor: "system",
      action: "upload_code_issued",
      target_type: "upload_token",
      target_id: tokenId,
      payload_json: JSON.stringify({ email, purpose: args.purpose ?? "first_read", expires_at }),
      occurred_at: now,
    });

    // Raw secrets returned to the action ONLY (to build the email). Callers must
    // never surface these over HTTP.
    return { projectId, tokenId, linkToken, shortCode, expiresAt: expires_at };
  },
});

type VerifyResult =
  | { ok: true; projectId: string; sessionToken: string; sessionExpiresAt: number }
  | { ok: false; error: "invalid" | "used" | "expired" | "revoked" | "locked" };

/**
 * Verify a secret (link token or short code) and mint an upload session.
 * Never reveals whether an email/project exists — an unmatched secret is just
 * `invalid` (docs/42 §5.4 N1).
 */
export const verifyUploadCode = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<VerifyResult> => {
    const raw = args.secret.trim();
    if (!raw) return { ok: false, error: "invalid" };

    const p = pepper();
    // A link token is exact hex; a short code is normalised. Try both forms.
    const linkHash = await hashSecret(raw, p);
    const codeHash = await hashSecret(normalizeShortCode(raw), p);

    const token =
      (await ctx.db
        .query("upload_tokens")
        .withIndex("by_link_hash", (q) => q.eq("link_hash", linkHash))
        .unique()) ??
      (await ctx.db
        .query("upload_tokens")
        .withIndex("by_short_code_hash", (q) => q.eq("short_code_hash", codeHash))
        .unique());

    if (!token) return { ok: false, error: "invalid" };

    const now = Date.now();

    if (token.status === "used") {
      // Replay of a spent code — count it; revoke past the ceiling.
      const attempts = token.attempts + 1;
      await ctx.db.patch(token._id, {
        attempts,
        status: attempts >= MAX_VERIFY_ATTEMPTS ? "revoked" : token.status,
      });
      return { ok: false, error: attempts >= MAX_VERIFY_ATTEMPTS ? "locked" : "used" };
    }
    if (token.status === "revoked") return { ok: false, error: "revoked" };
    if (token.status === "expired" || isExpired(token.expires_at, now)) {
      if (token.status !== "expired") await ctx.db.patch(token._id, { status: "expired" });
      return { ok: false, error: "expired" };
    }

    // Success — spend the token and mint a project-scoped session.
    await ctx.db.patch(token._id, { status: "used", used_at: now });

    const sessionToken = generateSessionToken();
    const session_hash = await hashSecret(sessionToken, p);
    const sessionExpiresAt = now + SESSION_TTL_MS;
    await ctx.db.insert("upload_sessions", {
      project_id: token.project_id,
      token_id: token._id,
      session_hash,
      expires_at: sessionExpiresAt,
      created_at: now,
    });

    await ctx.db.insert("audit_log", {
      project_id: token.project_id,
      actor: "customer",
      action: "upload_code_verified",
      target_type: "upload_token",
      target_id: token._id,
      payload_json: JSON.stringify({ sessionExpiresAt }),
      occurred_at: now,
    });

    return {
      ok: true,
      projectId: token.project_id,
      sessionToken,
      sessionExpiresAt,
    };
  },
});

/**
 * Resolve a session token to its project, or null if missing/expired. The
 * upload UI calls this before asking for signed URLs (docs/42 §5.3 B4).
 */
export const checkUploadSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; projectId?: string }> => {
    const raw = args.sessionToken.trim();
    if (!raw) return { ok: false };
    const session_hash = await hashSecret(raw, pepper());
    const session = await ctx.db
      .query("upload_sessions")
      .withIndex("by_session_hash", (q) => q.eq("session_hash", session_hash))
      .unique();
    if (!session || isExpired(session.expires_at, Date.now())) return { ok: false };
    return { ok: true, projectId: session.project_id };
  },
});

/** Revoke a token (abuse handling / admin). Internal only. */
export const revokeUploadToken = internalMutation({
  args: { token_id: v.id("upload_tokens") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.token_id, { status: "revoked" });
  },
});

/**
 * Orchestrate a website intake: create the project + magic code (mutation),
 * then email the link (Resend). Internal — the public entry is the `/intake`
 * httpAction (http.ts), which adds CORS + rate limiting. The raw code never
 * leaves this action except inside the email; the HTTP response only ever sees
 * `{ ok, projectId, emailed }`.
 */
export const submitIntake = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    project_name: v.string(),
    building_type: v.optional(v.string()),
    purpose: v.optional(PURPOSE),
  },
  handler: async (ctx, args): Promise<{ projectId: string; emailed: boolean }> => {
    const issued = await ctx.runMutation(internal.uploadTokens.createIntake, {
      name: args.name,
      email: args.email,
      project_name: args.project_name,
      building_type: args.building_type,
      purpose: args.purpose,
    });

    const base = process.env.APP_BASE_URL ?? "https://app.verifiq.ie";
    const link = `${base}/upload?code=${issued.linkToken}`;
    const { sent } = await sendUploadLinkEmail({
      to: normalizeEmail(args.email),
      name: args.name,
      projectName: args.project_name,
      link,
      code: issued.shortCode,
    });

    return { projectId: issued.projectId, emailed: sent };
  },
});
