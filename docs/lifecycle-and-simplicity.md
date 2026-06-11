# FMIQ — Capital-to-Operations Lifecycle, GovIQ Fit & Radical Simplicity

_Vision note capturing Liam's brief: "when the contract is completed, certs issued (HSE capital or by contracts), how the building is then managed by this system — revolutionise it, make it so simple a 14-year-old can use it."_

## 1. The golden thread: capital → certification → operations

The single biggest gap in the market isn't a feature — it's the **handover cliff**. A capital project finishes, a mountain of paper (certs, O&M manuals, safety file, as-builts) is handed over, and almost none of it makes it into the system that runs the building. Day-one of operations starts cold. FMIQ closes that cliff into a continuous thread.

```
PROCURE (CWMF / eTenders)           → governed in GovIQ
   ↓
DELIVER (Stages 1–5, PSDP/PSCS)     → FMIQ Projects (budget, drawdowns, programme)
   ↓
COMPLETE & CERTIFY                  → the handover gate (this is the new module)
   • BCAR: Certificate of Compliance on Completion (Assigned Certifier + Builder)
   • Safety File (Construction Regs / CDM) + O&M manuals + as-builts
   • Commissioning + environmental commissioning of HVAC/BMS
   • HSE capital sign-off OR contract completion certificate
   • Asset data handover: COBie / IFC → no re-keying
   ↓
OPERATE (FMIQ live)                 → assets, PPM, compliance, collection-care all
   • Every certified asset lands in the register with its warranty, O&M, cert
   • PPM schedules auto-generated from the asset types handed over
   • Statutory compliance clock starts automatically (fire, electrical, L8…)
   • Collection-care zones inherit the commissioned environmental setpoints
```

**The module to build (revolutionary differentiator):** a **Handover Gate** in Projects that, on completion, ingests the COBie/IFC + cert pack and *writes assets, warranties, O&M docs, PPM schedules and compliance obligations straight into the live operational register* — with the certificate attached to each asset as evidence. The "golden thread" (the digital record the Building Safety Act made famous in the UK, and that BCAR + Soft Landings point at in Ireland) becomes a living database, not a binder on a shelf.

Why it's 10x: incumbents treat capital and operations as separate products. FMIQ makes completion an *event that populates operations*. A building handed over Friday is fully managed Monday, with zero re-keying and a complete audit trail from procurement to in-use.

## 2. GovIQ fit — one platform, one thread

FMIQ is the **operations end** of the GovIQ public-sector spine:

| GovIQ capability | FMIQ relationship |
|---|---|
| Procurement / eTenders / CWMF governance | Feeds the Projects module — the capital project FMIQ then delivers and hands over |
| Identity (Azure Entra) | Shared SSO + RBAC across GovIQ and FMIQ |
| Compliance / governance / audit | FMIQ's compliance register + immutable audit log are GovIQ-grade |
| Reporting / assurance | Shared dashboards; one source of truth procurement → in-use |

Same stack (Azure/Postgres/React/Entra), same tenancy model, same audit posture — FMIQ is a module of GovIQ, not a bolt-on. The thread runs unbroken: *procure → build → certify → operate*, all in one place, defensible to auditor, regulator and funder.

## 3. Radical simplicity — "a 14-year-old can use it, no manual"

Legacy IWMS fails on adoption: they're built for trained administrators. FMIQ's design law is the opposite.

**Principles**
1. **One screen answers one question.** The Command Centre answers "is anything wrong, and what do I do?" — nothing else competes for attention.
2. **Plain language, not jargon.** "Humidity rising fast in the Textile Gallery — 3 fragile objects at risk. A job has been created. Tap to send someone." Not "RH rate-of-change excursion, WO-23252, P1."
3. **The system does the thinking.** It detects, names the risk, drafts the work order, suggests the fix. The human approves — one tap.
4. **Role-based front door.** A technician opens to "your jobs today." A conservator opens to "your zones." A director opens to "estate health." Nobody hunts through menus.
5. **No empty states, no blank forms.** Everything is pre-filled from sensors, the catalogue, the handover data. You confirm, you don't type.
6. **Traffic-light truth.** Green / amber / red, with words and icons (never colour alone — WCAG 2.2 AA). If it's red, the next action is right there.
7. **Mobile-first, offline.** A maintenance person in a stone vault with no signal still gets the job, the guidance, and can close it with a photo.

**Test of done:** hand the app to someone who's never seen it; within 30 seconds they can say what's wrong and what happens next, without being told.

## 4. Global features worth stealing (to validate with a deep-research pass)

From the market research already done, plus the lifecycle angle to research next: predictive failure (sensor + ML before breakdown); digital-twin / BIM viewer tied to live sensor overlays; "golden thread" handover records (UK Building Safety Act); Government Soft Landings / BSRIA Soft Landings (aftercare period where the project team stays accountable into operations); AI triage of incoming faults; QR-on-asset instant history; funder/loan one-click evidence packs. Next research sprint: global best practice in capital-handover-to-FM and the simplest consumer-grade operational UIs (think the clarity of a banking app, applied to estates).

## 5. Proposed next build
The **Handover Gate** module (§1): on a Project reaching completion, attach the certificate pack + COBie, and auto-populate the asset register, PPM schedules and compliance clock — certificate evidence linked to every asset. This is the feature that makes FMIQ the system that *runs* the building the moment the ribbon is cut.
