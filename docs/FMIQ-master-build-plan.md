# FMIQ — Master Build Plan

_Integrated build & feature plan for the operational platform: how every module works, how they interoperate, and how the build is sequenced and staffed. Synthesised from a multidisciplinary review (product/delivery, FM/operations, systems/integration, data/analytics, software engineering, UI/UX). Date: 2026-06-06. Status: v1 for steering review._

> Read alongside: `FMIQ-operations-modules-spec.md`, `FMIQ-spec-irish-regulatory.md`, `architecture-adr.md`, `data-model.md`, `lifecycle-and-simplicity.md`, `roadmap.md`. This document is the integration layer over those — it does not repeat the Irish legal register in full (see `FMIQ-spec-irish-regulatory.md` §7).

---

## 0. Decisions governing this plan

1. **Deliverable:** this is a planning document. No production code is written in this pass; engineering sections describe *how* to extend the existing codebase.
2. **Finance scope:** FMIQ builds **gated approvals + budget-commitment tracking only**. PO issuance, invoice processing and three-way match are **deferred** and integrate outward to GovIQ procurement + the public body's finance/ERP (e.g. Agresso/SAP). The approval chain stops at an *approved requisition + committed budget*, with a clean integration hook where a PO would later be issued.
3. **Stack (committed):** Azure (North Europe / Ireland, EU Data Boundary) · PostgreSQL Flexible Server with RLS + TimescaleDB + PostGIS · Node.js/Fastify/TypeScript API · React/TypeScript SPA · Azure Entra ID SSO (B2B). Per `architecture-adr.md`.
4. **Two design laws, enforced everywhere:** *No paperwork, no work* — the system **blocks**, it does not warn. *The 7am test* — a cold, untrained user completes the most common task in under 60 seconds.
5. **Eligibility discipline (CLAUDE.md §2):** FMIQ is a **multi-tenant, configuration-driven product**, not a bespoke-for-NMI build. Every module must be tenant-configurable, not client-forked.

---

## 1. Where the code is today (review)

The **planning is mature; the code is one module deep.**

**Built for real (typechecks, end-to-end):**

- Monorepo: `app/packages/api` (Fastify/TS), `app/packages/web` (React/Vite + MSAL), `app/infra` (Azure Bicep).
- **Platform spine** — multi-tenant schema with Row-Level Security (`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on every tenant table), least-privilege `fmiq_app` role, append-only `core_audit_log`, Entra JWT auth (`jose`) + 6-role RBAC, `DEV_NO_AUTH` local bypass.
- **Estate hierarchy** — `est_site → est_building → est_floor → est_space → est_asset`.
- **Collection-care closed loop (the hero) — genuinely implemented.** `domain/collectionCare.ts` (240 lines): excursion detection (absolute + rate-of-change) → names at-risk objects from `cc_object_link` → raises `wo_work_order` (source `excursion`) → emits alerts. TimescaleDB hypertable `cc_reading` + hourly continuous aggregate.

**Stub only (a table + read-only list, no logic):** maintenance (`wo_work_order` list + ack), compliance (`cmp_obligation` RAG), projects (`prj_project`), and the Sustainability/Integrations/Reports nav tabs.

**Specified but zero code** — and this is the scope of this plan: PPM/planning, scheduling/dispatch, the **SSoW Readiness Gate** (RAMS, permits, work-at-height, LOTO, competency/insurance vault, pre-task "Take 5", key sign-out), spare parts/stores, compliance certificates & statutory checks (fire alarms, etc.), soft services & IPM, lifecycle costing, the **Handover Gate** (O&M/COBie/BIM), **gated approvals + commitment tracking**, and the cross-cutting **calendar/booking** and **notification/confirmation** services. No `hs_*`, `inv_*`, `apr_*`, `cal_*`, `ntf_*`, `hov_*`, `soft_*`, `lcc_*`, `wo_ppm_*` tables exist yet.

**Existing tables:** `core_*`, `est_*`, `cc_*` (full), `wo_work_order`, `wo_contractor`, `cmp_obligation`, `prj_project`.

---

## 2. Module map & dependency graph

The platform is built in tiers. Lower tiers are substrate that higher tiers call. **Build primitives first** — they de-risk everything above them.

```
TIER 0 — PLATFORM PRIMITIVES (substrate; build first)
  RLS tenancy + Entra SSO ·  Eventing backbone (outbox→Service Bus)
  Gate engine (reusable rule evaluator) ·  Calendar/booking service
  Notification/confirmation service ·  Immutable audit ·  Mobile/PWA shell
        │
        ▼
TIER 1 — LEGAL SPINE (P1; required before any live operation)
  Asset register ──▶ PPM scheduler ──▶ Compliance certs & statutory checks
                          │
                          └──▶ SSoW Readiness Gate (RAMS·permit·competency·insurance·pre-task·keys)
        │
        ▼
TIER 2 — OPERATIONAL CORE (P1 alongside)
  Spare parts/stores ·  Reactive maintenance & dispatch ·  Collection-care loop (built)
  Gated approvals + commitment tracking
        │
        ▼
TIER 3 — DEPTH (P2)
  Soft services + IPM ·  Lifecycle costing ·  Contractor vault ·  Handover Gate + COBie/BIM
        │
        ▼
TIER 4 — INTELLIGENCE & SCALE (P3)
  AI fault triage ·  Predictive maintenance ·  NL/RAG O&M assistant ·  Digital twin
  Multi-institution benchmarking ·  Live PO/invoice ERP callback
```

**Critical path:** Gate engine + eventing + calendar/notification (Tier 0) unblock PPM, SSoW, compliance and dispatch simultaneously. The Handover Gate depends on asset register + PPM + compliance + parts all existing first — it is therefore correctly a P2 module, not P1, despite being the headline differentiator.

---

## 3. Cross-cutting platform services (Tier 0)

These are built once and consumed by every module. Getting their interfaces right before module work begins is the single biggest delivery lever.

### 3.1 Eventing backbone (outbox → Service Bus)

Domain writes and their events are transactional via an **outbox table**, polled by a relay worker that publishes to Azure Service Bus. At-least-once delivery; consumers deduplicate on event id.

```sql
CREATE TABLE evt_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,        -- 'excursion.opened' | 'ppm.due' | 'cert.expiring' | 'approval.requested' | 'gate.blocked' | 'handover.completed' ...
  payload jsonb NOT NULL,          -- CloudEvents 1.0 envelope
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, attempts int NOT NULL DEFAULT 0
);
```

Emit inside the same `withTenant` transaction as the domain change (e.g. `collectionCare.ts` emits `excursion.opened` atomically). Relay worker: `SELECT … WHERE processed_at IS NULL FOR UPDATE SKIP LOCKED`. Canonical topics: `fmiq.excursion`, `fmiq.workorder`, `fmiq.ppm`, `fmiq.compliance`, `fmiq.approvals`, `fmiq.gate`, `fmiq.handover`, `fmiq.booking`, `fmiq.notification`, `fmiq.iot`.

### 3.2 Gate engine (shared, declarative)

One reusable evaluator that **both** the SSoW Readiness Gate and the value-band approval chains call. Modules declare gates; they do not embed gate logic.

```ts
interface GateDefinition {
  id: string;                       // 'ssow_readiness' | 'capex_approval_band_2'
  checks: GateCheck[];
  mode: 'ALL' | 'ANY';
  onBlock: 'HARD' | 'SOFT';         // HARD = entity cannot progress
  overrideRoles?: Role[];           // who may record a documented override
}
interface GateCheck { checkId: string; checkType: 'ENTITY_FIELD'|'LINKED_RECORD'|'APPROVAL_CHAIN'|'EXTERNAL_CALL'; params: object; blockMessage: string; }
```

A WO transition to `in_progress` calls `evaluate('ssow_readiness', workOrderId)`; if not passed → HTTP 409 with the first failing `blockMessage`. Every evaluation (pass/fail/override) is appended to `core_audit_log`. Override requires the override role + mandatory reason.

### 3.3 Calendar / booking service

A first-class, cross-module store of time-windowed events: PPM visits, inspections, contractor attendance, permit validity windows, room/resource bookings.

```
cal_booking { id, tenant_id, booking_type(ppm|wo_attendance|inspection|permit_window|resource|room),
  subject_id, subject_type, site_id, space_id, organiser_id, attendees jsonb,
  start_at, end_at, rrule (RFC5545), status(tentative|confirmed|cancelled|completed),
  ics_uid UNIQUE, created_at, updated_at }
