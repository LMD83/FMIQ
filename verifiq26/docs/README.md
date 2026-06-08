# VerifIQ — Documentation Index

**Repo root pinned doc:** `../PROJECT_PLAN.md` — start there.

---

## Strategic + Council Documents

| Doc | Title | Purpose |
|---|---|---|
| 01 | Feasibility Business Plan (docx) | Strategic spine |
| 02 | Token Economics & Pricing Model (xlsx) | Compute economics — superseded operationally by Doc 14/15 |
| 03 | Systems Architecture v0.1 (docx) | Original — superseded by Doc 08 |
| 04 | Investor Prospectus (docx) | Strategic conversation pack |
| 05 | GTM Outreach Pack (docx) | Week-1 GTM templates — extended by Doc 22 |
| 06 | Hunt Variation Exposure Sample (xlsx) | €3.89m central exposure sample |
| 07 | GTM CRM Tracker (xlsx) | Week-1 CRM tracker |
| 08 | Systems Architecture v0.2 (docx) | 600-attachment scope, per-discipline ZIP, HITL |
| 09 | Sector + Role + Onboarding Wizard Spec (docx) | Sector taxonomy, role definitions, wizard logic |
| 10 | Internal Review Plan (docx) | 11-seat panel plan (deferred during Solo Reviewer Phase) |
| 11 | Abuse Prevention Spec (md) | 6-layer abuse defence + free-tier output shaping |
| 12 | International Scaling Council (md) | UK → EU → AU → CA → US sequencing |
| 13 | Global Legal Council (md) | Per-jurisdiction locked language + insurance schedule |
| 14 | Setup Costs + Pricing Council (md) | Standalone cost model + 3 pricing bases |
| 15 | Shoestring Bootstrap Ireland (md) | **Current operating frame** — VerifIQ inside GovIQ |
| 16 | Solo Reviewer Phase (md) | Solo-reviewer rules, scope, upgrade triggers |
| 17 | Full Action Backlog (md) | 167 items across 9 categories |
| 18 | Email Templates (md) | 5 transactional templates for Resend |
| 19 | Sales Playbook (md) | Demo script, discovery, kickoff, success cadence |
| 20 | Compliance SOPs (md) | DPIA, DSR, breach, refund, SLA, incident, Article 22 |
| 21 | Solicitor Brief (md) | Phase 2 legal pack instructions |
| 22 | LinkedIn Content Pack (md) | Launch post, 5 outreach variants, signature, 12-week rhythm |
| 29 | Launch Readiness Package (md) | **Master index** — wireframes, automation workflow, Ruflo/GStack gates |
| 30 | Gap Analysis (md) | Spec vs wireframe vs code vs tests — P0 blockers G-01–G-12 |
| 31 | Playwright Test Plan (md) | 12 E2E suites, CI config, validation-pack gate |
| 32 | Claude Code Execution Plan (md) | Phased build prompts + kickoff + launch DoD |

---

## Project Root Documents

- `PROJECT_PLAN.md` — pinned master schedule + weekly Monday review trigger
- `README.md` — repo overview
- `LICENSE` — proprietary notice
- `.gitignore` — Node + customer-data protection

---

## Website Surfaces (`/website/`)

| Page | Purpose | Aesthetic |
|---|---|---|
| `index.html` | Marketing home | Engineering register (IBM Plex / bone paper / CAD components) |
| `pricing.html` | Five-tier pricing | Engineering register |
| `legal-notice.html` | Per-jurisdiction tabs | Engineering register |
| `sub-processors.html` | Sub-processor transparency | Engineering register |
| `about.html` | Founder bio + reviewer scope | Engineering register |
| `solo-reviewer-policy.html` | Public Solo Reviewer Phase policy | Engineering register |
| `case-study-01.html` | Anonymised 327-finding pack | Engineering register |
| `404.html` | Error page | Engineering register |
| `scan-result-free.html` | Free taster teaser → paywall | Engineering register |
| `dashboard-live.html` | Atelier console mockup | Luxury aesthetic (early) |
| `onboarding-wizard.html` | 8-question adaptive brief request | Luxury aesthetic (early) |
| `workflow-index.html` | **Full client journey wireframe index** | Atelier |
| `upload-hub.html` | Customer upload hub — discipline gates | Atelier |
| `upload-magic-link.html` | Consultant ZIP upload (tus.io mock) | Atelier |
| `classify-confirm.html` | Classification trust gate | Atelier |
| `build-readiness.html` | Council decision + exports | Atelier |
| `cad-library.html` | CAD components spec sheet | Engineering register |
| `hunt.html` | Contractor product landing | Dark indigo (legacy — needs migration) |
| `studio.html` | Sole-practitioner landing | Dark indigo (legacy — needs migration) |
| `three-products.html` | Portfolio comparator | Dark indigo (legacy — needs migration) |
| `verifiq-system.css` | Shared design system | — |
| `verifiq-cad.css` | CAD component library | — |

---

## Source Code (`/src/`)

Convex actions, schema, library helpers. POC scaffolding only — not yet wired to live deployment.

- `convex/schema.ts` — multi-tenant schema
- `convex/actions/uploads.ts` — magic-link ZIP upload + extraction
- `convex/actions/classify.ts` — discipline + doc-type classifier
- `convex/actions/scan.ts` — per-discipline scan orchestrator
- `convex/actions/coordinate.ts` — cross-discipline coordination pass
- `convex/lib/anthropic-client.ts` — Claude wrapper with prompt caching + retries
- `convex/lib/source-quote.ts` — 3-stage source-quote verification
- `convex/lib/corpus.ts` — standards corpus + system prompt builder
- `convex/lib/extract.ts` — PDF text + image extraction

---

## Evidence (`/evidence/`)

- `findings-register-v0.8-scan-view.xlsx` — 327 anonymised findings from validation pack
- `pack-manifest-stage-2c.xlsx` — 161-file inventory

---

## Reading order for someone new to the project

1. `PROJECT_PLAN.md` (root) — current state + this week's actions
2. `docs/15-shoestring-bootstrap-ireland.md` — operating frame
3. `docs/16-solo-reviewer-phase.md` — reviewer rules
4. `docs/17-full-action-backlog.md` — everything else
5. `docs/13-global-legal-council.md` — locked posture
6. `docs/14-setup-costs-pricing-council.md` — financial frame (superseded operationally by 15)
7. Pick from 18-22 as needed (email / sales / compliance / solicitor / linkedin)

---

## Update cadence

- `PROJECT_PLAN.md` — weekly, every Monday 09:05 (scheduled task)
- `docs/17-full-action-backlog.md` — weekly, Monday review
- Other docs — on material change only; do not edit casually

---

*Last index update: 2026-06-01*
