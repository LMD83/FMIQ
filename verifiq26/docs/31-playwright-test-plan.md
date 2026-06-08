# VerifIQ — Playwright Test Plan

**Doc ID:** `verifiq-playwright-v1.0`  
**Date:** 2026-06-06  
**Goal:** Flawless launch — automated E2E, visual regression, upload resilience, and validation-pack gate in CI.

---

## Test pyramid

```
                    ┌─────────────────┐
                    │  Validation     │  1 test · 327-finding pack · weekly
                    │  pack E2E       │
                    └────────┬────────┘
               ┌─────────────┴─────────────┐
               │  Playwright E2E (12 flows) │  PR + main
               └─────────────┬─────────────┘
          ┌──────────────────┴──────────────────┐
          │  API / Convex integration (vitest)     │  PR
          └──────────────────┬──────────────────┘
     ┌─────────────────────┴─────────────────────┐
     │  Unit: classifier, source-quote, schema    │  PR
     └───────────────────────────────────────────┘
```

---

## Setup

```bash
cd verifiq26/src
npm install -D @playwright/test
npx playwright install chromium
```

**Directory structure:**

```
verifiq26/
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/
│   │   ├── auth.ts          # Clerk test user session
│   │   ├── project.ts       # create test project via API
│   │   └── sample-zip/      # 5-file discipline ZIP fixtures
│   ├── pages/
│   │   ├── onboarding.page.ts
│   │   ├── upload-hub.page.ts
│   │   ├── magic-link.page.ts
│   │   ├── classify.page.ts
│   │   ├── dashboard.page.ts
│   │   └── readiness.page.ts
│   └── specs/
│       ├── 01-onboarding.spec.ts
│       ├── 02-upload-hub.spec.ts
│       ├── 03-magic-link-upload.spec.ts
│       ├── 04-classify-confirm.spec.ts
│       ├── 05-scan-state.spec.ts
│       ├── 06-build-readiness.spec.ts
│       ├── 07-findings-register.spec.ts
│       ├── 08-auth-guards.spec.ts
│       ├── 09-email-triggers.spec.ts      # mock Resend webhook
│       ├── 10-job-queue-resume.spec.ts    # API-level
│       ├── 11-disclaimer-present.spec.ts
│       └── 12-validation-pack.spec.ts     # CI gate only
└── evidence/
    └── findings-register-v0.8-scan-view.xlsx
```

---

## Environment matrix

| Env | Base URL | When |
|-----|----------|------|
| `local` | `http://localhost:3000` | Dev |
| `wireframe` | `http://localhost:3000` (static serve `website/`) | Until Next.js exists |
| `preview` | `https://*.vercel.app` | PR checks |
| `staging` | Convex preview deployment | PR + main |
| `prod` | `verifiq.ie` | Smoke only post-deploy |

**Phase 1 (wireframes only):** Run against `npx serve website -l 3000` with `baseURL` override until Next.js routes exist.

---

## E2E test cases

### Suite 01 — Onboarding (`01-onboarding.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| ONB-01 | Load wizard | Title "Request the brief" |
| ONB-02 | Step I sector select | Continue enabled after tile click |
| ONB-03 | Full 8-step flow | Summary shows corpus + tier |
| ONB-04 | Back button | Returns to previous step |
| ONB-05 | Submit brief | Redirect or success state (mock API) |

### Suite 02 — Upload hub (`02-upload-hub.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| UH-01 | Load hub for project | 7 discipline gates visible |
| UH-02 | Done gate shows file count | "SHA verified" text |
| UH-03 | Resend link button | API called (mock) |
| UH-04 | All gates done | "Confirm classification" link enabled |

### Suite 03 — Magic-link upload (`03-magic-link-upload.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| ML-01 | Invalid token | 410 / error message |
| ML-02 | Expired token | Error message |
| ML-03 | Pick ZIP file | Progress bar advances |
| ML-04 | Upload complete | "files extracted" + SHA verified |
| ML-05 | ZIP > 1 GB | Rejected before upload (API) |
| ML-06 | Network drop resume | tus mock resumes from chunk N (**Ruflo R1**) |

### Suite 04 — Classification confirm (`04-classify-confirm.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| CL-01 | Low-confidence rows highlighted | amber warning |
| CL-02 | Start scan disabled | until all warnings confirmed |
| CL-03 | Confirm row | status → confirmed |
| CL-04 | Reclassify dropdown | discipline updates |
| CL-05 | Start scan enabled | navigates to dashboard |
| CL-06 | Correction persisted | `classifier_feedback` mutation (API) |

### Suite 05 — Scan state (`05-scan-state.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| SS-01 | Dashboard loads pack | Pack ID, ETA visible |
| SS-02 | Discipline card states | uploading/scanning/review labels |
| SS-03 | Live feed updates | new item within 5s (mock SSE) |
| SS-04 | Counters increment | findings count changes |
| SS-05 | Coordination bar | updates when disciplines close |
| SS-06 | Reactive query | state change without full reload |

