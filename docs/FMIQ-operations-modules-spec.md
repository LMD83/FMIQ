# FMIQ Operations Modules — Detailed Feature Plan

_The operational core: how FMIQ runs a building day-to-day once GovIQ has it in control. Module-by-module features, logic, the safety "blocking gates", data entities, Irish legal basis, and the simple-UX rule for each. Date: 2026-06-06._

**Two principles run through every module:**
1. **No paperwork, no work.** A job cannot start until its prerequisites (RAMS approved, competencies valid, permit issued, pre-task plan done) are green. The system *blocks*, it doesn't warn.
2. **The 7am test.** Every screen is usable by an untrained person in under 60 seconds — plain language, one-tap, traffic-light truth.

---

## 1. Planned Maintenance (PPM) Scheduling System

**Purpose:** keep every asset legally compliant and operational without anyone having to remember when things are due.

**Features**
- **Schedule library by asset type** — adding an asset auto-proposes the correct maintenance schedule and legal frequency (SFG20-aligned task library).
- **Trigger types:** calendar (weekly/monthly/annual), meter/runtime (run-hours, cycles), seasonal, and condition-based (sensor/BMS threshold).
- **Statutory vs discretionary classification** — red (statutory, locked, cannot be deleted), pink (mandatory), amber (best practice), green (optional). Red tasks are visually locked.
- **Auto work-order generation** — jobs raised ahead of due date with lead time for parts/permits.
- **Priority suppression** — if a monthly and annual task fall together, the system bundles them, no duplicate visit.
- **Compliance clock** — every statutory task shows time-to-due as green → amber (80% elapsed) → red (95%) → breach (named escalation to Head of Facilities + Safety lead).
- **Forecast view** — 12-month forward labour and visit load per site, for resourcing.
- **SFG20 live update** — when a schedule changes in law, present a side-by-side and require accept/escalate before frequency changes.

**Data:** `wo_ppm_schedule` (asset, task_template, frequency, trigger, next_due, sfg20_ref, statutory_flag), `wo_task_template` (steps, discipline, skill, standard_ref, est_minutes).

**Irish basis:** fire I.S. 3218 / emergency lighting I.S. 3217; electrical I.S. 10101; lifts/work-equipment S.I. 299/2007; Legionella S.I. 572/2013 + HPSC; F-Gas 517/2014; asbestos S.I. 386/2006.

**Simple-UX:** the technician sees "Today" — a list of cards, each "what / where / how long". One tap to start.

---

## 2. Spare Parts / Inventory / Stores

**Purpose:** the right part is on the shelf (or on order) before the job needs it — never a job delayed for a part.

**Features**
- **Parts catalogue** with manufacturer, part number, supplier, unit cost, lead time, shelf location/bin.
- **Stock levels** per store with min/max reorder points and **auto-reorder** when min hit.
- **Parts ↔ asset link** — each asset lists its compatible spares (seeded from the COBie "Spare" tab at handover).
- **Reserve against work order** — opening a PPM/job reserves the parts; if stock is short the job flags "awaiting parts" and a purchase task is raised.
- **Issue & consume** — mobile scan to take a part from stock; stock decrements; cost posts to the work order.
- **Critical-spares flag** — parts for AAA/critical assets (e.g. collection-area chiller) held to a higher min level.
- **Supplier & PO link** — reorder creates a PO; receipt updates stock; three-way match (PO ↔ receipt ↔ invoice).
- **Valuation & usage analytics** — stock value, slow/fast movers, consumption per asset (feeds lifecycle costing §4).

**Data:** `inv_part`, `inv_stock` (part, store, qty, min, max, bin), `inv_movement` (issue/receipt/adjust, work_order, qty, ts), `inv_po`.

**Irish basis:** value-for-money under Infrastructure Guidelines 2023; supports statutory uptime of safety systems.

**Simple-UX:** "Parts for this job" shows in/out of stock with a green tick or an amber "on order — ETA"; one tap to reserve.

---

## 3. Compliance Certificates & Statutory Checks

**Purpose:** every legal certificate is current, evidenced, and never lapses unnoticed.

**Features**
- **Certificate register** — each cert a first-class record: type, reference, issuer, issue/expiry dates, linked asset/building, PDF evidence, BCMS reference (Irish).
- **Escalating expiry alerts** — 90/60/30/7 days, to the named responsible owner; in-app + email.
- **Auto-renewal work order** — when an alert fires, a renewal job/procurement task is created with contractor, scope and last-cert pre-filled.
- **Inspection checklists** — mobile, pass/fail with photo evidence; a fail auto-creates a remedial work order (closed loop).
- **Estate compliance dashboard** — RAG by building and by obligation type (text + icon, never colour alone).
- **Immutable audit trail** — who uploaded/changed what, when (FOI / GDPR accountability).
- **Regulatory-change watch** — flags affected certs when a governing SI changes.

