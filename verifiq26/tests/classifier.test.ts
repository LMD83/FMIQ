/**
 * VerifIQ — classifier + inference-cache tests.
 *
 * Restores coverage for the 3-source title-block classifier (file 20 §3) and the
 * inference cache (file 20 §2) after a merge clobbered the original Phase-4
 * test file. Exercises all three classifier sources with an injected fake LLM,
 * and the cache's get-or-compute (a hit skips the model).
 *
 * Version: 0.7.0-phase4
 */

import { describe, it, expect } from "vitest";
import { createClassifier, parseFilename, CONFIRM_THRESHOLD } from "../src/classifier/index.js";
import {
  InferenceCache,
  InMemoryInferenceCacheStore,
  buildCacheKey,
} from "../src/llm/cache.js";
import type { LLMClient, LLMResult, LLMRole, CompleteOptions } from "../src/llm/index.js";

class FakeClassifierLLM implements LLMClient {
  async complete(role: LLMRole, _prompt: string, _options?: CompleteOptions): Promise<LLMResult> {
    void role;
    void _prompt;
    void _options;
    return res(
      JSON.stringify({ discipline: "Mechanical", doc_type: "Layout", drawing_number: "M-200" }),
    );
  }
  async completeVision(
    _role: LLMRole,
    _image: Uint8Array,
    _prompt: string,
    _options?: CompleteOptions,
  ): Promise<LLMResult> {
    void _image;
    void _prompt;
    void _options;
    return res(
      JSON.stringify({
        drawing_title: "Ground Floor Plan",
        drawing_number: "A-510",
        revision: "C",
        discipline_code: "A",
        author: "RIAI Practice",
        date: "2026-05-01",
      }),
    );
  }
}

function res(text: string): LLMResult {
  return {
    text,
    tokens_in: 1,
    tokens_out: 1,
    model_used: "fake",
    provider_used: "anthropic",
    cost_eur: 0,
    latency_ms: 1,
  };
}

describe("Title-block classifier", () => {
  it("parses a sensible filename (Source 1)", () => {
    const p = parseFilename("A-100 Rev B.pdf");
    expect(p.discipline).toBe("Architectural");
    expect(p.drawing_number).toBe("A-100");
    expect(p.revision).toBe("B");
  });

  it("classifies from the title block (Source 2) at high confidence", async () => {
    const classifier = createClassifier({ llm: new FakeClassifierLLM() });
    const r = await classifier.classify({
      filename: "IMG_2438.pdf",
      titleBlockImage: new Uint8Array([1, 2, 3]),
    });
    expect(r.source).toBe("title-block");
    expect(r.discipline).toBe("Architectural");
    expect(r.drawing_number).toBe("A-510");
    expect(r.classifier_confidence).toBeGreaterThanOrEqual(CONFIRM_THRESHOLD);
  });

  it("falls back to content (Source 3) then filename", async () => {
    const classifier = createClassifier({ llm: new FakeClassifierLLM() });
    const content = await classifier.classify({
      filename: "Drawing(1).pdf",
      contentText: "HVAC ductwork layout and plant schedule.",
    });
    expect(content.source).toBe("content");
    expect(content.discipline).toBe("Mechanical");

    const noLlm = createClassifier();
    const fn = await noLlm.classify({ filename: "IMG_2438.pdf" });
    expect(fn.source).toBe("filename");
    expect(fn.classifier_confidence).toBeLessThan(CONFIRM_THRESHOLD);
  });
});

describe("InferenceCache", () => {
  const parts = {
    model: "claude-sonnet-4-6",
    prompt_version: "arch-agent-v1.0.0",
    document_sha256: "a".repeat(64),
    agent_id: "architect",
    corpus_version: "irish-corpus-2026-06",
  };

  it("builds a deterministic key that changes with any part", () => {
    const k1 = buildCacheKey(parts);
    expect(buildCacheKey(parts)).toBe(k1);
    expect(buildCacheKey({ ...parts, agent_id: "fire" })).not.toBe(k1);
  });

  it("computes on miss, serves cached on hit", async () => {
    const cache = new InferenceCache(new InMemoryInferenceCacheStore());
    let calls = 0;
    const compute = async () => {
      calls++;
      return { text: "OK", tokens_in: 10, tokens_out: 2 };
    };
    const first = await cache.getOrCompute(parts, compute);
    const second = await cache.getOrCompute(parts, compute);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(calls).toBe(1);
  });
});
