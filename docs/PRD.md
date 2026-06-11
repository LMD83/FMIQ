# PRD — FMIQ by GovIQ

**An IWMS that protects the building, the environment, and the object — in one platform.**

_Working product name: **FMIQ** (provisional). Status: v0.1 draft. Owner: Liam / GovIQ. Date: 2026-06-05._

---

## 0. The one-line thesis

Every other IWMS manages the **building**. FMIQ manages the building **and the collection environment inside it** — and closes the loop between an environmental excursion and the operational response, with the at-risk objects named. No incumbent does this.

---

## 1. Problem & evidence

### 1.1 The market gap (validated by research)

The IWMS market (~USD 4–7bn, ~13% CAGR) is led by Planon, IBM TRIRIGA/Maximo, Archibus (Eptura), MRI Evolution, and Service Works QFM. Every one of them treats a museum like an office block. **None has native collection-care environmental management.** Separately, best-in-class collection monitoring (Conserv, Hanwell) does environment beautifully but is *not* an IWMS — it has no work orders, no compliance register, no BMS write-back, no project/programme management, and no link to the collections catalogue.

The result for a body like NMI: **three to five siloed systems** (CAFM + environmental monitoring + BMS + collections management + spreadsheets), with the most important handoff — "the RH in Gallery 3 just spiked, what do we do and which objects are at risk?" — handled manually, slowly, and without an audit trail.

### 1.2 Why this is acute for NMI specifically

NMI's PMC names collection care as the **standout requirement**: micro-management of the physical environments holding collections, with monitoring, reporting, and operational response. NMI runs four public sites across historic, hard-to-control fabric (Collins Barracks 1702; Natural History listed building; Kildare St; Country Life rural estate) plus stores. Environmental control in protected buildings is genuinely hard — which is exactly why the monitoring-to-response loop matters.

### 1.3 Eligibility reality (be honest)

NMI's PMC wants *proven, off-the-shelf, already-live, not bespoke*. FMIQ is greenfield today. **Strategy:** build FMIQ as a real product, mature it through pilots, and position it as the off-the-shelf platform that satisfies this class of public-sector RFT over time. NMI is the lighthouse requirements source and a future pilot target — not a contract we pretend we can win cold this quarter. This PRD is written to that honest standard.

---

## 2. Target users & jobs-to-be-done

| Persona | Role | Primary job | Today's pain |
|---|---|---|---|
| **Conservation Officer** | Protect the collection | Keep every gallery/case/store within conservation targets; document it for loans, funders, board | Monitoring tool is separate from the FM team who fix the HVAC; no object-level risk view |
| **Head of Estates / FM Manager** | Run the estate | Reactive + planned maintenance, compliance, contractors, capital projects across multi-site | CAFM doesn't know about collection risk; can't prioritise a job by "objects at risk" |
| **Maintenance Technician** | Fix things | Receive, action, close work orders in the field, often offline in vaults/roof spaces | Clunky mobile, no offline, no asset scan |
| **Compliance / H&S Lead** | Stay legal | Statutory inspections, asbestos, fire, legionella, RIDDOR/HSA | Evidence scattered; audit prep is manual |
| **Capital Projects Lead** | Deliver projects | Manage CWMF/PWC capital works, budgets, closure impact | Project data never feeds back into the asset register |
| **Director / Board** | Assurance & funding | Portfolio risk, compliance RAG, sustainability, grant reporting | No single source of truth; reports built by hand |
| **External lender/funder** (read-only) | Due diligence | Verify environmental compliance for a loan | Facility reports compiled manually, point-in-time |

---

## 3. Goals & non-goals

### 3.1 Goals (this product)
1. Unify CAFM/IWMS + collection-care environmental management in one platform.
2. Close the **excursion → object risk → work order → response → evidence** loop automatically.
3. Be **procurement-ready for Irish/EU public sector on day one**: Entra SSO, EU data residency, WCAG 2.2 AA, audit trails, open API.
4. Time-to-value in **weeks, not the 9–18 months** incumbents need.
5. Multi-tenant SaaS so one codebase serves NMI, OPW, local-authority museums, universities, archives.

### 3.2 Non-goals (explicitly out of scope, for now)
- We do **not** manufacture sensors. We **integrate** Hanwell, Conserv, T&D, HOBO, BMS. (Hardware-agnostic adapter layer.)
- We do **not** replace the collections management system (Axiell/TMS). We **link** to it for object-location and sensitivity.
- We are **not** building a citizen-facing ticketing/visitor app in v1 (beyond an incident-report intake).
- No bespoke per-client forks. Everything is configuration, not code.

---

## 4. The flagship workflow (the hero) — "Closed-Loop Collection Care"

This is the feature that makes FMIQ 10x. It must work end-to-end before anything else is polished.

