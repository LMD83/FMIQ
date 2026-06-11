# PRD — FMIQ Work Orders + Helpdesk Module

Version: v0.1 | Generated: 2026-06-11 | Owner: Nexum Intelligence Systems Limited

Source of requirements: `docs/research/03-workorders-helpdesk.md` (Research Brief 03, v0.1). Eligibility caveat per `CLAUDE.md` §2 applies: this is a product spec for the broader Irish public-sector/heritage-estates market; NMI's PMC is the lighthouse requirements source, not a bespoke target.

Revision history:

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-06-11 | Initial draft from Research Brief 03 + codebase inventory |

---

## 0. Existing build inventory — build-on vs change vs add

The repo (`app/packages/api`, `app/packages/web`) already implements a working reactive-maintenance core. Disposition of every existing piece:

### Build on (keep as-is, extend)

| Asset | Location | Why it stays |
|---|---|---|
| Gate engine ("no paperwork, no work") | `src/domain/gateEngine.ts`, migration 002 | Reusable check-set primitive with per-tenant config, audited role-gated overrides. Becomes the enforcement mechanism for permit + conservation + protected-structure gates |
| SSoW records (RAMS, permits, competency, pre-task, key sign-out) | `src/domain/ssow.ts`, migration 008 | `hs_permit` already models permit type, validity window, authoriser; competency-expiry blocking via gate is exactly the §3.3 dispatch-block requirement |
| Per-tenant WO reference counter (`WO-2026-00042`) | `nextRef()` in `domain/workOrders.ts`, migration 004 | Correct concurrency-safe pattern |
| Mandatory failure coding on close | `closeWorkOrder()`, migration 011 | Failure mode/cause/remedy + `confirmed_by/at` is the seed of the verification step |
| Pre-triage request table | `req_request` (migration 018) — channel, requester, category, priority, status `open→triaged→converted/rejected/duplicate` | Matches the research's request-before-work-order split; extend, don't replace |
| QR scan → asset resolve → WO + photo | `domain/issueCapture.ts`, `routes/issues.ts`, `wo_issue_photo` (migration 020) | Core capture flow works; needs an anonymous front door (see Change) |
| Deterministic rule-based triage | `ruleBasedTriage` in `domain/ai.ts` | Conforms to deterministic-first policy; AI assist stays flagged off |
| Offline write queue (PWA) | `web/src/offline/queue.ts` (+tests) | IndexedDB-backed replay queue for status/pre-task/photo/ack |
| Contractor record + compliance vault + scorecard | `wo_contractor`, `contractorVault()`, `contractorScorecard()` | Foundation for the contractor portal slice |
| Append-only audit log, RLS tenancy, outbox events | `core_audit_log`, `withTenant`, `domain/outbox.ts` | Every transition already audited with before/after |
| Web views | `Helpdesk.tsx`, `Field.tsx`, `EvidencePacks.tsx` | Extend for triage queue, WO card, verification |

### Change (rework in place)

| Asset | Today | Required change |
|---|---|---|
| WO state machine | 4 states: `open → assigned → in_progress → closed` (`domain/workOrders.ts`, CHECK constraint in 001) | Expand to the 11-state model in §5. Migration maps `open→new/triaged`, keeps `assigned`/`in_progress`, splits `closed` into `completed/verified/closed`. `TRANSITIONS` table and CHECK constraint rewritten; transition function signature unchanged |
| Priority model | 3 bands `routine/high/critical` | 5 bands P1–P4 + Planned (§4.5). Migration maps `critical→P1`, `high→P2`, `routine→P3` |
| SLA engine | `wo_sla_policy` per-priority response/fix minutes; single `sla_due`; `resolveSla()` does a DB read; `slaState()` pure (75% at-risk) | Dual respond/rectify timers, business-hours calendars, typed-hold pause rules, heritage uplift, escalation ladder. Refactor to pure `evaluateSla()` (§6.2); callers load policy rows and pass them in. `slaState()` logic absorbed |
| QR issue capture | Requires an authenticated session (`req.auth`) | Add anonymous/no-login intake endpoint with per-tenant QR tokens + optional staff code; existing authed path kept for staff |
| `captureIssue` ref generation | Random `WO-4xxxx` ref (line 118 of `issueCapture.ts`) | Use `nextRef()` — random refs can collide and break the per-tenant reference scheme |
| Request conversion | `convertRequest()` straight to WO | Insert triage-queue semantics: duplicate suggestion, merge, sensitivity-zone routing checkpoint before conversion |
| Close path | `closeWorkOrder()` jumps to `closed` | Becomes the `completed` step; verification (`verified→closed`) added on top, reusing `confirmed_by/at` |

