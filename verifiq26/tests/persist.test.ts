/**
 * VerifIQ — persist.ts runtime tests (convex-test).
 *
 * Exercises the durable persistence functions in-process against the real schema
 * to verify the review fixes: peer `interface_discipline` round-trips through
 * `challenges`, adjudication persists the updated `interface_disciplines` onto
 * the finding, and `getReport` rehydrates the full §05.3 report (section arrays
 * + locked disclaimer). The functions are `internal*` (not client-callable);
 * convex-test invokes them as a trusted caller.
 *
 * Version: 0.7.0-phase4
 */

import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";

interface ViteImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
const modules = (import.meta as unknown as ViteImportMeta).glob("../src/convex/**/*.ts");

function finding(issue_id: string, over: Record<string, unknown> = {}) {
  return {
    issue_id,
    discipline_origin: "Architect",
    interface_disciplines: [] as string[],
    stage: "pre-tender",
    source_document: "Spec.pdf",
    source_reference: "Clause 4.2",
    related_documents: [] as string[],
    requirement: "The Form of Tender must state the completion date.",
    finding: "The completion date is left blank and must be confirmed before tender.",
    status: "Not demonstrated",
    risk: "High",
    build_readiness_impact: "Pre-tender close-out",
    required_evidence: ["Completed Form of Tender"],
    owner: "Lead Designer",
    ...over,
  };
}

describe("persist.ts durable persistence (convex-test)", () => {
  it("round-trips interface_discipline, persists adjudicated interfaces, rehydrates the report", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.mutations.createUser, { email: "f@goviq.ie" });
    const projectId = await t.mutation(api.mutations.createProject, {
      owner_user_id: userId,
      name: "Clinic",
    });

    await t.mutation(internal.persist.insertFindings, {
      project_id: projectId,
      findings: [finding("ARCH-PRE-0001")],
    });

    // Peer challenge carrying a cross-discipline interface round-trips.
    await t.mutation(internal.persist.insertChallenges, {
      project_id: projectId,
      challenges: [
        {
          issue_id: "ARCH-PRE-0001",
          challenger_discipline: "Fire Safety",
          decision: "Retained",
          reason: "valid",
          interface_discipline: "Fire Safety",
        },
      ],
    });
    const challenges = await t.query(internal.persist.listChallenges, { project_id: projectId });
    expect(challenges[0].interface_discipline).toBe("Fire Safety");

    // Adjudication adds the interface + escalates risk on the finding itself.
    await t.mutation(internal.persist.saveAdjudications, {
      project_id: projectId,
      adjudicated: [
        finding("ARCH-PRE-0001", {
          interface_disciplines: ["Fire Safety"],
          risk: "Critical",
          council_decision: "Escalated",
        }),
      ],
      decisions: [
        {
          issue_id: "ARCH-PRE-0001",
          council_decision: "Escalated",
          rationale: "peer escalation",
          post: { risk: "Critical" },
          adjudicator_model: "code-rules",
        },
      ],
    });
    const adjudicated = await t.query(internal.persist.listAdjudicated, { project_id: projectId });
    expect(adjudicated[0].interface_disciplines).toContain("Fire Safety");
    expect(adjudicated[0].risk).toBe("Critical");

    // The report rehydrates with its section arrays + the locked disclaimer.
    await t.mutation(internal.persist.saveReport, {
      project_id: projectId,
      report: {
        project_name: "Clinic",
        review_date: "2026-06-06",
        regulatory_modules_activated: [],
        disciplines_reviewed: ["Architect"],
        build_readiness_rating: "Red",
        executive_decision: "Pause before build",
        council_summary: "Summary.",
        final_recommendation: "Pause before build.",
        critical_blockers: ["ARCH-PRE-0001"],
        high_risk_conditions: [],
        discipline_action_matrix: ["ARCH-PRE-0001"],
        interface_risk_matrix: ["ARCH-PRE-0001"],
        statutory_approval_risks: [],
        planning_condition_risks: [],
        tender_cost_risks: [],
        construction_hold_points: [],
        handover_evidence_requirements: [],
      },
    });
    const report = await t.query(internal.persist.getReport, { project_id: projectId });
    expect(report?.critical_blockers).toEqual(["ARCH-PRE-0001"]);
    expect(report?.interface_risk_matrix).toEqual(["ARCH-PRE-0001"]);
    expect(report?.disclaimer).toContain("software-based reading aid");
  });
});
