# 19 · Cross-Discipline Cross-Reference Protocol

**Use:** The mechanism by which every discipline agent reads the OTHER disciplines' drawings, schedules, notes and sections to check that its own scope items are correctly shown, noted, sized, scheduled, and coordinated across the pack. **This is the heart of the Council.** Without it, you have siloed reviewers. With it, you have a real council.

**Loaded by:** every discipline agent (file 04 + file 17). Applied after the agent's own-discipline review and before peer challenge.

---

## The principle

Every chartered designer's scope shows up in OTHER disciplines' documents. A fire compartment wall is a Fire-discipline item — but it appears on the Architect's plan, the Architect's section, the Architect's door schedule, the M&E's ductwork drawing (where fire dampers are required), the Electrical's containment drawing (where fire-stopping is required), and the Structural's drawing (where structural fire protection is required).

If the Fire Agent only reads fire documents, it cannot tell whether the design team has coordinated fire compartmentation across all those other drawings. If it tells the customer "fire strategy looks fine" without checking the rest, the customer ships a pack with fire dampers missing from the M&E drawings — and discovers it on site at a six-figure cost.

> **The cross-reference protocol forces every agent to do what a real chartered consultant does: read the rest of the pack from the perspective of their own discipline.**

---

## The protocol — 5 steps

Every discipline agent runs this after its own-discipline review.

### Step 1 — Identify own-discipline items requiring cross-reference

For every item in the agent's scope, decide whether it must appear on OTHER disciplines' documents. Use the Cross-Reference Matrix in § "The Matrix" below.

### Step 2 — Pull the target documents

Fetch the relevant documents from the project. If the document classifier has them indexed, use the index. If not, run a discipline-tagged document scan.

### Step 3 — Search for the item in each target document

For each (item × target document), search for verbatim or near-verbatim references:

- Drawing symbols (e.g., the fire-rated wall symbol on plan).
- Schedule rows (e.g., fire-rated door rows in the door schedule).
- Specification clauses (e.g., fire-stopping requirements in the M&E specification).
- Note text (e.g., "FD60s — fire door 60 minutes" beside a door tag).

### Step 4 — Compare item-by-item

For each item, classify the cross-reference result:

| Cross-reference result | What it means |
|---|---|
| Item found, consistent | Item shown on target document; matches own-discipline scope. No finding emitted. |
| Item found, inconsistent | Item shown but parameters disagree (rating, dimension, brand, location). Cross-ref finding emitted (Coordination issue). |
| Item NOT found | Item required but absent from target document. Cross-ref finding emitted (Not demonstrated or Non-compliant per discipline). |
| Item not required | Cross-reference matrix says this item shouldn't appear here. No finding. |

### Step 5 — Emit cross-reference findings

For every result in classes 2 or 3 above, emit a cross-reference finding with the augmented schema (§ "Schema additions" below). Apply the self-check protocol (file 13) before emitting — cross-reference findings must satisfy the same 7 checks as normal findings.

---

## Schema additions for cross-reference findings

The Finding object (file 05 § 05.1) gains four optional fields when used as a cross-reference finding:

```json
{
  ...standard finding fields,
  "cross_ref_anchor_discipline": "Fire",
  "cross_ref_target_disciplines": ["Architecture", "Mechanical"],
  "cross_ref_items_checked": [
    "Fire compartment walls per Fire Strategy §6.2",
    "Fire-rated doors per Fire Strategy §6.3",
    "Fire dampers per Fire Strategy §6.5"
  ],
  "cross_ref_items_found_consistent": [
    "Fire compartment walls — shown on A-100, A-101, A-102",
    "Fire-rated doors — scheduled in Door Schedule §3"
  ],
  "cross_ref_items_found_inconsistent": [
    "Fire-rated door D-15: Fire Strategy requires FD60; Door Schedule lists FD30"
  ],
  "cross_ref_items_missing": [
    "Fire dampers on ductwork crossing Compartment B/C: not shown on M&E ductwork drawing M-201; not scheduled in M&E Schedule MS-04"
  ]
}
```

