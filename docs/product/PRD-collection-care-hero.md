# PRD — Collection Care Hero Elevation

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

> Source research: [`docs/research/05-collection-care.md`](../research/05-collection-care.md). Base loop (excursion → at-risk objects → work order → alert) is FUNCTIONAL in `app/packages/api/src/domain/collectionCare.ts` against the `cc_*` schema. This PRD specs only the delta that elevates the module to hero status. Pilot targets unchanged: excursion→WO < 60 s; loan report < 5 min; alert→ack < 15 min (PROJECT-PLAN §hard targets).

---

## 1. Why hero

Verified market gap (research §4): conservation monitoring platforms (Conserv, Hanwell EMS, Eltek Darca) stop at alerts and graphs; IWMS/CAFM platforms (Planon, Archibus, TRIRIGA) have no conservation vocabulary at all. **No product on the market closes the loop** excursion detection → named at-risk objects → prioritised work order → conservator sign-off → lender-grade evidence. The nearest threat (generic CMMS + IoT triggers) is plumbing without conservation semantics — and assembling it in-house is exactly the systems-integration anti-pattern NMI's PMC rejects.

The defensible moat is not sensor ingest (commoditising) but **conservation semantics as product**: standards-as-versioned-data, object linkage, conservator workflow, indemnity-grade evidence. The signature demo: a live RH excursion in a gallery produces, inside 60 seconds, a work order naming the at-risk objects; the loop closes only on conservator sign-off; one click renders the loan evidence pack a lender or the State indemnity (National Cultural Institutions Act 1997 s.11) demands.

Positioning sentence (research §7.3): FMIQ is the only platform where the sensor that detects the excursion, the standard that defines it, the work order that fixes it, the conservator who signs it off, and the report the lender demands are one system of record.

## 2. Personas

| Persona | Role code | Needs from this module |
|---|---|---|
| **Conservator / Conservation Officer** | `ConservationOfficer` | Assign standards profiles per zone; be alerted by risk not noise; inspect and sign off excursions; see lux-hour budgets and rotation advisories; IPM trends |
| **Registrar (loans)** | `Registrar` (new) | Tighten a zone to a lender spec for a loan window; auto-attached excursion history per loan; one-click facility-report annexe and loan condition report |
| **FM coordinator** | `FacilitiesManager` | Receive plant-cause excursions routed to FM first; clear SLA-bound work orders; see what is blocked awaiting conservation sign-off |
| **Director / governance** | `ReadOnly`+dashboard | Annual zone summary, indemnity evidence on demand, Bizot energy co-benefit numbers for board and sustainability reporting |

Routing rule: excursion type determines first responder (RH drift in a sealed case → conservation first; chilled-water failure → FM first), with cross-notification always.

## 3. Scope — the nine depth moves (prioritised)

For each move: what exists today (do not rebuild) and the delta.

### M1 — Versioned standards-profile library (P0)
- **Exists:** `cc_standard` (codes PAS198 | BS4971 | ASHRAE_AA..D | BIZOT_2023, name only); `cc_zone_target` hand-keyed numeric bands, one active row per zone.
- **Delta:** Profiles become **data, not enum codes**: each profile version carries setpoints, bands, short-term fluctuation rule (window + magnitude), seasonal-drift rule, lux/UV limits, annual lux-hour budget, effective-from/version, and supersession (`PAS198` flagged withdrawn → EN 16893). Ship seeded library: **Bizot 2023 lead** (RH 40–60 %, T 16–25 °C, ±10 % RH/24 h), BS EN 16893:2018 + BS 4971:2017 pair, ASHRAE Ch. 24 classes AA/A1/A2/B/C/D (each with both short-term and seasonal rules), PAS 198 legacy. Conservator assigns a profile to a zone; FMIQ compiles it into `cc_zone_target` rules. **Lender-spec profiles**: compiled from `cc_loan.lender_spec`, scoped to the loan window, tightening only, auto-revert at loan end.

