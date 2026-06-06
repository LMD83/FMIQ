/**
 * VerifIQ — in-memory PersistencePort.
 *
 * A reference / test implementation of the orchestrator's persistence port. The
 * Convex-backed implementation (Phase 4) mirrors this against the schema tables;
 * keeping the port abstract means the orchestrator and its tests never touch a
 * deployment.
 *
 * Version: 0.5.0-phase3
 */

import type { BuildReadinessReport, Finding } from "../types/index.js";
import type { ChallengeRecord } from "../agents/challenge.js";
import type { AdjudicationRecord } from "../agents/adjudicate.js";
import type {
  OrchestratorAuditEntry,
  PersistencePort,
  ScanStateValue,
  WorkflowState,
} from "./types.js";

interface ProjectStore {
  state?: WorkflowState;
  scan_state?: ScanStateValue | "released";
  findings: Finding[];
  challenges: ChallengeRecord[];
  adjudicated: Finding[];
  adjudications: AdjudicationRecord[];
  report?: BuildReadinessReport;
  audit: OrchestratorAuditEntry[];
}

export class InMemoryPersistence implements PersistencePort {
  private store = new Map<string, ProjectStore>();

  private project(id: string): ProjectStore {
    let p = this.store.get(id);
    if (!p) {
      p = { findings: [], challenges: [], adjudicated: [], adjudications: [], audit: [] };
      this.store.set(id, p);
    }
    return p;
  }

  async loadState(projectId: string): Promise<WorkflowState | null> {
    return this.project(projectId).state ?? null;
  }
  async saveState(state: WorkflowState): Promise<void> {
    this.project(state.project_id).state = state;
  }
  async setScanState(projectId: string, state: ScanStateValue | "released"): Promise<void> {
    this.project(projectId).scan_state = state;
  }

  async saveFindings(projectId: string, findings: Finding[]): Promise<void> {
    this.project(projectId).findings.push(...findings);
  }
  async loadFindings(projectId: string): Promise<Finding[]> {
    return [...this.project(projectId).findings];
  }

  async saveChallenges(projectId: string, challenges: ChallengeRecord[]): Promise<void> {
    this.project(projectId).challenges.push(...challenges);
  }
  async loadChallenges(projectId: string): Promise<ChallengeRecord[]> {
    return [...this.project(projectId).challenges];
  }

  async saveAdjudications(
    projectId: string,
    adjudicated: Finding[],
    decisions: AdjudicationRecord[],
  ): Promise<void> {
    const p = this.project(projectId);
    p.adjudicated = adjudicated;
    p.adjudications.push(...decisions);
  }
  async loadAdjudicated(projectId: string): Promise<Finding[]> {
    return [...this.project(projectId).adjudicated];
  }

  async saveReport(projectId: string, report: BuildReadinessReport): Promise<void> {
    this.project(projectId).report = report;
  }
  async loadReport(projectId: string): Promise<BuildReadinessReport | null> {
    return this.project(projectId).report ?? null;
  }

  async appendAudit(projectId: string, entry: OrchestratorAuditEntry): Promise<void> {
    this.project(projectId).audit.push(entry);
  }

  // ── test inspection helpers ────────────────────────────────────────────────
  auditFor(projectId: string): OrchestratorAuditEntry[] {
    return [...this.project(projectId).audit];
  }
  reportFor(projectId: string): BuildReadinessReport | undefined {
    return this.project(projectId).report;
  }
  adjudicationsFor(projectId: string): AdjudicationRecord[] {
    return [...this.project(projectId).adjudications];
  }
}
