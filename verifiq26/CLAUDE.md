# CLAUDE.md — VerifIQ build context (auto-loaded)

This file orients any Claude Code session working in `verifiq26/`. It is a
pointer to the canonical spec plus a record of decisions already made. When it
conflicts with the spec, the spec wins — but read this first.

## What VerifIQ is

A multi-agent **Pre-Build Compliance Council** for the Irish construction
market that answers one question: *"Are we actually ready to build?"* It is
**not** a chatbot, not a document-search tool, not a compliance-score app. See
`verifiq-prompts/12_mvp_scope.md`.

## Canonical spec — read in this order

The source of truth is `verifiq-prompts/` (and `docs/`). Key files:

1. `verifiq-prompts/CLAUDE.md` — full agent orientation pack
2. `verifiq-prompts/01_master_system_prompt.md` — product identity, statuses, risks
3. `verifiq-prompts/02_agent_architecture.md` — the Council + role→provider map
4. `verifiq-prompts/05_output_schemas.md` — locked Finding / Summary / Report JSON
5. `verifiq-prompts/08_guardrails.md` — disclaimer, banned verbs/nouns, refusals
6. `verifiq-prompts/13_agent_self_check_protocol.md` — 7 pre-emit checks
7. `verifiq-prompts/14_feedback_taxonomy.md` + `15_lessons_learnt_loop.md`
8. `verifiq-prompts/16_issuance_commands.md` — phased build plan
9. `verifiq-prompts/20_platform_architecture.md` — job queue, classifier, scan-state
10. `docs/27-stack-decision-storage-and-platform.md` — Convex + R2 hybrid (locked)
11. `docs/28-claude-code-phase1-kickoff.md` — the authoritative Phase 1 brief
12. `PROJECT_PLAN.md` — the 12-week programme

## Locked architectural decisions — do not propose alternatives

- Backend: **Convex** (DB + functions + reactive queries + scheduled jobs)
- File storage: **Cloudflare R2** (S3-compatible, EU, zero-egress); `documents`
  carries both optional `storage_id` and `r2_key` — route by size.
- Frontend: **Next.js 14 App Router** on Vercel (Phase 2+)
- Auth: **Clerk** (stub in Phase 1). Billing: Stripe (Phase 2). Email: Resend (Phase 2).
- LLMs: Anthropic primary (Sonnet review/chair, Haiku classify, Sonnet-vision
  title-block), OpenAI GPT-4-class for peer challenge / fallback. Failover is
  **per-call, not per-scan**; on dual failure hold the pack in the reviewer queue.

## Anti-patterns — refuse these

- No inline prompts in source (prompts load from `verifiq-prompts/`).
- No hardcoded provider names outside the `LLMProvider` adapter.
- No hardcoded storage location outside the `StorageProvider` adapter.
- No AI chat interface for findings. No "compliance score 0–100".
- No skipping schema indexes or audit_log writes.
- Never commit `.env.local` or hardcode API keys.
- Keep banned verbs/nouns (file 08) out of code comments, errors, and output.

## Project layout (established Phase 1)

- Project root = `verifiq26/`. `package.json`, `tsconfig.json`, `convex.json`,
  `.env.local.example`, `vitest.config.ts` live here.
- Convex functions live in `src/convex/` (configured via `convex.json`
  `"functions": "src/convex/"`). Generated code lands in `src/convex/_generated/`.
- Adapters: `src/llm/`, `src/storage/`. Shared types: `src/types/`.
- Tests: `tests/`. Dev setup notes: `DEVELOPMENT.md`.

## Phase status & decisions

- **Phase 1 (done, merged):** schema + LLM adapter + R2 storage adapter + smoke
  test. The earlier `src/convex/` POC scaffold (`sp_dr_*` schema + inconsistent
  `actions/`/`lib/`) was deleted (recoverable from git) and replaced with the
  Phase 1 platform schema per §05.4. See `docs/29-phase1-completion.md`.
