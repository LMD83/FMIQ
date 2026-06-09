# ADR-001 · Canonical review stack & generated-file policy

**Status:** Accepted · **Date:** 2026-06-09 · **Owner:** `main` integrator

## Context

VerifIQ was built by two parallel sessions whose divergent stacks repeatedly
collided on merge, leaving `main` red or green-locally-but-broken-from-clean, and
at one point re-opening an IDOR. A decision was taken to converge on **one**
stack — the **review-dispatch** stack — and retire the alternative.

## Decision

1. **Canonical review stack = the review-dispatch layer.**
   - `src/convex/review.ts` (`runReview` `"use node"` action) +
     `src/convex/reviewData.ts` (`requestReview` public entry, ownership-checked;
     `resumeStalled` 15-min cron) + `src/convex/workflow.ts` +
     `src/orchestrator/convex-port.ts` (`ConvexPersistence`) +
     `src/llm/cache.ts` (`CachingLLMClient`) + `src/convex/cache.ts`.
   - Classifier: **`src/classify/`**. Prompt bundle: **`src/agents/
     prompts.generated.ts`** (export `BUNDLED_PROMPTS`, via `bundledPromptLoader()`),
     **gitignored + regenerated** by `scripts/bundle-prompts.mjs`.
   - The alternative **queue-runner** stack (`src/convex/runner.ts`,
     `src/orchestrator/{runner,council,convex-persistence}.ts`, a second prompt
     bundle, `src/classifier/`, and the geo/extraction/procurement modules) is
     **retired** — do not re-add it.

2. **Security: no public data mutation without auth.** `src/convex/jobs.ts` is
   `internal*` only (queue helpers; closed the IDOR). The single public write is
   `reviewData.requestReview` (ownership-checked). `classify.ts` / `mutations.ts`
   public functions are the known Clerk-auth deferral (Phase 6) — wrap them in
   project-membership auth before production.

3. **One generated artifact per concern, gitignored + regenerated, never
   committed.** Convex `_generated/` (via `scripts/gen-convex-stub.mjs` offline,
   `npx convex codegen` live) and the prompt bundle. A committed generated file is
   a defect.

## Enforcement

- `scripts/check-hygiene.mjs` (CI `check:hygiene` + `tests/hygiene.test.ts`):
  fails on duplicate `package.json` keys, any tracked-but-gitignored file, and any
  committed `*.generated.ts` / `*.bundle.ts`.
- CI (`.github/workflows/ci.yml`) builds from a **clean checkout** — it produces
  every generated artifact itself (`codegen:stub` + `bundle:prompts`), so a
  missing/mis-named generated file fails CI even when a dirty local tree hides it.

## Consequence

Future sessions converge on the review-dispatch stack. Any PR that re-adds the
retired queue-runner stack, a second classifier dir, a second prompt bundle, or a
public data mutation is rejected by the guard + review.