### Add (net new)

- `on_hold` with typed reason codes (incl. `awaiting_permit`, `awaiting_conservation_signoff`) + SLA pause — does not exist in any form.
- `accepted`/`declined`, `cancelled(reason)`, `reopened` states.
- Chat-on-work-order thread (messages, @mentions, requester participation).
- Conservation sign-off queue + `fm_conservationSignoff` object; protected-structure compliance checkpoint.
- Zone sensitivity model (extends `est_space.is_collection_zone` to a graded flag) + deterministic routing rules (category x site x zone).
- Email-to-ticket ingestion; public request portal with tracking link; requester notifications.
- Contractor portal slice (scoped external access — pattern borrowed from GovIQ `con_externalAccess`/Design Team persona).
- SLA escalation ladder + at-risk dashboard; make-safe/follow-on WO linkage.
- Evidence policy per category (required photos/parts/signature at completion).

Estimated existing coverage of this PRD: roughly 45–50% by surface area, concentrated in intake, gating, and audit; the state machine, SLA engine, and all heritage workflow objects are the rework/new half.

---

## 1. Problem + evidence

A curator who spots a leak is not an FM user. Today (in NMI-class institutions) fault reports travel by email, phone, and corridor conversation into a CAFM that technicians avoid, while SLA obligations live in contract PDFs nobody operationalises. The market splits into two camps that do not meet (Research Brief 03 §1):

- Mobile-first CMMS (MaintainX, UpKeep, Limble) win on adoption — chat-on-workorder, one-screen WO cards, QR capture, offline mode — but lack contract-grade SLA machinery and public-sector audit.
- Enterprise CAFM (Planon, MRI Evolution, QFM) win on SLA/contract machinery — multi-time-point SLA engines, contractor portals — but technicians won't use them.

Neither camp handles heritage at all: permit-to-work in historic fabric, conservation sign-off before works in collection zones, protected-structure statutory checks (Section 57 / BCAR) are comment fields, not workflow. Evidence anchors: Strathclyde Estates published priority bands (make-safe vs rectify split), NHS estates 24h-helpdesk SLA norms, HSE Estates reactive frameworks across ~4,440 buildings, Historic England hot-work guidance, ICOM-CC dust/vibration protocols.

FMIQ thesis: own the seam — MaintainX-grade technician UX + Concept-Evolution-grade SLA engine + heritage gates as first-class schema objects, on an audit chain built for FOI/public-sector scrutiny.

---

## 2. Personas and top journeys

| Persona | Capabilities |
|---|---|
| Requester (staff/curator) | Raise via QR/portal/email without training or login; track own requests; confirm fix; reopen |
| FM Coordinator (helpdesk) | Triage queue: categorise, set priority, merge duplicates, assign, message requester |
| Technician (in-house) | Accept/decline, execute, chat, capture evidence, complete — offline-capable mobile web |
| Supervisor / FM Manager | Queues, SLA dashboard, verify/close, escalations, issue permits, gate overrides |
| Contractor (external) | Scoped portal: accept/decline, RAMS upload, evidence, complete; sees own jobs only |
| Conservation / Collections (secondary) | Sign-off queue for sensitive-zone WOs; can hold or condition works |
| Compliance (secondary) | Protected-structure checkpoint queue; attach Section 57 / Commencement Notice refs |

Top 10 journeys, ranked by expected frequency (Research Brief 03 §6.6):

1. Staff member scans room/asset QR, reports fault with photo — no login.
2. Coordinator triages a new request: categorise, set priority, assign (or merge duplicate).
3. Technician works a job on mobile: accept → photos → complete with evidence.
4. Requester checks status / receives "completed" notification and confirms fix.
5. Coordinator dispatches to an external contractor; contractor accepts and uploads RAMS.
6. Technician puts a job on hold (awaiting parts) — SLA pauses with typed reason; requester auto-notified.
7. Supervisor reviews the SLA-at-risk dashboard; escalates or reassigns before breach.
8. Conservation reviews and signs off (or conditions) a sensitive-zone WO before works start.
9. Supervisor verifies and closes a completed P1/P2 with the full evidence pack.
10. Supervisor issues a permit-to-work (hot works/roof/near-collections) against a WO.

