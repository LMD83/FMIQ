/**
 * VerifIQ — orchestrator barrel (Phase 3).
 *
 * The resumable review-workflow orchestrator + job queue that wires the Phase 2
 * agents into the council pipeline (review → peer challenge → adjudicate →
 * chair), per verifiq-prompts/03_review_workflow.md and file 20 §2.
 *
 * Version: 0.5.0-phase3
 */

export {
  Orchestrator,
  createOrchestrator,
  type OrchestratorDeps,
  type RunInput,
  type RunResult,
} from "./workflow.js";
export {
  InMemoryJobQueue,
  backoffMs,
  type JobSpec,
  type QueuedJob,
  type JobHandler,
  type JobStatus,
  type RunSummary,
} from "./queue.js";
export { InMemoryPersistence } from "./memory.js";
export {
  ConvexPersistence,
  createConvexPersistence,
  InMemoryConvexBackend,
  type ConvexBackend,
  type StoredWorkflowState,
} from "./convex-persistence.js";
export {
  STAGES,
  STAGE_SCAN_STATE,
  type StageName,
  type ScanStateValue,
  type WorkflowState,
  type PersistencePort,
  type OrchestratorAuditEntry,
} from "./types.js";