### Suite 06 — Build readiness (`06-build-readiness.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| BR-01 | Decision displayed | one of 4 enum values |
| BR-02 | Tab switch | Proceed / Pause / Insufficient panels |
| BR-03 | Critical blockers listed | ≥1 for Conditions fixture |
| BR-04 | Export buttons | trigger download or API |
| BR-05 | Disclaimer present | locked disclaimer text |

### Suite 07 — Findings register (`07-findings-register.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| FR-01 | Severity counters | 4 tiles |
| FR-02 | Finding card | source quote present |
| FR-03 | Filter by discipline | table rows filter |
| FR-04 | Free tier redaction | full register behind paywall |

### Suite 08 — Auth guards (`08-auth-guards.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| AG-01 | `/projects` without auth | redirect to Clerk sign-in |
| AG-02 | Magic link public | no auth required |
| AG-03 | Wrong org project | 403 |

### Suite 09 — Email triggers (`09-email-triggers.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| EM-01 | Upload complete | Resend mock received `upload-gate-complete` |
| EM-02 | Scan started | `scan-started` template |
| EM-03 | Pack released | `pack-released` with link |

### Suite 10 — Job queue (`10-job-queue-resume.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| JQ-01 | Failed discipline job retries | status → retrying |
| JQ-02 | Arch failure does not block M&E | M&E job succeeds |
| JQ-03 | Idempotency | duplicate job_key skipped |

### Suite 11 — Disclaimer (`11-disclaimer-present.spec.ts`)

| ID | Test | Assert |
|----|------|--------|
| DC-01 | Every app screen | disclaimer string from `08_guardrails.md` |
| DC-02 | PDF export | disclaimer on page 1 |
| DC-03 | No banned verbs | grep export output |

### Suite 12 — Validation pack (`12-validation-pack.spec.ts`) — CI GATE

| ID | Test | Assert |
|----|------|--------|
| VP-01 | Upload HSE validation pack fixture | project created |
| VP-02 | Full pipeline to released | state = released within timeout |
| VP-03 | Finding count | ≥ 300 findings |
| VP-04 | Critical count | ≥ 3 critical |
| VP-03 | Source quotes | 100% findings have `source_quote` |
| VP-05 | Build readiness | exactly one decision enum |
| VP-06 | Regression budget | finding count within ±5% of baseline |

**Timeout:** 4 hours (run on schedule, not every PR).

---

## Visual regression

```typescript
// e2e/specs/visual/wireframes.spec.ts
const screens = [
  'workflow-index', 'onboarding-wizard', 'upload-hub',
  'upload-magic-link', 'classify-confirm', 'dashboard-live',
  'build-readiness', 'scan-result-free',
];
for (const s of screens) {
  test(`visual ${s}`, async ({ page }) => {
    await page.goto(`/${s}.html`);
    await expect(page).toHaveScreenshot(`${s}.png`, { maxDiffPixels: 100 });
  });
}
```

---

## CI configuration (GitHub Actions)

```yaml
# .github/workflows/e2e.yml
name: E2E
on: [pull_request, push]
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: verifiq26/src
      - run: npx playwright install --with-deps chromium
        working-directory: verifiq26/e2e
      - run: npx playwright test --grep-invert @validation-pack
        working-directory: verifiq26/e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: verifiq26/e2e/playwright-report }

  validation-pack:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    timeout-minutes: 240
    steps:
      - run: npx playwright test --grep @validation-pack
```

---

## Fixtures

| Fixture | Purpose |
|---------|---------|
| `sample-zip/arch-5files.zip` | Happy-path upload |
| `sample-zip/corrupt.zip` | Extraction failure |
| `sample-zip/oversized.zip` | >1 GB reject |
| `sample-zip/duplicate-hash.zip` | Abuse prevention |
| `evidence/findings-register-v0.8-scan-view.xlsx` | Validation pack baseline |

---

## Ruflo test obligations

| Ruflo ID | Playwright test |
|----------|-----------------|
| R1 | ML-06 |
| R4 | duplicate-hash fixture |
| R5 | JQ-01, JQ-02 |
| R7 | JQ-03 |
| R10 | EM-01, EM-02, EM-03 |

---

## GStack test obligations

| GStack ID | Playwright test |
|-----------|-----------------|
| G1 | AG-01, AG-02, AG-03 |
| G6 | DC-01, DC-02 |
| G7 | VP-03 schema assert |
| G8 | VP-03 source_quote |
| G9 | VP-05 |
| G10 | VP-01 through VP-06 |

---

## Definition of done — test suite

- [ ] All suites 01–11 pass on PR
- [ ] Suite 12 passes on main weekly
- [ ] Visual regression baselines committed
- [ ] &lt; 15 min PR e2e runtime
- [ ] Flake rate &lt; 2% over 10 runs
- [ ] Ruflo + GStack checklist rows mapped to test IDs

---

*End of Playwright test plan · v1.0*
