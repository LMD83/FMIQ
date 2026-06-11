# FMIQ Project Plan — Phase 1 Execution

_The executable delivery plan for Phase 1 (pilot-ready MVP). Turns `FMIQ-master-build-plan.md` into epics, sprints, stories with acceptance criteria, milestones, and a kickoff checklist. Date: 2026-06-06. Status: v1, ready to greenlight._

> **Source of truth chain:** strategy → `CONTEXT.md` / `CLAUDE.md`; architecture → `architecture-adr.md`; product → `PRD.md`, `FMIQ-operations-modules-spec.md`, `FMIQ-spec-irish-regulatory.md`; build design → `FMIQ-master-build-plan.md`; codebase → `app/CODEBASE.md`. **This document is the delivery layer over those.** It does not restate them — it sequences the work.

---

## 0. Revision 2026-06-06 — post system-review changes (approved)

Following `FMIQ-system-review.md` (five-expert review) the following changes are **approved and reflected in the Linear backlog**:

- **Mobile re-sequenced to S3–S4** (was S11) — new epic **EP-MOB** (GOV-78) + story "Minimal mobile/PWA shell" (GOV-90). Highest-priority change: field staff must use the system in the first 4 weeks.
- **New epic EP-SR — Self-service request portal / helpdesk intake** (GOV-79), pulled into Phase 1. The primary museum demand channel.
- **New epic EP-CON — Contractor onboarding & site-access** (GOV-80) + story "QR self-onboarding + portable profile + gate validation" (GOV-89). Pre-populated portable contractor profiles, QR self-sign-on at the gate, online induction + Safe Pass/insurance/cert verification; reuses the gate engine + competency vault; integrates Revenue eTax Clearance + MyGovID/EUDIW.
- **Three integrations promoted to P1** under new epic **EP-INT** (GOV-82): Revenue eTax Clearance (GOV-83), fire-alarm panel ingest (GOV-84), emergency-lighting auto-test (GOV-85). Full register in `FMIQ-integration-map.md`.
- **New epic EP-DIFF — Heritage differentiators** (GOV-81): living Safety File / structured asset hazards (GOV-86), Heritage-Fabric Access permit type (GOV-87), Met Éireann predictive pre-conditioning (GOV-88); plus live loan-readiness score, IPM material risk-scoring, compliance-transparency page.
- **New epic EP-FE — Front-end foundation & design system** (GOV-77): split App.tsx + React Query (GOV-92), adopt shadcn/Base UI + Nivo + AG Grid (GOV-93), react-i18next EN/GA (GOV-94). **WCAG status-icon fix shipped** (GOV-91, done — `theme.css`).
- **ADR corrected** — `architecture-adr.md` now carries a dated revision note: Convex EU region exists since Feb 2026; the stay-on-Azure decision is reaffirmed on corrected grounds. See `FMIQ-system-review.md` §5.
- **7am test** to be operationalised as a named, testable scenario and a Definition-of-Done item for every user-facing story.

The sprint calendar (§4) is unchanged for **Sprint 1** (platform primitives); the mobile shell, self-service intake and contractor onboarding land across S2–S4 alongside the asset register. Sections below predate this revision; this block governs where they differ.

---

## 1. Phase 1 goal & definition of success

**Goal:** one museum, one lighthouse (NMI — Collins Barracks), the closed-loop hero plus the legal operating spine running live, on a multi-tenant codebase sold as a product (not a bespoke fork).

**Phase 1 is done when** a real environmental excursion at the pilot site produces a work order in **< 60 seconds** with named at-risk objects, is actioned on mobile **through a green Readiness Gate** (no paperwork → no work, enforced), and auto-generates a **loan-ready evidence record** — with a **published WCAG 2.2 AA Accessibility Statement/ACR** and statutory PPM + compliance certs live.

**Hard targets (pilot evidence):** excursion→WO < 60s (100%); alert→ack < 15 min; site go-live ≤ 8 weeks; statutory PPM ≥ 95% on-time; 100% gate enforcement, 0 un-investigated overrides; loan report generated < 5 min; published ACR.

