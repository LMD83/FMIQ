# VerifIQ — Setup Costs & Pricing Council

**Doc ID:** `verifiq-costs-pricing-v0.1`  
**Status:** Strategic position paper · For founder + board review · Not yet audited  
**Purpose:** Define (a) full setup costs to launch in Ireland, then UK, then rest-of-world, (b) funding implications of those numbers, (c) the Irish pricing model — with a deliberate choice between three pricing bases.  
**Format:** Six voices — Founding Analyst, Chartered Accountant, Pricing Analyst, Marketing Director, Sales Director, Independent Auditor. Each speaks within their remit, then a consolidated funding & pricing decision.  
**Date:** 2026-06-01

---

## What this document does, and what it does not

This document gives **defensible ranges**, not single-point estimates. Every figure carries assumptions; assumptions are listed beside the figure. Where a figure depends on a contract that has not been signed (insurance binders, reviewer panel compensation, standards-body licences), the range is wide. Tightening any range requires a quote or a signed letter.

The document does **not** model unit economics in detail — that lives in the separate Token Economics workbook (doc 02). This document models *setup and overhead* costs only, then maps them onto pricing options.

---

## I · Founding Analyst — Setup Costs Ireland

**Remit:** Line-by-line cost to take VerifIQ from where it sits today (POC code + design system + reviewer panel plan) to operational on the Irish market.

**Position:**

