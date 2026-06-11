# Asset Register Onboarding & Import — UX Research Brief

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

**Scope:** Defines the gold standard for asset register onboarding/import in FMIQ (IWMS for Irish public-sector and heritage estates). Covers: best-in-class spreadsheet-import UX, current CMMS/IWMS import practice and pain points, relevant asset data standards (COBie, Uniclass, NRM, SFG20, NHS/HSE estates conventions), hierarchy and criticality models, AI-assisted import, and the recommended FMIQ end-to-end import flow with edge cases and acceptance criteria.

**Why this matters:** Asset register import is the first material interaction a new FM client has with FMIQ — and the highest-risk one. Industry analysis attributes the majority of CMMS implementation failures to bad data, not bad software ([Tractian](https://tractian.com/en/blog/why-cmms-implementations-fail-how-to-prevent-it)); one documented university case imported 14,000 assets of which 3,200 were duplicates ([MaintainNow](https://www.maintainnow.app/blog/avoiding-cmms-buyers-remorse-lessons-from-failed-implementations-1760127292893)). A best-in-class importer is therefore both an activation feature and a competitive wedge against incumbent CAFM tools whose import remains template-and-pray.

---

## Revision history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-06-11 | Initial research brief. |

---

## 1. Best-in-class spreadsheet-import UX

### 1.1 Flatfile

The reference implementation for embedded data onboarding. Key mechanics:

- **ML-driven auto-mapping.** Trained on billions of historical mapping decisions; claims >90 percent of column matches predicted correctly, with fuzzy header matching as the fallback ([Flatfile mapping product](https://flatfile.com/product/mapping/), [Flatfile Portal](https://flatfile.com/platform/portal/)). The Automap plugin lets developers set a confidence threshold above which mapping is fully automatic, with everything else dropping to human review ([Automap docs](https://flatfile.com/docs/plugins/automap)).
- **Human-in-the-loop ordering.** File parse and header matching happen first; the user is only asked to intervene on the residual unmatched columns. Mapping decisions are persisted as they are made, so an interrupted session loses nothing ([Flatfile import overview](https://support.flatfile.com/articles/7763163677-importing-data-with-flatfile-overview)).
- **Real-time preview.** Mapped data is shown as it will land (up to ~1,000 records) before commit, so format problems surface visually rather than as post-hoc errors ([Flatfile blog](https://flatfile.com/blog/optimizing-csv-import-experiences-flatfile-portal/)).
- **Workbooks + AI suggestions (2025).** "Analyze and Suggestions" proactively recommends fixes for validation errors inside a collaborative spreadsheet workspace; natural-language transforms ("split this column into building and room") are applied with preview ([Flatfile MCP analysis](https://skywork.ai/skypage/en/unlocking-ai-potentials-flatfile-mcp-server/1977602108810129408), [Flatfile AI Transform](https://www.linkedin.com/posts/flatfile_introducing-ai-transform-activity-7212490542125891584-1Dx7)).

### 1.2 OneSchema

The most instructive single source is their own feature taxonomy, ["10 Advanced CSV Import Features You (Probably) Won't Launch Yourself"](https://www.oneschema.co/blog/advanced-csv-import-features):

- **Validation + autofix library.** 50+ no-code validations; automatic conversion between date/number/phone/country formats; infers ambiguous formats (MM/DD vs DD/MM) from the column as a whole, not cell by cell.
- **Advanced parsing.** BOM/encoding detection (UTF-8/UTF-16), legacy .xls vs .xlsx strategies, jagged rows, empty rows/columns, non-comma delimiters, commas and newlines inside cells, and — critically — **automatic detection of the most likely header row** when junk rows sit above it.
- **In-line error resolution.** Their stated #1 gap in home-rolled importers. Filtered views of error rows, fix-in-grid editing, bulk find-and-replace, undo (Ctrl+Z), automated format fixes, delete-rows-with-errors. They report a **50 percent+ increase in completed activations** after adding the error-resolution step.
- **Exportable annotated Excel error summaries** — the file goes back to a colleague with highlights and comments explaining each failure, supporting the real-world workflow where the person importing is not the person who owns the data.
- **Errors vs warnings.** Hard errors block; warnings import with a flag. Treating everything as a blocker kills completion rates.
- **Upload report dashboard + undo.** Support teams can see historical imports, download the original file, and diff it against what landed; import "undo" is an explicit ask from customers when bad data gets through.
- **Intelligent mapping** trained on prior mappings, plus column descriptions and sample data surfaced inside the mapping UI, and split/merge of columns during mapping ([OneSchema importer](https://www.oneschema.co/embeddable-importer)).
- **Self-validating Excel templates** generated from the target schema, so validation rules travel into Excel itself.

### 1.3 CSVBox

A lighter-weight widget but with patterns worth noting: per-row errors surfaced **before data leaves the widget**, submission blocked until rows are corrected; AI auto-matches columns with one-click confirm; large files streamed rather than loaded into the tab; downloadable template generation ([CSVBox features](https://csvbox.io/features/), [template downloads](https://blog.csvbox.io/spreadsheet-template-download/), [required fields](https://blog.csvbox.io/required-fields-import/)).

### 1.4 Airtable, Notion, Monday

Prosumer tools show the **merge/upsert** pattern and its failure modes:

- Airtable's CSV Import extension supports field mapping plus an explicit **merge-on-field** toggle: pick a unique key (ID, email) and incoming rows update matching records instead of duplicating. Limitation: when the file itself contains duplicate key values, only the first row is used and the rest are silently ignored — a known complaint thread ([Airtable CSV import](https://support.airtable.com/csv-import-extension), [community thread](https://community.airtable.com/base-design-9/import-csv-duplicates-insert-28587)). Dedupe of already-imported data is a separate extension that finds duplicates and lets users merge field-by-field ([Dedupe extension](https://support.airtable.com/docs/dedupe-extension)).
- Notion offers "merge with CSV" on a database — same upsert idea, less control ([XRAY migration guide](https://www.xray.tech/post/migrating-notion-airtable-linked-records)).
- Practitioner guidance for these tools is consistent: create select/option values **before** import, then map, then verify record counts; the recurring breakages are casing differences, duplicate keys, spelled-out vs coded enumerations, and inconsistent phone/date formats ([DEV community guide](https://dev.to/xxbricksquadxx/mapping-csv-airtable-or-notion-without-tears-template-inside-2lnd)).

### 1.5 Cross-cutting UX pattern library

From the import-UX literature ([ImportCSV](https://www.importcsv.com/blog/data-import-ux), [Smashing Magazine](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/), [Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/bulk-ux/), [Dromo best practices](https://dromo.io/blog/5-best-practices-to-streamline-your-csv-import-process), [universal import wizard walkthrough](https://www.c-sharpcorner.com/article/building-a-universal-data-import-wizard-mapping-columns-preview-validation/)):

1. Canonical flow: **upload → parse → map → validate/fix → preview → commit → report**, presented as a stepper with progress persisted between steps.
2. Drag-and-drop zone plus file picker, with accepted formats and a downloadable template visible before upload.
3. Auto-mapping must be **legible**: show what was matched, how (exact / fuzzy / AI / remembered), and let the user override. Never silently map.
4. Errors are fixed **in the grid**, not by exporting, editing in Excel, and re-uploading (Excel round-trips reformat data and create new errors).
5. Provide an error-file export (annotated Excel) for the collaboration case anyway.
6. Post-import: tag imported records with a batch/source so "new" data is distinguishable from "old", and show a result report (created / updated / skipped / failed with reasons).

---

## 2. How CMMS/IWMS products import assets today — and where users hurt

### 2.1 Current practice

- **MaintainX** has the most modern flow of the mid-market CMMS set: built-in importer for CSV/XLS/XLSX, column-to-field matching assistance, preview before import, hierarchy via a `Parent Asset` column (parent resolved by exact name), auto-creation of referenced entities (locations, asset types, teams, vendors) when names do not match existing records, criticality restricted to an enum (Normal/Important/Critical), and a documented **Undo a Data Import Session** capability. Hard limits: 1,000 rows per file; errors **cannot be fixed in the upload summary** — the user must fix the file and re-import; invalid rows are skipped or invalid cells silently removed with a warning ([MaintainX asset imports](https://help.getmaintainx.com/import-asset-data), [import overview](https://help.getmaintainx.com/import-organization-data), [undo import](https://help.getmaintainx.com/undo-a-data-import-session)).
- **Limble**: template-driven. Users must configure custom fields first, download a sample CSV, populate it exactly, then import from the Manage Assets page. Misspelled field names silently create new custom fields — a documented foot-gun ([Limble bulk import](https://help.limblecmms.com/en/articles/2971814-how-to-bulk-import-assets-from-excel), [tips and tricks](https://help.limblecmms.com/en/articles/3751163-importing-assets-tips-tricks)).
- **Fiix**: CSV with strict conventions. Hierarchy is encoded by setting a child's Location Code equal to the parent's Asset Code; facilities must be imported before assets; visual indentation in the spreadsheet must be removed before import ([Fiix hierarchy import](https://helpdesk.fiixsoftware.com/hc/en-us/articles/211460246-Import-asset-child-and-grandchild-assets), [bulk import](https://helpdesk.fiixsoftware.com/hc/en-us/articles/212767823-Import-your-assets), [data import overview](https://helpdesk.fiixsoftware.com/hc/en-us/articles/212108226-Data-import-overview)).
- **Planon / MRI Evolution (Concept Evolution)**: enterprise CAFM import remains a consultant-led data-migration exercise with templates and middleware rather than a self-serve product surface; third-party mobile capture tools (Mobiess, PocketSurvey) exist specifically to feed asset data into these systems ([Mobiess](https://www.mobiess.com/cafm-system-mobile-integration/), [PocketSurvey](https://www.pocketsurvey.com/surveyors-apps/cafm-asset-collection/index.htm), [MRI Evolution](https://www.fsifm.com/en-ca/concept-evolution)). This is the gap FMIQ should attack: self-serve, audit-grade import that enterprise CAFM makes a services engagement.

### 2.2 Where users complain

Recurring themes across implementation post-mortems and reviews ([MaintainNow](https://www.maintainnow.app/blog/avoiding-cmms-buyers-remorse-lessons-from-failed-implementations-1760127292893), [Tractian](https://tractian.com/en/blog/why-cmms-implementations-fail-how-to-prevent-it), [MPulse](https://mpulsesoftware.com/blog/cmms/implementation-success-blueprint/), [FTMaintenance](https://ftmaintenance.com/cmms/cmms-data-quality/), [Capterra Limble reviews](https://www.capterra.com/p/162600/Limble-CMMS/reviews/), [Capterra UpKeep reviews](https://www.capterra.com/p/145635/UpKeep/reviews/), [Limble vs UpKeep](https://reliamag.com/guides/limble-vs-upkeep/)):

1. **"We can import your spreadsheets" oversold.** Migration of messy legacy data is consistently underestimated; converting a large asset list is called out as time-consuming in reviews of both Limble and UpKeep.
2. **Duplicates and unverified assets imported wholesale** — no dedupe gate at import time; cleanup happens painfully after go-live.
3. **Fix-the-file-and-re-upload loops.** Errors reported only in a summary, not fixable in place (MaintainX explicitly; Limble and Fiix implicitly), forcing Excel round-trips.
4. **Silent side effects.** Auto-creation of locations/types/vendors on name mismatch, or new custom fields from typos, pollutes the taxonomy invisibly.
5. **Strict template conventions** (Fiix's parent-by-location-code, no indentation, import order constraints) push the data-shaping burden onto the user.
6. **Too much data imported on day one** — every asset and all history loaded before launch, leaving technicians unable to find anything and trusting nothing; 90 percent of imported historical records are never referenced again ([Oxmaint](https://www.oxmaint.com/blog/post/blog-post-cmms-implementation-guide-step-by-step)).

**Design implication for FMIQ:** the importer must (a) fix errors in the grid, (b) gate duplicates before commit, (c) make every side effect (new location, new type) explicit and confirmable, (d) accept the user's spreadsheet shape rather than demanding a template, and (e) encourage staged imports (critical assets first) rather than big-bang loads.

---

## 3. Asset data standards relevant to Irish/UK public estates

### 3.1 The handover stack

- **COBie** (Construction Operations Building Information Exchange) — non-proprietary spreadsheet format for handing over asset data from construction/BIM to FM. UK National Annex to BS EN ISO 19650-2 requires non-geometric information exchanges in open data formats to be structured to COBie ([NBS — What is COBie](https://www.thenbs.com/knowledge/what-is-cobie)). The relevant worksheets for an asset register are **Facility, Floor, Space, Zone, Type, Component, System, Spare, Resource, Job, Attribute** — Component rows reference Type and Space, giving the hierarchy implicitly. CAFM tools (e.g. Dalux, EDocuments) already import/export COBie workbooks ([Dalux COBie import](https://support.dalux.com/hc/en-us/articles/5104845990300-How-to-import-and-export-COBie-and-Handover), [EDocuments BIM and COBie](https://www.edocuments.co.uk/platform/bim-and-cobie/), [Scottish Futures Trust AIM transfer](https://bimportal.scottishfuturestrust.org.uk/level2/stage/6/task/17/data-transfer-to-asset-information-model)).
- **Uniclass 2015** — the UK classification suite (tables for Entities, Spaces, Systems, Products). NRM codes have been incorporated into Uniclass tables, and NBS maintains mappings/translations between schemes ([NBS Uniclass update](https://www.thenbs.com/knowledge/uniclass-2015-an-update), [NBS mappings](https://www.thenbs.com/our-tools/uniclass/mappings-translations)).
- **NRM 1/3 (RICS)** — cost-management classification; NRM 3 covers maintain-and-renew works and has been mapped to Uniclass and aligned with SFG20 schedules ([RICS NRM 3 logic and level tables 2026](https://www.rics.org/content/dam/ricsglobal/documents/standards/RICS-NRM-3-Logic-and-Level-Table-2026_Explanatory-Notes.pdf)).
- **SFG20** — the UK standard library of planned-maintenance task schedules, keyed by asset classification code. SFG20's maintainable-asset register guidance defines core columns: asset classification code + description, **criticality (Red/Pink/Amber/Green)**, unit of measure aligned to NRM 3, plus optional location, condition, manufacturer, serial, make, model, warranty ([SFG20 standards](https://img1.wsimg.com/blobby/go/8fc62093-f93e-447d-8e21-b1e235f4d9cc/downloads/sfg20_standards_free_download.pdf), [SFG20 asset mapping](https://www.sfg20.co.uk/products/asset-mapping/)).
- The four schemes coexist: a good handover register carries COBie structure with Uniclass/NRM/SFG20 codes as attributes — analysed well in [Asset Data handover: COBie vs SFG20 vs NRM vs CAFM schemas](https://www.linkedin.com/pulse/asset-data-handover-cobie-vs-sfg20-nrm-cafm-schemas-gonz%C3%A1lez-jones).

**FMIQ implication:** ship a **COBie ingest profile** (recognise the workbook by its sheet names and load Facility/Floor/Space/Type/Component/System directly) and treat Uniclass/SFG20 codes as first-class mappable fields. This is a genuine differentiator for public-sector procurement responses, including NMI — UK/Irish public clients increasingly mandate COBie handover.

### 3.2 NHS/HSE estates conventions

- **NHS six-facet survey** — the established UK methodology for estate condition: physical condition (fabric, mechanical, electrical), functional suitability, space utilisation, quality, statutory compliance, environmental management ([NHS England risk-based backlog methodology](https://www.england.nhs.uk/publication/a-risk-based-methodology-for-establishing-and-managing-backlog/), [Bellrock six-facet surveys](https://www.bellrock.co.uk/services/building-assets/six-facet-surveys), [RLB six-facet guide](https://www.rlb.com/wp-content/uploads/sites/6/2021/05/six-facet-survey-2021.pdf)).
- **Condition grades A-D (+X)**: A = as new / complies with statutory requirements; B = sound but action will be required; C = known contravention / major repair needed; D = dangerously below standard; X supplementary to C/D meaning only rebuild or relocation will suffice ([gov.uk backlog costing](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/148143/Backlog_costing.pdf), [NHS Scotland estates asset management SHTN 00-01](https://www.nss.nhs.scot/media/5435/shtn-00-01-v6-february-2021-aug-2024-archived.pdf)). Backlog cost is then risk-adjusted per element.
- **HSE (Ireland) Estates** manages roughly 4,440 buildings across 2,626 sites and has commissioned area-measurement/as-built surveys across ~645 locations targeting Gross Internal Area per property — i.e. the Irish estate baseline is *survey spreadsheets*, not structured registers ([HSE HBS Estates](https://www.hse.ie/eng/about/who/healthbusinessservices/estates/), [ORS HSE Estates project](https://ors.ie/project/hse-estates-primary-care-centre/)).
- **OPW** operates the State's Property Mapping Register Viewer for sharing property data across the public service under Circular 11/15 — property-level, not asset-level ([OPW PMRV](https://maps.opw.ie/property/), [PMRV user guide](https://maps.opw.ie/uploads/data/2019/01/11/PMRV_User_Guide_-_April2018.pdf)).

### 3.3 What the messy real-world register actually looks like

Synthesised from the survey/handover ecosystem above and CMMS implementation literature, the typical Irish/UK public-estate asset spreadsheet FMIQ will receive is:

- One workbook, **one sheet per building or per discipline** (Mechanical / Electrical / Fabric / Lifts), often produced by a surveying firm or lift/boiler contractor.
- Two or three **junk rows above the header** (logo, survey title, date), and sometimes a second header row of units.
- Typical columns: `Site`, `Block/Building`, `Floor/Level`, `Room No`, `Room Name`, `Asset Description`, `Asset Type`, `Qty`, `Manufacturer`, `Model`, `Serial No`, `Install Date / Age`, `Condition (A-D or 1-5)`, `Remaining Life`, `Replacement Cost`, `Comments`. Frequently also a contractor barcode/tag column and an SFG20 or in-house classification code.
- **Hierarchy expressed by merged cells or blanks**: the Site/Building/Floor cells filled only on the first row of a group, blank (or merged) beneath — the carry-down problem.
- **Quantity rows** ("Smoke detectors, Qty 46") representing 46 child assets in one row.
- Mixed units (kW vs kVA, litres vs m3), dates as text and as Excel serials, "N/A"/"TBC"/"-" sentinels, duplicated serials, trailing whitespace, inconsistent naming of the same plantroom across sheets.
- Condition and criticality in **local vocabularies** (A-D, 1-5, Good/Fair/Poor, Red/Amber/Green) requiring value mapping, not just column mapping.

The importer must treat this artefact — not a clean CSV — as the design target.

---

## 4. Asset hierarchy and criticality models

### 4.1 Hierarchy

- Practical consensus: **3-6 levels**; a useful default is Site → Facility/Building → System → Asset → Component. ISO 14224 defines a reference taxonomy of up to nine levels but few organisations need it ([Fabrico ISO 14224 hierarchy guide](https://www.fabrico.io/blog/asset-hierarchy-naming-convention-guide/), [Tractian asset hierarchy](https://tractian.com/en/glossary/asset-hierarchy), [Fiix hierarchy setup](https://fiixsoftware.com/blog/how-to-set-up-asset-hierarchy-for-maintenance/), [SMRP paper](https://smrp.org/Portals/0/2019%20Phoenix%20Track%20Materials/Track%202/Asset%20Hierarchy/Asset%20Hierarchy/Presenter%20Paper,%20KOVACEVIC.pdf)).
- Each child has exactly one parent; the parent/child chain is what distinguishes a register from a flat list ([MaintainX hierarchy explainer](https://www.getmaintainx.com/blog/asset-hierarchy)).
- **Two orthogonal hierarchies matter in estates**: the *location* hierarchy (site > building > floor > space) and the *system* hierarchy (e.g. LTHW heating system > boiler > burner). COBie models this with Space (location) and System (functional grouping) referencing the same Component. FMIQ should store location as a structured path and system membership as a separate association — never conflate them into one tree.
- FMIQ levels: **Estate/Portfolio → Site → Building/Block → Floor/Level → Space/Room → System → Asset → Component**, with levels optional (an asset may attach directly to a building).

### 4.2 Criticality

- Standard model: **Criticality = Probability of Failure x Consequence of Failure**, each 1-5, evaluated across safety, operations, environment, quality, cost; output banded into tiers or classes A-D ([Redlist ACR](https://www.getredlist.com/dictionary/asset-criticality-ranking-acr/), [Reliable Plant criticality analysis](https://www.reliableplant.com/criticality-analysis-31830), [eMaint ACA](https://www.emaint.com/rank-assets-by-criticalness-for-a-more-effective-aca/)).
- **SFG20 uses Red/Pink/Amber/Green** task criticality (Red = statutory) — directly relevant since SFG20 codes will appear in inbound registers.
- Simpler CMMS enums (MaintainX: Normal/Important/Critical) show the floor; FMIQ should store a normalised internal scale and map inbound vocabularies onto it at import.

### 4.3 Condition and lifecycle fields

- Condition: **NHS A-D (+X)** grades (Section 3.2) as the public-estate default, with import-time value mapping from 1-5 or Good/Fair/Poor scales.
- Lifecycle/cost fields a public-estate register needs: install date, expected life, **remaining life**, condition grade + survey date, **replacement cost** (NRM-aligned), backlog cost, warranty expiry. These drive the backlog-maintenance and capital-planning analytics that differentiate an IWMS from a work-order tool.

---

## 5. AI-assisted import — what works

- **Flatfile**: AI mapping trained on 5B+ mapping decisions; AI Transform applies natural-language data transformations with preview; "Analyze and Suggestions" (2025) proactively proposes fixes for validation errors ([Flatfile mapping](https://flatfile.com/product/mapping/), [Flatfile AI Transform](https://www.linkedin.com/posts/flatfile_introducing-ai-transform-activity-7212490542125891584-1Dx7)).
- **OneSchema**: pivoted to "AI agents for data operations"; FileFeeds Template Agent generates template-building code from sample data and natural-language rules ([OneSchema](https://www.oneschema.co/), [changelog](https://www.oneschema.co/changelog)).
- **CSVBox**: AI auto-matching with one-click human confirm ([CSVBox](https://csvbox.io/)).
- Research consensus: LLMs are effective at **schema/column mapping suggestion** (metadata-scale, human-reviewed — weeks to days) and at proposing cleansing rules from samples; the reliable pattern is *LLM generates deterministic mapping/transform rules, rules execute deterministically, human approves* — not LLM-per-row transformation ([ACM workshop on LLM schema mapping](https://dl.acm.org/doi/10.1145/3737412.3743490), [AI-assisted JSON schema mapping](https://arxiv.org/pdf/2508.05192), [survey of LLM data preparation](https://arxiv.org/pdf/2601.17058), [DZone LLMs in ETL](https://dzone.com/articles/llms-in-data-engineering-gen-ai-changing-etl-analytics)).

**What works (adopt):** AI for column mapping with per-column confidence; AI for value mapping (local condition/criticality vocabularies onto FMIQ enums); AI for **asset classification** (free-text "AHU 3 supply fan" onto SFG20/Uniclass type) with confidence and review queue; AI-generated deterministic transform rules with preview.
**What does not work (avoid):** unreviewed AI writes to the register; per-row generative transformation (cost, latency, non-determinism); AI inventing classifications for low-confidence rows instead of routing them to a human. For a public-sector audit posture, every AI suggestion must be confirmable, logged, and reproducible.

---

## 6. Recommended FMIQ import flow — end to end

A persistent, resumable **Import Session** wizard. Each stage saves state; nothing touches the live register until Commit. Personas: FM admin (primary), surveying contractor (data author), FMIQ onboarding support (observer via session link).

### Stage 0 — Entry
- Drag-and-drop + file picker. Accept .xlsx, .xls, .csv, .tsv (50 MB / 50,000 rows v1 ceiling — far above MaintainX's 1,000).
- Offer: downloadable self-validating Excel template, COBie workbook profile, and "or just upload what you have" as the headline path.
- Choose target: create new assets only / update existing (upsert) / full sync preview (flag missing assets for review — never auto-archive).

### Stage 1 — Parse and sheet detection
- Robust parse: encoding/BOM detection, delimiter sniffing, legacy .xls.
- **Multi-sheet workbooks:** classify each sheet (data / lookup / notes / chart) by shape heuristics; let the user tick which sheets to import and declare whether sheets are "same schema, split by building" (union them, capturing sheet name as a mappable virtual column — it is usually the building) or distinct entity types.
- **Header detection:** auto-identify the most likely header row per sheet (skip title/logo rows); detect two-row headers (name + units) and merge; user can override the detected header row visually.
- **Merged cells and carry-down:** unmerge and forward-fill hierarchical columns (Site/Building/Floor) automatically, but show the fill as ghosted values the user confirms once per column ("Blank cells in 'Building' filled from the row above — correct?").
- Blank rows/columns and repeated page-break header rows dropped, with a count shown.

### Stage 2 — Auto-map with confidence
- Map source columns to the FMIQ asset schema using layered matching: exact header > remembered mapping (this org, then this source-system fingerprint) > fuzzy/synonym match > AI suggestion from header + sampled values.
- Each mapping displays a **confidence badge and provenance** (exact / remembered / AI). High-confidence mappings pre-accepted; low-confidence and unmapped columns surface at the top of the review list.
- Per-column: target field, sample values (first 5 distinct), required-field indicators, split/merge tools (e.g. "Location" → building + room; "Make & Model" split), and "import as custom attribute" / "ignore" options. Creating a custom attribute is an explicit, confirmed action — never a typo side effect.
- **Value mapping sub-step** for enum targets: distinct source values listed against FMIQ values (condition 1-5 → A-D, criticality RAG → tiers), AI-prefilled, user-confirmed. Unmapped values become row warnings, not silent nulls.
- Required-field gate: cannot proceed without mappings for Asset Name/Description and a location anchor (site or building); everything else optional.

### Stage 3 — Validate and fix in grid
- Full validation pass: types, dates (column-level format inference), units (normalise kW/kVA, m2; record the conversion), enum membership, parent references, classification codes (SFG20/Uniclass format checks), serial format, value ranges (install date not in future, replacement cost non-negative).
- **Errors block; warnings do not.** Errors: missing required field, unresolvable parent, duplicate key within file. Warnings: missing serial, unmapped condition value, suspicious date.
- Grid behaviours (the OneSchema error-resolution set): filter to error rows, error-cells highlighted with plain-English messages, fix in place, bulk find-and-replace scoped to a column, autofix suggestions applied per-column with preview ("Convert 37 dates from DD/MM/YYYY"), delete/exclude rows, undo stack.
- **Annotated Excel export** of error rows for the contractor-collaboration case; re-upload of the corrected file merges back into the same session.
- Quantity rows: a `Qty` column > 1 offers explode-to-N-assets (suffix numbering) or import-as-single-asset-with-quantity, chosen per asset type.

### Stage 4 — Hierarchy resolution
- Build the location tree from mapped Site/Building/Floor/Space columns; build asset parent/child from Parent Asset reference where present.
- **Entity matching against the existing register:** fuzzy-match inbound sites/buildings/spaces to existing ones; show "will link to existing" vs "will create new" explicitly, with a confirm list of every new location/type to be created. No silent taxonomy creation (the Limble/MaintainX failure).
- Detect cycles, self-parenting, depth violations, orphan parents; resolve in a tree preview pane.

### Stage 5 — Dedupe review
- Match inbound rows against existing assets (and within-file) on layered keys: asset tag/barcode > serial + model > name + space. Configurable strict/loose threshold.
- For each duplicate group: side-by-side compare with per-field choice — **Skip / Update existing (field-level merge) / Create anyway** — plus bulk actions ("skip all exact duplicates", "update all where only condition changed"). Within-file duplicate keys are surfaced explicitly, never first-row-wins-silently (the Airtable failure).

### Stage 6 — Dry-run summary
- No-write simulation rendering: N created, M updated (with field-level change counts), K skipped, J warnings; new locations/types/attributes to be created; hierarchy tree preview; value-mapping recap; estimated register size after commit.
- Downloadable dry-run report (Excel) for sign-off — public-sector clients will want a record that someone approved the load.

### Stage 7 — Commit, audit, undo
- Transactional batch commit with progress; partial failure rolls back the batch (no half-imported registers).
- Every created/updated record stamped with `importSessionId`, source filename, source row number, and actor; every AI suggestion accepted is logged with its confidence. Full audit trail per FMIQ governance standards.
- **Undo window:** one-click revert of the entire session (delete created records if untouched since import; restore prior field values on updated records) for 7 days or until a record is subsequently edited, whichever first. Modelled on MaintainX's [undo import session](https://help.getmaintainx.com/undo-a-data-import-session), extended to upserts.
- Result screen: counts, links to filtered views of imported assets ("View 412 imported assets"), warnings list, "import another file" with mappings remembered.
- Import history dashboard (admin): all sessions, original file download, result diff, undo state — the OneSchema upload-report pattern.

### Edge cases (explicit handling required)
1. Multi-sheet workbook, same schema per building → union with sheet-name virtual column.
2. Merged cells / carry-down hierarchy columns → forward-fill with one-time confirmation.
3. Junk rows above header; two-row headers with units → header detection + override.
4. Units embedded in values ("450 kW", "1,200 ltrs") → strip-and-normalise autofix with preview.
5. Sentinels: "N/A", "TBC", "-", "?" → treated as blank, counted, reported.
6. Excel serial dates, text dates, mixed formats in one column → column-level inference, ambiguous columns require user pick (DD/MM default for IE/UK).
7. Quantity rows → explode or aggregate, per type.
8. Duplicate serials across genuinely distinct assets (contractor copy-paste) → warning not error.
9. Parent named but absent from file and register → offer stub-create (placeholder asset) or re-parent to location.
10. COBie workbook detected → switch to COBie profile, map sheets directly.
11. Re-import of last month's updated survey → upsert path with field-level diff and "only update condition/cost fields" scope option.
12. 50k rows → server-side validation in batches, virtualised grid, session resumable; never freeze the tab.

### Acceptance criteria (v1)
- AC1: A 5,000-row, 3-sheet survey workbook with merged location cells, 2 junk header rows and mixed date formats imports end-to-end with no Excel round-trip required.
- AC2: ≥80 percent of columns auto-mapped correctly on first upload of an unseen file with conventional FM headers; 100 percent of auto-mappings display confidence + provenance and are overridable.
- AC3: Zero silent writes: every new location, type, custom attribute, and value mapping is shown and confirmed before commit; dry-run counts equal commit counts exactly.
- AC4: All validation errors are fixable in the grid; error rows exportable as annotated Excel; corrected file re-mergeable into the same session.
- AC5: Dedupe stage catches 100 percent of exact tag/serial duplicates and presents fuzzy candidates above threshold; no within-file duplicate is silently dropped.
- AC6: Commit is transactional; a full-session undo restores the register to its pre-import state within the undo window; every record carries importSessionId + source row provenance in the audit trail.
- AC7: Condition (A-D), criticality, SFG20/Uniclass code, install date, remaining life and replacement cost are first-class mappable fields; inbound 1-5 and Good/Fair/Poor condition scales map via the value-mapping step.
- AC8: A COBie 2.4 workbook (Facility/Floor/Space/Type/Component/System sheets) is auto-recognised and imports the location hierarchy and components without manual column mapping.
- AC9: Session state survives browser refresh and is resumable; a 50,000-row file validates without UI freeze.
- AC10: Import history lists every session with original file, result counts, actor, and undo status.

### Build vs buy note
Flatfile/OneSchema embed pricing is enterprise-tier and the data would transit a third party — problematic for Irish public-sector residency posture. Recommendation: build on open parsing libraries with the patterns above; the stages where vendors earn their money (parsing edge cases, in-grid error resolution, performance at scale) are exactly where this brief specifies behaviour, and CSV import is a known multi-quarter sink if scoped naively ([OneSchema's own warning](https://www.oneschema.co/blog/advanced-csv-import-features)). Scope v1 to the AC list; resist feature creep beyond it.

---

## 7. Sources

Import UX: [Flatfile Portal](https://flatfile.com/platform/portal/) · [Flatfile mapping](https://flatfile.com/product/mapping/) · [Flatfile Automap docs](https://flatfile.com/docs/plugins/automap) · [Flatfile import overview](https://support.flatfile.com/articles/7763163677-importing-data-with-flatfile-overview) · [Flatfile CSV blog](https://flatfile.com/blog/optimizing-csv-import-experiences-flatfile-portal/) · [OneSchema 10 advanced features](https://www.oneschema.co/blog/advanced-csv-import-features) · [OneSchema importer](https://www.oneschema.co/embeddable-importer) · [OneSchema uploader best practices](https://www.oneschema.co/blog/building-a-csv-uploader) · [CSVBox features](https://csvbox.io/features/) · [CSVBox templates](https://blog.csvbox.io/spreadsheet-template-download/) · [ImportCSV data import UX](https://www.importcsv.com/blog/data-import-ux) · [Smashing Magazine data importer design](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/) · [Smart Interface Design Patterns bulk UX](https://smart-interface-design-patterns.com/articles/bulk-ux/) · [Dromo best practices](https://dromo.io/blog/5-best-practices-to-streamline-your-csv-import-process) · [Universal import wizard](https://www.c-sharpcorner.com/article/building-a-universal-data-import-wizard-mapping-columns-preview-validation/) · [Airtable CSV import](https://support.airtable.com/csv-import-extension) · [Airtable dedupe](https://support.airtable.com/docs/dedupe-extension) · [Airtable duplicates thread](https://community.airtable.com/base-design-9/import-csv-duplicates-insert-28587) · [Airtable/Notion mapping guide](https://dev.to/xxbricksquadxx/mapping-csv-airtable-or-notion-without-tears-template-inside-2lnd)

CMMS/IWMS: [MaintainX asset imports](https://help.getmaintainx.com/import-asset-data) · [MaintainX import overview](https://help.getmaintainx.com/import-organization-data) · [MaintainX undo import](https://help.getmaintainx.com/undo-a-data-import-session) · [Limble bulk import](https://help.limblecmms.com/en/articles/2971814-how-to-bulk-import-assets-from-excel) · [Limble import tips](https://help.limblecmms.com/en/articles/3751163-importing-assets-tips-tricks) · [Fiix hierarchy import](https://helpdesk.fiixsoftware.com/hc/en-us/articles/211460246-Import-asset-child-and-grandchild-assets) · [Fiix data import overview](https://helpdesk.fiixsoftware.com/hc/en-us/articles/212108226-Data-import-overview) · [MRI Evolution](https://www.fsifm.com/en-ca/concept-evolution) · [Mobiess CAFM integrations](https://www.mobiess.com/cafm-system-mobile-integration/) · [PocketSurvey asset collection](https://www.pocketsurvey.com/surveyors-apps/cafm-asset-collection/index.htm) · [MaintainNow failed implementations](https://www.maintainnow.app/blog/avoiding-cmms-buyers-remorse-lessons-from-failed-implementations-1760127292893) · [Tractian CMMS failures](https://tractian.com/en/blog/why-cmms-implementations-fail-how-to-prevent-it) · [MPulse implementation blueprint](https://mpulsesoftware.com/blog/cmms/implementation-success-blueprint/) · [FTMaintenance data quality](https://ftmaintenance.com/cmms/cmms-data-quality/) · [Oxmaint implementation guide](https://www.oxmaint.com/blog/post/blog-post-cmms-implementation-guide-step-by-step) · [Capterra Limble reviews](https://www.capterra.com/p/162600/Limble-CMMS/reviews/) · [Capterra UpKeep reviews](https://www.capterra.com/p/145635/UpKeep/reviews/) · [Limble vs UpKeep](https://reliamag.com/guides/limble-vs-upkeep/)

Standards: [NBS — What is COBie](https://www.thenbs.com/knowledge/what-is-cobie) · [Dalux COBie import/export](https://support.dalux.com/hc/en-us/articles/5104845990300-How-to-import-and-export-COBie-and-Handover) · [EDocuments BIM and COBie](https://www.edocuments.co.uk/platform/bim-and-cobie/) · [SFT AIM data transfer](https://bimportal.scottishfuturestrust.org.uk/level2/stage/6/task/17/data-transfer-to-asset-information-model) · [NBS Uniclass 2015 update](https://www.thenbs.com/knowledge/uniclass-2015-an-update) · [NBS Uniclass mappings](https://www.thenbs.com/our-tools/uniclass/mappings-translations) · [RICS NRM 3 tables 2026](https://www.rics.org/content/dam/ricsglobal/documents/standards/RICS-NRM-3-Logic-and-Level-Table-2026_Explanatory-Notes.pdf) · [SFG20 standards PDF](https://img1.wsimg.com/blobby/go/8fc62093-f93e-447d-8e21-b1e235f4d9cc/downloads/sfg20_standards_free_download.pdf) · [SFG20 asset mapping](https://www.sfg20.co.uk/products/asset-mapping/) · [COBie vs SFG20 vs NRM vs CAFM](https://www.linkedin.com/pulse/asset-data-handover-cobie-vs-sfg20-nrm-cafm-schemas-gonz%C3%A1lez-jones) · [NHS England backlog methodology](https://www.england.nhs.uk/publication/a-risk-based-methodology-for-establishing-and-managing-backlog/) · [gov.uk backlog costing](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/148143/Backlog_costing.pdf) · [NHS Scotland SHTN 00-01](https://www.nss.nhs.scot/media/5435/shtn-00-01-v6-february-2021-aug-2024-archived.pdf) · [Bellrock six-facet](https://www.bellrock.co.uk/services/building-assets/six-facet-surveys) · [RLB six-facet](https://www.rlb.com/wp-content/uploads/sites/6/2021/05/six-facet-survey-2021.pdf) · [HSE HBS Estates](https://www.hse.ie/eng/about/who/healthbusinessservices/estates/) · [ORS HSE Estates surveys](https://ors.ie/project/hse-estates-primary-care-centre/) · [OPW PMRV](https://maps.opw.ie/property/)

Hierarchy/criticality: [Fabrico ISO 14224 guide](https://www.fabrico.io/blog/asset-hierarchy-naming-convention-guide/) · [Tractian hierarchy glossary](https://tractian.com/en/glossary/asset-hierarchy) · [Fiix hierarchy setup](https://fiixsoftware.com/blog/how-to-set-up-asset-hierarchy-for-maintenance/) · [MaintainX hierarchy](https://www.getmaintainx.com/blog/asset-hierarchy) · [Redlist ACR](https://www.getredlist.com/dictionary/asset-criticality-ranking-acr/) · [Reliable Plant criticality](https://www.reliableplant.com/criticality-analysis-31830) · [eMaint ACA](https://www.emaint.com/rank-assets-by-criticalness-for-a-more-effective-aca/)

AI import: [Flatfile AI Transform](https://www.linkedin.com/posts/flatfile_introducing-ai-transform-activity-7212490542125891584-1Dx7) · [Flatfile MCP analysis](https://skywork.ai/skypage/en/unlocking-ai-potentials-flatfile-mcp-server/1977602108810129408) · [OneSchema AI agents](https://www.oneschema.co/) · [ACM LLM schema mapping](https://dl.acm.org/doi/10.1145/3737412.3743490) · [AI-assisted JSON schema mapping](https://arxiv.org/pdf/2508.05192) · [LLM data preparation survey](https://arxiv.org/pdf/2601.17058) · [DZone LLMs in ETL](https://dzone.com/articles/llms-in-data-engineering-gen-ai-changing-etl-analytics)

**END — v0.1 — 2026-06-11**
