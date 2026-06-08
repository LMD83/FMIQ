/**
 * VerifIQ — Convex-backed PersistencePort (Phase 4 binding).
 *
 * Implements the orchestrator's PersistencePort (types.ts) against the Convex
 * workflow functions (src/convex/workflow.ts) + the job-queue scan-state
 * mutation. Constructed with a `ConvexRunner` — in production a Convex action
 * ctx (runQuery/runMutation), in tests a convex-test handle — so the resumable
 * Orchestrator runs on the real schema without importing Convex internals here.
 *
 * Version: 0.6.0-phase4
 */

import type { FunctionReference } from "convex/server";
import type { BuildReadinessReport, Finding } from "../types/index.js";
import type { ChallengeRecord } from "../agents/challenge.js";
import type { AdjudicationRecord } from "../agents/adjudicate.js";
import { api, internal } from "../convex/_generated/api.js";
import type {
  OrchestratorAuditEntry,
  PersistencePort,
  ScanStateValue,
  WorkflowState,
} from "./types.js";

/** Loosely-typed Convex caller (action ctx or convex-test handle). */
export interface ConvexRunner {
  runQuery(
    ref: FunctionReference<"query", "public" | "internal">,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  runMutation(
    ref: FunctionReference<"mutation", "public" | "internal">,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}

type DisciplineStatusRow = { discipline: string; status: "succeeded" | "failed" };

export class ConvexPersistence implements PersistencePort {
  constructor(private readonly run: ConvexRunner) {}

  async loadState(projectId: string): Promise<WorkflowState | null> {
    const row = (await this.run.runQuery(internal.workflow.loadWorkflowState, {
      project_id: projectId,
    })) as
      | (Omit<WorkflowState, "discipline_status"> & { discipline_status: DisciplineStatusRow[] })
      | null;
    if (!row) return null;
    const discipline_status: Record<string, "succeeded" | "failed"> = {};
    for (const d of row.discipline_status) discipline_status[d.discipline] = d.status;
    return {
      project_id: row.project_id,
      scan_state: row.scan_state,
      completed_stages: row.completed_stages,
      discipline_status,
      updated_at: row.updated_at,
    };
  }

  async saveState(state: WorkflowState): Promise<void> {
    const discipline_status: DisciplineStatusRow[] = Object.entries(state.discipline_status).map(
      ([discipline, status]) => ({ discipline, status }),
    );
    await this.run.runMutation(internal.workflow.saveWorkflowState, {
      project_id: state.project_id,
      scan_state: state.scan_state,
      completed_stages: state.completed_stages,
      discipline_status,
    });
  }

  async setScanState(projectId: string, state: ScanStateValue | "released"): Promise<void> {
    await this.run.runMutation(api.jobs.advanceScanState, {
      project_id: projectId,
      scan_state: state,
    });
  }

  async saveFindings(projectId: string, findings: Finding[]): Promise<void> {
    await this.run.runMutation(internal.workflow.saveFindings, { project_id: projectId, findings });
  }
  async loadFindings(projectId: string): Promise<Finding[]> {
    return (await this.run.runQuery(internal.workflow.loadFindings, {
      project_id: projectId,
    })) as Finding[];
  }

  async saveChallenges(projectId: string, challenges: ChallengeRecord[]): Promise<void> {
    await this.run.runMutation(internal.workflow.saveChallenges, {
      project_id: projectId,
      challenges,
    });
  }
  async loadChallenges(projectId: string): Promise<ChallengeRecord[]> {
    return (await this.run.runQuery(internal.workflow.loadChallenges, {
      project_id: projectId,
    })) as ChallengeRecord[];
  }

  async saveAdjudications(
    projectId: string,
    adjudicated: Finding[],
    decisions: AdjudicationRecord[],
  ): Promise<void> {
    await this.run.runMutation(internal.workflow.saveAdjudications, {
      project_id: projectId,
      adjudicated,
      decisions: decisions.map((d) => ({
        issue_id: d.issue_id,
        council_decision: d.council_decision,
        rationale: d.rationale,
        adjudicator_model: d.adjudicator_model,
      })),
    });
  }
  async loadAdjudicated(projectId: string): Promise<Finding[]> {
    return (await this.run.runQuery(internal.workflow.loadAdjudicated, {
      project_id: projectId,
    })) as Finding[];
  }

  async saveReport(projectId: string, report: BuildReadinessReport): Promise<void> {
    // The `disclaimer` is re-applied on load from the locked constant.
    const { disclaimer: _disclaimer, ...rest } = report;
    await this.run.runMutation(internal.workflow.saveReport, { project_id: projectId, report: rest });
  }
  async loadReport(projectId: string): Promise<BuildReadinessReport | null> {
    return (await this.run.runQuery(internal.workflow.loadReport, {
      project_id: projectId,
    })) as BuildReadinessReport | null;
  }

  async appendAudit(projectId: string, entry: OrchestratorAuditEntry): Promise<void> {
    await this.run.runMutation(api.mutations.appendAudit, {
      project_id: projectId,
      actor: "orchestrator",
      action: entry.action,
      target_type: entry.stage ?? "workflow",
      target_id: entry.discipline,
      payload_json: JSON.stringify(entry),
    });
  }
}