```

Conflict detection via a Postgres exclusion constraint on `(space_id, tstzrange(start_at,end_at))`. Modules emit a domain event (`ppm.scheduled`, `wo.assigned`, `permit.issued`); the calendar service subscribes and creates the booking, returning a `booking_id`. M365/Outlook sync via Microsoft Graph (EU tenant); a read-only key-authenticated ICS feed serves external clients. Graph failures degrade gracefully (`sync_failed`, retried) — the booking always persists in FMIQ.

### 3.4 Notification & confirmation service

Multi-channel (in-app, email via Azure Communication Services EU; Teams P2; SMS P3) with **delivery + confirmation receipts written back** to the originating entity.

```
Domain event → notification worker (resolve recipients via RBAC + ownership → render template → dispatch)
  → ntf_message { id, tenant_id, recipient_id, channel, entity_type, entity_id, subject, body, priority, sent_at, read_at }
  → recipient acts: PUT /api/notifications/:id/ack
  → ntf_confirmation { id, message_id, confirmed_by, confirmed_at, action_taken }
  → write-back worker updates source (wo.confirmed_by/at, cert acknowledgement, approval notified_at)
  → emits notification.acknowledged (feeds escalation ladder)
```

Each template carries `escalation_after_minutes` + `escalation_recipient_role`; unacknowledged → re-dispatch up to 3 tiers → `alert.unacknowledged` dashboard flag. Templates require a `pii_safe` flag; notification bodies never carry collection object detail or health data (GDPR).

### 3.5 Audit & residency (extends what exists)

`core_audit_log` is already append-only (`REVOKE UPDATE, DELETE` from `fmiq_app`). Extend with `ip_addr inet`, `session_id text`, `source_module text`, `context jsonb` (override reasons, approval comments). Every state change in every module writes here; FOI and HSA bundles are served directly from it. Three Postgres roles: `fmiq_app` (DML, no audit delete), `fmiq_read` (SELECT only — OData/Power BI), `fmiq_admin` (DBA/DDL, restricted, no app path).

---

## 4. Operations modules — feature plans

Each module below states purpose, key features, the blocking gate(s), data entities, events, top KPIs, the role front-door (7am test), and build phase. Irish legal basis is summarised; full citations in `FMIQ-spec-irish-regulatory.md` §7.

### 4.1 Planned Maintenance (PPM) scheduling — **P1**

**Purpose:** every asset stays legally compliant and operational without anyone having to remember when things are due.

**Features:** SFG20-aligned task library keyed to `est_asset.asset_type` (adding an asset auto-proposes the schedule + legal frequency); trigger types (calendar / meter-runtime / seasonal / condition-based from sensor or BMS); statutory-vs-discretionary classification — **red** (statutory, locked, cannot delete or extend past legal window), **pink** (mandatory contractual), **amber** (best practice), **green** (optional); auto WO generation ahead of due date with parts reserved and permit type flagged; priority bundling (monthly + annual on same asset within a 5-day window merge into one visit); compliance clock per statutory task (green → amber at 80% elapsed → red at 95% → **breach** = named escalation to Head of Facilities + Safety lead, logged); 12-month forward labour/visit forecast per site.

**Blocking gate:** a statutory PPM WO cannot be deferred past its due date without a named manager's documented justification, itself audited. No silent deferrals.

**Data:** `wo_ppm_schedule` (asset_id, task_template_id, trigger_type, frequency, lead_days, next_due, sfg20_ref, classification, statutory_flag, last_wo_id), `wo_task_template` (code, discipline, required_skill, standard_ref, est_minutes, permit_type_required, parts_required jsonb — tenant-agnostic reference), `wo_meter_reading` (asset_id, meter_type, value, ts — **hypertable**, drives condition triggers).

**Events:** emits `ppm.wo_generated`, `ppm.compliance_amber|red|breach`, `ppm.bundled`; consumes `asset.created`, `meter.reading_updated`, `sensor.threshold_crossed`.

**KPIs:** statutory PPM completion ≥98%; on-time vs SLA window; forward-load variance; compliance-clock age distribution; bundle savings.

**Front-door:** technician "Today" — cards (what / where / how long / traffic-light clock), one tap to open; Start is green only when the Readiness Gate clears.

### 4.2 Maintenance coordination & dispatch — **P1**

**Purpose:** every reactive and planned job reaches the right person, tracked to closure, with SLA evidence.

**Features:** reactive WO lifecycle `reported → triaged → assigned → [Readiness Gate] → in_progress → completed → closed`; FMEA-style failure coding (mode/cause/remedy) mandatory on close for critical assets; skills + geo scheduling (filter available technicians/contractors by required skill + proximity); in-house (`core_user`) vs contractor (`wo_contractor`) assignment (contractor assignment triggers the competency-vault check); SLA tiers (critical 2h / high 4h / routine next business day) with amber at 75% and red at breach; **calendar booking + notification + confirmation receipt** (an unconfirmed critical WO re-notifies after 15 min); mobile close-out (photo, signature, parts-consumed scan, failure codes — cannot close without mandatory fields).

**Blocking gate:** `assigned → in_progress` is blocked until the Readiness Gate (§5) is fully green.

**Data:** extend `wo_work_order` with `failure_mode/cause/remedy`, `gate_status jsonb`, `gate_evaluated_at`, `confirmed_by`, `confirmed_at`, `sla_breached`; add `wo_sla_tier`, `wo_assignment_log`.

**Events:** emits `wo.created|assigned|gate_cleared|started|closed`, `wo.sla_amber|breach`, `wo.unconfirmed_critical`; consumes `ppm.wo_generated`, `cc.excursion_raised`, `inv.parts_reserved_failed`, `hs.gate_check_failed`.

**KPIs:** mean time to assign; SLA achievement by tier; first-time-fix rate; confirmation-receipt rate (100% target for critical); open backlog age.

**Front-door:** dispatcher "Unassigned jobs now" sorted by SLA clock — tap a card, see required skill + nearest available person + one "Assign" button.

### 4.3 Spare parts / stores / inventory — **P1 core, P2 analytics**

**Purpose:** the right part is on the shelf (or on order) before the job needs it.

**Features:** catalogue (manufacturer, part no, supplier, unit cost, lead time, bin); stock min/max per store with **auto-reorder at min → raises a requisition + commitment** (PO issuance deferred — see §6); parts↔asset link seeded from the COBie "Spare" tab at handover; reserve-against-WO (short stock → WO flagged "awaiting parts" + requisition raised); mobile scan issue/consume (offline-capable, cost posts to WO); critical-spares flag (criticality-AAA assets held to elevated min, named alert if breached and lead time > 48h); valuation + slow/fast-mover analytics feeding lifecycle costing.

**Blocking gate:** Readiness Gate checks parts reserved + available; a required part at qty 0 with no confirmed ETA blocks start (manager override audited).

**Data:** `inv_part`, `inv_stock` (part_id, store_location, bin, qty_on_hand, qty_reserved, min, max), `inv_movement` (issue/receipt/adjust/return, wo_id, qty, unit_cost, ts — append-only cost ledger), `inv_requisition` (part_id, qty, status, apr_requisition_id).

**Events:** emits `inv.stock_below_min`, `inv.critical_spare_breach`, `inv.parts_reserved|reserved_failed`, `inv.movement_posted`; consumes `wo.created`, `inv_requisition.fulfilled`.

**KPIs:** part availability at WO start ≥95%; critical stock-outs = 0; inventory turn; requisition-to-receipt cycle vs stated lead time.

**Front-door:** "Parts for this job" panel on the WO card — green tick "in stock" or amber "on order — ETA Fri"; one tap to reserve/issue.

### 4.4 Compliance certificates & statutory checks — **P1**

**Purpose:** every legal certificate is current, evidenced, and never lapses unnoticed.

**Features:** certificate register as a first-class entity (type, ref, issuer, issue/expiry, linked asset/building, PDF blob, BCMS reference, owner); escalating expiry alerts at **90/60/30/7 days** to named owner + line manager; auto-renewal WO created at the 90-day alert, pre-filled with last-cert details/contractor/scope; mobile inspection checklists (pass/fail + mandatory photo; a **fail auto-creates a remedial WO**); estate compliance dashboard (RAG by building × obligation type, **text + icon, never colour alone**); immutable audit trail; regulatory-change watch. Cert coverage: fire alarm **I.S. 3218**, emergency lighting **I.S. 3217**, electrical **I.S. 10101**, lifts/thorough exam **S.I. 299/2007**, Legionella **S.I. 572/2013**, F-Gas **EU 517/2014**, asbestos **S.I. 386/2006**, BCAR CCC **S.I. 9/2014**.

**Blocking gate:** an asset with an expired statutory cert cannot have maintenance closed as "compliant" — the closure form blocks the compliance sign-off and forces a remedial cert track.

**Data:** extend `cmp_obligation` with `cert_type_code`, `sfg20_ref`, `auto_renewal_wo_days_lead`; add `cmp_certificate`, `cmp_inspection`, `cmp_inspection_item`, `cmp_defect` (→ remedial WO + lifecycle backlog).

**Events:** emits `cmp.expiry_alert_90|60|30|7`, `cmp.renewal_wo_raised`, `cmp.inspection_failed`, `cmp.cert_expired`; consumes `wo.closed`.

**KPIs:** % statutory certs current (target 100%); expiry backlog at <30 days (target 0); alert→renewal time; inspection fail rate by type; remedial-WO closure in window.

**Front-door:** one screen — "What's due, what's overdue, what's evidenced." Each red row shows exactly one next action.

### 4.5 Soft services & IPM — **P2 (IPM track P1)**

**Purpose:** cleaning, security, grounds, pest, waste — planned, QR-verified, measured to SLA, with heritage-grade IPM.

**Features:** service specs mapped to space type (gallery vs store vs office vs WC) generating task cards; rosters by zone/shift/operative; **QR-verified completion** (scan at point of work → timestamp + user + location; missed scan auto-raises an alert); BICSc-style quality audits (photo evidence; sub-threshold score raises a re-service task); **IPM module (heritage-critical)** — trap register, check logs, sightings with photo, treatments mapped to spaces, **pest within 5 m of a collection zone auto-escalates to Conservation Officer on the same channel as a `cc_excursion`**; waste streams (volumes/weights, recycling rate, cost/tonne, EPA export); footfall-linked resource scaling; SLA scorecards per contractor.

**Data:** `soft_spec`, `soft_task`, `soft_completion` (qr_scan, photo, location_verified), `soft_audit`, `ipm_trap`, `ipm_observation` (species, count, collections_escalation), `waste_record`.

**Events:** emits `soft.missed_service`, `soft.audit_failed`, `ipm.collection_zone_sighting`, `waste.recycling_below_target`; consumes `est.visitor_count_updated`.

**KPIs:** QR completion ≥97%; audit score ≥85/100; IPM sighting→treatment <2h in collection zones; recycling rate vs target; SLA breach rate.

**Front-door:** operative "My rounds today" — tap card → scan QR → done. Photo fallback with supervisor co-sign if QR unavailable.

### 4.6 Lifecycle costing / capital replacement — **P2**

**Purpose:** turn reactive surprises into a funded, evidenced, 10-year capital plan aligned to CWMF.

**Features:** asset lifecycle record (install/commission date, design life, replacement cost, condition grade A–D, warranty expiry); remaining-life forecast (design life adjusted by condition, later by predictive health score); replacement-due calendar 1/3/5/10-year, inflation-adjustable (BCIS index), exportable as a costed capital bid; TCO per asset (capital + planned + reactive + energy + parts from `inv_movement`); costed, risk-ranked backlog register (incl. collections risk); defer-vs-replace scenarios with a recommendation narrative; **feeds the CWMF pipeline** by seeding a `prj_project` record typed `capital_replacement`.

**Blocking gate:** no replacement capital bid can be submitted without a linked condition survey (`condition_survey_date` within 24 months).

**Data:** extend `est_asset` (`design_life_years`, `replacement_cost`, `commission_date`, `warranty_expiry`, `tco_annual_estimate`, `health_score`); add `lcc_forecast`, `lcc_backlog`, `lcc_scenario`.

**Events:** emits `lcc.replacement_due_within_1yr`, `lcc.backlog_unfunded_critical`, `lcc.project_seed_created`; consumes `inv_movement.posted`, `wo.closed` (reactive), `cmp_defect.raised`, `est_asset.condition_grade_updated`.

**KPIs:** % assets with current forecast; total unfunded backlog €; capital forecast accuracy (budget vs actual); TCO per m²; % critical backlog with a funded plan.

**Front-door:** director "What needs money, when, and what happens if we wait" — upcoming replacements (costed), unfunded backlog (€ + critical count), top-3 defer-vs-replace decisions; one button "Start capital bid."

---

## 5. Safe System of Work — the Readiness Gate (P1, the legal spine)

**Purpose:** nobody works on the estate without the correct, current, approved paperwork **in advance**. The system enforces it — never warns. Defensible to HSA inspection on any day.

### 5.1 Components

- **RAMS** (`hs_rams`): upload (Blob), version-controlled, workflow `draft → submitted → under_review → approved | rejected → expired`; reviewer = FM/Safety lead; expiry mandatory (≤12 months); only **approved + in-date** RAMS unlock a job; approved RAMS for a task type can be reused across same-type WOs within validity.
- **Permit to Work** (`hs_permit`): hot works, confined space, work at height, electrical isolation/LOTO, roof/heritage-fabric access, working near collections. Defines isolation points (pulled from O&M/Safety File), precautions, PPE, validity window, named authoriser. Lifecycle `draft → active (authoriser signs) → suspended ↔ active → closed (reinstated)`. A WO may require 0..n permits.
- **Competency & insurance vault** (`hs_competency`): per contractor and per operative — Safe Pass, trade certs, RECI/RGII, public + employer liability insurance, site-specific inductions; each with expiry + Blob doc; **expired → auto-block assignment** with named reason; 30/7-day warnings.
- **Key sign-out / access control** (`hs_keyloan` + `hs_key_register`): keys/fobs/restricted-area access tied to an active WO + permit; sign-out → return tracking; overdue-return alert; restricted keys need extra authoriser sign-off; FOI-grade audit.
- **Daily pre-task "Take 5"** (`hs_pretask`): mobile, ≤60s, two screens — area confirmed, hazards as per RAMS, controls in place, PPE, new hazards since RAMS (photo); a new hazard → `stop_reassess` → supervisor must clear or RAMS revised; completion timestamp + GPS validates on-site presence.
- **Incidents & near-misses** (`hs_incident`): mobile report with photo; triage; investigation workflow; corrective actions to close; **RIDDOR-equivalent** HSA notification prompt for major/fatal/dangerous occurrences.

### 5.2 The gate (evaluated server-side on every start attempt)

```
GATE 'ssow_readiness' (mode ALL, onBlock HARD) — for wo_work_order → in_progress
  ✓ RAMS approved AND in-date for this task
  ✓ Permit(s) issued + active (if task type requires)
  ✓ Assignee/contractor competencies valid
  ✓ Contractor insurance (public + employer) in date
  ✓ Required parts reserved/available
  ✓ Daily pre-task plan complete
  ✓ Required keys signed out
  ANY red → START disabled; the exact missing item is named; block written to core_audit_log
  Override: FacilitiesManager+ with mandatory reason → audited; per-WO override counter
