# Mock run-through — full council pipeline (no network, no keys)

This is a captured transcript of the **real** review engine — orchestrator,
discipline agents, 7-check self-check gate, peer challenge, adjudicator and
chair from `src/` — executed end-to-end over the same sample pack (with the
same planted issues) that `scripts/run-review.mjs` sends to a live deployment.
Only two things are substituted: the LLM is a scripted stub (deterministic
replies, zero cost) and persistence is in-memory instead of Convex.

What it demonstrates, stage by stage:

1. **Review fan-out** — four discipline jobs run in isolation
   (`review:architect` … `review:qs`); every candidate finding passes the
   7-check self-check gate and each decision is audit-logged (`self_check`).
2. **Peer challenge** — every discipline challenges every other discipline's
   findings (21 challenge verdicts here). Fire Safety **escalates**
   ARCH-PRE-0001 (REI 30 partitions vs the granted FSC's REI 60 requirement)
   to **Critical**.
3. **Adjudication** — deterministic file-06 rules apply the escalation and
   record one council decision per finding.
4. **Chair report** — the rating↔decision invariant is derived in code: a
   Critical finding forces **Red / Pause before build**. The locked
   disclaimer is attached verbatim.
5. **Terminal state** — the scan ends `released`, with the full audit trail.

To run the same flow for real against the live deployment:
`node scripts/run-review.mjs` (requires `npx convex dev` + provider keys —
see docs/35).

---

```text
VerifIQ — mock run-through transcript
======================================

Engine: REAL orchestrator, agents, self-check gate, peer challenge,
adjudicator and chair from src/. Only the LLM is a scripted stub
(no network, no keys) and persistence is in-memory instead of Convex.

Project:  Demo · Adult Day Service (Stage 2C) — pre-tender
Pack:     4 documents across architect / fire / access / qs

── Job DAG ─────────────────────────────────────────────────────────
succeeded: review:architect, review:fire, review:access, review:qs, peer_challenge, adjudicate, report
failed:    (none)
final scan_state: released

── Findings register (post-adjudication) ──────────────────────────
[CRITICAL] ARCH-PRE-0001 · Architect · Coordination issue
  The architectural specification schedules all partitions at REI 30 with no compartment wall type, while the granted Fire Safety Certificate requires REI 60 compartment walls. The tender pack cannot be built as specified without breaching the FSC.
  source: Architectural Works Specification.txt — "partition assembly: REI 30 or better to BS EN 13501-2"
  impact: Pre-tender close-out · owner: Lead Architect
  question: Which wall types form the compartment lines, and at what rating?

[MEDIUM] ARCH-PRE-0002 · Architect · Non-compliant
  The preliminaries instruct tenderers to apply VAT at 21%, which is not the current standard rate; tender sums will be misstated across all returns.
  source: Architectural Works Specification.txt — "VAT to be applied at 21%"
  impact: Pre-tender close-out · owner: Lead Architect
  question: Confirm the VAT rate to be applied in the Form of Tender.

[MEDIUM] ARCH-PRE-0003 · Architect · Clarification required
  The specification cover page names a different project ('Proposed School, Co. Mayo') than the works being tendered (Adult Day Service, Dublin), indicating un-reviewed reuse of a previous document.
  source: Architectural Works Specification.txt — "Cover page: 'Proposed School, Co. Mayo'"
  impact: Pre-tender close-out · owner: Lead Architect
  question: Is the specification content verified for this project, beyond the cover page?

[HIGH] FIRE-PRE-0001 · Fire Safety · Non-compliant
  Fire dampers are specified to BS 476: Part 7, a surface-spread-of-flame test that is withdrawn and not a damper fire-resistance standard; compliant dampers cannot be procured against this clause.
  source: Fire Safety Strategy.txt — "Fire dampers: provide to BS 476: Part 7"
  impact: Pre-tender close-out · owner: Fire Engineer
  question: Confirm the damper test standard to be specified.

[MEDIUM] FIRE-PRE-0002 · Fire Safety · Not demonstrated
  The cause-and-effect matrix (Appendix F) is referenced but not included in this issue, so interfaces between detection, dampers and plant shutdown cannot be reviewed or priced.
  source: Fire Safety Strategy.txt — "Appendix F not included in this issue"
  impact: Pre-construction close-out · owner: Fire Engineer
  question: When will Appendix F be issued?

[HIGH] ACC-PRE-0001 · DAC / Accessibility · Not demonstrated
  The ceiling-mounted track hoist for the Changing Places WC has no stated SWL, no structural pad or back-plate detail, and no commissioning standard, so the installation cannot be verified as safe or compliant.
  source: Sanitary Schedule 40006.txt — "No SWL stated; no structural pad/back-plate; no commissioning standard referenced."
  impact: Pre-tender close-out · owner: Lead Architect
  question: What SWL and commissioning standard apply to hoist HOI001?

[HIGH] QS-PRE-0001 · Quantity Surveyor · Not demonstrated
  The Date for Substantial Completion is left blank in the Form of Tender; tenderers cannot price prelims or assess liquidated damages exposure under Clause 9.5.
  source: Form of Tender — Schedule Part 1.txt — "Date for Substantial Completion: ____________ (left blank)"
  impact: Pre-tender close-out · owner: Quantity Surveyor
  question: What is the Date for Substantial Completion?

── Peer challenges ────────────────────────────────────────────────
FIRE-PRE-0001: Retained (Architect)
  Source quote verified; risk rating proportionate.
FIRE-PRE-0002: Retained (Architect)
  Source quote verified; risk rating proportionate.
ACC-PRE-0001: Retained (Architect)
  Source quote verified; risk rating proportionate.
QS-PRE-0001: Retained (Architect)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0001: Escalated → Critical (Fire Safety)
  REI 30 partitions against a granted FSC requiring REI 60 compartment walls is a life-safety conflict that voids the certificate if built.
ARCH-PRE-0002: Retained (Fire Safety)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0003: Retained (Fire Safety)
  Source quote verified; risk rating proportionate.
ACC-PRE-0001: Retained (Fire Safety)
  Source quote verified; risk rating proportionate.
QS-PRE-0001: Retained (Fire Safety)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0001: Retained (DAC / Accessibility)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0002: Retained (DAC / Accessibility)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0003: Retained (DAC / Accessibility)
  Source quote verified; risk rating proportionate.
FIRE-PRE-0001: Retained (DAC / Accessibility)
  Source quote verified; risk rating proportionate.
FIRE-PRE-0002: Retained (DAC / Accessibility)
  Source quote verified; risk rating proportionate.
QS-PRE-0001: Retained (DAC / Accessibility)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0001: Retained (Quantity Surveyor)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0002: Retained (Quantity Surveyor)
  Source quote verified; risk rating proportionate.
ARCH-PRE-0003: Retained (Quantity Surveyor)
  Source quote verified; risk rating proportionate.
FIRE-PRE-0001: Retained (Quantity Surveyor)
  Source quote verified; risk rating proportionate.
FIRE-PRE-0002: Retained (Quantity Surveyor)
  Source quote verified; risk rating proportionate.
ACC-PRE-0001: Retained (Quantity Surveyor)
  Source quote verified; risk rating proportionate.

── Adjudications ──────────────────────────────────────────────────
ARCH-PRE-0001: Escalated — peer (Fire Safety) escalated to Critical
ARCH-PRE-0002: Retained — Evidence-supported; retained as flagged.
ARCH-PRE-0003: Retained — Evidence-supported; retained as flagged.
FIRE-PRE-0001: Retained — Evidence-supported; retained as flagged.
FIRE-PRE-0002: Retained — Evidence-supported; retained as flagged.
ACC-PRE-0001: Retained — Evidence-supported; retained as flagged.
QS-PRE-0001: Retained — Evidence-supported; retained as flagged.

── Build Readiness Report ─────────────────────────────────────────
rating:   Red
decision: Pause before build
disciplines reviewed: Architect, Fire Safety, DAC / Accessibility, Quantity Surveyor
summary:  The pack is materially incomplete for tender. One critical coordination conflict (partition fire ratings vs the granted FSC) and four high findings (withdrawn damper standard, hoist safety data, blank completion date) must close before issue. Document control errors (wrong project on cover page, VAT rate) indicate the pack needs a controlled re-issue.
recommendation: Pause before build: close the FSC compartmentation conflict and re-issue the pack; the remaining high findings are pre-tender close-outs.

disclaimer: VerifIQ is a software-based reading aid. It surfaces, in the documents' own words, what a registered professional may wish to read closely. It does not certify, sign, opine, or substitute for professional judgement. The registered designer reads our output, exercises their own judgement, verifies locally, and signs. The professional indemnity remains theirs. We carry product-quality risk only.

── Audit trail (actions in order) ─────────────────────────────────
self_check (architect) [stage: review]
self_check (architect) [stage: review]
self_check (architect) [stage: review]
discipline_review_completed (architect) [stage: review]
self_check (fire) [stage: review]
self_check (fire) [stage: review]
discipline_review_completed (fire) [stage: review]
self_check (access) [stage: review]
discipline_review_completed (access) [stage: review]
self_check (qs) [stage: review]
discipline_review_completed (qs) [stage: review]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
peer_challenge [stage: peer_challenge]
adjudication [stage: adjudicate]
adjudication [stage: adjudicate]
adjudication [stage: adjudicate]
adjudication [stage: adjudicate]
adjudication [stage: adjudicate]
adjudication [stage: adjudicate]
adjudication [stage: adjudicate]
report_released [stage: report]

LLM calls made: 10 (discipline-primary-review, discipline-primary-review, discipline-primary-review, discipline-primary-review, peer-challenge, peer-challenge, peer-challenge, peer-challenge, adjudicator, council-chair)
```
