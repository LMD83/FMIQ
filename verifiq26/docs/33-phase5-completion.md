# 33 · Phase 5 Completion Summary

**Doc ID:** `verifiq-phase5-completion-v0.1`
**Phase:** 5 — Council runs on Convex (prompt bundling + runReview action + resume tick) · plus PR-7 hardening + post-merge cleanup
**Date:** 2026-06-06
**Builds on:** Phases 1–4

---

## Context: a two-session merge to clean up first

Two parallel sessions built Phase 3/4. `main` ended up with **both** a
`src/classifier/` (other session) and `src/classify/` (this session), a
**broken empty `src/llm/cache.ts`** (merge artifact), and the PR-7 review
findings live. Phase 5 began by fixing all of that.

### Cleanup + hardening (folded in)

- **Restored `src/llm/cache.ts`** (the merge had zeroed it) and **removed the
  duplicate `src/classifier/`** (no importers; kept `src/classify/`). The
  independent confirmation-gate glue `src/convex/classify.ts` stays.
- **PR-7 security (2× High):** `src/convex/workflow.ts` and `src/convex/cache.ts`
  are now `internalMutation`/`internalQuery` — callable only from trusted
  actions, not from arbitrary clients. `ConvexPersistence` / `ConvexCacheStore`
  / the cron now use `internal.*` refs. The inference **cache key is scoped by
  `project_id`** to stop cross-tenant poisoning/sharing.
- **PR-7 correctness (2× P2):** the `challenges` table now persists
  `interface_discipline` + `required_action`; `loadChallenges` returns them; and
  `saveAdjudications` patches `interface_disciplines` back onto the finding row,
  so the Chair's interface-risk matrix reflects the adjudicated register.

---

## What was built (Phase 5 proper)

### Prompt bundling (unblocks the Convex runtime)

- **`scripts/bundle-prompts.mjs`** (+ `npm run bundle:prompts`) embeds the four
  agent prompt files (01/04/07/13) into **`src/agents/prompts.generated.ts`** (a
  build artifact — the canonical prompts stay in `verifiq-prompts/`).
- **`PromptLoader`** now accepts an in-memory source; **`bundledPromptLoader()`**
  uses the bundle so agents load prompts where `node:fs` can't reach repo files.

### `runReview` node action + dispatch

- **`src/convex/review.ts`** (`"use node"`) — assembles a `CachingLLMClient`
  (over `createLLM` + `ConvexCacheStore`, scoped to the project) + bundled
  prompts + the six agents + `ConvexPersistence`, and runs the resumable
  `Orchestrator`. Every LLM call and self-check decision is appended to
  `audit_log`.
- **`src/convex/reviewData.ts`** — `requestReview` (public; project-ownership
  check when an identity is present) persists the `RunInput` and schedules the
  action; `loadReviewInput`; `resumeStalled` re-dispatches interrupted scans.
- **`review_inputs` table** + a **15-min `resumeStalled` cron** — because the
  Orchestrator is idempotent, re-dispatch reloads persisted state and skips
  finished stages (file 20 §2 resumability).

---

## Verification (in the build environment)

- `npm test` — **25/25 pass** (2 new Phase 5 + 23 prior). New tests:
  `bundledPromptLoader` serves the layered prompts with no fs; `requestReview`
  persists a RunInput, `loadReviewInput` reads it, and `resumeStalled` re-queues
  an in-flight scan.
- `npm run typecheck` — clean. `npm run lint` — 0 errors.
- `npx convex codegen` — clean (new tables + internal functions).

Live-credential checks (real Anthropic/OpenAI behind `runReview`, `npx convex
dev` deploy) remain "verify locally".

---

## Deviations / decisions

1. **Ownership check is identity-conditional.** Clerk auth is still stubbed
   (CLAUDE.md), so `requestReview` enforces ownership only when
   `ctx.auth.getUserIdentity()` returns an identity. The real protection today
   is that all workflow/cache writes are `internalMutation`s — `requestReview`
   is the only public entry. Wire Clerk before production.
2. **`prompts.generated.ts` is committed.** It's required at compile/deploy time
   (imported by `PromptLoader`). Regenerate via `npm run bundle:prompts` whenever
   the four prompt files change (a CI check could enforce freshness).
3. **Single-action run model.** `runReview` runs the whole pipeline in one node
   action; the per-job-type table dispatch (jobs.ts) remains for scans that
   exceed the action time limit — resumability via `resumeStalled` covers
   interruption for MVP-sized packs.

---

## Open questions for Phase 6

1. Concrete **`PdfRenderer`** (rasterise first page) + **`TextExtractor`**
   (pdf-parse) behind the classifier's injected interfaces.
2. **tus.io resumable upload** (platform mandatory #1, file 20 §1).
3. **Exports** — PDF / DOCX / XLSX / CSV / JSON (§05.5), each carrying the
   locked disclaimer + corpus version + document hashes.
4. **Classification-confirmation UX** + `classifier_feedback` (file 20 §4).
5. **Clerk auth** wired so ownership checks are unconditional.

---

## Estimated Phase 6 readiness

**Ready.** The council runs end-to-end on Convex behind a tested, internal-only
persistence layer with a resumable dispatch. Phase 6 is the document I/O edges
(upload, extraction, exports) and the confirmation UI.
