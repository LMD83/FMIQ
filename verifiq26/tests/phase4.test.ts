/* eslint-disable @typescript-eslint/no-explicit-any -- convex-test runner bridge casts */
/**
 * VerifIQ — Phase 4 tests (Convex binding + inference cache + classifier).
 *
 * Covers the three test-able Phase 4 cores:
 *  - ConvexPersistence round-trips the orchestrator's PersistencePort against
 *    the real schema (findings / challenges / adjudications / reports / state),
 *    via convex-test.
 *  - The inference cache (CachingLLMClient + MemoryCacheStore, and the Convex
 *    cache functions) returns a cached completion without re-calling the model.
 *  - The 3-source classifier picks title-block > content > filename.
 *
 * The scheduled tick / runReview action are deploy-time glue (docs/32).
 */

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import { ConvexPersistence, type ConvexRunner } from "../src/orchestrator/convex-port";
import { CachingLLMClient, MemoryCacheStore } from "../src/llm/cache";
import { ConvexCacheStore } from "../src/llm/cache-convex";
import type { LLMClient } from "../src/llm";
import type { LLMResult, LLMRole } from "../src/llm/types";
import { classifyDocument } from "../src/classify";
import type { PdfRenderer, TextExtractor } from "../src/classify";
import { LOCKED_DISCLAIMER } from "../src/constants";
import type { BuildReadinessReport, Finding } from "../src/types";

const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "../src/convex/**/*.js",
  "!../src/convex/**/*.d.ts",
]);

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    issue_id: "ARCH-PRE-0001",
    discipline_origin: "Architect",
    interface_disciplines: ["Fire"],
    stage: "pre-tender",
    source_document: "A-100.pdf",
    source_reference: "Ground Floor Plan A-100",
    related_documents: [],
    requirement: "Register must reflect current revision.",
    finding: "Register lists Rev A but the latest is Rev B.",
    status: "Coordination issue",
    risk: "High",
    build_readiness_impact: "Pre-tender close-out",
    required_evidence: ["Reissued register"],
    owner: "Lead Designer",
    ...overrides,
  };
}

/** A counting stub LLM. */
function stubLLM(text: string): { client: LLMClient; calls: () => number } {
  let n = 0;
  const result = (): LLMResult => ({
    text,
    tokens_in: 4,
    tokens_out: 2,
    model_used: "claude-sonnet-4-6",
    provider_used: "anthropic",
    cost_eur: 0.01,
    latency_ms: 3,
  });
  return {
    calls: () => n,
    client: {
      async complete(_r: LLMRole, _p: string) {
        n++;
        return result();
      },
      async completeVision() {
        n++;
        return result();
      },
    },
  };
}

describe("Phase 4 — Convex persistence port", () => {
  it("round-trips findings, adjudications, report, and workflow state", async () => {
    const t = convexTest(schema, modules);
    const runner: ConvexRunner = {
      runQuery: (ref, args) => t.query(ref as any, args as any),
      runMutation: (ref, args) => t.mutation(ref as any, args as any),
    };
    const port = new ConvexPersistence(runner);

    const userId = await t.mutation(api.mutations.createUser, { email: "liam@goviq.ie" });
    const projectId = await t.mutation(api.mutations.createProject, {
      owner_user_id: userId,
      name: "Port Test",
    });

    // findings
    await port.saveFindings(projectId, [finding(), finding({ issue_id: "FIRE-PRE-0001", discipline_origin: "Fire Safety", risk: "Critical", status: "Non-compliant" })]);
    expect(await port.loadFindings(projectId)).toHaveLength(2);

    // workflow state
    await port.saveState({
      project_id: projectId,
      scan_state: "scanning",
      completed_stages: ["review"],
      discipline_status: { architect: "succeeded", fire: "failed" },
      updated_at: Date.now(),
    });
    const state = await port.loadState(projectId);
    expect(state?.completed_stages).toContain("review");
    expect(state?.discipline_status.architect).toBe("succeeded");

    // adjudications → council_decision on the finding row
    await port.saveAdjudications(
      projectId,
      [finding({ council_decision: "Retained" })],
      [
        {
          issue_id: "ARCH-PRE-0001",
          council_decision: "Retained",
          rationale: "evidence-supported",
          pre: { risk: "High", status: "Coordination issue", owner: "Lead Designer" },
          post: { risk: "High", status: "Coordination issue", owner: "Lead Designer" },
          adjudicator_model: "claude-opus-4-8",
        },
      ],
    );
    const adjudicated = await port.loadAdjudicated(projectId);
    expect(adjudicated.map((f) => f.issue_id)).toContain("ARCH-PRE-0001");

    // report round-trip (disclaimer re-applied on load)
    const report: BuildReadinessReport = {
      project_name: "Port Test",
      project_stage: "pre-tender",
      building_type: "office",
      review_date: "2026-06-06",
      regulatory_modules_activated: ["BR"],
      disciplines_reviewed: ["Architect"],
      build_readiness_rating: "Amber",
      executive_decision: "Proceed with conditions",
      council_summary: "summary",
      critical_blockers: [],
      high_risk_conditions: ["ARCH-PRE-0001"],
      discipline_action_matrix: ["ARCH-PRE-0001"],
      interface_risk_matrix: ["ARCH-PRE-0001"],
      statutory_approval_risks: [],
      planning_condition_risks: [],
      tender_cost_risks: ["ARCH-PRE-0001"],
      construction_hold_points: [],
      handover_evidence_requirements: [],
      final_recommendation: "Proceed with conditions.",
      disclaimer: "PLACEHOLDER",
    };
    await port.saveReport(projectId, report);
    const loaded = await port.loadReport(projectId);
    expect(loaded?.executive_decision).toBe("Proceed with conditions");
    expect(loaded?.high_risk_conditions).toContain("ARCH-PRE-0001");
    expect(loaded?.disclaimer).toBe(LOCKED_DISCLAIMER);

    // audit
    await port.appendAudit(projectId, { action: "report_released", timestamp: new Date().toISOString() });
    const audit = await t.query(api.mutations.listAudit, { project_id: projectId });
    expect(audit.some((a: { action: string }) => a.action === "report_released")).toBe(true);
  });
});

