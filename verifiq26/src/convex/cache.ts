/**
 * VerifIQ — inference_cache Convex functions (file 20 §2).
 *
 * Persistent backing for the LLM inference cache: idempotent put (keyed by the
 * file-20 cache key), TTL-gated get (30-day retention), and an expiry purge for
 * the scheduled cron. On a cache hit the agent skips the model call entirely.
 *
 * SECURITY: these are `internal*` — callable only from trusted server actions
 * (the orchestrator / agent runner), never from a browser client. A public
 * writer would let anyone forge `result_text` for a known cache key and have
 * later scans consume the poisoned completion (CachingLLMClient serves hits
 * without re-validation). The key is content-addressed (document_sha256), so
 * cross-tenant reuse of identical inputs is intentional and safe.
 *
 * Version: 0.7.0-phase4
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Read a cached completion by key, or null if absent/expired. */
export const getCached = internalQuery({
  args: { cache_key: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const row = await ctx.db
      .query("inference_cache")
      .withIndex("by_cache_key", (q) => q.eq("cache_key", args.cache_key))
      .unique();
    if (!row || row.expires_at <= now) return null;
    return row;
  },
});

/** Insert/refresh a cached completion (TTL 30 days). */
export const putCached = internalMutation({
  args: {
    cache_key: v.string(),
    model: v.string(),
    prompt_version: v.string(),
    document_sha256: v.string(),
    agent_id: v.string(),
    corpus_version: v.string(),
    result_text: v.string(),
    tokens_in: v.number(),
    tokens_out: v.number(),
    ttl_ms: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expires_at = now + (args.ttl_ms ?? THIRTY_DAYS_MS);
    const existing = await ctx.db
      .query("inference_cache")
      .withIndex("by_cache_key", (q) => q.eq("cache_key", args.cache_key))
      .unique();
    const row = {
      cache_key: args.cache_key,
      model: args.model,
      prompt_version: args.prompt_version,
      document_sha256: args.document_sha256,
      agent_id: args.agent_id,
      corpus_version: args.corpus_version,
      result_text: args.result_text,
      tokens_in: args.tokens_in,
      tokens_out: args.tokens_out,
      created_at: now,
      expires_at,
    };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("inference_cache", row);
  },
});

/** Delete expired cache rows (scheduled cron). Returns the number purged. */
export const purgeExpired = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const expired = await ctx.db
      .query("inference_cache")
      .withIndex("by_expires_at", (q) => q.lt("expires_at", now))
      .collect();
    for (const row of expired) await ctx.db.delete(row._id);
    return expired.length;
  },
});
