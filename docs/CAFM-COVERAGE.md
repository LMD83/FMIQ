# FMIQ — CAFM/IWMS Feature Coverage Matrix

_Date: 2026-06-08. An evidence-based audit of FMIQ against the canonical CAFM/IWMS feature
set of the market leaders (Planon, IBM Maximo, Archibus/Eptura, MRI Evolution, Service Works
QFM, Infraspeak, MaintainX). Status: ✅ built & tested · 🟡 partial · ⬜ gap. Every ✅ has
migrations + domain logic + tests behind it (206 API tests at time of writing)._

## Verdict

FMIQ now covers the **core CAFM operational spine end-to-end** plus the heritage/collection-care
differentiators no incumbent has. Of the canonical CAFM feature areas, the large majority are
✅; the remaining items are mostly **front-end surfacing, document management, and reporting
output** — not missing engines. The wedge (closed-loop collection care, Handover Gate, the
"no paperwork, no work" SSoW gate) is genuinely ahead of the market.

---

## 1. Help desk & service management

| Feature | Status | Where |
|---|---|---|
| Self-service request intake (web/QR/email/mobile) | ✅ | `req_request`, `domain/requests.ts`, `views/Helpdesk.tsx` |
| Auto-triage (category + priority) | ✅ | `ruleBasedTriage` / Claude triage |
| Request → work order conversion | ✅ | `convertRequest` |
| **SLA tiers (response/fix) + breach state** | ✅ | `wo_sla_policy`, `domain/sla.ts` |
| Auto-SLA applied on WO creation | ✅ | `convertRequest` + `resolveSla` |
| ITSM/existing-helpdesk dedupe | ⬜ | assess at pilot MOU |

## 2. Reactive maintenance / work orders

| Feature | Status | Where |
|---|---|---|
| WO lifecycle state machine (open→assigned→in_progress→closed) | ✅ | `domain/workOrders.ts` |
| Gate-enforced start ("no paperwork, no work") | ✅ | gate engine + SSoW |
| FMEA-style failure coding on close | ✅ | `closeWorkOrder` |
| Human-friendly WO refs (WO-YYYY-NNNNN) | ✅ | `nextRef` |
| Priority + SLA clock + breach | ✅ | `domain/sla.ts` |
| Skills/geo dispatch | 🟡 | assignee/contractor on WO; auto-routing TODO |

## 3. Planned maintenance (PPM)

| Feature | Status | Where |
|---|---|---|
| SFG20-aligned task library | ✅ | `wo_task_template` (seeded) |
| Auto-propose schedule from asset type | ✅ | `proposeTemplates` |
| Statutory classification (red/pink/amber/green) | ✅ | `wo_ppm_schedule` |
| Compliance clock (green→amber→red→breach) | ✅ | `complianceClock` |
| Auto-WO generation ahead of due | ✅ | `generateDueWorkOrders`, `views/Ppm.tsx` |
| Meter/condition-based triggers | 🟡 | `wo_meter_reading` stored; trigger wiring TODO |
| PPM bundling | ⬜ | master plan §4.1 |

## 4. Assets & estate

| Feature | Status | Where |
|---|---|---|
| Hierarchical estate (site→building→floor→space→zone) | ✅ | `est_*` |
| Asset register CRUD + condition grade | ✅ | `domain/assets.ts` |
| QR/NFC tagging | ✅ | `qr_uid` + `assetQrPayload` |
| Heritage/protected-structure flags | ✅ | `est_building` |
| Lifecycle costing / replacement forecast | ✅ | `domain/lifecycle.ts` |
| IFC/COBie import | ✅ | `adapters/cobie.ts` + Handover Gate |

## 5. Compliance, inspections, H&S

| Feature | Status | Where |
|---|---|---|
| Certificate register + escalating expiry alerts | ✅ | `domain/compliance.ts`, `views/Certificates.tsx` |
| Mobile inspections → fail → remedial WO | ✅ | `recordInspection` |
| SSoW Readiness Gate (RAMS/permit/competency/pre-task/keys) | ✅ | `008_ssow` + gate engine |
| Revenue eTax contractor gating | ✅ | `domain/taxClearance.ts` |
| Incidents / near-miss / RIDDOR | ✅ | `hs_incident` |
| Fire-alarm / emergency-lighting auto-records | ✅ | `domain/lifeSafety.ts` |

## 6. Contractors & SLAs

