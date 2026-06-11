# FMIQ — Full System Review

_A critical, multi-expert review of the FMIQ concept and build: FM/CAFM domain, UX, UI/front-end, Convex/stack, and integrations. Each lens was researched against the current (mid-2026) market and grounded in the repo. Purpose: stress-test the idea, surface what to do differently, resolve the stack question, and confirm the integration surface. Date: 2026-06-06._

> Note on terms: the request's "Combex" is read as **Convex**; "Captain systems" is read as **CAFM systems** (Computer-Aided Facility Management — no FM product called "Captain" exists; the only matches are a manufacturing scheduler and marine/yacht CMMS tools). Companion artdefact: `FMIQ-integration-map.md` (full integration register).

---

## 1. Executive verdict

**The concept is sound and genuinely differentiated — and the build is mis-sequenced against its single biggest adoption risk.**

FMIQ attacks two real, unserved gaps no incumbent closes: (1) coupling environmental-excursion detection to maintenance dispatch *and* named at-risk objects *and* loan-ready evidence in one workflow, and (2) turning the Irish BCAR certification chain into live operational data at handover. The "no paperwork, no work" blocking gate is operationally correct and would survive HSA scrutiny — most CAFM systems warn, they don't block. That is a credible wedge into heritage and public-sector estates.

But three things must change or the product fails on contact with a real FM team:

1. **Mobile is sequenced last (Sprint 11). It must be first-class by Sprint 3.** Both the FM and UX experts independently called this the make-or-break issue. Field staff don't adopt systems they can't use at the point of work; the data goes stale in two weeks and the system becomes a reporting front-end nobody operates.
2. **There is no self-service helpdesk / request intake.** The primary demand channel in a museum — curators, wardens, contractors logging "roof leak above the print room" — has no home. Without it, a parallel WhatsApp thread replaces FMIQ within a fortnight of go-live.
3. **The stack ADR's central justification is now factually wrong** (Convex has an EU region since Feb 2026). The *decision* to stay on Azure/Postgres still holds, but for different reasons — and the ADR needs a revision note so it survives scrutiny.

Everything else in this review is upside: a set of differentiators that, taken together, would make FMIQ visibly better than anything the FM industry currently ships.

---

## 2. The five expert verdicts, in brief

**FM / CAFM (domain).** Concept is sound and Irish-law literate. Strengths: the blocking gate, the collection-care loop, the handover golden-thread seeding — none of which Planon, Maximo, Archibus, MRI, QFM or Infraspeak do. Weaknesses: no self-service request portal, no visitor/footfall operations, mobile too late, energy/SEAI reporting under-specified, no structured condition-survey workflow (which lifecycle costing depends on), no FM service-contract/SLA management. *Make-or-break: mobile in the first 4 weeks.*

**UX.** "The 7am test" is the right north star and is exactly where legacy IWMS fails. But it's stated, not operationalised — no written scenario, no prototype path, so it can't be passed or failed. The current UI is desktop-first with zero mobile layout; bilingual EN/GA, offline, and "undo-not-confirm" are specified but absent in code. Hardest real problems: gloved/one-handed/no-signal field work, low digital literacy, trust in auto-raised work orders, status-by-colour-alone (a live WCAG defect).

**UI / front-end.** The token set, palette and typography are a genuine asset — distinctive and AA-verified. But the single 412-line `App.tsx`, seven parallel `useState`s, hand-rolled `<table>` and inline SVG chart won't scale and carry accessibility risk. Adopt a proven primitive layer (shadcn/Base UI), accessible charts (Nivo — Recharts is *not* fully WCAG-compliant), an accessible data-grid (AG Grid), `react-i18next` for EN/GA, and align interaction patterns to gov.ie/GOV.UK for procurement credibility.

**Convex / stack.** The ADR rejected Convex for "no EU residency + no Entra SSO." Convex shipped self-hosting (Feb 2025) and a managed **EU region in Ireland, `aws-eu-west-1` (Feb 2026)** — so "no EU option" is outdated. *However*, the recommendation to **stay on Azure/Postgres still holds** on stronger grounds: Convex Inc is US-incorporated (CLOUD Act residual risk), has no published ISO 27001/SOC 2 for the managed product, has no TimescaleDB-equivalent for sensor telemetry, no native OData/Power BI path, and application-layer (not database-enforced) tenant isolation. The ADR needs correcting, not reversing.

**Integrations.** The plan's integration set is correct but incomplete. Nine net-new integrations identified, several legally required (see §6). The Information Mediator / X-Road positioning is a real procurement differentiator and under-emphasised.

---

## 3. What to do differently — the differentiators

