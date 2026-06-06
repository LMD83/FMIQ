/**
 * VerifIQ — Phase 3 tests: job queue, council engines, and the orchestrator.
 *
 * Exercises the resumable workflow end-to-end with injected fake LLM providers
 * (no network/keys), proving: the DAG runs review → peer challenge → adjudicate
 * → chair; per-discipline isolation (one discipline failing still yields a
 * report from the survivors); resumability (a second run is idempotent); plus
 * the queue's dependency ordering / retry-backoff / isolation and the
 * adjudicator's deterministic file-06 rules.
 *
 * Version: 0.5.0-phase3
 */

import { describe, it, expect } from "vitest";
import {
  createOrchestrator,
  InMemoryJobQueue,
  InMemoryPersistence,
} from "../src/orchestrator/index.js";
import {
  DisciplineAgent,
  PromptLoader,
  MVP_DISCIPLINES,
  createChairAgent,
  createPeerChallengeAgent,
  createAdjudicatorAgent,
  AdjudicatorAgent,
} from "../src/agents/index.js";
import {
  RetryableLLMError,
  type LLMClient,
  type LLMResult,
  type LLMRole,
  type CompleteOptions,
} from "../src/llm/index.js";
import { LOCKED_DISCLAIMER } from "../src/constants.js";
import type { ChallengeRecord } from "../src/agents/challenge.js";
import type { Finding } from "../src/types/index.js";

// ── fakes ──────────────────────────────────────────────────────────────────

const QUOTE = (disc: string) => `Clause 4.2 (${disc}) completion date to be confirmed`;

function reviewFinding(disc: string): unknown {
  return {
    discipline_origin: disc,
    interface_disciplines: [],
    stage: "pre-tender",
    project_area: "Block A",
    location: "Ground floor",
    source_document: "Spec.pdf",
    source_reference: QUOTE(disc),
    related_documents: [],
    requirement: `${disc}: Form of Tender must state the completion date.`,
    finding:
      "The completion date in the Form of Tender is left blank and must be confirmed before tender.",
    status: "Not demonstrated",
    risk: "High",
    build_readiness_impact: "Pre-tender close-out",
    question: "What is the completion date?",
    required_evidence: ["Completed Form of Tender Schedule Part 1"],
    owner: "Lead Designer",
    secondary_owner: "",
    close_out_stage: "pre-tender",
  };
}

class FakeLLM implements LLMClient {
  calls = 0;
  constructor(private readonly mode: "ok" | "throw" = "ok") {}

  async complete(role: LLMRole, prompt: string, _options?: CompleteOptions): Promise<LLMResult> {
    void _options;
    this.calls++;
    if (this.mode === "throw") throw new RetryableLLMError("forced failure", "anthropic");
    return {
      text: this.replyFor(role, prompt),
      tokens_in: 1,
      tokens_out: 1,
      model_used: "fake-model",
      provider_used: "anthropic",
      cost_eur: 0,
      latency_ms: 1,
    };
  }

  async completeVision(
    _role: LLMRole,
    _image: Uint8Array,
    _prompt: string,
    _options?: CompleteOptions,
  ): Promise<LLMResult> {
    throw new Error("not used");
  }

  private replyFor(role: string, prompt: string): string {
    if (role === "discipline-primary-review") {
      const disc = prompt.match(/reviewing as the (.+?) discipline/)?.[1] ?? "Architect";
      return JSON.stringify([reviewFinding(disc)]);
    }
    if (role === "peer-challenge") {
      const ids = [...prompt.matchAll(/"issue_id":\s*"([^"]+)"/g)].map((m) => m[1]);
      return JSON.stringify(
        ids.map((id) => ({
          issue_id: id,
          decision: "Retained",
          reason: "valid",
          interface_discipline: "Fire Safety",
        })),
      );
    }
    if (role === "adjudicator") return "ack";
    if (role === "council-chair") {
      return JSON.stringify({
        council_summary: "Sober summary.",
        final_recommendation: "Proceed with conditions.",
      });
    }
    return "[]";
  }
}

