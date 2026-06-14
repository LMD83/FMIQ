/**
 * VerifIQ — Convex database schema (Phase 1).
 *
 * Purpose: the single source of truth for every persisted entity in the
 * VerifIQ Pre-Build Compliance Council platform. Tables mirror the canonical
 * JSON shapes in `verifiq-prompts/05_output_schemas.md` (§05.1 Finding,
 * §05.2 DisciplineSummary, §05.3 BuildReadinessReport, §05.4 DB mapping),
 * the job-queue + inference-cache model in `verifiq-prompts/20_platform_architecture.md`
 * §2, the feedback taxonomy in `verifiq-prompts/14_feedback_taxonomy.md`, and
 * the lessons-learnt registry in `verifiq-prompts/15_lessons_learnt_loop.md`.
 *
 * Storage follows the locked Convex + Cloudflare R2 hybrid decision
 * (`docs/27-stack-decision-storage-and-platform.md`): the `documents` table
 * carries BOTH an optional Convex `storage_id` AND an optional `r2_key`.
 *
 * Scope note (docs/28 Phase 1): this file defines structure only. Agents, the
 * workflow orchestrator, peer challenge, adjudication and the chair report are
 * Phase 2+. The tables that those phases write to exist here so they are never
 * retrofitted onto a live table.
 *
 * Version: 0.3.0-phase1
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// Shared enums — expressed as v.union(v.literal(...)) per the Convex pattern.
// These mirror the controlled vocabularies in files 01 and 05; never widen
// them to free strings, or the schema-locked promise in CLAUDE.md is lost.
// ============================================================================

/** Project / pack lifecycle stage (Finding §05.1 `stage`). */
export const Stage = v.union(
  v.literal("design"),
  v.literal("pre-tender"),
  v.literal("pre-build"),
  v.literal("construction"),
  v.literal("handover"),
);

/** Finding status — the 8 classifications from file 01 / §05.1. */
export const FindingStatus = v.union(
  v.literal("Compliant"),
  v.literal("Non-compliant"),
  v.literal("Not demonstrated"),
  v.literal("Clarification required"),
  v.literal("Coordination issue"),
  v.literal("Construction evidence required"),
  v.literal("Handover evidence required"),
  v.literal("Outside current scope"),
);

/** Risk rating — the 5 levels from file 01 / §05.1. */
export const Risk = v.union(
  v.literal("Critical"),
  v.literal("High"),
  v.literal("Medium"),
  v.literal("Low"),
  v.literal("Advisory"),
);

/** Build-readiness impact of a single finding (§05.1). */
export const BuildReadinessImpact = v.union(
  v.literal("Build blocker"),
  v.literal("Proceed with condition"),
  v.literal("Pre-tender close-out"),
  v.literal("Pre-construction close-out"),
  v.literal("Construction hold point"),
  v.literal("Handover requirement"),
  v.literal("Advisory"),
);

/** Adjudicated council decision on a finding (§05.1; set only after Stage 6). */
export const CouncilDecision = v.union(
  v.literal("Retained"),
  v.literal("Amended"),
  v.literal("Merged"),
  v.literal("Downgraded"),
  v.literal("Escalated"),
  v.literal("Deleted"),
);

/** Discipline-summary overall status (§05.2). */
export const DisciplineOverallStatus = v.union(
  v.literal("Acceptable"),
  v.literal("Partial"),
  v.literal("Not demonstrated"),
  v.literal("High risk"),
  v.literal("Critical risk"),
);

/** Build Readiness Report rating (§05.3); maps 1:1 to executive decision per file 06. */
export const BuildReadinessRating = v.union(
  v.literal("Green"),
  v.literal("Amber"),
  v.literal("Red"),
  v.literal("Grey"),
);

/** The four — and only four — executive decisions (file 01 / §05.3). */
export const ExecutiveDecision = v.union(
  v.literal("Proceed"),
  v.literal("Proceed with conditions"),
  v.literal("Pause before build"),
  v.literal("Insufficient information"),
);

/** Per-file processing status used by the classifier (file 20 §3-4). */
export const DocumentStatus = v.union(
  v.literal("uploaded"),
  v.literal("classifying"),
  v.literal("classified"),
  v.literal("confirmed"),
  v.literal("failed"),
);

/** Long-running scan-state machine for a project/pack (file 20 §5). */
export const ScanState = v.union(
  v.literal("pending"),
  v.literal("uploading"),
  v.literal("classifying"),
  v.literal("confirm_classify"),
  v.literal("scanning"),
  v.literal("cross_ref"),
  v.literal("peer_challenge"),
  v.literal("adjudicate"),
  v.literal("reviewer_queue"),
  v.literal("released"),
);