### M2 — Three-window detection engine (P0)
- **Exists:** absolute band (two-sided RH/T with watch/breach/critical margins), ceilings (lux/UV/CO2), and a two-point rate-of-change projection for RH.
- **Delta:** (a) true **rolling 24 h fluctuation** window (max−min over trailing 24 h vs profile rule — Bizot ±10 %, lender ±5 %) replacing the two-point projection; (b) **seasonal drift** tracking (long-window mean vs annual setpoint, for ASHRAE A1/B); (c) **dew-point / condensation-risk derivation** from T+RH pairs for historic fabric. Detection logic extracted into a **pure function** `evaluateWindows(snapshot, compiledProfile) → verdicts` — no DB access, no `Date.now()` inside; caller loads the window aggregates (Timescale continuous aggregates) and persists. Same engine discipline as the gate engine (ADR-002).

### M3 — Lux-hour budget accumulator (P0)
- **Exists:** instantaneous lux ceiling only.
- **Delta:** per zone (and per linked object-class): cumulative lux·h this exhibition year vs profile budget (e.g. 15,000–150,000 lux·h highly sensitive; ~600,000 moderately sensitive), **projected exhaustion date** from trailing burn rate, and an advisory work order ("rotate object / reduce illuminance") at 80 % consumption. Computed from the existing `cc_reading_hourly` aggregate. No competitor surfaces this operationally.

### M4 — Fatigue-managed alerting (P0)
- **Exists:** watch/breach/critical severities; excursion de-dup per zone+metric; notifications with ack endpoint.
- **Delta:** **persistence windows** (breach must hold N minutes before an excursion opens — per profile/zone), **recovery hysteresis** (excursion closes only after M minutes back in band), watch tier becomes a **pre-alert band at 80 % of any limit** feeding a daily digest, never paging; **ack-timer escalation chains** (primary contact has T minutes to acknowledge, else next in chain — conservation-first or FM-first by excursion cause); **per-zone quiet tuning with audit trail** of who relaxed what, when, why (gate-engine override discipline applied to alert tuning).

### M5 — Conservator sign-off gate (P0)
- **Exists:** gate engine (ADR-002) with `gate_definition`, `GATE_REGISTRY`, override-with-reason, audit log; excursion-sourced WOs.
- **Delta:** new gate `CC_EXCURSION_CLOSE`: an excursion-sourced work order cannot move to `closed` without a `ConservationOfficer` sign-off recording the condition-check outcome (`objects_inspected | damage_noted | no_action_required`) and free-text note. FM "done" advances the WO to `awaiting_conservation_signoff`, never `closed`. Override follows existing gate-engine rules (role + mandatory reason + audit). This makes "loop closed" enforceable, not asserted.

### M6 — One-click loan / indemnity evidence pack (P0)
- **Exists:** per-work-order evidence pack (JSON + HTML); `cc_loan` with `lender_spec` jsonb.
- **Delta:** excursions in a loan zone during the loan window **auto-attach to the loan record** as disclosable incidents. One click on a loan renders: conditions achieved vs lender spec (hourly stats), every excursion + response + sign-off history, and a **monitoring coverage statement** (sensor uptime — GIS demands 24/7, so data gaps are themselves reportable incidents). Four deterministic templates: UKRG facility-report environmental annexe; GIS / State-indemnity loan evidence pack; per-loan condition report; annual zone summary. Render target stays < 5 min.

### M7 — Sensor vendor adapters (P0 partial)
- **Exists:** `POST /api/v1/adapters/:vendor/webhook` with parsers for conserv, hanwell (CSV push), tandd (payload parse); sensor resolution by vendor+external_id; `last_seen_at` heartbeat.
- **Delta, in order:** (a) **T&D WebStorage REST poller** — scheduled worker against the documented public API (20 req/min rate limit honoured), per-device cursors, normalise to `cc_reading` through the same engine; (b) **open LoRaWAN webhook ingest** — accept ChirpStack/TTN uplink envelopes (HTTP webhook), payload-decoder registry per device profile; covers Conserv hardware and the generic LoRaWAN sensor market with no vendor permission; (c) **CSV brownfield import** — bulk historical import job (Eltek Darca / Hanwell exports), chunked, idempotent, with retroactive Bizot scoring: "bring 3 years of Hanwell data and FMIQ scores it against Bizot in an afternoon" — the demo wedge. (d) BMS bridge (BACnet/Modbus) is batch 3+, out of this PRD's build scope.

