# ADR-001 — FMIQ Platform Architecture

**Status:** Accepted (2026-06-05) · **Reaffirmed with corrected rationale (2026-06-06)** · **Decision owner:** Liam / GovIQ
**Context:** Greenfield multi-tenant IWMS SaaS for Irish/EU public-sector & heritage clients.

## Revision note — 2026-06-06 (factual correction; decision unchanged)

The original rationale below stated Convex has "no EU sovereign option." **This is factually incorrect and must be corrected.** Convex shipped open-source self-hosting (Feb 2025) and a **managed EU region in Ireland (`aws-eu-west-1`) on 6 Feb 2026** — ~4 months before this ADR was accepted ([Convex EU hosting](https://news.convex.dev/we-finally-got-our-eu-visa/); [Convex regions](https://docs.convex.dev/production/regions)). EU deployments carry +30% resource pricing, are on-demand billed, and cannot auto-migrate regions.

**The decision to build on Azure + PostgreSQL stands, but on these corrected grounds (not "no EU option"):**
1. **Compliance posture** — Azure holds ISO 27001/27017/27018, SOC 1/2, CSA STAR + the completed EU Data Boundary; Convex (managed) publishes none of these and the DPA counterparty is a US entity (CLOUD Act residual risk). Decisive in a sovereignty-scored tender.
2. **Time-series** — TimescaleDB hypertables/continuous aggregates/compression have no Convex equivalent; Convex per-query document-scan limits make ~26M rows/yr telemetry a custom pre-aggregation project.
3. **Reporting** — Postgres exposes OData/Power BI natively via the `fmiq_read` role; Convex has no OData layer.
4. **Tenant isolation** — Postgres `FORCE ROW LEVEL SECURITY` is database-enforced; Convex isolation is application-layer (a missed filter leaks, no safety net).
5. **Sunk cost is small but real** — the Fastify/RLS scaffold + `collectionCare.ts` work; migrating now costs ~3 sprints with no user-visible gain.

**Trigger to revisit (→ Convex / GovIQ-family unification):** Convex achieves ISO 27001 + SOC 2 Type II on the EU region with an EU legal entity *and* FMIQ has not yet reached a second deployment. If migration ever happens, the window is **before migrations 002–007 land**, not after Phase 1. The "GovIQ stack fork" (GovIQ on Convex, FMIQ on Azure/Postgres) is accepted deliberately; keep the interop surface thin (shared Entra + audit contract + domain). See `FMIQ-system-review.md` §5.

## Decision

Build on **Azure Entra ID** (auth) + **Azure Database for PostgreSQL Flexible Server, North Europe/Ireland** (system-of-record) + **React/TypeScript** SPA + **Azure Container Apps** API. This was committed by the product owner and is validated by the research as the correct call for a product that must be procurement-ready for Irish public sector on day one.

**Why not Convex/Supabase (the faster-to-build options):** neither can answer EU data-residency, native Entra B2B SSO, GDPR DPA, and compliance-trajectory questions in a public-sector tender without months of extra sovereignty work. Convex is US-incorporated with no EU sovereign option — it eliminates itself from gov procurement. The Azure complexity is a **moat, not just a burden.**

## Reference architecture

```
Internet
  → Azure Front Door (WAF / OWASP CRS, CDN, DDoS)
  → Azure Static Web Apps (React SPA)
  → Azure Container Apps (VNET-integrated):
        • FMIQ API (Node.js, OpenAPI 3.1)
        • SCIM 2.0 provisioning service
        • IoT/sensor ingestion processor
        • Background worker (Service Bus consumer)
  → Private Endpoints (no public DB exposure):
        • PostgreSQL Flexible Server + TimescaleDB + PostGIS (North Europe)
        • Blob Storage (docs, photos, IFC) — WORM immutability for compliance
        • Service Bus (work orders, alerts, integration events)
        • Key Vault (secrets, CMK) via managed identity
  Observability: Azure Monitor + App Insights + Log Analytics (incl. pgaudit)
```

## Key decisions & rationale

**Auth.** Multi-tenant Entra app registration; `@azure/msal-react` (Auth Code + PKCE) on the SPA, `passport-azure-ad` BearerStrategy on the API. **B2B cross-tenant access** is the primary mechanism — public-body staff sign in with their own Entra identity, MFA trust honoured, no passwords stored by us. **Entra External ID** for contractors/non-Entra small bodies. **SCIM 2.0** endpoint from day one for auto provision/deprovision. App Roles for RBAC: `SystemAdmin, TenantAdmin, FacilitiesManager, ConservationOfficer, MaintenanceTech, ReadOnly`. Risk: B2B needs the client's IT to configure cross-tenant settings — mitigate with an onboarding guide + External ID fallback.

**Data & residency.** North Europe (Dublin) = data physically in Ireland, inside the EU Data Boundary (completed Feb 2025, now covers support/diagnostic data too). AES-256 at rest (FIPS 140-2); CMK via Key Vault as premium tier. TLS 1.2+ enforced; Private Link only. 35-day PITR + geo-redundant backup (West Europe) default. pgaudit → Log Analytics.

**Multi-tenancy.** Shared DB with **Row-Level Security**: `tenant_id` on every tenant-scoped table, `FORCE ROW LEVEL SECURITY`, composite indexes leading with `tenant_id` (RLS without this is ~100x slower). App sets `app.current_tenant` per transaction; never use a BYPASSRLS role for routine queries; audit all `SECURITY DEFINER` functions. Dedicated schema/instance offered as a premium tier for large anchor clients (OPW-scale).

**Time-series (collection-care telemetry).** **TimescaleDB extension on the same Postgres** — hypertables (auto-partition), continuous aggregates (hourly/daily T/RH/lux rollups for dashboards), retention + compression policies. At ~1–500 sensors / 10-min intervals (~72k rows/day) this is comfortably within capacity and avoids a second data store. **Azure Data Explorer** documented as the upgrade path only if >1,000 sensors / petabyte analytics. Keep ingestion behind a swappable abstraction so ADX can slot in as a read model.

**IoT / sensor ingestion.** Azure IoT Hub (device-auth sensors) + Event Hubs (high-throughput third-party streams) → IoT Processor Container App normalises to `{tenantId, sensorId, metricType, value, unit, quality, timestamp}` → TimescaleDB. Threshold breaches → Service Bus → notification worker. **Adapter pattern** (`SensorAdapter` interface): implementations for MQTT/IoT Operations, Conserv webhook, T&D REST poll, Hanwell CSV/agent push. BMS via edge gateway (Azure IoT Operations native Modbus/OPC UA, or Chipkin/ICONICS for BACnet retrofit).

**Integration.** OpenAPI 3.1 REST behind Azure API Management (dev portal, rate limits, keys); per-tenant outbound webhooks (HMAC-signed); OData for Power BI. **IFC/COBie** import via `web-ifc` in the API (extract `IfcSpace`/equipment/systems → asset & space tables; original IFC in Blob; xeokit for 3D view). **Axiell/TMS** via REST adapter — store only object reference + sensitivity, not the full catalogue (GDPR data minimisation). **Build-to-Share / Information Mediator** compatible API = competitive edge in Irish gov procurement.

## Compliance roadmap
Launch: EN 301 549 / WCAG 2.1→2.2 AA assessment + published Accessibility Statement & ACR/VPAT. +6m: Cyber Essentials Plus. +12–18m: ISO/IEC 27001:2022 (Azure controls as evidence for infra domains; new A.5.23 cloud control covered). +24–30m: SOC 2 Type II. Azure platform already holds ISO 27001/27017/27018, SOC 1/2, CSA STAR — but **platform certs ≠ app certs**; the ISMS is ours to build.

## Honest risks
1. **Cost at low scale** — ~€400–700/mo baseline (Postgres HA + Container Apps + IoT Hub + Key Vault + Monitor) vs €25/mo Supabase. Mitigate: scale-to-zero Container Apps, IoT Hub S1, single-zone in pre-revenue.
2. **Operational weight** — Private Link/VNET/WAF/Key Vault rotation needs Azure expertise. Mitigate: Cloud Adoption Framework landing zone; Irish Azure partner for initial setup.
3. **TimescaleDB self-managed** — chunk/compression tuning is a DBA task at high volume. Mitigate: continuous aggregates + compression from day one.
4. **IoT Hub investment trajectory** — Microsoft steering to IoT Operations/Event Hubs. Mitigate: ingestion as swappable abstraction; Event Hubs is the stable primitive.