**Timebox:** ~6 months, 12 × 2-week sprints (S1–S12).

---

## 2. Team & operating model (swarm)

Two pods from S2, per `FMIQ-master-build-plan.md` §11.2. **Platform Pod** (2 eng + 1 data eng) owns Tier-0 primitives, migrations, integrations, stable API contracts. **Product Pod** (2 eng + 1 UX) owns module delivery + mobile. **Shared:** 1 PM (backlog, exit criteria, pilot), 1 QA/accessibility specialist (cross-pod; owns ACR + RLS + gate tests), NMI FM as product-owner proxy (weekly). Contract-first handoffs: Platform → Product via a merged ADR + OpenAPI spec before consumers build.

Ceremonies (lean): async daily written stand-up · 2h sprint planning (exit criterion agreed before sprint starts) · 1h review (NMI monthly from S3) · 30-min weekly cross-pod API sync · ad-hoc ADR sessions.

Owners in this doc use role codes: **PLAT** (Platform Pod), **PROD** (Product Pod), **UX**, **DATA**, **QA**, **PM**.

---

## 3. Phase 1 epics

| ID | Epic | Tier | Depends on | Target sprints |
|---|---|---|---|---|
| **EP-0** | Platform primitives (gate engine · eventing/outbox · calendar · notifications · audit ext · mobile shell) | 0 | — | S1–S2 |
| **EP-DX** | DevEx: CI/CD, **RLS isolation test framework**, observability, repo hygiene | 0 | — | S1 (ongoing) |
| **EP-1** | Asset register & estate management | 1 | EP-0 | S3–S4 |
| **EP-2** | PPM scheduler + SFG20/statutory task library | 1 | EP-1 | S5–S6 |
| **EP-3** | Compliance certificates & statutory checks | 1 | EP-1, EP-0 | S7 |
| **EP-4** | SSoW Readiness Gate (RAMS · permits · competency/insurance · pre-task · keys · incidents) | 1 | EP-0 (gate engine), EP-2 | S8–S9 |
| **EP-5** | Spare parts / stores / inventory | 2 | EP-1, EP-6 | S10 |
| **EP-6** | Reactive maintenance & dispatch + mobile field app | 2 | EP-0, EP-4 | S11 |
| **EP-7** | Gated approvals + budget-commitment tracking | 2 | EP-0 (gate engine) | S8–S10 |
| **EP-8** | Role dashboards + scheduled reports + ACR/accessibility baseline | 1 | EP-1..EP-4 | S12 (UX from S1) |
| **EP-9** | Collection-care hardening (built → productionise: tests, lux/uv/co2 enforcement, real WO-ref scheme) | 2 | EP-0 | S3, S11 |

---

## 4. Sprint calendar (S1–S12)

| Sprint | Goal | Exit criterion |
|---|---|---|
| **S1** | Tier-0 primitives I + DevEx foundation | Gate engine + outbox merged behind ADRs; RLS isolation test harness proves tenant isolation for existing tables in CI |
| **S2** | Tier-0 primitives II (calendar, notifications, mobile shell) + App.tsx split | A domain event fans out to an in-app + email notification with a confirmation receipt; calendar booking created from an event; SPA shell routed |
| **S3** | Asset register + estate; collection-care hardening I | NMI's 4 sites + stores seeded via the product (not raw SQL); assets carry QR; excursion unit tests green |
| **S4** | Asset register II (CRUD, QR, condition grade) | FM can create/edit/locate an asset on web + scan it on mobile |
| **S5** | PPM scheduler I — statutory library + auto-WO | Adding an asset proposes the compliant schedule; fire/electrical/Legionella/lift jobs auto-generate ahead of due date |
| **S6** | PPM scheduler II — compliance clock + forecast | Clock turns amber@80%/red@95%/breach with named escalation; 12-month forward load view |
| **S7** | Compliance certificates + escalating alerts | Cert register live; 90/60/30/7-day alerts fire to named owner; failed inspection auto-raises remedial WO |
| **S8** | SSoW Readiness Gate I (RAMS/permit/competency/insurance) + approvals I | A WO cannot start with any gate check red; approval chain routes a requisition by value band |
| **S9** | SSoW Readiness Gate II (pre-task/keys/incidents) + HSA bundle | "Take 5" + key sign-out feed the gate; override audited; HSA audit bundle exportable |
| **S10** | Spare parts + reservation + commitment II | Parts reserved on WO open; stock-out flags "awaiting parts"; reorder raises a requisition + commitment (PO deferred) |
| **S11** | Reactive lifecycle + mobile field app + collection-care hardening II | Technician creates/starts/closes a job offline, photo + scan, syncs on reconnect; lux/uv enforced |
| **S12** | Role dashboards + reports + **ACR publish** + pilot go-live | Director/Conservation/Estates dashboards live; ACR published; pilot go-live signed off against the §1 exit criterion |

