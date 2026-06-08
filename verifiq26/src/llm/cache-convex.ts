/**
 * VerifIQ — Convex-backed CacheStore for the inference cache.
 *
 * Bridges the CachingLLMClient (cache.ts) to the inference_cache Convex
 * functions (src/convex/cache.ts) via an injected runner (action ctx or
 * convex-test handle). The provider is recovered from the model id on read,
 * since the cache row stores the model, not the provider.
 *
 * Version: 0.6.0-phase4
 */

import { internal } from "../convex/_generated/api.js";
import type { CacheStore, CachedInference, CachePutMeta, CacheRunner } from "./cache.js";
import type { ProviderName } from "./types.js";

function providerForModel(model: string): ProviderName {
  return model.toLowerCase().startsWith("claude") ? "anthropic" : "openai";
}

export class ConvexCacheStore implements CacheStore {
  constructor(private readonly run: CacheRunner) {}

  async get(key: string): Promise<CachedInference | null> {
    const row = (await this.run.runQuery(internal.cache.getCached, { cache_key: key })) as {
      result_text: string;
      model: string;
      tokens_in: number;
      tokens_out: number;
    } | null;
    if (!row) return null;
    return {
      text: row.result_text,
      model_used: row.model,
      provider_used: providerForModel(row.model),
      tokens_in: row.tokens_in,
      tokens_out: row.tokens_out,
    };
  }

  async put(key: string, value: CachedInference, meta: CachePutMeta): Promise<void> {
    await this.run.runMutation(internal.cache.putCached, {
      cache_key: key,
      model: meta.model,
      prompt_version: meta.prompt_version,
      document_sha256: meta.document_sha256,
      agent_id: meta.agent_id,
      corpus_version: meta.corpus_version,
      result_text: value.text,
      tokens_in: value.tokens_in,
      tokens_out: value.tokens_out,
    });
  }
}
