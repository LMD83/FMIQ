/**
 * VerifIQ — orchestrator types + persistence port.
 *
 * The orchestrator runs the review workflow (intake → review → peer challenge →
 * adjudicate → chair report) as a resumable job DAG per
 * verifiq-prompts/03_review_workflow.md and file 20 §2. It never imports Convex;
 * all persistence and audit go through the injected ports below (the same
 * dependency-injection pattern as the Phase 1 AuditSink / Phase 2 agents), so
 * the whole pipeline is unit-testable without a deployment.
 *
 * Version: 0.5.0-phase3
 */

import type { BuildReadinessReport, Finding } from "../types/index.js";
import type { ChallengeRecord } from "../agents/challenge.js";
import type { AdjudicationRecord } from "../agents/adjudicate.js";

/** Pipeline stages, in order. `review` fans out per discipline. */
export const STAGES = ["review", "peer_challenge", "adjudicate", "report"] as const;
export type StageName = (typeof STAGES)[number];

/** Scan-state values the orchestrator advances through (subset of the schema). */
export type ScanStateValue =
  | "scanning"
  | "peer_challenge"
  | "adjudicate"
  | "reviewer_queue"
  | "released";

/** Per-stage scan-state mapping (file 20 §5 state machine). */
export const STAGE_SCAN_STATE: Record<StageName, ScanStateValue> = {
  review: "scanning",
  peer_challenge: "peer_challenge",
  adjudicate: "adjudicate",
  report: "reviewer_queue",
};

/** Resumable workflow state for a project. */
export interface WorkflowState {
  project_id: string;
  scan_state: ScanStateValue | "released";
  completed_stages: StageName[];
  /** Per-discipline review outcome (isolation: one failure ≠ pack failure). */
  discipline_status: Record<string, "succeeded" | "failed">;
  updated_at: number;
}

/** A single audit row the orchestrator emits (serialised into audit_log). */
export interface OrchestratorAuditEntry {
  action: string;
  stage?: StageName;
  discipline?: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Everything the orchestrator needs to read/write. A Convex-backed
 * implementation lives behind this in production; tests use the in-memory one.
 */
export interface PersistencePort {
  loadState(projectId: string): Promise<WorkflowState | null>;
  saveState(state: WorkflowState): Promise<void>;
  setScanState(projectId: string, state: ScanStateValue | "released"): Promise<void>;

  saveFindings(projectId: string, findings: Finding[]): Promise<void>;
  loadFindings(projectId: string): Promise<Finding[]>;

  saveChallenges(projectId: string, challenges: ChallengeRecord[]): Promise<void>;
  loadChallenges(projectId: string): Promise<ChallengeRecord[]>;

  saveAdjudications(
    projectId: string,
    adjudicated: Finding[],
    decisions: AdjudicationRecord[],
  ): Promise<void>;
  loadAdjudicated(projectId: string): Promise<Finding[]>;

  saveReport(projectId: string, report: BuildReadinessReport): Promise<void>;
  loadReport(projectId: string): Promise<BuildReadinessReport | null>;

  appendAudit(projectId: string, entry: OrchestratorAuditEntry): Promise<void>;
}
