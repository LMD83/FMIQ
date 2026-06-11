# FMIQ — Outstanding Work, Reasons, Solutions & Feature Backlog

_Date: 2026-06-08. Companion to `roadmap.md`, `PROJECT-PLAN.md`, `FMIQ-master-build-plan.md`, `FMIQ-system-review.md`, `FMIQ-integration-map.md`. This is the single "what's left, why, and how" register._

> **Progress update (shippable push):** Live transports **wired** (HMAC HTTP + config-driven
> gateway resolution — set endpoint+secret and ERP/Revenue call for real; null otherwise).
> **Playwright** functional E2E + **axe** a11y added (7 specs, run in a new CI `e2e` job — the
> browser CDN is blocked in this sandbox so they execute in CI). **Phase 3** delivered:
> predictive maintenance (statistical), AI fault triage + O&M assistant (Claude `claude-opus-4-8`
> behind a port, rule-based default), and benchmarking. **199 API + 4 web tests.** Still open:
> a live ANTHROPIC_API_KEY + external endpoints/secrets (ops), the independent ACR audit, and the
> digital-twin 3D/IFC viewer (browser-3D, deferred).
>
> **Progress update (Phase 2 backend shipped):** All Phase-2 modules built + tested —
> **Handover Gate + COBie import** (go-live blocked until the Irish cert chain validates;
> COBie auto-creates assets/PPM/warranties/spares), **soft services + IPM** (collection-zone
> pest escalation), **lifecycle costing** (replacement forecast, unfunded backlog, capital-bid
> gate), **sustainability** (carbon, live Bizot %, SEAI export), and **Met Éireann predictive
> pre-conditioning**. **191 API + 4 web tests.** Remaining: live transport wiring, the
> independent a11y audit, browser QA, and P3 (AI/predictive/twin/benchmarking).
>
> **Progress update (front-end + integrations sprint shipped):** Front-end foundation done —
> React Query, EN/GA i18n, accessible `<StatusBadge>`/`<GateBanner>` (colour-only defect fixed),
> **four live role-dashboard screens** (1.3 ✓), **mobile/PWA Field shell with an IndexedDB
> offline write-queue** (1.2 ✓, replay-on-reconnect, unit-tested). All module REST routes +
> mirrors (2.8 ✓). **Live-integration adapters built + tested** (1.6/1.7/1.8 ✓): Hanwell/T&D
> sensors, Revenue eTax (XML parse + gate check), fire-alarm + emergency-lighting ingest,
> Axiell CMS sync; **ERP boundary** with Agresso + SAP `ProcurementGateway` adapters + PO
> callback (3.2 decided → Azure/Postgres thin interop, ADR-004). **ESLint + jsx-a11y in CI**
> (2.9 ✓). **161 tests** (157 API + 4 web).
> Genuinely still outstanding: **live transport wiring** (the adapters need real endpoints +
> Key Vault secrets — auth/network, not code), the **independent accessibility audit → published
> ACR** (external), and Phase 2 modules (Handover Gate/COBie, soft services/IPM, lifecycle costing).

## How to read
- **§1 Outstanding for pilot** — Phase-1 work still needed to reach pilot go-live (M4).
- **§2 Technical debt** — known gaps/shortcuts inside the *built* backend spine.
- **§3 Standing decisions** — choices only the product owner can make; they block if left.
- **§4 Risks** — the live risk register.
- **§5 Other / future features** — Phase 2/3 and the differentiators worth banking.
- **§6 Suggested next sprint.**

Effort key: **S** ≤1 sprint · **M** 1–2 sprints · **L** 2+ sprints. Priority: **P1** pilot-blocking · **P2** next · **P3** later.

---

## 1. Outstanding for pilot (Phase 1)

The **backend spine is built and tested** (S1–S12: primitives, asset register, PPM, compliance, SSoW gate, approvals, inventory, reactive close-out, dashboard aggregates). What remains is mostly **front-end, integrations, and assurance** — the things that can't be finished headlessly to a pilot bar.