Below the line: monthly contract KPI report; reopen-on-failed-fix; raise follow-on permanent repair from a make-safe.

---

## 3. Scope (pilot MVP) and non-goals

### In scope

- Intake: QR no-login form (primary), public web portal, email-to-ticket, helpdesk phone entry (coordinator form). System-generated WOs (PPM/excursion) enter the same pipeline (already wired via `source`).
- Triage queue with deterministic routing (category x site x zone sensitivity), duplicate suggestion, merge.
- Full 11-state lifecycle with typed holds, verification, reopen.
- One-screen WO card with chat thread and photo evidence.
- SLA engine: P1–P4+Planned, dual respond/rectify clocks, business-hours calendars, pause rules, heritage uplift, 75%/100%/breach escalation ladder.
- Heritage gates: permit-to-work, conservation sign-off, protected-structure checkpoint — as schema objects enforced by the existing gate engine.
- Contractor portal slice: accept/decline, RAMS upload + named-reviewer approval, evidence, complete.
- Requester notifications (triaged / scheduled / completed) + tracking link.

### Non-goals (explicit)

- **Native mobile app — later.** Responsive web (existing PWA + offline queue) first. No App Store builds in the pilot.
- **AI routing/triage — flagged off.** v1 ships deterministic rules only (`ruleBasedTriage` stays rule-based). NLP classification of email intake is a later, flagged assist.
- No parts/inventory procurement workflow beyond the existing parts picker (inventory module is separate).
- No PPM schedule builder changes (module exists; it only feeds this pipeline).
- No voice notes, no BMS-triggered intake changes, no visitor-facing reporting.
- No per-client forks: heritage gates and SLA bands are tenant configuration, not code.

---

## 4. UX flows

### 4.1 QR / no-login fault report

Scan with native camera → tenant-scoped URL opens a form with asset/room pre-populated (existing `resolveAssetByQr` lookup, exposed anonymously). Fields: "What's wrong?" (free text), photo (camera), optional name/email, optional staff code (per-tenant toggle to deter abuse). On submit: duplicate check — open requests for the same asset/space shown ("Leak in Room 2.14 already reported — add your photo to it?"). Submit creates a `req_request` (channel `qr`), returns a tracking link. Target: under 60 seconds end-to-end, zero training.

### 4.2 Triage queue (coordinator)

Single queue of untriaged requests, newest + highest auto-priority first. Per row: description, photo thumbnail, location, channel, suggested category/priority (deterministic rules), duplicate candidates. Actions: set category (dropdown, not free text) + priority, merge into existing request/WO, reject (with reason, requester notified), convert to WO (assign technician or contractor). Sensitive-zone and protected-structure flags surface here as routing checkpoints — conversion into a flagged zone routes the WO through the relevant gate queues rather than silently dispatching.

### 4.3 Work order card (one screen)

Everything a technician needs without navigation: title, asset + location, priority band, live SLA clocks (respond/rectify, colour-banded), status, checklist, permit status banner (from gate evaluation — existing `GET /gates` preview), photo strip (before/during/after tags), chat thread, asset history link. Actions are status-appropriate: Accept/Decline, Start (gate-checked), Hold (typed reason), Complete (guided evidence capture). Chat: per-WO thread, @mentions, requester messages appear in-thread; the audit trail is complete by default — no WhatsApp side-channel.

### 4.4 Status lifecycle UX

- Hold requires a reason code from the typed list; SLA clock pauses and the requester is notified with the reason.
- Complete runs the per-category evidence policy: required photo count, parts used, labour time, failure code (existing mandatory failure-mode), signature where policy demands.
- Completed is not closed: P1/P2 and all sensitive-zone jobs enter the supervisor verification queue; P3/P4 auto-close after N days (configurable). Verifier can reopen with reason.
- Cancel (pre-completion, with reason code) reports separately from closed.

### 4.5 SLA timers + escalation

Default band table (per-contract/per-site overridable):

| Priority | Respond (attend/make-safe) | Rectify | Example |
|---|---|---|---|
| P1 Emergency | 1–2 h, 24/7 | Make safe 4 h; permanent fix scheduled | Flood, gas, power loss, active leak in a collections space |
| P2 Urgent | 4 h (working day) | 1–2 working days | Local heating loss, broken glazing, pest sighting in store |
| P3 Standard | 1 working day | 5–10 working days | Sanitaryware, non-security doors/windows |
| P4 Minor | Acknowledge | 20 working days / next visit | Decoration, minor fixtures |
| Planned | n/a | Agreed date | PPM, events set-up |

