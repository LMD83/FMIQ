# FMIQ Design System

Heritage-credible, Irish-government-adjacent, WCAG 2.2 AA. Mood: **authoritative, considered, warm, precise, enduring.** Reference points: gov.ie design system, NMI's 2024 Zero-G identity, and the elegance of Linear/Notion — explicitly *not* legacy enterprise FM (Maximo/SAP).

## Colour tokens

```css
:root {
  /* Brand */
  --heritage-green: #1C4532;   /* primary action, active nav, key headings */
  --forest:         #14362A;   /* hover/active, focus rings */
  --sage:           #2F6B4A;   /* success / compliant status */

  /* Surfaces (warm, stone-derived — not clinical blue-white) */
  --limestone:      #F7F5F2;   /* app background */
  --pale-stone:     #EFEDE9;   /* cards, sidebar panels */
  --white:          #FFFFFF;

  /* Text */
  --charcoal:       #1A1814;   /* body, table data (warm near-black) */
  --slate:          #4A4744;   /* secondary labels, captions */

  /* Lines */
  --granite:        #D9D6D0;   /* borders, table rules */

  /* Accent & semantic */
  --gold:           #8B6020;   /* heritage gold — links/badges (darkened to clear AA on body) */
  --gold-large:     #B07D2A;   /* gold for large text / UI only */
  --terracotta:     #C0522A;   /* warning / overdue (echoes NMI tile #da532c) */
  --info:           #2E4C6E;   /* informational */
  --garnet:         #9B1C1C;   /* error / critical */
}
```

**Status semantics for collection care (RAG):** Compliant = `--sage`; Watch/drift = `--gold-large`/amber; Excursion/critical = `--terracotta` → `--garnet` by severity. Never rely on colour alone — pair with icon + text label (WCAG 1.4.1).

**Contrast (verified):** white on heritage-green ~9.8:1; charcoal on limestone ~17:1; heritage-green on limestone ~8.2:1; white on terracotta ~4.9:1. All clear AA; most clear AAA. Gold `#B07D2A` only for large/UI text; use `#8B6020` for small body.

## Typography

```css
--font-display: 'DM Serif Display', Georgia, serif;   /* H1–H2 display only */
--font-ui:      'DM Sans', 'Helvetica Neue', Arial, sans-serif; /* H3–H5, labels, buttons */
--font-body:    'Inter', system-ui, -apple-system, sans-serif;  /* body + data tables (use tabular-nums) */
--font-mono:    'JetBrains Mono', 'Courier New', monospace;      /* asset codes, IDs, logs */
```

DM Sans is chosen as the close free analogue to NMI's brand typeface (CoType Aeonik) — the product feels adjacent to NMI's own identity. Inter for dense data legibility. All Google Fonts / open-licence.

## Spacing & density (4px base)

`4 / 8 / 12 / 16 / 24 / 32 / 48`. Table rows 36px default (28 compact / 48 comfortable, user-switchable). Sidebar items 40px. Card padding 16px, 1px `--granite` border, 6px radius. Inputs/buttons 4px radius; modals 8px. Shadows minimal: `0 1px 3px rgba(26,24,20,.08)`. Space signals quality — density is *tamed*, not avoided.

## Iconography
Lucide (MIT), 1.5px stroke, 24×24 grid, `currentColor`. Slate default, heritage-green when active. Line-drawn building silhouettes per site for spatial nav (echoes NMI's four-building icon system). No filled/consumer/multicolour icons.

## Accessibility (mandatory — EN 301 549 / WCAG 2.2 AA)
- Contrast 4.5:1 text / 3:1 large+UI; visible 2px focus rings ≥3:1.
- Full keyboard nav; ARIA roles; live regions for status updates (critical for real-time environmental alerts).
- Target size ≥24×24px (prefer 44×44 touch); 200% zoom & 320px reflow; `prefers-reduced-motion`.
- `lang="ga"` on Gaeilge content (bilingual is a genuine NMI requirement).
- Published Accessibility Statement + session-timeout warnings with extend.
- Align to gov.ie component conventions (header, focus, buttons, forms); justify deviations.

## Legal frame
S.I. 358/2020 (Web Accessibility Directive) + S.I. 699/2023 (EAA, deadline 28 Jun 2025). EN 301 549 is the harmonised standard (v3.2.1 ≈ WCAG 2.1 AA; v4.1.1 → 2.2 AA, 2026). **Build to 2.2 AA now.** Monitoring body: NDA. Non-compliance is publicly reported and fineable (up to €60,000).
