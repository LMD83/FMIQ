# PRD — PPM + Statutory Compliance Module (FMIQ)

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

Primary source: [`docs/research/04-ppm-compliance.md`](../research/04-ppm-compliance.md). Companion specs: [`docs/FMIQ-operations-modules-spec.md`](../FMIQ-operations-modules-spec.md) §1 and §2.5, [`docs/FMIQ-spec-irish-regulatory.md`](../FMIQ-spec-irish-regulatory.md), [`docs/research/05-collection-care.md`](../research/05-collection-care.md).

## Revision history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-06-11 | Initial PRD from research brief 04 + code inventory |

---

## 0. What already exists (code inventory)

This PRD extends a partial build. Do not respecify what is shipped; the deltas in §7–§8 are additive.

| Layer | Exists | Location |
|---|---|---|
| Schema | `wo_task_template` (shared library, red/pink/amber/green classification, `statutory_flag`, `default_frequency`, 6 seed templates), `wo_ppm_schedule` (asset × template, calendar/meter/seasonal/condition triggers, `lead_days`, `next_due`, RLS), `wo_meter_reading` hypertable | `app/packages/api/db/migrations/006_ppm.sql` |
| Schema | `cmp_obligation` (minimal: building, type, frequency, next_due, owner, `status_rag`), `cmp_certificate` (typed, expiry, BCMS ref), `cmp_inspection` + `cmp_inspection_item`, `cmp_defect` | `001_init.sql`, `007_compliance.sql` |
| Domain | `complianceClock()` (green → amber 80% → red 95% → breach, pure), `proposeTemplates()`, `createSchedule()`, `generateDueWorkOrders()` (lead-window WO generation, advances `next_due`); `expiryTier()` (90/60/30/7, pure), `certsDueForAlert()`, `recordInspection()` (fail → defect + remedial WO closed loop) | `domain/ppm.ts`, `domain/compliance.ts` |
| API | `GET/POST /api/v1/ppm/schedules`, `GET /ppm/templates`, `POST /ppm/generate`; `GET/POST /compliance/certificates`, `GET /compliance/alerts`, `POST /compliance/inspections` | `routes/ppm.ts`, `routes/compliance.ts` |
| Web | `Ppm.tsx` (schedule list, no planner grid), `Certificates.tsx`, `Dashboards.tsx`, `ContractorCompliance.tsx` | `packages/web/src/views/` |
| Adjacent | Collection-care excursion engine: zone targets, RH/temp breach → `cc_excursion` + auto work order naming at-risk objects | `domain/collectionCare.ts` |

**Gaps this PRD closes:** no canonical statutory register table; obligations not linked to statute, assets, or evidence; task close not evidence-gated; no 52-week planner or calendar; no inspection-pack export; schedule generation is DB-coupled (not a pure engine) and statutory due dates are not hard-locked; PPM not linked to environmental-monitoring criticality.

---

## 1. Problem + evidence

Irish public-sector and heritage estates fail at compliance *visibility*, not compliance *content*:

- **The content exists; the view does not.** SFG20's own State of FM 2026 reports compliance confidence declining year-on-year, 85% of estates with poor asset-register accuracy, and integration barriers more than doubled. Incumbents (Planon, MRI Concept Evolution) deliver compliance only after consultant-grade configuration and a dedicated administrator.
- **The legal exposure is personal and non-delegable.** Fire Services Act 1981/2003 s.18(2) places the duty on the *person having control of the premises*. A missed I.S. 3218 quarterly or an unmaintained Fire Safety Register is a statutory breach attributed to a named officer.
- **Heritage estates carry a second, irreversible failure mode.** A 15% RH spike over 48h in a collection store causes irreversible damage (PAS 198:2012). HVAC failure in a collection store is a collection-loss event, not a comfort issue — generic CAFM treats it as a routine job.
- **The statutory subset is small, public, and stable.** The high-value Red items (§4) need no third-party licence. FMIQ can own this content outright.

FMIQ's wedge: **out-of-the-box Irish statutory register + evidence-gated close + a simple RAG view**, winning on time-to-compliance-visibility, not feature count.

## 2. Personas + use cases

