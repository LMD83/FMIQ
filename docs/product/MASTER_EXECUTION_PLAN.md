# FMIQ — Master Execution Plan: Research to Pilot-Grade

**Version:** v1.0 | **Generated:** 2026-06-11 | **Owner:** Nexum Intelligence Systems Limited

**Inputs:** `docs/research/01–05` (market study, 2026-06-11) and `docs/product/PRD-asset-register-import.md`, `PRD-workorders-helpdesk.md`, `PRD-ppm-compliance.md`, `PRD-collection-care-hero.md` (all v0.1, 2026-06-11). Read those for module detail; this document owns sequence, priority, and exit criteria only.

---

## 1. Strategic frame

- **Target:** pilot-grade product for the heritage/public-estates market. NMI cannot be the pilot (PMC excludes products "materially dependent on future product development") — the PMC is the requirements blueprint; the pilot route is county museums, OPW-adjacent sites, Section 38/39 bodies, university heritage buildings (research 01 §finding 12).
- **UX bar:** MaintainX. **Evaluation bar:** Civica/MRI. **Bid-to-beat at NMI-scale tenders:** MRI Evolution. **Deal shape benchmark:** ~£110–160k/yr over 5+2 (Oxford Health NHS FT).
- **Wedge (validated):** no product closes monitoring → alert → work order → conservator sign-off → lender evidence. Signature demo = sensor breach in a collection store auto-raises a preservation-prioritised, SLA-tracked work order with closure evidence in the audit record.
- **Two content moats:** Irish statutory register as native seed data (no SFG20 dependency — PE-owned licensing trap), and conservation semantics as data (versioned Bizot/BS EN 16893/BS 4971/ASHRAE profiles).
- **Onboarding-as-product:** self-serve asset-register import is itself a differentiator (English Heritage needed a bespoke utility to load K2).

## 2. Sequence of operation — why this order

| # | Stage | Rationale |
|---|---|---|
| 1 | Foundation: front-end split + register schema | Monolithic `App.tsx` is the P1 blocker; every module lands on routed sections. Assets are the referent of every other record — nothing demos without an estate in the system. |
| 2 | Asset import wizard | The onboarding moment. Unblocks self-serve demo estates and every pilot conversation. |
| 3 | Work orders + helpdesk | Highest daily-use surface in any IWMS — the screen FM staff live in. Adoption is won or lost here. |
| 4 | PPM + statutory compliance | The statutory backbone; weekly/monthly cadence. Depends on assets (3 needs WO plumbing it shares). |
| 5 | Collection-care hero depth | Already functional at base; depth moves convert it from feature to wedge. Lands last in batch 1 so the signature demo crosses all modules. |
| 6 | Hardening + pilot readiness | Cross-module gates, contractor slice, perf, onboarding polish, tenant provisioning. |

Priority within each sprint follows usage frequency: technician/coordinator daily journeys > weekly planner views > monthly/audit outputs.

## 3. Sprint plan — staged, checkable

Cadence: ~2-week stages. Each has a hard exit test; a stage is not done until its exit passes end-to-end on seeded data. No stage starts on a red build.

### Sprint F1 — Foundation (front-end split + register v1)
- Split `App.tsx` into routed sections (sidebar nav per persona role); design-system tokens applied; shared table/list/detail primitives.
- Migration 002: full asset-register delta (D1–D4 in asset PRD §5 — `est_system`, ~19 `est_asset` columns, `imp_*` import subsystem tables, custom attributes), additive only.
- Register v1: list/tree/detail/CRUD/search/export over the estate hierarchy.
- **Exit:** every existing screen reachable via routes; register browsable to asset detail on seeded NMI-like estate; build + API tests green.

