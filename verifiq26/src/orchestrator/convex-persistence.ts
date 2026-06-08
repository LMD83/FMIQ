/**
 * VerifIQ — Convex-backed PersistencePort (Phase 4).
 *
 * Bridges the Phase 3 orchestrator's `PersistencePort` to Convex. The Convex
 * `"use node"` review action constructs this with a `ConvexBackend` whose methods
 * call `ctx.runMutation` / `ctx.runQuery` against `src/convex/persist.ts`. The
 * adapter owns the only non-trivial mapping — the resumable `discipline_status`
 * is a `Record` in the orchestrator but an array in the `workflow_state` table —
 * so that mapping is unit-tested here without a deployment.
 *
 * Version: 0.7.0-phase4
 */

import type { BuildReadinessReport, Finding } from "../types/index.js";
import type { ChallengeRecord } from "../agents/challenge.js";
import type { AdjudicationRecord } from "../agents/adjudicate.js";
import type {
  OrchestratorAuditEntry,
  PersistencePort,
  ScanStateValue,
  StageName,
  WorkflowState,
} from "./types.js";

export interface StoredDisciplineStatus {
  discipline: string;
  status: "succeeded" | "failed";
}

/** The `workflow_state` row shape (discipline_status as an array). */
export interface StoredWorkflowState {
  project_id: string;
  scan_state: ScanStateValue | "released";
  completed_stages: string[];
  discipline_status: StoredDisciplineStatus[];
  updated_at: number;
}

/**
 * The Convex operations the adapter needs. In production each method is a thin
 * `ctx.runMutation` / `ctx.runQuery` wrapper (see src/convex/persist.ts).
 */
export interface ConvexBackend {
  getWorkflowState(projectId: string): Promise<StoredWorkflowState | null>;
  upsertWorkflowState(state: StoredWorkflowState): Promise<void>;
  setScanState(projectId: string, state: ScanStateValue | "released"): Promise<void>;
  insertFindings(projectId: string, findings: Finding[]): Promise<void>;
  listFindings(projectId: string): Promise<Finding[]>;
  insertChallenges(projectId: string, challenges: ChallengeRecord[]): Promise<void>;
  listChallenges(projectId: string): Promise<ChallengeRecord[]>;
  saveAdjudications(
    projectId: string,
    adjudicated: Finding[],
    decisions: AdjudicationRecord[],
  ): Promise<void>;
  listAdjudicated(projectId: string): Promise<Finding[]>;
  saveReport(projectId: string, report: BuildReadinessReport): Promise<void>;
  getReport(projectId: string): Promise<BuildReadinessReport | null>;
  appendAudit(projectId: string, entry: OrchestratorAuditEntry): Promise<void>;
}

export class ConvexPersistence implements PersistencePort {
  constructor(private readonly backend: ConvexBackend) {}

  async loadState(projectId: string): Promise<WorkflowState | null> {
    const stored = await this.backend.getWorkflowState(projectId);
    return stored ? fromStored(stored) : null;
  }

  async saveState(state: WorkflowState): Promise<void> {
    await this.backend.upsertWorkflowState(toStored(state));
  }

  async setScanState(projectId: string, state: ScanStateValue | "released"): Promise<void> {
    await this.backend.setScanState(projectId, state);
  }

  async saveFindings(projectId: string, findings: Finding[]): Promise<void> {
    if (findings.length) await this.backend.insertFindings(projectId, findings);
  }
  async loadFindings(projectId: string): Promise<Finding[]> {
    return this.backend.listFindings(projectId);
  }

  async saveChallenges(projectId: string, challenges: ChallengeRecord[]): Promise<void> {
    if (challenges.length) await this.backend.insertChallenges(projectId, challenges);
  }
  async loadChallenges(projectId: string): Promise<ChallengeRecord[]> {
    return this.backend.listChallenges(projectId);
  }

  async saveAdjudications(
    projectId: string,
    adjudicated: Finding[],
    decisions: AdjudicationRecord[],
  ): Promise<void> {
    await this.backend.saveAdjudications(projectId, adjudicated, decisions);
  }
  async loadAdjudicated(projectId: string): Promise<Finding[]> {
    return this.backend.listAdjudicated(projectId);
  }

