# VerifIQ — Claude Code Execution Plan

**Doc ID:** `verifiq-claude-code-exec-v1.0`  
**Date:** 2026-06-06  
**Supersedes:** `docs/28-claude-code-phase1-kickoff.md` (partial — this adds upload workflow + UI + test gates)

> **For agentic workers:** Execute phases in order. Stop at each gate for founder sign-off. Wireframes in `website/workflow-index.html` are UI source of truth.

**Goal:** Ship upload → classify → scan → release with 7 platform mandatories and Playwright CI green before first paid pack.

**Architecture:** Next.js 14 (App Router) + Convex + R2 + tus.io + Clerk + Resend. Job queue in Convex scheduled functions. LLM via provider adapter.

**Tech stack:** TypeScript strict, Convex, Anthropic primary / OpenAI fallback, Playwright, Vitest, Sentry, Grafana Cloud.

---

## Pre-flight (human — before pasting any prompt)

```bash
# 1. Environment
cd verifiq26/src
# Create .env.local from template (Claude Code will create .env.local.example in Phase 1)

# 2. Required accounts
# - Convex (EU)
# - Cloudflare R2 (EU)
# - Anthropic + OpenAI API keys
# - Clerk
# - Resend
# - Sentry

# 3. Confirm Convex file storage limits (email Convex support — Week 1 gate)

# 4. Walk wireframes
cd ../website && npx serve . -l 3000
# Open http://localhost:3000/workflow-index.html
```

