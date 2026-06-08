/**
 * VerifIQ — Phase 4 (remainder) test: the Convex PersistencePort bridge.
 *
 * Proves the record↔array `workflow_state` mapping round-trips, and that the
 * real Phase 3 orchestrator runs end-to-end against `ConvexPersistence` backed
 * by the in-memory `ConvexBackend` — i.e. the Convex binding is wired correctly
 * without needing a deployment.
 *
 * Version: 0.7.0-phase4
 */

import { describe, it, expect } from "vitest";
import {
  ConvexPersistence,
  InMemoryConvexBackend,
  toStored,
  fromStored,
} from "../src/orchestrator/convex-persistence.js";
import type { WorkflowState } from "../src/orchestrator/index.js";
import { createOrchestrator } from "../src/orchestrator/index.js";
import {
  DisciplineAgent,
  PromptLoader,
  MVP_DISCIPLINES,
  createChairAgent,
  createPeerChallengeAgent,
  createAdjudicatorAgent,
} from "../src/agents/index.js";
import type { LLMClient, LLMResult, LLMRole, CompleteOptions } from "../src/llm/index.js";

// ── state mapping ────────────────────────────────────────────────────────────

describe("workflow_state mapping", () => {
  it("round-trips discipline_status (Record ↔ array)", () => {
    const state: WorkflowState = {
      project_id: "p1",
      scan_state: "adjudicate",
      completed_stages: ["review", "peer_challenge"],
      discipline_status: { architect: "succeeded", fire: "failed" },
      updated_at: 123,
    };
    const restored = fromStored(toStored(state));
    expect(restored).toEqual(state);
    expect(toStored(state).discipline_status).toContainEqual({
      discipline: "fire",
      status: "failed",
    });
  });
});

// ── orchestrator over ConvexPersistence ──────────────────────────────────────

const QUOTE = "Clause 4.2 completion date to be confirmed";

class FakeLLM implements LLMClient {
  async complete(role: LLMRole, prompt: string, _o?: CompleteOptions): Promise<LLMResult> {
    void _o;
    return res(this.reply(role, prompt));
  }
  async completeVision(): Promise<LLMResult> {
    throw new Error("unused");
  }
  private reply(role: LLMRole, prompt: string): string {
    if (role === "discipline-primary-review") {
      const disc = prompt.match(/reviewing as the (.+?) discipline/)?.[1] ?? "Architect";
      return JSON.stringify([
        {
          discipline_origin: disc,
          interface_disciplines: [],
          stage: "pre-tender",
          source_document: "Spec.pdf",
          source_reference: QUOTE,
          related_documents: [],
          requirement: "Form of Tender must state the completion date.",
          finding: "The completion date in the Form of Tender is left blank and must be confirmed.",
          status: "Not demonstrated",
          risk: "High",
          build_readiness_impact: "Pre-tender close-out",
          required_evidence: ["Completed Form of Tender Schedule"],
          owner: "Lead Designer",
        },
      ]);
    }
    if (role === "council-chair") {
      return JSON.stringify({ council_summary: "Summary.", final_recommendation: "Proceed with conditions." });
    }
    return "[]";
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

describe("Orchestrator over ConvexPersistence", () => {
  it("runs the pipeline and persists state + report through the bridge", async () => {
    const prompts = new PromptLoader();
    const llm = new FakeLLM();
    const backend = new InMemoryConvexBackend();
    const persistence = new ConvexPersistence(backend);

    const orchestrator = createOrchestrator({
      disciplineAgents: {
        architect: new DisciplineAgent(MVP_DISCIPLINES.architect!, { llm, prompts }),
      },
      challengeAgent: createPeerChallengeAgent({ llm, prompts }),
      adjudicator: createAdjudicatorAgent({ llm, prompts }),
      chair: createChairAgent({ llm, prompts }),
      persistence,
    });

    const { report } = await orchestrator.run({
      projectId: "proj-9",
      projectName: "Clinic",
      projectStage: "pre-tender",
      buildingType: "Healthcare",
      reviewDate: "2026-06-06",
      documentsByDiscipline: {
        architect: [{ filename: "Spec.pdf", text: `Spec. ${QUOTE}.` }],
      },
    });

    expect(report.executive_decision).toBe("Proceed with conditions");

    // The report and resumable state were persisted through the Convex bridge.
    expect(await persistence.loadReport("proj-9")).not.toBeNull();
    const state = await persistence.loadState("proj-9");
    expect(state?.scan_state).toBe("released");
    expect(state?.discipline_status.architect).toBe("succeeded");
    expect(state?.completed_stages).toContain("report");
  });
});
