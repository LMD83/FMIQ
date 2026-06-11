# 21 · Agent Calibration Framework

**Use:** The HOW behind the lessons-learnt loop's **refine** and **test** stages (`15_lessons_learnt_loop.md` § Stage 5–6). This file defines the mechanics: how accumulated rejection feedback turns into specific prompt updates, how those updates are validated, and how they're safely promoted to production.

**Why this exists:** the lessons-learnt loop says "we improve the agents." This file says exactly what "improve" means — what knobs we turn, how we measure that we turned them in the right direction, and what we never do.

**Version:** v1.0 · 2026-06-01

---

## What "calibration" means here — boundaries

Calibration in VerifIQ is:

- ✅ Updating system prompts (`04_agent_prompts.md`, `13_agent_self_check_protocol.md`)
- ✅ Adding few-shot examples (positive + negative)
- ✅ Recalibrating risk-rating thresholds (`06_risk_rules.md`)
- ✅ Updating discipline routing rules
- ✅ Updating corpus versions
- ✅ Updating model assignment per agent role
- ✅ Building per-sector / per-stage / per-charter overlays

Calibration is **not**:

- ❌ Fine-tuning the underlying LLM (Claude / GPT / Gemini) — too expensive, locks us in, customer data implications
- ❌ Training a custom model from scratch — out of scope forever
- ❌ Automated prompt mutation without human review — every change passes founder + chartered reviewer Stage 5 gate
- ❌ Tuning to individual designer / customer preferences — we calibrate against patterns, not personalities
- ❌ Adjusting based on a single rejection — patterns require ≥3 instances over ≥4 weeks

---

## The five calibration knobs

The agent system has five tunable knobs. Each is described below with: what it controls, what evidence triggers a turn, how to turn it, and how to test the result.

---

### Knob 1 · Discipline-prompt refinement

**What it controls:** how each discipline agent reads its source documents — what to flag, what to ignore, what counts as evidence.

**Evidence that triggers a turn:**

- Specific rejection patterns from `14_feedback_taxonomy.md` (REJ-01 false positive, REJ-08 stage-inappropriate, REJ-12 generic/not actionable, etc.) clustering on one agent.
- Agent acceptance rate below the discipline baseline by ≥1.5 standard deviations over a rolling 4-week window.
- Counter-rejection rate (chartered reviewer overrides design-team rejection) > 15% for one agent — indicates agent is technically correct but the design team rejected for procedural reasons.

**How to turn it:**

1. **Update the agent's "Assess" list** in `04_agent_prompts.md` (or `17_phase2_agents.md` for Phase 2) — add a check or remove a check.
2. **Update the agent's "Flag" list** — refine what triggers a finding emission.
3. **Tighten the self-check protocol** for that agent in `13_agent_self_check_protocol.md` — add a specific override or scope note.
4. **Add to the negative-example library** in `13_agent_self_check_protocol.md` § Negative example library — the specific pattern that produced false positives, with right/wrong contrast.

**Versioning:**

- Patch (e.g., `arch-agent-1.2.3` → `arch-agent-1.2.4`): wording-only clarifications.
- Minor (`arch-agent-1.2.x` → `arch-agent-1.3.0`): new check, new flag, new negative example.
- Major (`arch-agent-1.x.x` → `arch-agent-2.0.0`): structural rewrite of the agent's scope.

**Test:** see § "The hold-out test set" below.

---

### Knob 2 · Few-shot example library

**What it controls:** the in-context examples the agent sees when reasoning, which calibrate it without changing the prompt structure.

**Evidence that triggers a turn:**

- Same rejection pattern recurring across multiple agents — indicates a system-level calibration gap, not a per-agent one.
- Customer correction of classification (a labelled training example arrives automatically — see file 20 § 4).
- Counter-rejection where reviewer's reasoning is itself a teachable example.

**How to turn it:**

The few-shot library lives in its own directory: `verifiq-prompts/few-shots/`. Each agent has subdirectories:

