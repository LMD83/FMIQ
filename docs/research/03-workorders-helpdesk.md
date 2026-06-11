# FMIQ Research Brief 03 — Work Orders & Helpdesk

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

Scope: best-in-class work order + helpdesk design for FMIQ, GovIQ's IWMS for Irish public-sector and heritage estates (anchor use case: National Museum of Ireland-class institutions — multi-site, protected structures, live collections, mixed in-house/contractor delivery). Sources gathered June 2026.

---

## 1. Market leaders — what wins and why

### 1.1 The mobile-first winners (MaintainX, UpKeep, Limble)

The consistent market finding: **adoption is the product**. MaintainX has become "the go-to CMMS for teams that need technicians using the system on day one" — its mobile app is rated the strongest in the category, with a clean interface, real-time messaging inside work orders, photo/file attachments, and procedure checklists ([Reliamag independent comparison](https://reliamag.com/guides/best-cmms-software-2026/), [Tractian MaintainX vs Limble](https://tractian.com/en/blog/maintainx-vs-limble)). Capterra/G2 repeatedly award it best ease-of-use and "most implementable" ([MaintainX work order management](https://www.getmaintainx.com/use-cases/work-order-management)). MaintainX was acquired by Autodesk (announced 2026), signalling consolidation of mobile-first FM into design/BIM ecosystems.

Concrete UI patterns that make MaintainX "the one technicians actually use":

- **Chat-on-workorder.** MaintainX is the only mainstream CMMS with fully integrated chat — individual, group, and per-work-order threads. Updates, questions, and problem-solving happen inside the work order, not in WhatsApp, so the audit trail is complete by default ([MaintainX features review](https://www.getmaintainx.com/blog/maintenance-work-order-software)).
- **Comment + tag + annotate.** Snap a photo, annotate it (circle the fault), tag a colleague. Photos attach to the work order and the asset record ([MaintainX work order management](https://www.getmaintainx.com/use-cases/work-order-management)).
- **One-screen work order card.** Title, asset, location, priority, due date, checklist, photos, chat — all on one mobile card. Job details, asset history, QR/barcode scan and offline mode are all reachable from the phone ([MaintainX mobile vs web](https://help.getmaintainx.com/mobile-vs-web-overview), [Coast review of work order apps](https://coastapp.com/blog/work-order-apps/)).
- **Templates with required fields.** Pre-filled work order templates with required fields, time tracking, and signature capture force data quality without training ([MaintainX work order management](https://www.getmaintainx.com/use-cases/work-order-management)).
- **Offline mode.** Technicians keep working without connectivity; sync on reconnect. Limble matches this ("log work orders and update statuses even when offline") ([Limble vs MaintainX comparisons](https://limble.com/learn/maintainx-vs-upkeep)).
- **External Work Orders.** Shared work orders with vendors/contractors — comments, files, and progress tracked in the same record ([MaintainX vendor collaboration](https://www.getmaintainx.com/use-cases/work-order-management)).
- **Voice notes** alongside photos for low-friction capture in the field ([App Store listing](https://apps.apple.com/us/app/maintainx-work-orders/id1437854484)).

Counterpoints worth copying from rivals: Limble allows editing closed work orders and deeper customisation/custom fields, which MaintainX lacks; UpKeep leads on audit-readiness, safety procedures and meter-based PM triggers ([Limble comparison](https://limble.com/learn/maintainx-vs-upkeep), [UpKeep CMMS comparison](https://upkeep.com/blog/cmms-comparison/), [UpKeep best CMMS 2026](https://upkeep.com/blog/best-cmms-software/)).

### 1.2 The enterprise CAFM/IWMS layer (Planon, MRI Evolution/Concept Evolution, QFM)

The enterprise products win on contract machinery, not technician UX:

- **Planon** — full IWMS: space, lease, booking, asset lifecycle, work order, incident and workflow management with role-based permissions; on the UK G-Cloud Digital Marketplace, which matters for public procurement ([Planon G-Cloud listing](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/734741321099316), [Planon CAFM glossary](https://planonsoftware.com/us/glossary/cafm/)).
- **Concept Evolution (FSI, now MRI Evolution)** — its differentiator is an **advanced SLA engine**: multiple user-defined time points per SLA (respond / attend / make-safe / rectify), each monitored and escalated against user-defined parameters; traffic-light "jobs at risk of breach" views ([FSI Concept Evolution overview](https://na-prod-aventri-files.s3.amazonaws.com/html_ereg_uploadfiles/29541467_18483376.pdf), [MRI Evolution](https://www.mrisoftware.com/ae/products/evolution/), [Software Advice profile](https://www.softwareadvice.com/cafm/concept-evolution-profile/)).
- **QFM (SWG)** — same family: helpdesk + SLA + contractor management for outsourced FM contracts.

**FMIQ thesis:** the market gap is exactly the seam between these two camps — MaintainX-grade technician UX with Concept-Evolution-grade SLA/contract machinery and public-sector audit. Nobody owns that seam for Irish public-sector heritage estates.

---

## 2. Intake channels — meeting reporters where they are

A curator who spots a leak is not an FM user and will never log into a CMMS. Intake must be zero-training:

1. **QR codes on assets and rooms (primary channel).** Scan with the native camera — no app, no login — and a mobile form opens with the asset/location pre-populated. Form: "What's wrong?", photo, optional name/email, submit. Under 60 seconds end-to-end ([Oxmaint QR workflow](https://oxmaint.com/article/qr-code-maintenance-request-workflow), [Fiix on QR codes for FM](https://fiixsoftware.com/blog/why-you-should-be-using-qr-codes-for-facility-management/), [FaultFixers asset QR scanning](https://www.faultfixers.com/feature/asset-qr-code-scanning)). Optionally require a short staff code to deter abuse ([iWorQ](https://iworq.com/systems/facility-management-software/)). Limble and Fiix both ship no-login QR request portals ([Fabrico QR CMMS roundup](https://www.fabrico.io/blog/best-cmms-software-with-qr-code-asset-tagging/)).
2. **Public request portal** (web link on intranet) for staff without a code in front of them — same form, with a location picker instead of pre-population. Reporters get a tracking link and automatic status notifications; this kills the "did anyone see my email?" follow-up calls ([Oxmaint self-service portal](https://oxmaint.com/industries/facility-management/maintenance-request-portal-self-service)).
3. **Email-to-ticket.** A monitored address (estates@…) auto-creates a request; parser extracts subject as title, body as description, attachments as photos. Categorisation/auto-routing rules then apply ([Zendesk routing options](https://support.zendesk.com/hc/en-us/articles/4408831658650-Routing-and-automation-options-for-incoming-tickets), [Sentisum automated routing](https://www.sentisum.com/library/automated-ticket-routing)).
4. **Helpdesk phone entry** — FM coordinator raises the request in the same form (24h helpdesk is the contractual norm in public FM SLAs, e.g. [NHS Property Services FM SLA](https://www.property.nhs.uk/media/2777/nhs-property-services-fmsla.pdf): "The Occupier will request services from the Supplier via the Help Desk which is available 24 hours a day").
5. **System-generated** — PPM schedules, sensor/BMS alarms, inspection failures (out of scope here, but they enter the same work order pipeline).

**Triage and auto-routing rules.** Intake best practice: dropdowns not free text for category; conditional follow-up fields per request type ("you cannot prioritize what you have not categorized") ([Bitrix24 helpdesk triage rules](https://www.bitrix24.com/articles/help-desk-triage-scales-rules.php)). Routing rules fire on category x location x asset-type: plumbing fault at Collins Barracks routes to the M&E supervisor queue for that site; lift fault routes straight to the lift contractor; anything in a collections-sensitive zone is flagged for conservation review (see §5). Modern stacks add NLP-assisted classification of free-text/email intake, with rules for SLA-breach routing and escalation ([Kustomer automated routing](https://www.kustomer.com/resources/blog/automated-ticket-routing/), [Moveworks intelligent triage](https://www.moveworks.com/us/en/resources/blog/what-is-intelligent-triage-it-support)). FMIQ v1 should ship deterministic rules (category x site x zone-sensitivity); AI classification is a later, flagged-off assist — consistent with GovIQ's deterministic-first policy.

**Duplicate suppression:** on submit, show open requests for the same asset/room ("Leak in Room 2.14 already reported — add your photo to it?"). High payoff in visitor-facing buildings where one fault generates many reports.

---

## 3. SLA and priority models

### 3.1 What the contracts actually say (UK/Irish norms)

FM contracts almost universally use a 4-5 band priority model with **two clocks per priority: response (attend/make-safe) and rectification (complete)** ([Macro on FM SLAs](https://www.macro-group.com/perspectives/what-is-sla-in-facilities-management), [UK SLA guide](https://templatesuk.com/service-level-agreement-guide-uk/)). Concrete public-sector exemplars:

- **University of Strathclyde Estates** (representative UK public-estate helpdesk, published in full): Critical = respond < 2 hr, make safe/secure < 4 hr; Urgent = complete within 5 working days; Standard = within 10 working days; plus a Planned category (agreed date) and a "Workflow Bypass — Critical" that pushes a job straight to a tradesperson's phone, skipping supervisor triage ([Strathclyde priorities & service levels](https://www.strath.ac.uk/professionalservices/estates/estateshelpdesk/prioritiesservicelevels/)). Note the explicit caveat: priority times are make-safe targets; full reinstatement may follow as a second visit dependent on parts/specialists — the system must model that.
- **NHS estates**: priority codes ranging from immediate/2-hour response to 14-day completion for the lowest band ([NHS Lothian FM audit](https://org.nhslothian.scot/keydocuments/wp-content/uploads/sites/28/2025/11/Facilities-Estates-Management.pdf)); 24h helpdesk + out-of-hours make-safe call-out is contractual ([NHSPS FM SLA](https://www.property.nhs.uk/media/2777/nhs-property-services-fmsla.pdf)).
- **HSE estates (Ireland)**: regional 24/7 reactive + planned maintenance frameworks (e.g. Dublin North/East) across ~4,440 buildings ([Hollyfort HSE Estates contract](https://www.hollyfort.ie/our-work/hse-estates-maintenance/)); HSE manages estate data through its National Estates Information System ([HSE NEIS](https://www.hse.ie/eng/about/who/healthbusinessservices/estates/national-estates-information-system.html)). Published P-band tables are contract-schedule material, not public; FMIQ should make the band table fully configurable per contract.
- Generic ITSM-style P1-P4 (P1 respond 15 min/resolve 1-2 hr ... P4 next business day/3-5 days) is the vocabulary clients use, but FM rectification times are longer and trade-dependent ([Jitbit priority levels](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/), [Email Meter SLA benchmarks](https://www.emailmeter.com/blog/understanding-industry-standard-sla-response-times)).

### 3.2 Recommended FMIQ priority model

| Priority | Definition | Response (attend/make safe) | Rectification | Examples |
|---|---|---|---|---|
| P1 Emergency | Danger to life, collections, or building; security breach | 1-2 hr, 24/7 | Make safe 4 hr; permanent fix scheduled | Gas leak, flood, power loss to floor/building, insecure building, person trapped in lift, **active leak in a collections space** |
| P2 Urgent | Serious inconvenience or risk of escalation | 4 hr (working day) | 1-2 working days | Blocked drain, local heating/power loss, broken glazing, only-WC out of service, pest sighting in store |
| P3 Standard | Inconvenience, low escalation risk | 1 working day | 5-10 working days | Sanitaryware repairs, doors/windows (no security risk), plaster, tiles |
| P4 Minor / cosmetic | No operational impact | Acknowledge | 20 working days or next planned visit | Decoration, minor fixtures |
| Planned | Scheduled/agreed works | n/a | Agreed date | PPM, events set-up, moves |

Engine rules:
- Per-contract/per-site override tables (Strathclyde-style examples list per band, editable).
- **Two timers per work order** (respond + rectify), business-hours calendars per site, pause rules ("stop the clock" only for documented reasons: awaiting access, awaiting parts, awaiting conservation sign-off — with reason codes).
- **Heritage modifier:** any fault in a designated sensitive zone auto-uplifts one priority band and notifies conservation (water + collections is always P1).
- Traffic-light at-risk views and timed escalations (75% of SLA elapsed = warn assignee; 100% = escalate to supervisor; breach = notify contract manager + log for KPI), per the Concept Evolution multi-time-point pattern ([FSI Concept Evolution](https://na-prod-aventri-files.s3.amazonaws.com/html_ereg_uploadfiles/29541467_18483376.pdf)).
- Make-safe vs permanent-repair split: a P1 can be "made safe" (timer satisfied) and spawn a linked follow-on work order at lower priority — mirrors Strathclyde practice.

### 3.3 Contractor dispatch and external portals

Standard pattern across Joblogic, expansive FM, Mitie/Maximo: dispatch the work order to a **contractor portal** where the contractor can accept/reject the job, submit RAMS (risk assessments and method statements) up front for approval before attendance, receive automatic notifications "within seconds rather than waiting for phone calls", upload job sheets/photos/certs on completion, and have entries approved or rejected by the FM team ([Joblogic subcontractor portal](https://www.joblogic.com/features/sub-contractor-portal/), [expansive FM contractor management](https://www.expansivefm.com/cafm-platform-tour/contractor-engineer-management), [Mitie Maximo subcontractor portal](https://mitiesuppliers.com/training/how-to-use-the-maximo-7-6-subcontractor-portal-job-management/), [expansive FM reactive maintenance](https://www.expansivefm.com/latest/9-ways-cafm-software-speeds-reactive-maintenance-in-2026)). Routing can auto-select contractor by fault type, location, and availability. Insurance/competence expiry should block dispatch. RAMS review is a real workflow with named-reviewer accountability ([CTC principal-contractor RAMS review](https://www.ctcswl.co.uk/2026/03/07/principal-contractor-rams-review-process/)).

FMIQ: contractor is a first-class persona with scoped portal access (their jobs only) — same architectural move as GovIQ's Design Team persona and `con_externalAccess`, reusable directly.

---

## 4. Status lifecycle — minimal states, evidence-heavy closure

### 4.1 What real teams use

Best practice is a **small state set with mandatory reason codes**, not a heavy BPM workflow. The canonical lifecycle: Open (request) → Assigned → In Progress → On Hold → Completed → Closed, plus Cancelled ([Oxmaint work order lifecycle best practices](https://oxmaint.com/article/work-order-management-best-practices-creation-prioritization), [Dynamics 365 Field Service lifecycle](https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status), [Limble work order guide](https://limble.com/blog/work-order)). Key findings:

- Status labels matter less than **unambiguous definitions** consistently applied.
- **On Hold without a reason code is useless.** Hold reasons (awaiting parts, awaiting access, awaiting permit, awaiting contractor, awaiting approval) are how systemic bottlenecks are found.
- **Completed ≠ Closed.** P1/P2 work should require supervisor/planner verification before closure (work genuinely done, failure code recorded, asset back in service).
- **Cancelled is distinct from Closed** — duplicates, self-resolved, deliberately deferred — and must report differently.

### 4.2 Completion evidence

Industry-standard closure capture: before/during/after photos auto-tagged with timestamp, GPS and technician; parts used with quantities; labour time (start/stop or entered); failure/fault code from a standard library; corrective action notes; e-signature where required ([Oxmaint mobile CMMS for field technicians](https://oxmaint.com/article/mobile-cmms-field-technicians-paperless-work-orders-offline), [eWorkOrders signature capture](https://eworkorders.com/signature-capture-cmms/), [HVI mobile photo evidence](https://heavyvehicleinspection.com/maintenance/cmms-workflows/work-orders/mobile-photo-evidence), [Tractian work order completion](https://tractian.com/en/blog/work-order-completion)). Evidence requirements should be **per-category policies** (a P4 bulb swap needs one photo; a P1 flood in a gallery needs photos + parts + conservation counter-sign).

### 4.3 Recommended FMIQ state machine

```
new → triaged → assigned → accepted → in_progress → completed → verified → closed
                              |            |
                              v            v
                          declined      on_hold (reason code, SLA pause rules)
any pre-completion state → cancelled (reason code)
completed → reopened (within N days, by verifier or reporter)
```

Eight working states, three terminals. Rules: `on_hold` requires a reason code; `verified` mandatory for P1/P2 and all sensitive-zone jobs, auto-skip for P3/P4 (configurable); `completed → closed` auto-promotes after N days if verification not required; every transition audit-logged with actor/before/after (maps 1:1 to GovIQ's `auditLog()` discipline); reporter notified at triaged, in_progress (scheduled date) and completed.

---

## 5. Heritage deltas — what generic CMMS gets wrong

This is FMIQ's differentiation. Generic CMMS treats a museum like a warehouse; the deltas:

1. **Permit-to-work as a first-class object.** Hot works in roofed historic buildings should be prohibited as a general rule; where unavoidable, a Permit-to-Work (Hot Work) is mandatory, issued just before the task, for a clearly defined individual piece of work — never a blanket site authorisation ([Historic England, Fire Safety: Hot Work and Historic Buildings](https://historicengland.org.uk/content/docs/advice/fire-safety-hot-work-historic-buildings/)). FMIQ: permit types (hot works, working at height, roof access, isolation, confined space, works-near-collections) attachable to a work order; work order cannot enter `in_progress` while a required permit is unissued; permits expire and are logged.
2. **Conservation gate on sensitive zones.** Zone every space (gallery, store, lab, historic interior, plant, office) with a sensitivity flag. Work orders in sensitive zones require a **conservation sign-off step before works start** — risk-assess which objects can stay vs be decanted, agree protection/method, and for intrusive works agree dust/vibration protocols with trigger levels and continuous monitoring ([ICOM-CC on dust and vibration during building works](https://www.icom-cc-publications-online.org/2192/In-control-or-simply-monitoring-The-protection-of-museum-collections-from-dust-and-vibration-during-building-works), [IOA vibration protection of collections](https://www.ioa.org.uk/system/files/proceedings/d_trevor-jones_m_mcnulty_protection_of_art_gallery_and_museum_collections_from_vibration.pdf), [APT vibration limits for historic buildings and art](https://www.apti.org/assets/docs/Johnson-HannenHiRes_SampleArt_46.2-3.pdf)). This is a workflow state (`awaiting_conservation_signoff` as a typed hold), not a comment field.
3. **Protected-structure statutory checks (Ireland).** In a protected structure, works that would normally be exempted development may NOT be exempt if they materially affect character; the owner can obtain a **Section 57 declaration** from the planning authority clarifying which works are exempt (12-week process) ([Dublin City Council Section 57](https://www.dublincity.ie/planning-and-land-use/planning-application-rules-and-exemptions/section-57-declaration-check-exempt-development-protected-structure), [Leitrim CC Section 57](https://www.leitrim.ie/council/services/planning-building/planning-permission/section-57-protected-structures/), [Meath exempted developments](https://www.meath.ie/council/council-services/planning-and-building/planning-permission/do-you-need-planning-permission/exempted-developments)). **BCAR** applies where works trigger building-control requirements (Commencement Notices, ancillary certification; see the [SCSI guide to BCAR](https://scsi.ie/wp-content/uploads/2023/07/BCAR-IP-FINAL-1.pdf)). FMIQ: per-building flags (protected structure RPS ref, Section 57 declaration on file, ACA) drive a triage checkpoint — "does this work order materially affect character / trigger BCAR?" — that routes to a compliance queue rather than silently dispatching a contractor. All four NMI Dublin sites are historic; Collins Barracks dates to 1702.
4. **Contractor induction and supervision evidence.** Heritage estates require contractor competence (conservation-accredited trades for fabric), site induction records, and escort/supervision rules in collection areas — attach to the contractor profile and assert at dispatch ([Historic England consents](https://historicengland.org.uk/advice/planning/consents/), [SPAB heritage protection overview](https://www.spab.org.uk/advice/heritage-protection-legislation-and-policy-explained)).
5. **Environment-linked priority.** Faults to environmental plant serving collection spaces (RH/temperature/lux excursions, IPM/pest sightings) are collection-risk incidents, not comfort complaints — auto-uplift and notify collections care. (Cross-links to FMIQ environmental monitoring stream; PAS 198/BS 4971 norms per project context.)

OPW context: Irish State heritage property maintenance sits with OPW Property Maintenance Services, including cultural institutions ([gov.ie Heritage and Building Services](https://www.gov.ie/en/organisation-information/acdc48-heritage-and-building-services/)) — OPW-style estates are the broader Irish market for this module beyond NMI.

---

## 6. Recommended FMIQ work order model

### 6.1 States
As §4.3: `new, triaged, assigned, accepted, in_progress, on_hold(reason), completed, verified, closed, cancelled, declined, reopened` — with `awaiting_permit` and `awaiting_conservation_signoff` as typed hold reasons that gate `in_progress`. Full audit chain on every transition (reuse GovIQ `auditLog()` + hash-chain pattern; audit kinds `FM_*`).

### 6.2 Roles
| Role | Capabilities |
|---|---|
| Requester (any staff/curator) | Raise via QR/portal/email; track own requests; confirm fix; reopen |
| FM Coordinator (helpdesk) | Triage, categorise, set priority, merge duplicates, assign, communicate with requester |
| Technician (in-house) | Accept, execute, chat, capture evidence, complete; offline-capable mobile |
| Supervisor / FM Manager | Queues, SLA dashboard, verify/close, escalations, approve quotes, issue permits |
| Contractor (external) | Scoped portal: accept/decline, RAMS upload, attend, evidence, complete; no visibility beyond own jobs |
| Conservation / Collections | Review-and-sign-off queue for sensitive-zone work orders; can hold or condition works |
| Compliance (BCAR/planning) | Protected-structure checkpoint queue; attach Section 57 / Commencement Notice refs |

### 6.3 Intake channels (priority order)
QR-on-room/asset (no login) → public web portal → email-to-ticket → helpdesk phone entry → system-generated (PPM/sensors). Deterministic auto-routing on category x site x zone; duplicate suggestion at submit; requester notifications at triage, schedule, completion.

### 6.4 Mobile screens (technician app, offline-first)
1. **My Work** — today's jobs sorted by SLA clock, colour-banded.
2. **Work order card** — single screen: what/where/priority/SLA timer, asset history link, checklist, permit status banner.
3. **Capture** — camera-first: photo (before/during/after tags), annotate, voice note.
4. **Chat** — per-work-order thread, @mentions, requester messages.
5. **Complete** — guided closure: required photos, parts picker, time, failure code, signature.
6. **Scan** — QR scan to pull up any asset/room (history + raise WO).
7. **Offline indicator + sync queue.**

### 6.5 SLA engine
Config-driven band table per contract/site (default = §3.2); dual respond/rectify timers with business-hour calendars; pause only via typed hold reasons; heritage/sensitive-zone uplift rule; 75%/100%/breach escalation ladder; make-safe + linked follow-on pattern; KPI rollups (response compliance, rectification compliance, breach by category/contractor). Pure-function evaluation (same pattern as GovIQ's `runGoviqEngine` / threshold engine): `evaluateSla(workOrder, contractRules, now) → verdict`, no side effects.

### 6.6 Top 10 user journeys (ranked by expected frequency)
1. Staff member scans room QR, reports fault with photo (no login).
2. Coordinator triages new request: categorise, set priority, assign (or merge duplicate).
3. Technician works job on mobile: accept → photos → complete with evidence.
4. Requester checks status / receives "completed" notification and confirms fix.
5. Coordinator dispatches job to external contractor; contractor accepts and uploads RAMS.
6. Technician puts job on hold (awaiting parts) — SLA pauses with reason, requester auto-notified.
7. Supervisor reviews SLA-at-risk dashboard, escalates or reassigns before breach.
8. Conservation reviews and signs off (or conditions) a sensitive-zone work order before works start.
9. Supervisor verifies and closes a completed P1/P2 with full evidence pack.
10. Supervisor issues a permit-to-work (hot works/roof/near-collections) against a work order.

(Just below the line: monthly contract KPI report; reopen-on-failed-fix; raise follow-on permanent repair from a make-safe.)

### 6.7 Build notes
- Schema: `fm_workOrders`, `fm_requests` (pre-triage), `fm_slaPolicies`, `fm_permits`, `fm_holds`, `fm_evidence`, `fm_contractors`, `fm_zones` — prefix discipline per GovIQ §19.
- Reuse from GovIQ: audit chain, external-access persona pattern, pure-function engines, emailPool notifications, viewAs query gating.
- v1 deterministic routing only; AI triage assist behind a flag.
- PMC eligibility caveat applies (FMIQ CLAUDE.md §2): this model is a product spec for the broader heritage-estates market, with NMI's PMC as the requirements source — not a bespoke NMI build.

---

## 7. Source index

Market leaders: [MaintainX work order management](https://www.getmaintainx.com/use-cases/work-order-management) | [MaintainX maintenance work order software features](https://www.getmaintainx.com/blog/maintenance-work-order-software) | [MaintainX mobile vs web](https://help.getmaintainx.com/mobile-vs-web-overview) | [Reliamag best CMMS 2026](https://reliamag.com/guides/best-cmms-software-2026/) | [Limble: MaintainX vs UpKeep](https://limble.com/learn/maintainx-vs-upkeep) | [UpKeep CMMS comparison](https://upkeep.com/blog/cmms-comparison/) | [Tractian: MaintainX vs Limble](https://tractian.com/en/blog/maintainx-vs-limble) | [Coast work order apps](https://coastapp.com/blog/work-order-apps/)

Enterprise: [Planon G-Cloud](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/734741321099316) | [Planon CAFM](https://planonsoftware.com/us/glossary/cafm/) | [FSI Concept Evolution](https://na-prod-aventri-files.s3.amazonaws.com/html_ereg_uploadfiles/29541467_18483376.pdf) | [MRI Evolution](https://www.mrisoftware.com/ae/products/evolution/)

Intake: [Oxmaint QR workflow](https://oxmaint.com/article/qr-code-maintenance-request-workflow) | [Fiix QR for FM](https://fiixsoftware.com/blog/why-you-should-be-using-qr-codes-for-facility-management/) | [FaultFixers](https://www.faultfixers.com/feature/asset-qr-code-scanning) | [iWorQ](https://iworq.com/systems/facility-management-software/) | [Bitrix24 triage rules](https://www.bitrix24.com/articles/help-desk-triage-scales-rules.php) | [Zendesk routing](https://support.zendesk.com/hc/en-us/articles/4408831658650-Routing-and-automation-options-for-incoming-tickets) | [Sentisum](https://www.sentisum.com/library/automated-ticket-routing) | [Kustomer](https://www.kustomer.com/resources/blog/automated-ticket-routing/)

SLA: [Strathclyde Estates priorities](https://www.strath.ac.uk/professionalservices/estates/estateshelpdesk/prioritiesservicelevels/) | [NHSPS FM SLA](https://www.property.nhs.uk/media/2777/nhs-property-services-fmsla.pdf) | [NHS Lothian FM audit](https://org.nhslothian.scot/keydocuments/wp-content/uploads/sites/28/2025/11/Facilities-Estates-Management.pdf) | [Macro FM SLA](https://www.macro-group.com/perspectives/what-is-sla-in-facilities-management) | [Jitbit priorities](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/) | [Hollyfort HSE Estates](https://www.hollyfort.ie/our-work/hse-estates-maintenance/) | [HSE NEIS](https://www.hse.ie/eng/about/who/healthbusinessservices/estates/national-estates-information-system.html)

Contractors: [Joblogic subcontractor portal](https://www.joblogic.com/features/sub-contractor-portal/) | [expansive FM contractor management](https://www.expansivefm.com/cafm-platform-tour/contractor-engineer-management) | [Mitie Maximo portal](https://mitiesuppliers.com/training/how-to-use-the-maximo-7-6-subcontractor-portal-job-management/) | [CTC RAMS review](https://www.ctcswl.co.uk/2026/03/07/principal-contractor-rams-review-process/)

Lifecycle/evidence: [Oxmaint lifecycle best practices](https://oxmaint.com/article/work-order-management-best-practices-creation-prioritization) | [Dynamics 365 Field Service](https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status) | [Limble work order guide](https://limble.com/blog/work-order) | [Tractian completion](https://tractian.com/en/blog/work-order-completion) | [eWorkOrders signatures](https://eworkorders.com/signature-capture-cmms/) | [Oxmaint mobile CMMS](https://oxmaint.com/article/mobile-cmms-field-technicians-paperless-work-orders-offline)

Heritage: [Historic England hot work guidance](https://historicengland.org.uk/content/docs/advice/fire-safety-hot-work-historic-buildings/) | [Historic England consents](https://historicengland.org.uk/advice/planning/consents/) | [SPAB](https://www.spab.org.uk/advice/heritage-protection-legislation-and-policy-explained) | [DCC Section 57](https://www.dublincity.ie/planning-and-land-use/planning-application-rules-and-exemptions/section-57-declaration-check-exempt-development-protected-structure) | [SCSI BCAR guide](https://scsi.ie/wp-content/uploads/2023/07/BCAR-IP-FINAL-1.pdf) | [ICOM-CC dust and vibration](https://www.icom-cc-publications-online.org/2192/In-control-or-simply-monitoring-The-protection-of-museum-collections-from-dust-and-vibration-during-building-works) | [IOA vibration paper](https://www.ioa.org.uk/system/files/proceedings/d_trevor-jones_m_mcnulty_protection_of_art_gallery_and_museum_collections_from_vibration.pdf) | [gov.ie Heritage and Building Services](https://www.gov.ie/en/organisation-information/acdc48-heritage-and-building-services/)

END — v0.1 — 2026-06-11
