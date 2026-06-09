# VerifIQ Website — Full UI/UX, Brand & Architecture Review

**Date:** 2026-06-09
**Scope:** All 10 pages + 2 stylesheets in `verifiq26/website/`, audited against the
product spec (`verifiq-prompts/08_guardrails.md`, `01_master_system_prompt.md`,
`02_agent_architecture.md`, `CLAUDE.md`).
**Method:** Three parallel expert passes — visual-design system, UX/flow/accessibility,
and architecture-alignment / "keep the automation hidden" / guardrails-compliance.

---

## 1. Executive summary

The site is **functional and on-brand on its six "atelier" pages, but it is really
four different design systems stitched together by links**, and several pages
**actively contradict the company's own honesty positioning** by exposing the
backend automation or fabricating "live" data and chartered reviewers.

Three things matter most:

1. **The backend automation is not hidden — it's on display.** The Hunt page renders
   an SDK/API code editor (`Hunt.scan(pack)`), the dashboard shows LLM "inference
   cost / input tokens / cheap routing / €17.42" and a "96.2% confidence" score.
   This is exactly the machinery you asked to keep behind the scenes.
2. **Two pages break the "named human reviewer, output is indicative" promise.** The
   live dashboard invents a **7-person chartered panel** with full names and
   credentials; `about.html` says there is **one** pilot reviewer with the rest
   "joining." The pitch page presents pure software autonomy with no reviewer at all.
3. **The visual system forks four ways.** `three-products.html` (the font you spotted)
   falls back to **system Calibri**, not Inter; `dashboard-live.html` uses
   **Cinzel + Lato**; Hunt/dashboard use a dark Tailwind theme. Only six pages use the
   canonical Playfair Display + Inter + JetBrains Mono.

Plus a cluster of credibility issues: the flagship **"327 findings" proof doesn't
reconcile** across pages (3 vs 30 critical, 161 vs 187 files, 327 vs 328), every CTA is
a `mailto:` with no real form, navigation collapses once you leave the homepage, and
there are no keyboard-focus states (a WCAG failure).

**None of this is hard to fix** — it's mostly consolidation onto decisions you've
already made in the design system and the spec. Section 7 is the phased plan.

---

## 2. The canonical "source of truth" (what everything should conform to)

Per the design system (`verifiq-system.css`) and the spec, the standards are:

| Dimension | Canonical value |
|---|---|
| Display / headings | **Playfair Display** (`--font-serif`) |
| Body | **Inter** (`--font-sans`) |
| Mono / labels | **JetBrains Mono** (`--font-mono`) |
| Surfaces | bone `#F5F1EB` · paper `#FBF8F3` · vellum `#EBE4D8` |
| Ink | ink `#1A1A1F` · ink-soft · graphite · draft |
| Accents | brass `#A07C35`; severity: sanguine/amber/olive/moss |
| Voice | Named human reviewer · output **indicative** · "you verify locally" |
| Automation | **Hidden.** No AI/LLM/agent/council/API/token/model language or visuals |
| Disclaimer | The **verbatim locked disclaimer** in every page footer |

The multi-agent "Council" and multi-LLM routing (`02_agent_architecture.md`) is
**backend only** — the public site must read as a polished, human-backed review service.

---

## 3. CRITICAL — fix before any public launch

### 3.1 Hidden-automation leaks (your explicit requirement)

- **C2 · `hunt.html:104-228,462-490` — "Live Scan Demo" is a code IDE calling an API.**
  Renders `import { Hunt } from '@verifiq/hunt'`, `const risk = await Hunt.scan(pack,…)`,
  `// -> 328 variation triggers found`, a "TypeScript" status chip, and the caption
  *"Code on the left calls the Hunt API."* This is the single most direct exposure of
  the automation pipeline. → Replace with a **reviewer's-workbench** framing: a marked-up
  document on the left, a ranked €-exposure register with PW-CF clause refs on the right.
  Remove all SDK/API/code elements.

- **C3 · `dashboard.html:303-327` — "Inference cost" panel exposes LLM mechanics.**
  *"Inference cost · Input tokens 1,432,810 · Output tokens 487,224 · Cheap routing 42%
  saved · Running cost €17.42."* Raw provider-billing internals; also undercuts the
  human-backed story (the "review" costs €17 of compute). → Delete, or replace with a
  customer-framed line: *"Tier 2 · 161 files · reviewer-checked · €400."*

- **C4 · `dashboard.html:297` — "Conf 96.2%" confidence score.** A numeric
  certainty/confidence figure violates the indicative-output posture and the
  "no compliance score" rule. → Remove (use "Files 161/161" if a third stat is wanted).

### 3.2 Brand-honesty contradictions