function makeOrchestrator(opts: { failFire?: boolean } = {}) {
  const prompts = new PromptLoader();
  const goodLLM = new FakeLLM("ok");
  const fireLLM = opts.failFire ? new FakeLLM("throw") : goodLLM;

  const disciplineAgents: Record<string, DisciplineAgent> = {
    architect: new DisciplineAgent(MVP_DISCIPLINES.architect!, { llm: goodLLM, prompts }),
    fire: new DisciplineAgent(MVP_DISCIPLINES.fire!, { llm: fireLLM, prompts }),
  };
  const persistence = new InMemoryPersistence();
  const orchestrator = createOrchestrator({
    disciplineAgents,
    challengeAgent: createPeerChallengeAgent({ llm: goodLLM, prompts }),
    adjudicator: createAdjudicatorAgent({ llm: goodLLM, prompts }),
    chair: createChairAgent({ llm: goodLLM, prompts }),
    persistence,
  });
  return { orchestrator, persistence, goodLLM };
}

const runInput = {
  projectId: "proj-1",
  projectName: "Adult Day Centre",
  projectStage: "pre-tender" as const,
  buildingType: "Healthcare",
  reviewDate: "2026-06-06",
  modulesActivated: ["Building Regulations", "DAC / Part M"],
  corpusVersion: "irish-corpus-2026-06",
  reviewerInitials: "L.D.",
  documentsByDiscipline: {
    architect: [{ filename: "Spec.pdf", text: `Architectural spec. ${QUOTE("Architect")}.` }],
    fire: [{ filename: "Fire.pdf", text: `Fire strategy. ${QUOTE("Fire Safety")}.` }],
  },
};

// ── end-to-end ───────────────────────────────────────────────────────────────

describe("Orchestrator — end to end", () => {
  it("runs review → challenge → adjudicate → chair and releases a report", async () => {
    const { orchestrator, persistence } = makeOrchestrator();
    const { report, jobs, state } = await orchestrator.run(runInput);

    // file 06 invariant: Amber ↔ Proceed with conditions (High, no Critical).
    expect(report.build_readiness_rating).toBe("Amber");
    expect(report.executive_decision).toBe("Proceed with conditions");
    expect(report.disclaimer).toContain("software-based reading aid");
    expect(report.disclaimer).toBe(LOCKED_DISCLAIMER);

    expect(jobs.succeeded).toEqual(
      expect.arrayContaining([
        "review:architect",
        "review:fire",
        "peer_challenge",
        "adjudicate",
        "report",
      ]),
    );
    expect(jobs.failed).toHaveLength(0);
    expect(state.scan_state).toBe("released");

    // Two disciplines surfaced one finding each; both survive adjudication.
    expect(persistence.adjudicationsFor("proj-1")).toHaveLength(2);

    const actions = persistence.auditFor("proj-1").map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "self_check",
        "discipline_review_completed",
        "peer_challenge",
        "adjudication",
        "report_released",
      ]),
    );
  });

  it("isolates a failed discipline and still reports from the survivors", async () => {
    const { orchestrator, persistence } = makeOrchestrator({ failFire: true });
    const { report } = await orchestrator.run(runInput);

    expect(report.build_readiness_rating).toBe("Amber"); // architect's High remains
    expect(report.disciplines_reviewed).toEqual(["Architect"]);

    const audit = persistence.auditFor("proj-1");
    expect(
      audit.some((a) => a.action === "discipline_review_failed" && a.discipline === "fire"),
    ).toBe(true);
    expect(audit.some((a) => a.action === "report_released")).toBe(true);
  });

  it("is resumable: a second run is idempotent and re-emits nothing", async () => {
    const { orchestrator, goodLLM } = makeOrchestrator();
    await orchestrator.run(runInput);
    const callsAfterFirst = goodLLM.calls;

    const second = await orchestrator.run(runInput);
    expect(second.report.executive_decision).toBe("Proceed with conditions");
    expect(goodLLM.calls).toBe(callsAfterFirst); // no agent re-invocation on resume
  });
});

// ── job queue ────────────────────────────────────────────────────────────────

