# VerifIQ — Gap Analysis (Upload → Release)

**Doc ID:** `verifiq-gap-analysis-v1.0`  
**Date:** 2026-06-06  
**Baseline:** Spec (`verifiq-prompts/`), wireframes (`website/`), code (`src/convex/`), tests (none yet).

**Legend:** ✅ Done · 🟡 Partial · ❌ Missing · 🔴 Launch blocker

---

## Executive summary

| Layer | Coverage | Launch risk |
|-------|----------|-------------|
| Spec / prompts | ~95% | Low |
| HTML wireframes | ~85% (11/13 app screens) | Medium |
| Backend code | ~35% (upload/classify/scan scaffold) | **High** |
| Next.js app | ~0% | **High** |
| Platform mandatories (7) | ~10% | **Critical** |
| Automated tests | ~0% | **Critical** |
| Observability / CI | ~0% | **Critical** |

**P0 before first paid pack:** Close gaps G-01 through G-12 (below).

---

## Screen-by-screen gap matrix

| Screen | Wireframe | Next.js route | Convex API | Tests | Priority |
|--------|-----------|---------------|------------|-------|----------|
| Onboarding wizard | ✅ `onboarding-wizard.html` | ❌ `/onboard` | ❌ `projects.createFromBrief` | ❌ | P1 |
| Upload hub | ✅ `upload-hub.html` | ❌ `/projects/[id]/upload` | 🟡 invitations schema missing | ❌ | P0 |
| Magic-link upload | ✅ `upload-magic-link.html` | ❌ `/upload/[token]` | 🟡 `uploads.ts` (ZIP only, no tus) | ❌ | P0 |
| Classify confirm | ✅ `classify-confirm.html` | ❌ `/projects/[id]/classify` | 🟡 classify action, no confirm gate | ❌ | P0 |
| Atelier dashboard | ✅ `dashboard-live.html` | ❌ `/projects/[id]` | ❌ `scan.getState` reactive | ❌ | P0 |
| Build readiness | ✅ `build-readiness.html` | ❌ `/projects/[id]/readiness` | ❌ chair report | ❌ | P1 |
| Findings register | ✅ `scan-result-free.html` | ❌ `/projects/[id]/findings` | 🟡 findings in schema mismatch | ❌ | P1 |
| Peer challenge table | ❌ | ❌ | ❌ | ❌ | P2 |
| Adjudicated register | ❌ | ❌ | ❌ | ❌ | P2 |
| Report export | 🟡 buttons on build-readiness | ❌ | ❌ PDF/DOCX/XLSX | ❌ | P1 |
| Module activation summary | ❌ | ❌ | ❌ regulatory trigger engine | ❌ | P2 |

---

## Platform mandatory gaps (7)

| # | Mandatory | Spec ref | Wireframe | Code | Test | Gap ID |
|---|-----------|----------|-----------|------|------|--------|
| 1 | tus.io resumable upload | 20 §1 | 🟡 simulated in magic-link HTML | ❌ | ❌ | **G-01** |
| 2 | Job queue + per-discipline isolation | 20 §2 | — | ❌ | ❌ | **G-02** |
| 3 | Title-block vision classifier | 20 §3 | — | 🟡 filename + cheap LLM only | ❌ | **G-03** |
| 4 | Classification confirmation UX | 20 §4 | ✅ `classify-confirm.html` | ❌ forced-confirm logic | ❌ | **G-04** |
| 5 | Scan-state model + email | 20 §5 | ✅ `dashboard-live.html` | ❌ | ❌ | **G-05** |
| 6 | Observability | 20 §6 | — | ❌ | ❌ | **G-06** |
| 7 | CI/CD + validation pack test | 20 §7 | — | ❌ | ❌ | **G-07** |

---

## Backend code gaps