Heritage modifier: any fault in a designated sensitive zone auto-uplifts one band and notifies conservation; water + collections is always P1. Escalation ladder: 75% elapsed → warn assignee; 100% → escalate to supervisor; breach → notify contract manager + KPI log. At-risk dashboard is traffic-light sorted by time-to-breach. Make-safe satisfies the P1 respond clock and can spawn a linked follow-on WO at lower priority.

### 4.6 Contractor portal slice

Contractor signs in to a scoped view: own jobs only. Accept/decline with reason; RAMS upload before attendance (named FM reviewer approves/rejects — existing `approveRams`); insurance/competency expiry blocks dispatch (existing vault + gate); evidence upload and complete; FM verifies. No visibility of any other tenant data.

---

## 5. State machine and heritage gates

### 5.1 States (8 working + 3 terminal)

```
new → triaged → assigned → accepted → in_progress → completed → verified → closed
                              |            |
                              v            v
                          declined      on_hold (typed reason; SLA pause)
any pre-completion state → cancelled (reason code)        [terminal]
closed                                                     [terminal]
declined → (reassign → assigned)                           [working]
completed → reopened (within N days, by verifier or reporter) → assigned
```

Terminals: `closed`, `cancelled`, and `verified→closed` auto-promotion end-state; `declined` returns to the assignment pool. Rules:

- `on_hold` requires a reason code: `awaiting_parts | awaiting_access | awaiting_permit | awaiting_conservation_signoff | awaiting_contractor | awaiting_approval`. The first two pause SLA per policy; the permit/conservation holds always pause and gate `in_progress`.
- `verified` mandatory for P1/P2 and all sensitive-zone jobs; auto-skip (auto-close after N days) for P3/P4, configurable.
- Every transition writes `core_audit_log` with actor/before/after (existing discipline; keep).
- Requester notified at `triaged`, `in_progress` (scheduled date), `completed`.
- Gate-enforced transitions use the existing gate engine: `→ in_progress` runs `ssow_readiness` (today) plus the two new gates below; overrides remain role-gated + reasoned + audited.

### 5.2 Heritage gates as schema objects (not comment fields)

```sql
-- Permit-to-work: extends hs_permit (exists) with typed permit catalogue
ALTER TABLE hs_permit ADD COLUMN permit_kind text NOT NULL DEFAULT 'general'
  CHECK (permit_kind IN ('hot_works','working_at_height','roof_access','isolation',
                         'confined_space','works_near_collections','general'));
-- Gate check: WO cannot enter in_progress while a required permit_kind is unissued/expired.
-- Required kinds derive from wo_work_order.category x zone flags (fm rule table, not code).

-- Conservation sign-off: first-class object + gate
CREATE TABLE wo_conservation_signoff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid NOT NULL REFERENCES wo_work_order(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','conditioned','rejected')),
  conditions text,                -- decant list, protection, dust/vibration protocol refs
  reviewer_id uuid REFERENCES core_user(id),
  decided_at timestamptz
);

-- Protected-structure flag + statutory checkpoint
-- est_building.protected_structure already exists; add statutory references:
ALTER TABLE est_building ADD COLUMN rps_ref text;            -- Record of Protected Structures
ALTER TABLE est_building ADD COLUMN section57_on_file boolean NOT NULL DEFAULT false;
ALTER TABLE est_building ADD COLUMN aca boolean NOT NULL DEFAULT false;
CREATE TABLE wo_statutory_check (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid NOT NULL REFERENCES wo_work_order(id),
  question text NOT NULL,          -- "materially affects character?" / "triggers BCAR?"
  answer text CHECK (answer IN ('yes','no','referred')),
  reference text,                  -- Section 57 declaration / Commencement Notice ref
  decided_by uuid REFERENCES core_user(id),
  decided_at timestamptz
);
```

Both new gates register in `GATE_REGISTRY` (code) with per-tenant `gate_definition` config (data) — the existing split. A WO in a sensitive zone cannot leave `triaged` for dispatch until the conservation sign-off is `approved`/`conditioned`; a WO on a protected structure flagged "materially affects character / BCAR" routes to the compliance queue.

---

## 6. Data model deltas + SLA engine

### 6.1 Schema deltas (Postgres, RLS on every table per house pattern)

