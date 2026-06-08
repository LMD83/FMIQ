# 34 · Discipline & Sub-System Agent Expansion

**Doc ID:** `verifiq-discipline-expansion-v0.1`
**Status:** Research-backed proposal for the founder. Source of truth for the
agent roster beyond the 6 MVP agents.
**Date:** 2026-06-08

---

## Why

`file 02` lists ~18 discipline agents and `file 18` lists 9 active + 9 future
regulatory modules. Two gaps surfaced in review:

1. **Of Building Regulations Parts A–M, every part has a dedicated reviewer
   except Part L (energy) and Part E (sound).** Part L is a hard, cert-style
   statutory gate — yet there is **no Energy/NZEB agent and no Part-L module**
   anywhere in the spec.
2. The combined **M&E** agent (and Architect/Civil/Structural/Façade) dilutes a
   single LLM call across many sub-systems. Decomposing into **sub-system
   agents** (one task per call) improves recall, lowers cost via parallelism,
   and lets each sub-discipline be calibrated/prompt-versioned independently
   (file 15). The orchestrator already runs disciplines as **isolated parallel
   job trees** with peer-challenge + adjudicator merge, so adding sub-agents is
   mostly adding `DisciplineDef` entries.

## Priority verdicts (the three asked roles)

- **Energy / NZEB engineer** — **add, top priority, MVP-tier.** Hard statutory
  gate; the integrated DEAP/NEAP compliance maths sits *between* Architect
  (fabric/junctions) and M&E (plant/renewables), so neither currently owns it —
  the single most common tender-pack failure point. Anchors: TGD L 2022
  (dwellings MPEPC 0.30 / MPCPC 0.35 / 20% RER; non-dwellings via NEAP/SBEM),
  NZEB 2021, EPBD recast (zero-emission new buildings 2028 public / 2030 all).
- **Planning consultant** — **mostly covered** by the Planning-Law agent
  (MOD-05); add its missing *function*: **pre-commencement condition-discharge
  tracking** (Part V for 9+ units; s.48/49 contributions; completion bonds;
  material-contravention strategy; 2024 Planning Act timelines).
- **Sustainability officer** — **later premium tier** (voluntary: IGBC Home
  Performance Index, LEED/BREEAM, GPP); distinct from the regulated NZEB role.

## The sub-system agent tree (Irish-standard-anchored)

Each row = one `DisciplineDef` (id, displayName, `issuePrefix`, `sections`,
`matchTokens`, `promptVersion`) + a `file 04` prompt section + its own corpus.

### Mechanical → `M-*`
| Sub-agent | Prefix | Anchors |
|---|---|---|
| Heating & heat sources | `M-HTG` | TGD L, TGD J, heat pumps, F-gas |
| Ventilation & IAQ | `M-VEN` | TGD F, MVHR (interfaces TM59 overheating) |
| Plumbing / public health / water | `M-PHE` | TGD G, Legionella (HSG274 / HTM 04-01) |
| BMS & controls | `M-BMS` | CIBSE controls; commissioning Code M (2022) |
| Medical gases *(healthcare, conditional)* | `M-MGP` | HTM 02-01 / ISO 7396 |

### Electrical → `E-*`
| Sub-agent | Prefix | Anchors |
|---|---|---|
| General services (power/lighting/small power) | `E-GS` | **IS 10101** National Rules; TGD L lighting |
| Fire detection & alarm | `E-FA` | **IS 3218:2024** (life-safety; Fire interface) |
| Emergency lighting | `E-EL` | IS 3217 |
| Lightning protection | `E-LP` | IS EN 62305 |
| LV/HV, standby, UPS | `E-PWR` | resilience (healthcare) |
| EV charging & PV/renewables | `E-EV` | SI 393/2021, Part L (no "Part S" exists) |

> Note: fire alarm is an **electrical/life-safety** sub-system in Irish practice
> (IS 3218), with an explicit `interface_discipline` to Fire — not Mechanical.

### Façade → `FAC-*` (sub of Architect + Fire + Structural)
`FAC-FIRE` external-wall fire (BS 8414 / BR 135, cavity barriers) ·
`FAC-THERM` U-values / thermal-bridging (psi, fRsi 0.75↔0.80, ACDs) / interstitial
condensation (BS 5250) · `FAC-WEATHER` weathertightness / water ingress ·
`FAC-STR` wind load / fixings / structural glazing (CWCT).

### Architectural → `A-*`
`A-REG` Parts A–M coordination (architect of record) · `A-SPACE` space/room
standards (Apartment Guidelines, Part M circulation) · `A-DETAIL` detailing /
buildability · `A-DAYLIGHT` daylight/sunlight (BRE 209 / EN 17037) · `A-DOCS`
drawing-register / schedule coherence (doc-hygiene).

### Structural / Civil / Geotechnical → `S-*` / `C-*` / `G-*`
`S-SUP` superstructure (Eurocodes EC0–EC8 + Irish NAs; disproportionate collapse,
Part A) · `G-GEO` geotech/foundations (EC7, SI) — *GIS-dependent (GSI)* ·
`C-DRAIN` drainage/SuDS (TGD H, GDSDS, Uisce Éireann) · `C-ROADS` roads/access
(DMURS, TII) · `C-FLOOD` flood/levels — *GIS-dependent (OPW)*.

### New stand-alone disciplines (not sub-systems)
- **Energy / NZEB** → `EN-*` (Part L / NZEB; DEAP/NEAP; overheating TM59; EV/PV).
- **Acoustics** → `AC-*` (Part E / TGD E; plant noise NR; BB93 / HTM 08-01).
- **(Public-sector tier) Whole-life carbon** → `CARB-*` (EN 15978 / RICS WLCA;
  OGP CWMF carbon templates; EPBD recast GWP 2028).

## Architecture & implications

- **3-level structure:** *sub-system agents → discipline lead (consolidates per
  discipline) → council*. The discipline lead is one new agent role, not a
  re-architecture; it dedupes/coordinates before peer-challenge.
- **Code mapping:** add entries to `src/agents/disciplines.ts`; add `file 04`
  sections; `createMvpDisciplineAgents` + the orchestrator already iterate and
  isolate. No engine change.
- **Classification granularity must increase:** the title-block classifier needs
  a `sub_discipline` tag (Ventilation vs Plumbing) to route docs to the right
  sub-agent — an extension of `ClassificationResult` + the confirm-gate UI.
- **Activation gating:** activate sub-agents by intake/module (e.g. `M-MGP` only
  for healthcare; `C-FLOOD` only when a flood zone is relevant) — same pattern as
  `file 18` module activation, to avoid running everything on every pack.
- **Cost/coordination:** more agents = more parallel calls (cheap, and the
  inference cache makes re-runs ~free) and **more interfaces** — which is good
  (coordination failures hide there), handled by the existing peer-challenge +
  `interface_disciplines` + cross-reference protocol (file 19).

## Recommended build order

1. **Energy/NZEB agent + Part-L module** (closes the statutory hole).
2. **M&E sub-agents** (`M-HTG`, `M-VEN`, `M-PHE`, `E-GS`, `E-FA`) + classifier
   `sub_discipline`.
3. **Acoustics (Part E)** + **Façade-fire** sub-mode.
4. Structural/Geotech/Civil split; daylight/overheating; whole-life carbon
   (public-sector tier).

*Tiering doubles as pricing: statutory floor (Energy, Acoustics, Façade-fire) =
the core review; sustainability/carbon/soft-landings = premium up-sell;
public-sector packs unlock the carbon tier as near-mandatory.*