### Sprint F2 — Asset import wizard (PRD §9 Sprint-1 slice)
- Create-only path: single-sheet CSV/XLSX → header detect → exact+fuzzy+remembered mapping (no AI) → condition/criticality value mapping → fix-in-grid validation (errors block, warnings don't) → explicit link-vs-create hierarchy confirm → exact-key dedupe → dry-run diff → transactional commit with provenance + create-only undo → import history.
- **Exit:** a messy 1,000-row asset register imported self-serve in <30 min with zero Excel round-trips; undo restores prior state; audit shows importSessionId on every row.

### Sprint F3 — Work orders Phase A (PRD §10 Phase A)
- State machine 8+3 with migration map from the current 4-state; typed holds; P1–P4 dual-clock `evaluateSla` pure function (Strathclyde fixture); no-login QR intake with tracking link; triage queue; one-screen WO card with chat-on-WO + photo evidence; evidence-gated completion; completed≠closed verification queue; conservation sign-off gate (the wedge) included.
- **Exit:** QR fault report <60s; full journey QR → triage → assign → execute (responsive web) → evidence → verify → close; SLA breach escalates; sensitive-zone WO blocks without sign-off; all 11×11 transitions property-tested.

### Sprint F4 — PPM Phase 1 (PRD Phase 1)
- `cmp_statutory_item` seeded with the top-10 Irish register (I.S. 3218, I.S. 3217, s.18 register, HPSC legionella, GA1 lifts, I.S. 10101 PIR, COLL_HVAC, RGI gas, I.S. 291, asbestos); obligation instantiation; append-only sha256 evidence chain; evidence-gated close (422 without cert); RAG compliance dashboard; one-click date-ranged inspection pack.
- **Exit:** fire-officer demo — pick a building, produce the inspection pack, every RAG state traceable to evidence or its absence. All ACs pass with zero SFG20 content.

### Sprint F5 — Collection-care hero (PRD pilot slice M1–M6, M7a/c)
- Versioned profile library (Bizot 2023 lead); pure-function detection engine extraction (static + 24h rolling + dew point); lux-hour budget accumulator; fatigue-managed alerting (watch tier, hysteresis, ack-timer escalation); conservator sign-off gate; GIS/loan-condition evidence packs; T&D REST poller + CSV brownfield import.
- **Exit:** the signature demo end-to-end, keeping hard targets — excursion→WO <60s, loan pack <5min, alert→ack ≤15min.

### Sprint F6 — Hardening + pilot readiness
- WO Phase B contractor slice (portal access, RAMS-before-attendance, insurance-expiry dispatch block); 52-week PPM planner (Phase 2); cross-module gate wiring (protected-structure statutory check); performance pass; onboarding polish; pilot tenant provisioning runbook; usability pass — the mum test: an untrained user reports a fault, an untrained admin imports a register, unaided.
- **Exit:** pilot-readiness checklist signed; a cold user completes the two core journeys without help.

## 4. Batch 2 backlog (post-pilot, ranked)

1. Native mobile app (responsive PWA carries the pilot — WO PRD non-goal).
2. Import: multi-sheet union, autofix-with-preview, upsert mode, AI mapping suggestions, COBie profile, 50k-row hardening.
3. CC: seasonal-drift window, LoRaWAN ingest, IPM trends/thresholds, UKRG annexe + annual report, Bizot energy co-benefit report.
4. PPM: heritage/collection-care depth (Phase 3), SFG20 optional connector (Phase 4).
5. WO Phase C: email-to-ticket, statutory routing queue, escalation-ladder config UI.
6. Space management, soft services, condition surveys, BMS bridge — next module batch, re-prioritised against pilot feedback.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Reference gate: tenders require prior similar deployments | Lighthouse pilots under/near threshold now; publish case studies early |
| MRI/Micad bolt on a heritage pack; Conserv moves up-stack | Conservation-domain depth (semantics-as-data) is the defensible layer; ship F5 before marketing the wedge |
| Solo-founder bandwidth (~1.9 FTE shared with GovIQ) | Agent-executed sprints with hard exit tests; one stage in flight at a time |
| Scope creep toward NMI-bespoke | PMC is a requirements source, not a customer; every feature must serve the broader heritage market (CLAUDE.md §2) |
| Front-end debt compounding | F1 split is non-negotiable and first; no module UI lands in `App.tsx` |

## 6. Verification discipline

Every sprint: build green, API + web tests pass, new pure functions property-tested, exit test walked end-to-end on seeded data, PRD acceptance criteria for the slice checked off in the PRD file. No emoji in any external-facing output; brand rules apply to all UI and documents.