- **Phase 2 (done):** the six MVP agents in `src/agents/` — five discipline
  agents (Architect, Fire, Access, M&E, QS) + Chair. Each loads prompts from
  `verifiq-prompts/` (PromptLoader), applies the 7-check self-check validator
  (file 13) as a pre-emit gate, returns §05.1 Findings, and logs every
  self-check decision to an injected sink. Chair derives the file-06
  rating↔decision invariant in code. See `docs/30-phase2-completion.md`.
- **Phase 3 (done):** the resumable review-workflow orchestrator + job queue in
  `src/orchestrator/`, plus the Stage-5 Peer Challenge and Stage-6 Adjudicator
  engines in `src/agents/`. Runs review (per discipline, isolated) → peer
  challenge → adjudicate → chair as a job DAG; resumable + idempotent; all I/O
  behind an injected `PersistencePort`. Minimal Convex job-queue functions in
  `src/convex/jobs.ts`. See `docs/31-phase3-completion.md`.
  > **Canonical stack — see `docs/ADR-001-canonical-review-stack.md`.** Two
  > parallel sessions built divergent stacks; the queue runner won. Do NOT
  > re-add the retired track: `src/convex/review.ts`/`reviewData.ts`,
  > `requestReview`/`runReview`/`resumeStalled`, `src/orchestrator/convex-port.ts`,
  > `src/llm/cache-convex.ts`, `bundledPromptLoader()`, `src/classify/`, or a
  > second prompt bundle. Canonical names: `src/classifier/`,
  > `src/orchestrator/convex-persistence.ts`, `src/agents/prompts.bundle.ts`
  > (export `PROMPT_BUNDLE`, gitignored + regenerated).

- **Phase 4 (done):** the Convex binding. `ConvexPersistence`
  (`src/orchestrator/convex-persistence.ts`) runs the orchestrator against the
  real schema via internal `src/convex/persist.ts` + `workflow_state` table; the
  `inference_cache` is wired (`src/llm/cache.ts` + internal `src/convex/cache.ts`);
  the 3-source title-block classifier lives in `src/classifier/`; a daily
  cache-purge cron is in `src/convex/crons.ts`. See `docs/32-phase4-completion.md`.
- **Phase 5 (done):** the council runs on Convex via the **queue runner**. Prompt
  bundling (`scripts/bundle-prompts.mjs` → gitignored `src/agents/prompts.bundle.ts`,
  loaded via `PromptLoader` + `RecordPromptSource(PROMPT_BUNDLE)`) unblocks agents
  in the Convex runtime; the `"use node"` `tick` action (`src/convex/runner.ts`,
  driven by a 1-min cron) claims runnable jobs from internal `src/convex/jobs.ts`
  and runs the resumable pipeline (`createCouncil` + `ConvexPersistence` over the
  pure `drainQueue`). All queue/persist/cache functions are `internal*` (the IDOR
  fix). Plus the free-API GIS layer (`src/geo/`), PDF extraction (`src/extraction/`)
  and the procurement module (`src/procurement/`). See `docs/38-phase5-completion.md`.
- **Phase 6 (next):** concrete PDF render adapter (title-block image, Source 2),
  tus.io resumable upload (mandatory #1), the authed public "start review" entry
  (wrap `enqueueJob` behind Clerk membership), exports (PDF/DOCX/XLSX/CSV/JSON,
  §05.5), and the classification-confirmation UX. NOT started.

Note: the queue is internal-only, driven by the cron `tick`; there is no public
review entry yet. The Phase-6 authed entry wraps `enqueueJob` behind Clerk
project membership (assert `job.project_id` matches the payload). Wire real Clerk
auth before production.

Live-credential checks across phases remain "verify locally" (real
Anthropic/OpenAI calls, R2 signed URL, `npx convex dev` deploy).

## Definition of Done gate (docs/28)

`tsc --noEmit` clean, smoke test passes, schema deploys via `npx convex dev`,
Anthropic call works + OpenAI failover works, R2 signed upload URL works,
disclaimer exported as a constant, no banned verbs in code/output.