```
verifiq-prompts/few-shots/
  ├─ architect/
  │   ├─ positive/   ← findings the agent SHOULD emit
  │   │   ├─ ARCH-FS-001.md  (anonymised; verbatim source quote; emission)
  │   │   └─ ...
  │   ├─ negative/   ← drafts the agent should SUPPRESS
  │   │   ├─ ARCH-NEG-001.md  (the draft; why it's wrong; what to do instead)
  │   │   └─ ...
  │   └─ edge_cases/ ← unusual situations with worked treatments
  ├─ fire/
  ├─ access/
  └─ ...
```

Each example is structured:

```markdown
# Example {{id}} — {{title}}

## Source quote
"[verbatim from source document]"

## Context
- Document: {{anonymised_doc_ref}}
- Stage: {{stage}}
- Discipline: {{discipline}}

## The right action
{{Emit as finding | Suppress | Flag interface to discipline X | etc.}}

## Why
{{One-paragraph reasoning}}

## Banned drift
{{What an agent might be tempted to do; explain why that's wrong}}
```

At inference time, the agent loads the relevant few-shot examples (typically 3 positive + 3 negative + 1 edge case for the file type being reviewed). The corpus loader handles this.

**Library size targets:**

| Window | Library size per agent |
|---|---|
| MVP launch | 5 positive + 5 negative + 2 edge cases (seeded by founder + chartered reviewer) |
| 3 months post-launch | 15 / 15 / 5 |
| 12 months post-launch | 50 / 50 / 15 |

**Anonymisation rule:** every example is anonymised before entering the library. No customer identifiers. No project addresses. No designer names. Verbatim source quotes are preserved (technical content is not identifying), but title-block content is redacted.

---

### Knob 3 · Risk-rating recalibration

**What it controls:** the boundary between Critical / High / Medium / Low / Advisory ratings per finding category.

**Evidence that triggers a turn:**

- REJ-06 (risk over-rated) clustering on one finding category — design teams consistently downgrade.
- REJ-07 (risk under-rated) clustering on one finding category — design teams consistently upgrade.
- Reviewer override of agent risk rating > 20% on one category.

**How to turn it:**

1. **Identify the finding category** that's miscalibrated (e.g., "standards prefix typo," "BCAR doc-set incomplete," "fire compartmentation").
2. **Read the rejection comments** to understand WHY design teams are re-rating.
3. **Update `06_risk_rules.md`** with a specific override for that category.

Example: if "I.S. EN 10101 typo" (REJ-06 cluster) was flagged Medium but consistently downgraded to Low:

```markdown
### Standards prefix / typo category override

A standards prefix typo (e.g., "I.S. EN 10101" cited where I.S. 10101 exists)
is **Low** by default — the correct standard is obvious from context, and the
design team will read it correctly in tender. Upgrade to Medium only if:
- The typo creates genuine ambiguity (multiple plausible standards), OR
- The typo appears in a statutory submission (FSC, DAC, BCAR)
```

4. **Update the `Critical override` section** in `06_risk_rules.md` if the category warrants permanent escalation.

5. **Update the relevant agent's prompt** in `04` or `17` to apply the new rule consistently.

**Test:** see § "The hold-out test set."

---

### Knob 4 · Discipline routing

**What it controls:** which agent owns which finding. Drives the interface_disciplines field and prevents cross-discipline finger-pointing.

**Evidence that triggers a turn:**

- REJ-05 (wrong discipline) clustering on one agent — that agent keeps flagging findings outside its scope.
- Reviewer routing-overrides > 15% on one agent — chartered reviewer is consistently re-routing.
- Findings with same source-document SHA-256 emitted by two agents independently (duplicate emission, routing failure).

**How to turn it:**

1. **Update the discipline agent's "You must assess" list** to remove the over-stepped scope.
2. **Update the destination discipline agent's prompt** to ensure it's catching what the wrong-routing agent had been catching.
3. **Update `02_agent_architecture.md` § Discipline Review Agents** if a discipline boundary itself needs to move.
4. **Add a redirect rule** in the workflow orchestrator: "if Agent X identifies an issue matching pattern Y, route to Agent Z."

---

### Knob 5 · Model assignment per agent role

**What it controls:** which underlying LLM provides inference for which agent role.

**Evidence that triggers a turn:**

- One model consistently outperforms another on acceptance rate over a rolling 8-week window for a specific role.
- Cost per scan trending upward without quality improvement — cheaper model may suffice.
- Vendor outage causing repeated failover — primary should change.