The finding text then describes the missing/inconsistent items, with source quotes from BOTH the anchor document and the target document(s) where the item appears or is missing.

---

## THE MATRIX — Cross-Reference by Discipline

The matrix below lists, per discipline, the items that must be checked AND the target disciplines whose documents the agent must read. This is the canonical lookup.

### Matrix Row 1 — Fire Safety Agent

| Item to check | Targets to read |
|---|---|
| Fire compartment walls | Architecture plans, sections; Structural (load-bearing fire walls); BCAR ancillary cert list |
| Fire-rated ceilings / soffits | Architecture sections; Mechanical (ceiling void); BCAR |
| Fire-rated doors (FD30 / FD60 / FD90 / FD120) | Architecture door schedule; Architecture plans (door swing); Ironmongery schedule (fire-rated furniture) |
| Fire-rated glazing | Architecture window schedule; Architecture elevations |
| Compartment penetrations — ductwork fire dampers | Mechanical ductwork drawings; Mechanical fire damper schedule; M&E specification |
| Compartment penetrations — fire stopping (electrical containment) | Electrical containment drawings; Electrical specification; BCAR fire stopping ancillary cert |
| Compartment penetrations — fire stopping (mechanical pipework) | Mechanical pipework drawings; M&E specification |
| Structural fire protection (intumescent, encasement) | Structural details; Structural specification; Ancillary fire-protection cert |
| Smoke control / ventilation strategy | Mechanical ventilation drawings; Mechanical schematics |
| Emergency lighting | Electrical emergency lighting layout; Electrical specification |
| Fire alarm devices | Electrical fire alarm layout; Electrical specification (I.S. 3218:2024 category) |
| Sprinkler / suppression (where applicable) | Mechanical sprinkler drawings; Specialist Systems Agent |
| Assisted-evacuation refuges | Architecture plans; DAC drawings; Lift evacuation provision |
| Fire-fighter access | Architecture plans; Civil site access; Landscape (vehicular access) |
| Fire stopping inspection regime | BCAR ancillary certifier schedule; BCAR inspection plan |

### Matrix Row 2 — DAC / Accessibility Agent

| Item to check | Targets to read |
|---|---|
| Accessible approach route | Civil external levels; Civil parking layout; Landscape paving + gradient |
| Accessible parking (number + dimensions + location) | Civil parking layout; Architecture site plan |
| Accessible entrances (threshold, width, contrast) | Architecture entrance details; Architecture door schedule; Ironmongery schedule |
| Internal door clear widths | Architecture door schedule; Architecture plans |
| Turning circles + corridor widths | Architecture plans (dimensioned); Architecture room data sheets |
| Accessible WCs (plan + elevation) | Architecture plans; Architecture elevations; Sanitaryware schedule; Room data sheet |
| Lift accessibility (Part M + I.S. EN 81-70) | Lift Agent schedule; Architecture lift well dimensions; Electrical lift power |
| Ramps + stairs (gradient, handrails, contrast) | Architecture details; Architecture finishes schedule |
| Tactile + visual contrast | Architecture finishes schedule; Architecture elevations (signage) |
| Accessible alarms + controls | Electrical fire alarm layout; Electrical lighting controls; Mechanical thermostat locations |
| Hearing assistance loops | Electrical specification + layouts |
| Signage + wayfinding | Architecture signage schedule; Architecture elevations |
| Assisted evacuation interface | Fire strategy; Lift evacuation provision |

### Matrix Row 3 — Structural Agent

