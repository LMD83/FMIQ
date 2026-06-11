# VerifIQ — International Scaling Council

**Doc ID:** `verifiq-scaling-v0.1`  
**Status:** Strategic position paper for executive review  
**Purpose:** Define how VerifIQ scales beyond Ireland to UK, EU, Australia, North America — covering legal, regulatory, technical, product, and design dimensions.  
**Format:** A council of seven voices, each with a defined remit, then a single consolidated decision matrix at the end.  
**Date:** 2026-06-01

---

## Why a council, not a memo

Internationalisation is the move where small product companies overreach and die. Every market has its own building code, its own contract form, its own profession-registration body, its own audit culture. Naïve translation ("just point the corpus at British regs") destroys trust the first time the output cites the wrong standard. This document is structured as a council — seven specialist voices, each laying out their position separately — so we can see where the disciplines agree, where they fight, and what the actual sequenced path looks like.

The voices, in the order they speak:

1. **Strategic Council Chair** — frames the market opportunity and the order of moves
2. **Regulatory & Compliance Lead** — the corpus differences market by market
3. **UX/UI Lead** — what changes visually and interactively per market
4. **Front-End Lead** — i18n, localisation, asset weight, accessibility
5. **Back-End / Platform Lead** — data residency, multi-region, corpus loader, infra
6. **Product Director** — sequencing, dependencies, revenue model, kill criteria
7. **Independent Auditor** — adversarial review; what the council got wrong

---

## I · Strategic Council Chair

**Remit:** Market shape, order of moves, what to build vs what to buy vs what to refuse.

**Position:**

The temptation is to read "VerifIQ scans tender packs" as a globally portable problem and conclude the TAM is every construction tender in every market. It is not. The product is sold on the trust of *named* regulatory frameworks — BCAR, CWMF, PW-CF, RIAI, Engineers Ireland — and that trust does not transfer. We do not have a product in Toronto until we have engaged Ontario Building Code, the Royal Architectural Institute of Canada (RAIC), and Engineers Canada. We do not have a product in Sydney until NCC, NSW Building Commission, and the Australian Institute of Architects sit on the equivalent panel.

The order of moves must be: **English-speaking common-law jurisdictions first, EU civil-law jurisdictions second, North America third, Asia/Middle East only with named partners.**

Specifically:

1. **Ireland (home market)** — MMXXVI–MMXXVII. Prove the model. 3–5 paid practices.
2. **United Kingdom (England + Wales, then Scotland separately)** — MMXXVII. Building Regulations Approved Documents, RIBA, ICE, RICS. Closest regulatory cousin to Ireland. Largest single jurisdiction we can address. Reviewer panel: RIBA Chartered + ICE CEng + MRICS QS.
3. **Australia (NSW + VIC first)** — MMXXVIII. NCC, Australian Institute of Architects, Engineers Australia. Common-law, English-language, similar tender culture. Reviewer panel: AIA + IEAust + AIQS.
4. **EU (Germany + Netherlands)** — MMXXVIII–MMXXIX. DIN/BIM, BAK, NL Vergunningsprocedure. Higher friction — civil law, language barrier, distinct profession registration. Worth doing only with local co-founders or named partners.
5. **North America (Canada first, then US state-by-state)** — MMXXIX. National Building Code of Canada is federal; provincial enforcement. US is 50 separate codes; we enter via AIA chapters or with a state-specific co-founder.
6. **Singapore / UAE / Middle East / Asia** — MMXXX onward. Only through named partnerships. Do not lead.

**What we refuse:** "Translate the corpus" requests from any jurisdiction without a chartered local reviewer panel in place. The corpus is not the product; the *reviewer + corpus + audit log* is the product. We will not sell into a market we cannot back with chartered local eyes.

**Build vs buy vs partner:**

- **Build:** the multi-corpus loader, the per-jurisdiction reviewer routing, the per-jurisdiction findings register schema.
- **Buy:** legal standards databases where available (BSI, NSAI feeds, NRC-CNRC, Standards Australia). Avoid scraping; pay for proper licences.
- **Partner:** local reviewer panels recruited via the relevant chartered body. Equity participation for panel founders in each new jurisdiction is on the table.

---

## II · Regulatory & Compliance Lead

**Remit:** What changes about the corpus and the legal scaffold per jurisdiction.

**Position:**

The corpus is not portable. Every market has six distinct layers, and all six must be loaded, mapped, and kept current:

