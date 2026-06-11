# GTM-01 · The First Read launch strategy

**Status:** Draft for founder review · **Date:** 2026-06 · **Owner:** Liam

A go-to-market plan to validate VerifIQ with real Irish design teams via a paid,
low-friction "First Read" offer, sold founder-led on LinkedIn, delivered
concierge-first while the self-serve app is built in parallel.

---

## 1. Positioning — sell time, sell the cross-reference

The buyer is not short on tools; they are short on **hours**. A senior reviews a
junior's work; 160 documents go out under a tender deadline; a blank Substantial
Completion date or an REI 30-vs-60 mismatch slips through and becomes a variation
or a claim. So we sell **triage, not automation**:

> **Spend your review time on the 30 points that matter — not the 3,000 pages.**

VerifIQ does the junior-level first read across the whole pack and hands the
senior a ranked, source-quoted shortlist. They stay the decision-maker — verify
locally, it's up to them. That framing is also the legal posture (the locked
disclaimer), so message and risk agree.

### The real product is the cross-reference (the upsell engine)
A €29 single-discipline read catches small things. The value — and the price —
is in **whole-pack cross-referencing**. The mechanic to teach the market:

> **The more you upload, the more it finds.**

Upload drawings **+** technical/general specifications **+** particulars **+** the
form of contract, and the council checks that the **design specification is met by
the technical requirements**, *across* disciplines, *against* the contract.

**Modules (different ways of checking):**
1. **Cross-discipline coordination** — architect vs structures vs M&E vs fire vs
   electrical: spec vs schedule vs drawing, the interface gaps.
2. **Specification ↔ technical requirements** — does the design spec actually meet
   the particular/technical requirements it cites?
3. **Contract compliance (PW-CF / public works)** — are the design documents
   consistent with the form of contract (PW-CF5 etc.)?
4. **Standards currency** — withdrawn/outdated standards, IS-vs-BS jurisdictional
   mis-references.

The €29 gets the file open on one discipline; the multi-module cross-reference on
the full pack is the business.

## 2. The offer — the price *is* the anti-abuse gate

No open free trials — they get farmed with throwaway emails and teach nothing.
The **paid micro-trial is the filter**: €29 on a company card stops tyre-kickers
and signals real intent.

- **First Read — €29, your first 25 drawings.** One flat, sharp number (a fuzzy
  "€30–50" range reads as made-up; a two-step launch ramp adds a second number at
  exactly the wrong moment). One per **verified work email** and per **company
  domain** (no alias farming).
- Framed as **the first-pack rate, not the rate card** — calibration, not the
  price list. The €29 isn't revenue; it's *commitment + a card on file + a real
  pack in our hands*, and it buys them *a result they can show their boss*: a
  branded, source-quoted register.
- **The ladder:** First Read (€29) → full-pack cross-reference review (Verify,
  €150–800) → monthly "Desk" subscription for teams that adopt it.

## 3. Identity gate (low build, high filter)

Two gates, no elaborate system: **(a)** block free-email domains at sign-up
(gmail/outlook/proton/…) so only work emails get in — Clerk supports this;
**(b)** the €29 payment. Optionally **"Continue with LinkedIn"** for instant
professional verification — on-brand for a LinkedIn-sourced audience and the
named-reviewer honesty posture.

## 4. Channel — founder-led LinkedIn, fuelled by the case study

The 327-finding case study is the whole campaign. Drip it:
- **Liam posts** (named reviewer = authority + honesty). POV on "the
  junior-engineer check problem."
- **Carousel/video:** "We read a real Stage 2C tender pack. 327 findings. Here are
  5 that would've cost someone money." Show the specific ones — blank completion
  date, REI 30 vs 60, withdrawn BS 476-7, wrong county on the cover.
- **Record the homepage live-review animation as a 6-second video** — the
  scroll-stopper.
- Every post ends soft: *First Read, €29, your pack.*

**ICP:** RIAI architects, Engineers Ireland (MEP / C&S), SCSI / QS, technical
directors & associates at 10–200-person practices; public-sector capital teams
(HSE Estates, OGP, Section 38/39, local authorities) later.

**Funnel:** post → `/first-read` → €29 Stripe checkout → upload → register
delivered → upsell to full review / subscription. Capture work email via the
brief dialog where they're not ready to pay.

## 5. Onboarding — concierge first, app in parallel

We have the engine today, no self-serve app yet. So launch **concierge**:

> **Stripe Payment Link "First Read €29" → success page asks them to upload →
> run `scripts/run-review.mjs` → deliver the register as a branded PDF in
> 24–48h.**

Live in an afternoon, near-zero build, validates demand *and* price, and every
delivery is a testimonial + a new case study. The self-serve app (upload → pay →
auto-review → live register) is built behind it and replaces the manual middle
step. Stripe Payment Link now; Stripe Checkout in the app later.

## 6. What to build / do

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | `/first-read` campaign landing page | build | this PR |
| 2 | Homepage "more you upload, more it finds" + First Read CTA | build | this PR |
| 3 | Stripe Payment Link (€29, work-email field) | **founder** | paste link into `VERIFIQ_FIRST_READ_URL` |
| 4 | Concierge intake (upload form / email) + PDF register template | build + founder | next |
| 5 | Self-serve app (upload→pay→review→register) | build | needs Convex live |
| 6 | LinkedIn content kit (case-study carousel + live-review video) | build + founder | next |

## 7. KPIs for the 2-week launch
- First Reads sold (target: validate ≥10 paid).
- Work-email signups / landing conversion rate.
- First Read → full review conversion.
- Qualitative: which module ("found X my junior missed") earns the upsell.

> Output is indicative. The reviewer verifies locally.
