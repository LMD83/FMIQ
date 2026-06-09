/**
 * VerifIQ — inference cache (file 20 §2 idempotency).
 *
 * Every LLM call is keyed by a deterministic hash of
 *   model + prompt_version + document_sha256 + agent_id + corpus_version.
 * On a cache hit the model is not re-invoked — making job retries cheap and
 * scans reproducible. The store is a port (in-memory here, Convex
 * `inference_cache` table in production), so this is unit-testable.
 *
 * (Restored after a merge wiped this file to 0 bytes.)
 * Version: 0.7.0-phase4
 */

import { createHash } from "node:crypto";

export interface InferenceCacheKeyParts {
  model: string;
  prompt_version: string;
  document_sha256: string;
  agent_id: string;
  corpus_version: string;
}

/** Deterministic cache key (file 20 §2). */
export function buildCacheKey(parts: InferenceCacheKeyParts): string {
  return createHash("sha256")
    .update(
      [
        parts.model,
        parts.prompt_version,
        parts.document_sha256,
        parts.agent_id,
        parts.corpus_version,
      ].join(" "),
    )
    .digest("hex");
}

export interface CacheEntry {
  cache_key: string;
  text: string;
  tokens_in: number;
  tokens_out: number;
}

/** Persistence port for cached inferences. */
export interface InferenceCacheStore {
  get(cacheKey: string): Promise<CacheEntry | null>;
  put(entry: CacheEntry): Promise<void>;
}

export interface ComputedInference {
  text: string;
  tokens_in: number;
  tokens_out: number;
}

export interface CachedInference extends ComputedInference {
  cached: boolean;
}

/** Wraps a store with get-or-compute semantics keyed by the file-20 parts. */
export class InferenceCache {
  constructor(private readonly store: InferenceCacheStore) {}

  async getOrCompute(
    parts: InferenceCacheKeyParts,
    compute: () => Promise<ComputedInference>,
  ): Promise<CachedInference> {
    const cacheKey = buildCacheKey(parts);
    const hit = await this.store.get(cacheKey);
    if (hit) {
      return { text: hit.text, tokens_in: hit.tokens_in, tokens_out: hit.tokens_out, cached: true };
    }
    const result = await compute();
    await this.store.put({ cache_key: cacheKey, ...result });
    return { ...result, cached: false };
  }
}

/** In-memory store (tests + reference implementation). */
export class InMemoryInferenceCacheStore implements InferenceCacheStore {
  private map = new Map<string, CacheEntry>();

  async get(cacheKey: string): Promise<CacheEntry | null> {
    return this.map.get(cacheKey) ?? null;
  }
  async put(entry: CacheEntry): Promise<void> {
    this.map.set(entry.cache_key, entry);
  }
  get size(): number {
    return this.map.size;
  }
}