| Persona | Use case | What success looks like |
|---|---|---|
| **Estates manager** (e.g. NMI Head of Facilities) | Plans the maintenance year: which statutory items apply per building, when each falls due, contractor windows around exhibitions and visitor peaks | Opens the 52-week planner in week 1, sees every obligation placed, statutory items locked, labour-hours per week visible; nudges non-statutory work to flatten peaks |
| **Maintenance supervisor** | Balances this week's workload across in-house techs and contractors; closes completed tasks | Calendar view of the week; drag a discretionary task to next week; cannot drag a statutory task past its legal due date; closes a fire-alarm service only after the I.S. 3218 cert is attached |
| **Auditor / fire officer** (also HIQA, insurer, conservation officer) | Arrives with two days' notice and asks for evidence covering a date range | Estates manager exports a one-click, date-ranged inspection pack: register, certs, RAG snapshot, Fire Safety Register entries — minutes, not a week of folder archaeology |
| **Conservator** (collection-store responsibility) | Needs assurance the plant protecting the collection is maintained, and that a maintenance miss and an RH excursion are seen together | Collection-store AHU/dehumidifier PPM ranked highest criticality; seasonal tasks auto-generated; the obligation tile shows the environmental trend and any open excursion beside maintenance status |

## 3. Scope / non-goals

**In scope:** Irish statutory register as seeded FMIQ-owned content; obligation instantiation per building/asset; pure-function schedule generation feeding 52-week planner + calendar; evidence-gated task close; RAG compliance dashboard; date-ranged inspection-pack export; collection-store plant criticality linked to environmental monitoring; heritage flags (conservation method statement, BCAR-threshold flag).

**Non-goals:**
- **SFG20 as a dependency. Never.** The engine, register, and dashboards work with zero SFG20 content. SFG20 is an **optional connector** (customer brings their own licence via the Digital Partner Programme API) for licence-holding customers who want the full 1,200-schedule library. Rationale: PE-owned content standard, rising costs, monthly-changing schedules — see research §1. `standard_ref`/`sfg20_ref` columns remain free-text references, not licensed payloads.
- BCAR workflow automation. FMIQ **flags** when a maintenance job crosses the BCAR threshold (material alteration, change of use, protected-structure works → Section 57 / Commencement Notice territory); it does not manage BCAR submissions in this module.
- Stores/parts, contractor onboarding, permits-to-work (separate modules; this module consumes their interfaces).
- Legal advice. Frequencies ship as defaults with the legal basis cited; the tenant's responsible person confirms applicability per premises.

## 4. The statutory register as seeded content

`cmp_statutory_item` ships pre-populated. This is FMIQ-owned content keyed to Irish statute — the out-of-the-box differentiator. Top 10, ranked by legal exposure × inspection frequency × heritage relevance (research §6):

| # | Code | Item | Frequency (default) | Competent person | Evidence artefact | Legal basis |
|---|---|---|---|---|---|---|
| 1 | `FIRE_ALARM` | Fire detection & alarm service | Quarterly (25% blocks; whole system annually) | Competent fire-alarm contractor | Cert of Testing & Servicing (I.S. 3218 model cert) | I.S. 3218; Fire Services Act 1981/2003 s.18 |
| 2 | `EMERG_LIGHT` | Emergency lighting | Every 4 months periodic + monthly function test + annual full-duration | Competent EL contractor / in-house (monthly) | I.S. 3217 periodic report; Fire Safety Register entry (monthly) | I.S. 3217 |
| 3 | `FIRE_REGISTER` | Fire Safety Register upkeep | Continuous (weekly alarm test, monthly EL, daily checks) | Person having control of premises | The Register itself (master evidence record) | Fire Services Act 1981/2003 s.18 |
| 4 | `LEGIONELLA` | Legionella / water-system control | Monthly temperature monitoring; risk assessment review ~2-yearly | Competent water-treatment / responsible person | Risk assessment + monitoring logs | HPSC National Guidelines 2009; SHWWA 2005 |
| 5 | `LIFT_THOROUGH` | Lift / hoist thorough examination | Every 6 months | Competent person (engineer-surveyor) | Report of Thorough Examination (GA1) | SI 299/2007 Sch.1 Part B |
| 6 | `ELEC_PIR` | Fixed electrical installation periodic inspection | Every 3 years (public assembly); 5 years commercial | Registered Electrical Contractor (Safe Electric) | Periodic Inspection Report (I.S. 10101) | I.S. 10101; SHWWA 2005 |
| 7 | `COLL_HVAC` | Collection-store environmental plant | Seasonal (filters pre-summer, humidifier pre-winter, full AHU pre-exhibition) + manufacturer schedule | Competent HVAC contractor | Service report + environmental monitoring trend | PAS 198:2012; conservation duty of care |
| 8 | `GAS_BOILER` | Gas appliance / boiler service | Annual | Registered Gas Installer (RGI) | RGI Declaration of Conformance / service cert | Energy (Misc. Provisions) Act 2006 |
| 9 | `FIRE_EXT` | Fire extinguishers / suppression | Annual (+ extended/discharge per type) | Competent extinguisher contractor (I.S. 291) | Service certificate / labels | I.S. 291; Fire Services Act s.18 |
| 10 | `ASBESTOS` | Asbestos register / management survey | Maintain register continuously; survey before works on pre-2000 fabric | Competent asbestos surveyor (P402-equiv.) | Asbestos register + survey report | SHWW (Exposure to Asbestos) Regs 2006–2025 |

