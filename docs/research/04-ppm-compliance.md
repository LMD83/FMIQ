# PPM + Statutory Compliance — Research Brief (FMIQ)

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

Scope: Planned preventive maintenance (PPM) and statutory compliance for FMIQ, GovIQ's IWMS for Irish public-sector and heritage estates. Anchor use case: the National Museum of Ireland (NMI) estate — protected historic structures, collection stores with critical environmental plant, and active visitor operations. This brief defines the task-library model, the canonical Irish statutory compliance register, PPM scheduling UX, competitor handling, heritage deltas, and a recommended FMIQ model with a ranked first-to-ship list.

---

## 1. SFG20 — the maintenance-task standard

### What it is
SFG20 is the de facto UK/Ireland standard for building-maintenance task specification, created in 1990 and maintained by the Building Engineering Services Association (BESA). The library holds 1,200+ maintenance schedules across 70+ equipment types, updated monthly to track legislation and best practice. Each schedule decomposes a task into step-by-step actions with **frequency, skill level, timing, and safety notes**.

### Criticality colour-coding (the load-bearing concept for FMIQ)
SFG20 classifies every task by criticality, and this is the model FMIQ should adopt:
- **Red — Statutory / Legal** (required by law)
- **Pink — Mandatory / Business Critical**
- **Amber — Optimal**
- **Green — Discretionary**

This Red→Green axis is exactly the spine a compliance dashboard needs: the statutory subset is non-negotiable and must drive RAG status, escalation, and audit packs.

### Licensing model
- Access is **subscription per licence holder**; the only current route to the live standard is **Facilities-iQ**, SFG20's own platform, because schedules change monthly.
- An **API (Digital Partner Programme)** lets CAFM/CMMS/IWMS pull schedules. The API itself is described as "freely available" and integration is "no extra cost **for existing SFG20 licence holders**" — i.e. the *customer* must hold an SFG20 licence; the *vendor* joins the partner programme. The content is not free.
- Named integration partners: Planon, Service Works Global (Archibus), Tabs FM, AssetWorks, Micad, ConnectFSM, Naviam, Quantarc, IFS Ultimo, MRI/FSI Concept Evolution.

