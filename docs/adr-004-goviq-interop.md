# ADR-004 — FMIQ ↔ GovIQ stack relationship (thin interop)

**Status:** Accepted (2026-06-08) · **Decision owner:** Liam / GovIQ · **Relates to:** ADR-001 (Azure/Postgres), `FMIQ-master-build-plan.md` §7.2, `FMIQ-system-review.md` §5.

## Context

GovIQ runs on Convex; FMIQ runs on Azure + PostgreSQL (ADR-001, reaffirmed for EU
data-residency/audit/time-series/OData/DB-enforced isolation). They share governance DNA
(Entra identity, audit-on-every-write, the Irish public-sector domain) but not a stack.
The question: how tightly should the two integrate, given the divergence costs?

## Decision

**Keep FMIQ on Azure/Postgres and keep the interop surface deliberately thin.** Share
only three contracts; do not share a runtime, ORM, or schema.

1. **Identity** — one Entra tenant + App Roles; FMIQ validates the same JWTs (`auth/entra.ts`).
2. **Audit contract** — both write the same append-only audit shape; FOI/HSA bundles are
   composable across products.
3. **Domain + events** — a shared CloudEvents vocabulary (`fmiq.*`) over a shared Service
   Bus namespace; GovIQ→FMIQ hands over an approved capital project, FMIQ→GovIQ returns
   handover/completion + asset snapshots (`/api/internal/goviq/*`, HMAC, mTLS, no EU egress).

Everything else (procurement/ERP, BMS/IoT, CMS, BIM) stays behind FMIQ's own adapter
layer (anti-corruption), so neither product's internals leak into the other.

## Consequences

- Divergence costs ~1 eng-sprint/quarter (duplicated auth/audit-over-API, two ops
  pipelines) — accepted as the price of FMIQ's procurement-grade sovereignty posture.
- The interop is small and documented, so a future convergence (if Convex reaches
  ISO 27001 + SOC 2 on an EU entity *before* a second FMIQ deployment — ADR-001's trigger)
  remains a localized change, not a rewrite.
- **ERP boundary (this sprint):** the approvals→PO seam is a `ProcurementGateway` port with
  **Agresso (Unit4)** and **SAP** adapters built and unit-tested behind injected transports;
  the null stub is the default until a live endpoint + Key Vault secret are wired. FMIQ owns
  *authorised commitment*; the ERP owns PO + invoice + 3-way match and writes back
  `po_reference`/`grn_number`/`payment_status` via `/api/v1/erp/po-callback`. FMIQ never holds
  invoice data.

## Alternatives considered

- **Converge to a Convex-GovIQ module now** — rejected: loses the EU residency/audit posture
  that wins public-sector tenders (ADR-001).
- **Hybrid (Postgres of record + Convex read-layer for live dashboards)** — viable but two
  runtimes for a small team; prefer Postgres `LISTEN/NOTIFY`-driven push if real-time UI
  becomes a competitive must.
