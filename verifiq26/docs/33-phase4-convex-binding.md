# 33 · Phase 4 (Convex binding) Completion Summary

**Doc ID:** `verifiq-phase4-convex-binding-v0.1`
**Phase:** 4 (remainder) — durable Convex persistence + dedicated tables
**Date:** 2026-06-07
**Builds on:** Phase 4 part 1 (classifier + inference cache), Phase 3 orchestrator

---

## Decision taken

Per the founder: **dedicated tables** for both flagged items —
`classifier_feedback` (file 20 §4) and `workflow_state` (resumable orchestrator
state). Both added to `src/convex/schema.ts` (additive).

---

## What was built

### Schema (additive)

- **`workflow_state`** — `{ project_id, scan_state, completed_stages[],
  discipline_status[], updated_at }`. Persists which stages completed and each
  discipline's outcome so a scan resumes across restarts (file 20 §2/§5).
- **`classifier_feedback`** — every reclassification correction
  (`from/to_discipline`, `from/to_doc_type`, `prior_confidence`, `corrected_by`),
  the labelled training signal for the lessons-learnt loop (file 20 §4 / file 15).

### Durable PersistencePort

- **`src/orchestrator/convex-persistence.ts`** — `ConvexPersistence` implements
  the Phase 3 `PersistencePort` over an injected `ConvexBackend`. It owns the one
  non-trivial mapping: `discipline_status` is a `Record` in the orchestrator but
  an array in the table. Ships with an `InMemoryConvexBackend` reference impl.
- **`src/convex/persist.ts`** — the Convex functions the backend wraps: bulk
  `insert/listFindings`, `insert/listChallenges`, `saveAdjudications` (patches each
  finding's decision/risk), `listAdjudicated` (register minus deleted/merged),
  `saveReport` (+ `report_findings` section refs), `getReport`, `upsert/getWorkflowState`,
  `appendOrchestratorAudit`.

### Classification feedback

- **`src/convex/classify.ts`** — `reclassifyDocument` now writes the dedicated
  `classifier_feedback` row **and** the `audit_log` entry (audit remains
  non-negotiable).

### Scheduled jobs

- **`src/convex/crons.ts`** — nightly `inference_cache` TTL purge (file 20 §2).

---

## Verification

- `npx vitest run` — **25/25 pass** (2 new): the `workflow_state` Record↔array
  round-trip, and the **real Phase 3 orchestrator run end-to-end through
  `ConvexPersistence`** (report + resumable state persisted via the bridge).
- `npx eslint` — clean on all new files.
- `npx tsc --noEmit` — new Phase 4 files clean in isolation. The single repo-wide
  error remains the pre-existing `tests/smoke.test.ts:145` (offline `_generated`
  `any`-stub), resolved by `npx convex codegen`.

`persist.ts` / `crons.ts` are Convex functions — verify against a real
deployment; they are not exercised by the in-sandbox tests.

---

## Remaining integration (Phase 5 — flagged, not built)

Running the **orchestrator inside Convex** needs three things that are larger,
deploy-only, and out of this PR's scope:

1. **Prompt bundling.** `PromptLoader` reads `verifiq-prompts/*.md` from disk;
   Convex function bundles don't include arbitrary files. The prompts must be
   bundled (imported as strings) or stored in Convex before agents run server-side.
2. **PDF text extraction.** The orchestrator needs `documentsByDiscipline` text;
   that means rendering/extracting uploaded PDFs (also needed by the classifier's
   title-block render) — part of the upload pipeline (file 20 §1).
3. **The `"use node"` runner + scheduled tick.** With (1) and (2) in place, a node
   action builds the orchestrator (`createLLM` from env + `ConvexPersistence`
   wired to `persist.ts`) and runs a project review; a 60s cron drains
   `jobs.claimNextRunnable` into it.

The durable foundation for all three — the tables, `persist.ts`, and the tested
`ConvexPersistence` bridge — is now in place. The bridge is proven to run the
real pipeline; only the server-side execution environment (prompts + text) and
the thin runner remain.

---

## Review hardening (post automated review)

Addressed the automated security + correctness review:

- **Security (High) — IDOR / compliance tampering.** All persistence functions
  (`persist.ts`) and the inference-cache read/writes (`cache.ts`) are now
  **`internalMutation`/`internalQuery`** — callable only from the trusted
  orchestrator/cron, never from a browser client. This closes the
  cross-tenant write-tampering (adjudications, workflow state, report) and
  cache-poisoning vectors. Authenticated project-membership checks still belong
  in the public action layer once Clerk auth lands.
- **Correctness (P2) — peer interface dropped.** Added `interface_discipline`
  (+ `required_action`) to the `challenges` table; `insert/listChallenges`
  round-trip it so the adjudicator can fold it into `interface_disciplines`.
- **Correctness (P2) — adjudicated interfaces lost.** `saveAdjudications` now
  takes the adjudicated findings and patches each finding's
  `interface_disciplines` (not just risk/decision), so the chair report's
  interface-risk matrix isn't built from a stale list.
- **Correctness (P1) — partial report.** `getReport` now rehydrates the full
  §05.3 report — the section arrays from `report_findings` plus the locked
  disclaimer — instead of the raw `reports` row.

A new `tests/persist.test.ts` exercises these via `convex-test` in-process
against the real schema (interface round-trip, adjudicated-interface
persistence, report rehydration). **26/26 tests pass.**

## Estimated readiness

**The persistence layer is production-shaped and the bridge is tested.** The
remaining work is the upload/extraction pipeline (file 20 §1) and prompt
bundling, after which the runner action is a thin wire-up.
