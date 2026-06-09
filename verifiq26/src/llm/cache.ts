/**
 * VerifIQ — inference cache (file 20 §2 idempotency).
 *
 * Wraps an LLMClient so identical calls return a cached completion instead of
 * re-invoking the model. The cache key is the file-20 formula
 *   hash(model + prompt_version + document_sha256 + agent_id + corpus_version)
 * where document_sha256 is derived from the prompt. On a hit the call costs ~0
 * and returns in milliseconds (file 20).
 *
 * The store is injected (CacheStore) — `ConvexCacheStore` persists to the
 * `inference_cache` table; tests use an in-memory map.
 *
 * Version: 0.6.0-phase4
 */

import type { FunctionReference } from "convex/server";
import type {
  CompleteOptions,
  LLMResult,
  LLMRole,
  ProviderName,
} from "./types.js";
import type { LLMClient } from "./index.js";
import { sha256Hex } from "./util.js";

export interface CacheKeyParts {
  model: string;
  prompt_version: string;
  document_sha256: string;
  agent_id: string;
  corpus_version: string;
  /** Tenant/project scope — isolates the cache per project to stop
   * cross-tenant cache poisoning/sharing (PR #7 security review). */
  project_id: string;
}

/** The file-20 cache key, scoped by project_id. */
export function cacheKey(p: CacheKeyParts): string {
  return [
    p.project_id,
    p.model,
    p.prompt_version,
    p.document_sha256,
    p.agent_id,
    p.corpus_version,
  ].join("|");
}

export interface CachedInference {
  text: string;
  model_used: string;
  provider_used: ProviderName;
  tokens_in: number;
  tokens_out: number;
}

export interface CachePutMeta extends CacheKeyParts {
  tokens_in: number;
  tokens_out: number;
}

export interface CacheStore {
  get(key: string): Promise<CachedInference | null>;
  put(key: string, value: CachedInference, meta: CachePutMeta): Promise<void>;
}

/** Simple in-memory CacheStore (tests / single-process). */
export class MemoryCacheStore implements CacheStore {
  private map = new Map<string, CachedInference>();
  async get(key: string): Promise<CachedInference | null> {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: CachedInference): Promise<void> {
    this.map.set(key, value);
  }
}

/** LLMClient decorator that consults the cache before calling the inner client. */
export class CachingLLMClient implements LLMClient {
  /**
   * @param scope per-scan scope; `projectId` keys the cache to one project so
   *   entries can't be shared/poisoned across tenants.
   */
  constructor(
    private readonly inner: LLMClient,
    private readonly store: CacheStore,
    private readonly scope: { projectId?: string } = {},
  ) {}

  async complete(role: LLMRole, prompt: string, options: CompleteOptions = {}): Promise<LLMResult> {
    const documentSha = await sha256Hex(prompt);
    const parts: CacheKeyParts = {
      model: role,
      prompt_version: options.promptVersion ?? "",
      document_sha256: documentSha,
      agent_id: options.agentId ?? "",
      corpus_version: options.corpusVersion ?? "",
      project_id: this.scope.projectId ?? "",
    };
    const key = cacheKey(parts);

    const hit = await this.store.get(key);
    if (hit) {
      return { ...hit, cost_eur: 0, latency_ms: 0 };
    }

    const result = await this.inner.complete(role, prompt, options);
    await this.store.put(
      key,
      {
        text: result.text,
        model_used: result.model_used,
        provider_used: result.provider_used,
        tokens_in: result.tokens_in,
        tokens_out: result.tokens_out,
      },
      { ...parts, model: result.model_used, tokens_in: result.tokens_in, tokens_out: result.tokens_out },
    );
    return result;
  }

  // Vision calls are not cached in Phase 4.
  completeVision(
    role: LLMRole,
    imageBuffer: Uint8Array,
    prompt: string,
    options?: CompleteOptions,
  ): Promise<LLMResult> {
    return this.inner.completeVision(role, imageBuffer, prompt, options);
  }
}

/** Loosely-typed Convex caller (action ctx or convex-test handle). */
export interface CacheRunner {
  runQuery(
    ref: FunctionReference<"query", "public" | "internal">,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  runMutation(
    ref: FunctionReference<"mutation", "public" | "internal">,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}