### M8 — IPM trap-grid trends (P1)
- **Exists:** trap register + observations (`POST /api/v1/ipm/observations`), collection-zone sightings auto-escalate to ConservationOfficer.
- **Delta:** scheduled inspection rounds as mobile tasks (reuse PPM scheduler); species/count **trend heat-map per space**; per-species action thresholds (tenant-configurable) that raise work orders on breach; MSPI-ready IPM summary section in the annual zone report. Also reconcile table naming: docs say `cc_ipm_trap`/`cc_ipm_observation`, code uses `ipm_trap`/`ipm_observation` — settle on `cc_ipm_*`.

### M9 — Bizot energy co-benefit report (P1)
- **Exists:** `sus_bizot_compliance` table (zone, period, pct_hours_in_band, energy_kwh) — schema only.
- **Delta:** monthly rollup job computing % hours in Bizot band per zone (from `cc_reading_hourly`), joined to metered/estimated energy; report: hours-in-band, excursion counts/durations, estimated kWh and carbon saved by band-widening vs a tight-control baseline. Connects collection care to the PMC sustainability scope.

## 4. Non-goals

- No object catalogue replication — the CMS (Axiell/TMS) stays the system of record; FMIQ holds `cc_object_link` references + sensitivity only (data minimisation, unchanged).
- No HVAC control/actuation — FMIQ detects and dispatches work; it does not drive plant.
- No continuous pollutant telemetry — pollutants (CCI TB 37) are modelled as scheduled inspection tasks with recorded results, not sensor ingest.
- No BMS bridge build in this PRD (interface reserved; batch 3+).
- No bespoke per-institution detection code — all behaviour driven by profile data and tenant config.
- No machine-learning anomaly detection — deterministic, explainable rules only (auditability requirement).
- No new mobile app — IPM rounds and WO actions ride the existing mobile WO surface.

## 5. UX flows — top five moves

### 5.1 Assign a standards profile (M1)
1. Conservator opens Zone → Environment tab → "Assign profile".
2. Picks from library (Bizot 2023 default-suggested; ASHRAE class ladder; bespoke). Preview shows compiled rules: bands, 24 h fluctuation, seasonal drift, lux/UV, lux-hour budget.
3. Optional zone-level tightening (never loosening below profile floor) with reason.
4. Confirm → new versioned `cc_zone_target` active; prior version retained; audit entry. Trend charts immediately overlay the new bands.

### 5.2 Excursion lifecycle with fatigue controls (M2 + M4)
1. RH drifts: at 80 % of band edge the zone enters **watch** — dashboard amber, daily digest only.
2. Reading breaches and **persists past the persistence window** → excursion opens; engine evaluates static + rolling-24h + dew-point; severest verdict wins; at-risk objects named; WO raised (< 60 s).
3. Primary contact (conservation-first or FM-first by cause) alerted; ack timer starts. No ack in T minutes → next in chain, escalation logged.
4. Conditions recover; excursion stays open through hysteresis window, then auto-closes its *detection*; the WO and sign-off remain.

### 5.3 Conservator sign-off (M5)
1. FM completes corrective work → WO moves to `awaiting_conservation_signoff` (gate blocks `closed`).
2. ConservationOfficer mobile/desktop: excursion summary, peak values, named objects ranked by sensitivity, condition-check form (`objects_inspected | damage_noted | no_action_required` + note).
3. `damage_noted` spawns a follow-up WO linked to the object reference. Sign-off recorded → gate green → WO closes; full chain lands in the evidence record.

