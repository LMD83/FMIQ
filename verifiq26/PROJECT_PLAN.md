# 📌 VerifIQ — Master Project Plan & Schedule

**Pinned · Canonical · Update weekly**  
**Owner:** Liam Doolan (founder, GovIQ Ltd)  
**Frame:** VerifIQ as product line inside GovIQ. Solo-reviewer phase to start.  
**Last reviewed:** 2026-06-01  
**Next review:** 2026-06-08 (Monday)

---

## At a glance — single page

| Phase | Window | Cash | Customers | State |
|---|---|---|---|---|
| **P0 — Live this week** | 2026-06-01 → 2026-06-05 | €60–€260 | 0 | 🟡 In progress |
| **P1 — Legal to charge** | 2026-06-08 → 2026-06-28 | +€2,000–€4,000 | 0–1 free pilot | ⚪ Not started |
| **P2 — Properly serious** | 2026-07 → 2026-09 | +€8,000–€15,000 | 3–6 paying | ⚪ Not started |
| **P3 — Pre-seed credible** | 2026-10 → 2027-02 | +€20,000–€60,000 | 8–15 paying | ⚪ Not started |
| **P4 — Seed → UK launch** | 2027-03 → 2027-09 | +€600k (raised) | 15–40 paying | ⚪ Not started |

---

## Build Programme — 12 Weeks to First Paid Pack

**Public commitment:** 12 weeks from kick-off to first paid pack. Adopted from the Implementation Review Council (`docs/25-implementation-review-council.md`).

**Hard rules from the Council:**

- 🔴 **Week 1 gate — book the chartered reviewer panel chair conversation.** No platform build proceeds in isolation. Without panel chair signed, founder is sole reviewer through Q4 and revenue is bounded at ~€14k/month at Tier III — not seed-credible.
- 🔴 **Confirm Convex file storage limits with Convex support BEFORE Phase 1.** If they bind on 100 MB PDFs, design for S3-compatible storage from day one. Discovering this in Phase 4 wastes 4 weeks.
- 🔴 **Founder cannot have a build-only week** without a parallel panel chair recruitment week running alongside.

### Week-by-week — build + panel recruitment in parallel

