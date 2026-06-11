# Research Brief 05 — Collection-Care Environmental Module (FMIQ Hero Differentiator)

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

> Scope: standards, hardware landscape, software gap, alerting UX, reporting obligations, and the recommended FMIQ collection-care model. Anchor requirements: NMI PMC ("collection care — micro-management of the physical environments holding collections" is the standout, non-negotiable requirement). Research date: June 2026.

---

## 1. Executive summary

The collection-care environmental module is FMIQ's hero because it sits in a verified market gap: conservation monitoring platforms (Conserv, Hanwell, Eltek) stop at alerts and graphs; IWMS/CAFM platforms (Planon, Archibus/Eptura, TRIRIGA) treat museums as generic facilities. No identified product closes the loop **excursion detection → at-risk object identification → work order → conservator sign-off → loan-ready evidence**. The standards layer is well-defined and machine-encodable (ASHRAE Ch.24 control classes, Bizot 2023, BS EN 16893, BS 4971), the lender-evidence requirement is contractual and recurring (UK Government Indemnity Scheme demands 24/7 monitored conditions; UKRG/AAM facility reports demand actual readings), and the integration path is concrete (T&D's documented public API first, open LoRaWAN ingest second). FMIQ's codebase already implements the core loop (`domain/collectionCare.ts`, `cc_*` schema, gate engine per ADR-002); elevation to hero status is a depth problem — standards-profile library, lux-hour budgets, rolling-deviation detection, conservator sign-off, and a lender report generator — not a greenfield build.

---

## 2. Standards core

### 2.1 PAS 198:2012 — withdrawn, but still cited