| Corpus layer | Ireland | UK | Australia | Canada | US |
|---|---|---|---|---|---|
| **Building code** | TGD A–M | Building Regs ADs | NCC | NBC + provincial | IBC + state amendments |
| **Materials standards** | I.S. + I.S. EN | BS + BS EN | AS + AS/NZS | CSA + ULC | ASTM + ANSI |
| **Construction admin / assigned cert** | BCAR SI 9/2014 | Building Safety Act 2022 + Gateway 2/3 | NCC Vol 1–3 + state cert | OBC Pt 11 + local inspectors | Local AHJ + permits |
| **Procurement / contract form** | PW-CF (CWMF) | NEC4 / JCT | AS 4000 / AS 11000 | CCDC | AIA A201 / state public |
| **Profession registration** | RIAI · EI · SCSI · IFSE | ARB · RIBA · ICE · RICS | AIA · IEAust · AIQS | RAIC + provincial | NCARB + state boards |
| **Sector regulation** | HSE PCM · HBN/HTM | DHSC HBN/HTM · NHS PSS | Health Infrastructure NSW | Provincial health auth. | DHA + state health |

**Each layer is updated independently** by the issuing body. Our corpus loader must subscribe to each (paid where possible) and version-stamp every finding to the corpus version it was read against. If a standard is superseded mid-pack, the audit log must show which version was in force when the read happened.

**Legal exposure changes per jurisdiction:**

- **UK** — Building Safety Act 2022 raises the duty of "competent persons" significantly. Our "indicative output / you verify / no PI" stance survives, but the wording on the UK output must reference the Act and *explicitly disclaim* duty-holder status under it.
- **Australia** — Building Commission NSW has a published list of approved certifiers; we are NOT one. Same posture as Ireland but worded to NSW Building Commission's framework.
- **Canada (Ontario)** — qualified person designations are tightly controlled by OBC Part 11. Output disclaimer must mention QP status explicitly.
- **US** — state by state. We do not enter without local counsel in each state we sell into.

**GDPR / data residency:**

- **Ireland + EU + UK** — data residency in EU (Dublin region). UK accepts EU residency post-adequacy decision (2025 renewal).
- **Australia** — Privacy Act 1988 + APP 8 on cross-border disclosure. Sydney region required.
- **Canada** — PIPEDA + provincial laws (Quebec Law 25 is strict). Canada-Central region required.
- **US** — no federal standard; California CCPA + state laws. US-East-1 region. HIPAA implications if scanning healthcare packs.

**Conclusion:** The corpus loader must support **at least four distinct standards-body API integrations** and **four data residency regions** before international scale-out is real. Both are 6–9 month engineering projects.

---

## III · UX/UI Lead

**Remit:** What changes visually per market — and what must not change.

**Position:**

The visual identity (IBM Plex, drawing-paper palette, drawing-board components) is portable. Chartered architects and engineers in every market we will enter respect the same visual language: restrained typography, monochrome canvas, named profession marks, audit-log discipline. We do not need a different look in London or Sydney.

What **does** change:

- **Date / number formats.** ISO 8601 (`2026-06-01`) is acceptable in all markets we'll enter. Currency must localise: €, £, AU$, CA$, US$. Tier prices must be set per market with deliberate anchoring, not converted at spot rates.
- **Profession marks.** The hero strip currently reads "RIAI · EI · SCSI · ACEI · OGP · HSE." This list must rotate per locale. UK: "ARB · RIBA · ICE · RICS · NEC4." Australia: "AIA · IEAust · AIQS · NCC." Etc. We need a per-locale `professionMarks` config.
- **Reference projects shown.** The atelier marquee currently shows Trinity, Custom House, Convention Centre. Each market needs its own reference set — UK uses Tate Modern / Heatherwick / Foster work; Australia uses Sydney Opera House / Melbourne Recital / Glenn Murcutt residences; Canada uses Habitat 67 / Aga Khan Museum.
- **Sector taxonomy.** "Irish healthcare day-service terminology" is meaningless outside Ireland. The 8-sector taxonomy in the onboarding wizard needs per-market sub-types and per-market terminology (UK: "NHS Trust capital scheme"; Australia: "Local Health District redevelopment").
- **Statutory disclaimer.** The exact words of "we do not certify" must be reviewed by local counsel in each jurisdiction. The intent is identical; the wording is not portable.

