# FMIQ Roadmap & Commercial Model

> **Build status (2026-06-08, updated):** Phases 1–3 implemented and tested (199 API + 4 web
> tests; Playwright E2E + axe a11y in CI). Live integration transports are wired (HMAC HTTP +
> config resolution); AI features (triage, O&M assistant) run on Claude `claude-opus-4-8` behind
> a port with a rule-based default. Remaining for production: external endpoints/secrets +
> ANTHROPIC_API_KEY (ops), the independent accessibility audit → published ACR, and the
> digital-twin 3D/IFC viewer. Original Phase-1 note follows.
>
> **Build status (2026-06-08):** Phase 1 backend spine is implemented across S1–S12 —
> platform primitives (RLS, gate engine, eventing/outbox, calendar, notifications),
> asset register, PPM scheduler, compliance certificates, the SSoW Readiness Gate
> (gate engine + RAMS/permit/competency/pre-task/keys), gated approvals + commitment,
> inventory, reactive close-out with failure coding, and role-dashboard aggregates —
> all migration + domain + RLS-isolation/unit tested (132 tests). Remaining for pilot
> go-live: the front-end (mobile/PWA field app, role dashboards UI, design-system
> components), live integrations (Conserv/BMS/Axiell/Revenue/fire-panel), and the
> independent accessibility audit + published ACR. See `accessibility-statement.md`.

## Build sequence (Now / Next / Later)

### NOW — Phase 1: Pilot-ready MVP (target ~6 months)
The goal is one museum, one lighthouse, the closed-loop hero working for real.
- **Foundation:** Azure landing zone, Postgres+RLS+Timescale, Entra B2B SSO, React app shell, design system, accessibility baseline (WCAG 2.2 AA).
- **Estate & asset register** (manual entry + CSV; IFC import deferred).
- **Collection-care monitoring + closed-loop workflow** (the hero): one sensor adapter (Conserv *or* Hanwell), per-zone standard templates, excursion detection (absolute + rate-of-change), object-risk linkage (Axiell read-only), auto work-order + alert routing.
- **Reactive + planned maintenance**, mobile field app (offline, photo, QR scan).
- **Compliance register** + mobile inspections.
- **Role dashboards** (Conservation, Estates, Director) + scheduled PDF reports.
- **Audit trail** + published Accessibility Statement/ACR.
- **Exit criterion:** a real excursion at the pilot site produces a work order in <60s with named at-risk objects, gets actioned on mobile, and auto-generates a loan-ready evidence record.

### NEXT — Phase 2 (months 6–14)
- Projects & programmes (CWMF/PWC-aware, drawdown, closure-impact, asset write-back).
- Sustainability + utilities + **Bizot Green Protocol compliance tracking**.
- IPM/pest module. BMS read + authorised setpoint write-back.
- IFC/COBie self-service import. SCIM provisioning. Additional sensor adapters (T&D, HOBO, MQTT/BMS).
- No-code report builder; Power BI/OData feeds. Cyber Essentials Plus.

### LATER — Phase 3 (14 months+)
- AI collection-risk prediction (sensor time-series × object sensitivity → pre-emptive prioritisation).
- Multi-institution benchmarking/analytics. Template marketplace.
- Advanced loan management; eIDAS/Digital Identity Wallet readiness; ISO 27001 → SOC 2.

## Commercial model (recommended)

**Primary: SaaS annual subscription priced by estate scale (per site / per building bands), with module bolt-ons.** This fits FM tools (many users, varied levels) better than per-user, and matches where the market is moving. Mirrors how Planon/QFM/Archibus are bought without their opacity.

| Lever | Detail |
|---|---|
| Core platform | Annual SaaS, banded by sites + buildings + monitored collection zones |
| Module bolt-ons | Projects/CWMF, Sustainability/Bizot, IPM, BMS write-back, advanced loans |
| Sensor adapters | Per integrated source (Conserv/Hanwell/BMS) |
| Premium tier | Dedicated schema/instance, CMK, geo-redundant SLA |
| Implementation | Fixed-fee onboarding (weeks, not the incumbents' 9–18 months) |
| Support | Tiered (standard / priority / mission-critical) |

**Indicative market anchors (for positioning, not our price):** enterprise IWMS platform licences run ~€80k–250k/yr+ with €300k–1M implementations and 9–18 month timelines (Planon floor ~€200k/yr). FMIQ's wedge is **lower TCO, weeks-to-value, and collection-care nobody else has** — priced to undercut enterprise incumbents while commanding a premium over generic mid-market CAFM for the heritage capability.

**Procurement routes (Ireland):** above ~€215k services threshold → OJEU via eTenders; pursue OGP framework listings; build the **Build-to-Share / Information Mediator-compatible API** as a procurement differentiator. Publish ACR/VPAT to clear the accessibility gate most incumbents ignore.