  async saveReport(projectId: string, report: BuildReadinessReport): Promise<void> {
    await this.backend.saveReport(projectId, report);
  }
  async loadReport(projectId: string): Promise<BuildReadinessReport | null> {
    return this.backend.getReport(projectId);
  }

  async appendAudit(projectId: string, entry: OrchestratorAuditEntry): Promise<void> {
    await this.backend.appendAudit(projectId, entry);
  }
}

export function createConvexPersistence(backend: ConvexBackend): ConvexPersistence {
  return new ConvexPersistence(backend);
}

// ── state mapping (Record ↔ array) ───────────────────────────────────────────

export function toStored(state: WorkflowState): StoredWorkflowState {
  return {
    project_id: state.project_id,
    scan_state: state.scan_state,
    completed_stages: [...state.completed_stages],
    discipline_status: Object.entries(state.discipline_status).map(([discipline, status]) => ({
      discipline,
      status,
    })),
    updated_at: state.updated_at,
  };
}

export function fromStored(stored: StoredWorkflowState): WorkflowState {
  const discipline_status: Record<string, "succeeded" | "failed"> = {};
  for (const row of stored.discipline_status) discipline_status[row.discipline] = row.status;
  return {
    project_id: stored.project_id,
    scan_state: stored.scan_state,
    completed_stages: stored.completed_stages as StageName[],
    discipline_status,
    updated_at: stored.updated_at,
  };
}

/** In-memory ConvexBackend — the reference implementation + test double. */
export class InMemoryConvexBackend implements ConvexBackend {
  private states = new Map<string, StoredWorkflowState>();
  private findings = new Map<string, Finding[]>();
  private challenges = new Map<string, ChallengeRecord[]>();
  private adjudicated = new Map<string, Finding[]>();
  private decisions = new Map<string, AdjudicationRecord[]>();
  private reports = new Map<string, BuildReadinessReport>();
  private audit = new Map<string, OrchestratorAuditEntry[]>();

  private push<T>(map: Map<string, T[]>, key: string, items: T[]): void {
    map.set(key, [...(map.get(key) ?? []), ...items]);
  }

  async getWorkflowState(projectId: string): Promise<StoredWorkflowState | null> {
    return this.states.get(projectId) ?? null;
  }
  async upsertWorkflowState(state: StoredWorkflowState): Promise<void> {
    this.states.set(state.project_id, state);
  }
  async setScanState(projectId: string, state: ScanStateValue | "released"): Promise<void> {
    const s = this.states.get(projectId);
    if (s) s.scan_state = state;
  }
  async insertFindings(projectId: string, findings: Finding[]): Promise<void> {
    this.push(this.findings, projectId, findings);
  }
  async listFindings(projectId: string): Promise<Finding[]> {
    return [...(this.findings.get(projectId) ?? [])];
  }
  async insertChallenges(projectId: string, challenges: ChallengeRecord[]): Promise<void> {
    this.push(this.challenges, projectId, challenges);
  }
  async listChallenges(projectId: string): Promise<ChallengeRecord[]> {
    return [...(this.challenges.get(projectId) ?? [])];
  }
  async saveAdjudications(
    projectId: string,
    adjudicated: Finding[],
    decisions: AdjudicationRecord[],
  ): Promise<void> {
    this.adjudicated.set(projectId, adjudicated);
    this.push(this.decisions, projectId, decisions);
  }
  async listAdjudicated(projectId: string): Promise<Finding[]> {
    return [...(this.adjudicated.get(projectId) ?? [])];
  }
  async saveReport(projectId: string, report: BuildReadinessReport): Promise<void> {
    this.reports.set(projectId, report);
  }
  async getReport(projectId: string): Promise<BuildReadinessReport | null> {
    return this.reports.get(projectId) ?? null;
  }
  async appendAudit(projectId: string, entry: OrchestratorAuditEntry): Promise<void> {
    this.push(this.audit, projectId, [entry]);
  }
}
