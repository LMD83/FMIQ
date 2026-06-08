# 36 · Playwright E2E + CI Test Plan

**Doc ID:** `verifiq-test-plan-v0.1`
**Status:** Spec. The merge gate that also stops the two build tracks diverging.
**Date:** 2026-06-08

---

## Why this is the highest-leverage piece

A required validation-pack check on `main` does three jobs at once: it satisfies
the file-20 §7 mandate, it catches regressions before customers, and — because
**neither track can merge a red gate** — it forces both AI build tracks onto one
source of truth. (The base CI gate — typecheck + lint + unit tests — ships in
`.github/workflows/ci.yml`; this doc covers the E2E + validation layers on top.)

## The 11 E2E suites (map the wireframe flow)

| # | Suite | Asserts |
|---|---|---|
| 01 | Intake wizard | 17 fields → project created → redirect to upload hub; required-field validation |
| 02 | Upload hub / magic links | per-discipline magic links generated; statuses; expiry |
| 03 | Resumable upload (tus.io) | chunked progress; **kill mid-upload → resume from last byte**; SHA-256 integrity; tab-close survival |
| 04 | Classify-confirm gate | confidence badges; **low-confidence rows block "Start scan"**; reclassify writes `classifier_feedback`; gate opens when all confirmed |
| 05 | Live scan / scan-state | state-machine transitions render reactively; per-discipline progress; **one discipline fails → others continue** |
| 06 | Build-readiness decision | **rating↔decision invariant** (Green→Proceed … Red→Pause … Grey→Insufficient); disclaimer present |
| 07 | Findings register | grouped findings; **verbatim source quotes**; feedback (accept / reject REJ-01..12); exports (PDF/XLSX/CSV/JSON) carry disclaimer + corpus version + doc hashes |
| 08 | Auth / multi-tenant | Clerk login; **cross-tenant `project_id` access denied** (directly tests the IDOR class flagged in PR #8 review) |
| 09 | Audit log | every transition logged; reviewer signature + corpus stamp |
| 10 | Guardrails | no banned verbs on any surface; disclaimer on every export/footer |
| 11 | **Validation-pack gate** | the 327-finding pack end-to-end (test-mode Haiku): ≥N findings; the 3 known criticals (C-01/02/03) surface; disclaimer in every export; no PII leak |

## Config & mechanics

- **`playwright.config.ts`:** `projects` for chromium/firefox/webkit; `webServer`
  boots `next dev` **and** a seeded Convex (convex-test or an ephemeral preview);
  `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `baseURL` from env;
  CI sharding.
- **Deterministic LLM in test mode (the linchpin):** point `createLLM` at the
  `FakeLLM` fixture provider (the pattern already in the Vitest suites) so scans
  are reproducible and free. Real-provider E2E is a separate nightly, *not* the
  merge gate.
- **Fixtures:** a seeded Convex test deployment per run; Clerk `storageState` for
  auth; sample packs (a 10-doc smoke pack for 01–10; the 327-pack for suite 11).
- **`data-testid` contract** agreed between the UI track and the tests up front,
  or 03–07 will be brittle.

## CI integration (extends `.github/workflows/ci.yml`)

1. **Every PR:** `npm ci` → `typecheck` → `lint` → `vitest` (already live) →
   Playwright suites **01–10** (Haiku/fake LLM).
2. **Required gate before prod:** suite **11** (validation pack) — ~12 min on
   Haiku, ~€2/run; **blocks merge** if it regresses.
3. **Convex codegen job:** add `npx convex codegen` (with a `CONVEX_DEPLOY_KEY`
   secret) so `_generated` is real-typed in CI rather than the committed stub;
   then `_generated` can be `.gitignore`d.
4. **Map each suite → Ruflo (R1–R12) / GStack (G1–G12) checklist rows** so a green
   run *is* the sign-off evidence.

## Sequence

1. `playwright.config.ts` + the deterministic test-mode LLM wiring + `data-testid`
   contract.
2. Suites **04, 05, 06, 07, 08** first (the trust-critical flow + the IDOR test).
3. Suite **11** validation-pack gate → make it a required check on `main`.
4. Suites **01, 02, 03** (intake/upload) as the UI lands.

*Standing up suite 11 as a required check is also the concrete fix for the
duplicate-PR / track-divergence problem.*