**How to turn it:**

1. **Update `02_agent_architecture.md` § Multi-LLM configuration** to reflect new role-to-model mapping.
2. **Update the runtime config** (env var or admin UI) to route the role to the new model.
3. **Run the new mapping against the hold-out set** (below) before promoting.

**Default starting point** (per file 02):

| Role | Provider | Model |
|---|---|---|
| Classification | Anthropic | Haiku |
| Title-block vision | Anthropic | Sonnet (vision-capable) |
| Discipline Primary Review | Anthropic | Sonnet |
| Peer Challenge | OpenAI | GPT-4-class |
| Adjudicator | Anthropic | Opus / Sonnet |
| Council Chair | Anthropic | Sonnet |

**Switching trigger:** if any role's quality metric degrades >10% over 4 weeks AND the alternative model on the hold-out set shows ≥5% improvement, switch.

---

## The hold-out test set

Every calibration change is tested against a hold-out set BEFORE it reaches production.

### What the hold-out set is

A library of historical packs (anonymised) where the "right answers" are known — either from chartered-reviewer adjudication, design-team feedback consensus, or expert relabelling.

### Initial seed (MVP launch)

- The 327-finding validation pack at `verifiq26/evidence/findings-register-v0.8-scan-view.xlsx` as Pack #1.
- 5 additional packs sourced from public-domain or fully-consented sources before MVP launch (founder + chartered reviewer pre-labels).

### Growth target

| Window | Hold-out packs |
|---|---|
| MVP launch | 1 (the validation pack) |
| End of Month 3 | 5 |
| End of Month 6 | 10 |
| End of Year 1 | 20 |

### What each hold-out pack carries

```
hold-out/
  pack-001-anonymised/
    documents/              ← the actual files (anonymised)
    expected_findings.json  ← what the system SHOULD find (Critical, High, Medium)
    expected_suppressions.json ← what the system SHOULD NOT find (negative examples)
    expected_decision.json  ← the Build Readiness Decision (Proceed / Conditions / etc.)
    metadata.json           ← sector, stage, building type, etc.
    revisions/              ← if multi-revision, each revision separately scored
```

### Test execution

When a calibration change is proposed:

1. Run the new prompt/rule against EACH hold-out pack in test mode (uses Haiku throughout to keep cost trivial).
2. For each pack, compare emitted findings to `expected_findings.json`:
   - **Recall**: how many expected findings the agent emitted.
   - **Precision**: how many emitted findings were expected.
   - **Critical recall** specifically: did it catch every Critical it was supposed to?
3. Compare against `expected_suppressions.json`:
   - **False-positive rate**: how many "should not flag" patterns it incorrectly emitted.
4. Compare the final Build Readiness Decision against `expected_decision.json`:
   - **Decision match**: did it land on the same of the four decisions?

### Gates to promote

| Metric | New prompt must achieve |
|---|---|
| Critical recall | ≥ 95% of expected Critical findings caught |
| Overall recall | ≥ 80% of all expected findings caught |
| False-positive rate | ≤ 10% on expected suppressions |
| Decision match | 100% on Build Readiness Decision |
| Cost per scan | within 20% of baseline (or improvement) |

If any gate fails → prompt change rejected. Founder + chartered reviewer review the failure and decide: refine the prompt change further, or accept the trade-off as documented in the audit log.

---

## A/B framework — in-production validation

After a prompt change passes the hold-out gates, it goes to A/B in production for a minimum 4-week window:

### Mechanics

- Random 50% of incoming paid packs run the NEW prompt; 50% run the CURRENT prompt.
- Assignment is sticky per pack — same pack always uses same prompt (consistency).
- Customers are NOT told which prompt they got — A/B is invisible.
- Pack-level metrics (acceptance rate, rejection reason distribution, reviewer override rate) are tagged with `prompt_version` for analysis.

### Promotion criteria (after 4 weeks minimum)

| Metric | New prompt must achieve |
|---|---|
| Acceptance rate | ≥ current prompt (within statistical confidence) |
| Critical-finding capture | No Critical findings lost compared to current |
| Compute cost per scan | ≤ current + 20% (or improvement) |
| Reviewer override rate | ≤ current |
| Customer-raised complaint rate | 0 NEW complaints attributable to the change |