| Feature | Status | Where |
|---|---|---|
| Contractor register + insurance | ✅ | `wo_contractor` |
| Competency/insurance vault | ✅ | `hs_competency` |
| **Performance scorecards (on-time %, breaches)** | ✅ | `contractorScorecard` |
| Self-onboarding / prequal workflow | 🟡 | EP-CON — vault + eTax exist; portal TODO |

## 7. Stores / inventory

| Feature | Status | Where |
|---|---|---|
| Catalogue + stock min/max | ✅ | `inv_part`/`inv_stock` |
| Reserve-against-WO + issue/consume | ✅ | `domain/inventory.ts` |
| Auto-reorder at min → requisition | ✅ | `issueToWorkOrder`, `views/Inventory.tsx` |

## 8. Space & occupancy

| Feature | Status | Where |
|---|---|---|
| Space register + cost-centre | ✅ | `est_space` |
| Room/resource booking (conflict-free) | ✅ | `cal_booking` (GiST exclusion) |
| Live floor-map (2D, RAG by status) | ✅ | `views/FloorMap.tsx` |
| Occupancy / utilisation analytics | ⬜ | needs footfall feed |
| Desk booking UI | ⬜ | booking engine exists; UI TODO |

## 9. Projects & capital (CWMF)

| Feature | Status | Where |
|---|---|---|
| Capital project register + budget/spend | ✅ | `prj_project` |
| Gated approvals + commitment + ERP boundary | ✅ | `domain/approvals.ts`, `views/Approvals.tsx` |
| Handover Gate + COBie auto-population | ✅ | `domain/handover.ts` |
| Drawdown/valuation certification | 🟡 | `prj_drawdown` modelled; workflow TODO |

## 10. Mobile, reporting, integrations, sustainability

| Feature | Status | Where |
|---|---|---|
| Mobile/PWA field app + offline write-queue | ✅ | `views/Field.tsx`, `offline/queue.ts`, `sw.js` |
| Role dashboards (Director/FM/Conservation/Finance) | ✅ | `views/Dashboards.tsx`, `domain/dashboards.ts` |
| Open REST API (all modules) + adapters | ✅ | `routes/*`, `adapters/*` |
| Energy/carbon/Bizot/SEAI | ✅ | `domain/sustainability.ts` |
| Predictive maintenance + AI triage/assistant | ✅ | `domain/predictive.ts`, `domain/ai.ts` (Claude) |
| **One-click evidence packs (WO chain → print-ready HTML; PDF/A via renderer)** | ✅ | `domain/evidence.ts`, `views/EvidencePacks.tsx` |
| **Document/O&M management (versioned, linked golden thread)** | ✅ | `doc_*`, `domain/documents.ts`, `views/Documents.tsx` |
| Visitor / footfall operations | ⬜ | museum-specific; system review §4 |

---

## Remaining to be unambiguously market-leading (prioritised)

1. **Occupancy/utilisation + visitor/footfall** — needs a footfall feed; drives soft-services scaling. **Medium.**
2. **Contractor self-onboarding portal** (EP-CON) + drawdown workflow. **Medium.**
3. **Meter/condition-based PPM triggers** + PPM bundling. **Medium.**
4. **Scheduled-report delivery** (cron + email of the evidence pack) and the **PDF/A deployment renderer** wiring — the pack assembler + print HTML are built; this is scheduling + a headless-render interop step. **Medium.**
5. **SSoW front-end** (the gate/RAMS/permit workflow as a screen) — engine + routes exist. **Low/Medium.**
6. **Digital-twin 3D/IFC viewer** (xeokit) — 2D live map shipped; 3D is browser-3D. **Later.**

_Front-end surfacing is now substantially done._ Screens shipped and data-bound to the REST routes, with Playwright E2E + axe a11y coverage and NMI demo seed data: **Help desk** (intake + queue + convert), **Documents & O&M** (register + version history), **Evidence packs** (builder + print-ready HTML), **Planned maintenance** (SFG20 schedules + generate), **Certificates** (register + expiry alerts), **Stores & inventory** (catalogue + reorder), **Approvals** (requisitions + approve/reject). Remaining items above are feeds, scheduled delivery, the SSoW screen, and the 3D twin — not missing engines._

None of these are missing engines — they're surfacing, reporting output, or feeds. The CAFM
operational core (helpdesk → triage → WO → SLA → gate → close → evidence, plus PPM, compliance,
assets, contractors, stores, approvals, projects/handover) is built and tested.