| Item to check | Targets to read |
|---|---|
| Load-bearing walls | Architecture plans (which walls); Architecture sections |
| Openings in load-bearing walls (lintels, beams) | Architecture plans; Architecture sections; Architecture door + window schedules |
| Plant loads on roof + intermediate slabs | Mechanical plant schedule + plantroom layout; Electrical (PV, EV plant); Specialist Systems |
| Service penetrations through slabs | Mechanical pipework + ductwork; Electrical containment |
| Service penetrations through walls | Mechanical + Electrical |
| Foundation depth + ground conditions | Civil ground investigation; Civil drainage (interference) |
| Lift well structural support | Lift Agent specifications; Architecture lift well dimensions |
| Roof load (snow, wind, PV, plant) | Architecture roof plan; Mechanical (rooftop plant); Electrical (PV) |
| Fire protection to structural elements | Fire strategy; Architectural finishes schedule (encasement) |
| Existing structure interaction | Conservation Architect (Protected Structures); Demolition / Survey reports |
| Temporary works | PSDP design risk register; Contractor preliminary programme |
| Acoustic separation (structural) | Architectural acoustic strategy; M&E (acoustic isolators) |

### Matrix Row 4 — Mechanical Agent

| Item to check | Targets to read |
|---|---|
| Plant space allocation | Architecture plantroom plans; Architecture sections; Structural slab capacity |
| Riser shafts and routes | Architecture plans (riser shown?); Architecture sections (continuity); Structural openings |
| Builder's work openings | Structural drawings (openings sized + lintels); Architecture (penetration locations) |
| Ceiling void clearance | Architecture sections; Structural (slab + beam depths); Electrical (ceiling void services) |
| Compartment penetrations (fire dampers, fire-stopping) | Fire strategy; Architecture compartment plans |
| Service clash check vs electrical | Electrical containment routes |
| Roof plant loads | Structural; Architecture roof plan |
| External plant locations + acoustic | Architecture site plan; Landscape (boundary acoustic); Planning conditions |
| Sanitary outlets vs Architecture sanitary schedule | Architecture sanitaryware schedule; Room data sheets |
| Hot water scald / TMV strategy | Architecture sanitaryware schedule; Sector regulator (HIQA / Tusla) |
| Ventilation per room use | Architecture room data sheets; Sector requirements |
| Commissioning interface | BCAR ancillary cert schedule; Specialist systems (where applicable) |

### Matrix Row 5 — Electrical Agent

| Item to check | Targets to read |
|---|---|
| Lighting per room | Architecture reflected ceiling plan; Architecture room data sheets; Mechanical (clash) |
| Emergency lighting per escape route | Fire strategy escape routes; Architecture plans |
| Fire alarm device locations | Fire strategy; Architecture plans (rooms covered) |
| Small power vs Architecture room data sheets | Architecture room data sheets |
| Access control vs fire escape | Fire strategy escape routes; Architecture door schedule (powered hardware) |
| Containment route clash | Mechanical service routes; Structural openings |
| Containment crossing fire compartments | Fire strategy; Mechanical (combined fire-stop) |
| Power for mechanical plant | Mechanical plant schedule (load) |
| Lift power + machine room | Lift Agent specifications; Architecture lift well |
| Specialist power (nurse call, theatre, lab) | Specialist Systems Agent; Sector regulator |
| Backup power / generator / UPS | Mechanical (generator fuel + ventilation); Specialist Systems |
| Commissioning + testing regime | BCAR ancillary cert schedule |
| External lighting | Civil site plan; Landscape lighting strategy; Planning conditions |

### Matrix Row 6 — Civil Agent

| Item to check | Targets to read |
|---|---|
| External levels vs accessibility | DAC drawings; Architecture site plan |
| Drainage layout vs Landscape SuDS | Landscape SuDS strategy |
| Drainage capacity vs roof drainage | Mechanical roof drainage |
| Utilities connections (gas, water, electric) | Mechanical incoming services; Electrical incoming services |
| Parking vs planning layout | Planning Law (approved planning layout) |
| Access roads vs planning + fire access | Planning Law; Fire (vehicular access) |
| SuDS conditions vs planning conditions | Planning Law; Landscape |
| Flood risk vs planning conditions | Planning Law (flood risk condition); Architecture FFL |
| Existing utilities + diversions | Mechanical / Electrical incoming; PSDP underground services risk |

### Matrix Row 7 — Architect Agent

