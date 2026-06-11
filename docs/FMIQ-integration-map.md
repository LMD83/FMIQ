# FMIQ — Definitive Integration Map

_Date: 2026-06-06. Status: v1 for steering review. Read alongside `FMIQ-master-build-plan.md §7`, `architecture-adr.md`._

---

## 1. Complete Integration Register

### A — Irish Government & Compliance

| System | Category | Direction | Protocol / Method | Why required | NMI Pilot? | Irish / compliance note |
|---|---|---|---|---|---|---|
| **Azure Entra ID / B2B** | Identity & SSO | Bidirectional | OIDC, MSAL, SAML 2.0 | Staff SSO with MFA trust; B2B cross-tenant so NMI staff use their OGP/dept accounts | **P1** | Public-sector procurement expects Entra B2B; no passwords stored by FMIQ |
| **SCIM 2.0 provisioning** | Identity lifecycle | Inbound | SCIM 2.0 over HTTPS | Auto-provision / deprovision users from NMI's IdP; removes manual joiners/leavers risk | **P1** | GDPR Art.5(1)(e) storage limitation; NIS2 access-control RMM |
| **Revenue eTax Clearance** | Contractor compliance | Outbound query | SOAP/XML web service + TCAN verification ([Revenue spec](https://www.revenue.ie/en/online-services/support/documents/help-guides/etax-clearance/etax-clearance-verification-web-service-spec.pdf)) | Verify contractor tax-clearance status before any PO is raised or site access granted; a public body cannot engage a non-tax-compliant contractor | **P1** | S.I. 463/2012 (Tax Clearance in Relation to Public Sector Contracts); OGP circular threshold €10k+ |
| **BCMS — National Building Control** | Building control | Outbound query + inbound cert ref | Web scrape / manual + future API ([NBCO.localgov.ie](https://www.nbco.localgov.ie/)) | Handover Gate must validate a CCC has a real BCMS reference; store `bcms_ref` on `hov_cert`; future: machine-check that the reference resolves and is unrevoked | **P2** | S.I. 9/2014 (BCAR); CCC validation is a hard gate-check before go-live |
| **eTenders / OGP open data** | Procurement monitoring | Inbound (pull) | REST / data.gov.ie CSV ([dataset](https://data.gov.ie/en_GB/dataset/contract-notices-published-on-etenders)) | Monitor framework lots and supplier awards relevant to NMI; seed approved-supplier list; check that contractors engaged are on the relevant OGP frameworks | **P2** | Circular 05/2023 — all awards >€25k must be published; FMIQ can auto-flag non-listed suppliers |
| **MyGovID / EU Digital Identity Wallet (eIDAS 2.0)** | Contractor & visitor identity | Inbound | EUDI Wallet Connector API / OpenID4VP ([Ireland EUDIW](https://www.biometricupdate.com/202404/ireland-on-track-for-eudiw-deadline-with-launch-of-digital-wallet-in-2026)) | Accept EUDIW credentials for contractor onboarding (qualifications, Safe Pass, insurance) without manual document upload; mandatory public-sector acceptance by end-2026 | **P3** | eIDAS 2 Regulation (EU) 2024/1183; Irish Government Digital Wallet pilot Q1 2026; OGCIO-led ([gov.ie FAQ](https://www.gov.ie/en/department-of-public-expenditure-infrastructure-public-service-reform-and-digitalisation/publications/government-digital-wallet-your-questions-answered/)) |
| **Information Mediator / X-Road** | Cross-government interop | Bidirectional | X-Road message protocol + DOMIBUS/Apache Camel ([Interoperable Europe portal](https://interoperable-europe.ec.europa.eu/collection/iopeu-monitoring/interoperability-initiatives-ireland)) | OGCIO's reference architecture includes X-Road as the Information Mediator building block; FMIQ exposing an X-Road-compatible endpoint is a scored differentiator in OGP framework evaluations | **P3** | Interoperable Europe Act; "Connecting Government 2030" ([OGCIO](https://www.ogcio.gov.ie/en/publications/connecting-government-2030-a-digital-and-ict-strategy-for-irelands-public-service/)); Build-to-Share mandate |
| **SEAI M&R (Monitoring & Reporting)** | Sustainability / energy | Outbound | CSV / SEAI online M&R portal ([SEAI M&R](https://www.seai.ie/plan-your-energy-journey/public-sector/monitoring-and-reporting)) | Public bodies must report annual energy data to SEAI; FMIQ's `sus_reading` hypertable is the source; automated annual export eliminates manual SEAI portal entry | **P2** | Energy Efficiency Obligation Scheme; 51% GHG reduction target by 2030; NMI is a public body under the Public Sector Energy Programme |
| **data.gov.ie / Open Data** | Transparency reporting | Outbound | OData / CSV export | Public bodies must publish datasets under SI 376/2021 (Open Data Directive); estate asset and energy data may fall in scope; FMIQ's OData v4 feed feeds this directly | **P3** | SI 376/2021 transposing EU Directive 2019/1024; [data.gov.ie](https://data.gov.ie/) |
| **NIS2 / NCSC incident reporting** | Cybersecurity compliance | Outbound | NCSC incident portal / email ([NCSC NIS2](https://www.ncsc.gov.ie/nis2/)) | NIS2 transposed Q4 2025; NMI as a cultural institution operating critical infrastructure (BMS, environmental control) may be classified an "important entity"; significant incidents must be reported within 24h | **P2** | NIS2 Directive (EU) 2022/2555; Irish transposition enforced from 2026; penalties up to €7M for important entities |

---

### B — Building / BMS / Safety

| System | Category | Direction | Protocol / Method | Why required | NMI Pilot? | Irish / compliance note |
|---|---|---|---|---|---|---|
| **BMS — Trend Controls** | Building automation | Inbound | BACnet/IP, OPC-UA (via IoT edge gateway) | Trend is the dominant BMS vendor in Irish public buildings (OPW estates, Collins Barracks likely Trend); HVAC setpoints, AHU status, chiller data | **P1** | NIS2 OT/IT segmentation; no BMS→internet path; write-back gated + audited |
| **BMS — Siemens Desigo CC** | Building automation | Inbound | OPC-UA REST API (Desigo CC covers 9/12 API feature groups per [Ptidej research](https://blog.ptidej.net/a-study-of-the-capabilities-of-bms-apis-and-the-limitations-of-their-practical-usage/)) | Siemens Desigo found in Irish university and hospital estates; potential for FMIQ expansion targets | **P2** | Same NIS2 segmentation rules |
| **BMS — Schneider EcoStruxure** | Building automation | Inbound | REST / BACnet (EcoStruxure leads on API coverage — 10/12 feature groups) | Energy sub-metering data for SEAI M&R; present in larger Irish commercial and heritage buildings | **P2** | — |
| **BMS — Johnson Controls Metasys** | Building automation | Inbound | BACnet, Modbus, LonWorks; Metasys REST API | Metasys widely deployed; flexible protocol support makes it a good candidate for the generic BACnet edge adapter | **P2** | — |
| **Edge gateway (Azure IoT Operations / Chipkin / ICONICS)** | Protocol bridging | Inbound → IoT Hub | Modbus, BACnet, OPC-UA → MQTT → IoT Hub | Converts legacy BMS protocols to FMIQ's MQTT ingestion path; deployed on-site, no BMS internet exposure | **P1** | NIS2 OT/IT boundary enforcement |
| **Fire alarm panel** | Life safety | Inbound (alert/status) | Dry-contact relay → BMS or direct Modbus/RS-485 → edge gateway; or vendor REST (e.g. Hochiki, Advanced Electronics) | Fire alarm status (zone activations, faults, test events) feeds `cmp_certificate` compliance loop and triggers evacuation-aware WO suspension; I.S. 3218:2024 requires a complete service record | **P1** | I.S. 3218:2024 ([NSAI](https://www.thenbs.com/PublicationIndex/documents/details?Pub=NSAI&DocId=343733)); quarterly service WO must be auto-generated and evidenced |
| **Access control / physical security** | Security & site access | Bidirectional | OSDP v2, Wiegand → edge controller REST; or vendor API (Genetec, Lenel, Paxton) | Key/fob sign-out in `hs_keyloan` must reconcile with physical access-control events; restricted zones (collection stores, plant rooms) require both a WO permit and an access-control grant; audit trail merges physical + logical access | **P1** | GDPR Art.6 lawful basis for access logs; NIS2 physical security RMM; NMI already has an access-control system |
| **CCTV / VMS** | Security | Inbound (alert) | ONVIF / vendor REST webhook | CCTV motion events near collection zones can trigger an IPM sighting workflow or a security incident; camera-to-space mapping feeds the `ipm_observation` escalation; video evidence referenced (not stored) in `hs_incident` | **P3** | GDPR — video data; DPC guidance on CCTV retention; link by reference, not by storing footage in FMIQ |
| **Lift telemetry** | Asset compliance | Inbound | Lift vendor API / RS-485 → edge (Schindler, KONE, Otis) | Collins Barracks and other NMI sites have passenger lifts subject to thorough examination under S.I. 299/2007; real-time fault codes from the lift controller auto-create a reactive WO and update the compliance clock | **P2** | S.I. 299/2007 (PSSR); thorough examination every 6 months; fault-to-WO automation is the differentiator vs paper logs |
| **Emergency lighting** | Asset compliance | Inbound | Addressable system bus / BMS relay | I.S. 3217 requires monthly self-test + annual full discharge test; FMIQ reads pass/fail from the addressable panel and creates the compliance record automatically | **P1** | I.S. 3217; auto-test result import eliminates manual transcription |
| **Legionella monitoring (IoT thermometer)** | Water safety | Inbound | MQTT / Modbus temperature probe | Hot/cold water temperature logs satisfy S.I. 572/2013 Legionella risk management; continuous readings stored in `sus_reading` or `wo_meter_reading` with auto-alert on out-of-range | **P2** | S.I. 572/2013; HPSC Legionella Code of Practice |

---

### C — Collections / Heritage

| System | Category | Direction | Protocol / Method | Why required | NMI Pilot? | Irish / compliance note |
|---|---|---|---|---|---|---|
| **Conserv** | Environmental monitoring (museum-grade) | Inbound (webhook) | HTTPS webhook, Zod-validated ([conserv.io](https://conserv.io)) — **already implemented** | T/RH/lux/UV/shock per collection zone; the collection-care hero loop is live | **P1** | PAS 198; ASHRAE AA band compliance |
| **Hanwell** | Environmental monitoring | Inbound (poll / push) | CSV/FTP agent push or Hanwell Cloud REST | UK heritage standard; backup or secondary sensor network; CSV import adapter needed alongside webhook path | **P1** | — |
| **T&D (TR7x series)** | Environmental monitoring | Inbound (poll) | REST API poll | Japanese sensor brand common in Irish and EU museum stores | **P1** | — |
| **HOBO / Onset** | Environmental monitoring | Inbound (poll) | HOBOlink REST API | Common for portable/spot-check loggers; used during loan transport | **P2** | — |
| **Meaco / standalone dataloggers** | Environmental monitoring | Inbound | CSV import | Budget sensor option for smaller stores; batch CSV import adapter extends the `SensorAdapter` pattern | **P2** | — |
| **Axiell Collections** | Collections management | Inbound (pull, read-only) | Axiell REST API ([Axiell](https://www.axiell.com/solutions/product/axiell-collections/)) | Object reference + zone + sensitivity only (`cms_object_ref`, `sensitivity`, `primary_zone_id`); enables named at-risk objects in excursion alerts without storing catalogue data in FMIQ | **P1** | GDPR data minimisation; FMIQ never writes to the CMS; richer sync needs a DPIA |
| **TMS / Gallery Systems** | Collections management | Inbound (pull, read-only) | TMS REST / OData | Larger national museums (e.g. NMAI equivalents) use TMS; same data-minimised adapter pattern as Axiell | **P2** | Same GDPR constraints |
| **Vernon Systems** | Collections management | Inbound (pull, read-only) | Vernon CMS API | Irish/UK heritage sector alternative; adapter maps to same `{cms_object_ref, sensitivity, zone_id}` schema | **P2** | — |
| **CollectionSpace** | Collections management | Inbound (pull, read-only) | REST API (open-source) | Open-source option used by some Irish county archives and university collections; same minimised adapter | **P3** | — |
| **IPM trap / pest monitoring (Trécé, Anticimex)** | Pest / IPM | Inbound | Vendor REST or manual scan | Smart trap sensors push sighting counts to `ipm_observation`; proximity-to-collection auto-escalation to Conservation Officer; reduces manual trap inspection logging | **P2** | PAS 198; AIPM best practice; collection store IPM a heritage audit requirement |
| **Loan / transport environmental logger** | Loans compliance | Inbound | HOBOlink REST or CSV import | Records T/RH during object transit; auto-attaches to loan record; generates loan-ready evidence report | **P2** | Bizot Group environmental norms; required by lending institutions |

---

### D — Enterprise / Productivity

| System | Category | Direction | Protocol / Method | Why required | NMI Pilot? | Irish / compliance note |
|---|---|---|---|---|---|---|
| **Microsoft 365 / Graph API** | Calendar & email | Bidirectional | Microsoft Graph REST ([MS Graph](https://learn.microsoft.com/en-us/graph/overview)) | PPM visits, contractor attendance, inspections sync to Outlook calendars; read room/resource availability for booking conflict avoidance; email notification fallback via Exchange | **P1** | EU tenant required; Graph failures degrade gracefully — FMIQ booking always persists |
| **Microsoft Teams** | Notifications | Outbound | Teams webhook / Graph API | Critical excursion and gate-block alerts pushed to a named Teams channel; escalation path for Conservation Officer on duty | **P2** | EU tenant only; no message content stored in FMIQ |
| **Azure Communication Services (email)** | Transactional email | Outbound | ACS Email REST SDK | System-generated emails (WO confirmation, cert expiry alerts, approval requests); EU data residency; replaces Resend for gov-grade deployments | **P1** | Azure North Europe; GDPR Art.28 processor agreement with Microsoft in place |
| **Finance / ERP — Agresso (Unit4)** | Financial | Outbound → Inbound callback | HMAC webhook out; async `POST /api/erp/po-callback` | Approved requisition + commitment transmitted to ERP for PO issuance; ERP writes back `po_reference`, `grn_number`, `payment_status`; FMIQ never holds invoice data | **P2 (deferred)** | OGP thresholds; CWMF commitment accounting; segregation of duties |
| **Finance / ERP — SAP** | Financial | Outbound → Inbound callback | SAP BTP REST / IDoc | Larger public-body ERP; same `ProcurementGateway` port, different adapter | **P3** | — |
| **SFG20 task library** | Maintenance standards | Inbound (licensed data) | SFG20 API / data feed ([SFG20](https://www.sfg20.co.uk/)) | PPM task templates, frequencies, skill codes keyed to asset type; licensed statutory-maintenance reference; Irish SI frequencies validated on top | **P1** | SFG20 is the UK/Ireland FM industry standard for planned maintenance schedules |
| **Met Éireann** | Weather / environmental | Inbound (pull) | REST / XML API ([Met.ie open data](https://www.met.ie/about-us/specialised-services/open-data), [datacatalogue.gov.ie](https://datacatalogue.gov.ie/dataset/met-eireann-weather-forecast-api)) | 10-day forecast per site drives: predictive collection-care (incoming humidity/temperature front → pre-condition HVAC before excursion); seasonal PPM scheduling; storm alerts trigger urgent roof/fabric inspections; Castlebar (Country Life) rural exposure modelling | **P2** | CC BY 4.0 licence; free API; no residency issue |
| **Power BI / OData v4** | Reporting | Outbound | OData v4 (read-only, RLS-enforced, `fmiq_read` role) | Director and board reporting; estate benchmarking; SEAI energy dashboards; OGP contract monitoring | **P2** | GDPR — RLS ensures cross-tenant data never leaks to Power BI workspace |
| **Resend (email, pre-revenue MVP)** | Transactional email | Outbound | REST | Development/staging only; swap to ACS before any external go-live | **Dev only** | Not acceptable for production gov deployment (US-incorporated, no EU DPA path equivalent to Azure) |

---

### E — Reporting / Interop

| System | Category | Direction | Protocol / Method | Why required | NMI Pilot? | Irish / compliance note |
|---|---|---|---|---|---|---|
| **OpenAPI 3.1 / Azure APIM** | External interop | Outbound | REST; APIM rate limits + API keys | Third-party and internal consumers; the documented, versioned surface that survives a future OJEU tender as "open standards" evidence | **P1** | OGP scored criteria for open standards compliance |
| **OData v4** | BI / reporting | Outbound | OData over HTTPS | Power BI, Excel, and any BI tool that speaks OData; read-only, RLS-enforced | **P2** | — |
| **Webhooks (per-tenant, HMAC)** | Event push | Outbound | HTTPS POST, HMAC-SHA256 signature | Tenant-side integrations (e.g. NMI's own systems) subscribe to FMIQ events without polling | **P2** | HMAC secret per tenant, rotatable; replay protection via `event_id` + timestamp window |
| **SCIM 2.0** | Identity / provisioning | Inbound | SCIM 2.0 | Auto provision/deprovision from any SCIM-capable IdP (Entra, Okta, Google Workspace) | **P1** | GDPR; NIS2 access control RMM |
| **X-Road / Information Mediator** | Cross-government | Bidirectional | X-Road message protocol + security server | OGCIO "Connecting Government 2030" architecture; FMIQ's OpenAPI behind an X-Road security server makes it a reusable government service; scored in OGP framework evaluations | **P3** | Interoperable Europe Act; Build-to-Share; [OGCIO reference architecture](https://www.ogcio.gov.ie/en/corporate-pages/services/digital-services-v2/) |
| **BIM / IFC (web-ifc)** | Asset data | Inbound (file) | IFC 2x3/4; COBie spreadsheet; `web-ifc` in-container | Handover Gate: auto-populate asset register + PPM schedules from capital project handover; original file to Blob WORM | **P2** | BS EN ISO 19650; CWMF BIM requirements |
| **NIAH / Historic Environment Viewer** | Heritage constraints | Inbound (pull) | REST / WMS ([NIAH](https://www.buildingsofireland.ie/)) | NMI buildings are protected structures; pull RPS (Record of Protected Structures) reference and constraint data to pre-populate RAMS heritage-fabric permit precautions and alert when proposed works affect a recorded feature | **P2** | Planning and Development Act 2024; NIAH statutory basis; LPA consent triggers |

---

## 2. New Integrations Not in the Existing Plan

These are concretely absent from `FMIQ-master-build-plan.md §7` and `architecture-adr.md`. Each has a specific implementation route.

**Revenue eTax Clearance — contractor gating (P1)**
Revenue operates an Electronic Tax Clearance Verification Web Service ([spec PDF](https://www.revenue.ie/en/online-services/support/documents/help-guides/etax-clearance/etax-clearance-verification-web-service-spec.pdf)). A contractor's TCAN (Tax Clearance Access Number) is submitted via SOAP; the service returns current status in real time. FMIQ must call this at two points: (a) when a contractor is added to `wo_contractor`, and (b) daily re-check for all active contractors. A non-tax-compliant contractor trips the SSoW Readiness Gate. A public body that pays a non-tax-compliant contractor is in breach of S.I. 463/2012. This is a legal obligation, not a nice-to-have.

**BCMS validation in the Handover Gate (P2)**
The Handover Gate already stores a `bcms_ref` field on `hov_cert`, but currently does no validation. The NBCO BCMS at [nbco.localgov.ie](https://www.nbco.localgov.ie/) does not currently publish a public REST API; the near-term implementation is a webhook/form submission verification step where the BCMS reference and building address are verified against the NBCO public register. When a machine-readable API becomes available (NBCO are building it as part of OGCIO's digitisation programme), upgrade the adapter. In the interim, a mandatory human-verified step with a named verifier + timestamp in `core_audit_log` is sufficient for the gate.

**MyGovID / EUDIW for contractor onboarding (P3, mandatory by end-2026)**
Ireland's Digital Wallet pilot launched Q1 2026 linked to MyGovID ([Biometric Update](https://www.biometricupdate.com/202604/ireland-on-track-for-eudiw-deadline-with-launch-of-digital-wallet-in-2026)). Public-sector acceptance is mandatory by end-2026. FMIQ's contractor portal should accept EUDIW credentials (Safe Pass, trade certs, professional qualifications) via the EUDI Wallet Connector API (OpenID4VP), removing the current manual document-upload path for `hs_competency`. This also auto-populates expiry dates, eliminating the most common source of Readiness Gate blocks.

**Fire alarm panel integration (P1)**
Not currently specified. Addressable fire alarm panels (Hochiki, Advanced Electronics, Ziton — common in Irish public buildings) emit zone-activation and fault events via the panel's serial bus or via the BMS. Map these to `cmp_certificate` maintenance events and to `hs_permit` (hot-works permits adjacent to a fire-panel zone must check panel status). IS 3218:2024 requires a complete electronic service log; auto-ingestion from the panel removes the current manual transcription step that is consistently missed in FM audits.

**Access control / physical security reconciliation (P1)**
NMI already operates an access-control system. FMIQ must consume access-control events (door open/forced/held, badge denied) and reconcile them with `hs_keyloan` and `hs_permit` records. A contractor badging into a plant room without an active permit must generate an immediate alert. Implement via OSDP v2 or the existing access-control vendor's REST webhook (Paxton, Genetec, or Lenel are common in Irish institutions).

**Lift telemetry (P2)**
Collins Barracks has passenger lifts subject to S.I. 299/2007 thorough examination (6-monthly). Lift vendors (Schindler, KONE, Otis) all offer telemetry APIs or BMS integration points. Fault codes from the lift controller auto-create a reactive WO against the `est_asset` lift record and reset the compliance clock. The current plan has no lift-specific integration; this is a statutory compliance gap.

**Met Éireann weather API (P2)**
Met Éireann publishes a free, CC BY 4.0 REST API ([datacatalogue.gov.ie](https://datacatalogue.gov.ie/dataset/met-eireann-weather-forecast-api)) with 10-day forecasts at hourly resolution for a coordinate point. Use cases: (a) incoming high-humidity/cold front → FMIQ pre-conditions HVAC 6h in advance to prevent condensation excursion — the only way to achieve proactive rather than reactive collection-care; (b) storm warnings trigger an automated urgent roof/facade inspection WO for protected structures; (c) seasonal PPM scheduling adjusts for Castlebar's Atlantic exposure. This is P2 but directly tied to the collection-care hero differentiator.

**NIAH / Historic Environment Viewer (P2)**
The National Inventory of Architectural Heritage ([buildingsofireland.ie](https://www.buildingsofireland.ie/)) holds records for all four NMI sites. Pull the RPS reference and any recorded feature descriptions when a building is configured; surface heritage constraint warnings when a WO or RAMS is raised for works on the fabric. This stops a technician unknowingly drilling through a recorded decorative plaster ceiling without a permit.

**Emergency lighting (I.S. 3217) auto-test result ingest (P1)**
I.S. 3217 requires monthly self-test and annual full-discharge test. Addressable emergency lighting systems (Iota, Hochiki, Eaton) log pass/fail per luminaire. FMIQ should pull these results (via BMS relay or vendor API) directly into `cmp_inspection_item`, eliminating the current manual transcription workflow that is the leading cause of statutory compliance record gaps.

**SEAI M&R automated annual export (P2)**
FMIQ's `sus_reading` hypertable already stores energy consumption. Add a scheduled annual report job that formats the required SEAI M&R CSV ([SEAI portal](https://www.seai.ie/plan-your-energy-journey/public-sector/monitoring-and-reporting)) and either pushes it to the SEAI system (when a machine API is available) or generates a verified, downloadable submission pack. NMI's energy manager currently does this manually; eliminating it is a concrete operational saving.

---

## 3. Integration Architecture Recommendation

**Adapter / Anti-Corruption Layer pattern — already in code, extend it**

The `SensorAdapter` interface in `app/packages/api/src/adapters/types.ts` is the right template. Every external system gets an adapter that: (a) parses the vendor payload defensively (Zod schemas, unknown fields dropped not rejected — see `conserv.ts`), (b) maps to FMIQ's canonical internal model, and (c) never leaks vendor-specific concepts into domain logic. Adding a new vendor means a new adapter file, not a change to the engine. Apply this to every category: `TaxClearanceAdapter`, `BcmsAdapter`, `FirePanelAdapter`, `AccessControlAdapter`, `LiftAdapter`, `MetEireannAdapter`.

**Sync vs event-driven by data class**

| Data class | Pattern | Rationale |
|---|---|---|
| Sensor readings (T/RH/lux) | Event-driven push (IoT Hub → Service Bus → domain) | High frequency, latency-sensitive; polling would miss rate-of-change thresholds |
| BMS alarms / fire panel faults | Event-driven (MQTT or webhook) | Must trigger a WO within seconds, not minutes |
| Tax clearance status | Scheduled pull (daily) + on-demand at assignment | Status changes are infrequent; real-time webhook not available from Revenue |
| Calendar sync (M365) | Bidirectional sync on domain event; background reconciliation every 15 min | Graph failures must not block FMIQ bookings |
| CMS object data (Axiell) | Scheduled pull (nightly), delta-only | Low frequency; data minimisation; richer sync requires DPIA |
| ERP PO callback | Inbound async webhook; FMIQ writes back `po_reference` on receipt | ERP is the source of truth for PO; FMIQ is a consumer |
| SEAI / data.gov.ie | Scheduled annual/quarterly export job | Regulatory cadence; not real-time |
| Met Éireann forecast | Scheduled pull (every 6h) | 10-day forecast sufficient for preconditioning logic |

**Information Mediator / X-Road positioning**

FMIQ's OpenAPI 3.1 behind Azure APIM is X-Road-compatible by design — it speaks standard REST over HTTPS with structured headers. To claim full X-Road compatibility, deploy an X-Road Security Server as a sidecar or APIM policy layer. This means: (a) FMIQ services are addressable via the Irish government X-Road namespace, (b) cross-body data exchange (e.g. NMI requesting OPW asset data, or OGP procurement framework queries) traverses the Information Mediator with full audit, and (c) the procurement tender can truthfully state "Build-to-Share compliant." This is a scored criterion in OGCIO framework evaluations and a genuine differentiator that most commercial IWMS vendors cannot claim. Cost of implementation is low — it is primarily a configuration exercise on an already standards-compliant API ([OGCIO digital services](https://www.ogcio.gov.ie/en/corporate-pages/services/digital-services-v2/)).

**Security baseline (NIS2-aligned)**

- mTLS for all service-to-service within the Azure VNET (Container Apps managed certificates)
- HMAC-SHA256 on all outbound webhooks; inbound webhooks verified before processing (replay window: 5 minutes)
- BMS/OT network never routed to the internet; edge gateway is the only egress point, sitting in a VLAN with a deny-by-default firewall rule
- Data minimisation enforced at the adapter layer: the CMS adapter drops all fields except `{object_ref, sensitivity, zone_id}`; the access-control adapter drops biometric data and stores only badge-id + door-id + timestamp
- Secrets in Azure Key Vault via managed identity; no secrets in environment variables or code
- pgaudit → Log Analytics for all DB operations; NIS2 RMM 12 (logging and monitoring) satisfied out of the box with the existing stack
- Separate `fmiq_read` Postgres role for OData/Power BI; no write path from BI tools

---

## 4. The Three Integrations That Most De-Risk or Differentiate the NMI Pilot

**1. Revenue eTax Clearance — contractor gating (P1)**

This is the highest-consequence gap currently missing from the plan. A public body that places a contractor on site without verifying tax clearance is in breach of S.I. 463/2012 — an auditable, named-liability risk. Automating this in the SSoW Readiness Gate turns a manual, easy-to-forget check into a system-enforced, audited gate. It is the single integration that makes FMIQ's H&S/compliance claim legally defensible rather than aspirational. The Revenue web service is well-documented and available today ([Revenue spec](https://www.revenue.ie/en/online-services/support/documents/help-guides/etax-clearance/etax-clearance-verification-web-service-spec.pdf)).

**2. Fire alarm panel + access control → real-time WO and compliance auto-creation (P1)**

Collins Barracks is a complex occupied heritage building with a live fire alarm system and access-controlled stores. Integrating fire alarm fault events with `cmp_certificate` and access-control events with `hs_keyloan`/`hs_permit` turns two currently paper-based processes into automated, evidenced records. In an HSA audit or a BCMS inspection, FMIQ can produce a complete, timestamped fire alarm service history and a full access log for every contractor visit — without manual transcription. No competing IWMS product in the Irish heritage market currently does this out of the box. This is a pilot differentiator and a direct answer to NMI's "proven, deployable" requirement.

**3. Met Éireann weather API → predictive collection-care pre-conditioning (P2)**

The collection-care loop is FMIQ's hero feature, but it is currently reactive: excursion detected → WO raised → action taken. Integrating the Met Éireann 10-day forecast ([Met.ie](https://www.met.ie/about-us/specialised-services/open-data)) allows FMIQ to instruct the BMS to pre-condition a gallery 6–12 hours before an incoming humidity front or cold snap, preventing the excursion from occurring at all. This shifts the value proposition from "we respond faster" to "we prevent damage" — a categorically stronger claim for a national museum with irreplaceable collections, and one that no installed IWMS product in the NMI market is currently making. It is also low-cost to implement (free API, three new fields in the PPM scheduler), delivering outsized differentiation.

---

_Sources used in this document:_
- [Revenue eTax Clearance Web Service Spec](https://www.revenue.ie/en/online-services/support/documents/help-guides/etax-clearance/etax-clearance-verification-web-service-spec.pdf)
- [NBCO BCMS — nbco.localgov.ie](https://www.nbco.localgov.ie/)
- [Ireland EUDIW launch 2026 — Biometric Update](https://www.biometricupdate.com/202604/ireland-on-track-for-eudiw-deadline-with-launch-of-digital-wallet-in-2026)
- [Gov.ie EUDIW FAQ](https://www.gov.ie/en/department-of-public-expenditure-infrastructure-public-service-reform-and-digitalisation/publications/government-digital-wallet-your-questions-answered/)
- [OGCIO Connecting Government 2030](https://www.ogcio.gov.ie/en/publications/connecting-government-2030-a-digital-and-ict-strategy-for-irelands-public-service/)
- [OGCIO Digital Services / Information Mediator](https://www.ogcio.gov.ie/en/corporate-pages/services/digital-services-v2/)
- [Interoperable Europe Portal — Ireland](https://interoperable-europe.ec.europa.eu/collection/iopeu-monitoring/interoperability-initiatives-ireland)
- [SEAI Monitoring & Reporting](https://www.seai.ie/plan-your-energy-journey/public-sector/monitoring-and-reporting)
- [data.gov.ie eTenders dataset](https://data.gov.ie/en_GB/dataset/contract-notices-published-on-etenders)
- [Met Éireann open data](https://www.met.ie/about-us/specialised-services/open-data)
- [Met Éireann API — PSB Data Catalogue](https://datacatalogue.gov.ie/dataset/met-eireann-weather-forecast-api)
- [NCSC NIS2 Ireland](https://www.ncsc.gov.ie/nis2/)
- [IS 3218:2024 — NBS](https://www.thenbs.com/PublicationIndex/documents/details?Pub=NSAI&DocId=343733)
- [BMS API capabilities research — Ptidej](https://blog.ptidej.net/a-study-of-the-capabilities-of-bms-apis-and-the-limitations-of-their-practical-usage/)
- [Axiell Collections](https://www.axiell.com/solutions/product/axiell-collections/)
- [data.gov.ie open data portal](https://data.gov.ie/)
- [NIAH Buildings of Ireland](https://www.buildingsofireland.ie/)
- [SFG20](https://www.sfg20.co.uk/)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