describe("InMemoryJobQueue", () => {
  it("runs jobs in dependency order", async () => {
    const q = new InMemoryJobQueue();
    const order: string[] = [];
    q.registerHandler("t", async (job) => {
      order.push(job.id);
    });
    q.enqueue({ id: "a", type: "t" });
    q.enqueue({ id: "b", type: "t", dependsOn: ["a"] });
    q.enqueue({ id: "c", type: "t", dependsOn: ["b"] });

    const summary = await q.runToCompletion();
    expect(summary.succeeded).toEqual(["a", "b", "c"]);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("is idempotent on the idempotency key", async () => {
    const q = new InMemoryJobQueue();
    q.registerHandler("t", async () => {});
    const id1 = q.enqueue({ id: "x", type: "t" });
    const id2 = q.enqueue({ id: "x", type: "t" });
    expect(id1).toBe(id2);
    expect(q.list()).toHaveLength(1);
  });

  it("retries with backoff then succeeds", async () => {
    const q = new InMemoryJobQueue();
    let attempts = 0;
    q.registerHandler("t", async () => {
      attempts++;
      if (attempts < 3) throw new Error("transient");
    });
    q.enqueue({ id: "a", type: "t", maxAttempts: 3 });
    const summary = await q.runToCompletion();
    expect(summary.succeeded).toEqual(["a"]);
    expect(q.get("a")?.attempts).toBe(3);
  });

  it("isolates a failed dependency: dependents block, siblings still run", async () => {
    const q = new InMemoryJobQueue();
    q.registerHandler("fail", async () => {
      throw new Error("boom");
    });
    q.registerHandler("ok", async () => {});
    q.enqueue({ id: "a", type: "fail", maxAttempts: 1 });
    q.enqueue({ id: "b", type: "ok", dependsOn: ["a"] });
    q.enqueue({ id: "c", type: "ok" }); // independent tree

    const summary = await q.runToCompletion();
    expect(summary.failed).toContain("a");
    expect(summary.blocked).toContain("b");
    expect(summary.succeeded).toContain("c");
  });
});

// ── adjudicator rules ─────────────────────────────────────────────────────────

function finding(partial: Partial<Finding> & Pick<Finding, "issue_id">): Finding {
  return {
    discipline_origin: "Architect",
    interface_disciplines: [],
    stage: "pre-tender",
    source_document: "Spec.pdf",
    source_reference: "Clause 4.2",
    related_documents: [],
    requirement: "Requirement text.",
    finding: "A finding long enough to clear the consequence check easily.",
    status: "Not demonstrated",
    risk: "Medium",
    build_readiness_impact: "Pre-tender close-out",
    required_evidence: ["Evidence"],
    owner: "Lead Designer",
    ...partial,
  };
}

describe("AdjudicatorAgent — file 06 rules", () => {
  it("deletes ownerless findings, merges duplicates, applies peer escalation", async () => {
    const adj = new AdjudicatorAgent(); // code-rules only
    const findings: Finding[] = [
      finding({ issue_id: "A-1" }),
      finding({ issue_id: "A-2", owner: "team" }), // generic owner → Deleted
      finding({ issue_id: "A-3" }), // duplicate of A-1 (same requirement + source_reference)
      finding({ issue_id: "A-4", requirement: "Different requirement.", risk: "Medium" }),
    ];
    const challenges: ChallengeRecord[] = [
      {
        issue_id: "A-4",
        challenger_discipline: "Fire Safety",
        decision: "Escalated",
        reason: "life safety",
        revised_risk: "Critical",
        model_used: "fake",
      },
    ];

    const { adjudicated, decisions } = await adj.adjudicate({ findings, challenges });

    const byId = Object.fromEntries(decisions.map((d) => [d.issue_id, d.council_decision]));
    expect(byId["A-2"]).toBe("Deleted");
    expect(byId["A-3"]).toBe("Merged");
    expect(byId["A-4"]).toBe("Escalated");

    const ids = adjudicated.map((f) => f.issue_id);
    expect(ids).toContain("A-1");
    expect(ids).not.toContain("A-2");
    expect(ids).not.toContain("A-3");
    const a4 = adjudicated.find((f) => f.issue_id === "A-4");
    expect(a4?.risk).toBe("Critical");
  });
});
