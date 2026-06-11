# FMIQ Feature Specification & Irish Regulatory Mapping
### The post-handover building-management platform for GovIQ — every feature grounded in Irish law

_Prepared for the GovIQ steering group. Date: 2026-06-06. Status: v1 spec for review. Sources: global CAFM/CMMS market scan (15+ platforms), handover/golden-thread best practice, and 2030 horizon scan — all mapped to Irish statute._

---

## 0. How to read this document
This is the master feature spec for what FMIQ does **after GovIQ has taken a building into operational control** — i.e. once a capital project completes, certificates issue (BCAR / HSE-capital / contract sign-off) and the building must be run. Every capability is paired with the **Irish legal or standards basis** that makes it required or valuable, so the product survives legal, audit, HSA and procurement scrutiny. A consolidated Irish legislation register is at §7.

Design law throughout: **simple enough for a 14-year-old, accessible to Irish public-sector standard (§6).**

---

## 1. The handover gate — capital completion → certification → live operations

This is the headline module and the GovIQ differentiator: the moment of completion becomes the event that *populates operations*, with the Irish certification chain as the gate.

| Step | What FMIQ does | Irish legal / standards basis |
|---|---|---|
| Certificate of Compliance on Completion (CCC) | Capture CCC + BCMS validation reference; block "go-live" until validated | **Building Control (Amendment) Regulations 2014 (S.I. 9/2014)** — Assigned Certifier + Builder; **Building Control Act 1990–2007**; BCMS (bcms.ie) |
| Fire Safety Certificate (FSC) | Store FSC reference, link to building; flag revised FSC on material change | **Fire Services Acts 1981 & 2003**; **Building Regulations TGD B (Fire)** |
| Disability Access Certificate (DAC) | Store DAC; link accessibility features to asset/space records | **Building Control Regulations Part 3**; **Building Regulations TGD M (Access)**; **Disability Act 2005** |
| Ancillary certs (structural, fire, M&E) | Hold each specialist ancillary certification against the relevant system | S.I. 9/2014 Code of Practice for Inspecting and Certifying |
| Safety File | First-class object, linked to every asset; auto-updates when a building modification is logged | **Safety, Health and Welfare at Work (Construction) Regulations 2013 (S.I. 291/2013)** — PSDP prepares, client must keep & update; **SHWW Act 2005** |
| O&M manuals + as-builts + commissioning | Structured import (COBie/IFC), documents attached per asset, energy/environment baselines captured | **BS EN ISO 19650-2** (AIM/PIM); BSRIA BG 30 (handover/O&M); CIBSE/BSRIA BG 11 (commissioning) |
| Public-capital gateway sign-off | Project Close-Out record; client formal acceptance before operational drawdown | **Capital Works Management Framework (CWMF)**; **Infrastructure Guidelines 2023** (successor to the Public Spending Code); OPW estate governance |
| HSE capital / HTM commissioning (where relevant) | Ingest HTM commissioning certs (water HTM 04-01, ventilation HTM 03-01 equivalents) | HSE Capital & Estates governance; relevant Health Technical Memoranda |
| COBie/IFC asset handover | Import wizard: schema validation, field mapping, completeness score, "what's still missing" dashboard | **BS EN ISO 19650**; COBie (BS 1192-4 legacy); Uniclass 2015 classification |

**Why it's revolutionary:** no incumbent turns the Irish certification pack into live operational data. FMIQ makes a building certified on Friday fully managed on Monday — assets, warranties, PPM schedules and the statutory compliance clock all populated from the handover, with each certificate attached as evidence and the BCMS reference on record.

---

## 2. Prioritised feature catalogue (global best, mapped to Irish rules)

Priority key: **P1** = build now (statutory/core), **P2** = next, **P3** = differentiator/horizon.

### 2.1 Hard services / asset maintenance
Best-in-class references: IBM Maximo (RCM/CBM, failure coding), Planon, MRI Evolution, Service Works QFM (1,500+ statutory schedules), eMaint, MaintainX (mobile).

