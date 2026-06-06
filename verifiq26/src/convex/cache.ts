/**
 * VerifIQ — inference cache Convex functions (file 20 §2).
 *
 * The persistent side of `src/llm/cache.ts`: read/write the `inference_cache`
 * table keyed by the deterministic cache key. Entries have a 30-day TTL via
 * `expires_at` (matches inference-log retention); reads past expiry miss.
 *
 * Version: 0.6.0-phase4
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days.

/** Look up a cached inference; returns null on miss or past TTL. */
export const getCachedInference = query({
  args: { cache_key: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const row = await ctx.db
      .query("inference_cache")
      .withIndex("by_cache_key", (q) => q.eq("cache_key", args.cache_key))
      .unique();
    if (!row || row.expires_at <= now) return null;
    return { text: row.result_text, tokens_in: row.tokens_in, tokens_out: row.tokens_out };
  },
});

/** Store an inference result (idempotent on cache_key). */
export const putCachedInference = mutation({
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("inference_cache")
      .withIndex("by_cache_key", (q) => q.eq("cache_key", args.cache_key))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return ctx.db.insert("inference_cache", {
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
      expires_at: now + TTL_MS,
    });
  },
});

/** Purge expired cache rows (called by a scheduled job). */
export const purgeExpired = mutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const expired = await ctx.db
      .query("inference_cache")
      .withIndex("by_expires_at", (q) => q.lte("expires_at", now))
      .collect();
    for (const row of expired) await ctx.db.delete(row._id);
    return { purged: expired.length };
  },
});