```sql
-- wo_work_order changes
--   status CHECK rewritten to the 11-state set (migration maps old → new)
--   priority CHECK → ('P1','P2','P3','P4','planned') (maps critical/high/routine)
ALTER TABLE wo_work_order ADD COLUMN respond_due timestamptz;   -- dual clocks
ALTER TABLE wo_work_order ADD COLUMN rectify_due timestamptz;   -- replaces single sla_due over time
ALTER TABLE wo_work_order ADD COLUMN responded_at timestamptz;  -- first attend/make-safe
ALTER TABLE wo_work_order ADD COLUMN made_safe boolean NOT NULL DEFAULT false;
ALTER TABLE wo_work_order ADD COLUMN parent_work_order_id uuid REFERENCES wo_work_order(id); -- make-safe → follow-on
ALTER TABLE wo_work_order ADD COLUMN category text;
ALTER TABLE wo_work_order ADD COLUMN verified_by uuid REFERENCES core_user(id);
ALTER TABLE wo_work_order ADD COLUMN verified_at timestamptz;

CREATE TABLE wo_hold (             -- typed holds; SLA pause source of truth
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid NOT NULL REFERENCES wo_work_order(id),
  reason text NOT NULL CHECK (reason IN ('awaiting_parts','awaiting_access','awaiting_permit',
    'awaiting_conservation_signoff','awaiting_contractor','awaiting_approval')),
  note text, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  pauses_sla boolean NOT NULL
);

CREATE TABLE wo_message (          -- chat-on-WO
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  work_order_id uuid NOT NULL REFERENCES wo_work_order(id),
  author_id uuid REFERENCES core_user(id),     -- null = requester via tracking link
  author_label text,                            -- display name for non-user authors
  body text NOT NULL, mentions uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- wo_sla_policy rework: per-band dual clocks + calendar + pause + uplift
ALTER TABLE wo_sla_policy ADD COLUMN respond_mins int;          -- renames response_mins semantics
ALTER TABLE wo_sla_policy ADD COLUMN calendar text NOT NULL DEFAULT '24x7'
  CHECK (calendar IN ('24x7','working_hours'));
ALTER TABLE wo_sla_policy ADD COLUMN site_id uuid REFERENCES est_site(id);  -- per-site override
CREATE TABLE wo_sla_escalation (   -- ladder config
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  threshold_pct int NOT NULL,                  -- 75 | 100 | breach(>100)
  notify_role text NOT NULL
);

-- zone sensitivity (extends est_space)
ALTER TABLE est_space ADD COLUMN sensitivity text NOT NULL DEFAULT 'none'
  CHECK (sensitivity IN ('none','sensitive','collections_critical'));

-- deterministic routing rules (data, not code)
CREATE TABLE wo_routing_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  category text, site_id uuid REFERENCES est_site(id), min_sensitivity text,
  route_to text NOT NULL,          -- queue | contractor:<id> | conservation | compliance
  priority_uplift int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true
);

-- evidence policy per category
CREATE TABLE wo_evidence_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  category text, min_priority text,
  photos_required int NOT NULL DEFAULT 1,
  parts_required boolean NOT NULL DEFAULT false,
  signature_required boolean NOT NULL DEFAULT false,
  conservation_countersign boolean NOT NULL DEFAULT false
);

-- contractor portal access (GovIQ external-access pattern)
CREATE TABLE wo_contractor_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core_tenant(id),
  contractor_id uuid NOT NULL REFERENCES wo_contractor(id),
  user_email text NOT NULL, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Plus: `req_request` gains `tracking_token text UNIQUE`, `merged_into_id uuid`, `photo_url text`; permit/building deltas per §5.2. `wo_issue_photo` gains `phase text CHECK (phase IN ('before','during','after'))`.

### 6.2 SLA engine as a pure function

Same pattern as GovIQ's engines (`runGoviqEngine`, `capStageEngine`): no DB access, no `Date.now()` inside, callers pass `now` and pre-loaded policy rows.

```typescript
type SlaVerdict = {
  respondDue: string; rectifyDue: string;
  respondState: 'met' | 'on_track' | 'at_risk' | 'breached';
  rectifyState: 'met' | 'on_track' | 'at_risk' | 'breached' | 'paused';
  pctElapsed: number;
  escalations: Array<{ thresholdPct: number; notifyRole: string; fired: boolean }>;
  appliedUplift: { from: Priority; to: Priority; reason: string } | null;
};