---

## 5. Sprint 1 — fully specified (greenlight target)

**Sprint goal:** stand up the platform primitives and the safety net that every later module depends on. Nothing customer-visible — this is maximum risk reduction. **Owner: PLAT + QA.**

> Rationale: the gate engine is called by every WO transition; the outbox is the spine for notifications, PPM-due alerts and approvals; the RLS isolation test is the one test that protects tenant data on every future change. Build these wrong later = retrofit everything.

### S1-1 · RLS isolation test harness (EP-DX) — **QA/PLAT, must-have**
Real Postgres in CI (Docker service), apply `001_init.sql`, seed two tenants, run every existing tenant table through an isolation assertion.
**Acceptance:** a test creates data as tenant A via `withTenant(A)`, queries as tenant B via `withTenant(B)`, asserts **zero rows**; the suite covers all existing tenant tables; it runs in CI and **fails the build** on any leak; documented pattern for adding a table → a test.

### S1-2 · Migration `002_gate_engine.sql` (EP-0) — **PLAT**
Tables: `gate_definition` (id, tenant_id, checks jsonb, mode, on_block, override_roles[]), `wo_gate_check` (work_order_id, check_id, status, blocking_detail, checked_at, override_by, override_reason). Gate evaluations/overrides append to `core_audit_log`.
**Acceptance:** migration applies cleanly on prod + dev variants; all new tenant tables have `ENABLE`+`FORCE` RLS + `tenant_isolation` policy + `tenant_id` index + `fmiq_app` grant; S1-1 isolation tests extended to cover them and pass.

### S1-3 · `domain/gateEngine.ts` (EP-0) — **PLAT**
Reusable evaluator: `GATE_REGISTRY` (task type → applicable checks), `evaluateGates(ctx, client) → {allPassed, results, blockedBy}`, `overrideGate(...)`. Each check is a `GateDefinition` querying the DB. Mirrors the `domain/collectionCare.ts` shape.
**Acceptance:** unit tests cover every check (pass/fail) + the override path, **> 90% branch coverage**; a HARD block returns the first failing `blockMessage`; every evaluation writes to `core_audit_log`; interface is documented in an ADR.

### S1-4 · Migration `003_eventing.sql` + `domain/outbox.ts` (EP-0) — **PLAT**
`evt_outbox` (tenant_id, event_type, payload jsonb, idempotency_key UNIQUE, created_at, processed_at, attempts). `emitEvent(client, evt)` with `ON CONFLICT (idempotency_key) DO NOTHING`, called inside the domain transaction.
**Acceptance:** an event emitted inside a `withTenant` transaction is atomic with the domain write; duplicate idempotency keys are no-ops; unit test proves collision behaviour; CloudEvents 1.0 envelope shape documented.

### S1-5 · Outbox relay worker skeleton (EP-0) — **PLAT**
A polling worker: `SELECT … WHERE processed_at IS NULL FOR UPDATE SKIP LOCKED`, dispatch (stub/log transport for now; Azure Service Bus + ACS email wired in S2), mark `processed_at`, retry with backoff.
**Acceptance:** worker drains the outbox at-least-once; a failed dispatch is retried and bounded; runs locally under `npm run dev`; no double-processing under concurrent workers (SKIP LOCKED verified).