Items 11–16 of the research register (lifting accessories, cranes, pressure systems, lightning protection, weekly fire-alarm user test as a distinct row) ship in the same seed file at lower rank. Frequencies are defaults; each carries `legal_basis` text and a `verify_before_lock` note — tenants confirm against the current standard text on activation. `COLL_HVAC` is FMIQ-original content with no SFG20 equivalent.

## 5. UX

Five surfaces, one schedule model underneath:

1. **52-week forward planner.** Grid: buildings/asset-groups (rows) × ISO weeks (columns). Cells show due tasks colour-coded by criticality with text/icon redundancy (never colour alone — accessibility statement applies). Labour-hours-per-week footer row for workload balancing. Drag-to-move on non-statutory tasks; **statutory tasks render with a lock affordance and refuse any move past the legal due date** (engine-enforced, §6). Drill: building → asset → task → obligation → evidence.
2. **Calendar view.** The supervisor/technician week and month, same engine output filtered to assignee/team. No separate data model.
3. **RAG compliance dashboard.** One tile per active statutory item per building: green / amber (80% interval elapsed) / red (95%) / breach (overdue), reusing the shipped `complianceClock`. RAG also degrades on evidence state: a "completed" task without its required artefact, or an expired cert, cannot show green. Breach escalates (notification to Head of Facilities + safety lead — existing notification path). Tile drill-through ends at the evidence record. Collection-store tiles additionally show the live environmental trend and any open `cc_excursion`.
4. **Evidence-gated task close.** Closing a PPM work order whose obligation requires evidence demands the artefact (cert upload, register entry, monitoring log, photo) before the status can become `closed_compliant`. Close without evidence is only `closed_incomplete` and leaves the obligation RAG unchanged. Gate the close; do not merely allow upload.
5. **One-click inspection pack.** From the dashboard: pick date range + scope (estate/building) + audience (fire officer / HIQA / insurer / conservation officer) → export a bundle: register extract, obligations + RAG snapshot at export time, certificates and evidence within range, open defects and remedial WOs. Rendered to PDF + ZIP of artefacts, audit-logged as an export event.

Heritage deltas surface in UX: tasks against protected fabric show the conservation flag and require a conservation method statement reference before dispatch; jobs that cross repair → alteration show the BCAR-threshold flag.

## 6. Engine

**`generatePpmSchedule(input): ScheduleResult` — pure function.** Same discipline as GovIQ's `capStageEngine` / `evaluateVariationImpact`: no DB access, no side effects, no `Date.now()` inside (clock passed in). Input: asset list × applicable templates × obligation frequencies × horizon (52 weeks) × existing placements. Output: dated task instances with criticality, lock state, labour-hours, and per-week totals. Both planner and calendar render from this one output. The existing DB-coupled `generateDueWorkOrders()` becomes the persistence shell that consumes the engine's verdict; `complianceClock()` (already pure) is reused for RAG.

**Hard locks:**
- A statutory task instance's `legalDueDate` derives from statute frequency + last completed evidence date. The engine rejects any placement after `legalDueDate` (`reason: "statutory_lock"`); UI and API both surface the refusal. Non-statutory tasks are freely movable within the horizon.
- Statutory schedules cannot be deactivated or deleted while the underlying obligation is active — only the obligation's responsible person can deactivate an obligation, with reason, audit-logged.

**Workload balancing:** engine emits `labourMinutesPerWeek`; a balancing helper proposes moves of non-statutory tasks off peak weeks. Proposals only — the FM accepts.