| Item to check | Targets to read |
|---|---|
| Spaces match planning approved | Planning Law (planning drawings vs current) |
| Fire-strategy compartmentation reflected | Fire strategy |
| Accessibility provision reflected | DAC drawings |
| Service routes + clearances | Mechanical + Electrical service routes |
| Structural assumptions (load-bearing, openings) | Structural |
| Conservation interventions reflected | Conservation Architect (Method Statement) |
| Landscape interface | Landscape strategy + planting plan |
| Sector-specific room layouts | Sector Regulator Agent |

### Matrix Row 8 — Planning Law Agent

| Item to check | Targets to read |
|---|---|
| Current Architecture drawings vs approved planning drawings | Architecture plans, elevations |
| Materials condition vs Architecture finishes | Architecture finishes schedule |
| Landscape condition vs Landscape strategy | Landscape Agent drawings |
| SuDS condition vs Civil drainage | Civil Agent |
| Conservation condition vs Conservation Method Statement | Conservation Agent |
| Ecology condition vs survey + mitigation | Landscape Agent (ecology) |
| Construction management vs PSDP plan | PSDP Agent |
| Compliance submissions to local authority | Cross-discipline closure evidence |

### Matrix Row 9 — Conservation Architect Agent

| Item to check | Targets to read |
|---|---|
| Interventions to historic fabric | Architecture intervention drawings; Structural; M&E (services routing) |
| Like-for-like material specifications | Architecture specification |
| Services routing through historic fabric | Mechanical + Electrical services |
| Structural interventions | Structural drawings |
| Reversibility | Architecture details |
| Planning conservation conditions | Planning Law |

### Matrix Row 10 — Landscape Architect Agent

| Item to check | Targets to read |
|---|---|
| Tree protection (BS 5837) | Civil ground works; Contractor method statement |
| SuDS features | Civil drainage strategy |
| Levels vs accessibility | DAC; Civil external levels |
| Materials vs planning conditions | Planning Law |
| Biodiversity + ecology mitigation | Planning Law (conditions); Ecology survey |
| Boundary treatments vs planning | Planning Law |

### Matrix Row 11 — QS Agent

| Item to check | Targets to read |
|---|---|
| Every discipline's specification | All disciplines' specs |
| Every drawing scope vs BoQ | All disciplines' drawings |
| Provisional sums vs CDP scope | Contractor design portion documents |
| Scope exclusions vs statutory items | Fire / DAC / BCAR (statutory items cannot be excluded by QS) |
| Tender pack coherence | Public Procurement Agent |
| Cost plan vs current design | All disciplines (latest revision check) |
| Designer reports vs scope | Each designer's report |

### Matrix Row 12 — PSDP Agent

| Item to check | Targets to read |
|---|---|
| Roof access vs roof plan | Architecture roof plan; Mechanical rooftop plant |
| Plant maintenance access | Mechanical plant rooms; Electrical switchrooms |
| Live-site constraints | Architecture (occupied building extents) |
| Hazardous materials | Asbestos survey; Demolition survey |
| Underground services | Civil + Mechanical + Electrical incoming services |
| Confined-space risks | Mechanical (plant spaces, voids) |
| Working at height | Architecture (high parapets, roof access) |
| Temporary works | Structural |

### Matrix Row 13 — Assigned Certifier / BCAR Agent

| Item to check | Targets to read |
|---|---|
| Ancillary certifier coverage | All disciplines (which require ancillary cert) |
| Inspection plan vs critical points | All disciplines (which inspections required) |
| Fire stopping ancillary | Fire + Mechanical + Electrical |
| Structural fire protection ancillary | Structural + Fire |
| Glazing performance ancillary | Architecture window schedule |
| Air-tightness testing | Mechanical + Architecture |
| Sound insulation testing | Architecture acoustic strategy |
| Energy / BER calculation | Mechanical + Electrical + Architecture (envelope) |
| Disability Access ancillary | DAC + Architecture |
| Compliance documentation completeness | All disciplines' compliance documents |

### Matrix Row 14 — Public Procurement & PW-CF Agent