```

The gate writes a `wo_gate_check` snapshot (per-check status + blocking_detail + checked_at) and appends every evaluation/override to `core_audit_log`.

**KPIs:** gate-block rate (a maturity indicator, trend to <5%); RAMS approval cycle <24h; competency-expiry alerts = 0; permit closure (no permit open past `valid_to`); LTIFR + near-miss rate + corrective-action closure.

**Front-door:** the job card shows a single banner — green **"Ready to start"** (one Start button) or red **"Blocked — RAMS not approved"** (tappable list of exact missing items). No ambiguity, no hunting.

---

## 6. Gated approvals + budget-commitment tracking (P1)

**Purpose:** enforce multi-step, role-separated authorisation for spend and work, and commit budget before work starts — stopping cleanly at an approved requisition, which is the integration boundary for PO issuance.

**Features:** configurable approval chains by spend band / category (capital/revenue/emergency) / site / WO type; ordered steps each with required role, quorum, SLA, escalation; delegation (audited); **segregation of duties** (requisition creator cannot approve the same chain); budget commitment — on approval, `apr_commitment` reserves the amount against a cost centre/project; running committed-vs-budget view; overspend at commitment stage is **blocked** (not warned) unless overridden with reason.

**Requisition lifecycle:** `draft → pending_approval → (step approvals) → approved → committed`. On `approved`, emit `requisition.approved` carrying `{requisition_id, amount, cost_centre, supplier_id, line_items, approved_by, approved_at, cwmf_project_ref}`.

**Deferred PO/invoice hook (integration boundary — see §7.2):** FMIQ owns *authorised commitment*; GovIQ procurement / the body's ERP owns *PO issuance + invoice + three-way match + payment*. FMIQ stores only a read-only `po_reference` + `payment_status` written back by the ERP callback. FMIQ never holds invoice data. In code this is a `ProcurementGateway` port with a `nullProcurementGateway` stub until the P2 live integration.

**Data:** `apr_chain` (trigger conditions, steps jsonb), `apr_step` (chain_id, step_order, approver_role/id, decision, decided_at, comment, delegated_to), `apr_requisition` (chain_id, work_order_id, project_id, cost_centre, supplier_id, amount_net, category, status, current_step, po_reference, po_issued_at), `apr_commitment` (requisition_id, cost_centre, project_id, amount_net, status committed|released|converted).

**KPIs:** approval cycle time by band (<48h); SLA breach rate; committed-vs-budget utilisation by cost centre; requisitions pending > SLA.

**Front-door:** finance/approver inbox — each row: requester · plain-language description · value · attachment · delegated-limit subtext ("Your limit €25,000 · This request €18,500 ✓"); inline **Approve** (no modal) / **Query** / **Reject**; bulk approve.

**Irish basis:** OGP thresholds (€25k/€50k/€214k competition requirements); CWMF financial controls; Infrastructure Guidelines 2023 (commitment accounting, capital appraisal); segregation of duties under DPER internal-audit guidance.

---

## 7. Handover Gate & interoperability ("everything sent over from GovIQ")

### 7.1 Handover Gate — capital → operations golden thread (P2; headline differentiator)

On capital completion, the Irish certification pack + COBie/IFC become the event that **populates operations**. Go-live is **blocked** until the mandatory cert chain validates.

**Gate logic:** `go_live_blocked = true UNTIL ccc_validated AND safety_file_id NOT NULL AND fsc_ref NOT NULL AND cobie_import_status = 'complete'`. Completeness shown as "7 of 11 required — missing: DAC, ancillary M&E cert."

**Cert chain (each a `hov_cert` linked to `hov_handover`):** CCC + BCMS reference (**S.I. 9/2014**), FSC (Fire Services Acts), DAC (Disability Act 2005 / TGD M), ancillary structural/M&E/fire certs, **Safety File** (first-class, linked to every asset — **S.I. 291/2013**), O&M manuals + as-builts + commissioning (BS EN ISO 19650), CWMF close-out, HSE-capital/HTM certs where relevant.

**Auto-population on `handover.complete`:** asset register enriched from COBie `Component` rows; PPM schedules generated from asset type (SFG20 lookup); statutory compliance clock started (first due = install date + statutory interval); collection-care setpoints inherited from commissioned BMS data; warranties created (`hov_warranty`) from COBie warranty fields; Safety File linked to all assets for downstream RAMS.

**COBie/IFC ingestion:** upload wizard validates required sheets (Type/Component/Space/Spare/Document); field-mapping UI with sensible defaults; original file to Blob with **WORM** immutability (7-yr retention); `web-ifc`/IfcOpenShell parses `IfcSpace → est_space`, `IfcElement → est_asset`, COBie `Spare → inv_part`; completeness/"what's missing per asset" dashboard. 2D/3D viewer (xeokit) is **P3**.

**Front-door:** handover dashboard progress meter ("7/9 certs — 2 blocking go-live") with named missing items and one "Upload missing cert" button; on go-live: "Assets loaded: 847 · PPM schedules created: 312 · Compliance clock started."

### 7.2 Integration boundaries

| Boundary | Direction | Contract | Constraints |
|---|---|---|---|
| **GovIQ spine** | GovIQ→FMIQ: procurement project / approved capital project. FMIQ→GovIQ: handover completed, completion certs, asset snapshot. | Internal REST (`/api/internal/goviq/*`, HMAC) + shared Service Bus namespace; shared Entra tenant + App Roles; shared Log Analytics. | mTLS within North Europe VNET; no EU egress. |
| **Finance / ERP** (Agresso/SAP) — **deferred** | FMIQ→ERP: approved requisition + commitment. ERP→FMIQ: `po_number`, `grn_number`, `payment_status`. | HMAC webhook out + async `POST /api/erp/po-callback`. | FMIQ never holds invoice data; 3-way match stays in ERP. |
| **BMS / IoT** | sensors/BMS → FMIQ; authorised setpoint write-back | `SensorAdapter` normalises to `{tenantId, sensorId, metricType, value, unit, quality, timestamp}`; Conserv (webhook), Hanwell (CSV/poll), T&D (REST), MQTT (IoT Hub), BACnet/Modbus/OPC-UA (edge gateway). | Write-back gated on FM role + audit + idempotency key; NIS2 segmentation, no BMS→internet path. |
| **CMS / collections** (Axiell/TMS/Mimsy) | CMS → FMIQ (read-only) | Scheduled pull filtered to `{cms_object_ref, sensitivity, primary_zone_id}` only. | GDPR data minimisation; richer sync requires a DPIA; FMIQ never writes to the CMS. |
| **BIM/COBie/IFC** | file → FMIQ | Ingestion pipeline (§7.1); `web-ifc` runs in-container, no external call. | Original to Blob WORM; data stays in North Europe. |
| **Outbound interop** | FMIQ → integrators | OpenAPI 3.1 behind APIM; OData v4 (Power BI, read-only, RLS-enforced); per-tenant HMAC webhooks; SCIM 2.0 provisioning; **Build-to-Share / X-Road** header support. | API keys + per-tenant rate limits; X-Road compatibility is an OGP-scored differentiator. |

```
        GovIQ spine (Entra · procurement · audit)        Finance/ERP (deferred PO/invoice)
                 │  internal REST + Service Bus                 ▲ webhook out / callback in
                 ▼                                              │
   ┌─────────────────────────── FMIQ API (Container Apps, VNET, North Europe) ───────────────────────────┐
   │  Calendar ·  Notifications ·  Gate engine ·  Approvals  →  evt_outbox  →  Service Bus topics          │
   └───────┬───────────────────────────┬───────────────────────────┬───────────────────────────┬────────┘
           ▼                           ▼                           ▼                           ▼
      TimescaleDB                Asset register              core_audit_log               Blob (WORM)
   (cc_reading, meters)        (the AIM spine)            (FOI / HSA evidence)         (docs, certs, IFC)
           ▲                           ▲                           ▲                           ▲
     BMS / IoT / sensors         CMS (Axiell ref)          OData / Power BI / webhooks    COBie / IFC ingest
```

---

## 8. Data & analytics

### 8.1 Schema extension map (new tables, consistent with existing conventions)

Every tenant-scoped table gets `uuid` PK, `tenant_id`, RLS (`FORCE` + `tenant_isolation`), and a composite index leading with `tenant_id`. Grants to `fmiq_app` in the same migration.

| Prefix | New tables |
|---|---|
| `wo_` (maintenance) | `wo_ppm_schedule`, `wo_task_template`*, `wo_meter_reading`†, `wo_sla_tier`, `wo_assignment_log`, `wo_gate_check`; extend `wo_work_order` |
| `inv_` (parts) | `inv_part`, `inv_stock`, `inv_movement`, `inv_requisition` |
| `cmp_` (compliance) | `cmp_certificate`, `cmp_inspection`, `cmp_inspection_item`, `cmp_defect`; extend `cmp_obligation` |
| `hs_` (H&S / SSoW) | `hs_rams`, `hs_permit`, `hs_competency`, `hs_key_register`, `hs_keyloan`, `hs_pretask`, `hs_incident` |
| `apr_` (approvals) | `apr_chain`, `apr_step`, `apr_requisition`, `apr_commitment` |
| `soft_`/`ipm_`/`waste_` | `soft_spec`, `soft_task`, `soft_completion`, `soft_audit`, `ipm_trap`, `ipm_observation`, `waste_record` |
| `lcc_` (lifecycle) | `lcc_forecast`, `lcc_backlog`, `lcc_scenario`; extend `est_asset` |
| `hov_` (handover) | `hov_handover`, `hov_cert`, `hov_warranty`, `hov_cobie_import_log` |
| `cal_`/`ntf_`/`evt_`/`sus_` | `cal_booking`, `ntf_message`, `ntf_confirmation`, `evt_outbox`, `sus_reading`† |

\* `wo_task_template` is tenant-agnostic reference (no RLS). † hypertables (`wo_meter_reading`, `sus_reading`) join `cc_reading`; add `cc_reading_daily`, `wo_ppm_daily_compliance`, `sus_reading_daily` continuous aggregates.

**The Asset Information Model is the spine.** Every module writes back to `est_asset`: PPM (next due, last completion), WOs (MTTR, failure codes), compliance (cert currency), lifecycle (replacement horizon, backlog €), meters (condition triggers), handover (warranties, O&M), H&S (Safety File hazards referenced by permits). `asset.status_rag` is the rolled-up health signal.

### 8.2 KPI catalogue (canonical, per module)

PPM: statutory completion % (G≥98/A≥90/R<90), MTTR, overdue-statutory (target 0), gate-block rate. Compliance: cert currency % (target 100), lapse risk at <30 days (target 0), defect closure ≥90% in 90 days, collections-risk defects open (target 0 critical). Collection-care: excursion MTTR (<4h breach / <1h critical), hours-in-band % (≥99 ASHRAE AA), sensor uptime ≥99, loan compliance %, active critical excursions (target 0). H&S: RAMS cycle <24h, competency-expiry alerts (target 0), incident rate (0 RIDDOR), permit closure (0 open past validity). Parts: availability at start ≥95, critical coverage 100, requisition-to-order <3 days. Lifecycle: unfunded backlog €, replacement funded ≥80% (5-yr), TCO/m², collections-risk backlog (target 0 unfunded). Soft services: completion ≥97, audit ≥85/100, IPM escalations (target 0), recycling rate vs target. Approvals: cycle <48h, committed-vs-budget ≤100%, unapproved commitments >48h (target 0).

### 8.3 Dashboards & evidence packs

Role dashboards: Director (estate health RAG + budget + decisions-waiting), FM/ops (open/blocked/due + parts + commitment gauge), Conservation (live zone tiles + active excursions named + loan compliance + IPM), Maintenance tech mobile (my jobs + gate status), Compliance officer (cert calendar + obligation RAG + Part 5 items + FOI extract), Finance (commitment ledger + approval queue + capital plan funded/unfunded). One-click evidence packs (PDF/A, FOI-archivable): loan-ready report, HSA audit bundle, board/funder assurance, Disability Act Part 5, FOI extract (GDPR-redacted). OData v4 feeds for Power BI (read-only, RLS-enforced via `fmiq_read`).

### 8.4 Governance

GDPR data minimisation (CMS reference + sensitivity only); retention — raw telemetry 90 days then compressed, aggregates 7 years; `core_audit_log` + certs 7 years (FOI Act 2014 + National Archives Act 1986); `hs_incident`/`hs_competency` 10 years (SHWW Act 2005); 35-day PITR; all data in North Europe; FOI redaction logged as a `FOI_REDACT` audit action.

---

## 9. Engineering approach (extending the real codebase)

**Conventions (preserve exactly what exists):** one `src/routes/<module>.ts` per capability, registered in `server.ts`; all DB access via `withTenant()`; `requireRole()` guards; Zod-validated bodies. Logic-heavy modules get a `src/domain/<module>.ts` mirroring `collectionCare.ts` (gate engine, approvals state machine, PPM scheduler); thin CRUD stays in the route file.

**Migrations:** sequential, never alter a prior file. `002_ppm`, `003_gate_engine`, `004_approvals+outbox`, `005_hs_permits`, `006_sustainability`, `007_handover`. Each wraps `BEGIN/COMMIT`, enables RLS + `tenant_isolation` for every new tenant table (reuse the `DO $$ FOREACH` block from `001_init.sql`), and grants `fmiq_app` at the end.

**Gate engine** (`domain/gateEngine.ts`): a `GATE_REGISTRY` mapping task type → applicable checks; `evaluateGates(ctx, client)` runs checks, logs failures, returns `{allPassed, results, blockedBy}`; `overrideGate(...)` records an audited override. `PATCH /api/v1/work-orders/:id/status` calls it before allowing `in_progress` (409 on block). **Built — see `adr-002-gate-engine.md` (migration `002`).**

**Eventing** (`domain/outbox.ts`): `emitEvent(client, evt)` with `ON CONFLICT (idempotency_key) DO NOTHING`, called inside the domain transaction; a polling worker publishes to Service Bus (Azure Communication Services email for MVP). **Built — see `adr-003-eventing-outbox.md` (migration `003`).**

**Approvals** (`domain/approvals.ts`): requisition state machine + a `ProcurementGateway` port (`nullProcurementGateway` stub) for the deferred PO/invoice integration; thresholds stored in DB, not hardcoded.

**Web/SPA:** split the 412-line `App.tsx` into a shell + `views/*` + `components/*` once the gate + approvals routes land (when Maintenance needs sub-views). Move to React Query for per-resource cache/revalidation. Build the **technician field app as a PWA** (`packages/mobile`, shared types via `packages/shared`): service-worker shell cache + IndexedDB sync queue for offline job start/close, photo, gate tick-offs, flushed on reconnect.

**Target API surface (additions, consistent with `/api/v1/*`):** `POST /work-orders`, `PATCH /work-orders/:id/status`, `GET /work-orders/:id/gates`, `POST /work-orders/:id/gates/:gateId/override`; `GET|POST /assets`, `PATCH /assets/:id`, `GET /assets/:id/qr`; `GET|POST /ppm/schedules`, `GET /ppm/due`, `POST /ppm/schedules/:id/complete`; `GET|POST /contractors`; `GET|POST /permits`, `PATCH /permits/:id`; `GET|POST /requisitions`, `POST /requisitions/:id/decision`, `GET /commitments`; `GET|POST /sensors`; `GET|POST /sustainability/readings`; `GET /notifications`, `POST /notifications/:id/read|ack`; `GET|POST /bookings`.

**Testing & quality:** unit tests for gate engine (every check + override, >90% branch), excursion (rate-of-change edges, dedup), approvals (threshold boundaries €4,999 vs €5,000), outbox (idempotency); **RLS isolation integration tests are the highest-risk gap** — real Postgres in CI, two tenants, assert tenant B sees zero of tenant A's rows, one test file per migration, run before any deploy; contract tests for adapters (golden vendor payloads); Playwright e2e for the three hero flows (excursion→WO→ack; PPM→gate→complete-with-cert; requisition→approval→commitment). CI: lint → unit → RLS (Docker Postgres) → e2e → build.

**Sprint sequencing to de-risk:** S1 platform primitives (gate engine, outbox, RLS test harness — no customer-visible feature, maximum risk reduction); S2 WO state machine + permits + approvals routes + App.tsx split; S3 PPM + assets + outbox worker; S4 sustainability + PWA field app. RLS test suite expands to new tables before they reach staging.

---

## 10. UI/UX (the 7am test, accessible to Irish public-sector standard)

**Role front doors** (one screen, one question, zero-typing): Director ("what needs money/attention?"), FM ("what's wrong, blocked, due?"), Conservation ("are my zones safe?"), Technician ("my jobs today"), Compliance ("what's due/overdue/evidenced?"), Contractor portal ("my permits, RAMS status, today's access"), Finance ("what needs my sign-off, committed vs budget?"). Each: ≤3 primary cards, one-tap primary action, everything pre-filled.

**Hero screens:** WO job card with the gate as a single green "Ready to start" / red "Blocked — [exact item]" banner first; mobile "Take 5" (five one-tap screens, blocked if no permit); PPM "Today" list; compliance "what's due" (Overdue / Due-14-days / Upcoming sections, text+icon); approval inbox (inline approve, delegated-limit subtext); handover completeness checklist ("7 of 11 complete", named missing items); permit issue/sign-off (QR-driven, isolation checklist).

**Plain language, always:** "Humidity rising fast in the Print Room — action needed now" not "RH rate-of-change excursion, WO-0312, P1." Undo over confirm (5s toast, not blocking modal). No empty states — every empty list has a positive statement + one action.

**Accessibility (mandatory):** WCAG 2.2 AA / EN 301 549 (S.I. 358/2020, EAA S.I. 699/2023); contrast ≥4.5:1, focus visible, targets ≥44×44px (glove-safe), ARIA live regions for alerts (`role="alert"`) and toasts (`role="status"`), 200% reflow at 320px, `prefers-reduced-motion`, tagged PDF/UA exports; **status never by colour alone** (icon + text); bilingual EN/GA (`lang="ga"` on Irish strings, `en.json`/`ga.json`, toggle persisted, available pre-login on the contractor portal); published Accessibility Statement + ACR/VPAT before any external go-live.

**New design-system components:** `<GateBanner>`, `<PermitCard>`, `<CertRAGRow>`, `<ApprovalRow>`, `<BookingCalendar>`, `<PartsChip>`, `<CompletenessMeter>` — each text+icon, keyboard-operable, ARIA-correct.

---

## 11. Delivery: roadmap, swarm, RACI, pilot, risks

### 11.1 Sprint roadmap (2-week sprints)

**Phase 1 — NOW (S1–S12, ~6 months): pilot-ready MVP.** S1–S2 Tier 0 primitives (RLS/Entra/eventing/audit/gate/calendar/notification/mobile shell); S3–S4 asset register + estate; S5–S6 PPM scheduler + statutory library; S7 compliance cert register + escalation; S8–S9 SSoW Readiness Gate; S10 spare parts + reservation; S11 reactive lifecycle + mobile field app; S12 role dashboards + scheduled reports + **published ACR** + pilot go-live. *Exit: a real excursion at the pilot site produces a WO in <60s with named at-risk objects, is actioned on mobile through a green gate, and generates a loan-ready evidence record.*

**Phase 2 — NEXT (S13–S26, months 6–14):** soft services + QR; IPM; lifecycle costing + capital calendar; contractor vault; **Handover Gate + COBie import**; Projects/CWMF + approvals/commitment depth; sustainability + Bizot; no-code report builder + Power BI/OData; live ERP PO/invoice callback.

**Phase 3 — LATER (S27+):** AI fault triage → predictive maintenance → NL/RAG O&M assistant → digital twin/IFC viewer → multi-institution benchmarking → template marketplace.

### 11.2 Swarm operating model

Two pods post-S2. **Platform Pod** (2 eng + 1 data eng): Tier 0, migrations, adapters, integrations, stable API contracts (OpenAPI 3.1 + ADR merged before consumers build). **Product Pod** (2 eng + 1 UX): module delivery per roadmap, owns mobile. **Shared:** 1 PM (backlog, exit criteria, pilot), 1 QA/accessibility specialist (cross-pod, owns ACR + gate + RLS tests), NMI FM as product-owner proxy (weekly). Ceremonies kept lean: async daily written stand-up, 2h sprint planning, 1h review (NMI monthly from S3), 30-min weekly cross-pod API sync, ad-hoc ADR sessions. Handoffs are contract-first: Platform → Product via merged OpenAPI spec; Product → QA via test cases (WCAG + RLS + gate edges); Product → NMI via monthly staging demo with signed exit criterion.

### 11.3 RACI (condensed)

| Workstream | PM | Platform Eng | Product Eng | UX | Data | QA/Access | NMI FM |
|---|---|---|---|---|---|---|---|
| Platform primitives | A | R | C | — | C | C | I |
| PPM + statutory library | A | C | R | C | — | C | C |
| Compliance certs | A | C | R | C | — | R | C |
| SSoW Readiness Gate | A | C | R | C | — | R | C |
| Parts / inventory | A | — | R | C | — | C | I |
| Reactive + mobile | A | C | R | R | — | R | C |
| Approvals + commitment | A | C | R | C | R | C | C |
| Handover / COBie | A | R | C | — | R | C | C |
| Integrations (sensors/BMS/CMS/ERP) | A | R | C | — | C | C | C |
| Data / analytics / reporting | A | — | C | C | R | C | C |
| WCAG 2.2 AA / ACR | A | C | C | C | — | R | I |
| NMI pilot deployment | R | C | C | C | C | C | A |

_R Responsible · A Accountable · C Consulted · I Informed._

### 11.4 Pilot at NMI

Single site (**Collins Barracks** — protected structure + visitor + stores, the hardest case). Live modules: collection-care loop, PPM (HVAC/fire/electrical statutory), compliance certs, SSoW gate, reactive + mobile, Conservation + Estates dashboards. 12 weeks live before any future RFT response. Success evidence: excursion→WO <60s (100%), alert→ack <15 min, go-live ≤8 weeks, published ACR, statutory PPM ≥95% on-time, 100% gate enforcement with zero un-investigated overrides, loan report <5 min. The pilot proves FMIQ is **live, in production at a National Cultural Institution, on the same codebase sold as SaaS** — directly addressing the eligibility tension (CLAUDE.md §2). Target a second client (OPW heritage property or university archive) in parallel so the "live at multiple institutions, configuration-not-code" claim is true by first RFT.

### 11.5 Top risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | "No bespoke" eligibility challenge | High | Critical | Second client in parallel; configuration-not-code discipline; document tenant-config separation in ADRs |
| R2 | Platform primitives slip → blocks all P1 | Med | High | Platform Pod dedicated to Tier 0 through S2; no P1 module starts without its primitive's ADR signed off |
| R3 | NMI access / sensor / Axiell integration delays | High | High | Pre-pilot MOU (data access, named contacts, weekly touchpoint); build adapters in S1 against synthetic data |
| R4 | WCAG gap found late | Med | High | QA/accessibility embedded from S1; axe-core in CI; manual audits S10 + S12 |
| R5 | RLS tenant-data leak | Low | Critical | RLS isolation tests in CI per table; quarterly pen test |
| R6 | Statutory library misses an Irish SI frequency | Med | High | Legal review of SFG20 × Irish SIs before S5; NMI H&S lead validates before S12 |
| R7 | NMI scope creep forks the codebase | High | Med | PRD change control; custom requests trigger a commercial conversation, not a fork |
| R8 | Key-person risk on RLS/eventing | Med | High | Pair-program primitives; ADRs; no single-owner tribal knowledge |
| R9 | Engagement value trips the €215k OJEU threshold early | Low | High | Structure pilot as fixed-fee PoC below threshold; pursue OGP framework listing in parallel |

### 11.6 Definition of Done (per module)

All of: acceptance criteria pass; **RLS cross-tenant test returns zero rows**; every state change writes an immutable audit record; gate logic covered for all edge cases (>90% branch); zero critical/serious axe-core violations + manual keyboard/screen-reader pass; mobile offline cycle works and syncs; P95 API <300ms at 50 concurrent users; relevant Irish SI/framework cited and SME-validated; Accessibility Statement/ACR updated before external go-live. Verification cadence: automated CI on every PR; QA regression at sprint close; NMI FM acceptance monthly; external pen test + independent accessibility audit pre-go-live (S12); post-pilot evidence pack compiled at week 12.

---

## 12. Immediate next actions

1. **Confirm Tier 0 as Sprint 1** — gate engine, `evt_outbox` + relay worker, and the RLS isolation test harness. Nothing customer-visible; everything downstream depends on it.
2. **Write migrations `002`–`004`** (PPM, gate engine, approvals + outbox) to the conventions in §9 — the schema for the legal spine.
3. **Sign the NMI pilot MOU** (R3) — data access, sensor install, named contacts, weekly touchpoint.
4. **Commission the statutory-library legal review** (R6) before S5.
5. **Stand up the second-client pipeline** (R1) so the off-the-shelf maturity claim is provable by first RFT.

_This plan is the integration layer; the module specs, ADR, and data model remain the detailed source-of-truth references. Update this document at each phase boundary._
