/**
 * VerifIQ — review workflow orchestrator.
 *
 * Runs the council pipeline as a resumable job DAG (file 20 §2) over the
 * 7-stage workflow (verifiq-prompts/03_review_workflow.md):
 *   review (per discipline, isolated) → peer challenge → adjudicate → chair report.
 *
 * - Per-discipline isolation: a discipline review that fails (after the agent's
 *   own provider failover is exhausted) is recorded and the pack proceeds with
 *   the surviving disciplines — it does not fail the whole scan (file 20).
 * - Resumable: every stage persists its output and is marked complete; a second
 *   run() reloads state and skips finished stages (idempotent).
 * - Decoupled: all reads/writes go through the injected PersistencePort; the LLM
 *   goes through the agents' injected client. No Convex import here.
 *
 * Version: 0.5.0-phase3
 */

import type { ReviewDocument, DisciplineAgent } from "../agents/agent.js";
import type { PeerChallengeAgent, ChallengeRecord } from "../agents/challenge.js";
import type { AdjudicatorAgent } from "../agents/adjudicate.js";
import type { ChairAgent } from "../agents/chair.js";
import type { BuildReadinessReport, Stage } from "../types/index.js";
import { InMemoryJobQueue, type RunSummary } from "./queue.js";
import {
  STAGE_SCAN_STATE,
  type OrchestratorAuditEntry,
  type PersistencePort,
  type StageName,
  type WorkflowState,
} from "./types.js";

export interface OrchestratorDeps {
  /** Discipline agents keyed by discipline key (e.g. "architect"). */
  disciplineAgents: Record<string, DisciplineAgent>;
  challengeAgent: PeerChallengeAgent;
  adjudicator: AdjudicatorAgent;
  chair: ChairAgent;
  persistence: PersistencePort;
}

export interface RunInput {
  projectId: string;
  projectName: string;
  projectStage: Stage;
  buildingType: string;
  reviewDate: string;
  modulesActivated?: string[];
  corpusVersion?: string;
  reviewerInitials?: string;
  /** Documents grouped by discipline key (matching disciplineAgents keys). */
  documentsByDiscipline: Record<string, ReviewDocument[]>;
  projectContext?: string;
  alreadyAddressed?: string[];
}

