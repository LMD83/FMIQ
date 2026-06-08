# 32 · Phase 4 Completion Summary

**Doc ID:** `verifiq-phase4-completion-v0.1`
**Phase:** 4 — Convex binding (persistence port + workflow functions) · inference cache · title-block classifier
**Date:** 2026-06-06
**Builds on:** Phase 1 (schema + adapters), Phase 2 (agents), Phase 3 (orchestrator + queue)

---

## What was built

Phase 4 lands the four open items from `docs/31`: the Convex-backed persistence
port, the scheduled cache purge, the inference-cache wiring, and the 3-source
title-block classifier.

### Convex persistence binding

- **`src/convex/workflow.ts`** — the data operations behind the orchestrator's
  `PersistencePort`: `saveFindings`/`loadFindings` (§05.1), `saveChallenges`/
  `loadChallenges`, `saveAdjudications`/`loadAdjudicated` (writes the
  `adjudications` audit rows **and** stamps `council_decision` on the finding
  rows — §05.1), `saveReport`/`loadReport` (scalars in `reports`, section arrays
  via `report_findings` per §05.4; disclaimer re-applied from the locked
  constant on load), and `loadWorkflowState`/`saveWorkflowState`.
- **`workflow_state` table** (schema addition) — resumable orchestrator state
  per project (scan_state, completed_stages, per-discipline status).
- **`src/orchestrator/convex-port.ts` — `ConvexPersistence`** — implements
  `PersistencePort` by calling those functions through an injected
  `ConvexRunner` (a Convex action ctx in production; a convex-test handle in
  tests). The Phase 3 `Orchestrator` now runs unchanged against the real schema.

### Inference cache (file 20 §2)

- **`src/llm/cache.ts`** — `cacheKey()` (the file-20 formula:
  hash(model + prompt_version + document_sha256 + agent_id + corpus_version)),
  `CachingLLMClient` (an `LLMClient` decorator: cache hit ⇒ ~0 cost, no model
  call), `MemoryCacheStore`, and the `CacheStore` interface.
- **`src/convex/cache.ts`** — `getCached` (TTL-gated), `putCached` (30-day TTL),
  `purgeExpired`. **`src/llm/cache-convex.ts` — `ConvexCacheStore`** bridges the
  decorator to those functions (provider recovered from the model id on read).
- **`src/convex/crons.ts`** — daily `purgeExpired` cron.

### Title-block classifier (file 20 §3)

- **`src/classify/`** — the 3-source weighted classifier: title-block vision
  (0.9 with a discipline code, else 0.8) > first-2000-char content (0.6) >
  filename (~0.2–0.55). PDF rendering and text extraction are injected
  (`PdfRenderer` / `TextExtractor`) so the logic is testable without the pdf
  toolchain. `filename.ts` parses discipline code, drawing number and revision.

---

## Verification (in the build environment)

- `npm test` — **23/23 pass** (6 new Phase 4 + 17 prior). New tests: the
  `ConvexPersistence` port round-trips findings / state / adjudications (council
  decision stamped) / report (sections + disclaimer) against the real schema via
  convex-test; the cache returns a hit without re-calling the model and persists
  to `inference_cache`; the classifier picks title-block > content > filename.
- `npm run typecheck` — clean. `npm run lint` — 0 errors.
- `npx convex codegen` — clean (new tables + functions).

Live-credential checks (real Anthropic/OpenAI, R2, `npx convex dev`) remain
"verify locally", as in earlier phases.

---

## Deviations / decisions

1. **`runReview` node action + scheduled job-dispatch `tick` deferred.** Running
   the agents inside a Convex action needs the prompt files at runtime, but
   `PromptLoader` reads them via `node:fs` and Convex can't read arbitrary repo
   files in a deployment. The honest unblock is **prompt bundling** (a generated
   module embedding the `verifiq-prompts/` content), which lands with `runReview`
   in Phase 5. The cache-purge cron ships now because it has no prompt
   dependency. The persistence port + queue functions are fully in place, so
   wiring the action on top is small once prompts are bundled.
2. **Classification-confirmation UX not built.** That screen is UI, which is
   Phase 7 in file 16 (and an early-UI anti-pattern). Phase 4 builds the
   classifier *logic* + the `documents.classifier_confidence` field that the
   screen will read; the reclassification-feedback capture lands with the UI.
3. **Adjudicated state on the finding row.** `loadAdjudicated` returns finding
   rows whose `council_decision` is set and ≠ "Deleted" — the accepted register
   lives on the §05.1 rows, with the `adjudications` table holding the decision
   audit trail (file 06).
4. **Cache key uses the role as the model proxy** at write time and records the
   resolved model id; provider is recovered from the model id on read (the
   `inference_cache` row stores model, not provider). No schema change needed.

---

## Open questions for Phase 5

1. **Prompt bundling + `runReview` action + scheduled dispatch tick** (dev. 1).
2. **PDF toolchain** — concrete `PdfRenderer` (pdf2pic) + `TextExtractor`
   (pdf-parse) implementations behind the injected interfaces.
3. **Classification-confirmation UX** + `classifier_feedback` capture (file 20
   §4 / file 15).
4. **tus.io resumable upload** (platform mandatory #1, file 20 §1).

---

## Estimated Phase 5 readiness

**Ready.** The orchestrator now persists to Convex through a tested port, the
inference cache is wired, and the classifier logic is in place behind clean
ports. Phase 5 is the deploy-time glue (prompt bundling + the node action +
scheduled dispatch) and the concrete PDF adapters.