**Data:** `cmp_obligation`, `cmp_certificate` (type, ref, issuer, issue_date, expiry_date, asset/building, blob_uri), `cmp_inspection`, `cmp_defect` (→ remedial work order).

**Irish basis:** the full statutory set (fire, electrical, lifts, Legionella, F-Gas, asbestos), BCAR (S.I. 9/2014), Disability Act 2005 Part 5 reporting, FOI Act 2014, GDPR/DPA 2018.

**Simple-UX:** one screen — "What's due, what's overdue, what's evidenced." Red items show the single next action.

---

## 4. Lifecycle Costing (Capital Replacement Planning)

**Purpose:** know what every asset will cost to keep and when it must be replaced — turning reactive surprises into planned capital.

**Features**
- **Asset lifecycle record** — install/commission date, expected design life, replacement cost, current condition grade (A–D from survey).
- **Remaining-life forecast** — design life adjusted by condition + (later) predictive health score.
- **Replacement-due calendar** — 1/3/5/10-year forward capital plan per site, costed and inflation-adjustable.
- **Total cost of ownership** — capital + planned maintenance + reactive + energy + parts, rolled up per asset/system/site.
- **Backlog maintenance register** — costed defects not yet funded, risk-ranked (incl. collections risk).
- **Scenario planning** — "defer vs replace" cost/risk comparison to support capital bids.
- **Feeds capital projects** — a replacement need becomes a project in the CWMF pipeline (the loop back to GovIQ procurement).

**Data:** `est_asset` (design_life, replacement_cost, condition_grade), `lcc_forecast`, `lcc_backlog` (defect, cost, risk, funded_flag).

**Irish basis:** RICS NRM3 cost planning; Infrastructure Guidelines 2023 (capital appraisal); CWMF.

**Simple-UX:** a director sees "What needs money, when, and what happens if we wait" — three numbers, traffic-light risk.

---

## 5. Soft Services Planning Regime

**Purpose:** cleaning, security, grounds, waste, pest, catering, portering — planned, verified, and measured to SLA.

**Features**
- **Service specifications** — cleaning frequency/standard mapped to space type (gallery vs store vs office vs WC); generates task cards.
- **Rosters & schedules** — recurring soft-service tasks by zone, shift, operative/contractor.
- **QR-verified completion** — scan at point of work to confirm a task was actually done, where and when.
- **Quality audits** — supervisor inspection scoring (e.g. BICSc-style), photo evidence, trend by zone; a fail raises a re-clean task.
- **IPM / pest module (heritage-critical)** — trap register, check logs, sightings, treatments mapped to spaces; pest near collections escalates.
- **Waste streams** — volumes/weights, recycling rate, cost per tonne vs reduction targets.
- **Visitor-linked scaling** — security/cleaning resource scales to footfall.
- **SLA tracking** — response/quality targets, breach alerts, contractor scorecards.

**Data:** `soft_spec`, `soft_task` (space, frequency, checklist), `soft_completion` (qr, photo, ts, by), `soft_audit`, `ipm_trap`, `ipm_observation`, `waste_record`.

**Irish basis:** Private Security Services Act 2004 (security); FSAI Act 1998 (catering); Waste Management Acts 1996–2011 + Circular Economy Act 2022; National Cultural Institutions Act 1997 (collection protection/IPM).

**Simple-UX:** the cleaner opens "My rounds today" — tap a card, scan the QR, done.

---

## 6. Health & Safety — Safe System of Work (the blocking-gate engine)

**Purpose:** nobody works on the estate without the correct, current, approved paperwork **in advance** — the system enforces it.

### 6.1 Risk Assessments & Method Statements (RAMS)
- Contractors/teams upload a **Risk Assessment + Method Statement** per task/scope before work.
- **Review & approve workflow** — FM/Safety lead reviews; status: draft → submitted → approved → expired. Only **approved + in-date** RAMS unlock a job.
- Version-controlled; tied to the specific work order and asset; references hazards from the **Safety File**.

### 6.2 Permit to Work (PTW)
- Electronic permits for high-risk work: **hot works, confined space, work at height, electrical isolation/LOTO, roof/heritage-fabric access, working near collections.**
- Permit defines isolations, precautions, validity window, authoriser; **issued before start, signed off (reinstated) at end.**
- Permit pulls asset-specific isolation points and hazards from the O&M / Safety File.

