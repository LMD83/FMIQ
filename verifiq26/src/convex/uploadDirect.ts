"use node";

/**
 * VerifIQ — direct-upload signed-URL action (docs/42 §5.3 B4, Sprint 2).
 *
 * The single gate between a verified upload session and Cloudflare R2: given a
 * session token + file metadata, it validates the session→project binding
 * (via `uploadTokens.checkUploadSession`) and only then mints a short-lived
 * signed PUT URL through the existing size-aware StorageRouter (`src/storage`).
 * The browser PUTs bytes straight to R2 — they never transit Convex (docs/42 §3).
 *
 * Node action: the R2 presigner (`@aws-sdk/*`) runs in the Node runtime. R2 is
 * configured from env (`R2_*`); with no R2 env the router throws, surfaced as a
 * clean `{ ok: false }` rather than a 500.
 */

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { storageFromEnv } from "../storage";

interface SignedUploadResult {
  ok: boolean;
  uploadUrl?: string;
  key?: string;
  method?: "PUT" | "POST";
  expiresIn?: number;
  error?: "unauthorized" | "storage_unavailable";
}

export const getUploadUrlForSession = action({
  args: {
    sessionToken: v.string(),
    filename: v.string(),
    sha256: v.string(),
    size_bytes: v.number(),
    discipline: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SignedUploadResult> => {
    const session = await ctx.runQuery(api.uploadTokens.checkUploadSession, {
      sessionToken: args.sessionToken,
    });
    if (!session.ok || !session.projectId) return { ok: false, error: "unauthorized" };

    let target;
    try {
      const storage = storageFromEnv(process.env);
      target = await storage.getUploadUrl({
        project_id: session.projectId,
        discipline: args.discipline ?? "unclassified",
        filename: args.filename,
        sha256: args.sha256,
        size_bytes: args.size_bytes,
      });
    } catch {
      return { ok: false, error: "storage_unavailable" };
    }

    return {
      ok: true,
      uploadUrl: target.url,
      key: target.key,
      method: target.method,
      expiresIn: target.expires_in,
    };
  },
});
