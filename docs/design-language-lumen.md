# FMIQ "Lumen" — Design Language & UI Redesign

> **Status:** Wave 0 (foundation) landed. Fan-out in progress.
> **One line:** *Museum-grade calm meets mission-control clarity* — the composure of a conservation lab with the responsiveness of a trading desk.

## 1. Why redesign

FMIQ's engineering is strong and its accessibility leads the field, but the UI read as a competent admin dashboard, not a best-in-class product. To make NMI/OGP evaluators (and the wider heritage/estates market) react with *"that's slick,"* the UI must match the polish of the design canon **and** out-do rivals where we already have an edge.

### What the research said
- **Rivals (Infraspeak, MaintainX, Facilio, Eptura, Planon):** win on **spatial intelligence** (live map by building/asset/team), **mobile-first technician flows**, and **AI/predictive + IoT** framing — but look like generic enterprise SaaS, and none are accessibility-native.
- **The "expensive" canon (Stripe, Linear, Notion, Datadog, Vercel):** the signal is **restraint**, not more charts — progressive disclosure, 5–9 elements per view, whitespace discipline, hairline borders, a **⌘K command palette**, **light/dark**, and **purposeful micro-interactions**. Dominant stack: **Tailwind + shadcn/ui (Radix) + Recharts + TanStack Table + Framer Motion** (you own the component source; accessible by default).
- **Our unfair advantage:** WCAG 2.2 AA is *mandatory* for Irish/UK public bodies (monitored since Oct 2024). Rivals are slick-but-not-compliant. We fuse their polish with **government-grade accessibility** and a **heritage-museum identity** nobody else has.

Sources: Verdantix Green Quadrant CMMS 2025; Infraspeak/Facilio/MaintainX product pages; 925studios & Orbix B2B dashboard design 2026; shadcn/ui docs; GOV.UK Design System / WCAG 2.2.

## 2. The language

- **Keep what's distinctive.** Heritage-green brand spine + DM Serif Display editorial headers — gravitas as a *feature* against the sea of SaaS-blue. Systematised into design tokens.
- **Add the polish.** Restraint, whitespace, hairline borders, soft elevation, tabular numerals for all data, ⌘K palette, and **"Atrium Dark"** (deep forest-charcoal — museum-at-night, never pure black).
- **Accessibility is a visible asset.** WCAG 2.2 AA, status by **icon + text** (never colour alone), keyboard-first, reduced-motion respected, high-contrast-friendly tokens, bilingual EN/GA.

### Signature "wow" experiences (our differentiators)
1. **Collection-Care Command Centre** — living mission-control: animated excursion loop, RH/temp/lux sparklines per zone, the sense→evaluate→name→route→act→evidence ribbon in motion. *No rival centres conservation science.*
2. **Estate Twin** — the floor-map upgraded to an interactive SVG estate; zones heat-stated by RH/lux/work-order density; click-through asset → WO.
3. **⌘K command palette** — jump to any site/asset/WO, run actions ("raise issue", "open evidence pack").
4. **Evidence pack / golden thread** — an audit-grade, print-ready document view; a governance flex.

## 3. Tokens (`src/index.css`)

Tailwind v4 CSS-first. Semantic tokens flip for light / `.dark`, mapped to utilities via `@theme inline`.

| Role | Light | Atrium Dark |
|---|---|---|
| `background` / `foreground` | limestone `#f7f5f2` / charcoal `#1a1814` | forest-charcoal `#0f1411` / `#eceae4` |
| `primary` | heritage green `#1c4532` | lifted green `#5aa178` |
| `border` | granite `#d9d6d0` | `#2a2e25` |
| `ok` / `watch` / `crit` / `info` | paired fg+bg, AA contrast | dark-mode paired variants |

Type: `--font-display` DM Serif Display (titles), `--font-sans` DM Sans (UI), `--font-body` Inter, `--font-mono`. Radius scale `sm/md/lg/xl` off `--radius: 0.625rem`. Chart palette `chart-1…5`.

## 4. Component system (`src/components/ui`, `src/components/shell`)

Built on Radix + our tokens (own-the-code shadcn style). **Shipped in Wave 0:** `button`, `card`, `badge` (RAG, icon+text law baked in), `table`, `tabs`, `dialog`, `tooltip`, `dropdown-menu`, `command` (⌘K), `sonner` (toast), `skeleton`, `theme-provider` + `theme-toggle`, `page-header`, `stat`, `empty-state`, and the **AppShell** (sidebar + topbar + ⌘K + theme + mobile drawer). **Reference screen:** `views/Certificates.tsx` migrated end-to-end.

### Conventions for every migrated screen
1. Open with `<PageHeader title subtitle actions />`.
2. KPIs as a `Stat` grid (2-up mobile → 4-up desktop).
3. Content in `Card` + `CardHeader/CardTitle/CardDescription`; tables via the `Table` primitives.
4. Status via `Badge tone=...` (icon + text always).
5. **Every list has loading (`Skeleton`), empty (`EmptyState`), and error (`EmptyState tone="error"`) states.**
6. Charts via Recharts using `chart-1…5` tokens; motion via Framer Motion (respect reduced-motion).
7. Keep accessible names/headings stable so Playwright + a11y tests stay green.
8. Use the `@/` import alias. Do **not** edit shared shell/token files — those are owned by Wave 0 / integration.

## 5. How we run the agent team (parallel, collision-free)

Wave-based, **disjoint file ownership**, each fan-out agent in its own git worktree; merge in order.

- **Wave 0 — Foundation (done):** stack, tokens, primitives, AppShell, reference screen. App stays green throughout (legacy `theme.css` coexists until each screen migrates).
- **Wave 1 — Fan-out (parallel, no shared files):**
  - **A** Command Centre (hero) + Role dashboards
  - **B** Maintenance · Help desk · PPM · Field (work management)
  - **C** Compliance · Certificates polish · Contractor compliance · Evidence packs (governance)
  - **D** Estate Twin (spatial / floor-map)
  - **E** Inventory · Approvals · Documents · Sustainability · Integrations · Reports
  - **F** Charts/data-viz library + motion polish (owns chart components only)
- **Wave 2 — Integration & QA:** axe a11y audit, responsive + dark-mode parity, Playwright visual regression, bundle/perf (code-split Recharts), cross-screen consistency, retire `theme.css`.

### Definition of done (per screen)
Typechecks · light **and** dark verified · loading/empty/error states · keyboard + screen-reader pass · Playwright spec green · no edits to shell/token files.