If all five pass → promote. The new prompt becomes the production version. Old prompt archived with rationale.

If any one fails → rollback. Document why. Refine and re-test.

### Sample size requirements

| Acceptance-rate baseline | Min sample for 95% confidence on 5pp improvement |
|---|---|
| 50% baseline | ~390 findings per arm |
| 70% baseline | ~340 |
| 85% baseline | ~210 |

At pilot volume (3-5 paid packs per week × ~120 findings each = 360-600 findings/week), each arm gets sample within ~2 weeks. Padding gives the 4-week minimum.

---

## Per-sector calibration

Different building sectors have systematic differences in what findings matter, what gets rejected, what the chartered reviewer escalates.

### Sector overlay layers

The base agent prompt (file 04 / 17) is the same across all sectors. Per-sector overlays layer on top:

```
verifiq-prompts/overlays/
  healthcare/
    architect-overlay.md      ← additional checks specific to healthcare
    fire-overlay.md           ← TGD B Vol 2 healthcare-specific
    sector-regulator-overlay.md ← HIQA / MHC / Tusla activation
  education/
    architect-overlay.md      ← DoE TGD-021 specifics
    access-overlay.md         ← schools accessibility specifics
  data_centre/
    mech-overlay.md           ← EN 50600 / TIA-942 specifics
    elec-overlay.md           ← UPS / generator / N+1 specifics
  heritage/
    architect-overlay.md      ← Conservation Architect activation
    structural-overlay.md     ← retained fabric specifics
  ... etc
```

### When to build a sector overlay

Trigger: VerifIQ has reviewed ≥5 packs in a sector AND the agent acceptance rate differs from the overall baseline by ≥10 percentage points (in either direction).

### Overlay versioning

Each overlay is versioned independently of the base agent prompt: e.g., `arch-healthcare-overlay-1.0.0`. Promotion through the same hold-out + A/B framework.

---

## Per-reviewer calibration

Different chartered reviewers may judge differently. We track this but do NOT calibrate the agent to one reviewer's preferences — we calibrate against patterns across the panel.

### What we track