**Collection-store plant criticality:** obligations on assets serving a `cc_zone` (join via asset → space → zone) are auto-ranked `collection_critical`, above `red` for prioritisation: WO priority `high`, tighter lead time, seasonal instances generated automatically (pre-summer filter, pre-winter humidifier, pre-exhibition full AHU using exhibition dates where present). The compliance tile and the zone's environmental trend share a screen; an open excursion on a zone flags the related plant obligation regardless of its maintenance RAG — a maintenance miss and an RH excursion must be visible together.

## 7. Data model deltas

Additive migrations only (008+). Postgres 16, RLS tenant-isolation pattern as in 006/007.

**New: `cmp_statutory_item`** — canonical register, FMIQ-seeded, tenant-agnostic (no RLS, read-only to `fmiq_app`, like `wo_task_template`):
`id, code (unique), title, category, default_frequency (interval expr), frequency_notes, competent_person_type, evidence_artefact_type, legal_basis, rank, collection_care_flag, heritage_notes, active`

**Extend: `cmp_obligation`** (currently building/type/frequency/next_due/owner/status_rag + 007's cert_type_code):
`+ statutory_item_id (FK cmp_statutory_item), asset_id (FK est_asset), competent_person_type, required_evidence_type, legal_due_date (date), interval_days (int), responsible_person_id (FK core_user), criticality (statutory|collection_critical|mandatory|optimal|discretionary), active`

**New: `cmp_evidence`** — the chain: statutoryItem → obligation → evidence:
`id, tenant_id, obligation_id (FK), certificate_id (FK cmp_certificate, nullable), work_order_id (FK wo_work_order, nullable), inspection_id (FK cmp_inspection, nullable), evidence_type (certificate|register_entry|monitoring_log|photo|report), blob_uri, sha256_hash, issued_date, expiry_date, recorded_by, recorded_at, status (valid|expired|superseded)`
Append-only in practice (supersede, never delete). Every row audit-logged via `core_audit_log` with `before`/`after`.

**Extend: `wo_task_template`:**
`+ statutory_item_id (FK cmp_statutory_item, nullable), competent_person_type, required_evidence_type, conservation_flag (boolean), steps (jsonb)`
Seed grows from 6 templates to cover all §4 items (one or more templates per item, e.g. EL monthly function test vs 4-monthly periodic).

**Extend: `wo_ppm_schedule`:**
`+ obligation_id (FK cmp_obligation, nullable), legal_due_date (date)` — set when statutory; the engine lock keys off this.

**Extend: `wo_work_order`:**
`+ close_state (closed_compliant|closed_incomplete, nullable)` — populated only for PPM/inspection closes.

Existing `cmp_certificate`, `cmp_inspection`, `cmp_defect` are unchanged; certificates become one evidence type referenced from `cmp_evidence`.

## 8. API surface

Versioned under `/api/v1`. Zod-validated, `requireRole` per existing RBAC, `withTenant` throughout. New/changed only:

```
GET    /compliance/statutory-items                  # seeded register (read-only)
GET    /compliance/obligations?buildingId&rag&statutoryItemCode
POST   /compliance/obligations                      # instantiate item × building/asset  [FM, TenantAdmin]
PATCH  /compliance/obligations/:id                  # frequency override (stricter only), responsible person, deactivate(+reason)
GET    /compliance/obligations/:id/evidence
POST   /compliance/evidence                         # attach artefact (multipart or blob ref)  [FM, MaintTech, TenantAdmin]
GET    /compliance/dashboard?buildingId             # RAG tiles incl. evidence-degradation + excursion flags
POST   /compliance/inspection-pack                  # { from, to, scope, audience } → async job
GET    /compliance/inspection-pack/:jobId           # status + signed download URL (time-limited)

GET    /ppm/planner?year&buildingId                 # 52-week engine output (cells + labour totals)
GET    /ppm/calendar?from&to&assigneeId             # same engine, calendar shape
POST   /ppm/schedules/:id/move                      # { newDate } → 409 statutory_lock if past legal due
POST   /ppm/balance/preview                         # workload-balancing proposals (no writes)
POST   /ppm/work-orders/:id/close                   # { evidenceId? } → 422 evidence_required if gated and absent
POST   /ppm/generate                                # existing; now engine-backed, writes legal_due_date

POST   /integrations/sfg20/connect                  # optional connector: customer licence credentials  [TenantAdmin]
POST   /integrations/sfg20/import                   # map SFG20 schedules → wo_task_template rows (provenance-tagged)
```

Error contract: `409 { error: "statutory_lock", legalDueDate }`; `422 { error: "evidence_required", requiredType }`. All mutating routes write `core_audit_log`.

## 9. Acceptance criteria

1. Fresh tenant: `GET /compliance/statutory-items` returns ≥ 16 seeded items including all 10 in §4, each with non-null frequency, competent-person type, evidence-artefact type, and legal basis.
2. Instantiating `FIRE_ALARM` against a building creates an obligation with `legal_due_date` = activation date + 3 months and a proposed quarterly schedule; the engine places 4 instances in the 52-week output.
3. `POST /ppm/schedules/:id/move` to a date ≤ `legal_due_date` on a statutory task succeeds; to a date after it returns `409 statutory_lock` and the planner shows the task unmoved. Non-statutory tasks move freely within the horizon.
4. `generatePpmSchedule` is pure: given identical input (including injected clock) it returns byte-identical output; the test suite calls it with no DB connection. No `Date.now()` in the engine file (lint/test-enforced).
5. Closing a fire-alarm PPM work order without attached evidence returns `422 evidence_required`; the obligation RAG is unchanged. Closing with an I.S. 3218 cert attached sets `close_state = closed_compliant`, writes a `cmp_evidence` row with sha256, and recomputes `legal_due_date` forward one interval.
6. RAG: obligation at 79% of interval = green, 80% = amber, 95% = red, past due = breach (reusing `complianceClock`); an obligation whose latest evidence is expired cannot render green even when the next task is not yet due.
7. Breach on a statutory obligation creates an escalation notification to the building's responsible person and tenant safety role within one generation cycle.
8. An asset linked (via space → `cc_zone`) to a collection store gets `criticality = collection_critical`; its generated WOs carry `priority = high`; seasonal instances (pre-summer filter, pre-winter humidifier) appear in the planner without manual creation; its dashboard tile includes the zone's open-excursion flag.
9. An open `cc_excursion` on a zone flags the related plant obligation tile even when its maintenance RAG is green.
10. `POST /compliance/inspection-pack` for a 12-month range returns a job that completes with a PDF + artefact bundle containing register extract, RAG snapshot timestamped at export, every in-range `cmp_evidence` artefact, and open defects; the export itself appears in `core_audit_log`.
11. With no SFG20 connector configured, every criterion 1–10 passes (no code path requires SFG20 content). With the connector configured against a stub, imported schedules appear as `wo_task_template` rows tagged with provenance and never overwrite FMIQ-seeded statutory templates.
12. A task template with `conservation_flag = true` cannot be dispatched to a work order without a conservation method statement reference; a WO flagged as crossing the BCAR threshold renders the flag in UI and API payloads.
13. RLS: tenant A cannot read or write tenant B's obligations, evidence, or packs (existing isolation test pattern extended to new tables); `cmp_statutory_item` is read-only to `fmiq_app`.
14. Evidence rows are never hard-deleted: supersede sets `status = superseded`; `DELETE` is not granted on `cmp_evidence`.

## 10. Phasing

**Phase 1 — Statutory register + evidence chain (earliest shippable slice).**
Migration 008 (`cmp_statutory_item` seed, `cmp_obligation` extensions, `cmp_evidence`), obligation instantiation, evidence-gated close, RAG dashboard v1 (tiles from `complianceClock` + evidence state), inspection-pack export v1 (PDF + ZIP). Reuses the shipped clock, certificate, and inspection code. *This alone is demo-able to a fire officer or NMI evaluator and is the out-of-the-box differentiator — AC 1, 2, 5, 6, 10, 13, 14.*

**Phase 2 — Schedule engine + planner.**
Extract `generatePpmSchedule` as a pure engine; statutory hard locks; 52-week planner + calendar UI; workload-balancing preview; breach escalation; legal-due-date recompute on compliant close. — AC 3, 4, 7.

**Phase 3 — Heritage + collection-care depth.**
`collection_critical` ranking, seasonal auto-generation, excursion ↔ obligation cross-flagging on shared screens; conservation method statement and BCAR-threshold gates. — AC 8, 9, 12.

**Phase 4 — Connectors.**
SFG20 optional connector (customer-licence model, provenance-tagged import); audience-specific inspection-pack variants (HIQA, insurer, conservation officer). — AC 11.

---

End — v0.1 — 2026-06-11