[PAS 198:2012](https://knowledge.bsigroup.com/products/specification-for-managing-environmental-conditions-for-cultural-collections) (BSI, March 2012) specified requirements for temperature, RH, light and pollution for cultural collections in storage, display or loan, across archives, libraries and museums. Its lasting contribution is the **risk-based framework**: institutions specify conditions per collection need rather than chasing a universal setpoint, explicitly to enable responsible energy use ([ANSI listing](https://webstore.ansi.org/standards/bsi/pas1982012), [Conservation DistList discussion](https://cool.culturalheritage.org/byform/mailing-lists/cdl/2010/0807.html)).

**Status: withdrawn and replaced by [BS EN 16893:2018](https://museumsandheritage.com/advisor/posts/new-european-collections-standard-deadline-for-comments-approaches/)** (February 2018). Practical implication for FMIQ: tenders and policies in the field still cite PAS 198 (NMI's own PMC vocabulary echoes it), so FMIQ should carry **both** as named, versioned threshold profiles — `PAS198 (withdrawn 2018, superseded by EN 16893)` flagged as legacy.

### 2.2 BS 4971:2017 + BS EN 16893:2018 — the archive/library pair

- [BS 4971:2017 Conservation and care of archive and library collections](https://knowledge.bsigroup.com/products/conservation-and-care-of-archive-and-library-collections) gives recommendations for long-term conservation: policy, strategy, repository management, preventive and remedial treatment. On environment: no single ideal set of conditions exists, but "keep the temperature low and the RH moderate," with **a consistent RH in the range 35–60%** ([Archives & Records Association toolkit](https://www.archives.org.uk/collections-care-toolkit/environmental-management-for-paper-archives), [NCS summary](http://www.ncs.org.uk/blogfull.php?iuklo=rqQ%3D&oihg=qQ%3D%3D)).
- [BS EN 16893:2018](https://www.en-standard.eu/bs-4971-2017-conservation-and-care-of-archive-and-library-collections/) — "Specifications for location, construction and modification of buildings or rooms intended for the storage or use of heritage collections" — is the **buildings** standard. Sector practice is to use both together: 4971 for managing collections, 16893 for assessing and planning the buildings that hold them.

FMIQ implication: the buildings standard maps to FMIQ's estate model (`est_space`), the collections standard to the zone/threshold model (`cc_zone_target`). FMIQ is structurally the only product class that can hold both sides of that pair in one system.

### 2.3 Bizot Green Protocol (2023 refresh) — the expanded bands

The [Bizot Green Protocol, latest refresh September 2023](https://www.cimam.org/documents/238/Bizot_Green_Protocol_-_2023_refresh_-_Sept_2023.pdf) ([overview](https://www.cimam.org/sustainability-and-ecology-museum-practice/bizot-green-protocol/), [adoption handbook](https://www.cimam.org/documents/239/Bizot_Green_Protocol_-_Handbook_1_-_Adopting_the_Bizot_Green_Guidelines.pdf)) specifies, for many classes of hygroscopic objects (canvas paintings, textiles, ethnographic material):

- **Stable RH 40–60%, stable temperature 16–25 °C, fluctuation no more than ±10% RH per 24 hours within that range.**
- More sensitive objects require tighter control **determined by a conservator's evaluation** — the protocol explicitly puts a human professional in the loop.

The figures are pragmatic, not fundamental — wider bands demonstrably do not compromise most collections ([NEMO](https://www.ne-mo.org/news-events/article/new-bizot-green-protocol-prioritises-sustainability-by-recommending-wider-climatic-conditions/)). Adoption is accelerating: the UK [National Museum Directors' Council](https://www.nationalmuseums.org.uk/what-we-do/climate-crisis/environmental-conditions/) endorses it, and in March 2026 the Getty, LACMA, MOCA and the Hammer Museum collectively adopted it ([FAD Magazine](https://fadmagazine.com/2026/03/09/getty-lacma-moca-hammer-museum-and-hauser-wirth-announce-collective-commitment-to-climate-action/)). The NGV's [Adaptive Climate Control Strategy](https://www.ngv.vic.gov.au/explore/collection/collection-environments/adaptive-climate-control-strategy/) shows the operational pattern: widened bands plus micro-change monitoring of vulnerable objects ([Studies in Conservation paper](https://www.tandfonline.com/doi/full/10.1080/00393630.2022.2076779)).

FMIQ implication: Bizot is **the** profile to lead with — it pairs collection safety with energy/carbon reporting (the `sus_bizot_compliance` rollup already in the FMIQ data model: % hours in band × energy kWh). It also defines the canonical **rolling-deviation alert** (±10% RH per 24h), which is a different computation from a static threshold (§5).

### 2.4 ASHRAE Handbook Chapter 24 — the control-class vocabulary

[ASHRAE HVAC Applications, Chapter 24: Museums, Galleries, Archives, and Libraries](https://handbook.ashrae.org/Handbooks/A19/IP/A19_Ch24/A19_Ch24_ip.aspx) ([2019 SI edition PDF](https://cursa.ihmc.us/rid=1Z69MRPBN-2BR4VJP-1DK/ASHRAE-D-A242019SI.pdf)) defines the climate **types of control** the heritage community has standardised on ([Michalski/Getty background paper](https://www.getty.edu/conservation/our_projects/science/climate/paper_michalski.pdf), [CCI climate guidelines overview](https://www.canada.ca/en/conservation-institute/services/preventive-conservation/climate-guidelines/climate-guidelines-overview.html)):

| Class | Risk statement | Short-term fluctuation | Seasonal drift |
|---|---|---|---|
| AA | No risk to most objects | ±5% RH | None |
| A1 | Small risk to highly vulnerable objects | ±5% RH | ±10% RH seasonal |
| A2 | As A1, alternative split | ±10% RH | None |
| B | Moderate risk to highly vulnerable; small risk to most | ±10% RH | Wider, with T ceiling |
| C | Prevent high-risk extremes | Outer limits only (e.g. RH 25–75%) | — |
| D | Prevent dampness | RH < 75% | — |

Classes C and D are defined solely by long-term outer limits ([Reconsidering Museums' Climate, Studies in Conservation 2024](https://www.tandfonline.com/doi/full/10.1080/00393630.2024.2375162); [energy impact study](https://www.sciencedirect.com/science/article/pii/S1876610215018792/pdf?md5=e241b53f6752c1788ced0c64a79c7902&pid=1-s2.0-S1876610215018792-main.pdf); [NIKU comparative review of climate standards](https://museumsforbundet.no/wp-content/uploads/2021/12/PDF-Standards-and-guidelines-for-museum-climate-Joel-Tyler-NIKU.pdf)).

FMIQ implication: the class ladder is the natural UI for threshold profiles — a conservator assigns AA/A1/A2/B/C/D (or Bizot, or a bespoke lender spec) per zone, and FMIQ compiles it into setpoint + band + rolling-fluctuation + seasonal-drift rules. Note each class requires tracking **both** short-term fluctuation and seasonal drift — two different rolling windows.

### 2.5 Light and UV by material class

Damage is cumulative and follows reciprocity (illuminance × time), weighted by the CIE 157 spectral damage function — blue/UV light is disproportionately destructive ([AIC Exhibit Lighting wiki](https://www.conservation-wiki.com/wiki/Exhibit_Lighting), [PMG standards section](https://www.conservation-wiki.com/wiki/PMG_Section_1.4.1_Standards,_Guidelines,_and_Recommendations_for_Light_Levels_During_Exhibition)). Working numbers ([CCAHA guidance](https://ccaha.org/resources/light-exposure-artifacts-exhibition), [Texas Historical Commission table](https://www.thc.texas.gov/public/upload/publications/Light%20Level%20Recommendations%202013.pdf), [Museum Development South West](https://southwestmuseums.org.uk/resources/collections-light-and-uv-radiation/), [Conserv on lux levels](https://conserv.io/blog/light-levels-in-museums-preventive-conservation/)):

| Sensitivity class | Examples | Max illuminance | Annual exposure budget |
|---|---|---|---|
| Highly sensitive | Watercolours, manuscripts, textiles, fugitive dyes, photographs, silk | 50 lux | ~15,000 lux·h (strictest) to 150,000 lux·h |
| Moderately sensitive | Oil/tempera paintings, wood, lacquer, leather | 150–200 lux | ~600,000 lux·h |
| Insensitive | Stone, metal, ceramic, glass | No conservation limit (comfort-led) | — |
| UV (all classes) | — | ≤ 75 µW/lm hard max; ~0–10 µW/lm achievable and now the target with LED | — |

FMIQ implication: the differentiating feature is not a lux threshold — it is the **annual lux-hour budget accumulator** per zone/object class, with projected budget-exhaustion dates. No monitoring platform surfaces this as an operational countdown tied to exhibition planning.

### 2.6 Pollutants

The reference framework is CCI Technical Bulletin 37 ([Control of Pollutants in Museums and Archives](https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/technical-bulletins/pollutants-museums-archives.html), [agent-of-deterioration page](https://www.canada.ca/en/conservation-institute/services/agents-deterioration/pollutants.html)) and Tétreault's preservation-target tables ([IAQ paper](http://iaq.dk/iap/iap1999/1999_05.htm), [evolution of specifications](https://www.researchgate.net/publication/338127728_The_Evolution_of_Specifications_for_Limiting_Pollutants_in_Museums_and_Archives)). Limits scale with the preservation target (1 / 10 / 100 years), e.g. ozone and NO2 from 10 µg/m³ (1-year) down to 0.1 µg/m³ (100-year); acetic acid from 1,000 µg/m³ down to 13 µg/m³. Rule of thumb inside display cases: **any pollutant below ~1 ppb** ([Getty monitoring guide](https://www.getty.edu/conservation/publications_resources/pdf_publications/pdf/monitoring.pdf), [Getty pollutants project](https://www.getty.edu/conservation/our_projects/science/pollutants/), [AIC wiki on case absorbers](https://www.conservation-wiki.com/wiki/Using_Pollutant_Absorbers_Inside_an_Exhibit_Case)). Monitoring is typically passive samplers / periodic surveys rather than continuous sensors ([pollutant monitoring strategies](https://www.diva-portal.org/smash/get/diva2:1324224/FULLTEXT01.pdf)) — model as scheduled inspection tasks with recorded results, not telemetry.

### 2.7 IPM (integrated pest management)

Museum IPM is prevention-first: housekeeping, exclusion, quarantine, and a **systematic trap grid inspected on a fixed cadence**, with species identification and trend analysis to locate hot spots ([AIC/Wikipedia overview](https://en.wikipedia.org/wiki/Museum_integrated_pest_management), [AMNH IPM](https://www.amnh.org/research/science-conservation/preventive-conservation/agents-of-deterioration/integrated-pest-management), [Peabody Harvard](https://peabody.harvard.edu/integrated-pest-management-ipm), [NPS Museum Handbook ch.5](https://www.nps.gov/subjects/museums/upload/MHI_Ch5_BiologicalInfestations.pdf), [review of insect pests in museums](https://pmc.ncbi.nlm.nih.gov/articles/PMC4553500/)). Action thresholds are institution-specific — "the most difficult step is to set the threshold level," varying by building type and collection ([Chicora guidance](https://cool.culturalheritage.org/byorg/chicora/chicpest.html)). MSPI-accredited Irish museums cite trap installation and improved environmental monitoring as accreditation evidence ([Echo Live, Cork museums](https://www.echolive.ie/corknews/arid-41189608.html)).

FMIQ implication: IPM = trap register + scheduled inspection rounds (mobile) + species/count capture + per-species action thresholds that raise work orders. `cc_ipm_trap` / `cc_ipm_observation` already exist in the data model; the elevation is trend heat-maps per space and threshold-triggered WOs.

---

## 3. Hardware / platform landscape and integration targets

| Vendor | Architecture | Parameters | Software | API for FMIQ integration | Museum footprint |
|---|---|---|---|---|---|
| [Hanwell (Ellab)](https://hanwell.com/) | Proprietary radio + GPRS transmitters; 100+ logger types | T, RH, light, UV, dust, pest, air flow, wood movement | Hanwell EMS (supersedes Synergy + Notion Pro); iOS/Android app | **No documented public REST API.** BMS-level integration via MS1000 relay/analog cards; export routes ([Biomap EMS page](https://biomap.co.uk/hanwell-ems-software/), [In Situ overview](https://www.insituconservation.com/en/products/hanwell_wireless_monitoring_control/hanwell_telemetry_introduction)) | Louvre, V&A, National Gallery, IWM, Tate ([supplier listing](https://www.museumsassociation.org/find-a-supplier/supplier-detail/?id=2d87ff2a-1248-ea11-a812-000d3a86a85d)) — the UK/IE heritage incumbent |
| [Conserv](https://conserv.io/) | **LoRaWAN** sensors + gateway (explicitly "open non-proprietary network technology") | T (±0.1 °C), RH (±1%), lux (1–64k), movement, leak, cold-storage | Conserv Cloud: analytics, alerts, IPM features; recalibration in subscription ([data collection page](https://conserv.io/environmental-monitoring-platform/data-collection/)) | **No public developer API documented** (June 2026); integration claims limited to CMS platforms ([Croxel case study](https://www.croxel.com/insights/conserv-success-story)). But LoRaWAN payloads can be captured at network-server level | Growing US museum/archive base ([museums page](https://conserv.io/who-we-serve/museums/)); conservator-led product voice |
| [Eltek](https://www.eltekdataloggers.co.uk/) | GenII licensed radio; 40,000+ transmitters deployed | T, RH, light, UV, CO2, structural | Darca Heritage (site/zone model for conservators; Canterbury Cathedral 70+ zones), Darca Connect cloud ([CAS overview](https://dataloggerinc.com/product/darca-heritage-software/), [Darca Connect](https://eltekdataloggers.co.uk/software_darca_connect.php)) | No public REST API; Darca exports (CSV) and Darca Connect cloud feeds | Strong UK heritage/cathedral/archive base; NHM Singapore ([case](https://www.eltekdataloggers.co.uk/applications_museum_nhm_singapore.php)) |
| [T&D](https://www.micronmeters.com/section/rtr-500-series) | RTR-500/RTR500B base stations (LAN/GSM) + wireless loggers | T, RH (RTR-503/507), light+UV (RTR-574), CO2 (RTR-576) | T&D WebStorage Service (free cloud) | **Documented public REST API** — [WebStorage Service API reference](https://www.webstorage-service.com/docs/api/reference/devices_data_rtr500.html): get data by period/count, rate limits 20 req/min, 160k readings/hr/device | Widely used in museums globally; RTR-574 is a standard gallery light/UV logger |
| [Testo](https://meaco.co.uk/shop/monitoring/wireless-monitoring/saveris/testo-160-the-wifi-datalogger/) | Testo 160 WiFi loggers (160 TH marketed for museums); Saveris line | T, RH, lux, UV variants | Testo Cloud | Cloud with documented API access on paid tiers | Sold into museums in UK/IE via Meaco; MSPI museums installing "new Testo data loggers" ([Echo Live](https://www.echolive.ie/corknews/arid-41189608.html)) |
| [Meaco](https://museumsandheritage.com/advisor/posts/remote-control-environment-english-heritage-meaco-devised-solution-multiple-properties/) | Meaconet wireless; also resells Testo 160 | T, RH, lux, UV | Meaconet over IT network | No public API documented | English Heritage multi-property estate; strong UK/IE heritage channel |
| [Onset HOBO](https://www.onsetcomp.com/blog/modern-monitoring-solutions-for-museum-and-preservation-management) | HOBO loggers + MX gateways | T, RH, light | HOBOlink cloud | HOBOlink has a documented web-services API | Very common in smaller US institutions ([Conserv's logger comparison](https://conserv.io/blog/museum-data-loggers-best-options/)) |

### Integration-first recommendation

1. **T&D WebStorage API** — the only fully documented, public, free REST API in the museum-grade field. Build the first vendor adapter here: poll per device within rate limits, normalise to `cc_reading`.
2. **Open LoRaWAN ingest** — run/point at a LoRaWAN network server (ChirpStack/TTN/Actility) and accept uplinks via MQTT/HTTP webhook. This covers Conserv hardware (their network is explicitly open LoRaWAN) plus the whole generic LoRaWAN T/RH/lux sensor market (e.g. [TEKTELIC museum sensors](https://tektelic.com/projects/protecting-timeless-artifacts-in-museums-lorawan-sensor/)) without needing any vendor's permission. This is the strategic adapter: it makes FMIQ sensor-vendor-neutral.
3. **CSV/file import** (Eltek Darca, Hanwell exports, manual loggers) — unglamorous but essential for migration and for the long tail of institutions with years of historical data. Historical import is also the demo wedge: "bring your last 3 years of Hanwell data and FMIQ will score it against Bizot in an afternoon."
4. **BMS bridge** (BACnet/Modbus, later OPC UA) — for sites where gallery conditions already land in a BMS ([Vaisala on CMS/BMS/OPC UA patterns](https://www.vaisala.com/en/blog/2021-11/faq-continuous-monitoring-systems-building-management-systems-opc-ua-api)). Hanwell's own BMS relay route means FMIQ can often get Hanwell-originated data via the BMS without Hanwell's cooperation.

NMI-specific note: no public evidence identifies NMI's incumbent monitoring vendor; the UK/IE channel reality (Hanwell, Meaco/Testo, Eltek dominate heritage; MSPI museums buying Testo) means FMIQ must assume a **brownfield, multi-vendor estate** and lead with ingest-anything architecture rather than betting on one vendor partnership.

---

## 4. The software gap — wedge validation

### 4.1 Evidence for the gap

- **Monitoring-only side:** Conserv positions as "the first environmental monitoring platform tailor built for conservators" — data collection, analytics, alerts, IPM observations ([platform](https://conserv.io/environmental-monitoring-platform/data-collection/), [blog on standards](https://conserv.io/blog/environmental-monitoring-standards/)). No work-order, maintenance, contractor, or compliance-task functionality is offered or documented anywhere in its product material. Hanwell EMS and Eltek Darca Heritage are likewise visualisation/alarm platforms attached to proprietary hardware. None hold the asset register, the PPM schedule, or the contractor who fixes the AHU.
- **FM-only side:** the major IWMS platforms (TRIRIGA, Planon, Archibus/Eptura, Accruent, Nuvolo) compete on real estate, maintenance, space and sustainability ([market overview](https://oxmaint.com/industries/facility-management/what-is-iwms-integrated-workplace-management-system)); searches across their public material surface **no collection-care module, no conservation standards vocabulary, and no museum-specific environmental management** — museum references are about generic FM or visitor space. Academic/heritage IoT literature similarly treats monitoring and FM as disjoint systems ([modular heritage IoT](https://arxiv.org/pdf/2508.00849), [wireless sensor networks in heritage](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4063051/)).
- **The loop nobody closes:** lenders and indemnity schemes require evidence that excursions were detected **and responded to** (§6). Today that loop runs through a human reading a Hanwell graph, emailing FM, and a paper file for the registrar. No product traverses excursion → named at-risk objects → prioritised work order → conservator-verified closure → loan evidence record.

### 4.2 Honest contradiction check — nearest threats

1. **Generic CMMS + IoT condition triggers.** Modern CMMS (Fiix, Limble, eMaint, eWorkOrders) advertise auto-creating work orders from IoT/condition-monitoring signals via REST APIs and webhooks ([Fiix API guide](https://fiixlabs.github.io/api-documentation/guide.html), [CMMS integration patterns](https://oxmaint.com/article/cmms-api-integration-erp-iot-systems)), and at least one CMMS vendor publishes museum/archive HVAC marketing verticals ([oxmaint museum HVAC monitoring page](https://oxmaint.com/industries/hvac/museum-archive-hvac-monitoring-art-collection-preservation)). **This is the closest contradiction** — but it is plumbing, not product: no conservation standards profiles, no lux-hour budgets, no object linkage, no conservator role, no loan/indemnity reporting. A museum assembling this itself is doing systems integration, which is exactly what NMI's PMC says it does not want.
2. **Hanwell EMS + BMS control.** Hanwell can drive alarm escalation and even actuate via BMS relays — closest to "response" on the hardware side, but the response is HVAC control, not managed work with sign-off and evidence.
3. **Big-IWMS configurability.** Planon/TRIRIGA could be configured into something resembling this for a seven-figure services budget. That is the bespoke-integration anti-pattern the PMC explicitly rejects; it validates rather than threatens the packaged-product wedge.

**Verdict: the wedge holds.** Nothing found in June 2026 ships the closed loop as product. The defensible moat is not the sensor ingest (commoditising) but the conservation semantics: standards-as-data, object linkage, conservator workflow, and indemnity-grade evidence.

---

## 5. Alerting UX

Findings from monitoring practice and alarm-management literature:

- **Two detection modes, not one.** Static thresholds (outside 40–60% RH) and **rolling deviation** (Bizot's ±10% RH per 24h; stricter regimes use ±5%/24h, e.g. [National Archives loan guidelines](https://www.archives.gov/exhibits/borrowing/technical-guidelines.html) require fluctuation limits per 24h). ASHRAE classes additionally need a long-window seasonal-drift computation. A reading can be in-band yet violating — rolling windows are first-class, not an afterthought.
- **Alarm fatigue is the documented failure mode.** Over-tight parameters generate floods of non-critical alerts that desensitise responders ([Ellab, From Fatigue to Focus](https://www.ellab.com/blog/from-fatigue-to-focus-improving-environmental-monitoring-alarms-response/), [Envigilance museum monitoring guide](https://envigilance.com/temperature-monitoring/museum-environmental-monitoring/)). Mitigations that should be product features: persistence windows (breach must hold N minutes), hysteresis on recovery, severity tiers (watch / excursion / critical), daily digest for sub-alert drift, and per-zone quiet tuning with an audit trail of who relaxed what.
- **Escalation chains with acknowledgement timers.** If the primary contact does not acknowledge within a configured window, alert the next person — preventing single points of failure ([Envigilance](https://envigilance.com/temperature-monitoring/museum-environmental-monitoring/)). FMIQ pattern: conservation officer first for collection risk, FM/engineering first for plant causes, with cross-notification — the *routing* depends on excursion type (RH drift in a sealed case is conservation; chilled-water failure is FM).
- **Conservator-in-the-loop is standards-mandated.** Bizot explicitly requires conservator evaluation for sensitive objects; closure of a collection-risk excursion should require conservation sign-off, not an FM "done" click. This maps directly onto FMIQ's existing gate-engine pattern (ADR-002).
- **Incident logging tied to loans.** Under the UK [Government Indemnity Scheme](https://www.gov.uk/guidance/government-indemnity-scheme), conditions must be "monitored and maintained 24 hours a day, 7 days a week throughout the loan period" from arrival to departure, per Annex D of the [GIS guidelines](https://www.artscouncil.org.uk/supporting-arts-museums-and-libraries/supporting-collections-and-cultural-property/government-indemnity/government-indemnity-scheme-guidelines-national-organisations) — RH, temperature, light and UV in the space containing the indemnified object. Every excursion touching a loan zone during a loan window must therefore auto-attach to the loan record as a disclosable incident with its response history. Note GIS environmental requirements were relaxed in 2022 toward Bizot-style bands to ease energy costs ([Museums Association](https://www.museumsassociation.org/museums-journal/news/2022/12/environmental-conditions-for-loans-relaxed-to-help-with-energy-costs/)) — further proof that profiles must be versioned data, since the rules themselves move.

---

## 6. Reporting obligations for NMI-type institutions

1. **Facility reports (incoming-loan prerequisite).** The [UKRG Facilities Report](https://www.ukregistrarsgroup.org/ukrg-facilities-report/) ([form PDF](https://www.ukregistrarsgroup.org/wp-content/uploads/2013/06/UKRG-Facilities-report.pdf), plus display-case and security supplements via [Collections Trust](https://collectionstrust.org.uk/resource/ukrg-documents/)) and the [AAM General Facility Report](https://artsandmuseums.utah.gov/wp-content/uploads/2019/11/3.AAM-General-Facility-Report-2008-2011-1.pdf) are the standard instruments; both demand stated environmental capability and, in practice, **attached recent actual T/RH readings for the display areas concerned** ([National WWII Museum example](https://www.nationalww2museum.org/sites/default/files/2017-07/facility-report.pdf), [Harvard reviewer guidance](https://projects.iq.harvard.edu/exhibitonsandloans/guidelines-reviewing-borrowers-facility-report)). Typical lender specs: T 65–75 °F ±5 °F/24h, RH setpoint 35–50% ±5% with ≤5% fluctuation/24h ([National Archives technical guidelines](https://www.archives.gov/exhibits/borrowing/technical-guidelines.html)).
2. **Indemnity evidence.** UK GIS (administered by [Arts Council England](https://www.artscouncil.org.uk/protecting-cultural-objects/government-indemnity-scheme) for DCMS and devolved governments) requires demonstrated security + environmental control + 24/7 monitoring records (§5). Ireland's equivalent: the [National Cultural Institutions Act 1997](https://www.irishstatutebook.ie/eli/1997/act/11/enacted/en/print) provides for **State indemnities against loss or damage to cultural objects on loan**, and NMI lends under s.11(2) per its [Loans Policy](https://www.museum.ie/en-IE/About/Corporate-Information/Policies-Guidelines/Loans-Policy) — so the same evidence discipline applies on both sides of the Irish Sea.
3. **Loan condition/environment reports.** Per-loan environmental summaries covering the loan window: conditions achieved vs lender specification, every excursion + response + sign-off. Lenders require these as contract conditions ([NMAH sample loan agreement](https://americanhistory.si.edu/sites/default/files/file-uploader/NMAH_Sample_Loan_Agreement.pdf), [NYU exhibition loan policy](https://library.nyu.edu/about/policies/special-collections-external-exhibition-loan-policy/)).
4. **Accreditation evidence.** The Heritage Council's [Museum Standards Programme for Ireland](https://www.heritagecouncil.ie/projects/museum-standards-programme-for-ireland) ([standards & guidelines PDF](https://www.heritagecouncil.ie/content/files/museusms_standards_programme_standards_guidelines_1mb.pdf)) assesses collections care including environmental monitoring and IPM — MSPI accreditation/maintenance is a recurring evidence cycle for every accredited Irish museum, a wider Irish market hook beyond NMI.
5. **Annual environmental summaries** for governance, sustainability and (post-Bizot) energy reporting — % hours in band per zone per year, excursion counts/durations, lux-hour budget consumption, IPM trend summary.

FMIQ implication: every one of these is a deterministic render over data FMIQ already captures. A **report generator with four templates** (UKRG facility-report environmental annexe; GIS/State-indemnity loan evidence pack; per-loan condition report; annual zone summary) converts monitoring exhaust into registrar-grade deliverables — the feature that makes registrars, not just conservators, champions.

---

## 7. Recommended FMIQ collection-care model

### 7.1 What already exists (per FMIQ docs — do not rebuild)

Per [`app/README.md`](../../app/README.md), [`docs/data-model.md`](../data-model.md), [`docs/adr-002-gate-engine.md`](../adr-002-gate-engine.md) and [`docs/CAFM-COVERAGE.md`](../CAFM-COVERAGE.md), the loop is **functional in code**: `POST /api/v1/ingest/readings` → `domain/collectionCare.ts` evaluates absolute and rate-of-change breaches → opens `cc_excursion` → queries `cc_object_link` to name at-risk objects → raises `wo_work_order` (source `excursion`) with conservation notes → alerts Conservation Officer + FM. Schema: `cc_case`, `cc_zone`, `cc_standard` (codes PAS198 / BS4971 / ASHRAE_AA..D / BIZOT_2023), `cc_zone_target`, `cc_sensor` (vendor enum conserv/hanwell/tandd/hobo/bms), `cc_reading` (TimescaleDB hypertable + hourly continuous aggregate), `cc_loan` (with `lender_spec` jsonb), `cc_ipm_trap`/`cc_ipm_observation`, `sus_bizot_compliance`. Gate engine (ADR-002) blocks WO progress without prerequisites. Hard pilot targets already set: excursion→WO < 60 s; loan report < 5 min ([PROJECT-PLAN](../PROJECT-PLAN.md)). Data minimisation is right: object catalogue stays in the CMS (Axiell/TMS), FMIQ holds links + sensitivity only.

### 7.2 What elevates it to hero status

1. **Standards as versioned data, not enum codes.** Extend `cc_standard` into a profile library: each profile = setpoints, bands, short-term fluctuation rule (window + magnitude), seasonal-drift rule, lux/UV limits, lux-hour budget, effective-date/version (GIS 2022 relaxation and Bizot 2023 prove the rules move). Add `LENDER_SPEC` profiles compiled from `cc_loan.lender_spec` so a loan can tighten a zone for its window and auto-revert.
2. **Three-window detection engine.** Today: absolute + rate-of-change. Add: (a) rolling 24h fluctuation (Bizot ±10%, lender ±5%), (b) seasonal-drift tracking for ASHRAE A1/B, (c) dew-point/condensation-risk derivation for historic fabric (directly relevant to Collins Barracks and the Dead Zoo). Pure-function engine, same discipline as GovIQ's engines.
3. **Lux-hour budget accumulator.** Per zone (and per linked object class): cumulative lux·h this exhibition year vs budget, projected exhaustion date, "rotate object" advisory work orders. No competitor surfaces this operationally — it is the single most conservator-delighting feature available.
4. **Watch tier + alarm-fatigue controls.** A proximity-style pre-alert band (e.g. 80% of any limit — mirroring GovIQ's Proximity Engine zones), persistence windows, recovery hysteresis, severity tiers, ack-timer escalation chains, and per-zone tuning with audit trail. RAG semantics already defined in the design system.
5. **Conservator sign-off as a gate.** Excursion-sourced WOs cannot close without ConservationOfficer role sign-off recording condition-check outcome (objects inspected / damage noted / no action). This is the "loop closed" claim made enforceable — and it reuses the ADR-002 gate engine verbatim.
6. **Loan evidence generator.** On any `cc_loan`: one-click pack = conditions achieved vs `lender_spec`, full excursion + response + sign-off history for the loan window, monitoring coverage statement (sensor uptime — GIS's 24/7 requirement means **gaps in data are themselves reportable incidents**), rendered to the four report templates in §6. Target stays < 5 min.
7. **Multi-vendor ingest adapters** in the §3 order: T&D WebStorage API → open LoRaWAN webhook (ChirpStack/TTN) → CSV historical import (Eltek/Hanwell) → BMS bridge. Sensor-vendor neutrality is the procurement-friendly answer NMI's PMC implicitly asks for ("integration with technical building/environmental (BMS/IoT) systems").
8. **IPM trend layer.** Inspection rounds as scheduled mobile tasks; species/count trends per space; per-species action thresholds raising WOs; MSPI-ready IPM summary in the annual report.
9. **Bizot energy co-benefit reporting.** `sus_bizot_compliance` rendered as: % hours in Bizot band, excursions avoided, estimated kWh/carbon saved by band-widening — connecting collection care to the sustainability scope area of the PMC and to the sector's loudest current conversation.

### 7.3 Positioning sentence

FMIQ is the only platform where the sensor that detects the excursion, the standard that defines it, the work order that fixes it, the conservator who signs it off, and the report the lender demands are one system of record.

---

**END — v0.1 — 2026-06-11**