- Per-reviewer acceptance/rejection patterns
- Per-reviewer override frequency (when reviewer overrides design team's rejection)
- Per-reviewer time-to-review

### What we do with the data

- Identify reviewer outliers (one reviewer rejecting 40% of findings when panel average is 18% — calibration conversation, not punishment).
- Identify reviewer consensus on specific finding categories — these inform agent calibration.
- Identify reviewer-specific bias (e.g., reviewer A consistently demands more architectural detail than panel average — discuss in quarterly retrospective).

### What we don't do

- Adjust agent output based on which reviewer is assigned.
- Show one reviewer's profile to customers.
- Use reviewer data for compensation decisions.

---

## Per-stage calibration

Findings at pre-tender have different expected acceptance patterns from findings at construction monitoring.

### The pattern

- At pre-tender: design team is open to material findings — high acceptance, low REJ-08 (stage inappropriate).
- At construction: design is largely frozen — material findings less actionable, REJ-08 cluster more likely.
- At post-completion audit: only highest-stakes findings have value.

### Calibration response

For each agent, maintain stage-aware risk-rating defaults. Example:

```markdown
### Architectural finding stage-appropriateness

| Finding type | Pre-tender | Post-award | Construction |
|---|---|---|---|
| Missing dimension on critical detail | High | High | Critical (build-blocker) |
| Inconsistent room naming | Medium | Low | Advisory |
| Material specification ambiguity | High | Critical | Critical (RFI-required) |
```

---

## Quarterly retrospective

Every 90 days, the calibration framework holds a retrospective covering:

1. **What was changed.** Every prompt version, every overlay, every risk-rating recalibration in the quarter.
2. **What moved metrics.** Did the change in agent X improve the acceptance rate? By how much?
3. **What didn't work.** Changes promoted to A/B that rolled back. Why.
4. **What's emerging.** New rejection patterns identifying agents we should build or scope we should narrow.
5. **What to do next quarter.** Top 5 calibration priorities for the next 90 days.

### Output

A `docs/calibration/YYYY-Q{N}-retrospective.md` document covering the above. Reviewed with the chartered reviewer panel at the quarterly panel session. Distributed to the founder, board (if applicable), and the panel members.

### Public communication

A short summary (≤500 words) of the calibration changes that quarter is published on `verifiq.ie/calibration` — transparent to customers. They see we are actively tuning the system, not letting it drift.

---

## Calibration governance

Every calibration change has a documented decision-maker, decision-date, and rationale:

| Calibration change type | Decision-maker | Required sign-off |
|---|---|---|
| Wording-only patch (no behaviour change expected) | Founder | None |
| New negative example added | Founder | None |
| New positive example added | Founder | None |
| Discipline-prompt minor version bump | Founder | Chartered reviewer chair |
| Discipline-prompt major version bump | Founder | Full chartered reviewer panel + 4-week A/B |
| Risk-rating rule change | Founder | Chartered reviewer chair + 4-week A/B |
| Discipline routing change | Founder | Chartered reviewer chair + full hold-out + A/B |
| Model assignment change | Founder | Chartered reviewer chair |
| New sector overlay | Founder | Chartered reviewer for that sector + A/B |

Every change is logged to `audit_log` with: change_type, decision_maker, decision_date, rationale, before-after diff, A/B results if applicable.

---

## The calibration anti-patterns

These violate the framework and must not happen:

| Anti-pattern | Why it's wrong |
|---|---|
| Adjusting agent output to one specific customer's preferences | Tunes to noise; loses other customers |
| Adjusting based on one rejection | One data point is noise; calibrate on patterns |
| Skipping hold-out test "because the change is obviously right" | Most regressions come from "obviously right" changes |
| Skipping A/B "because we're behind schedule" | Production is where customers are; speed-second |
| Calibrating without chartered reviewer sign-off (on major changes) | Loses the audit defensibility we depend on |
| Calibrating to make a specific customer's pack pass | Defeats the entire purpose |
| Reverse-calibrating (loosening the rules to please customers) | Customers will eventually catch us, and the chartered audience is unforgiving |

---

## What this calibration framework REFUSES

- **Automated prompt evolution without human review.** Every change goes through Stage 5 (Refine) of `15_lessons_learnt_loop.md`.
- **Fine-tuning the underlying LLM.** We work with prompts and examples, not model weights.
- **Training a custom model on customer data.** Customer data is for review, not for training. Locked in `verifiq-prompts/15_lessons_learnt_loop.md` § "What this is NOT."
- **Customer-specific or designer-specific calibration.** Patterns across the panel only.
- **Loosening standards to maximise acceptance rate.** Acceptance rate is a quality signal, not a goal.

---

## Sequencing — what calibration looks like in the first year

| Window | Calibration activity |
|---|---|
| Pre-launch | Seed few-shot library: 5 positive + 5 negative per agent, manually curated by founder + chartered reviewer. Build initial hold-out set with 1 anonymised pack. |
| Month 1 | Capture feedback. No calibration changes — too little data. |
| Month 2 | First aggregation report. Founder + chartered reviewer pattern-spot. Likely refinements: 2-3 negative examples added. |
| Month 3 | First A/B test in production (likely a discipline prompt patch). 4-week window starts. |
| Month 4 | First promotion of a calibrated prompt. First quarterly retrospective. |
| Month 6 | First per-sector overlay built (most-used sector). 5-pack hold-out set. |
| Month 9 | First major-version prompt revision (typically the agent with the highest rejection rate). 10-pack hold-out set. |
| Month 12 | First annual review of the calibration framework itself. Adjust governance, gates, sample sizes as data dictates. |

---

## The single sentence

> *Calibration in VerifIQ is a five-knob, two-gate, four-week-A/B, chartered-reviewer-signed-off process that turns rejection feedback into specific prompt improvements — never automated, never customer-specific, never at the expense of the locked legal posture.*

---

*Build the calibration framework alongside the lessons-learnt loop in Phase 8. Start with Knob 1 (discipline-prompt refinement) and Knob 2 (few-shot library) — the other three knobs come into play after Month 3 when there's enough data to support them.*