These are the opinionated plays that, beyond the collection-care wedge, would make FMIQ "the best system the FM industry has seen." Most are low-cost and uniquely defensible for heritage/public-sector.

**3.1 Make the Safety File a living, structured object — not a PDF.** Parse the handover Safety File into per-asset structured hazards, isolation points, confined-space flags, and heritage-fabric fragility. A technician opening a permit on a 1702 Collins Barracks wall sees "Lime mortar — no power tools; conservation sign-off required" pulled from data, not memory. No CAFM does this; the Safety File is already linked to `est_asset` — add an `asset_hazard` child table.

**3.2 "Heritage-Fabric Access" as a first-class permit type.** Beyond hot-works/confined-space/LOTO: triggers conservation review, references Planning & Development Act Part IV (protected structures), captures before/after photographic condition records, and flags works near the planning-notification threshold. Positions FMIQ for OPW, NIAH-listed estates, and EU heritage bodies.

**3.3 Loan-readiness as a continuous live score, not a one-click report.** Each gallery/store shows a live readiness score = environmental compliance × active excursions × pest clearance × fire-cert currency × structural-survey age. Red tells you exactly what to fix and raises the work orders. Turns a report button into an operational instrument registrars and lenders actually check.

**3.4 IPM risk-scored by collection material.** Each pest sighting scored by species × proximity to zone × susceptibility of the material (textile/paper/organic), driving treatment urgency and feeding the loan-readiness score. Conserv logs pests; none risk-score by material.

**3.5 Predictive collection-care via Met Éireann.** Free CC-BY weather/forecast API drives HVAC pre-conditioning *before* an excursion, and storm alerts auto-raise fabric-inspection WOs. Shifts the headline claim from reactive to **preventive** — categorically stronger for a national museum, low cost.

**3.6 Compliance transparency as a product feature.** A per-tenant, configurable public/board-facing "statutory certificates current as of [date]" page — Disability Act Part 5 report + FOI-accessible cert register + board assurance in one. Removes admin overhead and demonstrates accountability; no competitor ships it.

**3.7 Zero-form field capture + voice + QR-as-navigation.** Standard close-out = scan QR → tap failure category → photo → done (no typing); voice intake ("mould on south wall, Textile Store, Block C") via EU-resident Azure speech for non-technical users; the asset QR tag is the primary navigation anchor, not a menu tree. This is the operational expression of the 7am test.

**3.8 Build-to-Share / X-Road conformance as a scored procurement asset.** Publish a formal OGP API-standards conformance statement and list on the eTenders product register. A procurement-score multiplier, not just an engineering task.

---

## 4. Critical gaps to close

| Gap | Why it matters | Recommendation |
|---|---|---|
| **Self-service request portal / helpdesk** | The primary demand channel in a museum has no home; FM reverts to WhatsApp/phone | Build a lightweight requester intake (web + PWA, QR, email, no-login for standard requests) → triage → auto-SLA. **Pull into Phase 1.** |
| **Mobile sequenced at S11** | Field staff can't use the system at the point of work for 22 weeks; adoption dies | Ship a minimal mobile/PWA shell (job list, gate status, photo, close-out, offline queue) by **S3–S4**; harden offline at S11 |
| **Visitor / footfall operations** | NMI is a high-footfall estate; cleaning/security/maintenance scale to visitors; absent from the data model | Add visitor-count feed + footfall-linked resourcing + visitor-incident reporting + evacuation roll-call |
| **Energy / SEAI M&R reporting** | Statutory for public bodies (annual energy performance submission) | Define `sus_reading` sub-metering + SEAI CSV export by go-live |
| **Structured condition surveying** | Lifecycle costing has no input data without it | Mobile element-by-element grading (Uniclass/NRM3 refs, photo per defect, building roll-up) inside the asset-register epic |
| **FM service-contract / SLA management** | Drives contractor payment, penalties, renewal across multiple service lines | Contract terms + contracted response/fix times feeding the SLA engine + contractor scorecards |
| **Helpdesk/ITSM dedupe** | If NMI has an existing IT helpdesk, FMIQ must not create a second inbox | Assess at pilot MOU; integrate if present |

---

## 5. The stack decision (Convex vs Azure/Postgres) — corrected

