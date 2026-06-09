# 37 · Procurement / Tender-Pack Review Module

**Doc ID:** `verifiq-procurement-module-v0.1`
**Status:** Adjacent-SKU proposal + proof of concept. Founder decision required
before productionising.
**Date:** 2026-06-08

---

## The insight

The HSE SAQ pack review (Disability Day Services Unit, Rathbeale Rd — QW1
Restricted, Works + PSCS) is **a VerifIQ council run pointed at procurement
paperwork instead of design drawings**. Its 8-tab workbook (Executive Verdict →
Action Tracker → Red Flags → Doc Review → Checklist Findings → **Suggested
Wording** → Applicant Return Checklist → Pre-Issue Checklist) maps 1:1 onto the
existing Finding → risk → verdict → action → fix shape. The verdict — *"NOT READY
TO ISSUE — Medium-to-High Challenge Risk"* — is the file-06 pattern relabelled.

So this is **not a new product — it's the same engine with a procurement corpus.**

## What it adds to the council

- **Discipline agent: "Procurement / Tender Pack"** with sub-agents (same pattern
  as M&E): *SAQ completeness · evaluation methodology & proportionality ·
  statutory route (Reg. 57/58, ESPD) · template hygiene · H&S/PSCS competence*.
- **Module: CWMF Pillar 3 / OGP procurement** — corpus: CWMF, OGP RFT templates,
  SI 284/2016 (Reg. 57–58), ESPD.
- **A second readiness axis:** *Ready to Issue / Issue with conditions / Not ready
  / Insufficient* — the four-state pattern, relabelled (a chair-report variant).
- **Two reviewer styles, combined:** a deterministic **completeness checker** (the
  PoC below — rule engine over an expected-document matrix) **+** the LLM
  sub-agents for judgement (proportionality, wording, statutory route). The
  "Suggested Wording" drop-in fixes are the premium differentiator.

## Proof of concept (shipped, tested)

`src/procurement/` — a **deterministic pack-completeness checker**:
- `pack-matrix.ts` — `EXPECTED_PACK_MATRIX`, the canonical required-documents
  rule-set keyed by `{category, procedure, SAQ form}`, seeded with the QW1
  reference (12 docs incl. **Appendix B1** and the **3.4a/3.4b CV pro-formas**).
- `checker.ts` — `checkPackCompleteness()` emits §05.1 `Finding`s for every
  missing required doc, so gaps flow into the existing register/report.
- `tests/procurement.test.ts` — **reproduces the SAQ review's headline gaps**
  (B1 + the two buyer-issued CV pro-formas) deterministically; conditional docs
  only required when their option is selected.

This validates the thesis: *the paperwork check is the same engine + a swappable
matrix/corpus.*

## Repeatable across paperwork (the revenue case)

The same engine + a swappable matrix handles: SAQ (Works/Goods/Services), **ESPD**,
FSC/DAC applications, **BCAR doc sets**, PSDP/H&S files, **planning
condition-discharge submissions**, O&M/handover files.

**SKU — "VerifIQ Tender / Pre-Issue Pack Check":** higher frequency than design
review (every public tender), lower per-run complexity, faster turnaround,
different buyer (contracting authority / QS / PSCS / OGP framework holders), and a
sharp, public pain (a challenged/withdrawn competition). An easier first sale.

## The GovIQ relationship (keep it clean)

GovIQ **generates** packs (its `goviqPackMapper` / `decision_packs` / SAQ-form
work — a *different* codebase). VerifIQ **reviews/verifies** them. Two halves of
one workflow:

> GovIQ assembles → **VerifIQ independently verifies before issue.**

- **Share one artifact:** the `EXPECTED_PACK_MATRIX` should be the canonical
  required-documents matrix consumed by *both* (GovIQ to assemble, VerifIQ to
  assert) — don't duplicate the pack-mapper inside VerifIQ.
- **Check arbitrary packs:** VerifIQ must check *any uploaded* pack against the
  matrix (third-party/legacy packs, not only GovIQ-generated) — that's the bigger
  market.
- This ties to the **"GovIQ stack fork" standing decision**: the clean answer is
  *one council engine (VerifIQ) with pluggable corpora; GovIQ as a generation
  front-end.* Decide deliberately.

## Statutory gap surfaced

`SaqFormId` covers only `QW/QC` (Works/Consultancy). **Goods and all
non-construction services borrow the consultancy form (QC1/QC2)** — there is no
dedicated QG/QS suitability set and no ESPD generator. So no, services do **not**
all follow one fit-for-purpose set. Resolving this (QG/QS vs ESPD vs accept QC
fallback) is an ADR-worthy decision.

## Legal posture (unchanged, good)

The workbook already states *"Nothing here is legal sign-off — procurement/legal
governance must approve before publication."* That is file-08 discipline: the
product surfaces; the contracting authority/legal signs. Keep the locked
disclaimer + banned-verb guardrails on every procurement output.

## Recommendation

Treat as a **deliberate adjacent SKU**, not MVP creep. The PoC + this spec are the
cheap, high-value first step. Next, on a founder *go*: the procurement discipline
prompt (file 04 §) + CWMF module (file 18) + the issue-readiness chair variant +
the shared-matrix decision with GovIQ.