function evaluateSla(
  workOrder: WorkOrderSnapshot,        // opened/responded/completed timestamps, priority, zone sensitivity
  policy: SlaPolicy,                   // band table + calendar + escalation ladder for this contract/site
  holds: Hold[],                       // typed holds; pausing holds extend the clocks
  now: Date,
): SlaVerdict
```

Rules implemented in the function: business-hours calendar arithmetic; pause = sum of `pauses_sla` hold intervals; heritage uplift applied at creation (recorded, never silently); make-safe satisfies the respond clock; verdict written to the WO and to `core_audit_log` by the calling route/job, never by the engine. Test suite: every band x calendar x hold x uplift combination, plus a Strathclyde-style worked example as a regression fixture.

---

## 7. API surface

Existing routes kept (extended where noted). All under `/api/v1`, Zod-validated, RLS-scoped via `withTenant`.

| Method + path | Purpose | Status |
|---|---|---|
| `POST /public/requests` (new) | No-login QR/portal intake; per-tenant QR token + optional staff code; returns tracking token | Add |
| `GET /public/requests/:trackingToken` (new) | Requester status view + confirm-fix / reopen | Add |
| `POST /requests` | Authed intake (coordinator phone entry, staff) | Keep |
| `GET /requests?status=` | Triage queue (+ duplicate candidates per row) | Extend |
| `POST /requests/:id/merge` (new) | Merge duplicate into request/WO | Add |
| `POST /requests/:id/convert` | Convert to WO; runs routing rules + zone checkpoints | Extend |
| `POST /email/inbound` (new) | Email-to-ticket webhook (parser → request) | Add |
| `GET /work-orders?view=&state=` | Queues: mine/today/at-risk/verification | Extend |
| `GET /work-orders/:id` (new) | Full WO card payload (clocks, gates, evidence, thread) | Add |
| `PATCH /work-orders/:id/status` | Gate-enforced transition (11 states) | Extend |
| `POST /work-orders/:id/hold` + `DELETE` (new) | Open/close typed hold | Add |
| `POST /work-orders/:id/messages` (new) | Chat thread; requester posts via tracking token | Add |
| `POST /work-orders/:id/evidence` (new) | Photo (phase-tagged), parts, time, signature | Add |
| `POST /work-orders/:id/complete` | Guided closure → `completed` (evidence policy enforced) | Extend (from close) |
| `POST /work-orders/:id/verify` (new) | Supervisor verification → `verified`/`reopened` | Add |
| `GET /work-orders/:id/gates` | Gate preview banner | Keep |
| `POST /work-orders/:id/gates/:code/override` | Audited override | Keep |
| `POST /work-orders/:id/follow-on` (new) | Make-safe → linked follow-on WO | Add |
| `POST /work-orders/:id/permits` | Issue permit (typed kinds) | Extend (ssow) |
| `POST /work-orders/:id/conservation-signoff` (new) | Conservation decision (approve/condition/reject) | Add |
| `POST /work-orders/:id/statutory-check` (new) | Protected-structure checkpoint decision | Add |
| `GET /sla/at-risk` (new) | Traffic-light dashboard feed | Add |
| `POST /sla/policies` | Band table config (dual clocks, calendar, per-site) | Extend |
| `GET /portal/jobs` etc. (new) | Contractor portal: list/accept/decline/RAMS/evidence/complete — scoped to `wo_contractor_access` | Add |
| `GET /contractors/:id/scorecard` | KPI rollup | Keep |

---

## 8. Acceptance criteria (testable)

1. A reporter with no account, scanning a valid asset/room QR, can submit a fault with photo in a single form; a `req_request` row exists with channel `qr` and a tracking token is returned. Median completion time in usability testing < 60 s.
2. Submitting a request for an asset/space with an existing open request shows the duplicate prompt; choosing "add to existing" attaches the photo/comment and creates no new request.
3. A request cannot become a work order except through triage (category + priority set); `POST /requests/:id/convert` on an untriaged request returns 409.
4. The state machine rejects every transition not in §5.1 with 409 `invalid_transition`; property-based test covers all 11x11 pairs.
5. `PATCH status → in_progress` on a WO requiring a permit kind with no active permit returns 409 `gate_blocked` naming the missing permit; issuing the permit unblocks without other changes.
6. A WO in a space with `sensitivity != 'none'` cannot be dispatched until `wo_conservation_signoff.status` is `approved` or `conditioned`; `rejected` forces `cancelled` or re-triage.
7. A WO on a building with `protected_structure = true` and statutory answer `yes`/`referred` appears in the compliance queue and cannot be assigned to a contractor until the check is decided with a reference recorded.
8. Entering `on_hold` requires a reason code (400 without); a `pauses_sla` hold of duration D extends both due clocks by exactly D (engine unit test).
9. `evaluateSla` is pure: same inputs → same verdict; no DB or clock access (lint rule + test); Strathclyde worked example passes as a fixture.
10. At 75% elapsed the assignee notification fires once; at 100% the supervisor escalation fires once; breach writes a KPI log row — verified by clock-stepped tests.
11. P1 heritage uplift: a P2-classified fault in a `collections_critical` zone is stored as P1 with `appliedUplift` recorded in the audit log; water-category faults in collection zones are always P1.
12. Completing a WO whose evidence policy requires 2 photos + signature with fewer photos or no signature returns 400 listing the missing items.
13. A completed P1/P2 or sensitive-zone WO is not `closed` until a supervisor verifies; a completed P3/P4 auto-closes after the configured N days (job test).
14. Reopening within N days returns the WO to `assigned`, links the original evidence, and notifies the previous assignee.
15. A contractor portal user sees only WOs dispatched to their `contractor_id` (RLS + scope test with two contractors); expired insurance/competency blocks dispatch with a named reason.
16. RAMS approval records a named reviewer; a contractor WO cannot enter `in_progress` with RAMS `pending` or `rejected`.
17. Every transition, hold, gate evaluation, override, message, and verification writes `core_audit_log` with actor/before/after; the append-only grant is asserted in a migration test.
18. Requester receives notifications at `triaged`, scheduling, and `completed`; the tracking link shows live status without authentication and exposes no other tenant data.
19. Make-safe on a P1 satisfies the respond clock and the follow-on WO carries `parent_work_order_id`; the KPI report counts the P1 as responded-on-time.
20. The technician PWA queues status changes, holds, photos, and messages offline and replays them in order on reconnect (existing queue extended; integration test).

---

## 9. Success metrics

| Metric | Target |
|---|---|
| QR fault report, scan → submitted | < 60 s median, no training |
| Technician daily-active / rostered technicians | > 80% by pilot week 4 |
| Requests arriving via self-service channels (QR/portal/email) vs phone | > 60% by pilot week 8 |
| P1/P2 respond-SLA compliance visible per contract | 100% of WOs carry live clock state |
| "Where is my request?" follow-up contacts | down 75% vs baseline (tracking link + notifications) |
| Work conversations inside WO threads vs external channels | > 90% of evidence-bearing messages in-thread |
| Sensitive-zone WOs with conservation sign-off before works start | 100% (hard gate) |
| Hold-reason analytics available (bottleneck report by reason code) | shipped in pilot |
| Completed-without-evidence closures | 0 (policy-enforced) |

---

## 10. Phasing

### Phase A — earliest shippable slice (pilot core, ~journeys 1–4, 6)

State-machine expansion + migration; P1–P4 band model; dual-clock SLA pure function with holds and at-risk dashboard; QR no-login intake + tracking link + duplicate suggestion; triage queue (categorise/priority/assign/merge); one-screen WO card with chat thread and phase-tagged photos; guided completion with evidence policy; verification queue (completed ≠ closed); requester notifications. Heritage gating in Phase A is the minimum hard set: sensitivity flag + conservation sign-off gate (it is the wedge — it ships first, not last).

### Phase B — contract machinery (journeys 5, 7, 9, 10)

Contractor portal slice (access table, scoped routes, RAMS named-reviewer approval, dispatch blocks); typed permit kinds + permit gate wiring; escalation ladder notifications; make-safe/follow-on linkage; per-site/per-contract SLA overrides + business-hours calendars; contractor KPI rollups.

### Phase C — breadth

Email-to-ticket parser; protected-structure statutory checkpoint queue (Section 57/BCAR); public web portal polish; hold-reason bottleneck analytics; monthly contract KPI report; reopen flows hardened; evidence-pack export integration.

### Later (explicitly deferred)

Native mobile apps (responsive PWA holds until pilot evidence demands otherwise); AI/NLP triage assist behind a flag; voice notes; sensor/BMS-driven intake changes; cross-tenant benchmarking.

END — v0.1 — 2026-06-11