/** Job-queue job types (file 20 §2). */
export const JobType = v.union(
  v.literal("classify"),
  v.literal("review_discipline"),
  v.literal("cross_reference"),
  v.literal("peer_challenge"),
  v.literal("adjudicate"),
  v.literal("report"),
);

/** Job-queue status (file 20 §2). */
export const JobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("retrying"),
);

/** Design-team response to a released finding (file 14). */
export const DesignTeamResponse = v.union(
  v.literal("Accepted"),
  v.literal("Accepted with risk re-rated"),
  v.literal("Rejected"),
  v.literal("Already actioned"),
);

/** The 12 rejection categories REJ-01..REJ-12 (file 14). */
export const RejectionReason = v.union(
  v.literal("REJ-01"),
  v.literal("REJ-02"),
  v.literal("REJ-03"),
  v.literal("REJ-04"),
  v.literal("REJ-05"),
  v.literal("REJ-06"),
  v.literal("REJ-07"),
  v.literal("REJ-08"),
  v.literal("REJ-09"),
  v.literal("REJ-10"),
  v.literal("REJ-11"),
  v.literal("REJ-12"),
);

/** Prompt-version lifecycle (file 15 Stage 5-7). */
export const PromptVersionStatus = v.union(
  v.literal("draft"),
  v.literal("testing"),
  v.literal("active"),
  v.literal("retired"),
);

// ============================================================================
// Schema
// ============================================================================