- **C5 · `dashboard-live.html:274-280` — fabricated 7-person chartered panel.**
  Invents `A. Ní Cheallaigh, RIAI`, `D. Murphy, CEng MIEI`, `S. Walsh, CEng MIEI`,
  `P. O'Brien, CEng`, `M. Doyle, FSE`, `C. Hennessy, FSCSI`, `E. Lynch, RIAI · AC`, plus
  "142 Approved · Chartered eye · signed." Directly contradicts `about.html` ("one pilot
  reviewer, four disciplines joining") **and** spec rule 08:162 ("Marketing must NOT claim
  a chartered panel"). → Reduce to the real pilot: one named reviewer; out-of-discipline
  items shown as the spec-mandated stamp *"AI-surfaced · pending chartered review · [discipline]."*

- **C6 · `dashboard.html` / `dashboard-live.html` — fabricated "live" telemetry, unlabelled.**
  Running cost, a counting-up findings total, a countdown ETA, "Live · Scanning",
  "96.2%", a streaming "From the Bench" feed, a date ("resets 1 Jun") already in the past.
  Your own `about.html:101` attacks competitors who "imply expert review where none is
  happening" — these pages do exactly that. → Add a persistent **"Illustrative mockup —
  not live data"** ribbon to both, OR pull them from the public site until the real product
  exists (see decision D2).

### 3.3 Missing locked disclaimer

- **C1 · `hunt.html:456`** has a bespoke paraphrase, not the verbatim locked disclaimer —
  on your highest-traffic sales page. `three-products.html` has **none at all**.
  `dashboard.html:478` has a strapline, not the verbatim block. Spec 08:82 requires the
  **verbatim** locked disclaimer in every customer-facing footer. → Add it to Hunt,
  three-products, dashboard (and, strictly, 404).

---

## 4. MAJOR

### 4.1 Visual-system unification
- **`three-products.html` (the font you noticed):** body falls back to
  `-apple-system,…,Calibri` instead of Inter; headings are 800-weight system sans, not
  Playfair Display; palette is a one-off blue/charcoal. → Bring onto the canonical system.
- **`dashboard-live.html`:** Tailwind config sets `header: ['Cinzel']`, `body: ['Lato']`.
  → Change to Playfair Display + Inter (keep JetBrains Mono).
- **`hunt.html` / `dashboard.html`:** dark Tailwind theme; Hunt uses orange `#F97316`
  instead of brass. Decision D1: unify type (at minimum Inter/JetBrains Mono, ideally the
  full atelier system) even if a distinct accent is kept per product.

### 4.2 Data consistency — the "327" proof
The central proof point doesn't reconcile:
| Source | Findings | Critical | Files | Disciplines |
|---|---|---|---|---|
| `case-study-01` | 327 | 3 (split sums to 110, not 327) | 161 | 5 |
| `dashboard.html` | 327 | **30** | 161 / "560 pages" | 5 |
| `dashboard-live` | — | 3 | "187 / 600" | 7 |
| `cad-library` | — | — | 187 | 7 |
| `hunt.html` | **328** | — | — | — |
→ Pick **one canonical set** (taken from the actual `evidence/findings-register-v0.8`)
and propagate everywhere. Inconsistency here undermines "source-quoted, verifiable."

### 4.3 Navigation & flow
- **No consistent header once you leave the homepage.** `about`, `case-study-01`, `legal`
  drop the nav links for a single "Home"/"Request the brief" link; **`three-products.html`
  has no header at all**; Hunt/dashboards have separate dark navs; `dashboard.html` has **no
  link back** to the marketing site. → Standardise one shared header with real cross-links
  on every atelier page; give three-products a header; give the dark pages a "← VerifIQ.ie".
- **`dashboard-live.html` is an orphan** (linked from nowhere). → Link with honest framing or remove.
- **No real conversion anywhere.** Every CTA is `mailto:`; Hunt's "Free scan / Buy scan /
  Subscribe" point to `#pricing` or `#` (do nothing). → Wire a real form/booking, or relabel
  to "Request access" so the promise matches behaviour (decision D3).

### 4.4 Guardrail copy violations (banned verbs/nouns, spec 08)
- "expert" (banned noun) — `about.html:101`, `three-products.html:322`.
- "compliance" used as the product's job (banned verb "comply") — `three-products.html`
  "fire compliance", "electrical compliance" → "checks alignment with…".
- "Approved" status (banned verb) — `dashboard-live.html:191` → "checked / read closely".
- "sign-off" — `case-study-01.html:75`, `dashboard.html:478` → reviewer "review"; keep
  "the designer signs" (spec-aligned).
- *Keep* `"AI-surfaced · pending chartered review"` (`about`, `case-study`) — it is the
  one spec-mandated use of "AI" (08:164). Do not "correct" it.

### 4.5 `three-products.html` exposes internal strategy
Public URL (linked as "The engine") contains investor/GTM material: "How much money is in
this?", market-sizing tables, "NEW MARKET", a Year-2 roadmap, "That is the bet." → Reframe
as customer-facing or move out of the public site (decision D4).

### 4.6 Accessibility (WCAG)
- **No visible focus states** anywhere (neither CSS file defines `:focus-visible`; Tailwind
  pages set `focus:outline-none`). → Global `:focus-visible { outline:2px solid var(--brass);
  outline-offset:2px }`. **(WCAG 2.4.7 fail.)**
- Icon-only buttons without `aria-label` (notification bell, hamburger, avatar);
  search input with no label (`dashboard.html`).
- **Mobile menu is a dead control** — the sidebar is `hidden lg:flex`, hamburger does
  nothing → no navigation on phones.
- Missing `<main>` landmark on `cad-library`, `three-products`.

---

## 5. MINOR
- **Date formats** fork three ways: "MMXXVI", "© 2026", ISO "2026-06". Pick one register.
- **Five different footer structures**; Hunt "Terms" → `#` (dead); Hunt email isn't a
  `mailto:`. Standardise.
- **Contrast:** `--draft`/`--graphite` mono labels on bone are ~3:1 (below 4.5:1); many
  `text-[10px]` captions on dark are borderline. Darken one step or bump size.
- **`cad-library.html:59`** copy says "IBM Plex Serif… Plex Sans… Plex Mono" — wrong; the
  system is Playfair/Inter/JetBrains. Documentation typo.
- **SEO/polish:** no `<meta description>` on about, cad-library, three-products, hunt,
  dashboards, 404; **no favicon** on any page.
- Proofreading: `about.html:62` "the chartered-reviewed reviewer" reads awkwardly.

---

## 6. Page-by-page verdict

| Page | Design system | Verdict |
|---|---|---|
| `index.html` | atelier ✓ | Good. Reconcile "327" numbers; "engine" wording. |
| `about.html` | atelier ✓ | Good. "expert" (M), proofread, contrast. |
| `case-study-01.html` | atelier ✓ | Good. Severity split must sum to 327; "sign-off". |
| `legal.html` | atelier ✓ | Good. |
| `404.html` | atelier ✓ | Good. Add disclaimer (strict). |
| `cad-library.html` | atelier ✓ | Good. Plex typo; `href="#"`; `<main>`. |
| `three-products.html` | **system fallback ✗** | Wrong font; no nav; no disclaimer; internal strategy; "expert"/"compliance". Biggest single-page cleanup. |
| `hunt.html` | dark Tailwind | Code/API leak (C2); no locked disclaimer (C1); dead CTAs; orange accent. |
| `dashboard.html` | dark Tailwind | Inference/token panel (C3); confidence score (C4); fake live data; no mobile nav; wrong numbers. |
| `dashboard-live.html` | **Cinzel/Lato ✗** | Fabricated panel (C5); fake telemetry (C6); orphan; wrong fonts. |

---

## 7. Recommended scope of work (phased)

**Phase A — Honesty & automation (CRITICAL, do first).** C1–C6: strip the code/API demo,
inference-cost panel, confidence score; de-fabricate the dashboards (mockup ribbon + real
pilot-reviewer reality, no invented panel); restore the verbatim locked disclaimer
everywhere. *Highest reputational risk; smallest code surface.*

**Phase B — One design system.** Bring `three-products.html` and `dashboard-live.html`
onto Playfair/Inter/JetBrains + the canonical palette; decide Hunt/dashboard treatment
(D1); add a single shared header/footer across atelier pages; global focus-visible.

**Phase C — Truth & conversion.** Lock one canonical "327" dataset and propagate; fix
banned verbs/nouns; wire a real lead-capture (form/booking) or honestly relabel CTAs (D3).

**Phase D — Polish.** Dates, footers, contrast, `<main>`/aria/mobile-menu, meta
descriptions, favicon, Plex typo, proofread.

---

## 8. Decisions needed before implementing

- **D1 — Hunt/dashboard branding:** unify fully to the atelier system, or keep a distinct
  per-product accent on a shared type system?
- **D2 — The dashboard mockups:** keep public with "illustrative mockup" labels + honesty
  fixes, or pull them off the public site until the real product exists?
- **D3 — CTAs:** wire a real form/booking now, or relabel everything to "Request the brief"
  (mailto) until the product is live?
- **D4 — `three-products.html`:** reframe as a customer portfolio page, or remove from the
  public site (it currently exposes internal GTM strategy)?
