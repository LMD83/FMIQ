# VerifIQ

> Tender pack and design document checking system for the Irish construction market.

[![Status](https://img.shields.io/badge/status-pre--MVP-orange)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()
[![Built for](https://img.shields.io/badge/built%20for-Irish%20standards-blue)]()

VerifIQ is a checking system that helps design teams, contractors and Employer-side capital programmes identify document-quality issues in tender packs before issue — outdated standards, cut-paste from prior projects, missing schedules, FSC condition gaps, jurisdictional mis-references.

**Output is indicative. The user verifies locally. No professional opinion. No PI exposure.**

---

## Repository structure

```
verifiq26/
├── README.md                       # this file
├── LICENSE                         # proprietary notice
├── .gitignore                      # Node.js + standard exclusions
│
├── website/                        # marketing site (static HTML mockups)
│   ├── index.html                  # main site — VerifIQ (Verify product)
│   ├── hunt.html                   # contractor product landing (orange)
│   ├── studio.html                 # sole-practitioner product landing (emerald)
│   ├── dashboard.html              # post-login product UI mockup
│   └── three-products.html         # plain-English portfolio explainer
│
├── docs/                           # commercial documentation
│   ├── 01-feasibility-business-plan.docx
│   ├── 02-token-economics-pricing.xlsx
│   ├── 03-systems-architecture.docx
│   ├── 04-investor-prospectus.docx
│   ├── 05-gtm-outreach-pack.docx
│   ├── 06-hunt-variation-exposure-sample.xlsx
│   └── 07-gtm-crm-tracker.xlsx
│
├── evidence/                       # validation engagement evidence (May 2026)
│   ├── findings-register-v0.8-scan-view.xlsx     # 327 findings
│   └── pack-manifest-stage-2c.xlsx               # 161-file inventory
│
├── src/                            # product source code (MVP build target)
│   ├── app/                        # Next.js 14 (App Router) — placeholder
│   ├── convex/                     # Convex backend
│   │   └── schema.ts               # DB schema (multi-tenant)
│   └── public/                     # static assets
│
└── .github/
    └── workflows/                  # CI/CD (Vercel + Convex)
```

---

## Quick start

### View the marketing site

Open `website/index.html` in any browser. No build step. The HTML mockups use Tailwind via CDN and vanilla JavaScript for the live typing demos.

```bash
# macOS / Linux
open website/index.html

# Windows
start website/index.html
```

Site map:

- `website/index.html` → main VerifIQ marketing site
- `website/hunt.html` → contractor product (VerifIQ Hunt — variation exposure scanner)
- `website/studio.html` → sole-practitioner product (VerifIQ Studio — single-discipline)
- `website/dashboard.html` → post-login product UI mockup
- `website/three-products.html` → plain-English portfolio strategy explainer

### Review the business documents

The `docs/` folder is the canonical commercial documentation set. Open in order:

1. **Feasibility study + business plan** — the spine document. Market, model, financials, GTM, roadmap.
2. **Token economics + pricing model** — live Excel model. Edit yellow cells, margin recalculates.
3. **Systems architecture + build spec** — engineering build doc. Convex schema, API design, MVP plan.
4. **Investor prospectus** — 10-page strategic conversation pack.
5. **Week 1 GTM outreach pack** — 23 templates ready to send.
6. **Hunt variation exposure sample** — contractor product proof-of-concept output.
7. **CRM tracker** — Week 1 outreach tracking spreadsheet, live formulas.

### Review the validation evidence

The `evidence/` folder contains the anonymised output from the May 2026 validation engagement that anchors the entire VerifIQ proposition.

- **Findings register v0.8 (Scan View)** — 327 findings across 5 disciplines, source-quoted, severity-tagged.
- **Pack manifest** — 161-file inventory of the original Office project pack reviewed.

---

## Three products, one engine

VerifIQ ships three branded products on the same underlying checking engine:

| Product | Audience | Price | Output framing |
|---|---|---|---|
| **Verify** | Design teams (architects, engineers) | €150–€800 / check | "Possible issues, please verify" |
| **Hunt** | Main contractors (pre-con, QS) | €300–€2,000 / scan | "Variation exposure with PW-CF clause mapping" |
| **Studio** | Sole practitioners, small firms | €60–€300 / check | "Single discipline, faster, cheaper" |

Plus a **Programme** tier for Employer-side capital programmes (OGP framework holders, commercial landlords, multi-site office programmes) — custom pricing, SSO, audit trail, single-tenant deployment.

---

## Tech stack (MVP build target)

- **Frontend**: Next.js 14 (App Router) on Vercel
- **Backend / DB**: Convex (TypeScript, reactive)
- **Auth**: Clerk
- **Billing**: Stripe + Stripe Tax (VAT)
- **Inference**: Anthropic Claude (primary), OpenAI (fallback)
- **Email**: Resend (React Email)
- **Analytics**: Plausible + PostHog (EU-hosted)
- **Errors**: Sentry (EU project)
- **Hosting region**: EU only (GDPR alignment)

See `docs/03-systems-architecture.docx` for full architecture, data model and MVP build plan.

---

## Roadmap

- **Phase 1** (Months 0–6) — MVP build, 5 pilot customers, first paid checks
- **Phase 2** (Months 6–12) — Subscription tiers, customer dashboard, €25k+ MRR
- **Phase 3** (Months 12–24) — Programme tier (Employer-side), SSO, audit trail
- **Phase 4** (Months 24+) — UK corpus, vertical extensions, API for CDE integrators

See `docs/01-feasibility-business-plan.docx` Section 12 for full milestones.

---

## Legal

VerifIQ is a software checking tool. Outputs are indicative software outputs, not professional advice. Users are responsible for verifying every finding and for any decision taken based on the output. VerifIQ does not provide design review, certification or compliance opinions. VerifIQ is not a substitute for the work of an Assigned Certifier, Design Certifier, Lead Designer, Chartered Architect, Chartered Engineer, Chartered Surveyor or any other designated professional.

See `LICENSE` for proprietary licence terms.

---

## Contact

**Liam Dunne** — Founder
liam@goviq.ie · verifiq.ie

VerifIQ is part of the GovIQ product family. An Irish company. Built for Irish standards. EU data residency.

---

© 2026 VerifIQ / GovIQ. All rights reserved.