### S1-6 · CI pipeline (EP-DX) — **PLAT/QA**
GitHub Actions: `lint → typecheck → unit → RLS integration (Docker Postgres) → build`. RLS tests in their own job with a `postgres` service so they are never skipped.
**Acceptance:** pipeline runs on every PR; a deliberate cross-tenant leak fails CI; `npm run build` + `npm run typecheck` are green; branch protection requires the pipeline to pass.

### S1-7 · Repo hygiene + migration alignment (EP-DX) — **PLAT**
`.gitignore` `packages/api/.data/`; `git rm --cached` the committed embedded-PG data (~1,400 files); reconcile `001_init.sql` ↔ `001_init.dev.sql` and document the divergence policy.
**Acceptance:** `.data/` no longer tracked; fresh clone + `npm run dev` still works; a one-paragraph note in `app/CODEBASE.md` §7 explains the two-migration policy.

### S1-8 · ADRs: gate engine + eventing (EP-0) — **PLAT/PM**
Two short ADRs (use the `engineering:architecture` format) capturing the gate-engine abstraction and the outbox/eventing choice, **merged before any consumer module builds against them**.
**Acceptance:** both ADRs in `docs/`, status Accepted, linked from the master build plan; reviewed by the Product Pod lead.

**Sprint 1 Definition of Done:** all must-have stories meet acceptance; CI green incl. RLS suite; gate engine + outbox covered by unit tests; ADRs merged; demo shows a tenant-isolation test failing on a planted leak and the gate engine blocking a mock WO.

---

## 6. Backlog — Phase 1 stories beyond Sprint 1 (epic-level)

Lighter detail; each is expanded to full acceptance criteria at its sprint-planning. Drawn from `FMIQ-master-build-plan.md` §3–§6 and the module spec.

- **EP-0 (S2):** calendar/booking service (`cal_booking` + conflict exclusion constraint + ICS feed); notification/confirmation service (`ntf_message`/`ntf_confirmation` + escalation ladder + write-back); Microsoft Graph calendar sync; SPA split into `views/` + `components/` + React Query.
- **EP-1 (S3–S4):** `est_asset` CRUD + condition grade + QR payload; estate seeding via product import; assets list/detail views; mobile asset scan.
- **EP-2 (S5–S6):** `wo_ppm_schedule`, `wo_task_template` (SFG20-aligned), `wo_meter_reading` hypertable; trigger types; statutory classification (locked red); auto-WO generation; priority bundling; compliance clock + escalation; 12-month forecast.
- **EP-3 (S7):** `cmp_certificate`/`cmp_inspection`/`cmp_inspection_item`/`cmp_defect`; escalating expiry alerts; auto-renewal WO; mobile inspections → remedial WO; estate compliance RAG dashboard (text+icon).
- **EP-4 (S8–S9):** `hs_rams`, `hs_permit`, `hs_competency`, `hs_key_register`/`hs_keyloan`, `hs_pretask`, `hs_incident`; the `ssow_readiness` gate wired into the WO state machine; audited override; HSA audit bundle export.
- **EP-5 (S10):** `inv_part`/`inv_stock`/`inv_movement`/`inv_requisition`; reserve-against-WO; mobile issue/consume; auto-reorder → requisition + commitment; critical-spares.
- **EP-6 (S11):** WO lifecycle + failure coding + skills/geo assignment + SLA tiers; calendar booking + confirmation receipt; **PWA field app** (`packages/mobile`, offline queue, photo, scan).
- **EP-7 (S8–S10):** `apr_chain`/`apr_step`/`apr_requisition`/`apr_commitment`; value-band chains via the gate engine; segregation of duties; committed-vs-budget view; `ProcurementGateway` port (`nullProcurementGateway` stub — PO/invoice deferred).
- **EP-8 (S12):** role dashboards (Director/FM/Conservation/Tech/Compliance/Finance); scheduled PDF reports + loan-ready evidence pack; WCAG 2.2 AA audit + published Accessibility Statement/ACR; bilingual (EN/GA) scaffolding.
- **EP-9 (S3, S11):** collection-care unit/e2e tests; enforce lux/uv/co2 thresholds; real WO-ref scheme; sensor health/calibration surfacing.

