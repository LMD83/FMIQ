# 32 · Phase 4 Completion Summary

**Doc ID:** `verifiq-phase4-completion-v0.1`
**Phase:** 4 — Title-block classifier + inference cache + classification glue
**Date:** 2026-06-06
**Builds on:** Phases 1–3 (schema, adapters, agents, orchestrator)

---

## What was built

### Title-block classifier (`src/classifier/`) — file 20 §3

The 3-source weighted document classifier that produces the metadata the
`documents` row records and the confidence the confirmation gate reads.

- `filename.ts` — Source 1 parser for Irish-practice conventions (`A-100`,
  `A-101 Rev B`, `24-001-ARC-100-rev-B`); lowest weight, final fallback.
- `classifier.ts` — `TitleBlockClassifier`: tries title-block **vision**
  extraction (Source 2, ~0.9 confidence) → document **content** classification
  (Source 3, ~0.6) → filename (≤0.55). The LLM is injected, so the filename path
  needs no provider and the LLM paths are unit-testable. Extraction prompts are
  code-level output wiring (like the agents' `OUTPUT_INSTRUCTION`), not domain
  prompts.
- `types.ts` — `ClassificationInput/Result`, discipline-code maps, doc-type
  inference, and `CONFIRM_THRESHOLD` (0.7) for the gate.

### Inference cache (`src/llm/cache.ts`) — file 20 §2

- Deterministic key = `hash(model + prompt_version + document_sha256 + agent_id
  + corpus_version)`.
- `InferenceCache.getOrCompute(parts, compute)` returns the cached result on a
  hit (model **not** re-invoked) — making job retries cheap and scans
  reproducible. Store is a port (`InferenceCacheStore`); `InMemory…` here, Convex
  `inference_cache` in production.

### Convex glue

- `src/convex/classify.ts` — `saveClassification`, `confirmDocument`,
  `reclassifyDocument` (logs the correction to `audit_log` as labelled training
  data, file 20 §4 / file 15), `listForConfirmation`, and `canStartScan` (the
  forced-confirm gate: a scan starts only when no low-confidence row is
  unconfirmed).
- `src/convex/cache.ts` — `getCachedInference` (TTL-aware), `putCachedInference`
  (idempotent on cache key), `purgeExpired`. 30-day TTL via `expires_at`.

---

## Verification (build environment)

- `npx vitest run` — **23/23 pass** (6 new: classifier across all three sources,
  filename parsing, low-confidence fallback, cache key determinism,
  get-or-compute hit/miss).
- `npx eslint` — **0 errors** on all Phase 4 files.
- `npx tsc --noEmit` — Phase 4 files compile clean in isolation. The single
  repo-wide error remains the **pre-existing** `tests/smoke.test.ts:145`
  (Phase 1, offline `_generated/api.ts` `any`-stub) — not introduced here;
  resolved by `npx convex codegen`.

---

## Deviations / decisions

1. **Classifier takes pre-extracted inputs.** Rendering page 1 to an image and
   extracting the first ~500 tokens of text is an upload-pipeline concern
   (file 20 §1, Phase 7). The classifier accepts `titleBlockImage` / `contentText`
   so it is pure and testable; the render/extract step plugs in later.
2. **Reclassification feedback → `audit_log`, no new table.** File 20 §4 names a
   `classifier_feedback` table; rather than alter the (merged) schema, corrections
   are logged to `audit_log` with `action: "reclassify"` and before/after +
   prior confidence. If a dedicated table is wanted for the lessons-learnt
   aggregation, that's a one-line schema addition — **flagging for your call**.

---

## Remaining Phase 4 integration (deploy-only — next)

These need a Convex deployment to exercise and are the natural next step:

1. **Scheduled `tick`.** A `convex/crons.ts` interval (~60s) → an internal
   function that `claimNextRunnable` (already in `jobs.ts`) → dispatches to a
   `"use node"` action → `completeJob`/`failJob`.
2. **Orchestrator-in-Convex.** A `"use node"` internal action that builds the
   Phase 3 `Orchestrator` with the real agents (`createLLM` from env) and a
   **Convex `PersistencePort`**, and runs a project review. This needs a small
   **schema addition — a `workflow_state` table** (or a `scan_state` + derived
   reconstruction) to persist `completed_stages` / `discipline_status` for
   cross-restart resume. Flagged because it touches the schema.
3. **Cache wiring into agents.** Route discipline-review / classification calls
   through `InferenceCache` backed by `convex/cache.ts`.

These were deliberately scoped out of this PR because they cannot be verified in
the build sandbox and the `workflow_state` addition wants your nod first.

---

## Estimated readiness

**Classifier + cache are production-ready behind clean ports and fully tested.**
The deploy-only wiring above is well-defined; the only open design choice is the
`workflow_state` persistence (new table vs. derived), which I've flagged rather
than decided.