What **must not** change:

- The serif wordmark V_IQ (translates to mark — universal).
- The IBM Plex type system.
- The drawing-paper palette.
- The CAD-vocabulary component library.
- The chartered-reviewer-gate principle.
- The source-quote verification model.

**Implementation:** Per-locale theme bundle = one JSON config + one image set + one disclaimer block. Loaded by a `locale` parameter at the route level. No CSS rewrites, no rebuild.

---

## IV · Front-End Lead

**Remit:** i18n, localisation infrastructure, performance under multi-locale, accessibility per jurisdiction.

**Position:**

The current site is single-locale, en-IE. To scale we need:

1. **Locale detection + selection.** At first paint, detect from URL path (`/uk/`, `/au/`), then domain (`verifiq.co.uk`, `verifiq.com.au`), then browser language as fallback. Persistent locale cookie. Path is the canonical truth — domain and cookie are conveniences.
2. **String externalisation.** Every customer-facing string in JSON message files. Use ICU MessageFormat for plurals (`"Found {count, plural, one {1 critical} other {# critical}}"`). No string concatenation in code.
3. **Number / date / currency formatting.** `Intl.NumberFormat`, `Intl.DateTimeFormat`. Never hand-format.
4. **Profession marks + reference imagery** loaded from per-locale config.
5. **RTL readiness.** Not needed for our launch markets but plan now — Middle East comes later. Use logical CSS properties (`margin-inline-start`, not `margin-left`). Costs nothing if done from the start; expensive to retrofit.
6. **Accessibility.** WCAG 2.2 AA non-negotiable. UK PSBAR 2018 + EU EAA 2025 + ADA Title III + DDA Australia all require it. The drawing-paper palette has been spot-checked at AA but every locale's accent colour must be re-tested.
7. **Asset weight.** The atelier marquee currently loads 10 large Unsplash images. Per-locale image sets multiply this. Move to a per-locale `references/` folder with WebP + AVIF + responsive sizes. Target: ≤ 600 KB above the fold on 4G.

**Stack additions:**

- `next-intl` (or `next-i18next`) for routing + messages.
- A `locales/` folder per market with messages.json, professions.json, references.json, disclaimer.json.
- A single `useLocale()` hook everywhere.
- One Tailwind config — colours and type stay constant.

**Estimated work:** 4 weeks to retrofit current 7 pages. 1 week per new locale after that.

---

## V · Back-End / Platform Lead

**Remit:** Data residency, multi-region infra, corpus loader, scan orchestration across jurisdictions.

**Position:**

We currently run one Convex deployment in EU-West (Dublin). Going international means:

1. **Multi-region Convex deployments** — one per data-residency boundary. Convex supports this with workspaces. Routing happens at the auth layer (Clerk) — user's organisation has a `region` field; their data lives only in that region.
2. **Corpus separation.** Each region has its own corpus index. The Ireland Convex deployment carries the Irish corpus only. The UK deployment carries the UK corpus. No cross-region corpus references at runtime.
3. **Shared metadata layer.** Tenant-blind data (sectors taxonomy, role definitions, finding severity scale) is replicated across regions and version-controlled in git. This is the only data that crosses borders.
4. **Corpus loader subsystem.** A scheduled job per jurisdiction pulls from each standards-body source (paid API where available, controlled scraping where not). Each standard is hashed; changes generate a corpus version bump that propagates to scan-prompt builders. The audit log records which corpus version was used for every scan.
5. **Per-jurisdiction reviewer routing.** The reviewer panel for each region is a separate group. A Dublin pack routes to the Irish chartered panel; a London pack routes to the UK panel. Cross-routing is forbidden by policy.
6. **Stripe Tax + per-region pricing.** Stripe Tax handles VAT, GST, sales tax. Pricing per locale is set in Stripe (`price_eu_tier_3`, `price_uk_tier_3`).
7. **Failover.** Multi-provider AI failover (Anthropic primary + OpenAI fallback) stays as-is, both regional. Some regions (Canada, Australia) require AI calls from regional endpoints, not US — verify both providers have local inference at launch.

**The hardest engineering problem:** the corpus loader. We must subscribe to NSAI, BSI, Standards Australia, CSA, ASTM, etc. — each costs money, each has a different licence regime, each updates on a different cadence. Building a unified loader that handles version updates without breaking historical audit logs is the single largest piece of platform work needed for international scale.

