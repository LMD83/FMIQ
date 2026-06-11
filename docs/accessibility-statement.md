# FMIQ — Accessibility Statement & Conformance Report (ACR)

_Status: **draft / pre-audit baseline** (2026-06-08). To be finalised by an independent
audit before any external go-live (Phase 1 exit, S12). This is the published-statement
template required under S.I. 358/2020._

## Commitment

FMIQ (GovIQ) is committed to making this platform accessible in accordance with the
**European Union (Accessibility Requirements of Products and Services) Regulations 2023
(S.I. 699/2023)** and the **EU Web Accessibility Directive → S.I. 358/2020**, conforming
to **EN 301 549** and **WCAG 2.2 Level AA**.

## Conformance status

**Partially conformant** — the design system and target conformance are WCAG 2.2 AA;
a full independent audit is scheduled before external go-live. Known gaps are tracked
in EP-FE / EP-8.

| Principle | Target | Notes |
|---|---|---|
| Perceivable | AA | Status conveyed by **text + icon, never colour alone** (design-system rule, enforced in `theme.css`); contrast tokens verified ≥4.5:1 (`docs/design-system.md`). |
| Operable | AA | Full keyboard operation; target size ≥24×24px (≥44px touch, glove-safe); visible focus ≥3:1. |
| Understandable | AA | Plain-language UI ("the 7am test"); bilingual EN/GA (`lang="ga"`), toggle persisted. |
| Robust | AA | ARIA roles; live regions (`role="alert"`/`role="status"`) for real-time environmental alerts; 200% reflow at 320px; `prefers-reduced-motion`. |

## Backend accessibility-enabling features (built)

- **Audit trail** (`core_audit_log`, append-only) — supports FOI/accountability obligations.
- **Bilingual-ready data** (`core_user.lang ∈ en|ga`).
- **Evidence packs** are tagged PDF/UA at export (planned EP-8).

## Assessment method

Automated: **jsx-a11y** ESLint rules (CI) and **axe-core via Playwright** on the key
screens (CI `e2e` job, fails on serious/critical violations). Plus manual keyboard and
screen-reader testing (NVDA/VoiceOver), and an independent third-party audit pre-go-live.

## Feedback & enforcement

Accessibility issues: accessibility@goviq.ie. The monitoring body is the **National
Disability Authority (NDA)**. Non-compliance is publicly reportable.

## Roadmap to full conformance

1. EP-FE: adopt accessible primitives (shadcn/Base UI), accessible charts (Nivo), an
   accessible data grid (AG Grid); ship `<StatusBadge>`/`<GateBanner>` text+icon components.
2. axe-core in CI (zero critical/serious violations gate).
3. Manual audit (keyboard + screen reader) at S10 and S12.
4. Independent audit + **published ACR/VPAT** before external go-live.