**Corrected facts (verified):** Convex shipped open-source **self-hosting** (Docker/Fly) in Feb 2025 and a managed **EU region in Ireland (`aws-eu-west-1`) on 6 Feb 2026**, on all plans (EU resource pricing +30%, on-demand billed, no automatic region migration). Source: [Convex EU hosting](https://news.convex.dev/we-finally-got-our-eu-visa/), [Convex regions docs](https://docs.convex.dev/production/regions). The FMIQ ADR (dated 2026-06-05) states Convex has "no EU sovereign option" — **this was already inaccurate ~4 months before the ADR was written** and must be corrected.

**Recommendation: stay on Azure/Postgres (Option A) — but fix the ADR's reasoning.** The decision holds for these reasons, not the obsolete one:

1. **Compliance posture** — Azure carries ISO 27001/27017/27018, SOC 1/2, CSA STAR and the completed EU Data Boundary; Convex (managed) publishes none of these and the DPA counterparty is a US entity (CLOUD Act residual risk). In a tender scored on sovereignty, Azure wins on documentation.
2. **Time-series** — TimescaleDB hypertables/continuous aggregates/compression have no Convex equivalent; Convex's per-query document-scan limits make 26M-rows/year telemetry a custom pre-aggregation project.
3. **Reporting** — Postgres exposes OData/Power BI natively via the `fmiq_read` role; Convex has no OData layer.
4. **Tenant isolation** — Postgres `FORCE ROW LEVEL SECURITY` is database-enforced; Convex is application-layer (a missed filter leaks, with no safety net).
5. **Sunk cost is small but real** — the Fastify/RLS scaffold + `collectionCare.ts` work; migrating now costs ~3 sprints with no user-visible gain.

**The trigger that flips to Convex (Option B):** Convex achieves ISO 27001 + SOC 2 Type II on the EU region with an EU legal entity *and* GovIQ hasn't yet reached a second FMIQ deployment. ~12–18 month horizon. If migration ever happens, the window is **before migrations 002–007 land**, not after Phase 1.

**On the "GovIQ stack fork":** divergence (GovIQ on Convex, FMIQ on Azure/Postgres) is real and costs ~1 engineer-sprint/quarter rising to ~1 engineer-quarter/year in duplicated auth, audit-over-API, no shared ORM/types, split hiring, and two ops pipelines. Accept it deliberately as the price of FMIQ's procurement-grade posture — and keep the interop surface thin (shared Entra + audit contract + domain), exactly as planned. A **hybrid** (Postgres system-of-record + a Convex read-layer purely for live dashboard subscriptions) is viable but probably not worth two runtimes for a small team; prefer Postgres `LISTEN/NOTIFY`-driven push when real-time UI becomes a competitive must.

**Action:** add a dated revision note to `architecture-adr.md` correcting the EU-region fact and re-stating the rationale above. The decision is right; the paper trail must be honest, because a procurement reviewer will check.

---

## 6. Integrations — what else is required

The plan's set (GovIQ spine, ERP/finance deferred, BMS/IoT, CMS, BIM/COBie, OpenAPI/OData/webhooks/SCIM, X-Road) is correct. Full register with protocols, direction, priority and Irish/compliance notes is in **`FMIQ-integration-map.md`**. Nine net-new integrations, several legally required:

| New integration | Priority | Why |
|---|---|---|
| **Revenue eTax Clearance** (SOAP) | **P1** | Contractor gating at the SSoW gate + daily re-check; legal obligation (S.I. 463/2012). Highest-consequence current gap. |
| **Fire-alarm panel** (IS 3218:2024, Modbus/dry-contact via edge) | **P1** | Fault events auto-create inspections + drive the compliance clock; turns paper into audited records |
| **Emergency-lighting auto-test ingest** (IS 3217) | **P1** | Pulls addressable-panel test results into `cmp_inspection_item`; closes the commonest statutory record gap |
| **Access control / CCTV reconciliation** (OSDP/REST) | **P1** | Reconcile badge events against `hs_keyloan`/`hs_permit`; unauthorised zone entry alerts |
| **Lift telemetry** (Schindler/KONE/Otis API) | P2 | Fault codes → reactive WO; supports S.I. 299/2007 thorough-exam records |
| **Met Éireann weather API** (REST, CC-BY) | P2 | Predictive HVAC pre-conditioning + storm-triggered fabric inspections (differentiator 3.5) |
| **SEAI M&R export** (scheduled CSV) | P2 | Eliminates manual public-sector energy reporting |
| **NIAH / Historic Environment Viewer** (REST/WMS) | P2 | Surfaces protected-structure constraints when permits/RAMS are raised |
| **MyGovID / EU Digital Identity Wallet** (eIDAS 2.0) | P3 | Credential presentation for `hs_competency`; public-sector acceptance mandated by end-2026 |

**Top 3 that most de-risk/differentiate the NMI pilot:** Revenue eTax Clearance (closes a named legal liability), fire-alarm + access-control auto-record (paper → audited, unmatched by Irish heritage IWMS), and Met Éireann predictive pre-conditioning (reactive → preventive collection care).

---

## 7. Recommended changes to the plan

Concrete deltas to `PROJECT-PLAN.md` and the Linear backlog:

1. **Re-sequence mobile.** Add a minimal mobile/PWA shell to Phase 1 by **S3–S4** (new story under EP-6 or a new EP-MOB); keep offline hardening at S11. *This is the highest-priority change.*
2. **Add an epic: Self-service request portal / helpdesk intake** — Phase 1, alongside reactive maintenance.
3. **Promote three integrations to P1:** Revenue eTax Clearance, fire-alarm panel, emergency-lighting auto-test (extend EP-3 Compliance + EP-4 SSoW). Add the rest to P2/P3 backlog.
4. **Add a condition-survey story to EP-1** (asset register) so EP lifecycle-costing has input data.
5. **Front-end foundation stories into EP-DX/EP-8, before Sprint 2:** split `App.tsx` + React Query; adopt shadcn/Base UI + Nivo + AG Grid; `react-i18next` EN/GA; fix the `.dot` colour-only WCAG defect; build `<StatusBadge>` and `<GateBanner>` as the first design-system deliverables.
6. **Operationalise the 7am test:** write it as a named, testable scenario with a prototype path and make it a Definition-of-Done item for every user-facing story.
7. **Revise `architecture-adr.md`** with a dated note correcting the Convex EU-region fact and re-stating the stay rationale.
8. **Add visitor/footfall operations** to the soft-services epic with a real data model + KPI.

---

## 8. Top 10 actions & decisions

1. **Decide: mobile-first re-sequence** (S3–S4 shell). — *owner: PM/Liam*
2. **Add the self-service request portal epic** to Phase 1.
3. **Promote Revenue eTax Clearance, fire-alarm, emergency-lighting to P1** integrations.
4. **Revise the architecture ADR** (Convex EU fact + corrected rationale); confirm the stay-on-Azure decision.
5. **Adopt the front-end foundation** (shadcn/Base UI, Nivo, AG Grid, react-i18next) before Sprint 2.
6. **Fix the colour-only status defect** and ship `<StatusBadge>` (1 day, legal compliance).
7. **Operationalise the 7am test** as a DoD scenario.
8. **Add condition surveying** to the asset-register epic.
9. **Confirm pilot integrations with NMI** at MOU stage (BMS vendor, CMS product, fire panel, existing helpdesk).
10. **Bank the differentiators** (living Safety File, heritage-fabric permit, live loan-readiness, Met Éireann pre-conditioning) into the roadmap as the things that win demos.

---

_Companion: `FMIQ-integration-map.md` (full register). This review should drive the next revision of `PROJECT-PLAN.md` and a dated note on `architecture-adr.md`._

## Sources

FM/CAFM: [Planon IWMS](https://planonsoftware.com/us/software/iwms/) · [IBM Maximo](https://www.ibm.com/products/maximo/maintenance-management) · [IBM CAFM](https://www.ibm.com/think/topics/cafm) · [Infraspeak CAFM](https://infraspeak.com/en/solutions/cafm-software) · [MaintainX](https://www.getmaintainx.com/learning-center/what-is-cafm-software) · [Archibus/Eptura](https://eptura.com/our-platform/archibus/) · [SFG20 CAFM vs IWMS](https://www.sfg20.co.uk/blog/cafm-vs-iwms) · [SEAI public-sector M&R](https://www.seai.ie/plan-your-energy-journey/public-sector/monitoring-and-reporting)
Heritage: [Conserv](https://conserv.io/) · [Hanwell heritage](https://hanwell.com/heritage/)
UX/UI: [MaintainX offline](https://help.getmaintainx.com/offline-mode) · [shadcn/ui](https://ui.shadcn.com/) · [GOV.IE Design System](https://github.com/ogcio/govie-ds) · [GOV.UK Design System](https://design-system.service.gov.uk/) · [Recharts accessibility issue](https://github.com/recharts/recharts/issues/2801) · [Nivo](https://nivo.rocks/) · [AG Grid accessibility](https://www.ag-grid.com/react-data-grid/accessibility/) · [react-i18next](https://react.i18next.com/)
Convex/stack: [Convex EU hosting (Feb 2026)](https://news.convex.dev/we-finally-got-our-eu-visa/) · [Convex regions](https://docs.convex.dev/production/regions) · [Convex self-hosting](https://news.convex.dev/self-hosting/) · [Convex limits](https://docs.convex.dev/production/state/limits)
Irish gov/integrations: [Information Mediator / X-Road](https://interoperable-europe.ec.europa.eu/collection/interoperable-europe-academy/document/policy-brief-api-gateway-enablers-irelands-information-mediator-and-netherlands-federated-service) · [eTenders](https://www.etenders.gov.ie/)
