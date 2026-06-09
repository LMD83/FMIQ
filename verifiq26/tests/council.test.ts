/**
 * VerifIQ — council assembly test (Phase 5).
 *
 * Verifies createCouncil wires the full council (five disciplines + challenge +
 * adjudicator + chair) from one LLM client + PromptLoader + persistence, with no
 * LLM calls (construction only).
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import { createCouncil } from "../src/orchestrator/council.js";
import { InMemoryPersistence } from "../src/orchestrator/index.js";
import { PromptLoader, RecordPromptSource } from "../src/agents/index.js";
import type { LLMClient } from "../src/llm/index.js";

const result = {
  text: "",
  tokens_in: 0,
  tokens_out: 0,
  model_used: "x",
  provider_used: "anthropic" as const,
  cost_eur: 0,
  latency_ms: 0,
};
const fakeLLM: LLMClient = {
  complete: async () => result,
  completeVision: async () => result,
};

describe("createCouncil", () => {
  it("assembles the five MVP disciplines plus challenge/adjudicator/chair", () => {
    const deps = createCouncil({
      llm: fakeLLM,
      prompts: new PromptLoader(new RecordPromptSource({})),
      persistence: new InMemoryPersistence(),
    });

    expect(Object.keys(deps.disciplineAgents)).toHaveLength(5);
    expect(deps.challengeAgent).toBeDefined();
    expect(deps.adjudicator).toBeDefined();
    expect(deps.chair).toBeDefined();
    expect(deps.persistence).toBeInstanceOf(InMemoryPersistence);
  });
});