```
1. SENSE      Sensor in Gallery 3 (Conserv/Hanwell/BMS) reports RH rising 6%/hr.
2. EVALUATE   FMIQ checks the zone's active standard (e.g. ASHRAE Class A,
              or Bizot Green Protocol 40–60% RH, ±10%/24h). Rate-of-change breach detected.
3. NAME RISK  FMIQ queries the linked CMS: 14 objects in Gallery 3, incl. 3 flagged
              high-sensitivity (vellum manuscript, polychrome wood). Surfaces them.
4. ROUTE      Two alerts fire: (a) Conservation Officer — object-risk context;
              (b) FM team — auto-created reactive work order with conservation notes + SLA.
5. ACT        Technician (mobile, offline-capable) attends, adjusts/repairs HVAC,
              logs action + photo. Optionally writes a setpoint back to BMS (with authorisation).
6. EVIDENCE   Full event recorded: timestamp, duration, who responded, resolution.
              Auto-appended to the zone's environmental history → loan/funder report ready.
```

Every step is a screen in the prototype. The hero screen is the **Collection-Care Command Centre**: a portfolio map of every site/gallery/case/store, RAG-coloured by live conservation status, with the active excursion and its named at-risk objects front and centre.

---

## 5. Master feature list (modules)

Legend: **★ = differentiator / 10x**, ◆ = table-stakes we must still nail.

### A. Estate & Asset Register (foundation)
◆ Hierarchical estate model: Portfolio → Site → Building → Floor → Room → **Zone / Case / Store**. ◆ Property/land/space register with GIS coords and NIA/GIA. ◆ Asset register with lifecycle, condition grade (A–D), photos/docs. ★ **Heritage designation flags** (protected structure, National Monument, listed fabric elements). ★ **IFC/BIM + COBie self-service import** to populate assets/spaces without an SI project. ★ Fabric-element register (roof lead, masonry, M&E) for heritage maintenance. ◆ QR/NFC asset tags.

### B. CAFM — Reactive Maintenance
◆ Self-service + helpdesk intake (web/mobile). ◆ Auto-SLA by priority. ◆ Work order lifecycle, dispatch, scheduling. ◆ Offline-capable field mobile app, photo capture, asset scan. ★ **Collection-care emergency work orders auto-triggered by environmental excursion**, carrying conservation guidance + named at-risk objects. ◆ Contractor call-out, parts reservation, SLA-breach escalation.

### C. CAFM — Planned Preventive Maintenance
◆ PPM schedule builder (calendar/frequency/seasonal). ◆ Statutory PPM library (fire, electrical, gas, LOLER, PSSR, legionella). ★ SFG20/CIBSE task library. ★ **Environmental-systems PPM** (humidification, dehumidification, AHU) + **sensor calibration tracking**. ★ Heritage-specialist conservation maintenance tasks. ★ Condition-based triggers from IoT thresholds. ★ Predictive failure (ML) — phase 2.

### D. Compliance, Inspections, Surveys, Remedial Works
◆ Compliance register (obligation, due date, owner, RAG). ◆ Mobile inspections with embedded checklists + photo evidence. ◆ Asbestos register, fire risk assessments, statutory records. ★ **Heritage/conservation condition surveys** per fabric element with cost-to-repair + backlog quantification. ★ **Risk-scored defect prioritisation incorporating collections risk**, not just H&S. ★ External surveyor upload portal.

### E. Projects & Programmes (capital governance)
◆ Capital project register, budget vs actual, Gantt, portfolio RAG, risk register, document/O&M management, CDM file. ★ **CWMF / Public Works Contract–aware** workflow (Irish capital governance). ★ Financial drawdown & valuation certification. ★ **Museum closure / operational-impact assessment** per project. ★ **Post-project asset write-back** into the register (the loop nobody closes).

### F. Space & Occupancy
◆ Space register, floor-plan/BIM overlay, cost-centre allocation, utilisation analytics, room/desk booking. ★ **Collection-store allocation to bay/shelf/case/drawer** + environment-zone mapping. ★ Gallery/exhibition area designation. ★ Visitor occupancy sensing (balance footfall vs environment).

### G. Health, Safety, Incidents, Contractors
◆ Incident/near-miss reporting (staff/visitor/contractor), investigation workflow, risk assessments, method statements, Permit-to-Work, contractor pre-qualification + induction. ★ **RIDDOR/HSA statutory reporting**. ★ Contractor live site-presence. ★ Safe-system-of-work for conservation/heritage works.

### H. Collection Care ★★ (the wedge — see §4 and §6)
Multi-parameter environmental dashboard (T, RH, lux, UV, CO₂, pollutants, shock); per-zone/case/store monitoring; **standards-based target templates (PAS 198, BS 4971, ASHRAE AA–D, Bizot Green Protocol)**; per-zone configuration; **rate-of-change + absolute excursion alerting**; TWPI + mould-risk indices; conservation response workflow; environmental history & audit trail per zone; **loan/exhibition compliance reports auto-generated from live data**; IPM/pest module; BMS read + authorised write-back; **CMS object-risk linkage**.