**Estimated work:** 8 weeks for multi-region Convex routing. 12 weeks for the corpus loader subsystem. 4 weeks for Stripe multi-currency. **6 months total before we can credibly take payment from a second jurisdiction.**

---

## VI · Product Director

**Remit:** Sequencing, dependencies, revenue model, kill criteria.

**Position:**

We are not ready to internationalise. We have one paying customer signal at home (none yet). We have a reviewer panel committed but not signed. We have a POC pipeline but not a production scan. Talking about Sydney before Dublin pays is a strategic error.

But — the international story is fundable. The narrative for investors is exactly this: "We will own Ireland in twelve months, mirror to the UK in twenty-four, then sequence common-law markets behind that." That narrative buys us a Series A. The work behind it sequences over 24–36 months. Do not actually open a second market until home is profitable.

**Dependencies, in order:**

1. **3 paying Irish practices** at Tier III or above. (Q3 MMXXVI)
2. **Reviewer panel signed and operational** in Ireland — 11 seats. (Q3 MMXXVI)
3. **First fundraise closed** — €1.5–2.5m seed on the international narrative. (Q4 MMXXVI)
4. **Multi-region platform engineering complete** — Convex routing, Stripe Tax, corpus loader. (Q1–Q2 MMXXVII)
5. **UK reviewer panel signed** — 8 seats via RIBA / ICE / RICS introductions. (Q2 MMXXVII)
6. **UK corpus loaded and version-stamped** — BSI feed, Approved Docs scraped within legal limits. (Q2 MMXXVII)
7. **UK launch — three London practices.** (Q3 MMXXVII)
8. **Australia scoping** with local co-founder candidate. (Q4 MMXXVII)
9. **Australia launch — Sydney + Melbourne.** (Q2 MMXXVIII)
10. **Canada or EU next — board decision, not founder decision.** (H2 MMXXVIII)

**Revenue model per market:** Same shape. Tier I–V. Single-pack and annual seat. Concierge for the top tier. The pricing currency and absolute level adjusts per market — UK roughly £-for-€ at parity; Australia and Canada index to local market norms. US pricing 30% above EU because the market expects it.

**Kill criteria — when we abandon international expansion:**

- If Irish ARR < €300k by Q1 MMXXVII → stay in Ireland. No expansion.
- If UK reviewer panel cannot be assembled within 6 months of dedicated effort → defer UK indefinitely; pivot to AU or NA.
- If first second-market scan accuracy falls below 85% of the Irish benchmark within 3 months of launch → freeze further expansion until corpus and reviewer issues are resolved.
- If any single market shows abuse cost > 15% of revenue → close that market.

**What I refuse to authorise:** a 2027 expansion budget without a working reviewer panel commitment in the target market. The reviewer panel is the gate. No panel, no entry.

---

## VII · Independent Auditor

**Remit:** Adversarial review. What did the council get wrong, miss, or rationalise.

**Position:**

I have read each preceding voice. Here are the holes:

**On the Chair's order of moves.** UK before Australia is defensible. But the Chair has implicitly assumed Brexit-adjacent UK regulatory frameworks remain stable. They are not — the UK Building Safety Act 2022 is still being implemented in phases (Gateway 2 enforcement increasing through MMXXV–MMXXVI; Building Safety Regulator powers still expanding). Entering UK in MMXXVII means scanning packs against rules that are themselves moving. Risk to mitigate with explicit version-stamping and Building Safety Regulator liaison.

**On the Regulatory Lead's corpus claim.** The table is correct but understated. They have listed six layers; there are at least three more in every jurisdiction: planning consent regime (utterly distinct per country, sometimes per region within a country), fire-safety regime (changing rapidly post-Grenfell in UK, post-Notre-Dame in EU, Lacrosse in AU), and accessibility regime (ADA-AS vs Part M vs BS 8300-2 vs DDA AU). The corpus loader must address nine layers, not six.

**On the UX/UI Lead's "visual identity is portable" claim.** Partially wrong. The Cinzel/Plex Serif heritage register reads as British/European authority in markets where authority is *not* signalled that way. Australian and Canadian professional practice culture is more egalitarian, less ceremonial. A "drawing-board atelier" register that sells in Dublin and London may read as snobbish in Brisbane. We need to test the visual identity in market before committing to "no change."

