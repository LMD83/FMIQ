# 18 · Regulatory Module Specifications

**Use:** Defines each regulatory module: trigger conditions, document set, activation rules, and which agents read against the module.

The Regulatory Trigger Agent (file 02) consults this file to decide which modules activate for a given project. Modules drive which agents run, which corpora are loaded, and which sections appear in the Build Readiness Report.

---

## Module activation logic

A module activates when EITHER:

1. The intake form explicitly flags it (e.g., "Conservation relevance: yes"), OR
2. Document classification identifies a triggering document (e.g., FSC application uploaded), OR
3. A discipline agent escalates a trigger during review (e.g., Architect Agent identifies a Protected Structure).

Once activated, the module persists for the project's lifetime — it does not deactivate even if later evidence suggests it wasn't needed (the human reviewer makes that call).

---

## The 9 modules

### MOD-01 · Building Regulations

**Always active for Irish projects.**

Triggers: every intake.

Corpora loaded:

- Building Regulations 1997 (S.I. No. 497/1997) as amended
- TGD A–M (current revisions)
- Relevant I.S. and I.S. EN standards

Agents involved: Architect, Fire, DAC, Mechanical, Electrical, Structural, Civil.

Build Readiness Report sections fed: Discipline Action Matrix, Interface Risk Matrix.

---

### MOD-02 · Fire Safety Certificate

Triggers:

- Building type other than single dwelling (other than statutory exemptions).
- Material alteration, extension or change of use of existing.
- Intake states "FSC required" or "FSC applied for".
- Architect Agent identifies likely FSC requirement.
- Fire Agent identifies FSC drawings or application document.

Statutory anchor: Building Control Act 1990 § 11; Building Regulations Part B; Building Control Regulations Part III.

Corpora loaded:

- TGD B Vol 1 + Vol 2 (current)
- BS 9991 (residential — referenced)
- BS 9999 (fire safety in non-residential — referenced where alternative compliance route used)
- I.S. 3218:2024 (fire detection + alarm)

Agents involved: Fire Safety, Architect (compartmentation interface), Mechanical (ventilation / smoke), Electrical (alarm + emergency lighting), DAC (assisted evacuation), Lift (evacuation lift).

Build Readiness Report sections fed: Statutory Approval Risks, Critical Blockers (if FSC missing).

Decision lock: if FSC is required but not granted and pre-tender, executive decision cannot be Proceed.

---

### MOD-03 · Disability Access Certificate (DAC) / Part M

Triggers:

- Building type other than single dwelling (subject to statutory exemptions).
- Material alteration, extension or change of use of existing.
- Intake states "DAC required" or "DAC applied for".
- Architect Agent identifies likely DAC requirement.

Statutory anchor: Building Control Act 1990 § 21; Building Regulations Part M; Building Control Regulations Part IIIA.

Corpora loaded:

- TGD M (current)
- BS 8300-2 (where referenced)
- NDA Building for Everyone Universal Design guidance

Agents involved: DAC / Accessibility, Architect (dimensional coordination), Civil (external levels), Lift, Mechanical (controls reach), Electrical (controls + alarms), Fire (assisted evacuation interface), Conservation (where in conflict with conservation).

Build Readiness Report sections fed: Statutory Approval Risks.

Decision lock: if DAC required but not granted by occupation, executive decision is Pause Before Build for the occupation stage (Proceed with Conditions during construction OK).

---

### MOD-04 · BCAR (Building Control Amendment Regulations)

Triggers:

- Project type other than excluded works (single dwelling excluded since 2015 amendments where SI 365/2015 opt-out applied).
- Intake states "BCAR applicable: yes".
- Document classification identifies Commencement Notice or Design Certificate.

Statutory anchor: Building Control (Amendment) Regulations 2014 (S.I. No. 9/2014); Code of Practice for Inspecting and Certifying Buildings and Works.

Corpora loaded:

- SI 9/2014 + amendments
- Code of Practice
- BCMS guidance

Agents involved: Assigned Certifier / BCAR, Design Certifier, Architect (Architect of Record), Structural (Engineer of Record), Fire (Fire Safety designer), DAC (Access designer), Builder, all Ancillary Certifiers.

