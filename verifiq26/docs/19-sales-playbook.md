# VerifIQ — Sales Playbook

**Doc ID:** `verifiq-sales-v0.1`  
**Status:** Operating playbook · Liam-only during solo phase  
**Purpose:** The conversation flow from inbound enquiry to signed pilot. Demo script, discovery questionnaire, inbound SOP, kickoff template, customer-success cadence.  
**Date:** 2026-06-01

---

## 1 · Inbound Enquiry Handling SOP

**Trigger:** Anyone fills the brief request form on `verifiq.ie`, sends `hello@verifiq.ie`, or messages on LinkedIn.

**SLA:** Reply in person within 24 hours (target), 48 hours (worst case).

**Workflow:**

1. **Acknowledge within 2 hours** with a 1-line "I'll come back to you properly today/tomorrow."
2. **Substantive reply within 24 hours.** Address the question, offer either (a) free taster or (b) 15-min call. Never both — force a decision.
3. **Tag the enquiry** in a simple tracker (TASKS.md or spreadsheet): Name · Practice · Sector · Stage / pack profile · Source (LinkedIn / inbound / referral) · Status (replied / scheduled / scanning / paid / declined).
4. **Follow-up if no reply** in 7 days — single follow-up only, no nag.
5. **Mark Lost after 21 days** of silence post-second-touch. Move on.

**Red flags that warrant a refusal:**

- US healthcare pack (no BAA in place — refuse politely until BAA exists)
- Higher-risk building under UK Building Safety Act (defer until UK posture is bound)
- Customer asking for "AI-certified" output (correct the misunderstanding before engagement)
- Reviewer-specialty required outside Liam's discipline (Option A — defer, or Option C — per-pack specialist if Tier III+)

---

## 2 · Demo Script (15-min Zoom)

**Goal:** Get the prospect to either (a) run a free taster on their next pack, or (b) say no clearly. Avoid the third state of "thinking about it" — force decision.

**Structure:**

### Minute 0–2 · Open

> "Thanks for the time. I'll keep this to 15 minutes. Before I show you anything, can you tell me — what made you click through? What's the live pack you're thinking about?"

[**Listen.** They'll tell you the actual hot button. If they don't, ask: "What's currently the most painful part of pre-tender doc check for you?"]

### Minute 2–6 · Show the worked finding (NOT the platform)

> "Let me show you what came out of a real Office project pack we read recently. 327 findings across 5 disciplines, 161 documents. Three critical. Here's one of them."

[**Open** `case-study-01.html` → scroll to C-03 (Date for Substantial Completion). Read the source quote aloud. Read the recommended action.]

> "That's it. Verbatim quote from the page, severity-classed, with the exact action your design team should take. The whole register is 327 of those."

[**Pause.** Let them react. Most prospects will say something like "we have those issues too" or "how did you find that?" or "how much?"]

### Minute 6–10 · Address their specific pack

> "Looking at the pack you mentioned — {{their pack profile}} — that's probably a Tier {{II / III}} for us. Per pack at €{{590 / 890}}, or annual seat at €{{5,800 / 11,400}} if you do 6+ packs a year of that size."