**On the Front-End Lead's i18n estimate.** "1 week per new locale" is optimistic. New locale requires: messages translated and reviewed, profession marks confirmed by local counsel, reference imagery legally cleared, disclaimer text reviewed by local solicitor, accessibility re-tested, Stripe locale enabled, support handoff defined, support hours adjusted. Realistic estimate: 6–8 weeks per new locale, of which 1 week is engineering and 5–7 weeks is the cross-functional work the engineer cannot do alone.

**On the Back-End Lead's corpus loader.** The hardest part is not the loader; it is the *licensing*. Subscribing to BSI, Standards Australia, CSA full-text is in the tens of thousands of euro per year, per jurisdiction. The current business plan does not carry this cost. Either we negotiate enterprise licences (slow, expensive, requires a real revenue base first) or we operate on "name + clause reference" only (cheaper, but findings carry less weight).

**On the Product Director's kill criteria.** Correctly conservative. But missing: a kill criterion for the *Irish* market that would freeze the entire company, not just international. If Irish ARR is below €100k at end of MMXXVI, we have a product–market problem that no expansion fixes. The Director's plan is fundable but assumes home market succeeds; it does not specify what failure at home triggers.

**Three things this council did not address:**

1. **AI vendor concentration.** All five voices implicitly assume Anthropic and OpenAI remain available, priced as today, and willing to serve construction-AI use cases. If either deprecates the model class we depend on, or if either restricts construction-document scanning under safety policy, the entire product breaks. We need at least one open-weights fallback (Llama or similar self-hosted) before international scale-out.
2. **Insurance.** Operating internationally means professional indemnity insurance in each market. The "indicative output / no PI" stance is a legal posture, not an insurance product. We still need errors-and-omissions cover at each market entry. Quotes have not been obtained.
3. **Currency and tax accounting.** The Product Director mentioned Stripe Tax; the Back-End Lead mentioned it; nobody mentioned that consolidated financial reporting across 4+ jurisdictions in 4+ currencies requires a real accounting system (NetSuite-class or strong Xero with multi-entity), not a spreadsheet. Add this to the H2 MMXXVII work list.

**Recommendation:** Approve the strategic direction. Do not approve the timeline. The MMXXVII UK launch should slip to MMXXVIII unless the corpus-licensing and PI-insurance issues are resolved in H1 MMXXVII. The council has been honest about engineering complexity and dishonest about regulatory and commercial complexity. Adjust.

---

## Consolidated Decision Matrix

The seven voices agree on more than they disagree on. The decision matrix below records what the council collectively recommends, what it disputes, and what is escalated to the board.

| Decision | Council position | Disputed by | Status |
|---|---|---|---|
| **Sequence Ireland → UK → AU → NA → EU → Asia** | Approved | Auditor on timing | **Approved with revised timeline** |
| **One reviewer panel per market, no cross-routing** | Approved | None | **Approved** |
| **One visual identity system globally** | Approved | Auditor (test in-market) | **Approved with mandatory in-market test before AU launch** |
| **Multi-region Convex + Stripe Tax** | Approved | None | **Approved — H1 MMXXVII work** |
| **Per-locale config bundles (messages, professions, references, disclaimer)** | Approved | None | **Approved — H2 MMXXVI start** |
| **Corpus loader as nine-layer system, not six** | Auditor's revision | None | **Adopt nine layers** |
| **Subscribe to paid standards-body feeds per market** | Approved | Auditor on cost | **Approved, budget €120k/yr at full scale, ramps with revenue** |
| **WCAG 2.2 AA non-negotiable** | Approved | None | **Approved** |
| **Open-weights AI fallback before international launch** | Auditor's addition | None | **Approved — Phase 0 work** |
| **PI insurance per market before launch** | Auditor's addition | None | **Approved — gating item per market** |
| **UK launch MMXXVII** | Director's plan | Auditor (defer to MMXXVIII) | **Escalated to board** |
| **Kill criterion for Irish ARR < €100k at end of MMXXVI** | Auditor's addition | None | **Approved** |
| **No expansion without reviewer panel signed in target market** | Director's hard line | None | **Approved — written into the funding term sheet** |

---

## Appendix A · The single sentence that holds the strategy together

> *VerifIQ is not internationally portable as software. It is internationally portable as method, and only where a chartered local reviewer panel will stand behind that method in market.*

That sentence governs every sequence, every kill criterion, every refusal in the matrix above. Everything else is operational detail.

---

*End of position paper — VerifIQ Council · v0.1*