### 5.4 Lux-hour budget review (M3)
1. Zone view shows budget gauge: consumed lux·h / annual budget, burn rate, projected exhaustion date.
2. At 80 % an advisory WO is raised ("rotate object / reduce illuminance") routed to conservation.
3. Conservator records the action; accumulator resets on rotation event or exhibition-year boundary.

### 5.5 One-click loan evidence pack (M6)
1. Registrar creates/opens a loan: zone, window, lender spec (compiled to a tightened lender profile, auto-revert at end date).
2. During the loan, excursions and sensor-gap incidents auto-attach to the loan timeline.
3. "Generate evidence pack" → picks template (UKRG annexe / GIS pack / condition report) → deterministic render (HTML/PDF) in < 5 min: conditions vs spec, incident + response + sign-off history, coverage statement. Pack is immutable and versioned.

## 6. Data model deltas

Engine rule: all detection stays in a pure function; tables below are inputs/outputs only.

```
-- M1 profiles (cc_standard becomes the versioned library)
cc_standard            + version, effective_from, superseded_by_id, status /* active|withdrawn|legacy */,
                         rules jsonb /* bands, fluctuation {window_h, max_delta}, seasonal {window_d, max_drift},
                                        lux_max, uv_max, lux_hour_budget, dew_point_margin */
cc_zone_target         + cc_standard_version_id, source /* profile|manual|lender_spec */, valid_from, valid_to,
                         persistence_min, hysteresis_min, watch_pct  /* M4 per-zone tuning */
cc_target_change_log(id, tenant_id, cc_zone_id, actor_id, before jsonb, after jsonb, reason, ts)  /* M4 audit */

-- M2 windows (computed from cc_reading_hourly; no new raw storage)
cc_window_stat(tenant_id, zone_id, metric, window /* 24h|seasonal */, min, max, mean, ts)  -- continuous aggregate
cc_excursion           + window_kind /* absolute|rolling_24h|seasonal|dew_point */, persistence_met_at, recovered_at

-- M3 lux budget
cc_lux_budget(id, tenant_id, cc_zone_id, exhibition_year_start, budget_lux_h, consumed_lux_h,
              projected_exhaustion_date, last_rollup_at)
cc_lux_budget_event(id, tenant_id, budget_id, kind /* rotation|reset|advisory_wo */, wo_id null, ts)

-- M4 alerting
cc_alert_chain(id, tenant_id, cc_zone_id, cause /* conservation|plant */, position, role_or_user, ack_timeout_min)
cc_alert(id, tenant_id, excursion_id, recipient, sent_at, acked_at null, escalated_to null)

-- M5 sign-off (gate engine reused; one evidence table)
cc_signoff(id, tenant_id, cc_excursion_id, wo_id, actor_id, outcome /* objects_inspected|damage_noted|no_action_required */,
           note, follow_up_wo_id null, ts)
wo_work_order.status   + 'awaiting_conservation_signoff'

-- M6 loans
cc_loan                + lender_profile_id /* compiled from lender_spec */, status
cc_loan_incident(id, tenant_id, cc_loan_id, kind /* excursion|sensor_gap */, cc_excursion_id null,
                 gap_start null, gap_end null, ts)
cc_evidence_pack(id, tenant_id, cc_loan_id null, cc_zone_id null, template /* ukrg|gis|loan_condition|annual_zone */,
                 rendered_at, content_hash, storage_ref)  /* immutable */

-- M7 ingest
cc_sensor              + vendor 'lorawan' (enum extend), decoder_profile null
cc_ingest_cursor(id, tenant_id, vendor, external_id, cursor_ts, last_poll_at)        /* T&D poller */
cc_import_job(id, tenant_id, source /* csv_eltek|csv_hanwell|csv_generic */, status, rows_total,
              rows_done, error_rows jsonb, created_by, ts)                            /* brownfield */

-- M8 IPM (rename ipm_* → cc_ipm_*)
cc_ipm_threshold(id, tenant_id, species, space_class null, action_threshold_count, window_days)
cc_ipm_round(id, tenant_id, schedule jsonb, assigned_role)                            /* via PPM scheduler */

-- M9 (table exists; add rollup job only)
sus_bizot_compliance   + excursion_count, excursion_minutes, est_kwh_saved
```