| # | Item | Why it's outstanding | Solution / approach | Effort | Pri |
|---|---|---|---|---|---|
| 1.1 | **Front-end foundation (EP-FE)** | Current web is a single ~412-line `App.tsx`; system review flagged it won't scale and carries a11y risk. | Split into shell + `views/` + `components/`; React Query; adopt shadcn/Base UI + Nivo (accessible charts) + AG Grid; build `<GateBanner>`/`<StatusBadge>`/`<CertRAGRow>` first. | M | P1 |
| 1.2 | **Mobile / PWA field app** | The hero loop + gate are headless; field staff need point-of-work access or adoption dies (system review's #1 risk). | `packages/mobile` PWA: service-worker shell + IndexedDB offline queue; job list, gate banner, photo, QR scan, close-out; flush on reconnect. | L | P1 |
| 1.3 | **Role dashboards UI** | `domain/dashboards.ts` returns the aggregates; no screens render them. | Director/FM/Conservation/Tech/Compliance/Finance front-doors (≤3 cards, one-tap action) bound to the existing read models + new endpoints. | M | P1 |
| 1.4 | **Self-service request portal (EP-SR)** | Primary museum demand channel has no home; without it FM reverts to WhatsApp. | Lightweight requester intake (web + PWA, QR, email, no-login for standard requests) → triage → auto-SLA → `wo_work_order`. | M | P1 |
| 1.5 | **Contractor onboarding (EP-CON)** | Gate checks competencies/insurance but there's no self-onboarding flow to populate them. | QR self-sign-on at the gate; portable profile; online induction; verify Safe Pass/insurance/RECI; reuses `hs_competency` + the gate. | M | P2 |
| 1.6 | **Live sensor/BMS/CMS integrations** | Conserv webhook adapter exists; others are contract-only. The hero is reactive without them. | Implement adapters per `FMIQ-integration-map.md`: Conserv (done), Hanwell (CSV), T&D (REST), BMS via edge gateway (BACnet/Modbus→MQTT), Axiell (nightly delta pull, data-minimised). | L | P1 |
| 1.7 | **Revenue eTax Clearance gate check** | Legal obligation (S.I. 463/2012) — highest-consequence missing integration; not yet a gate check. | `TaxClearanceAdapter` (SOAP/TCAN); add `tax_clearance_valid` to `GATE_REGISTRY`; daily re-check for active contractors. | S | P1 |
| 1.8 | **Fire-alarm + emergency-lighting ingest** | I.S. 3218/3217 require complete electronic service logs; currently manual. | Panel/BMS adapters → `cmp_inspection_item` / `cmp_certificate`; auto-create the quarterly/annual service WOs. | M | P1 |
| 1.9 | **Estate seeding "via the product" + IFC/COBie import** | Asset CRUD exists; NMI's estate is still seeded by raw SQL. | Bulk import endpoint + COBie/IFC wizard (`web-ifc`) populating `est_*` + `inv_part` (this is also the Phase-2 Handover Gate foundation). | M | P2 |
| 1.10 | **Independent accessibility audit → published ACR** | Statement baseline written (`accessibility-statement.md`); WCAG 2.2 AA must be independently verified before external go-live (S.I. 358/2020). | axe-core in CI; manual keyboard/screen-reader pass at S10/S12; third-party audit; publish ACR/VPAT. | M | P1 |
| 1.11 | **NMI pilot MOU + statutory-library legal review** | Data/sensor access and the SFG20×Irish-SI frequency validation are external dependencies (risks R3, R6). | Sign MOU (named contacts, weekly touchpoint); commission SI legal review before PPM goes live at the pilot. | S | P1 |

---

## 2. Technical debt / known gaps in the built spine

Shortcuts taken to ship the spine fast and testably. None block correctness today; each has a clear fix.

| # | Gap | Why | Solution |
|---|---|---|---|
| 2.1 | **Outbox relay only logs** | `LogTransport` is the MVP; real fan-out not wired. | Implement Service Bus + ACS-email transports; add consumers that turn `evt_outbox` events into `ntf_message`/`cal_booking` (the notification + calendar services exist but aren't yet event-driven). |
| 2.2 | **Worker visibility via `app.worker_mode` GUC** | Self-contained + testable in embedded PG without an extra role. | Optionally switch to a dedicated `fmiq_worker` BYPASSRLS role in production (localised change in `withOutboxWorker` + the `evt_outbox` policy) — see ADR-003. |
| 2.3 | **Notifications: no recipient resolution / dispatch** | `notify()` stores a message; RBAC/ownership resolution + channel delivery are stubbed. | Resolve recipients by role+ownership; render templates (PII-safe); dispatch via transport; wire the escalation ladder to a scheduled worker. |
| 2.4 | **Calendar: no M365/ICS sync** | Graph integration deferred. | Microsoft Graph (EU tenant) two-way sync on domain events; read-only ICS feed; graceful degrade (booking always persists). |
| 2.5 | **PPM bundling not implemented** | Kept scheduler simple. | Merge monthly+annual on the same asset within a 5-day window into one visit (master plan §4.1). |
| 2.6 | **Collection-care: continuous-aggregate + sensor-health surfacing partial** | Slice focused on the excursion engine. | Enforce lux/uv via `cc_reading_hourly` cumulative exposure; surface `cc_sensor.calibrated_until`/battery as gate-able sensor health. |
| 2.7 | **Approvals: no delegation/quorum; ProcurementGateway is null** | Scoped to band-routing + segregation + commitment. | Add delegation (audited), quorum per step; implement Agresso/SAP `ProcurementGateway` adapter when the ERP target is confirmed (§3). |
| 2.8 | **Routes/web mirrors partial** | Domain-first to maximise tested logic. | Add the remaining `routes/*` (ppm, compliance, ssow, approvals, inventory, calendar, notifications, dashboards) + zod + `requireRole`, mirror types in `web/src/api.ts`. |
| 2.9 | **CI has no lint stage; Actions appear disabled on the repo** | No ESLint config yet; repo Actions setting. | Add ESLint (the CI `lint→typecheck→unit→RLS→build` order is reserved); enable GitHub Actions so `ci.yml` runs. |
| 2.10 | **WO ref counter: year-rollover semantics** | `WO-YYYY-NNNNN` shares one counter across years. | Decide whether the sequence resets per year (scope counter by year) — currently monotonic across years; trivial to change. |
| 2.11 | **No retention/archival job for the outbox** | Not needed at MVP volume. | Add a job to archive `processed_at`/`failed_at` rows; dead-letter review surface. |

---

## 3. Standing decisions (need the product owner)

| # | Decision | Needed by | Notes |
|---|---|---|---|
| 3.1 | **GovIQ stack fork** — FMIQ on Azure/Postgres vs a Convex-GovIQ module | ~S2 (before deep integration) | ADR-001 reaffirms Azure on corrected grounds; keep the interop surface thin (shared Entra + audit + domain). |
| 3.2 | **Finance/ERP target** (Agresso vs SAP) | before EP-7 hardening | Makes the `ProcurementGateway` contract real (currently a null stub). |
| 3.3 | **Product name** — keep **FMIQ**? | before external collateral | PRD §9 open question. |
| 3.4 | **Pilot site/sequence** | MOU stage | Recommended: Collins Barracks gallery + store, closed-loop hero first. |
| 3.5 | **Commercial model sign-off** | before first RFT | Recommended: SaaS banded by estate scale + module bolt-ons (`roadmap.md`). |

---

## 4. Risk register (live)

| # | Risk | L·I | Mitigation |
|---|---|---|---|
| R1 | "No bespoke" eligibility challenge | High·Crit | Second client in parallel; configuration-not-code discipline; document tenant-config separation. |
| R2 | Platform primitives slip blocks P1 | — | **Retired** — primitives built + tested. |
| R3 | NMI access / sensor / Axiell delays | High·High | Pre-pilot MOU; build adapters against synthetic data. |
| R4 | WCAG gap found late | Med·High | a11y embedded from S1; axe-core in CI; audits S10+S12. |
| R5 | RLS tenant-data leak | Low·Crit | Isolation suite per table in CI (62 tables covered); quarterly pen test. |
| R6 | Statutory-library misses an Irish SI frequency | Med·High | Legal review of SFG20 × Irish SIs before PPM go-live; NMI H&S lead validates. |
| R7 | NMI scope creep forks the codebase | High·Med | PRD change control; custom requests → commercial conversation, not a fork. |
| R8 | Key-person risk on RLS/eventing | Med·High | ADRs written; pair on primitives; navigator (`CODEBASE.md`) kept current. |
| R9 | Engagement trips €215k OJEU threshold early | Low·High | Structure pilot as fixed-fee PoC below threshold; pursue OGP framework listing. |

---

## 5. Other / future features

### Phase 2 (months 6–14)
- **Handover Gate + COBie/IFC import** — capital→operations golden thread; auto-populate assets/PPM/compliance/warranties on completion (`lifecycle-and-simplicity.md`). Headline differentiator.
- **Soft services + IPM** — QR-verified completion; pest-near-collections auto-escalates to Conservation on the excursion channel.
- **Lifecycle costing / capital replacement** — TCO, costed backlog, defer-vs-replace, feeds CWMF pipeline.
- **Sustainability + Bizot Green Protocol tracking** + SEAI M&R export.
- **Met Éireann predictive pre-conditioning** — instruct BMS ahead of a humidity/temperature front → *prevent* excursions (reactive → preventive; a categorically stronger claim).
- No-code report builder; Power BI/OData; live ERP PO/invoice callback; SCIM provisioning.

### Phase 3 (14 months+)
- AI fault triage + predictive maintenance (heritage-weighted); NL/RAG O&M assistant (bilingual); digital-twin/IFC viewer; multi-institution benchmarking; template marketplace; eIDAS/EUDI wallet; ISO 27001 → SOC 2.

### Differentiators to bank (system review §3)
- Living, structured **Safety File** (per-asset hazards, not a PDF).
- **Heritage-Fabric Access** as a first-class permit type (Planning & Development Act Part IV).
- **Live loan-readiness score** (env × excursions × pest × fire-cert × survey age).
- **IPM risk-scored by collection material**.
- **Compliance-transparency page** (Disability Act Part 5 + FOI cert register).
- **Build-to-Share / X-Road conformance** as a scored procurement asset.

---

## 6. Suggested next sprint

**Front-end foundation + make the spine visible** (highest leverage now the backend is done):
1. EP-FE: split `App.tsx`, React Query, design-system `<GateBanner>`/`<StatusBadge>`, EN/GA scaffold, fix the colour-only a11y defect.
2. Render the **role dashboards** from `domain/dashboards.ts` + add the missing `routes/*` and `web/src/api.ts` mirrors.
3. Land the **Revenue eTax Clearance** gate check (small, legally significant, P1).
4. Add **ESLint + enable Actions** so CI's full `lint→typecheck→unit→RLS→build` runs.

Then: minimal **mobile/PWA shell** (job list + gate banner + photo + offline) — the make-or-break adoption piece.