| Feature (priority) | Irish basis |
|---|---|
| **Statutory PPM auto-generation from asset type (P1)** — adding an asset proposes the compliant maintenance schedule with the correct legal frequency | SFG20 task library; frequencies set by Irish/EU law (below) |
| **Reactive work orders + failure coding (P1)** | General duty of care, **SHWW Act 2005**, s.8 (safe place of work) |
| **Fire alarm & emergency lighting maintenance (P1)** | **I.S. 3218** (fire detection & alarm), **I.S. 3217** (emergency lighting); **Fire Services Acts 1981/2003** |
| **Electrical periodic inspection (P1)** | **I.S. 10101 National Rules for Electrical Installations** (ET101 successor); Safe Electric/RECI; **SHWW (General Application) Regs 2007 (S.I. 299/2007)** Part 3 (Electricity) |
| **Lifting equipment thorough examination (P1)** | **S.I. 299/2007 Part 4 (Work Equipment)** — periodic thorough examination of lifts/lifting equipment (Ireland's LOLER equivalent) |
| **Pressure systems examination (P1)** | S.I. 299/2007; EU Pressure Equipment (S.I. 1/2017) |
| **Legionella / water-hygiene monitoring (P1)** | **SHWW (Biological Agents) Regulations 2013 (S.I. 572/2013)**; HPSC *National Guidelines for the Control of Legionellosis in Ireland*; HSA guidance |
| **F-Gas leak checks on refrigeration/HVAC (P1)** | **EU F-Gas Regulation 517/2014 (now 2024/573)**; **S.I. 278/2014** (Irish enforcement, EPA) |
| **Asbestos register & management (P1)** | **SHWW (Exposure to Asbestos) Regulations 2006 & 2010 (S.I. 386/2006, S.I. 589/2010)** |
| **Condition-based / meter-based PPM (P2)** | Best practice; supports energy duties (§2.7) |
| **Spares/MRO inventory (P2)**; **Mobile field app, offline, QR/NFC (P1)** | Operational; lone-working safety under SHWW Act 2005 |

### 2.2 Soft services
Best-in-class: Planon Soft-FM, SWG QFM, ServiceChannel (contractors).

| Feature | Irish basis |
|---|---|
| **Cleaning task scheduling + QR-verified completion (P2)** | Workplace welfare, **S.I. 299/2007 (General Application)** Part 2 |
| **Pest / Integrated Pest Management log (P1 for heritage)** | Collection protection; **National Monuments Acts**; museum conservation duty (NMI) |
| **Catering / food hygiene (P2)** | **FSAI Act 1998**; HACCP; EC food hygiene regs |
| **Waste streams & recycling (P2)** | **Waste Management Acts 1996–2011**; EPA licensing; Circular Economy Act 2022 |
| **Security rounds & incident log (P2)** | **Private Security Services Act 2004** (PSA licensing); GDPR for CCTV |
| **Service-request helpdesk + SLA (P1)** | Contractual; public-service standards |

### 2.3 Scheduling & dispatch
Best-in-class: SWG QFM Work Scheduler (skills/geo), Maximo Scheduler, dynamic dispatch.

| Feature | Irish basis |
|---|---|
| **Statutory-vs-discretionary task classification with locked red tasks (P1)** | SFG20 red = legally required; maps to S.I.s above |
| **Permit-to-Work (hot works, confined space, isolation) (P1)** | **SHWW Act 2005**; **S.I. 299/2007** (Confined Spaces Part 9, Work at Height Part 4) |
| **Skills/competency matching (P2)** | Competent-person duty, SHWW Act 2005 s.2/s.8; Safe Pass/CSCS for contractors |
| **Overdue-statutory escalation (amber 80% / red 95% / breach → named accountability) (P1)** | Demonstrable compliance for HSA inspection & FOI |

### 2.4 Drawings & spatial
Best-in-class: Archibus BIM viewer, SWG QFM BIMi (scan-to-BIM for legacy buildings), GIS.

| Feature | Irish basis |
|---|---|
| **As-built drawing register, versioned, linked to assets/spaces (P1)** | BS EN ISO 19650; Safety File requirement (S.I. 291/2013) |
| **2D floor-plan viewer with asset pins + live sensor overlay (P2)** | Operational; conservation spatial awareness |
| **IFC/3D BIM viewer; scan-to-BIM for historic fabric (P3)** | Suits **protected structures** (Collins Barracks 1702) under **Planning & Development Act 2000 Part IV** |

### 2.5 Certificates & compliance
Best-in-class: SWG QFM statutory library, MRI Evolution cert management, TheWorxHub deficiency-to-WO.

| Feature | Irish basis |
|---|---|
| **Certificate register as first-class entity: type, ref, issuer, expiry, asset link, PDF (P1)** | All statutory certs above; auditability under **FOI Act 2014** |
| **Escalating expiry alerts (90/60/30 days) + auto-renewal work order (P1)** | Prevents lapse of statutory cover; HSA liability mitigation |
| **Estate-wide compliance dashboard (RAG, text+icon) (P1)** | Assurance to board/OPW/HSE; **Disability Act 2005 Part 5** sectoral reporting |
| **Immutable audit trail (who/what/when) (P1)** | **GDPR Art.5(2) accountability**; **Data Protection Act 2018**; FOI Act 2014; National Archives Act 1986 |
| **Remedial / follow-on works from inspection defects (P1)** | Closes the loop; demonstrable corrective action |

### 2.6 O&M manuals & golden thread
Best-in-class: COBie ingestion (Archibus), Zutec golden-thread, RAG O&M assistants.

| Feature | Irish basis |
|---|---|
| **O&M as structured asset data (not PDF bundle), versioned, searchable (P1)** | BS EN ISO 19650 (Asset Information Model) |
| **Warranty tracking with auto-calculated expiry (P1)** | Value-for-money; Infrastructure Guidelines 2023 |
| **Operational golden-thread store: drawings, fire strategy, safety case, maintenance record (P2)** | Irish alignment to **Building Safety** principles; **S.I. 291/2013** Safety File continuity; FOI/Archives |
| **Soft Landings aftercare workflow (Year 1–3 POE) (P3)** | BSRIA/Government Soft Landings; CWMF post-project review |

### 2.7 Sustainability, energy & collection-care (heritage wedge)
| Feature | Irish basis |
|---|---|
| **Energy/utility metering, benchmarking, carbon (Scope 1/2) (P2)** | **Climate Action and Low Carbon Development (Amendment) Act 2021** — public sector 51% emissions cut & 50% energy-efficiency improvement by 2030; **SEAI** monitoring & reporting (S.I. 426/2014); EU EPBD |
| **BER / energy performance (P3)** | **S.I. 666/2006** (Energy Performance of Buildings) |
| **Collection-care environmental monitoring + closed-loop response (P1 — the wedge)** | Conservation duty under **National Cultural Institutions Act 1997**; **National Monuments Acts 1930–2014**; standards PAS 198, BS 4971, Bizot Green Protocol |

---

## 3. The next 5 years — how FMIQ revolutionises this (with Irish guardrails)
1. **AI fault triage + auto-drafted work orders** — 70–85% less admin. *Irish guardrail:* GDPR/DPA 2018 transparency; high-value/collection-adjacent assets keep a human-in-the-loop.
2. **Predictive & prescriptive maintenance** — 35–45% less unplanned downtime; heritage HVAC weighted by conservation risk.
3. **Digital twins with live IoT overlays** — proven at UNESCO heritage sites; ideal for the protected-structure estate; aligns to ISO 19650 AIM.
4. **Autonomous BMS optimisation** — 15–25% energy cut, supports the 2021 Climate Act targets; conservation setpoints (PAS 198/BS 4971) are hard overrides.
5. **Computer-vision inspections (phone/drone)** — remote survey of high/heritage façades. *Irish guardrail:* **IAA** drone authorisation under **EU Reg 2019/947**; Dublin city airspace restrictions.
6. **Natural-language interface** — "what's broken and what do I do?"; bilingual per **Official Languages Act 2003 (amended 2021)**.
7. **Generative-AI O&M assistant (RAG over the manuals)** — reads the manual for the technician; pgvector over the handover document set.
8. **Energy/carbon + grid interaction** — SEAI benchmarking; ESB Networks demand-response.
9. **Predictive compliance** — risk-scores statutory obligations 10–12 weeks ahead; monitors OGP/NSAI for SI changes.
10. **Robotics oversight in soft services** — FMIQ as the integration/oversight layer; collection-proximity exclusion zones enforced.

---

## 4. Radical-simple, accessible UX (Irish public-sector standard)
**The 7am test:** a cold, tired, untrained technician completes the most common task in under 60 seconds, or the design has failed.

Principles (full set in `design-system.md` + `lifecycle-and-simplicity.md`): one screen = one job; role-based front doors; one-tap common actions; pre-filled, zero-typing flows; traffic-light status with **text + icon, never colour alone**; card-based mobile-first; empty states that invite; undo over confirm; plain English (reading age 9–11); consistent help in a fixed place.

### Accessibility — Irish legal mapping
| Requirement | Irish basis |
|---|---|
| **WCAG 2.2 AA / EN 301 549** across the product | **EU Web Accessibility Directive 2016/2102 → S.I. 358 of 2020** (public-sector websites & apps); monitored by the **National Disability Authority (NDA)** |
| New digital products accessible | **European Accessibility Act → European Union (Accessibility Requirements of Products and Services) Regulations 2023 (S.I. 699/2023)** (deadline 28 Jun 2025) |
| Public-body accessibility duty | **Disability Act 2005** (Parts 3 & 5); IS EN 17161 (Design for All) |
| Published **Accessibility Statement** | S.I. 358/2020 requirement |
| **Bilingual (English/Irish)** UI where public-facing | **Official Languages Act 2003 (amended 2021)**; `lang="ga"` for screen-reader pronunciation |
| Contrast 4.5:1, focus visible, target ≥24px, ARIA live regions for alerts, reduced-motion, 200% resize/reflow | EN 301 549 / WCAG 2.2 AA specifics |

---

## 5. Data, security & procurement (Irish)
- **Data residency & protection:** EU/Ireland hosting (Azure North Europe, EU Data Boundary); **GDPR + Data Protection Act 2018**; DPC oversight; data minimisation (store CMS object reference + sensitivity only).
- **Audit & records:** immutable audit log; **FOI Act 2014**; **National Archives Act 1986**.
- **Cyber:** **NIS2 Directive (EU 2022/2555)** transposition; OGCIO Cloud guidance; ISO 27001 roadmap.
- **Procurement route to market:** **OGP / eTenders**; EU procurement rules (**S.I. 284/2016**); **CWMF** alignment; Build-to-Share / Information Mediator-compatible API as a public-sector interoperability differentiator.
- **Identity:** Azure Entra ID SSO (whole-of-government Microsoft estate).

---

## 6. Build priority (Now / Next / Later)
- **NOW (P1):** Handover Gate (CCC/FSC/DAC/Safety File/COBie) → asset register + PPM + compliance clock; statutory cert register with escalation; collection-care closed loop; mobile offline app; WCAG 2.2 AA baseline + Accessibility Statement.
- **NEXT (P2):** Soft services + IPM; drawings/floor-plan viewer with live overlay; energy/carbon (Climate Act 2021); contractor portal with Safe-Pass/insurance gating; dynamic scheduling.
- **LATER (P3):** AI triage + predictive maintenance; digital twin; CV inspections (IAA-compliant); RAG O&M assistant; robotics oversight; Soft Landings aftercare.

---

## 7. Irish legislation & standards register
| Instrument | Governs in FMIQ |
|---|---|
| Building Control Act 1990–2007 + **Building Control (Amendment) Regs 2014 (S.I. 9/2014)** | BCAR, Assigned Certifier, CCC, BCMS — the handover gate |
| Building Regulations 1997–2022 + TGDs (B Fire, M Access, L Energy, F Ventilation) | Design compliance referenced by certs |
| Fire Services Acts 1981 & 2003; I.S. 3218; I.S. 3217 | Fire safety cert, alarm & emergency-lighting maintenance |
| Disability Act 2005; Building Control Regs Part 3 | DAC, accessibility duties, Part 5 reporting |
| Safety, Health and Welfare at Work Act 2005 | Overarching duty of care, PTW, competent persons |
| **SHWW (Construction) Regs 2013 (S.I. 291/2013)** | PSDP/PSCS, Safety File (kept & updated) |
| **SHWW (General Application) Regs 2007 (S.I. 299/2007)** | Work equipment/lifts thorough exam, electricity, work at height, confined spaces |
| SHWW (Exposure to Asbestos) Regs 2006/2010 | Asbestos register |
| SHWW (Biological Agents) Regs 2013 (S.I. 572/2013) + HPSC Legionella guidelines | Legionella/water hygiene |
| I.S. 10101 National Rules for Electrical Installations | Electrical inspection |
| EU F-Gas Reg 517/2014 / 2024/573 + S.I. 278/2014 | Refrigerant leak checks |
| Private Security Services Act 2004 | Security services (PSA) |
| Waste Management Acts 1996–2011; Circular Economy Act 2022 | Waste streams |
| FSAI Act 1998 | Catering hygiene |
| Planning & Development Act 2000 Part IV | Protected structures / ACAs (heritage fabric) |
| National Monuments Acts 1930–2014; National Cultural Institutions Act 1997 | Heritage & collection-care duty (NMI) |
| Climate Action & Low Carbon Development (Amendment) Act 2021; SEAI (S.I. 426/2014); S.I. 666/2006 (EPB/BER) | Energy, carbon, public-sector 2030 targets |
| GDPR + Data Protection Act 2018; FOI Act 2014; National Archives Act 1986 | Data, audit, records |
| NIS2 (EU 2022/2555) | Cyber security posture |
| EU Web Accessibility Directive 2016/2102 → **S.I. 358/2020**; EAA → **S.I. 699/2023**; EN 301 549; NDA | Accessibility (WCAG 2.2 AA) |
| Official Languages Act 2003 (amended 2021) | Bilingual UI |
| OGP/eTenders; EU procurement S.I. 284/2016; CWMF; Infrastructure Guidelines 2023 | Procurement & capital governance |
| BS EN ISO 19650; BSRIA BG 30 / BG 11; COBie; Uniclass 2015; SFG20 | Information management, handover, maintenance specification |

_Note: legislation changes — citations reflect the position known as of the knowledge cut-off and should be confirmed against the current consolidated text on irishstatutebook.ie / HSA / NSAI before any tender submission._