**Required env vars:**

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=verifiq-prod-eu-west
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
RESEND_API_KEY=
SENTRY_DSN=
```

---

## Phase map (aligned to PROJECT_PLAN.md)

| Phase | Weeks | Deliverable | Gate doc |
|-------|-------|-------------|----------|
| 1 | 1 | Schema + adapters + smoke test | 28 kickoff DoD |
| 2 | 1–2 | LLM provider adapter | 16 § Phase 2 |
| 3 | 2–3 | Six MVP agents | 16 § Phase 3 |
| 4 | 3 | Job queue | 20 §2, G-02 |
| 5 | 4 | Peer challenge + adjudication | 16 § Phase 5 |
| 6 | 4–5 | Council chair + exports | 16 § Phase 6 |
| 7a | 5 | tus upload + upload hub + magic link | wireframes + G-01 |
| 7b | 6 | Classifier + confirm UX | wireframes + G-03, G-04 |
| 7c | 7 | Scan state + observability + CI | wireframes + G-05–G-07 |
| 7d | 7–8 | Build readiness + findings UI | wireframes |
| 8 | 8+ | Playwright full suite | doc 31 |
| 9 | 8 | Validation pack E2E | G-12 |

---

## Phase 1 — Foundation (paste into Claude Code)

---START PHASE 1---

You are building **Phase 1** of VerifIQ. Read first:

1. `verifiq-prompts/CLAUDE.md`
2. `verifiq-prompts/05_output_schemas.md`
3. `verifiq-prompts/20_platform_architecture.md` § storage
4. `docs/30-gap-analysis.md` — fix G-08 (schema)
5. `docs/28-claude-code-phase1-kickoff.md` — Deliverables 1–5

**Critical fix:** Replace `src/convex/schema.ts` with VerifIQ MVP tables:

- `organizations`, `users`, `projects`, `intake_answers`
- `upload_invitations`, `discipline_uploads`, `documents`
- `scan_states`, `jobs`, `findings`, `classifier_feedback`
- `audit_log`, `inference_cache`

Include indexes on: `project_id`, `status`, `discipline`, `sha256`, `idempotency_key`.

Implement:

- `src/llm/` — provider adapter (Anthropic + OpenAI fallback)
- `src/storage/` — R2 + Convex interface per doc 27
- `tests/smoke.test.ts` — project + document + LLM + finding + audit_log
- `.env.local.example`, `convex.json`, scaffold Next.js 14 in `src/app/`

**Do NOT:** build agents, UI screens, Stripe, or email yet.

**DoD:** `npx tsc --noEmit` clean, `npx convex dev` deploys, smoke test passes.

---END PHASE 1---

---

## Phase 4 — Job queue (after Phase 3 agents exist)

---START PHASE 4---

Read `verifiq-prompts/20_platform_architecture.md` §2 and `docs/30-gap-analysis.md` G-02.

Implement:

- `jobs` table with fields per spec
- `convex/crons.ts` — `tick_queue` every 60s
- Job types: `classify`, `review_discipline`, `cross_reference`, `peer_challenge`, `adjudicate`, `report`
- `depends_on` resolution — only run when deps succeeded
- Per-discipline isolation — Arch tree independent of M&E
- Idempotency via `inference_cache`
- Audit log via mutations only

Refactor `scan.ts` to enqueue jobs instead of inline long actions.

**DoD:** Kill mid-scan → resume from last succeeded job. Vitest: JQ-01, JQ-02, JQ-03 scenarios.

---END PHASE 4---

---

## Phase 7a — Upload flow (wireframe-driven)

---START PHASE 7a---

Read wireframes:

- `website/upload-hub.html`
- `website/upload-magic-link.html`
- `verifiq-prompts/20_platform_architecture.md` §1

Build Next.js routes:

- `/projects/[id]/upload` — upload hub (match wireframe)
- `/upload/[token]` — public magic-link page (no Clerk)

Backend:

- `upload_invitations` — create, resend, hash token, expire
- tus.io client (Uppy or `@tus/js-client`) → R2 signed URLs via `storage/r2.ts`
- Service Worker + IndexedDB for resume (**Ruflo R1**)
- SHA-256 client + server verify
- On complete → `submitDisciplineZip` or per-file tus completion handler
- Resend email `upload-invite`, `upload-gate-complete`

Match Atelier visual style from `onboarding-wizard.html` (dark gold).

**DoD:** Playwright UH-01–04, ML-01–06 pass. Ruflo R1–R4 checklist rows pass.

---END PHASE 7a---

---

## Phase 7b — Classification gate

---START PHASE 7b---

Read:

- `website/classify-confirm.html`
- `verifiq-prompts/20_platform_architecture.md` §3–4
- `src/convex/actions/classify.ts` — extend with title-block vision

Build:

- `/projects/[id]/classify` — confirmation table
- 3-source classifier: filename → title-block vision → content fallback
- `classifier_feedback` on every correction
- `projects.confirmClassification` mutation — gates scan start
- `projects.startScan` — only when all low-confidence rows confirmed

**DoD:** Playwright CL-01–06 pass. GStack G7–G8 on sample files.

---END PHASE 7b---

---

## Phase 7c — Scan state + observability + CI

---START PHASE 7c---

Read:

- `website/dashboard-live.html`
- `verifiq-prompts/20_platform_architecture.md` §5–7

Build:

- `scan_states` table + state machine transitions
- `api.scan.getState` reactive query — wire dashboard
- Resend emails on every transition (templates in doc 29)
- Sentry frontend + Convex
- Grafana metrics: scan_duration, token_cost, error_rate
- GitHub Action: validation pack test (doc 31 § Suite 12)

**DoD:** Playwright SS-01–06, EM-01–03 pass. GStack G10 CI green on preview.

---END PHASE 7c---

---

## Phase 7d — Release screens

---START PHASE 7d---

Read:

- `website/build-readiness.html`
- `website/scan-result-free.html`
- `verifiq-prompts/09_app_frontend_prompt.md`
- `verifiq-prompts/06_risk_rules.md`

Build:

- `/projects/[id]/readiness` — 4 decisions, action matrix, exports
- `/projects/[id]/findings` — register with filters
- PDF / XLSX export with locked disclaimer
- Chair agent produces exactly one `BuildReadinessDecision` enum

**DoD:** Playwright BR-01–05, FR-01–04, DC-01–03 pass.

---END PHASE 7d---

---

## Phase 8 — Playwright implementation

---START PHASE 8---

Implement full test plan from `docs/31-playwright-test-plan.md`:

- Page objects for all 7 screens
- Fixtures: sample ZIPs, auth, project factory
- CI workflow `.github/workflows/e2e.yml`
- Visual regression baselines for wireframes

**DoD:** Suites 01–11 green on PR. Suite 12 green on main (may take 4h).

---END PHASE 8---

---

## Master kickoff prompt (paste this to start a fresh Claude Code session)

---START KICKOFF---

You are building VerifIQ — Irish pre-build compliance council platform.

**Read in order:**

1. `verifiq-prompts/CLAUDE.md`
2. `docs/29-launch-readiness-package.md`
3. `docs/30-gap-analysis.md`
4. `docs/32-claude-code-execution-plan.md` (this file)
5. `website/workflow-index.html` — open in browser, walk all steps
6. `verifiq-prompts/20_platform_architecture.md`
7. `PROJECT_PLAN.md` § Build Programme

**Execute Phase 1 first.** Stop when Phase 1 DoD is met. Write `docs/33-phase1-completion.md` (do not overwrite doc 29).

**Rules:**

- Wireframes are UI source of truth — pixel-faithful Atelier style
- Close P0 gaps G-01 through G-12 before declaring launch-ready
- No inline prompts — load from `verifiq-prompts/`
- No compliance score 0–100
- No AI chat interface
- Audit log from day 1

**After each phase:** run `npx tsc --noEmit` and relevant Playwright suite.

---END KICKOFF---

---

## Better recommendations (vs Claude Code only)

| Practice | Why |
|----------|-----|
| **Phased gates with founder sign-off** | Prevents 12-week drift |
| **Cursor for wireframe → Next.js** | Faster UI iteration with visual diff |
| **Playwright before Phase 7 complete** | Catch upload/classify regressions early |
| **Convex preview per PR** | Isolated validation pack runs |
| **Ruflo review Week 5** | Upload resilience before real packs |
| **GStack review Week 7** | Full-stack before observability sign-off |
| **Paper prototype with panel chair** | Council doc 25 hard rule — parallel to build |
| **Do not one-shot MVP** | 16_issuance_commands phased pattern |

---

## Anti-patterns (explicit)

- ❌ Skip classification confirm gate "for speed"
- ❌ Single Convex action for full scan
- ❌ Filename-only classifier in production
- ❌ Deploy without validation pack CI test
- ❌ Modify `verifiq-prompts/` during build
- ❌ Use existing `schema.ts` without replacing — it is the wrong product

---

## Completion checklist (launch)

- [ ] All wireframe routes implemented in Next.js
- [ ] docs/30 P0 gaps G-01–G-12 closed
- [ ] docs/31 suites 01–11 green
- [ ] docs/31 suite 12 green on main
- [ ] Ruflo R1–R12 signed
- [ ] GStack G1–G12 signed
- [ ] First paid pack (Week 12 gate)
- [ ] `docs/34-launch-completion.md` written

---

*End of Claude Code execution plan · v1.0*