[**Don't** push on price. Let them see the numbers and react.]

> "The way most pilots start: you run the free taster on one discipline of an actual pack. Twenty docs cap, counts and one worked finding. Costs you nothing. About 22 minutes end to end. If the worked finding is useful, you decide on the full read."

### Minute 10–13 · The honest reviewer disclosure

> "One thing I want to be clear on. The pilot reviewer is me — I'm the one who signs every audit log right now. My discipline is procurement, contract-form, document hygiene, and cross-document coordination. Findings outside my discipline — architecture adequacy, M&E, fire, structures — are surfaced on the register but marked 'AI-surfaced · pending chartered review' until the relevant specialist joins the cohort over the next two months. The honesty is the point. We don't claim a panel we don't have."

[**Pause.** Some prospects will value the honesty; some will defer until the panel is real. Either is a valid response.]

### Minute 13–15 · The ask

> "Two paths from here. Either we agree now that you upload {{the pack they mentioned}} as your free taster — I can send you a magic link in the next hour. Or you take a week, talk to your team, and come back if it's a fit. I won't chase. Which works for you?"

[**Listen for the answer.** If they say "send the link" — close. If they say "let me think" — fine, agree the date you'll check back in, send the case study link by email, and move on. Don't oversell.]

---

## 3 · Discovery Questionnaire (pre-call / async)

Send this if a prospect prefers async over a call.

**Subject:** A few quick questions before we talk

**Body:**

```
{{First name}} — five quick questions so I can show you something
relevant, not a generic demo:

1. What sector is the pack? (Health / education / commercial /
   residential / heritage / data centre / civic / infra)

2. What stage? (Pre-tender / during tender / post-award /
   construction)

3. Approx pack size? (Under 50 docs / 50-150 / 150-600 / 600-1500 /
   over 1500)

4. Which disciplines are involved? (Architecture, structures, M&E,
   electrical, fire, QS, BCAR — tick all that apply)

5. What's the one risk in this pack you'd most like a second pair of
   eyes on? (Free text — one sentence is fine)

Reply on email or LinkedIn — either works. I'll come back with
something specific to your pack within 24 hours.

— Liam
```

---

## 4 · Pilot Kickoff Template (post-signature)

Send within 1 hour of paid signup.

**Subject:** Welcome to the pilot — kickoff for {{practice_name}}

**Body:**

```
{{first_name}},

You're in. Thank you. Here's what happens this week.

Today (Day 0):
  · Magic-link upload arrives in your inbox within the next hour
  · You upload the pack (ZIP per discipline if multi-disc; single ZIP
    if single discipline)
  · The atelier reads, classifies, scans

Day 2-3:
  · Reviewer queue — I personally read every finding before release
  · Findings outside my discipline marked "AI-surfaced · pending
    chartered review" — full transparency on the register

Day 3 (Tier III) / Day 2 (Tier II) / Day 1 (Tier I):
  · Reviewer-signed register released
  · You receive: full register (XLSX), RFI register (DOCX),
    audit log (PDF), cover sheet (PDF)
  · 14-day re-run promise stands — if you raise a material complaint
    on any finding, we re-run that discipline at no charge

Anything I should know about the pack before I open it?
  · Anyone on your team I should copy in / out?
  · Confidentiality flags I should respect?
  · Specific risk areas to weight?

Reply to this email. I'll keep an eye out for your upload.

— Liam
hello@verifiq.ie

— — —
Locked disclaimer:
VerifIQ is a software-based reading aid. Indicative output only.
Legal · per jurisdiction: https://verifiq.ie/legal-notice.html
```

---

## 5 · Customer Success Cadence

**Week 1 · Onboarding** — Kickoff email (above), magic link sent, first pack uploaded, scan complete, register released. Founder available on email throughout.

**Week 4 · First-pack check-in.** Short email, no agenda:

> "How did the register land with your team? Anything that surprised you — good or bad? What's the next pack you're thinking about?"

[Tag in tracker: Net Promoter signal · NPS-style 0-10 ask is too SaaS for this audience. Just listen.]

**Month 3 · Tier review.** If they've done 3+ packs at per-pack pricing, suggest the annual seat. Math: 3 × €890 = €2,670 vs €11,400 seat — but they're on a trajectory of more packs. Don't push if they're hesitant.

**Month 6 · Renewal conversation (if annual seat).** 30 days before renewal, send single-touch reminder: "Renewal coming up. Any questions, hit reply."

**Quarter end · Audit log review.** Customer can request audit log export at any time. Send proactively at Q-end: "Here's your Q{{N}} audit log export. {{N}} packs, {{N}} findings, {{N}} reviewer-signed."

**On escalation** — if customer raises a material complaint, founder calls within 4 hours, regardless of time of day. Re-run within 48 hours. Document the escalation in the trigger map (Solo Reviewer Phase ends on any complaint regardless of cause).

---

## 6 · The five no-go situations

When to refuse the engagement or defer:

| Situation | Action |
|---|---|
| US healthcare pack without BAA | Refuse politely. Explain BAA requirement. Re-engage when BAA in place. |
| Higher-risk building under UK BSA, Liam unfamiliar | Defer. Schedule UK call only after UK reviewer panel signed. |
| Customer wants VerifIQ as Assigned Certifier | Refuse permanently. Out of scope. Explain. |
| Customer wants chartered specialty Liam doesn't hold AND won't accept "pending chartered review" marking | Defer with Option A. Re-engage when specialist joins. |
| Customer wants outcome-priced engagement at Tier I/II | Refuse — outcome pricing is Tier V only post-month-9. Explain. |

---

## 7 · Pricing-conversation muscle

Three things to say crisply when pricing comes up:

**"How much?"**
> "Tier {{N}} at €{{price}} per pack, or €{{seat}} for an annual seat covering unlimited packs of that size for your practice. Early-pilot 30% off — there are {{seats_remaining}} of 10 pilot seats remaining."

**"Can you do a discount?"**
> "The early-pilot 30% is the discount. After the 10 pilot seats are filled, list price holds. I don't negotiate on standard tiers because every discount becomes the new benchmark for the next prospect — but I'd rather hold pricing and over-deliver than discount and disappoint."

**"How does it compare to our QS / consultant doing the same?"**
> "It doesn't replace your QS or your consultants. It surfaces source-quoted findings faster than a manual read, so your QS / consultants spend their time on the judgement calls rather than the document hunt. Most pilot customers send their QS the register and the QS works from it."

---

## 8 · Anti-patterns to avoid

Things that will burn the brand if you do them:

- **Don't claim accuracy percentages** ("99% accurate" — uninsurable and unprovable, banned in marketing).
- **Don't promise "AI does everything"** — defeats the whole positioning.
- **Don't oversell turnaround time** — under-promise on SLA, over-deliver.
- **Don't compete on price against manual review** — different category of product.
- **Don't take packs outside Liam's discipline without honest marking** — Option B is the default; Option A or Option C otherwise.
- **Don't accept the term "certifier" in any customer email** — gently correct.
- **Don't bundle without consent** — pricing transparency is the brand.
- **Don't recycle marketing copy from generic SaaS** — the chartered audience reads tone like architects read drawings.

---

## 9 · Weekly outreach rhythm

10 personal touches per week. No more, no less.

| Day | Activity |
|---|---|
| Monday | Project plan review (scheduled) · update outreach list |
| Tuesday | 3 LinkedIn outreach messages — practices from named target list |
| Wednesday | 2 follow-ups from previous week's outreach · 1 referral request |
| Thursday | 2 LinkedIn comments on RIAI / EI / SCSI posts (warm visibility) |
| Friday | 2 new outreach messages · 1 thank-you for any chat that happened |
| Total | 10 personal touches |

Over 12 weeks: ~120 touches. At 3% response rate that's 3-4 demos per quarter. At 30% demo-to-pilot close that's 1-2 paid pilots per quarter. **Target Q3 close: 3-5 paying customers.**

---

## 10 · The two metrics that matter

Track weekly:

1. **Brief requests received** (inbound + outbound that converted to a reply). Aim: 5/week by month 3.
2. **Free tasters run end-to-end** (free signup → scan complete). Aim: 60% of brief requests run a taster.

If those two numbers move, paid conversions will follow at 8-12%.

---

*End of sales playbook — v0.1*