describe("Phase 4 — inference cache", () => {
  it("returns a cached completion without re-calling the model", async () => {
    const { client, calls } = stubLLM("CACHED-OK");
    const caching = new CachingLLMClient(client, new MemoryCacheStore());

    const first = await caching.complete("classification", "same prompt", { agentId: "x", promptVersion: "v1" });
    const second = await caching.complete("classification", "same prompt", { agentId: "x", promptVersion: "v1" });

    expect(first.text).toBe("CACHED-OK");
    expect(second.text).toBe("CACHED-OK");
    expect(calls()).toBe(1); // second served from cache
    expect(second.cost_eur).toBe(0);
  });

  it("persists to the Convex inference_cache table", async () => {
    const t = convexTest(schema, modules);
    const runner: ConvexRunner = {
      runQuery: (ref, args) => t.query(ref as any, args as any),
      runMutation: (ref, args) => t.mutation(ref as any, args as any),
    };
    const store = new ConvexCacheStore(runner);
    await store.put(
      "k1",
      { text: "hello", model_used: "claude-haiku-4-5-20251001", provider_used: "anthropic", tokens_in: 1, tokens_out: 1 },
      { model: "claude-haiku-4-5-20251001", prompt_version: "v1", document_sha256: "abc", agent_id: "classifier", corpus_version: "c1", project_id: "p1", tokens_in: 1, tokens_out: 1 },
    );
    const hit = await store.get("k1");
    expect(hit?.text).toBe("hello");
    expect(hit?.provider_used).toBe("anthropic");
    expect(await store.get("missing")).toBeNull();
  });
});

describe("Phase 4 — 3-source classifier", () => {
  const renderer: PdfRenderer = { async renderFirstPagePng() { return new Uint8Array([1, 2, 3]); } };
  const textExtractor: TextExtractor = { async firstText() { return "Mechanical services specification for the plantroom."; } };

  it("uses the title block when it yields a drawing number", async () => {
    const { client } = stubLLM(JSON.stringify({ drawing_number: "M-200", revision: "B", discipline_code: "M", drawing_title: "Plantroom Layout" }));
    const res = await classifyDocument({ filename: "weird-scan.pdf", bytes: new Uint8Array([0]) }, { llm: client, renderer });
    expect(res.source).toBe("title-block");
    expect(res.discipline).toBe("mechanical");
    expect(res.drawing_number).toBe("M-200");
    expect(res.classifier_confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("falls back to content when there is no title block", async () => {
    const { client } = stubLLM(JSON.stringify({ discipline: "mechanical", doc_type: "specification" }));
    const res = await classifyDocument({ filename: "IMG_2438.pdf", bytes: new Uint8Array([0]) }, { llm: client, textExtractor });
    expect(res.source).toBe("content");
    expect(res.discipline).toBe("mechanical");
  });

  it("falls back to the filename with no bytes", async () => {
    const { client, calls } = stubLLM("{}");
    const res = await classifyDocument({ filename: "A-100 Rev C.pdf" }, { llm: client });
    expect(res.source).toBe("filename");
    expect(res.discipline).toBe("architectural");
    expect(res.drawing_number).toBe("A-100");
    expect(res.revision).toBe("C");
    expect(calls()).toBe(0); // no model call needed
  });
});