---

## 7. Definition of Done (global, every non-trivial story)

Acceptance criteria pass · typechecks + build green · **RLS cross-tenant isolation test** for any new tenant table (tenant B sees zero of tenant A) · audit trail written for every state change · input zod-validated · new endpoint mirrored as a typed interface in `web/src/api.ts` · UI meets WCAG 2.2 AA (status text+icon, keyboard, ARIA live regions) · relevant Irish SI/framework cited and SME-validated · ADR merged for any cross-sprint architectural choice.

---

## 8. Milestones & decision gates

| Milestone | Sprint | Gate |
|---|---|---|
| **M0 — Foundations green** | end S1 | Gate engine + outbox + RLS harness + CI merged. *Go/no-go for module work.* |
| **M1 — Estate live** | end S4 | Assets manageable on web + mobile; collection-care hardened. |
| **M2 — Legal spine live** | end S7 | PPM statutory scheduling + compliance certs operational. |
| **M3 — No-paperwork-no-work enforced** | end S9 | Readiness Gate blocks live; HSA bundle exports. |
| **M4 — Pilot go-live** | end S12 | §1 exit criterion met at Collins Barracks; ACR published. |
| **M5 — Pilot evidence pack** | S12 + 12 wks | KPIs, gate logs, ACR, case study compiled for first RFT. |

Two **standing decisions** must be resolved before they block: (a) the **GovIQ stack fork** — is FMIQ a Convex-GovIQ module or an Azure/Postgres satellite sharing only Entra+audit+domain? (needed before deep integration work, ~S2); (b) confirm the **finance integration target ERP** (Agresso/SAP) so the `ProcurementGateway` contract is real (before EP-7 hardening, ~S8).

---

## 9. Dependencies & critical path

`EP-0 (gate engine + outbox) → everything`. `EP-1 → EP-2 → EP-3`. `EP-0 gate engine → EP-4 + EP-7`. `EP-1 + EP-4 → EP-6`. `EP-1 + EP-6 → EP-5`. `EP-1..EP-4 → EP-8`. The **critical path runs through S1 (primitives) → S5–S7 (PPM+compliance) → S8–S9 (gate)**; any slip there moves M4. Parts (EP-5) and dashboards (EP-8) have float and can compress.

---

## 10. Risks (live — see `FMIQ-master-build-plan.md` §11.5 for the full register)

Top three to manage from week 0: **R1 eligibility/"no bespoke"** → stand up a second client in parallel, enforce configuration-not-code; **R3 NMI access/sensor/Axiell delays** → sign the pilot MOU now, build adapters against synthetic data in S1; **R6 statutory-library gaps** → commission the Irish SI legal review before S5.

---

## 11. Kickoff checklist (week 0 — do these to start)

- [ ] Greenlight this plan; confirm pod staffing (PLAT, PROD, UX, DATA, QA, PM).
- [ ] Sign the **NMI pilot MOU** (data access, sensor install, named contacts, weekly touchpoint) — R3.
- [ ] Commission the **statutory-library legal review** (SFG20 × Irish SIs) — R6, due before S5.
- [ ] Decide the **GovIQ stack fork** (M8 standing decision) — owner: Liam.
- [ ] Stand up Azure dev landing zone + GitHub repo settings (branch protection, CI secrets).
- [ ] Create the tracker: Phase 1 epics + the Sprint 1 cycle (this plan mirrored).
- [ ] Repo hygiene: `.gitignore .data/` and untrack the committed embedded-PG data (S1-7).
- [ ] Schedule Sprint 1 planning; agree the S1 exit criterion with the team.
- [ ] Start the **second-client pipeline** so the off-the-shelf maturity claim is true by first RFT — R1.

---

_Update this plan at each sprint boundary. Sprint 1 is specified to story level; later sprints are expanded at their planning sessions._