Setup-cost categories, expressed in three buckets — *minimum to go live*, *credible launch*, *and properly capitalised launch*. Founder time excluded (it is the company's largest cost but is not cash out the door).

### Setup Cost Schedule — Ireland (12-month launch window)

| Line | Item | Min · go-live | Credible launch | Capitalised launch | Notes |
|---|---|---|---|---|---|
| **A · Company formation** | | | | | |
| A1 | CRO incorporation + first-year compliance | €500 | €1,200 | €2,500 | Solo founder vs. co-founder agreement |
| A2 | Trademark — EUIPO + IPOI · monogram + wordmark | €2,200 | €3,500 | €5,500 | Filed once, maintained yearly |
| A3 | Founders' agreement + cap table setup | €1,500 | €3,500 | €6,000 | Counsel time |
| A4 | Standard B2B contracts pack (TOS, DPA, MSA) | €2,500 | €5,500 | €10,000 | Drafted once, version-controlled |
| A5 | Insurance binders — Tech E&O €2m, cyber €1m, GL €2.5m, D&O €1m | €14,000 | €22,000 | €32,000 | Year-1 premium estimates |
| A6 | Accountant retainer + bookkeeping | €4,800 | €8,400 | €14,400 | Monthly retainer · year 1 |
| A7 | Bank account, Stripe, payment infra setup | €600 | €1,200 | €2,000 | Stripe Tax onboarding |
| **A subtotal** | | **€26,100** | **€45,300** | **€72,400** | |
| **B · Platform engineering** | | | | | |
| B1 | Convex EU-West hosting · year 1 | €1,200 | €4,800 | €12,000 | Scales with usage |
| B2 | Vercel pro · year 1 | €240 | €840 | €1,680 | Multi-environment |
| B3 | Clerk auth (multi-tenant) · year 1 | €0 | €1,200 | €3,600 | Free tier → growth tier |
| B4 | Anthropic + OpenAI API spend · year 1 | €12,000 | €36,000 | €84,000 | At assumed run volumes |
| B5 | Domain + DNS + email | €200 | €450 | €700 | verifiq.ie / .com / .eu |
| B6 | Error monitoring (Sentry) + analytics | €400 | €1,800 | €4,200 | |
| B7 | Contract engineering — bridge from POC to MVP | €18,000 | €42,000 | €78,000 | 3–10 weeks of senior contractor |
| **B subtotal** | | **€32,040** | **€87,090** | **€184,180** | |
| **C · Reviewer panel — Ireland** | | | | | |
| C1 | Panel recruitment effort · founder + introductions | €0 | €0 | €0 | Founder cost · in kind |
| C2 | Panel honoraria — 11 seats · year 1 | €38,500 | €55,000 | €74,800 | €3.5k–€6.8k per seat · annual |
| C3 | Panel chair (lead reviewer · architect) | €12,000 | €18,000 | €28,000 | Higher load, decision authority |
| C4 | Quarterly panel sessions × 4 · catering + venue | €1,200 | €2,800 | €5,200 | Rotating Dublin locations |
| C5 | Panel insurance — reviewers covered under our Tech E&O | included | included | included | Already in A5 |
| **C subtotal** | | **€51,700** | **€75,800** | **€108,000** | |
| **D · Corpus + standards** | | | | | |
| D1 | NSAI standards subscription · I.S. + I.S. EN feed | €4,500 | €8,200 | €12,500 | Enterprise tier negotiable |
| D2 | TGD A–M + BCAR — public, no licence cost | €0 | €0 | €0 | Free download |
| D3 | CWMF + PW-CF documents — public, OGP | €0 | €0 | €0 | Free download |
| D4 | HBN/HTM + HSE PCM — HSE, generally free | €0 | €500 | €1,500 | Some specialist documents paid |
| D5 | Corpus indexing engineering | included in B7 | included in B7 | included in B7 | |
| **D subtotal** | | **€4,500** | **€8,700** | **€14,000** | |
| **E · Brand, marketing, content** | | | | | |
| E1 | Brand identity — already built (internal) | €0 | €0 | €0 | |
| E2 | Website hosting + ongoing development | included in B2 | included in B2 | included in B2 | |
| E3 | Marketing content creation — case studies, pieces | €2,000 | €6,500 | €14,000 | Photography, copy, video stills |
| E4 | Industry events — RIAI, EI, SCSI conferences year 1 | €3,500 | €9,500 | €18,000 | Speaking + booth |
| E5 | Pilot cohort acquisition cost | €0 | €4,000 | €12,000 | Coffee, demos, contracting |
| E6 | PR + analyst relations · year 1 | €0 | €3,000 | €12,000 | Optional |
| **E subtotal** | | **€5,500** | **€23,000** | **€56,000** | |
| **F · Founder + early team** | | | | | |
| F1 | Founder salary (founder takes minimum) | €30,000 | €60,000 | €85,000 | 12 months |
| F2 | Second hire — engineer (month 4) | €0 | €52,000 | €85,000 | Senior FE/BE |
| F3 | Third hire — sales / partnerships (month 8) | €0 | €25,000 | €52,000 | Part-year |
| F4 | Office / co-working (Dogpatch Labs class) | €0 | €4,800 | €8,400 | Remote-first option = €0 |
| F5 | Equipment + tooling | €1,500 | €3,800 | €6,500 | Laptops, licences |
| **F subtotal** | | **€31,500** | **€145,600** | **€236,900** | |
| **G · Contingency** | | | | | |
| G1 | 15% buffer on all above | €23,000 | €57,000 | €101,000 | |
| **G subtotal** | | **€23,000** | **€57,000** | **€101,000** | |
| | | | | | |
| **IRELAND TOTAL · 12 months** | | **€174,340** | **€442,490** | **€772,480** | |

### Reading the three columns

- **Min · go-live** (~€175k) — founder solo, contract dev, panel signed at lower honoraria, minimal marketing. Possible. Not investible. Buys 12 months of presence and a few paying customers if everything goes right. This is the *bootstrap path* — feasible only if founder has personal runway.

- **Credible launch** (~€450k) — founder + one engineer hire + part-year sales hire, panel properly funded, marketing investment, accounting and legal at appropriate weight. This is the *seed-funded path*. Reaches break-even or near-break-even at month 12 if revenue tracks plan.

- **Capitalised launch** (~€775k) — founder + senior engineer + sales hire + office + larger marketing + PR + larger panel. This is the *Series-A path*. Buys speed and credibility but only justifies itself if revenue plan delivers >€600k ARR by month 12.

---

## II · Founding Analyst — Setup Costs UK (added after Ireland is live)

**Remit:** Incremental cost to add the UK market after Ireland is operational.

**Position:**

The UK adds materially less than starting Ireland from zero because the platform, brand, design system, contracts, and engineering work are reusable. What does not transfer is the reviewer panel, the insurance binders, the legal posture, the corpus, and the office presence.

### Setup Cost Schedule — UK (incremental, year 2)

| Line | Item | Min | Credible | Capitalised | Notes |
|---|---|---|---|---|---|
| H1 | UK company formation (UK Ltd) + filings | €1,500 | €2,500 | €4,500 | Companies House + counsel |
| H2 | UK solicitor — BSA-specific addendum, TOS adaptation | €6,000 | €11,000 | €18,000 | Specialist construction-law firm |
| H3 | UK insurance — Tech E&O £2m, cyber £2m, GL £5m | €18,000 | €28,000 | €42,000 | UK BSA carriers premium higher |
| H4 | UK reviewer panel — 8 seats (RIBA · ICE · RICS) | €36,000 | €58,000 | €82,000 | Per-seat honorarium UK rates |
| H5 | UK corpus — BSI feed + Approved Documents indexing | €18,000 | €32,000 | €50,000 | BSI enterprise licence variable |
| H6 | Domain — verifiq.co.uk + email | €200 | €400 | €600 | |
| H7 | UK accountant — VAT, payroll if hires | €3,600 | €7,200 | €12,000 | Year-1 retainer |
| H8 | UK sales/partnerships hire | €0 | €38,000 | €72,000 | Part-year |
| H9 | Marketing — UK launch event + content | €4,000 | €12,000 | €28,000 | RIBA Plan of Work alignment |
| H10 | Platform engineering — UK locale config, BSI integration | €12,000 | €28,000 | €48,000 | 2–6 weeks contractor |
| H11 | Contingency 15% | €15,000 | €32,000 | €54,000 | |
| | | | | | |
| **UK TOTAL · incremental** | | **€114,300** | **€249,100** | **€411,100** | |

UK incremental is roughly 60% of Ireland from-zero — the platform leverage shows but the regulatory layer is heavy.

---

## III · Founding Analyst — Setup Costs Rest of World

**Remit:** Indicative incremental cost to add each subsequent market.

**Position:**

Each market is similar in structure but priced differently. The pattern holds: company formation, local counsel, insurance, reviewer panel, corpus, sales presence.

### Per-Market Indicative Setup — Years 3+

| Market | Credible launch (incremental) | Notes |
|---|---|---|
| **Australia (NSW + VIC)** | €280,000 | DBP Act 2020 complexity, AIA/IEAust panel, AU-Sydney region infra |
| **Canada (ON + QC)** | €240,000 | Provincial regulators, Quebec French requirement, smaller reviewer panel |
| **Germany / Netherlands** | €310,000 | Civil-law jurisdiction, language, BAK & equivalents, expensive standards licences |
| **United States (NY + CA)** | €420,000 | State-by-state licensing complexity, BAA infra, AI-act-relevant tech E&O premium |
| **Singapore** | €180,000 | Smaller market, simpler regulatory environment, BCA reviewer panel |
| **UAE** | €260,000 | Specialist requirement, partner-led usually, free zone setup |

**Pattern:** Each major market entry is €180k–€420k incremental. None is cheap. **Total committed cost to reach the "global" footprint described in the Scaling Council document is approximately €1.4m–€1.9m over years 2–4**, on top of Ireland and UK.

### Cumulative scenario — 4-year build-out (credible path)

| Year | Markets live | Cumulative setup cost | Cumulative revenue assumed |
|---|---|---|---|
| Year 1 | Ireland | €442k | €110k |
| Year 2 | Ireland + UK | €691k | €540k |
| Year 3 | + Australia | €971k | €1.4m |
| Year 4 | + Canada + EU (DE) | €1.52m | €2.9m |
| Year 5 | + USA | €1.94m | €4.6m |

These are setup costs only. Run costs (salaries, infra, premiums year-over-year) layer on top.

---

## IV · Chartered Accountant

**Remit:** Burn rate, runway, funding sequence, what the numbers mean for fundraising.

**Position:**

Take the credible-launch path. Year-1 setup €442k. Year-1 *total spend* (setup + run-rate operational) is approximately €620k–€680k once 12 months of ongoing costs are factored in. Year-1 revenue at conservative case (3 paying practices at €11k average annual seat) is €33k; at credible case (8 practices, mixed seat + per-pack), is €110k; at optimistic case (15 practices), is €240k.

**Cash needed across funding cycles:**

| Round | Timing | Size | Use of proceeds | Lead source |
|---|---|---|---|---|
| **Pre-seed / SAFE** | Month 0 | €250k | Bootstrap Ireland to credible launch | EI HPSU grant + angel |
| **Seed** | Month 9 (after 3 pilots paying) | €1.5m–€2.5m | Year-2 (UK launch) + 12 months runway | Atlantic Bridge, Frontline, ACT |
| **Series A** | Month 24 | €6m–€10m | Year-3/4 (AU + CA + EU) | International VC, possibly with EU growth fund |

**Critical metric for seed-round close:** at month 9 (when raise begins), you must show **3 paying Irish practices at Tier II+, panel operational, end-to-end POC running on real packs, and credible UK reviewer pipeline.** Without those four, the round is harder and the valuation drops 40%.

**Cash-conservation tactics for the bootstrap window:**

- Founder salary at €30–50k for 12 months only.
- No office — remote-first.
- Contract engineering, not employed engineering, until seed closes.
- Insurance binders structured monthly, not annual prepay.
- Defer panel honoraria until after first paid scan revenue (offer founder equity participation to panel chair).
- Use EI HPSU + Enterprise Ireland innovation vouchers (€5k each, can stack 2–3).
- Apply to Disruptive Technologies Innovation Fund if scope qualifies.

**Forecast — credible path, year 1:**

| Month | Cumulative spend | Cumulative revenue | Cash position (after €250k pre-seed) |
|---|---|---|---|
| 3 | €110k | €0 | €140k |
| 6 | €230k | €18k | €38k |
| 9 | €370k | €58k | -€62k (raise window) |
| 12 | €620k | €110k | n/a (seed in by m9) |

The cash-out month is month 8. The seed raise must close by month 9 or the company runs out. This is the single most important financial fact in the plan.

---

## V · Pricing Analyst — Three pricing bases for Irish market

**Remit:** Choose the pricing basis. Three options. Recommend one.

**Position:**

The question is not what to charge but **what to charge by**. Three coherent bases exist, each with a different commercial and operational profile.

### Option 1 · Pricing by budget (construction value)

**Concept:** Tier the scan price as a percentage of project budget. E.g., 0.05% of construction value for Tier I; 0.03% for Tier III at scale.

**Worked example:**
- €2m fit-out project → €1,000 scan fee at 0.05%
- €25m school project → €7,500 at 0.03%
- €120m hospital project → €36,000 at 0.03%

**Strengths:** Aligns price with customer value. Larger projects can carry larger fees. Familiar — QSs already price percentage-of-construction.

**Weaknesses:** Tells customers nothing about what we actually do. Two €10m packs may differ wildly in document complexity — same fee for very different work. Forces us to know each project's budget upfront, which is sensitive information customers may not disclose. Creates a procurement-style negotiation we are not staffed for.

**When this wins:** if VerifIQ aspires to be a value-share partner with the design team and operates in a small number of high-margin engagements per year.

### Option 2 · Pricing by pack size + complexity (current Tier I–V model)

**Concept:** Five tiers from "Small" (<50 docs, 1 discipline) to "Mega" (>1500, multi-pack programme). Price per tier set in advance. Customer picks tier in the onboarding wizard.

**Worked example:**
- Tier I (small) — €290
- Tier II (mid) — €590
- Tier III (large) — €890
- Tier IV (programme) — €1,950
- Tier V (mega) — €2,500–€5,000 by arrangement

**Strengths:** Predictable for customer, predictable for us. Maps directly to compute cost (which scales with document count and complexity). Honest signal — bigger pack costs more. Easy to communicate. Bookable from the wizard without sales conversation. Already designed and embedded in onboarding.

**Weaknesses:** Decouples price from project value, so we leave money on the table on very large or high-stakes projects (a €120m hospital pays the same Tier III rate as a €15m fit-out). Tier-boundary gaming — customer right-sizes to fall under the cheaper tier.

**When this wins:** if VerifIQ wants product-led growth, low sales friction, and an "atelier" feel — pick your tier, get your scan. (This is the model already in production in the website / wizard / pricing page.)

### Option 3 · Pricing by project scope + depth of review

**Concept:** Two axes — *project size band* (small / mid / large / programme) × *depth of read* (skim / standard / deep / forensic). Customer chooses both. Matrix yields the price.

**Worked example matrix:**

| | Skim | Standard | Deep | Forensic |
|---|---|---|---|---|
| Small | €150 | €350 | €750 | €1,400 |
| Mid | €290 | €690 | €1,400 | €2,800 |
| Large | €590 | €1,290 | €2,400 | €4,800 |
| Programme | €1,200 | €2,400 | €4,400 | €9,000 |

**Strengths:** Captures both volume *and* engagement depth. Acknowledges that a forensic pre-award review (high stakes) is a different product to a quick skim before issue. Lets us serve quick-look engagements (skim of an Office project pack before the QS meeting tomorrow morning) at a lower price point that broadens market access. Forensic tier captures high-margin work.

**Weaknesses:** More choices = harder to sell. Customer has to understand both axes. Risk of paralysis at the onboarding wizard. Twice as many price points to maintain across markets.

**When this wins:** if VerifIQ wants to serve a range of engagement types — from quick weekly skims to deep forensic pre-award reads — and trusts customers to self-select correctly.

### Recommendation

Adopt **Option 2 for launch** (already designed), then **migrate to Option 3 at month 9** once we have enough live engagements to calibrate the depth-axis prices.

The pure budget-percentage (Option 1) is rejected — too much commercial friction, too little transparency, and it forces a sales motion we cannot afford in year 1.

Option 2 ships the product with the wizard you already have, with the prices that are already in production thinking. Option 3 unlocks the high-margin forensic work and the low-friction skim work later, once we have evidence to set the matrix correctly.

### Specific Tier prices recommended for Irish launch (Option 2)

| Tier | Scope | One-off price | Annual seat (unlimited Tier) |
|---|---|---|---|
| Free | 1 discipline · 20 docs · counts only | €0 | n/a |
| I · Small | < 50 docs · 1 discipline | €290 | €2,800 |
| II · Mid | 50–150 docs · 1–3 disciplines | €590 | €5,800 |
| III · Large | 150–600 docs · full design team | €890 | €11,400 |
| IV · Programme | 600–1,500 docs · multi-pack | €1,950 | €19,800 |
| V · Mega | > 1,500 docs · by arrangement | from €2,500 | from €36,000 |

These prices anchor against typical QS / chartered-surveyor day rates in Dublin (€800–€1,200/day) — a Tier III scan costs about one day of senior chartered time and delivers a full multi-discipline read.

---

## VI · Marketing Director

**Remit:** What the pricing model means for go-to-market, what we say to whom, what acquisition costs to plan for.

**Position:**

The Tier I–V model with a free taster is the *only* pricing structure that lets us run product-led acquisition through the Irish market. Sales-led acquisition (where pricing is "talk to us") requires a sales team we cannot afford for 12 months. Tier-card pricing lets a practice book a Tier II scan from the wizard at 9pm on a Friday — zero sales friction. That is what makes the model fundable for seed.

**Acquisition channels — Ireland year 1, by efficiency:**

1. **RIAI / EI / SCSI member outreach** via the panel chair's network — warm intros, ~€0 CAC, ~25% close rate on Tier II/III.
2. **One named pilot success story** published with consent (the 327-finding Office project pack, anonymised) — drives ~30 inbound enquiries in first 3 months.
3. **RIAI Conference + Engineers Ireland Annual Conference** speaking slots — €5–8k per event, expected 10–20 enquiries each.
4. **Targeted LinkedIn ads to "RIAI member" / "Engineers Ireland CEng" audiences** — €4–8k spend test, CAC likely €150–€450 per qualified enquiry. Defer to month 6+.
5. **Practice-magazine sponsored articles (Plan Magazine, Engineers Journal)** — €2–4k each, soft brand-building, low direct attribution.
6. **Free taster as primary funnel** — anyone can run one. Conversion target: 8% of free taster → paid. If we hit it on first 50 tasters, the funnel works.

**Year-1 marketing budget recommendation:** €18,000 to €24,000 cash spend, against an expected 60–110 qualified enquiries → 8–15 paying customers. CAC sits at €1,500–€3,000 per paying customer at credible launch — acceptable for B2B SaaS at this ACV.

**What I refuse:** any sales motion that requires pre-purchase phone calls in Ireland year 1. The wizard is the sales motion. The panel chair is the trust signal. The free taster is the demo. Anything beyond that is a tax on the funnel.

---

## VII · Sales Director

**Remit:** Where does revenue actually come from. Who signs cheques. What is the realistic sales cycle.

**Position:**

The Marketing Director is right that we cannot run a sales-led motion in year 1. But "no sales motion" is not the same as "no sales work."

**Real year-1 sales work — by hand:**

- 20–30 named target practices in Ireland (RIAI top 100 + Engineers Ireland top 50 + SCSI top 30, deduplicated).
- A founder-led conversation with the principal or QS lead at each — 30-min Zoom or coffee.
- A specific pack offered for free taster, with the conversation framed as "would you like a second pair of eyes on your next pre-tender pack?"
- 8% conversion at this level = 2–3 paying customers from named outreach. Combined with inbound from speaking + content, blended target 8–15 paying year 1.

**Sales cycle realism:**

- **Awareness → demo:** 4–8 weeks (practices have project pipelines; they wait for the right pack).
- **Demo → first paid pack:** 1–3 weeks.
- **First paid pack → seat (annual subscription):** 2–6 months (they need to use it on 2–3 packs before committing to a seat).
- **Seat upgrade → multi-seat practice license:** 6–12 months.

**Sales-relevant pricing observations:**

- The Tier I–V model is right.
- The annual seat option is critical — it is the conversion-from-experimentation moment. Price it so a practice doing >4 packs/year clearly benefits (the Tier III seat at €11,400 pays for itself at 13 Tier III packs; most engaged practices do 6–12 packs/year of the relevant size).
- Discounting will be pressured. **Hold the line at Tier prices for the first three deals.** A €100 discount becomes the new benchmark for every subsequent prospect. Discount only via Tier IV/V structured bundles, not on standard tiers.
- Per-pack + seat = a healthy mix. Don't insist on seat; let customers grow.

**What I want from the rest of the team:** a clear policy on referral incentives. A 10% commission to a panel-chair who introduces a paying practice is good investment. Decide before month 3.

---

## VIII · Independent Auditor

**Remit:** What did this council get wrong.

**Position:**

**On the Analyst's setup figures.** The credible-launch year-1 €442k is reasonable but two lines are understated.

- **Insurance.** Tech E&O quoted at €22k. Carriers are tightening AI-related cover post-2024 and an Irish operator with no track record may pay €28–35k. Adjust upward by €8–13k.
- **Corpus.** NSAI standards subscription is shown at €8.2k. This is a 30-licence enterprise tier estimate. If we need richer entitlement (PDF download, search API, change notifications) the bill rises to €12–15k.

Combined adjustment: +€10–18k. New credible-launch year-1 total: **€452k–€460k**. Still defensible. Still raises on the same SAFE/seed structure.

**On the Accountant's "month 8 cash-out / month 9 raise" timeline.** Reckless without a fall-back. Seed-round timing depends on the macro and on the founder's network. If the seed slips to month 11, the company dies at month 8 with no fall-back. **The plan must carry a 3-month bridge buffer** — either a personal-guarantee line, a convertible note from the EI HPSU + named angel, or a contractually committed second close from the pre-seed. Without one of these, the timeline is single-point-of-failure.

**On the Pricing Analyst's Option 2 recommendation.** Defensible but conservative. The recommendation rejects pure budget pricing (correct) and defers Option 3 (correct for launch). But there is a fourth option not discussed: **outcome-priced pricing** — "scan is free, you pay €X per critical finding actually accepted into your RFI register." This is what large insurance and audit consultancies use for high-stakes engagements. It carries massive operational risk (we have to define "accepted finding") but in the upper segment (Tier V hospitals, infrastructure) it may unlock far higher commercial value. **Worth piloting at Tier V only, post-month-9.**

**On the Marketing Director's "wizard is the sales motion" claim.** Half-right. The wizard handles transaction. It does not handle the trust transfer that gets a chartered architect to upload their unfinished tender pack to a third-party AI service. That trust transfer comes from the panel chair's word and a worked-example case study. The marketing budget must reserve **at least €8k specifically for the case-study artefact** — designed, photographed, anonymised, narrated. Without it, the wizard converts at 2% not 8%.

**On the Sales Director's "no discounting" rule.** Wise but unenforceable in practice. The first three deals will pressure for discount. A defensible compromise: **publish "early-pilot pricing" that is 30% off list for the first ten Irish practices**, time-limited. Frames the discount as a window, not as negotiation. Captures the urgency without setting a precedent for ongoing discounts.

**Three things missing from this council:**

1. **VAT treatment.** Ireland 23% VAT. Most prices in the schedule above are quoted ex-VAT but customer-facing pricing pages typically show VAT-inclusive. Decide and stamp on the pricing page (recommendation: B2B prices ex-VAT with "+VAT" stamp visible; B2C prices VAT-inclusive — but VerifIQ has no B2C).
2. **Refund / re-run policy.** What happens if the customer disputes our findings or we miss something material? Need a published policy. Recommendation: re-run for free within 14 days for any pack where the customer raises a material complaint; refund only in cases of platform failure, not finding-quality dispute. Without a published policy, every complaint becomes a one-off negotiation.
3. **Free taster compute cap.** The free taster is shaped (per the abuse spec). But what if a free user uploads the same pack 50 times across 50 different IPs in a week? There must be a global cap: "free-tier compute spend will not exceed €1,500 per week." If hit, free tier pauses for that week. Without this, abuse can drain budget.

---

## Consolidated Decision Matrix

| Decision | Council position | Disputed by | Status |
|---|---|---|---|
| **Credible-launch path · year 1 spend €442k** | Approved | Auditor (+€10–18k) | **Approved at €460k** |
| **Pre-seed €250k, seed €1.5–2.5m at month 9, Series A at month 24** | Accountant + Analyst | Auditor (need bridge) | **Approved with mandatory 3-month bridge facility** |
| **Pricing Option 2 (Tier I–V) for launch, Option 3 at month 9** | Pricing Analyst | Auditor (add outcome-priced at Tier V) | **Approved + Tier V outcome-priced pilot at month 9** |
| **Free taster + wizard as primary funnel** | Marketing | Auditor (case study mandatory) | **Approved + €8k ring-fenced for case-study artefact** |
| **20–30 named outreach + speaking + content year 1** | Sales | None | **Approved** |
| **No discounting on standard tiers** | Sales | Auditor (early-pilot 30% window) | **Adopt early-pilot 30%-off window for first 10 practices** |
| **B2B prices ex-VAT with stamp visible** | Auditor | None | **Approved** |
| **Free re-run within 14 days for material complaint** | Auditor | None | **Approved** |
| **Free-tier weekly compute cap €1,500** | Auditor | None | **Approved** |
| **Panel honoraria deferred or equity-shared in bootstrap** | Accountant | None | **Approved subject to panel-chair agreement** |
| **UK incremental ~€249k at year 2** | Analyst | None | **Approved subject to month-15 review** |
| **No market expansion without reviewer panel signed** | Scaling Council (carried over) | None | **Reaffirmed** |
| **Tier prices: €290 / €590 / €890 / €1,950 / from €2,500** | Pricing Analyst | None | **Adopted as launch pricing** |
| **Annual seat prices: €2.8k / €5.8k / €11.4k / €19.8k / from €36k** | Pricing Analyst | None | **Adopted as launch pricing** |

---

## Appendix A · Cash-flow at-a-glance · Ireland year 1 (credible path, €460k spend)

| Month | Spend (cumulative) | Revenue (cumulative) | Customers acquired | Notes |
|---|---|---|---|---|
| 1 | €38k | €0 | 0 | Setup costs frontloaded — legal, insurance, contracts |
| 2 | €68k | €0 | 0 | Panel signing, first hires interviewed |
| 3 | €105k | €1.5k | 1 | First free taster paid pack |
| 4 | €148k | €4.5k | 2 | Engineer hire starts |
| 5 | €192k | €11k | 3 | Panel operational, first reviewer session |
| 6 | €232k | €22k | 4 | First annual seat signed |
| 7 | €271k | €38k | 6 | Speaking event |
| 8 | €312k | €58k | 8 | Cash low-point; raise active |
| 9 | €355k | €80k | 10 | Seed targeted close |
| 10 | €396k | €100k | 12 | (assuming seed closed; momentum builds) |
| 11 | €430k | €126k | 14 | |
| 12 | €462k | €155k | 16 | Year-end ARR run-rate ~€220k |

Revenue end-of-year: ~€155k actual cash. ARR run-rate: ~€220k. Spend: €462k. Net cash burn year 1: €307k against starting €250k pre-seed + €1.5–2.5m seed mid-year.

---

## Appendix B · What the pricing pages should actually say

The website pricing page should display, for Irish visitors at launch:

```
Tier I — Small         €290 + VAT     (or €2,800/yr seat)
Tier II — Mid          €590 + VAT     (or €5,800/yr seat)
Tier III — Large       €890 + VAT     (or €11,400/yr seat)
Tier IV — Programme    €1,950 + VAT   (or €19,800/yr seat)
Tier V — Mega          from €2,500    (concierge — by arrangement)

Free read · 1 discipline · 20 docs · counts only · one per practice per quarter

Early pilot — 30% off the first ten paying practices (closing when filled)
```

Below the price table:

> *Each price covers one pack from intake to chartered-reviewer release. Pricing is per pack except where an annual seat is purchased. Annual seats include unlimited packs at the chosen tier for one practice (up to 5 named users). VAT applies at 23% to Irish customers. UK, EU, AU, CA, US pricing is published on the relevant national pricing page.*

---

## Appendix C · The single sentence that holds the strategy together

> *VerifIQ launches in Ireland at €460k year-1 spend, raises seed by month 9, prices by pack-size tier with a one-pack-per-quarter free taster, and never opens a second market without that market's reviewer panel signed first.*

---

*End of position paper — VerifIQ Setup & Pricing Council · v0.1*