### Commercial-risk signal (important for a startup)
SFG20 and BCIS now sit under the **same private-equity-backed parent (Facilities-iQ)**. Independent analysis (SFG20's own State of FM 2026) reports **declining compliance confidence year-on-year, 85% of the sector with poor asset-register accuracy, and integration barriers that have more than doubled** — a content standard whose commercial owner is now accountable to PE returns rather than industry membership. Building FMIQ's compliance engine to *depend* on SFG20 means tying pricing and roadmap to a third party with rising costs and consolidating market power.

### Irish equivalents / adaptations
There is **no Irish national equivalent to SFG20**. Irish practice = SFG20 task content + Irish statutory frequencies layered on top (the statutory layer is what actually differs by jurisdiction — see §2). Heritage adds OPW / Heritage Council *Advice Series* guidance (cyclical, gentle maintenance for traditional buildings) which SFG20 does not cover.

### Alternatives if SFG20 licensing is prohibitive
1. **Build an FMIQ-native task library** keyed to Irish statute — the statutory subset (the high-value Red items) is small, public, and stable; FMIQ can author and own these without licensing.
2. **Make SFG20 an optional connector** (customer brings their own licence via the API) rather than a hard dependency — FMIQ ships value without it, premium customers plug it in.
3. **Heritage/public-sector niche content** (collection-care plant, conservation cyclical maintenance) is a genuine gap SFG20 underserves — original differentiation, not a knock-off.

---

## 2. Canonical Irish statutory compliance register (heritage public building)

This is the spine. Format: **item — frequency — competent person — evidence artefact — legal basis**. Frequencies are the Irish statutory positions; verify each against the current standard text before locking into the schema.

| # | Statutory item | Frequency | Competent person | Evidence artefact | Legal basis |
|---|---|---|---|---|---|
| 1 | **Fire detection & alarm — service/inspection** | Quarterly (whole system annually, in 25% blocks each quarter) | Competent fire-alarm service contractor | Certificate of Testing & Servicing (I.S. 3218 model cert) | I.S. 3218; Fire Services Act 1981/2003 s.18 |
| 2 | **Fire alarm — user weekly test** | Weekly (rotate one zone; ≤13 wks between zones) | In-house responsible person | Fire Safety Register entry | I.S. 3218 / Fire Safety Register |
| 3 | **Emergency lighting — periodic service** | At least every 4 months (≥3×/yr; quarterly in year 1) + annual full-duration | Competent EL contractor | Periodic inspection report / cert (I.S. 3217) | I.S. 3217 |
| 4 | **Emergency lighting — monthly function test** | Monthly | In-house responsible person | Fire Safety Register entry | I.S. 3217 |
| 5 | **Fire extinguishers / suppression** | Annual service (+ extended/discharge per type) | Competent extinguisher contractor (I.S. 291) | Service certificate / labels | I.S. 291; Fire Services Act s.18 |
| 6 | **Legionella / water-system control** | Risk assessment (review ~2-yrly or on change); monthly temp monitoring; TMV + outlet checks per scheme | Competent water-treatment / responsible person | Legionella risk assessment + monitoring logs | HPSC National Guidelines 2009; HSE 2015 (healthcare); SHWWA 2005 |
| 7 | **Lifts / hoists — thorough examination** | **Every 6 months** (passenger lifts / lift people) | Competent person (insurer/engineer-surveyor) | Report of Thorough Examination (GA1) | SI 299/2007 Sch.1, Part B |
| 8 | **Lifting accessories / tackle** | Every 6 months | Competent person | Report of Thorough Examination (GA1) | SI 299/2007 Sch.1 |
| 9 | **Cranes / other lifting machines** | Every 12 months (6-mo if lifting people) | Competent person | Report of Thorough Examination | SI 299/2007 Sch.1 |
| 10 | **Pressure systems (boilers, air receivers, calorifiers)** | Per Written Scheme of Examination (typ. boilers ~14 mo, air receivers ~26 mo) | Competent person (engineer-surveyor) | Written Scheme + Report of Examination (Sch.12 Part D) | SI 299/2007 Part 10 & Sch.12 |
| 11 | **Gas appliances / boilers — service** | Annual | Registered Gas Installer (RGI) | RGI Declaration of Conformance / service cert | Energy (Misc. Provisions) Act 2006 |
| 12 | **Fixed electrical installation — periodic inspection (PIR)** | Every 3 yrs (public assembly: theatres/cinemas/leisure); 5 yrs commercial | Registered Electrical Contractor (Safe Electric / CRU) | Periodic Inspection Report (I.S. 10101) | I.S. 10101; SHWWA 2005 |
| 13 | **Asbestos register / management survey** | Maintain & review register; survey before any maintenance/refurб work on pre-2000 fabric | Competent asbestos surveyor (P402-equiv.) | Asbestos register + management/refurb survey report | SHWW (Exposure to Asbestos) Regs 2006–2025 |
| 14 | **Collection-store environmental plant (AHU/HVAC, dehumid., chillers)** | Manufacturer + seasonal (filters pre-summer, humidifier pre-winter, full AHU pre-exhibition) | Competent HVAC contractor | Service report + environmental monitoring trend | PAS 198:2012; conservation duty of care |
| 15 | **Lightning protection** | Annual (where fitted; common on historic structures) | Competent LP contractor | Test certificate | I.S. EN 62305 |
| 16 | **Fire Safety Register upkeep** | Continuous (daily/weekly/monthly/annual entries) | Person having control of premises | The Register itself (the master evidence record) | Fire Services Act 1981/2003 s.18 |

Cross-cutting duties: **Fire Services Act s.18(2)** places a non-delegable duty on the *person having control of the premises* (owner/occupier) to maintain fire safety measures and keep the Fire Safety Register — the canonical Irish "duty-holder" anchor for FMIQ's accountability model. **BCAR** is largely *out of scope for routine maintenance* (routine maintenance/minor repair does not trigger a Commencement Notice), but **becomes relevant** when maintenance escalates to material alteration, change of use, or works to a protected structure — FMIQ should flag the BCAR threshold, not assume exemption.

---

## 3. PPM scheduling UX

Patterns confirmed across CAFM tooling:
- **52-week forward planner** — the dominant artefact: a colour-coded grid (assets/asset-groups × 52 weeks) showing weekly/fortnightly/monthly/quarterly/half-yearly/annual tasks. At-a-glance "due / overdue / completed", drill-down by building→asset→task.
- **Calendar vs forward-schedule** — calendar view for the technician's week; forward-schedule (52-wk) for the FM's plan and workload balancing. FMIQ needs both, sharing one schedule engine.
- **Workload balancing** — surface labour-hours per week to smooth peaks; let the FM nudge non-statutory tasks. **Statutory tasks must be lock-protected from being moved past their legal due date.**
- **Compliance dashboard (RAG by statutory item)** — the single highest-value screen: each statutory item as a tile, RAG-coloured by next-due vs overdue, drill into the cert. Maps directly onto the SFG20 Red criticality subset.
- **Evidence capture** — completed task → cert/photo attached → task cannot close "compliant" without the required evidence artefact (gate the close, don't just allow upload).
- **Audit-readiness packs** — one-click export of a date-ranged evidence bundle for a fire officer / HIQA / insurer / conservation officer inspection: register + certs + RAG snapshot. This is the killer feature for public-sector buyers who live in inspection cycles.

---

## 4. How competitors handle compliance — and what users criticise

- **Planon (IWMS):** SFG20 schedules integrated via API with automatic updates. User criticism: **implementation complexity, high price, heavy consultant dependency, expensive new-feature development, unproven mobile/offline**. Compliance "works" but only after costly configuration.
- **MRI / FSI Concept Evolution:** mature SFG20 task-library import, asset→SFG20 code mapping, audit-ready records. Praised as flexible/intuitive; criticised because **un-planned implementations become "a nightmare to revise" and the system needs a dedicated administrator as it grows** — i.e. powerful but high-overhead.
- **Sector-wide (SFG20 State of FM 2026):** compliance confidence falling, asset-register accuracy poor in 85% of estates, integration barriers doubled. The pattern: the content exists, but **getting an accurate asset register and a usable compliance view is where everyone fails.**

FMIQ's opening: **out-of-the-box Irish statutory register + accurate-asset-register onboarding + a simple RAG compliance view**, without consultant-grade configuration. Beat them on time-to-compliance-visibility, not feature count.

---

## 5. Heritage deltas

- **Protected structures → gentler regimes.** Maintenance on historic fabric follows OPW / Heritage Council *Advice Series* (launched 2007, 15 topics: roofs/chimneys, lime mortar, ironwork, windows, etc.) and SPAB-style cyclical "little-and-often" maintenance, not industrial replace-on-failure. FMIQ tasks against protected fabric should carry a **conservation method statement** and a *competent conservation contractor* requirement, and should default to inspection/repair over replacement.
- **BCAR flag, not block.** Works to a protected structure can require **Section 57 declarations / planning consent** — FMIQ must flag when a maintenance job crosses from "repair" into "alteration" of protected fabric.
- **Collection-store plant criticality.** PAS 198:2012 sets risk-based environmental targets (typ. ~18–22°C, ~45–55% RH, stable). A **single 15% RH spike over 48h causes irreversible damage** (panel-painting warp, bronze disease, paper acidity). Therefore **HVAC failure in a collection store = collection-loss event**, not a comfort issue. FMIQ must rank collection-store plant as **highest-criticality**, generate seasonal PPM automatically (filters pre-summer, humidifier service pre-winter, full AHU pre-exhibition), and **link plant PPM to environmental-monitoring trends** so a maintenance miss and an RH excursion show on the same screen. This is FMIQ's clearest defensible differentiator over generic CAFM.

---

## 6. Recommended FMIQ PPM model

**Task library structure (FMIQ-native, SFG20-optional).**
- `ppm_taskTemplates` — code, title, discipline, asset-type, criticality (`statutory|mandatory|optimal|discretionary`), default frequency, skill level, competent-person type, **required evidence artefact**, conservation flag, statutory-item link, steps[].
- Seed the **statutory subset first** (the §2 register) as FMIQ-owned content; expose SFG20 as a connector for licence-holding customers.

**Schedule generation.**
- Pure-function generator: `(assets × applicable templates × frequency) → forward schedule`. Statutory due-dates are **hard-locked** (cannot be moved past legal deadline); non-statutory tasks are balanceable. Emits both calendar and 52-week views from one model.

**Compliance register schema.**
- `comp_statutoryItems` (canonical register, the §2 rows) → `comp_obligations` (item × asset/building, frequency, competent-person, next-due, status RAG) → `comp_evidence` (cert/report/photo, issued date, expiry, storage ref). RAG computed from next-due vs now + evidence presence/expiry.

**Dashboard.**
- Estate RAG tile per statutory item, drill building→asset→obligation→evidence. Overdue = red and escalates. "Inspection pack" export (date-ranged evidence bundle) as a first-class action.

**Evidence chain.**
- Task close is **gated** on the required evidence artefact (no cert → cannot mark compliant). Every state change audit-stamped (reuse GovIQ's audit-chain pattern). Final certs are documents of record → store in the system-of-record (SharePoint pattern), not just app storage.

**Ranked first-10 compliance items to ship** (highest legal exposure + inspection frequency + heritage relevance):
1. Fire detection & alarm (I.S. 3218) — quarterly cert
2. Emergency lighting (I.S. 3217) — periodic + monthly
3. Fire Safety Register (Fire Services Act s.18) — the master record
4. Legionella / water control (HPSC) — monthly temps + RA
5. Lift thorough examination (SI 299/2007, GA1) — 6-monthly
6. Fixed electrical PIR (I.S. 10101) — 3-yr public assembly
7. Collection-store HVAC / environmental plant (PAS 198) — seasonal, collection-critical
8. Gas boiler service (RGI) — annual
9. Fire extinguishers / suppression (I.S. 291) — annual
10. Asbestos register / survey (Asbestos Regs 2006–2025) — pre-works trigger

---

## Sources

- [SFG20 — What Is SFG20](https://www.sfg20.co.uk/what-is-sfg20)
- [SFG20 — Software Integration / Digital Partner Programme](https://www.sfg20.co.uk/products/software-integration)
- [SFG20 — Preventative Maintenance Software](https://www.sfg20.co.uk/products/preventative-maintenance-software)
- [Tabs FM — Why Integrate SFG20 Into Your CAFM/CMMS](https://www.tabsfm.com/media/blogs/Why-Integrate-The-SFG20-Standard-Into-Your-CAFM-or-CMMS/)
- [Facilio — SFG20 Standards integration](https://facilio.com/blog/sfg20-standards/)
- [Baachurain — Who Owns SFG20? BESA, Facilities-iQ and Hard FM commercial risk](https://baachurain.com/who-owns-sfg20-facilities-iq-besa/)
- [Baachurain — SFG20 State of FM Report 2026 analysis](https://baachurain.com/sfg20-state-of-fm-report-2026-analysis/)
- [NSAI — I.S. 3218:2024 Fire Detection & Alarm Systems](https://shop.standards.ie/en-ie/standards/i-s-3218-2024-871876_saig_nsai_nsai_3458175/)
- [gov.ie — Model Certificate of Testing of a Fire Detection and Alarm System](https://assets.gov.ie/243934/1c06e4b1-98fc-4dab-953c-60b140d2ef0c.doc)
- [Brosnans — Emergency Lighting Regulations Ireland (I.S. 3217)](https://brosnans.ie/how-to-ensure-your-emergency-lighting-meets-irish-regulations/)
- [Hall Alarms — Emergency Lighting Standard I.S. 3217](https://www.hallalarms.ie/products-services/emergency-lighting-systems/)
- [gov.ie — Fire Safety Guide for Building Owners and Operators](https://www.gov.ie/en/department-of-housing-local-government-and-heritage/publications/fire-safety-guide-for-building-owners-and-operators/)
- [Irish Statute Book — Fire Services Act 1981, Section 18](https://www.irishstatutebook.ie/eli/1981/act/30/section/18/enacted/en/html)
- [Dublin City Council — Active Fire Protection](https://www.dublincity.ie/dublin-fire-brigade/find-out-about-fire-safety-businesses/fire-safety-advice-and-responsibilities/active-fire-protection)
- [HPSC — National Guidelines for the Control of Legionellosis in Ireland 2009](https://www.hpsc.ie/a-z/microbiologyantimicrobialresistance/infectioncontrolandhai/guidelines/National%20Guidelines%20for%20the%20control%20of%20legionellosis%20in%20Ireland%202009.pdf)
- [HPSC/HSE 2015 — Prevention and Control of Infection from Water Systems in Healthcare Facilities](https://www.hpsc.ie/a-z/respiratory/legionellosis/guidance/HSE%202015%20Guidelines%20Prevention%20Control%20Infection%20from%20Water%20Systems%20in%20Healthcare%20Facilities.pdf)
- [Irish Statute Book — SI 299/2007 General Application Regulations](https://www.irishstatutebook.ie/eli/2007/si/299/made/en/print)
- [HSA — Use of Work Equipment (Ch.2, lifting examination frequencies)](https://www.hsa.ie/eng/publications_and_forms/publications/general_application_regulations/gen_apps_work_equipment.pdf)
- [HSB/Munich Re — Ireland lifting equipment inspection](https://www.munichre.com/hsbeil/en/services/engineering-inspection-services/ireland/lifting-equipment-inspection.html)
- [Clive Kelly — GA1 Lifting Equipment Inspections](https://clivekelly.ie/ga1-lifting-equipment-inspections/)
- [HSA — Guide to Pressure Systems (Part 10 / Schedule 12)](https://www.hsa.ie/eng/publications_and_forms/publications/general_application_regulations/general_application_amendment_regulations_pressure_systems.pdf)
- [HSB/Munich Re — Ireland boiler/pressure system inspection](https://www.munichre.com/hsbeil/en/services/engineering-inspection-services/ireland/boiler-pressure-systems-inspection.html)
- [RGI — Declaration of Conformance / Completion Certificates](https://rgi.ie/safety/declaration-of-conformance-certificates-completion-certificates/)
- [Gas Networks Ireland — Registered Gas Installer for business](https://www.gasnetworks.ie/business/safety-in-the-business/rgi-for-business)
- [NSAI — National Rules for Electrical Installations I.S. 10101:2020 FAQ](https://www.nsai.ie/standards/sectors/electrotechnical-standards/national-wiring-rules-faqs/)
- [HSA — Guidance Note on Periodic Inspection and Testing of Electrical Installations](https://www.hsa.ie/eng/publications_and_forms/publications/information_sheets/guidance-note_on_periodic_inspection_and_testing_of_electrical_installations/)
- [Safe Electric — Periodic Inspection Reports](https://safeelectric.ie/help-advice/periodic-inspection-reports/)
- [Irish Statute Book — SI 386/2006 Exposure to Asbestos Regulations](https://www.irishstatutebook.ie/eli/2006/si/386/made/en/print)
- [OHSS — Major Changes to Ireland's Asbestos Regulations 2025](https://www.ohss.ie/blog/major-changes-to-ireland-s-asbestos-regulations-in-2025-what-every-duty-holder-needs-to-know)
- [Irish Statute Book — SI 229/2021 Building Control (Amendment) Regulations](https://www.irishstatutebook.ie/eli/2021/si/229/made/en/print)
- [SCSI — Guide to the Application of Building Control and BCAR](https://scsi.ie/wp-content/uploads/2023/07/BCAR-IP-FINAL-1.pdf)
- [Tabs FM — Streamlining PPM with CAFM/CMMS Software](http://www.tabsfm.com/media/blogs/Streamlining-Planned-Preventative-Maintenance-Management-PPM-with-CAFM-CMMS-Software/)
- [Expansive FM — Planned Preventative Maintenance platform](https://www.expansivefm.com/cafm-platform-tour/planned-preventative-maintenance)
- [Software Advice — Planon reviews, pros and cons](https://www.softwareadvice.com/cafm/planon-universe-profile/reviews/)
- [Facilio — Planon IWMS review](https://facilio.com/blog/planon-review/)
- [SFG20 — PlanOn integration](https://www.sfg20.co.uk/products/software-integration/planon)
- [MRI Software — Concept Evolution + SFG20](https://www.fsifm.com/en-ae/concept-evolution/sfg20)
- [ITQlick — Concept Evolution review, pros and cons](https://www.itqlick.com/concept-evolution)
- [The Heritage Council — How Historic Buildings Can be Repaired and Maintained](https://www.heritagecouncil.ie/news/news-features/how-historic-buildings-can-be-repaired-and-maintained)
- [Buildings of Ireland — Guidance / Advice Series](https://www.buildingsofireland.ie/guidance/)
- [BSI — PAS 198:2012 Managing Environmental Conditions for Cultural Collections](https://knowledge.bsigroup.com/products/specification-for-managing-environmental-conditions-for-cultural-collections)
- [AMNH — Impact of Temperature and Relative Humidity on Collections](https://www.amnh.org/research/science-conservation/preventive-conservation/agents-of-deterioration/temperature-and-relative-humidity-rh)
- [Oxmaint — Museum & Archive HVAC Monitoring for Collection Preservation](https://oxmaint.com/industries/hvac/museum-archive-hvac-monitoring-art-collection-preservation)

---

End — v0.1