## 7. API surface

Existing (unchanged): `POST /api/v1/ingest/readings`, `POST /api/v1/adapters/:vendor/webhook` (conserv|hanwell|tandd), `GET /api/v1/zones/:zoneId/readings`, `POST /api/v1/ipm/observations`, WO gates/status/override routes, `GET /api/v1/evidence/work-order/:id(.html)`.

New:

```
# M1 profiles
GET    /api/v1/cc/standards                        # library incl. versions/status
POST   /api/v1/cc/zones/:zoneId/profile            # assign profile (+tightenings, reason)
GET    /api/v1/cc/zones/:zoneId/profile/history

# M2/M4 excursions + alerting
GET    /api/v1/cc/excursions?zoneId&status&window  # incl. window_kind, persistence/hysteresis state
POST   /api/v1/cc/alerts/:id/ack
GET    /api/v1/cc/zones/:zoneId/alert-chain        # + PUT to configure (audited)

# M3 lux budgets
GET    /api/v1/cc/zones/:zoneId/lux-budget
POST   /api/v1/cc/zones/:zoneId/lux-budget/rotation   # record rotation / reset

# M5 sign-off
POST   /api/v1/cc/excursions/:id/signoff           # role ConservationOfficer; outcome + note
GET    /api/v1/work-orders/:id/signoff             # evidence read

# M6 loans + evidence
POST   /api/v1/cc/loans                            # lender_spec → compiled lender profile
GET    /api/v1/cc/loans/:id/incidents
POST   /api/v1/cc/loans/:id/evidence-pack          # body: { template }, async render, returns pack id
GET    /api/v1/cc/evidence-packs/:id(.html|.pdf)
POST   /api/v1/cc/zones/:zoneId/annual-report      # annual zone summary template

# M7 ingest
POST   /api/v1/adapters/lorawan/webhook            # ChirpStack/TTN envelope; decoder per device profile
POST   /api/v1/cc/imports                          # multipart CSV; creates cc_import_job
GET    /api/v1/cc/imports/:id                      # progress + error rows
# T&D poller is a worker (cron), not an endpoint; config via cc_sensor + cc_ingest_cursor

# M8 IPM
GET    /api/v1/cc/ipm/trends?spaceId&species&window
PUT    /api/v1/cc/ipm/thresholds

# M9
GET    /api/v1/cc/zones/:zoneId/bizot-report?period
```

All ingest endpoints: tenant-scoped (RLS via `withTenant`), idempotent on (sensor, metric, ts), unknown metrics dropped not rejected (existing adapter convention), unknown sensors reported not erroring.

## 8. Acceptance criteria

Pilot targets retained: AC-1, AC-2 are unchanged hard targets.