export default defineSchema({
  // --------------------------------------------------------------------------
  // users — tenant principals. Phase 1 uses a stub (no Clerk wiring yet); the
  // `clerk_user_id` field is the future link. Data-minimised: identity + role
  // only, nothing not required to operate (docs/28 DoD).
  // --------------------------------------------------------------------------
  users: defineTable({
    clerk_user_id: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("customer"), v.literal("reviewer"), v.literal("admin")),
    is_stub: v.boolean(),
    created_at: v.number(),
  })
    .index("by_clerk_user_id", ["clerk_user_id"])
    .index("by_email", ["email"]),

  // --------------------------------------------------------------------------
  // projects — core project record. Holds the structured intake fields; the
  // free-form / wizard answers live in `intake_answers`. (§05.4)
  // The canonical 17 intake fields are specified in
  // `docs/09-sector-role-onboarding-wizard-spec.docx`; the set below is the
  // Phase-1 structured subset (see docs/29 deviations).
  // --------------------------------------------------------------------------
  projects: defineTable({
    owner_user_id: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    building_type: v.optional(v.string()),
    sector: v.optional(v.string()),
    stage: v.optional(Stage),
    scan_state: ScanState,
    project_value_band: v.optional(v.string()),
    client_name: v.optional(v.string()),
    lead_designer: v.optional(v.string()),
    planning_reference: v.optional(v.string()),
    planning_status: v.optional(v.string()),
    bcar_applicable: v.optional(v.boolean()),
    fsc_required: v.optional(v.boolean()),
    dac_required: v.optional(v.boolean()),
    protected_structure: v.optional(v.boolean()),
    occupancy_type: v.optional(v.string()),
    gross_floor_area_m2: v.optional(v.number()),
    storeys: v.optional(v.number()),
    corpus_version: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_owner", ["owner_user_id"])
    .index("by_scan_state", ["scan_state"]),

  // --------------------------------------------------------------------------
  // intake_answers — key/value pairs from the intake wizard. (§05.4)
  // --------------------------------------------------------------------------
  intake_answers: defineTable({
    project_id: v.id("projects"),
    key: v.string(),
    value: v.string(),
  })
    .index("by_project", ["project_id"])
    .index("by_project_key", ["project_id", "key"]),

  // --------------------------------------------------------------------------
  // documents — uploaded files. Carries BOTH storage_id (Convex-native) AND
  // r2_key (Cloudflare R2) per docs/27; exactly one is populated per row.
  // --------------------------------------------------------------------------
  documents: defineTable({
    project_id: v.id("projects"),
    filename: v.string(),
    sha256: v.string(),
    size_bytes: v.number(),
    // Storage location — one of these is set (docs/27 hybrid pattern).
    storage_id: v.optional(v.id("_storage")),
    r2_key: v.optional(v.string()),
    // Classification metadata (file 20 §3).
    discipline: v.optional(v.string()),
    doc_type: v.optional(v.string()),
    drawing_number: v.optional(v.string()),
    revision: v.optional(v.string()),
    date: v.optional(v.string()),
    author: v.optional(v.string()),
    stage: v.optional(Stage),
    classifier_confidence: v.optional(v.number()),
    status: DocumentStatus,
    created_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_sha256", ["sha256"])
    .index("by_project_discipline", ["project_id", "discipline"])
    .index("by_project_status", ["project_id", "status"]),

  // --------------------------------------------------------------------------
  // upload_tokens — the "advanced magic code" that replaces email-concierge
  // intake (docs/42). The website issues one per intake; the app verifies it to
  // open a direct-upload session. Two secrets per row (link + short code, the
  // locked D4 decision), stored HASHED only — never raw (docs/42 §4, §5.4 N1).
  // --------------------------------------------------------------------------
  upload_tokens: defineTable({
    project_id: v.id("projects"),
    email: v.string(), // intake email, lowercased
    link_hash: v.string(), // sha256(pepper + ":" + one-click link token)
    short_code_hash: v.string(), // sha256(pepper + ":" + normalised short code)
    purpose: v.union(v.literal("first_read"), v.literal("pilot_upload")),
    status: v.union(
      v.literal("issued"),
      v.literal("used"),
      v.literal("expired"),
      v.literal("revoked"),
    ),
    attempts: v.number(), // replay counter; revoke at MAX_VERIFY_ATTEMPTS
    expires_at: v.number(),
    used_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_link_hash", ["link_hash"])
    .index("by_short_code_hash", ["short_code_hash"])
    .index("by_project", ["project_id"])
    .index("by_email", ["email"]),

  // --------------------------------------------------------------------------
  // upload_sessions — a verified, project-scoped bearer session minted when a
  // magic code is verified (docs/42 §3-4). The browser holds the raw session
  // token; only its hash is stored. Every signed-URL request checks this
  // session→project binding before R2 is touched (docs/42 §5.3 B4).
  // --------------------------------------------------------------------------
  upload_sessions: defineTable({
    project_id: v.id("projects"),
    token_id: v.id("upload_tokens"),
    session_hash: v.string(), // sha256(pepper + ":" + session token)
    expires_at: v.number(),
    created_at: v.number(),
  })
    .index("by_session_hash", ["session_hash"])
    .index("by_project", ["project_id"]),

  // --------------------------------------------------------------------------
  // modules — activated regulatory modules per project (§05.4).
  // --------------------------------------------------------------------------
  modules: defineTable({
    project_id: v.id("projects"),
    module_name: v.string(),
    activated_at: v.number(),
    activated_by: v.string(),
  })
    .index("by_project", ["project_id"])
    .index("by_project_module", ["project_id", "module_name"]),

  // --------------------------------------------------------------------------
  // findings — the atomic unit (§05.1). `issue_id` is the stable business id
  // ({disc}-{stage}-{seq}); the Convex `_id` is the storage id.
  // --------------------------------------------------------------------------
  findings: defineTable({
    project_id: v.id("projects"),
    issue_id: v.string(),
    discipline_origin: v.string(),
    interface_disciplines: v.array(v.string()),
    stage: Stage,
    project_area: v.optional(v.string()),
    location: v.optional(v.string()),
    source_document: v.string(),
    source_reference: v.string(),
    related_documents: v.array(v.string()),
    requirement: v.string(),
    finding: v.string(),
    status: FindingStatus,
    risk: Risk,
    build_readiness_impact: BuildReadinessImpact,
    question: v.optional(v.string()),
    required_evidence: v.array(v.string()),
    owner: v.string(),
    secondary_owner: v.optional(v.string()),
    close_out_stage: v.optional(v.string()),
    // Populated only after Stage 6 adjudication.
    council_decision: v.optional(CouncilDecision),
    rationale: v.optional(v.string()),
    // Provenance for the lessons-learnt join (files 13, 15).
    model_used: v.optional(v.string()),
    prompt_version: v.optional(v.string()),
    corpus_version: v.optional(v.string()),
    self_check_audit_entry_id: v.optional(v.id("audit_log")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_project_issue_id", ["project_id", "issue_id"])
    .index("by_project_status", ["project_id", "status"])
    .index("by_project_risk", ["project_id", "risk"])
    .index("by_project_discipline", ["project_id", "discipline_origin"]),

  // --------------------------------------------------------------------------
  // finding_interfaces — many-to-many: which findings interface which
  // disciplines (§05.4). Keyed by the finding's issue_id.
  // --------------------------------------------------------------------------
  finding_interfaces: defineTable({
    project_id: v.id("projects"),
    issue_id: v.string(),
    interface_discipline: v.string(),
  })
    .index("by_project", ["project_id"])
    .index("by_issue", ["project_id", "issue_id"])
    .index("by_discipline", ["project_id", "interface_discipline"]),

  // --------------------------------------------------------------------------
  // challenges — peer-challenge records (Stage 5; §05.4).
  // --------------------------------------------------------------------------
  challenges: defineTable({
    project_id: v.id("projects"),
    issue_id: v.string(),
    challenger_discipline: v.string(),
    decision: v.string(),
    revised_risk: v.optional(Risk),
    rationale: v.string(),
    // Cross-discipline interface the challenge raises (adjudicator folds this
    // into the finding's interface_disciplines) + the action it asks for.
    interface_discipline: v.optional(v.string()),
    required_action: v.optional(v.string()),
    model_used: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_issue", ["project_id", "issue_id"]),

  // --------------------------------------------------------------------------
  // adjudications — adjudicator decisions (Stage 6; §05.4). Immutable once
  // written; the pre-state lives in audit_log.
  // --------------------------------------------------------------------------
  adjudications: defineTable({
    project_id: v.id("projects"),
    issue_id: v.string(),
    council_decision: CouncilDecision,
    rationale: v.string(),
    adjudicator_model: v.string(),
    adjudicated_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_issue", ["project_id", "issue_id"]),

  // --------------------------------------------------------------------------
  // discipline_summaries — one per discipline per project (§05.2).
  // --------------------------------------------------------------------------
  discipline_summaries: defineTable({
    project_id: v.id("projects"),
    discipline: v.string(),
    documents_reviewed: v.array(v.string()),
    documents_missing: v.array(v.string()),
    overall_status: DisciplineOverallStatus,
    critical_findings_count: v.number(),
    high_findings_count: v.number(),
    medium_findings_count: v.number(),
    key_risks: v.array(v.string()),
    questions_for_other_disciplines: v.array(
      v.object({
        target_discipline: v.string(),
        question: v.string(),
        reason: v.string(),
        risk: v.string(),
      }),
    ),
    evidence_required_before_build: v.array(v.string()),
    construction_hold_points: v.array(v.string()),
    handover_evidence: v.array(v.string()),
    created_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_project_discipline", ["project_id", "discipline"]),

  // --------------------------------------------------------------------------
  // reports — Build Readiness Report records (§05.3). Version-stamped; the
  // matrix/array sections are populated via report_findings (issue_id refs),
  // not duplicated content (§05.4 note).
  // --------------------------------------------------------------------------
  reports: defineTable({
    project_id: v.id("projects"),
    version: v.string(),
    project_name: v.string(),
    project_stage: v.optional(v.string()),
    building_type: v.optional(v.string()),
    review_date: v.string(),
    regulatory_modules_activated: v.array(v.string()),
    disciplines_reviewed: v.array(v.string()),
    build_readiness_rating: BuildReadinessRating,
    executive_decision: ExecutiveDecision,
    council_summary: v.string(),
    final_recommendation: v.string(),
    reviewer_initials: v.optional(v.string()),
    corpus_version: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_project_version", ["project_id", "version"]),

  // --------------------------------------------------------------------------
  // report_findings — many-to-many: which findings appear in which report
  // section (§05.4).
  // --------------------------------------------------------------------------
  report_findings: defineTable({
    report_id: v.id("reports"),
    issue_id: v.string(),
    section: v.string(),
  })
    .index("by_report", ["report_id"])
    .index("by_report_section", ["report_id", "section"]),

  // --------------------------------------------------------------------------
  // audit_log — every state transition. Non-negotiable customer trust artefact
  // (§05.4, file 20 §2 "audit-log writes are mutations, never actions").
  // The Convex `_id` is the entry_id.
  // --------------------------------------------------------------------------
  audit_log: defineTable({
    project_id: v.optional(v.id("projects")),
    actor: v.string(),
    action: v.string(),
    target_type: v.string(),
    target_id: v.optional(v.string()),
    payload_json: v.string(),
    occurred_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_target", ["target_type", "target_id"])
    .index("by_action", ["action"]),

  // --------------------------------------------------------------------------
  // jobs — the job queue (file 20 §2). Per-discipline isolation via depends_on;
  // idempotency_key is a deterministic hash of job_type + payload.
  // --------------------------------------------------------------------------
  jobs: defineTable({
    project_id: v.id("projects"),
    job_type: JobType,
    payload: v.string(),
    status: JobStatus,
    attempts: v.number(),
    idempotency_key: v.string(),
    depends_on: v.array(v.id("jobs")),
    scheduled_for: v.optional(v.number()),
    started_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    error: v.optional(v.string()),
    result_ref: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_status", ["status"])
    .index("by_idempotency_key", ["idempotency_key"])
    .index("by_status_scheduled", ["status", "scheduled_for"]),

  // --------------------------------------------------------------------------
  // findings_feedback — customer rejection feedback (file 14). Carries the
  // self-check audit-entry id as the key join back to agent reasoning.
  // --------------------------------------------------------------------------
  findings_feedback: defineTable({
    project_id: v.id("projects"),
    issue_id: v.string(),
    discipline: v.string(),
    original_status: FindingStatus,
    original_risk: Risk,
    design_team_response: DesignTeamResponse,
    rejection_primary_reason: v.optional(RejectionReason),
    rejection_secondary_reason: v.optional(RejectionReason),
    design_team_comment: v.optional(v.string()),
    responding_party: v.string(),
    responding_party_charter: v.optional(v.string()),
    responded_at: v.number(),
    agent_audit_log_entry_id: v.optional(v.id("audit_log")),
    model_used: v.optional(v.string()),
    corpus_version: v.optional(v.string()),
    prompt_version: v.optional(v.string()),
    reviewer_action: v.optional(v.string()),
  })
    .index("by_project", ["project_id"])
    .index("by_issue", ["project_id", "issue_id"])
    .index("by_reason", ["rejection_primary_reason"]),

  // --------------------------------------------------------------------------
  // prompt_versions — version registry for the lessons-learnt loop (file 15).
  // --------------------------------------------------------------------------
  prompt_versions: defineTable({
    agent_id: v.string(),
    version: v.string(),
    status: PromptVersionStatus,
    notes: v.optional(v.string()),
    created_at: v.number(),
    activated_at: v.optional(v.number()),
  })
    .index("by_agent", ["agent_id"])
    .index("by_agent_version", ["agent_id", "version"])
    .index("by_status", ["status"]),

  // --------------------------------------------------------------------------
  // inference_cache — LLM call cache keyed by
  // hash(model + prompt_version + document_sha256 + agent_id + corpus_version)
  // (file 20 §2; idempotency). TTL 30 days via expires_at.
  // --------------------------------------------------------------------------
  inference_cache: defineTable({
    cache_key: v.string(),
    model: v.string(),
    prompt_version: v.string(),
    document_sha256: v.string(),
    agent_id: v.string(),
    corpus_version: v.string(),
    result_text: v.string(),
    tokens_in: v.number(),
    tokens_out: v.number(),
    created_at: v.number(),
    expires_at: v.number(),
  })
    .index("by_cache_key", ["cache_key"])
    .index("by_expires_at", ["expires_at"]),

  // --------------------------------------------------------------------------
  // classifier_feedback — every reclassification correction (file 20 §4). The
  // single most valuable labelled signal for the lessons-learnt loop (file 15).
  // --------------------------------------------------------------------------
  classifier_feedback: defineTable({
    project_id: v.id("projects"),
    document_id: v.id("documents"),
    sha256: v.optional(v.string()),
    from_discipline: v.optional(v.string()),
    to_discipline: v.string(),
    from_doc_type: v.optional(v.string()),
    to_doc_type: v.optional(v.string()),
    prior_confidence: v.optional(v.number()),
    classifier_source: v.optional(v.string()),
    corrected_by: v.string(),
    corrected_at: v.number(),
  })
    .index("by_project", ["project_id"])
    .index("by_document", ["document_id"]),

  // --------------------------------------------------------------------------
  // workflow_state — resumable orchestrator state per project (file 20 §2/§5).
  // Persists which stages completed + each discipline's outcome so a scan
  // resumes across restarts without re-running finished stages.
  // --------------------------------------------------------------------------
  workflow_state: defineTable({
    project_id: v.id("projects"),
    scan_state: ScanState,
    completed_stages: v.array(v.string()),
    discipline_status: v.array(
      v.object({
        discipline: v.string(),
        status: v.union(v.literal("succeeded"), v.literal("failed")),
      }),
    ),
    updated_at: v.number(),
  }).index("by_project", ["project_id"]),

  // --------------------------------------------------------------------------
  // review_inputs — the serialized RunInput for a scan, persisted so the
  // scheduled resume tick can re-dispatch runReview for an interrupted scan
  // (the orchestrator is idempotent and skips finished stages). (Phase 5)
  // --------------------------------------------------------------------------
  review_inputs: defineTable({
    project_id: v.id("projects"),
    payload_json: v.string(),
    created_at: v.number(),
  }).index("by_project", ["project_id"]),
});