| Component | File | Status | Gap |
|-----------|------|--------|-----|
| Magic-link upload | `actions/uploads.ts` | 🟡 | Missing: tus path, R2 adapter, invitation mutations |
| Classification | `actions/classify.ts` | 🟡 | Missing: title-block vision, `classifier_feedback` table |
| Per-discipline scan | `actions/scan.ts` | 🟡 | Missing: job queue integration, peer challenge |
| Cross-discipline | `actions/coordinate.ts` | 🟡 | Missing: trigger when N disciplines complete |
| Schema | `schema.ts` | 🔴 | **Wrong schema** — GovIQ design review, not VerifIQ MVP tables |
| LLM adapter | `lib/anthropic-client.ts` | 🟡 | Missing: provider interface, OpenAI fallback |
| Storage adapter | — | ❌ | R2 / Convex storage interface not implemented |
| Email | — | ❌ | Resend not wired |
| Auth | — | ❌ | Clerk not wired |

---

## Workflow stage gaps (03_review_workflow.md)

| Stage | Spec | Automated? | Gap |
|-------|------|------------|-----|
| 1 Project intake | 17 fields + wizard | ❌ | Persist `intake_answers` |
| 2 Upload + classify | 3-source classifier | 🟡 | tus + confirm UX |
| 3 Regulatory triggers | Module activation | ❌ | Engine from intake |
| 4 Discipline review | 6 MVP agents | 🟡 | scan.ts partial |
| 5 Peer challenge | Interface matrix | ❌ | No engine |
| 6 Adjudication | Immutable decisions | ❌ | No engine |
| 7 Council report | 4 decisions + exports | ❌ | No chair agent |

---

## P0 launch blockers (must close)

| ID | Gap | Owner phase | Est. |
|----|-----|-------------|------|
| G-01 | tus.io + R2 signed URLs | Phase 7a | 2 wk |
| G-02 | Job queue `jobs` table + `tick_queue` | Phase 4 | 3 wk |
| G-03 | Title-block vision classifier | Phase 7b | 1 wk |
| G-04 | Classification confirm gate in API + UI | Phase 7b | 3 d |
| G-05 | `scan_states` table + Resend emails | Phase 7c | 1 wk |
| G-06 | Sentry + metrics + Grafana | Phase 7c | 2 d |
| G-07 | CI validation pack integration test | Phase 7c | 2 d |
| G-08 | Replace schema with VerifIQ MVP tables | Phase 1 | 3 d |
| G-09 | Next.js app scaffold + 7 wireframe routes | Phase 7 | 2 wk |
| G-10 | Playwright E2E suite (doc 31) | Phase 7c | 1 wk |
| G-11 | Clerk auth on all project routes | Phase 7a | 3 d |
| G-12 | End-to-end 327-finding validation pack | Week 8 gate | 3 d |

---

## P1 (before first paid pack, not blocking dev start)

- Build readiness report PDF export
- Stripe billing + tier enforcement
- `classifier_feedback` → lessons learnt loop
- Peer challenge + adjudication UI wireframes

---

## P2 (post-MVP)

- Programme tier multi-pack
- Real-time Slack/Teams push
- Drawing comparison Rev A vs B

---

## Ruflo gap comments (reliability)

| Item | Finding | Severity |
|------|---------|----------|
| No Service Worker for upload | tus spec requires background survivability | 🔴 |
| No idempotency cache table | Retry will double-charge LLM | 🔴 |
| No stalled-upload email job | Customer silent failure | 🟡 |
| `uploads.ts` uses /tmp in Convex action | May not work in all Convex runtimes | 🟡 |

*Ruflo reviewer: attach comments here before Week 5 sign-off.*

---

## GStack gap comments (full-stack)

| Item | Finding | Severity |
|------|---------|----------|
| Schema mismatch | `schema.ts` is wrong product | 🔴 |
| No `.env.local.example` | Dev onboarding blocked | 🟡 |
| No `convex.json` / no `node_modules` | App won't start | 🔴 |
| Wireframes not linked from Next.js | UI drift risk | 🟡 |

*GStack reviewer: attach comments here before Week 7 sign-off.*

---

## Recommended close order

1. **Phase 1** — Fix schema, LLM adapter, R2 adapter, smoke test (G-08)
2. **Phase 4** — Job queue (G-02)
3. **Phase 7a** — tus upload + upload hub + magic link routes (G-01, G-09, G-11)
4. **Phase 7b** — Classifier + confirm screen (G-03, G-04)
5. **Phase 7c** — Scan state, observability, CI, Playwright (G-05, G-06, G-07, G-10)
6. **Week 8** — Validation pack E2E (G-12)

---

*End of gap analysis · v1.0*