| Item to check | Targets to read |
|---|---|
| Date for Substantial Completion vs design freeze | All disciplines' revision dates |
| Insurance levels vs Contract Sum | QS cost plan |
| Performance Bond vs project value | QS cost plan |
| Defects Period vs warranty terms | Construction Law Agent |
| Contract form coherence (PW-CF5 vs BCAR D&B) | BCAR Agent; Construction Law Agent |
| Tender period arithmetic | Procurement timeline |
| OGP-permitted Departures | Contract bespoke amendments |

### Matrix Row 15 — Insurance & Indemnity Agent

| Item to check | Targets to read |
|---|---|
| Insurance levels vs CWMF guidance | Public Procurement Agent |
| Designer PI levels per discipline | Each design discipline's appointment letter |
| CAR cover vs existing structure works | Architecture (existing building scope); Construction Law |
| Indemnity clauses vs PW-CF risk allocation | Public Procurement; Construction Law |
| Latent Defects Insurance trigger | Sector (healthcare / education capital) |
| Sub-contractor insurance flow-down | Contract conditions |

### Matrix Row 16 — Construction Law Agent

| Item to check | Targets to read |
|---|---|
| Payment schedule vs Construction Contracts Act 2013 | Public Procurement; QS |
| Statutory Builder role | BCAR Agent |
| PSDP appointment | PSDP Agent |
| HSA notification threshold | PSDP + Contractor preliminaries |
| Dispute resolution cascade | Public Procurement; PW-CF schedule |
| Limitation periods vs warranty terms | Insurance Agent |
| Bespoke amendments | Public Procurement (Departures); Insurance |

### Matrix Row 17 — Lift Agent

| Item to check | Targets to read |
|---|---|
| Lift well dimensions | Architecture lift plans; Structural lift well |
| Headroom + pit | Architecture lift sections; Structural |
| Accessibility (I.S. EN 81-70) | DAC Agent |
| Evacuation provision (I.S. EN 81-72) | Fire Agent |
| Power supply | Electrical Agent |
| Machine room or machine-roomless coordination | Architecture; Mechanical (ventilation) |
| Standby + monitoring | Electrical |
| Lift Regulation examination regime | BCAR Agent; Handover Evidence |

### Matrix Row 18 — Specialist Systems Agent

| Item to check | Targets to read |
|---|---|
| Specialist plant space | Architecture plans; Mechanical (interface) |
| Specialist power | Electrical (rating, isolation) |
| Specialist HVAC | Mechanical (interface) |
| Specialist fire | Fire Agent (additional suppression) |
| Specialist BMS | Mechanical + Electrical |
| Specialist commissioning | BCAR ancillary cert schedule |

### Matrix Row 19 — Sector Regulator Agent

| Item to check | Targets to read |
|---|---|
| Bedroom dimensions + privacy | Architecture plans + Sector standard |
| Communal areas | Architecture plans |
| Sanitary facilities | Architecture plans + Sanitaryware schedule |
| Therapy / treatment rooms | Architecture plans + Sector standard |
| Staff areas | Architecture plans |
| Outdoor space (per user) | Architecture site plan + Landscape |
| Fire evacuation suitable for user profile | Fire Agent |
| Privacy / dignity / safeguarding | Architecture + Electrical (CCTV / access control) |
| Vulnerable-user environmental safety | Fire + Mechanical + Electrical + PSDP |

### Matrix Row 20 — Contractor / Contracts Manager Agent

| Item to check | Targets to read |
|---|---|
| Buildability per design drawn | All design disciplines |
| Sequencing constraints | All disciplines (critical path interfaces) |
| Mock-up + first-of-type | Architecture + Specialist Systems |
| Site logistics | Civil site plan + Architecture site plan |
| Live-site constraints | Architecture occupied extents + PSDP |
| CDP scope clarity | Each design discipline (interface with CDP) |

### Matrix Row 21 — Design Certifier Agent

| Item to check | Targets to read |
|---|---|
| Each designer's Design Certificate input | All design disciplines |
| Design freeze management | All disciplines' revision dates |
| Compliance documentation register | All disciplines' compliance docs |
| Designer competence statements | Each design discipline's CV / charter |