### I. Sustainability & Utilities
◆ Meter data (elec/gas/water/oil), energy benchmarking per m², waste/water. ★ Carbon (Scope 1/2/3), ESG dashboard, net-zero roadmap. ★ **Bizot Green Protocol compliance tracking** — energy vs conservation balance, unique to heritage.

### J. Reporting, Dashboards, Analytics, Mobile
◆ Role-based dashboards, real-time KPIs, scheduled reports, RAG compliance, financial dashboards, CSV/Excel/PDF export, offline mobile. ★ **Collection-environment portfolio dashboard**. ★ No-code report builder. ★ Power BI / OData feeds. ★ Push alerts for excursions & SLA breaches. ★ **WCAG 2.2 AA throughout** (a procurement differentiator most incumbents fail).

### K. Integrations & Platform
◆ Open versioned REST API (OpenAPI 3.1), webhooks, SharePoint/Outlook, HR/ERP. ★ **Azure Entra ID SSO (B2B cross-tenant) out of the box** + SCIM provisioning. ★ **Sensor adapter layer** (Hanwell/Conserv/T&D/HOBO/MQTT). ★ **BMS/BACnet/Modbus ingestion**. ★ **Collections systems** (Axiell/TMS). ★ IFC/COBie. ★ **Build-to-Share / Information Mediator** compatible API (Irish gov interoperability).

---

## 6. Collection-care requirements (detail)

**Parameters:** Temperature (±0.1°C), Relative Humidity (the critical one — fluctuation drives damage), Lux (50–200 display range), UV (<75 µW/lm target), CO₂, pollutants (acetic acid, formaldehyde, NO₂, O₃, VOC), differential pressure (clean stores), shock/vibration, digital pest traps.

**Standards as configurable per-zone templates:**
- **PAS 198:2012** — risk-based environmental management for cultural collections.
- **BS 4971:2017** — archive & library collections.
- **ASHRAE Ch.24** — classes AA (50% RH ±5%, no seasonal) → D (uncontrolled).
- **Bizot Green Protocol 2023** — 16–25°C, 40–60% RH, ≤±10% RH/24h; balances conservation with energy/carbon. The modern loan standard.

A single museum runs multiple standards simultaneously (Class AA for fragile manuscripts; Bizot for general galleries; BS 4971 for archives). The platform must configure per zone and report compliance against each independently.

**Alerting:** per-zone thresholds; **rate-of-change alerts** (RH rising >X%/hr) prioritised over absolute; routing + escalation; maintenance-window suppression; immutable event log.

**Response:** excursion → auto work order with conservation notes; separate conservator alert with object context; escalate affected objects to "at risk" in CMS; auto post-event report for lenders/insurers/funders.

**Loans:** configure zone to lender's spec; live compliance % through loan period; pre-loan 12-month history; post-loan full record; auto-populate facility-report fields from live data.

---

## 7. Success metrics

| Metric | Target |
|---|---|
| Mean time from excursion detected → work order raised | < 60 seconds (automated) |
| Mean time to acknowledge a critical environmental alert | < 15 min |
| Core-module go-live time per site | ≤ 8–12 weeks |
| Loan facility report generation | from days (manual) → minutes (auto) |
| % gallery-hours compliant with active standard | visible, trending, board-reportable |
| WCAG conformance | 2.2 AA, published ACR/VPAT at launch |
| Object-level risk visibility on excursion | 100% of excursions name affected objects |

---

## 8. Release plan (high level — see roadmap.md)

- **MVP / Pilot (Phase 1):** Estate & asset register, reactive + planned maintenance, collection-care monitoring + closed-loop workflow (hero), compliance register, mobile, Entra SSO, EU-resident Postgres, core dashboards, one sensor adapter (Conserv or Hanwell) + one BMS path, Axiell read integration. Accessibility AA.
- **Phase 2:** Projects/CWMF, sustainability + Bizot tracking, IPM, predictive maintenance, no-code report builder, IFC/COBie import, SCIM, additional adapters.
- **Phase 3:** Multi-institution analytics, AI collection-risk prediction, marketplace of standard templates, Power BI/OData, advanced loan management.

## 9. Open questions
1. Product name — keep **FMIQ** or alternative?
2. Pilot sequencing — which single site/workflow do we demo first? (Recommend Collins Barracks gallery + store, closed-loop hero.)
3. Sensor partner-vs-integrate posture with Conserv (partner channel vs pure integration).
4. Commercial model — recommend **estate-scale banding (per site/building) + module bolt-ons**, SaaS annual; see roadmap.