### 6.3 Contractor competency & insurance vault
- Each contractor holds: **Safe Pass**, trade certs, public/employer liability **insurance**, RECI/RGII registration where relevant, inductions.
- Documents have expiry dates; the vault auto-blocks assignment if anything is expired.

### 6.4 The Readiness Gate (no paperwork → no work)
A work order **cannot move to "in progress"** unless ALL gate checks are green:

```
GATE CHECK (evaluated before a job can start)
  ✓ Approved, in-date RAMS for this task
  ✓ Permit to Work issued (if task type requires one)
  ✓ Assignee/contractor competencies valid (Safe Pass, trade cert)
  ✓ Contractor insurance in date
  ✓ Required parts reserved/available
  ✓ Daily pre-task plan completed (see 6.5)
  ✗ any red  →  START is disabled, with the exact missing item named
```
Every block is logged (who/what/when) for HSA inspection and audit. An authorised manager may record a documented override only for defined cases — the override itself is audited.

### 6.5 Daily Pre-Task / Point-of-Work Plan ("Take 5")
- Before starting each day/task, the operative completes a short **point-of-work risk assessment** on mobile: confirm the area, hazards still as expected, controls in place, PPE, dynamic changes since RAMS.
- Two taps; if anything has changed, it flags "stop and reassess" and notifies the supervisor.
- Completion is one of the gate checks (6.4).

### 6.6 Incidents, near-misses, investigation
- Report incident/near-miss (staff/visitor/contractor) on mobile with photo; triage; investigation workflow; corrective actions tracked to close.
- **RIDDOR-equivalent** statutory reporting prompts.

**Data:** `hs_rams` (status, version, approved_by, expiry, work_order), `hs_permit` (type, isolations, valid_from/to, authoriser, status), `hs_competency` (contractor, type, expiry, doc), `hs_pretask` (work_order, checklist, by, ts), `hs_incident`, `wo_work_order.gate_status`.

**Irish basis:** **Safety, Health and Welfare at Work Act 2005** (safe system of work, competent persons); **SHWW (General Application) Regs 2007 (S.I. 299/2007)** — work at height (Part 4), confined spaces (Part 9), electricity (Part 3); **SHWW (Construction) Regs 2013 (S.I. 291/2013)** — Safety File, PSCS/PSDP; HSA enforcement; Safe Pass (CIF/SOLAS).

**Simple-UX:** the job card shows a single **green "Ready to start" or red "Blocked — RAMS not approved"**. No ambiguity, no hunting.

---

## 7. Super features (the differentiators I'd build in)
- **Closed-loop collection care** — sensor excursion → names at-risk objects (from Axiell) → auto work order with conservation notes → evidence (already built; the wedge).
- **Handover Gate** — capital completion + BCAR/HSE certs + COBie → auto-populates assets, PPM, compliance clock, warranties (the "hot start").
- **AI fault triage & auto-drafted work orders** — plain-language report in, prioritised job out (human-approved for critical assets).
- **Predictive maintenance** — sensor/runtime ML; heritage HVAC weighted by conservation risk.
- **Natural-language assistant (bilingual)** — "what's broken and what do I do?"; reads the O&M manuals (RAG).
- **Live floor-plan twin** — zones colour-coded by status, sensors overlaid.
- **Predictive compliance** — risk-scores statutory obligations 10–12 weeks ahead.
- **One-click evidence packs** — loan facility report, board assurance, funder pack, HSA audit bundle, all from live data.

---

## 8. How the modules connect (one thread)
```
Handover Gate ─▶ Asset register ─▶ PPM schedules + Compliance clock + Lifecycle costing
                        │                     │
                   Spare parts         Certificates & checks
                        │                     │
                  Work order ◀── Soft services / Reactive / Excursion
                        │
                 READINESS GATE (RAMS · Permit · Competency · Insurance · Pre-task)  ──▶ START
                        │
                   Mobile execution ─▶ Evidence ─▶ Audit trail ─▶ Reports
```
Everything writes back to the asset record (the living Asset Information Model) and the immutable audit log.

## 9. Build order
1. **P1 now:** PPM scheduling + compliance certs + the Readiness Gate (RAMS/permit/competency/pre-task) — these are the legal spine.
2. **P1 alongside:** spare parts (so jobs aren't blocked for parts), collection-care loop (built).
3. **P2:** soft services + IPM, lifecycle costing, contractor vault, handover gate.
4. **P3:** AI triage, predictive maintenance, NL assistant, twin, predictive compliance.