| Week | Build track (per `verifiq-prompts/16_issuance_commands.md`) | Panel track | Owner | Status |
|---|---|---|---|---|
| 1 | Phase 1 schema + Phase 2 LLM adapter · confirm Convex file limits | **Panel chair conversation booked + held** | Founder + Claude Code | ⚪ |
| 2 | Phase 3 six MVP agents + self-check protocol | Panel chair principle agreement | Founder + Claude Code | ⚪ |
| 3 | Phase 4 workflow orchestration + **job queue (platform mandatory #2)** | First specialist (Architecture) approached | Founder + Claude Code | ⚪ |
| 4 | Phase 5 peer challenge + Phase 6 council chair + exports | Specialist 1 onboarded (deferred honorarium) | Founder + Claude Code | ⚪ |
| 5 | Phase 7a tus.io upload + classification UX (**mandatories #1 + #4**) | Specialist 2 (Fire) approached | Founder + Claude Code | ⚪ |
| 6 | Phase 7b title-block classifier + scan-state model (**mandatories #3 + #5**) | Specialist 2 onboarded | Founder + Claude Code | ⚪ |
| 7 | Phase 7c observability + CI/CD + secrets (**mandatories #6 + #7**) | Specialist 3 (M&E) approached | Founder + Claude Code | ⚪ |
| 8 | End-to-end on 327-finding validation pack · paper prototype review with panel | All 3 specialists confirmed | Founder + panel | ⚪ |
| 9 | First chartered reviewer hand-test on validation pack | First reviewer session held | Founder + panel | ⚪ |
| 10 | Pilot brief sent to 2 friendly customers · first free taster runs | Specialist 4 (BCAR / AC) approached | Founder + customers | ⚪ |
| 11 | Phase 8 feedback loop wiring · first design-team feedback captured | Reviewer panel of 4 in place | Founder + Claude Code | ⚪ |
| 12 | **First paid pack signed and scanned** | Quarterly panel session held | Founder | 🔴 hard gate |

### Critical-path bottleneck flags

- If Week 1 panel chair conversation slips → entire end-game slips week-for-week.
- If Convex storage limits bind and not discovered until Phase 4 → 4-week regression.
- If tus.io upload breaks on the first 15 GB pack → customer permanently lost (Frontend Developer voice, `docs/25`).
- If observability not in place at first paid pack → first incident is invisible, customer trust evaporates.
- If validation-pack integration test isn't part of CI/CD → first regression hits paid customer directly.

### Platform-mandatory delivery checkpoints

| Mandatory | Spec | Owner | Due |
|---|---|---|---|
| #1 tus.io upload | `verifiq-prompts/20_platform_architecture.md` § 1 | FE build | Week 5 |
| #2 Job queue | `verifiq-prompts/20_platform_architecture.md` § 2 | BE build | Week 3 |
| #3 Title-block classifier | `verifiq-prompts/20_platform_architecture.md` § 3 | BE + vision LLM | Week 6 |
| #4 Classification-confirmation UX | `verifiq-prompts/20_platform_architecture.md` § 4 | UI build | Week 5 |
| #5 Scan-state model + email | `verifiq-prompts/20_platform_architecture.md` § 5 | BE + email | Week 6 |
| #6 Observability | `verifiq-prompts/20_platform_architecture.md` § 6 | Founder | Week 7 |
| #7 CI/CD + validation pack | `verifiq-prompts/20_platform_architecture.md` § 7 | Founder | Week 7 |

### Council-deferred to Phase 2

These were council-recommended but explicitly Phase 2 to keep MVP shippable in 12 weeks:

- ISO 19650 standardiser as customer-facing free bonus (**deferred to post-launch success — founder decision 2026-06**)
- Drawing comparison (Rev A vs Rev B)
- Cost-impact estimator on Critical findings
- Programme-impact analyser
- Real-time scan-state push to Slack / Teams
- Anonymised principle-level peer comparison
- Cryptographic audit-log signature (Phase 3)

---

## 🔴 RED LINES — cannot be cut

1. Locked disclaimer on every customer surface — ✅ done
2. TOS + Privacy Notice before first paid scan — P1 item
3. Tech E&O insurance before first paid scan — P1 item
4. Sub-processor list published before first paid scan — P1 item
5. Banned-verb marketing whitelist enforced — ongoing
6. Chartered Irish reviewer on every paid pack — solo-reviewer for now, panel triggered later
7. EU data residency (Convex EU-West) only — P0 item
8. No US healthcare packs without BAA — never to launch
9. 14-day document deletion + 90-day hash retention in code — P1 item
10. No model training on customer documents — ongoing
11. Marketing copy must not claim a panel that does not exist — P0 item
12. Findings outside reviewer's discipline cannot be signed as "chartered-reviewed" — P0 ongoing

---

## P0 · This week · 2026-06-01 → 2026-06-05

**Goal:** VerifIQ has a public face that's honest about where the product is. Total cash out: €60–€260.

### Monday 2026-06-01

- [ ] **Buy `verifiq.ie`** (and `.com` defensive if available) — €15–€60 — Blacknight or Namecheap
- [ ] **Update website to drop "panel" claim** — replace "Reviewed by chartered panel" with "Standards we read against:"; add transparent solo-reviewer line
- [ ] **Deploy verifiq26/website/ to Vercel** under GovIQ org — free tier — wire domain
- [ ] **DNS + `hello@verifiq.ie` forward** to existing GovIQ inbox

### Tuesday 2026-06-02

- [ ] **Create VerifIQ LinkedIn page** — "VerifIQ — A GovIQ product" — launch post linking verifiq.ie
- [ ] **Create Stripe Products** Tier I–V (test mode) — €290 / €590 / €890 / €1,950 / from €2,500 — plus annual seats
- [ ] **Identify reviewer-panel-chair candidate** in network (book coffee for week 2)

### Wednesday 2026-06-03

- [ ] **Provision Anthropic + OpenAI prod keys** under GovIQ org, VerifIQ-tagged
- [ ] **Top up Anthropic credits** — €50–€200 for testing
- [ ] **Create Convex prod deployment EU-West** — free tier, schema from `src/convex/schema.ts`

### Thursday 2026-06-04

- [ ] **Draft solicitor brief** — one paragraph: TOS rider, Privacy Notice, sub-processor list, DPA template, Tech E&O rider review — send for fixed quote
- [ ] **Get Tech E&O rider quote** — GovIQ's existing carrier, request VerifIQ uplift to €2m, monthly-paid

### Friday 2026-06-05

- [ ] **Send 5 LinkedIn outreach messages** to chartered architects/QSs/engineers in personal network — soft "15 minutes" framing
- [ ] **Start EI HPSU application** — free, ~3 hours — Enterprise Ireland High Potential Start-Up Unit
- [ ] **Week-1 review** — Friday 5pm — strike-through completed items, roll incomplete items into P1

---

## P1 · Weeks 2–4 · 2026-06-08 → 2026-06-28

**Goal:** legal to take money. First paying customer possible. Total incremental cash: €2,000–€4,000.

### Week 2 (2026-06-08)

- [ ] **Solicitor engagement signed** — Phase 2 deliverables agreed at fixed quote (€800–€1,500 expected for TOS + Privacy)
- [ ] **Panel chair conversation** (no honorarium discussed) — opening interest, no commitment
- [ ] **Publish sub-processor list** at `/sub-processors` on website — Anthropic · OpenAI · Stripe · Convex · Vercel · Clerk · Resend
- [ ] **Build pricing.html** using Appendix B from Doc 14 — Tier I–V table, early-pilot 30% window, VAT stamp

### Week 3 (2026-06-15)

- [ ] **TOS + Privacy + DPA finalised** by solicitor — published on website
- [ ] **Tech E&O rider in place** — monthly-paid, €600–€1,200/yr
- [ ] **Stripe live mode enabled** — VAT rates confirmed via Stripe Tax
- [ ] **DPIA documented** — internal, ready for ICO/DPC on request

### Week 4 (2026-06-22)

- [ ] **Live POC scan pipeline end-to-end** — wire `src/convex/actions/*.ts` to prod Convex, test ZIP upload → classify → scan (1 discipline) → source-quote verify → review queue → release. Benchmark against the 327-finding Office project pack
- [ ] **14-day deletion + 90-day hash retention** scheduled jobs in Convex — running
- [ ] **First free-tier pilot pack uploaded** — friendly contact, full E2E flow tested
- [ ] **P1 close review** — Friday 2026-06-26 — confirm readiness to take paid customer

---

## P2 · Months 2–4 · 2026-07 → 2026-09

**Goal:** properly serious. 3–6 paying customers. Sole-reviewer scope honoured. Total incremental cash: €8,000–€15,000.

### July 2026 — Month 2

- [ ] **First paid customer signed** — Tier II or III, early-pilot 30% rate
- [ ] **First reviewer-signed paid pack released** — you sign procurement / contract / coordination findings; M&E / fire / arch findings marked "AI-surfaced · pending chartered review"
- [ ] **Trademark IE filing** — €380–€650 — IPOI Ireland — once first invoice paid
- [ ] **First specialist-per-pack relationship identified** — usually M&E first (most-flagged discipline)

### August 2026 — Month 3

- [ ] **Case study artefact** — 327-finding Office project pack, anonymised, designed, published — €2,000–€4,500 — funnel-critical
- [ ] **3 paying customers cumulative**
- [ ] **Panel chair retained** on equity-share + first honorarium — triggered by cumulative revenue or first dispute
- [ ] **Per-pack M&E specialist** invoiced first time (Option C in Doc 16) — €150–€350

### September 2026 — Month 4

- [ ] **First annual seat sold** — Tier III at €11,400 (or early-pilot €7,980)
- [ ] **Engineers Ireland Annual Conference attendance** — speaking slot ideal, attendee otherwise — €600–€1,200
- [ ] **6 paying customers cumulative**
- [ ] **P2 close review** — assess readiness for pre-seed pitch (P3 entry)

---

## P3 · Months 5–9 · 2026-10 → 2027-02

**Goal:** pre-seed credible. 8–15 paying. Bridge facility in place. Seed raise active by month 9. Total incremental cash: €20,000–€60,000.

### Q4 2026 (Oct–Dec)

- [ ] **NSAI standards subscription** — €4,500–€8,200 — once corpus loader exists and 5+ customers
- [ ] **Cyber + GL + D&O policies bound** — €5,500–€8,500 — pre-seed close
- [ ] **EUIPO trademark filing** — €1,500–€2,800 — pre-UK-announce
- [ ] **First contract engineer engaged** — 8 weeks senior — €18k–€32k — for platform hardening
- [ ] **Pre-seed bridge facility confirmed** — angel + EI HPSU + named-cheque — 3 months of runway protection
- [ ] **Panel formalised to 3–4 named members** (not yet 11) — equity participation agreed
- [ ] **10 paying customers cumulative**

### Q1 2027 (Jan–Feb)

- [ ] **Seed pitch deck finished** — 15 slides — built from Docs 12, 14, 15
- [ ] **Seed raise active** — Atlantic Bridge, Frontline, ACT — target €1.5–€2.5m
- [ ] **15 paying customers cumulative**
- [ ] **Seed close** — by 2027-02-28 latest

---

## P4 · Months 10–12 · 2027-03 → 2027-09 (post-seed)

**Goal:** UK launch executed, Ireland book scaling. Total cash from seed proceeds.

- [ ] **First engineer employed** — senior FE/BE — €52k–€85k
- [ ] **First sales/partnerships hire** — part-year — €38k–€72k
- [ ] **UK solicitor retained** — BSA-specific addendum — €6k–€11k
- [ ] **UK reviewer panel signed** — 8 seats RIBA + ICE + RICS — €36k–€58k Y1
- [ ] **UK insurance bound** — Tech E&O £2m — £18k–£28k
- [ ] **UK launch — first 3 London practices** by 2027-09
- [ ] **Ireland book at 40+ paying customers** by 2027-09

---

## Trigger map — when each item fires

| Trigger | What fires |
|---|---|
| TODAY | All P0 items |
| First customer interest serious | Solicitor engagement (TOS+Privacy+DPA) |
| First customer asks for proof of insurance | Tech E&O rider |
| First paid pack | First honorarium to panel chair |
| €5k cumulative VerifIQ revenue | Trademark IE filing |
| Month 3 OR first signed pilot | Case study artefact |
| 5+ customers + corpus loader exists | NSAI subscription |
| Pre-seed pitch deck assembled | Cyber + GL + D&O policies bound |
| Pre-UK announce | EUIPO trademark filing |
| Revenue covers 50% of cost | First contract engineer |
| 4 paid packs/wk sustained 4 weeks | Recruit panel chair beyond solo |
| Customer dispute / chartered specialty required | Solo-reviewer phase ends |
| Seed pitch | Panel chair + 2 named specialists must be in place |
| Post-seed close | First employee hire |
| First UK customer | UK panel + UK insurance + UK locale config |

---

## Weekly cadence — the meeting with yourself

**Every Monday 9am — 15 minutes:**

1. Strike through completed items above.
2. Move incomplete items to current week.
3. Check the trigger map — has anything fired since last Monday?
4. Cash check — did anything spent exceed the phase budget?
5. Red-line check — any of the 12 red lines at risk?
6. Update "Last reviewed" date at top.
7. If anything blocks, escalate (to yourself, to GovIQ co-founder if any, to advisor).

**Every Friday 5pm — 10 minutes:**

1. What did I commit to this week that didn't ship?
2. Why?
3. What's the smallest next step that unblocks it?
4. Roll into Monday's plan.

---

## Reference documents

| Doc | Purpose |
|---|---|
| `docs/01-feasibility-business-plan.docx` | Strategic spine |
| `docs/02-token-economics-pricing.xlsx` | Compute economics |
| `docs/08-systems-architecture-v0.2.docx` | Platform architecture |
| `docs/09-sector-role-onboarding-wizard-spec.docx` | Sector taxonomy + onboarding |
| `docs/10-internal-review-plan.docx` | Reviewer panel plan (for when panel triggers) |
| `docs/11-abuse-prevention-spec.md` | Free-tier defence + locked rules |
| `docs/12-international-scaling-council.md` | Scaling strategy (post-Ireland) |
| `docs/13-global-legal-council.md` | Legal posture + locked language per market |
| `docs/14-setup-costs-pricing-council.md` | Standalone cost model (superseded by Doc 15 for ops) |
| `docs/15-shoestring-bootstrap-ireland.md` | Shoestring operating plan — current |
| `docs/16-solo-reviewer-phase.md` | Solo-reviewer addendum |
| `website/legal-notice.html` | Customer-facing per-jurisdiction legal |
| `evidence/findings-register-v0.8-scan-view.xlsx` | 327-finding pack — case-study source |

---

## The single sentence that holds this plan together

> *VerifIQ ships from inside GovIQ this week as a solo-reviewer product line on €260 cash, becomes legal to charge in week 4 on €4k cumulative, takes its first paid customer in July, reaches 10 paying customers and panel formalisation by Q4, and closes seed by February 2027 to launch UK.*

---

*Pinned at repo root · update every Monday · single source of truth*
