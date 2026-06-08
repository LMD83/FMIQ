# 35 · Geospatial Data Access & the `GeoDataProvider` Layer

**Doc ID:** `verifiq-geodata-v0.1`
**Status:** Research-backed spec. Source of truth for site-level GIS lookups
(flood, radon, ground, zoning, heritage, ecology).
**Date:** 2026-06-08

> ⚠️ **Verify-before-build:** the ArcGIS REST/WFS endpoints below are documented
> + URL-pattern-verified, but most government hosts bot-block automated reads.
> Confirm each with a live GET in the founder's environment before depending on
> it. EPA radon was the one confirmed live during research.

---

## The headline finding

**The map *layers* are overwhelmingly free, open, coordinate-queryable APIs
(CC-BY 4.0). The only structural choke-point is getting a coordinate from an
address/Eircode.** Solve geocoding once and ~90% of Irish constraint data is
free open-API. This reframes the "you have to email someone for maps" problem:
the email/licence gates are **narrow and specific**, not the whole dataset.

## ✅ Free open API (no email, no licence — query by ITM coordinate)

| Layer | Source | Endpoint (verify live) |
|---|---|---|
| Radon (High Radon Area) | EPA | `gis.epa.ie/arcgis/rest/services/EPAMapServices/RadiologicalProtection/MapServer` — **confirmed live** |
| Flood zones/extents (CFRAM, NIFM) | OPW / data.gov.ie | floodinfo.ie Open Spatial Data Portal; NIFM on data.gov.ie |
| Bedrock / subsoils / permeability / landslide / karst / borehole locations | GSI | `gsi.geodata.gov.ie/server/rest/services` (whole tree) |
| Generalised zoning | MyPlan / DHLGH | `data-housinggovie.opendata.arcgis.com` GZT FeatureServer |
| National planning applications | DHLGH/Esri | national planning-application FeatureServer |
| Archaeology (SMR/RMP) | National Monuments Service | `services-eu1.arcgis.com/.../SMROpenData/FeatureServer` |
| NIAH architectural heritage | NIAH | `services-eu1.arcgis.com/.../NIAHBuildingsOpenData/FeatureServer` |
| Protected areas (SAC/SPA/NHA/pNHA) | NPWS | `dservices-eu1.arcgis.com/.../NPWSDesignatedAreasWFS` |
| Admin boundaries (county/townland/small-area) | Tailte / GeoHive | `data-osi.opendata.arcgis.com` |
| Building heights / surface (LiDAR DTM/DSM) | data.gov.ie | Open Topographic LiDAR (free GeoTIFF/REST) |

## 💶 The one structural choke-point — geocoding

- **No free official Eircode API.** Eircode Finder is capped at 15 searches/day,
  human-only. **ECAD** (the DB *with coordinates*) is a paid licence; **ECAF**
  has no coordinates. **GeoDirectory** is a commercial licence.
- **Automatable path:** one paid **Eircode-provider API** (Autoaddress / Loqate /
  Vision-net) — key-based REST, paid per lookup, cheap at low volume.

### Cheapest way around it (in order of cost)
1. **Customer-supplied coordinate (€0, default).** Intake captures the site —
   ask for Eircode + a map pin / ITM coordinate, or extract it from the
   **site-location drawing** (classifier vision). The customer has it; it suits
   the evidence-led model.
2. **One paid Eircode-provider API** behind a flag — add when volume justifies.
3. **Never block:** no coordinate → emit *"Site coordinate/Eircode required to
   run flood/radon/ground checks"* — an actionable evidence item, not a miss.

## 📧 Narrow gated/paid layers (route to "request" or customer-upload)

- OPW **non-published PFRA / bespoke models** → form to `flood_data@opw.ie`
  (~20 working days).
- **Tailte large-scale base mapping + orthophoto** (MapGenie/PRIME2) →
  licence / `corporatesales@tailte.ie`; **Land-Registry-grade site outline** →
  per-map purchase.
- GSI **full borehole *reports*** → coverage gaps (some unscanned), not a hard
  licence.
- **Per-council:** live planning *register detail*, ACAs, statutory RPS —
  fragmented, no clean national API.

## The `GeoDataProvider` architecture (mirrors `StorageProvider`/`LLMProvider`)

```
Geocoder (port)
  └─ customer-supplied coords  →  [optional Eircode-provider adapter (flagged)]  →  "coordinate required" finding

GeoLayerProvider (port, one per layer: radon, flood, geology, zoning, heritage, ecology)
  query(coordinate) → {
     status: "resolved"               → evidence-backed finding
           | "manual-request-required"→ "request <layer> from <authority>" finding
           | "customer-supplied"      → use the uploaded site map / FRA / SI report
  }

GeoCache  — keyed by (coordinate + layer + corpus_version); reuse the inference_cache pattern.
```

- **Graceful degradation is the product:** when a layer is gated/unreachable, it
  becomes a tracked *"evidence required before build"* action — which *is* the
  value proposition.
- **Feeds the sub-agents:** radon → `G-GEO`/Architect (Part C); flood →
  `C-FLOOD`/Planning; geology → `G-GEO`; zoning/heritage/ecology →
  Planning/Conservation/Landscape.

## Build order

1. `Geocoder` port with **customer-supplied** default + the "coordinate required"
   degradation. Pluggable Eircode-provider adapter behind a flag.
2. `GeoLayerProvider` adapters, free-API first: **Radon (EPA)** as the reference
   implementation, then Flood (OPW), GSI geology, NPWS, MyPlan zoning, SMR/NIAH,
   LiDAR heights.
3. Route PFRA / ACAs / RPS / basemaps to the manual-request bucket.

## To confirm before relying on it
- A live GET on each open endpoint from the production environment.
- Current **Eircode/GeoDirectory pricing** (the €60/€180 figures trace to a 2015
  doc — out of date).
- Per-council coverage for ACAs / statutory RPS.

*Sources: floodinfo.ie/open-spatial-data-portal; gis.epa.ie radon MapServer;
gsi.geodata.gov.ie REST; data.gov.ie (NIFM, LiDAR); myplan.ie / planning.geohive.ie;
archaeology.ie SMR; buildingsofireland.ie NIAH; npws.ie designated-site-data;
tailte.ie (GeoHive / MapGenie); eircode.ie; geodirectory.ie.*
