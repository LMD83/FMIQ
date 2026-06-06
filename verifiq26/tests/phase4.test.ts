/**
 * VerifIQ — Phase 4 tests: title-block classifier + inference cache.
 *
 * The classifier is exercised across all three sources (title-block vision,
 * content, filename) with an injected fake LLM; the cache proves get-or-compute
 * keying (a hit skips the compute). No network / keys / deployment.
 *
 * Version: 0.6.0-phase4
 */

import { describe, it, expect } from "vitest";
import { createClassifier, parseFilename, CONFIRM_THRESHOLD } from "../src/classifier/index.js";
import {
  InferenceCache,
  InMemoryInferenceCacheStore,
  buildCacheKey,
} from "../src/llm/cache.js";
import type { LLMClient, LLMResult, LLMRole, CompleteOptions } from "../src/llm/index.js";

// ── fake LLM ─────────────────────────────────────────────────────────────────

class FakeClassifierLLM implements LLMClient {
  async complete(role: LLMRole, _prompt: string, _options?: CompleteOptions): Promise<LLMResult> {
    void role;
    void _prompt;
    void _options;
    return result(JSON.stringify({ discipline: "Mechanical", doc_type: "Layout", drawing_number: "M-200" }));
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
    return result(
      JSON.stringify({
        drawing_title: "Ground Floor Plan",
        drawing_number: "A-510",
        revision: "C",
        discipline_code: "A",
        author: "RIAI Practice",
        date: "2026-05-01",
        scale: "1:100",
      }),
    );
  }
}

function result(text: string): LLMResult {
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

// ── classifier ───────────────────────────────────────────────────────────────

describe("Title-block classifier", () => {
  it("parses a sensible filename (Source 1)", () => {
    const p = parseFilename("A-100 Rev B.pdf");
    expect(p.discipline).toBe("Architectural");
    expect(p.drawing_number).toBe("A-100");
    expect(p.revision).toBe("B");
    expect(p.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("classifies from the title block (Source 2) at high confidence", async () => {
    const classifier = createClassifier({ llm: new FakeClassifierLLM() });
    const res = await classifier.classify({
      filename: "IMG_2438.pdf",
      titleBlockImage: new Uint8Array([1, 2, 3]),
    });
    expect(res.source).toBe("title-block");
    expect(res.discipline).toBe("Architectural");
    expect(res.drawing_number).toBe("A-510");
    expect(res.revision).toBe("C");
    expect(res.doc_type).toBe("Plan");
    expect(res.classifier_confidence).toBeGreaterThanOrEqual(CONFIRM_THRESHOLD);
  });

  it("falls back to content classification (Source 3)", async () => {
    const classifier = createClassifier({ llm: new FakeClassifierLLM() });
    const res = await classifier.classify({
      filename: "Drawing(1).pdf",
      contentText: "HVAC ductwork layout and plant schedule.",
    });
    expect(res.source).toBe("content");
    expect(res.discipline).toBe("Mechanical");
    expect(res.classifier_confidence).toBeCloseTo(0.6);
  });

  it("falls back to the filename with low confidence (needs confirmation)", async () => {
    const classifier = createClassifier(); // no LLM
    const res = await classifier.classify({ filename: "IMG_2438.pdf" });
    expect(res.source).toBe("filename");
    expect(res.discipline).toBe("Unclassified");
    expect(res.classifier_confidence).toBeLessThan(CONFIRM_THRESHOLD);
  });
});

// ── inference cache ──────────────────────────────────────────────────────────

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

  it("computes on miss and serves cached on hit", async () => {
    const store = new InMemoryInferenceCacheStore();
    const cache = new InferenceCache(store);
    let computeCalls = 0;
    const compute = async () => {
      computeCalls++;
      return { text: "OK", tokens_in: 10, tokens_out: 2 };
    };

    const first = await cache.getOrCompute(parts, compute);
    expect(first.cached).toBe(false);
    expect(first.text).toBe("OK");

    const second = await cache.getOrCompute(parts, compute);
    expect(second.cached).toBe(true);
    expect(second.text).toBe("OK");

    expect(computeCalls).toBe(1); // model not re-invoked on hit
    expect(store.size).toBe(1);
  });
});
