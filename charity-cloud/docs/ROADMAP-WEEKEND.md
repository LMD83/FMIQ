# Charity Cloud — Weekend Roadmap (MVP → pilot-ready product)

This is the plan to take the working MVP in this repo to a charity-pilot-ready
product over a weekend. The MVP already proves the full golden path (W1→W4),
the 10 privacy rules in code, 35 passing tests, and a live end-to-end smoke
test. What remains is breadth, polish, real integrations, and operational
hardening.

Each item lists **why**, the **files** it touches, and a **done-when** gate.

---

## Saturday AM — Real auth, real identities, real data residency

### 1. Magic-link auth (replace password)  ·  ~2h
- **Why:** CLAUDE.md mandates email magic link only; password is an MVP shortcut.
- **How:** swap the `Password` provider in `convex/auth.ts` for the Convex Auth
  `Resend` (or `Email`) OTP/magic-link provider; set `AUTH_RESEND_KEY` (EU
  region) via `npx convex env set`. Update `src/auth/SignInForm.tsx` to the
  email-only flow.
- **Done when:** a user signs in by clicking an emailed link; no password field
  exists anywhere.

### 2. Convex EU data residency (BLOCKER from build script)  ·  ~1h
- **Why:** real requester data cannot touch a non-EU deployment.
- **How:** create the cloud project in Convex's EU region; document the region in
  `docs/05-architecture.md`. If EU is unavailable, trigger the ADR fallback
  (Postgres + Node, EU object storage). Until then the local backend is fine for
  demos (no real data).
- **Done when:** deployment region is EU and documented; CI deploys to it.

### 3. Charities Register — real source  ·  ~2h
- **Why:** the RCN check is currently a fixture (`convex/registerLookup.ts`).
- **How:** implement the `RegisterSource` interface against the public register
  (CKAN dataset export from data.gov.ie, cached 24h). Keep the fixture for tests.
  Promote it to the separate `services/register-lookup` Node service if rate
  limits require it.
- **Done when:** a real RCN verifies; a deregistered/unknown RCN is rejected.

---

## Saturday PM — Close the remaining product loops

### 4. Donor email alerts + impact receipts (W4/W5)  ·  ~2h
- **Why:** demand-led matching needs push, not just pull; receipts drive retention.
- **How:** a daily scheduled job (`convex/crons.ts`) batched by `geoCell` that
  emails donors new needs matching `alertCategories` within radius; fulfilment
  emails the donor impact receipt. Reuse `searchCells` + the events table.
- **Done when:** a seeded donor receives a digest; a fulfilled match emails a receipt.

### 5. EU-hosted, no-logging geocoder (BLOCKER)  ·  ~1.5h
- **Why:** the MVP uses a static routing-key table (`packages/shared/src/geo-ie.ts`)
  covering ~30 districts — fine for a Dublin pilot, not national.
- **How:** swap `resolveArea` to call an EU-hosted geocoder configured for
  no-logging, still snapping to geohash-5 and discarding the input. The interface
  is already the seam — no persistence changes.
- **Done when:** any Irish Eircode resolves; geocoder inputs are provably never logged.

### 6. Statement-of-reasons + privacy notices in-app  ·  ~1.5h
- **Why:** DSA Art 17 delivery exists server-side (`moderation.statementsForOrg`)
  but the 3 GDPR privacy notices (charity/donor/requester) aren't rendered.
- **How:** add `src/legal/` notice pages with copy placeholders for legal review;
  link from each role's console and the consent step.
- **Done when:** all three notices render and are linked from the relevant flows.

---

## Sunday AM — Accessibility & security hardening (P0)

### 7. WCAG 2.1 AA pass  ·  ~2.5h
- **Why:** the user base skews assistive-tech; accessibility is a product feature.
- **How:** add `@axe-core/playwright`; run axe on every route; fix violations;
  keyboard-only walkthrough of post-a-need and offer flows. The UI already uses
  semantic landmarks, labelled controls, visible focus, and text+colour state.
- **Done when:** axe reports zero violations on all routes.

### 8. RBAC lint/guard test  ·  ~1h
- **Why:** rule 10 must be mechanically enforced, not reviewed by eye.
- **How:** a test that imports every exported `mutation`/`query` and asserts each
  calls `requireRole`/`currentUser` (or is explicitly allowlisted as public-read).
  Rate-limit the donor browse query.
- **Done when:** the guard test fails if a new public function skips RBAC.

---

## Sunday PM — Ops, data, and the E2E proof

### 9. Playwright golden-path E2E  ·  ~2h
- **Why:** the live smoke test (`npm run smoke`) drives the backend; we also want
  a browser-level proof through the real React UI.
- **How:** Playwright script: sign in as each role, post→approve→offer→accept→
  chat→fulfil; assert no PII in the donor-visible DOM.
- **Done when:** `npx playwright test` is green in CI (headless).

### 10. Pilot ops  ·  ~2h
- **Why:** a pilot needs runbooks and recoverability.
- **How:** `docs/runbooks/` — moderation runbook + breach runbook (72h DPC clock);
  nightly export job to EU object storage + a documented (and once-performed)
  restore drill. Extend `convex/seed.ts` to 5 charities.
- **Done when:** restore drill performed once; runbooks committed.

---

## Cross-cutting upgrades (fit in the gaps)
- **shadcn/ui**: replace the hand-rolled atoms in `src/components/ui.tsx` with
  shadcn components (keep the accessible patterns).
- **Real photo moderation**: offer photos are stored but unmoderated — add them to
  the moderation queue (DSA).
- **Analytics dashboard**: the events table + `metrics.ts` already aggregate; build
  the PRD §9 target tiles on the ops console.
- **CI deploy**: extend `.github/workflows/ci.yml` to push to the EU dev deployment
  on green (needs `CONVEX_DEPLOY_KEY`).

## What is already done (don't redo)
Schema + 10 privacy rules in code · taxonomy/geo/PII shared package with vector
tests · RBAC · W1 onboarding (stubbed register) · W2 need loop + DSA moderation ·
W3 geo match + race-safe accept + PII-guarded chat · W4 fulfilment + no-show ·
hourly TTL purge · org/ops dashboards · 35 unit/integration tests · live golden-path
smoke test · production build.