1. A breaching reading posted to any ingest path produces an open excursion, a work order with named at-risk objects ranked by sensitivity, and routed alerts in **< 60 s**, measured end-to-end at the pilot site, for 100 % of induced test excursions.
2. Any loan evidence pack (any of the four templates) renders in **< 5 min** from click, for a loan window containing at least 90 days of readings and at least 3 incidents.
3. Assigning the Bizot 2023 profile to a zone compiles RH 40–60 %, T 16–25 °C and a ±10 % RH/24 h rolling rule into the active target; the prior target version remains queryable.
4. A reading sequence that never leaves 40–60 % RH but swings 12 % within 24 h opens a `rolling_24h` excursion; the same sequence under a static-only profile does not.
5. A T+RH pair within band but within the profile's dew-point margin of condensation opens a `dew_point` excursion flagged for historic-fabric zones.
6. The detection engine is a pure function: unit tests run with zero DB and zero clock access; `Date.now()` inside the engine fails review/CI.
7. A lender spec of ±5 %/24 h on a loan zone overrides the house profile only within the loan window and auto-reverts at loan end; both transitions are audited.
8. A lender-spec compile that would loosen any house rule is rejected with a 422.
9. Lux-hour accumulation over a simulated exhibition year is within 1 % of the analytic value for a constant-lux fixture; the projected exhaustion date updates daily.
10. At 80 % lux-budget consumption an advisory work order is raised exactly once per budget cycle and routed to ConservationOfficer.
11. A breach shorter than the zone's persistence window opens no excursion and sends no page; it appears in the daily digest.
12. After recovery, the excursion's detection closes only when readings hold in-band for the full hysteresis window; flapping across the band edge does not create a second excursion.
13. An unacknowledged critical alert escalates to the next chain entry after the configured ack timeout; the escalation is recorded with timestamps; alert→ack median ≤ 15 min at pilot.
14. Any change to per-zone alert tuning (persistence, hysteresis, watch band, chain) writes a `cc_target_change_log` row with actor and reason; empty reason is rejected.
15. An excursion-sourced work order cannot reach `closed` without a `cc_signoff` row from a ConservationOfficer; an FM attempt returns 409 with the gate's block message; override requires an authorised role plus a non-empty reason and is audited (0 silent overrides).
16. A `damage_noted` sign-off creates a linked follow-up work order referencing the CMS object id.
17. Every excursion and every sensor gap > 15 min inside a loan window auto-attaches to the loan as an incident; the evidence pack's coverage statement reports uptime % and lists all gaps.
18. Evidence packs are immutable: re-rendering creates a new version with a new content hash; stored hashes verify.
19. The T&D poller ingests a configured device's readings within one poll cycle, never exceeds 20 req/min, and resumes from its cursor after restart without duplicate readings.
20. A LoRaWAN uplink (ChirpStack and TTN envelope fixtures) for a registered device lands as normalised readings through the same engine; unknown device ids are reported, not 500s.
21. A 3-year, 1 M-row Hanwell CSV import completes as a chunked idempotent job with per-row error reporting; re-running the same file inserts zero duplicates; the imported range is immediately scoreable against Bizot (% hours in band).
22. An IPM species count crossing its configured threshold within its window raises a work order; trend heat-map renders per space for a 12-month window. (Batch 2)
23. The monthly Bizot rollup writes % hours in band, excursion counts/durations and estimated kWh saved per zone; the annual zone report includes the IPM summary. (Batch 2)
24. All new tables carry `tenant_id` + RLS; cross-tenant reads return zero rows in the standard isolation test suite.

## 9. Phasing

**Pilot slice (must be live for the signature demo at site go-live):**
- M1 standards-profile library — Bizot 2023 lead, EN 16893 + BS 4971 + ASHRAE classes seeded, lender-spec compile.
- M2 detection engine — static + rolling-24h + dew point, extracted pure. (Seasonal drift deferred: needs months of accumulated history to be meaningful.)
- M3 lux-hour budget accumulator + exhaustion projection + advisory WO.
- M4 fatigue-managed alerting — persistence, hysteresis, watch digest, ack-timer chains, audited tuning.
- M5 conservator sign-off gate (`CC_EXCURSION_CLOSE`).
- M6 loan evidence pack — GIS/State-indemnity pack + per-loan condition report templates first.
- M7a T&D WebStorage REST poller; M7c CSV brownfield import (the "score 3 years of Hanwell data against Bizot" demo wedge).

**Batch 2 (post-pilot):**
- M2b seasonal-drift window (ASHRAE A1/B complete).
- M6b UKRG facility-report annexe + annual zone summary templates.
- M7b open LoRaWAN webhook ingest (ChirpStack/TTN) + decoder registry.
- M8 IPM trend heat-maps, per-species thresholds → WOs, scheduled rounds, MSPI summary.
- M9 Bizot energy co-benefit report (monthly rollup + render).

**Batch 3+ (reserved, not specced here):** BMS bridge (BACnet/Modbus/OPC UA), pollutant survey scheduling templates, multi-site benchmarking.

---

**END — v0.1 — 2026-06-11**