---

## Self-check protocol additions (file 13)

The Agent Self-Check Protocol gains an 8th check when running cross-references:

### Check 8 — Cross-reference completeness

> *Have I run the Cross-Reference Matrix for every item type in my discipline that requires cross-checking? For each (item × target document), have I verified found / inconsistent / missing?*

- ✅ YES → continue to emit cross-reference findings.
- ❌ NO → return to Step 3 of the protocol.

This check is binary: either the matrix was run completely, or it wasn't. Partial cross-reference runs are not allowed — they produce false-negative misses.

---

## Peer challenge interaction (file 07.1)

Cross-reference findings are special during peer challenge. The challenger should be the discipline whose document is MISSING the item — not the discipline that found it missing.

Example: Fire Agent emits a cross-reference finding that "Fire dampers absent from M&E ductwork drawing M-201." The peer challenger is the **Mechanical Agent**, not another fire reviewer. The Mechanical Agent must respond:

- **Retain** — confirms the dampers are missing; commits to revising M-201 Revision B.
- **Reject — REJ-01** — claims dampers ARE shown; provides source quote from M-201 showing them.
- **Reject — REJ-09** — claims planning grant permits a non-dampered approach.
- **Reject — REJ-10** — claims alternative compliance (fire-rated duct) signed off.

The cross-reference + peer challenge cycle is the strongest signal in the Council. Both disciplines together either agree on the gap or together explain why no gap exists.

---

## Worked example — Fire Agent cross-reference run

**Project:** the 327-finding Office project pack.

**Fire Agent own-discipline review** (complete) identified:

- Fire compartmentation strategy at Compartment Wall B/C (separating staff wing from public wing).
- 4 fire-rated doors (FD60 each) on the compartmentation line.
- 2 ductwork penetrations of the compartment line.
- 3 electrical containment crossings.
- Cause-and-effect matrix referenced but not appended (already flagged as own-discipline finding).

**Cross-reference matrix run:**

| Item | Target document | Result | Cross-ref finding? |
|---|---|---|---|
| Compartment Wall B/C | Architecture plan A-101 | Found, consistent — shown as fire wall | No |
| Compartment Wall B/C | Architecture section A-301 | Found, INCONSISTENT — section shows wall stopping at ceiling, fire strategy requires full-height to underside of slab | YES (Coordination — owner: Architect) |
| 4 fire-rated doors | Architecture door schedule | Found, INCONSISTENT — door D-15 listed as FD30; fire strategy requires FD60 | YES (Coordination — owner: Architect) |
| 2 ductwork penetrations | M&E ductwork drawing M-201 | **MISSING — no fire dampers shown** | YES (Not demonstrated — owner: Mechanical) |
| 2 ductwork penetrations | M&E fire damper schedule | **MISSING — schedule lists 0 dampers** | YES (Not demonstrated — owner: Mechanical) |
| 3 containment crossings | Electrical containment drawing E-301 | Found, but **fire stopping not specified** | YES (Coordination — owner: Electrical) |
| Structural fire protection (steel beams in Compartment B) | Structural drawings | Found, consistent — intumescent 60-min specified | No |
| Fire-stopping inspection regime | BCAR ancillary cert schedule | **MISSING — no Fire-Stopping Ancillary Certifier named** | YES (Not demonstrated — owner: Assigned Certifier) |

**Cross-reference findings emitted: 5**

Each carries the augmented schema fields:

```json
{
  "issue_id": "FIRE-CR-0001",
  "discipline_origin": "Fire",
  "cross_ref_anchor_discipline": "Fire",
  "cross_ref_target_disciplines": ["Mechanical"],
  "cross_ref_items_checked": [
    "Fire dampers per Fire Strategy §6.5 for ductwork penetrations of Compartment Wall B/C"
  ],
  "cross_ref_items_missing": [
    "Fire dampers not shown on M&E ductwork drawing M-201",
    "Fire damper schedule MS-04 lists 0 dampers"
  ],
  "source_document": "Fire Strategy §6.5; M-201; MS-04",
  "source_reference": "Fire Strategy §6.5 page 18 reads: '2 fire dampers FD60 required at locations FD-01 and FD-02 on Compartment B/C ductwork crossings.' M&E ductwork drawing M-201 shows ductwork at these locations with no damper symbols. M&E fire damper schedule MS-04 lists no dampers for Compartment B/C.",
  "status": "Not demonstrated",
  "risk": "Critical",
  "build_readiness_impact": "Build blocker",
  "owner": "Mechanical engineer (named in appointment)",
  "interface_disciplines": ["Architecture (Compartment B/C wall), BCAR (ancillary cert)"],
  "required_evidence": [
    "Revised M-201 Rev B showing 2 fire dampers at FD-01 + FD-02 locations",
    "Revised MS-04 Rev B with damper schedule entries",
    "Damper specification confirmed (FD60 to I.S. EN 1366-2)",
    "Fire-Stopping Ancillary Certifier appointed (BCAR)"
  ],
  "close_out_stage": "Pre-tender",
  "question": "Confirm fire damper provision at Compartment B/C ductwork crossings, revise M-201 and MS-04 as Revision B, and identify Fire-Stopping Ancillary Certifier."
}
```

---

## Computational notes

Cross-reference is expensive. Each item × target document pair is a separate inference call. For a typical Tier III pack (600 docs, 7 disciplines), naïve full-matrix cross-reference would run ~1500–3000 LLM calls.

**Batching strategy:**

- Cluster items by target document — one call per (item-cluster × target document), not one per (item × target document).
- Cache target document content with Anthropic prompt caching (system prompt) — the target document is the same across many checks.
- Use Haiku for the search-only step ("does the item appear in this document?"); only use Sonnet for the inconsistency reasoning step.
- Target compute budget: cross-reference adds ~30% to per-pack cost (Tier III: €28 → €36).

**Skipping strategy:**

- If the target document is not uploaded, emit "Document not provided" as the cross-reference result rather than running search.
- If the project intake states a discipline is "not appointed," skip its target documents entirely.
- If the agent's own-discipline review found no items in scope, skip the cross-reference run entirely.

---

## Failure modes

| Failure | What happens | Mitigation |
|---|---|---|
| Target document missing from upload | Cross-ref result is "document not present" — emit Not Demonstrated finding routed to the missing-document owner | Customer is told which document is required |
| Target document found but not classified to the right discipline | Cross-ref search misses the item | Document Classification Agent (file 02 Agent 2) must be tightened |
| Item exists on target document but in a non-standard symbol | Cross-ref search returns false negative | Add to negative-example library (file 13 + 15) — refine corpus pattern recognition |
| Multiple disciplines flag the same cross-ref missing item | Adjudicator merges (per file 07.2) | Adjudicator deduplication logic |
| Cross-ref finding contradicts a discipline's own review | Peer challenge surfaces this | Council Chair resolves; usually the cross-ref is right |

---

## How this changes the Council

Before file 19:

- Each discipline reviews its own documents.
- Peer challenge happens after, on findings already emitted.
- Cross-discipline gaps surface only if someone happens to notice.

After file 19:

- Each discipline reviews its own documents AND the relevant slices of every OTHER discipline's documents.
- Cross-reference findings are emitted DURING the own-discipline review, not after.
- The peer challenge is sharpened — the challenger is the owner of the MISSING item.
- The Council Chair report has structurally richer findings — most Critical findings will be cross-reference findings (because that's where coordination failures hide).

This is the difference between "AI scanning a tender pack" and "a council of chartered consultants reading each other's drawings."

---

## Single sentence

> *Every chartered designer's scope lives in everyone else's drawings — the Cross-Reference Protocol is what makes the Council read the whole pack, not just the discipline filename.*

---

*Apply the matrix on every pack. Skip nothing. The findings that this protocol surfaces are the ones that turn into six-figure variations on site.*