Build Readiness Report sections fed: Statutory Approval Risks, Construction Hold Points, Handover Evidence Requirements.

Decision lock: if BCAR documentation set is incomplete at Commencement Notice, executive decision is Pause Before Build.

---

### MOD-05 · Planning Conditions

Triggers:

- Planning permission grant exists.
- Architect Agent identifies planning drawings + conditions list.
- Intake states "Planning status: granted".

Statutory anchor: Planning and Development Act 2000 + Regulations.

Corpora loaded:

- Planning grant + conditions schedule (project-specific)
- Development Plan + Local Area Plans (project-specific)
- Section 28 Ministerial Guidelines

Agents involved: Planning Law (lead), Architect, Civil (drainage / SuDS conditions), Landscape (landscape conditions), Conservation (heritage conditions).

Build Readiness Report sections fed: Planning Condition Risks, Critical Blockers (where pre-commencement conditions unclosed).

Decision lock: if pre-commencement planning conditions are not closed, executive decision is Pause Before Build.

---

### MOD-06 · HIQA (Designated Centres)

Triggers:

- Intake states project type involves HIQA-registered service (designated centre under Health Act 2007 § 38 — older persons services, disability services, certain children's residential services).
- Architect Agent identifies sector-specific accommodation (e.g., resident bedrooms, communal living, treatment rooms typical of designated centre).
- Intake states "HIQA relevance: yes".

Statutory anchor: Health Act 2007 § 38 + regulations (Care and Welfare of Residents in Designated Centres for Older People Regulations 2013; equivalent disability services; equivalent children's residential).

Corpora loaded:

- HIQA National Standards (sector-specific)
- HSE PCM where Section 38/39 capital
- Relevant HBN / HTM (referenced)

Agents involved: Sector Regulator (lead, HIQA sub-module), Architect, Fire (vulnerable user evacuation), DAC, Mechanical (sanitary / scald / legionella), Electrical (nurse call where applicable), Conservation (where historic).

Build Readiness Report sections fed: Statutory Approval Risks, Critical Blockers (where HIQA registration suitability at risk).

Decision lock: if HIQA suitability is not demonstrated for a registered service, executive decision cannot be Proceed.

---

### MOD-07 · Mental Health Commission (Approved Centres)

Triggers:

- Intake states project type involves Mental Health Act 2001 approved centre.
- Architect Agent identifies inpatient mental health accommodation.

Statutory anchor: Mental Health Act 2001 §§ 62–66; Mental Health (Approved Centres) Regulations 2017.

Corpora loaded:

- MH Act 2001
- Approved Centres Regulations 2017
- MHC inspection findings (publicly available)

Agents involved: Sector Regulator (MHC sub-module), Architect, Fire, DAC, PSDP (assisted ligature risk / safe environment design), Electrical (door access, anti-ligature considerations).

Build Readiness Report sections fed: Statutory Approval Risks.

Decision lock: registration / suitability gap is Critical.

---

### MOD-08 · Tusla (Early Years + Children's Services)

Triggers:

- Intake states project type involves early years service, school-age childcare, residential care for children, or Tusla-inspected service.
- Architect Agent identifies child-specific accommodation.

Statutory anchor: Child Care Act 1991 (Early Years Services) Regulations 2016 + amendments; Child Care (Standards in Children's Residential Centres) Regulations.

Corpora loaded:

- Child Care Act 1991 regulations
- Tusla Quality and Regulatory Framework (QRF)
- Tusla inspection findings

Agents involved: Sector Regulator (Tusla sub-module), Architect, Fire (vulnerable users — children), DAC, PSDP (safeguarding design), Mechanical (sanitary for child users).

Build Readiness Report sections fed: Statutory Approval Risks.

---

### MOD-09 · Construction Health & Safety (PSDP / Construction Regs)

**Always active for Irish construction projects.**

Triggers: every project (statutory).

Statutory anchor: Safety, Health and Welfare at Work Act 2005; Safety, Health and Welfare at Work (Construction) Regulations 2013; Council Directive 92/57/EEC.

Corpora loaded:

- 2005 Act + 2013 Regulations
- HSA guidance
- ConstructionForum guidance documents

Agents involved: PSDP (lead), Contractor, Construction Law (notification thresholds).

Build Readiness Report sections fed: Construction Hold Points, Handover Evidence Requirements.

Notification trigger: HSA AF-1 notification if (project > 500 person days) OR (> 30 working days with > 20 persons on site at any one time). Module flags this for the Employer's Representative.

---

## Module-to-section mapping in the Build Readiness Report

| Module | Critical Blockers | High-Risk | Statutory Approval | Planning | Tender/Cost | Hold Points | Handover |
|---|---|---|---|---|---|---|---|
| MOD-01 Building Regs | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| MOD-02 FSC | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| MOD-03 DAC / Part M | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| MOD-04 BCAR | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| MOD-05 Planning | ✓ | ✓ | ✓ | ✓ | | | |
| MOD-06 HIQA | ✓ | ✓ | ✓ | | | | ✓ |
| MOD-07 MHC | ✓ | ✓ | ✓ | | | | ✓ |
| MOD-08 Tusla | ✓ | ✓ | ✓ | | | | ✓ |
| MOD-09 Construction H&S | ✓ | ✓ | ✓ | | | ✓ | ✓ |

---

## Module activation worked example

**Project:** New office fit-out, Dublin.

**Intake answers:**
- Building type: Healthcare / day service (non-residential)
- Project stage: Pre-tender
- HIQA relevance: No (commercial office — standard TGD / BCAR / NZEB corpus applies)
- BCAR applicable: Yes
- Planning status: Granted, 8 conditions
- FSC status: Applied for
- DAC status: Applied for
- Conservation: No
- Mental Health Commission: No
- Tusla: No

**Modules activated:**

- ✅ MOD-01 Building Regulations (default)
- ✅ MOD-02 FSC (applied)
- ✅ MOD-03 DAC (applied)
- ✅ MOD-04 BCAR (applicable)
- ✅ MOD-05 Planning (granted with conditions)
- ⚠️ MOD-06 HIQA (sector standards informative, not statutory designated centre — module activated in "Informative" mode)
- ❌ MOD-07 MHC (not mental health service)
- ❌ MOD-08 Tusla (not children's service)
- ✅ MOD-09 Construction H&S (default)

**Agents activated:**

- Architect ✓
- Fire ✓
- DAC ✓
- Mechanical ✓
- Electrical ✓
- Structural ✓
- Civil ✓
- Planning Law ✓
- QS ✓
- PSDP ✓
- BCAR / Assigned Certifier ✓
- Design Certifier ✓
- Sector Regulator (HIQA sub-module, informative) ✓
- Public Procurement & PW-CF ✓
- Insurance & Indemnity ✓
- Construction Law ✓
- Lift (if any) — conditional on architect agent identifying lift
- Specialist Systems — conditional on M&E identifying specialist scope

---

## Phase 3+ modules (not in current scope)

The following modules are spec'd but not yet built. They activate in Phase 3 onwards or per-customer demand:

- MOD-10 Conservation / Architectural Heritage
- MOD-11 Landscape + Ecology + Biodiversity
- MOD-12 Civil / Drainage / SuDS / Flood Risk
- MOD-13 Tender Risk (cross-discipline tender pack coherence)
- MOD-14 Handover Evidence (cross-discipline pre-occupation evidence)
- MOD-15 EU Procurement (above-threshold directive compliance)
- MOD-16 Data Centre (EN 50600)
- MOD-17 Major Infrastructure (TII / NTA / Eurocode + Irish NAs)
- MOD-18 EU AI Act compliance (where customer themselves uses AI in design)

Each follows the same activation / agent / report-section mapping pattern.

---

## Module versioning

Modules follow the same prompt-versioning scheme (file 15). Each module has:

- `module_version` (e.g., `mod-fsc-1.0.0`)
- Corpus version stamps for each loaded standard
- Activation rule change log

When statutory law changes (e.g., a new TGD revision), the affected module bumps version, the corpus refreshes, and the next review captures the new version in the audit log.

---

*The 9 modules above cover ~85% of Irish capital projects. The remaining ~15% (heritage, infrastructure, data centres, sector niches) live in the Phase 3+ list and activate per customer.*
