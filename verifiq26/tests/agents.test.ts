// @vitest-environment node
/**
 * VerifIQ — Phase 2 agent tests (docs/28 Phase 2 DoD via file 16 § Phase 3).
 *
 * Proves: each agent loads its prompts from verifiq-prompts/, returns valid
 * §05.1 Finding objects, the self-check validator rejects findings missing
 * source quotes, every self-check decision is logged, and the Chair derives the
 * file-06 rating↔decision invariant in code and always carries the disclaimer.
 *
 * Runs in the Node environment (the prompt loader reads files via node:fs).
 */

import { describe, it, expect } from "vitest";
import type { LLMClient } from "../src/llm";
import type { LLMResult, LLMRole } from "../src/llm/types";
import {
  PromptLoader,
  MVP_DISCIPLINES,
  createDisciplineAgent,
  createChairAgent,
  deriveDecision,
  runSelfCheck,
  type SelfCheckAuditEntry,
} from "../src/agents";
import { LOCKED_DISCLAIMER } from "../src/constants";
import type { Finding } from "../src/types";

const DOC_TEXT =
  "Drawing register lists Ground Floor Plan A-100 Rev A. " +
  "Sheet A-100 Rev B is the latest issue. " +
  "The Form of Tender Schedule Part 1 reads: 'Date for Substantial Completion: ____________'.";

/** Stub LLM: returns canned findings for review, canned narrative for the chair. */
class StubLLM implements LLMClient {
  constructor(private readonly reviewText: string) {}
  async complete(role: LLMRole, _prompt: string): Promise<LLMResult> {
    const text =
      role === "council-chair"
        ? JSON.stringify({
            council_summary: "Two paragraphs of sober summary.",
            final_recommendation: "Proceed with conditions.",
          })
        : this.reviewText;
    return {
      text,
      tokens_in: 10,
      tokens_out: 5,
      model_used: "stub-model",
      provider_used: "anthropic",
      cost_eur: 0,
      latency_ms: 1,
    };
  }
  completeVision(): Promise<LLMResult> {
    return this.complete("classification", "");
  }
}

function goodFinding(): Record<string, unknown> {
  return {
    discipline_origin: "Architect",
    interface_disciplines: ["Fire"],
    stage: "pre-tender",
    source_document: "A-100 Rev B.pdf",
    source_reference: "Ground Floor Plan A-100 Rev A",
    related_documents: [],
    requirement: "Drawing register must reflect the current revision.",
    finding: "Register lists Rev A but Sheet A-100 Rev B is the latest issue.",
    status: "Coordination issue",
    risk: "Medium",
    build_readiness_impact: "Pre-tender close-out",
    required_evidence: ["Reissued drawing register"],
    owner: "Lead Designer",
  };
}

/** Same finding but the source_reference is not present in the document text. */
function noQuoteFinding(): Record<string, unknown> {
  return { ...goodFinding(), issue_id: "ARCH-PRE-0099", source_reference: "Nonexistent clause 9.9.9" };
}

describe("VerifIQ Phase 2 agents", () => {
  it("loads layered prompts from verifiq-prompts/", async () => {
    const prompts = new PromptLoader();
    expect(await prompts.master()).toContain("VerifIQ");
    expect(await prompts.selfCheck()).toContain("Source quote present");
    expect(await prompts.disciplineSection("04.1")).toContain("Architect Agent");
    expect(await prompts.councilSection("07.3")).toContain("Chair Agent");
  });

  it("emits a valid finding and suppresses one missing its source quote", async () => {
    const audits: SelfCheckAuditEntry[] = [];
    const agent = createDisciplineAgent(MVP_DISCIPLINES.architect!, {
      llm: new StubLLM(JSON.stringify([goodFinding(), noQuoteFinding()])),
      prompts: new PromptLoader(),
      audit: (e) => {
        audits.push(e);
      },
    });

    const result = await agent.review({
      projectStage: "pre-tender",
      documents: [{ filename: "A-100 Rev B.pdf", text: DOC_TEXT }],
    });

    // One emitted (valid), one suppressed (missing verbatim source quote).
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.issue_id).toBe("ARCH-PRE-0001");
    expect(result.findings[0]!.discipline_origin).toBe("Architect");

    expect(audits).toHaveLength(2);
    const suppressed = audits.find((a) => a.outcome === "suppressed");
    expect(suppressed?.checks_failed).toContain("1-source");
  });

  it("self-check rejects a finding with no owner", () => {
    const candidate: Finding = {
      ...(goodFinding() as unknown as Finding),
      issue_id: "ARCH-PRE-0002",
      owner: "the design team",
    };
    const { finding, audit } = runSelfCheck("architect", candidate, {
      disciplineMatch: ["architect"],
      model: "stub",
      sourceText: DOC_TEXT,
    });
    expect(finding).toBeNull();
    expect(audit.outcome).toBe("suppressed");
    expect(audit.checks_failed).toContain("7-owner");
  });

  it("derives the file-06 rating↔decision invariant", () => {
    const base = goodFinding() as unknown as Finding;
    expect(deriveDecision([{ ...base, risk: "Critical", status: "Non-compliant" }])).toEqual({
      rating: "Red",
      decision: "Pause before build",
    });
    expect(deriveDecision([{ ...base, risk: "High", status: "Not demonstrated" }])).toEqual({
      rating: "Amber",
      decision: "Proceed with conditions",
    });
    expect(deriveDecision([{ ...base, risk: "Low", status: "Compliant" }])).toEqual({
      rating: "Green",
      decision: "Proceed",
    });
    expect(deriveDecision([], true)).toEqual({
      rating: "Grey",
      decision: "Insufficient information",
    });
  });

  it("chair produces a report carrying the locked disclaimer", async () => {
    const chair = createChairAgent({
      llm: new StubLLM("[]"),
      prompts: new PromptLoader(),
    });
    const report = await chair.report({
      projectName: "Smoke Project",
      projectStage: "pre-tender",
      buildingType: "office",
      reviewDate: "2026-06-06",
      modulesActivated: ["BR", "FSC"],
      disciplinesReviewed: ["Architect", "Fire"],
      findings: [{ ...(goodFinding() as unknown as Finding), issue_id: "ARCH-PRE-0001", risk: "High", status: "Not demonstrated" }],
    });
    expect(report.disclaimer).toBe(LOCKED_DISCLAIMER);
    expect(report.build_readiness_rating).toBe("Amber");
    expect(report.executive_decision).toBe("Proceed with conditions");
    expect(report.high_risk_conditions).toContain("ARCH-PRE-0001");
  });
});