export interface RunResult {
  report: BuildReadinessReport;
  state: WorkflowState;
  jobs: RunSummary;
}

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async run(input: RunInput): Promise<RunResult> {
    const { persistence } = this.deps;
    const state = (await persistence.loadState(input.projectId)) ?? newState(input.projectId);

    const audit = (entry: Omit<OrchestratorAuditEntry, "timestamp">) =>
      persistence.appendAudit(input.projectId, { ...entry, timestamp: new Date().toISOString() });

    // Disciplines that actually have documents to review.
    const activeKeys = Object.keys(this.deps.disciplineAgents).filter(
      (k) => (input.documentsByDiscipline[k]?.length ?? 0) > 0,
    );

    const queue = new InMemoryJobQueue();
    const reviewIds = activeKeys.map((k) => `review:${k}`);

    // ── handlers ───────────────────────────────────────────────────────────
    queue.registerHandler("review", async (job) => {
      const key = String(job.payload);
      if (state.discipline_status[key] === "succeeded") return; // resume: skip
      await persistence.setScanState(input.projectId, STAGE_SCAN_STATE.review);
      const agent = this.deps.disciplineAgents[key]!;
      try {
        const res = await agent.review({
          projectStage: input.projectStage,
          documents: input.documentsByDiscipline[key]!,
          ...(input.projectContext ? { projectContext: input.projectContext } : {}),
          ...(input.alreadyAddressed ? { alreadyAddressed: input.alreadyAddressed } : {}),
          ...(input.corpusVersion ? { corpusVersion: input.corpusVersion } : {}),
        });
        await persistence.saveFindings(input.projectId, res.findings);
        for (const a of res.audits) {
          await audit({ action: "self_check", stage: "review", discipline: key, detail: { ...a } });
        }
        state.discipline_status[key] = "succeeded";
        await audit({
          action: "discipline_review_completed",
          stage: "review",
          discipline: key,
          detail: { emitted: res.findings.length, invalid: res.invalid.length },
        });
      } catch (err) {
        // Isolation: record + continue; the pack proceeds with other disciplines.
        state.discipline_status[key] = "failed";
        await audit({
          action: "discipline_review_failed",
          stage: "review",
          discipline: key,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
      await persistence.saveState(touch(state));
    });

    queue.registerHandler("peer_challenge", async () => {
      if (state.completed_stages.includes("peer_challenge")) return;
      await persistence.setScanState(input.projectId, STAGE_SCAN_STATE.peer_challenge);
      const findings = await persistence.loadFindings(input.projectId);
      const all: ChallengeRecord[] = [];
      for (const key of activeKeys) {
        const challenger = this.deps.disciplineAgents[key]!.displayName;
        const others = findings.filter((f) => f.discipline_origin !== challenger);
        if (others.length === 0) continue;
        const recs = await this.deps.challengeAgent.challenge({
          findings: others,
          challengerDiscipline: challenger,
          ...(input.corpusVersion ? { corpusVersion: input.corpusVersion } : {}),
        });
        for (const r of recs)
          await audit({ action: "peer_challenge", stage: "peer_challenge", detail: { ...r } });
        all.push(...recs);
      }
      await persistence.saveChallenges(input.projectId, all);
      markComplete(state, "peer_challenge");
      await persistence.saveState(touch(state));
    });

    queue.registerHandler("adjudicate", async () => {
      if (state.completed_stages.includes("adjudicate")) return;
      await persistence.setScanState(input.projectId, STAGE_SCAN_STATE.adjudicate);
      const findings = await persistence.loadFindings(input.projectId);
      const challenges = await persistence.loadChallenges(input.projectId);
      const { adjudicated, decisions } = await this.deps.adjudicator.adjudicate({
        findings,
        challenges,
        ...(input.corpusVersion ? { corpusVersion: input.corpusVersion } : {}),
      });
      await persistence.saveAdjudications(input.projectId, adjudicated, decisions);
      for (const d of decisions) {
        await audit({ action: "adjudication", stage: "adjudicate", detail: { ...d } });
      }
      markComplete(state, "adjudicate");
      await persistence.saveState(touch(state));
    });

    queue.registerHandler("report", async () => {
      if (state.completed_stages.includes("report")) return;
      const adjudicated = await persistence.loadAdjudicated(input.projectId);
      const disciplinesReviewed = activeKeys
        .filter((k) => state.discipline_status[k] === "succeeded")
        .map((k) => this.deps.disciplineAgents[k]!.displayName);
      const coreDocumentsMissing = activeKeys.length === 0 || disciplinesReviewed.length === 0;
      const report = await this.deps.chair.report({
        projectName: input.projectName,
        projectStage: input.projectStage,
        buildingType: input.buildingType,
        reviewDate: input.reviewDate,
        modulesActivated: input.modulesActivated ?? [],
        disciplinesReviewed,
        findings: adjudicated,
        coreDocumentsMissing,
        ...(input.corpusVersion ? { corpusVersion: input.corpusVersion } : {}),
        ...(input.reviewerInitials ? { reviewerInitials: input.reviewerInitials } : {}),
      });
      await persistence.saveReport(input.projectId, report);
      await persistence.setScanState(input.projectId, "released");
      state.scan_state = "released";
      markComplete(state, "report");
      await audit({
        action: "report_released",
        stage: "report",
        detail: { rating: report.build_readiness_rating, decision: report.executive_decision },
      });
      await persistence.saveState(touch(state));
    });

    // ── DAG: reviews → peer_challenge → adjudicate → report ──────────────────
    for (const key of activeKeys) {
      queue.enqueue({ id: `review:${key}`, type: "review", payload: key });
    }
    queue.enqueue({ id: "peer_challenge", type: "peer_challenge", dependsOn: reviewIds });
    queue.enqueue({ id: "adjudicate", type: "adjudicate", dependsOn: ["peer_challenge"] });
    queue.enqueue({ id: "report", type: "report", dependsOn: ["adjudicate"] });

    const jobs = await queue.runToCompletion();

    const report = await persistence.loadReport(input.projectId);
    if (!report) {
      throw new Error("Workflow completed without producing a report");
    }
    return { report, state, jobs };
  }
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  return new Orchestrator(deps);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function newState(projectId: string): WorkflowState {
  return {
    project_id: projectId,
    scan_state: "scanning",
    completed_stages: [],
    discipline_status: {},
    updated_at: Date.now(),
  };
}

function markComplete(state: WorkflowState, stage: StageName): void {
  if (!state.completed_stages.includes(stage)) state.completed_stages.push(stage);
}

function touch(state: WorkflowState): WorkflowState {
  state.updated_at = Date.now();
  return state;
}
