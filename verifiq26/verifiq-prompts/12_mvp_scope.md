# 12 · MVP Scope — Brutal Product Note

**Use:** Read this BEFORE writing any code. Re-read this if you ever find yourself building something the customer didn't ask for.

---

## The brutal note

> Do not let Codex or Claude build this as a generic "AI document reviewer."
>
> The repo should be organised around **evidence, findings, disciplines, interfaces, risk, adjudication and build-readiness.**
>
> **That is the system.**

If your generated code does not have first-class concepts named: `Discipline`, `Finding`, `Interface`, `Challenge`, `Adjudication`, `BuildReadinessReport`, `Evidence`, `RegulatoryModule` — you are building the wrong thing. Stop and refactor.

---

## What people will try to make this

Reject these framings ruthlessly:

| Wrong framing | Why it's wrong |
|---|---|
| "AI chat for compliance questions" | Chartered audience doesn't want chat. They want decisions. |
| "Document search with AI" | Search returns text. We return decisions. |
| "Smart summary of your tender pack" | Summary ≠ council. We adjudicate. |
| "Compliance score on your design" | Scoring implies certifying. We don't certify. |
| "AI co-pilot for the design team" | Co-pilot implies real-time. We run a council and issue a report. |
| "Tender pack risk dashboard" | Dashboard ≠ decision. We produce one of four decisions per pack. |
| "Construction document Q&A" | Q&A produces guesses. We produce evidence-led adjudicated findings. |

The right framing — the only right framing — is:

> **A multi-agent Pre-Build Compliance Council that issues one structured, evidence-led build-readiness decision per pack.**

---

## Minimum viable version — Features

Build only these seven features first. Nothing else.

1. **Project intake** — captures the 17 intake fields, persists them.
2. **Document upload by discipline** — magic-link upload, ZIP per discipline gate, SHA-256 hash, file manifest.
3. **Six agents** — Architect, Fire, Access, M&E (combine Mechanical + Electrical for MVP), QS, Chair.
4. **Findings table** — every finding source-quoted, schema-conformant, filterable by discipline / status / risk.
5. **Peer challenge** — at minimum, the Architect and Fire agents challenge each other's findings on Fire-Architecture interfaces; the QS challenges architectural findings for cost-impact.
6. **Adjudicated issue register** — Adjudicator runs once after peer challenges complete; produces final register.
7. **Build Readiness Report** — Chair runs once; produces one of four decisions; renders to PDF + XLSX.

That's the MVP feature set. Ship that. Then move to Phase 2.

---

## Minimum viable version — Platform mandatories

The 7 features above cannot ship without the 7 platform mandatories below. These are NOT optional. They are surfaced by the Implementation Review Council (`docs/25-implementation-review-council.md`) as the items that determine whether the MVP actually works for the first paid customer.

**Full spec in `verifiq-prompts/20_platform_architecture.md`.**

| # | Platform mandatory | What happens if missing |
|---|---|---|
| 1 | **tus.io resumable upload** with direct-to-storage signed URLs | Upload fails on the first 15 GB pack. Customer is gone forever. |
| 2 | **Job queue with per-discipline isolation + idempotency** | Single-action scans hit 10-minute Convex limit. Scan never completes. |
| 3 | **Title-block vision classifier** as part of 3-source classification | Filename-only classifier routes "IMG_2438.pdf" to wrong discipline. Trust destroyed. |
| 4 | **Classification-confirmation UX screen** | Customer sees black-box scan. Best training data (corrections) lost. |
| 5 | **Long-running scan-state model** with email at each transition | Customer stares at static page during 48-hour scan. Trust destroyed. |
| 6 | **Observability** — Sentry + Convex metrics + Grafana + PagerDuty | At MVP launch we don't know when things break. ~€20/month. |
| 7 | **CI/CD with validation-pack integration test** | Auto-deploy without tests kills the first paid customer with a regression. |

Total platform build cost: ~6 weeks in parallel with feature build.

### What MVP also implicitly requires (Council carry-over)

- **Paper-prototype all 11 screens with the reviewer panel chair before any Phase 7 code.**
- **Founder cannot have a build-only week** without a parallel panel chair recruitment week running alongside (`docs/25` Auditor hard rule).
- **Confirm Convex file storage limits with Convex support BEFORE Phase 1.** If they bind on 100 MB PDFs, design for S3-compatible from day one.

---

## What is explicitly NOT in MVP

These are real and important — they are NOT in MVP:

---

## What is explicitly NOT in MVP

These are real and important — they are NOT in MVP:

| Feature | Phase |
|---|---|
| All 13 discipline agents (only 6 in MVP) | Phase 2 |
| All 13 regulatory modules (only 4 in MVP: BR, FSC, DAC, BCAR) | Phase 2 |
| Real-time collaboration | Phase 3 |
| Mobile reviewer app | Phase 3 |
| API for third parties | Phase 3 |
| Multi-region (Ireland-only at MVP) | Phase 4 (UK launch) |
| Outcome-priced billing | Post-month-9 |
| Self-serve trial without account | Phase 2 |
| Customer reviewer-recruitment marketplace | Phase 3 |
| Open-weights AI fallback | Pre-international launch |
| Multi-language interface | Phase 4 |
| Audit-log blockchain anchoring | Never (over-engineered) |

---

## Phase order

| Phase | Window | Scope |
|---|---|---|
| MVP | Weeks 1–6 | Seven items above. Six agents. Four modules. PDF/XLSX/JSON exports. |
| Phase 2 | Weeks 7–14 | All 13 discipline agents. All 13 modules. Full export suite. Sector-regulator routing. |
| Phase 3 | Months 4–9 | Customer dashboard polish. Reviewer queue UI. Annual seat management. Concierge override admin. Sub-processor onboarding flow. |
| Phase 4 | Months 9–24 | Multi-region (UK launch first). Per-locale i18n. Sector-specific corpus loaders. |

---

## The first paying customer test

Before MVP can be declared done, the system must be able to:

1. Accept a real Irish public-sector Office project tender pack from a real customer.
2. Generate a council report that names at least three findings the customer recognises as material.
3. Produce a Build Readiness decision the customer accepts as defensible.
4. Survive a 14-day no-customer-complaint window.

If any of those fail, you are not at MVP yet.

---

## What the founder will measure

Once shipped, the founder tracks weekly:

- Brief requests received (Target: 5/week by month 3)
- Free tasters run end-to-end (Target: 60% of brief requests)
- Paid scans completed (Target: 8-12% conversion from free)
- Customer complaints (Target: 0 per week; 1+ triggers Solo Reviewer Phase end)
- Compute cost per scan (Target: <€5 free / <€30 Tier III paid)
- Reviewer time per pack (Target: <8 hours Tier III)

If these numbers don't move, the MVP isn't working — fix it before building Phase 2.

---

## One sentence to hold the whole MVP

> *VerifIQ MVP is six discipline agents, one council orchestration, one adjudicated issue register, and one Build Readiness Report per pack — shipped with the locked disclaimer on every output and the chartered reviewer's initials in every audit log.*

Build that. Nothing more. Nothing less.

---

*If you read this and still feel the urge to "add a chat interface for users to ask questions about their findings" — close your laptop and reread file 12.*
