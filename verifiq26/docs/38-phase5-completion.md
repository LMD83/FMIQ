# 38 · Phase 5 Completion — GIS layer, server-side runner, extraction

**Status:** Built + tested in-sandbox (65 tests, `tsc` 0, lint 0). Live-credential
/ dependency pieces are wired and typecheck, and are verified locally per
DEVELOPMENT.md (they don't run in CI by design).
**Date:** 2026-06-08

This closes the testable core of Phase 5. It builds on prompt bundling (the
server-side agents now load prompts without `node:fs`) and the dedicated
Convex tables from the Phase 4 binding.

## 1 · Geospatial data access (`src/geo/`)

The free open-API constraint layers from docs/35, each a `GeoLayerProvider` over
one shared, SSRF-safe ArcGIS point-query (`arcgis.ts` — hardcoded endpoint +
`Number.isFinite` coordinate guard + `URLSearchParams` encoding + an injected
`FetchJson`). A gated/unreachable layer degrades to a tracked "request from
<authority>" finding — the graceful degradation *is* the product value.

| Layer | Provider | Source | Flagged → finding (statutory anchor) |
|---|---|---|---|
| Radon | `EpaRadonProvider` | EPA (confirmed live) | High Radon Area → TGD C radon membrane (Medium) |
| Flood | `OpwFloodProvider` | OPW CFRAM/NIFM | Flood Zone A/B → site-specific FRA + Justification Test (High) |
| Geology | `GsiGeologyProvider` | GSI subsoils | Peat/made ground/landslide/karst → ground investigation, Eurocode 7 (Medium) |
| Zoning | `MyPlanZoningProvider` | MyPlan GZT | Surfaces the zoning objective → confirm use consistency (Clarification) |
| Ecology | `NpwsEcologyProvider` | NPWS SAC/SPA/NHA | Designated area → Appropriate Assessment screening, S.I. 477/2011 (High) |
| Heritage | `HeritageProvider` | NMS SMR/RMP | Recorded monument → statutory notice, National Monuments Acts (High) |

`geoFinding()` maps each result to a §05.1 Finding (discipline "Geospatial /
Site Constraints"). The €0 default geocoder is `CustomerSuppliedGeocoder`; a
licensed Eircode-provider geocoder remains a flagged add-on (the one structural
choke-point). Endpoints other than EPA radon are URL-pattern-verified — confirm
each with a live GET before relying on it.

## 2 · Server-side review runner (`src/orchestrator/runner.ts`, `src/convex/runner.ts`)

The persistent job queue now runs (file 20 §2):

- **Pure dispatch core** (`drainQueue`/`runNextJob`): claim → handler →
  complete / fail-with-backoff, bounded per tick, never throws. Fully unit-tested
  with a fake queue.
- **Council assembly** (`createCouncil`): builds `OrchestratorDeps` (five
  disciplines + challenge + adjudicator + chair) from one LLM client +
  PromptLoader + persistence.
- **`"use node"` `tick` action**: wires the real `internal.jobs.*` /
  `internal.persist.*` ports + bundled prompts + a `ConvexPersistence` over the
  action ctx into `drainQueue`, and runs the resumable pipeline. Because the
  pipeline skips completed stages from persisted state, every queue `job_type`
  maps to the same handler — re-entry resumes rather than duplicates.
- **1-minute cron** (`crons.ts`): drains the queue across the projects
  `jobs.pendingProjectIds` reports as having waiting work.

**Security:** all `jobs.ts` functions are now `internal*` — the queue is driven
only by the trusted runner/cron, closing the IDOR a public `mutation`/`query`
would expose. A future authed "start review" entry point wraps `enqueueJob`
behind Clerk membership.

## 3 · Document extraction (`src/extraction/`)

A `PdfExtractor` port feeding the classifier (file 20 §1). The raw parse is
injectable; the default binds the optional `pdf-parse` via a non-literal dynamic
import so `tsc`/CI need no native dependency. The text shaping is pure + tested:
`normaliseWhitespace`, the 500-token content window (`firstTokens`), and
`extractionToInput` (extraction → `ClassificationInput`, Source 3 content text +
title-block passthrough).

## Deferred (still Phase 5 backlog)

- **tus.io resumable upload** + the page-1 title-block *render* (Source 2 image)
  — the extractor accepts a render but doesn't produce one yet.
- **Resend** scan-state emails.
- Wiring `pdf-parse` + live geo GETs + the runner against real keys / a Convex
  deployment (verify-locally).
- Clerk project-membership auth on the remaining public mutations
  (`classify.ts`, `mutations.ts`); `jobs.ts` is now internal-only. When the
  public "start review" entry point lands, wrap `enqueueJob` behind Clerk
  membership and assert `job.project_id === JSON.parse(payload).projectId`
  before dispatch (per the PR security review).
- The sub-agent / discipline expansion (docs/34) and Playwright E2E (docs/36).
