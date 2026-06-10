# Stage 2 — Frontend build plan (Next.js thin slice)

Goal: the smallest **real** product UI that proves value end-to-end against the
live Convex backend — **create a project → run a review → watch findings render
live** — then grow it. Built best once Convex is provisioned (docs/35) so it can
be validated against real data.

## Read surface (already shipped, PR #18)
`src/convex/projectData.ts` — all public, read-only, ownership-checked:
- `listProjects()` → dashboard list
- `getProjectStatus(project_id)` → scan_state + severity tallies (poll/subscribe)
- `getProjectFindings(project_id)` → the findings register

Plus existing public functions: `mutations.createProject`, `mutations.createUser`,
`reviewData.requestReview(project_id, payload_json)`.

## Slice scope (v0 — no R2 upload, no Clerk yet)
- **Dashboard** (`/`): list projects (`listProjects`), "New project" form
  (`createUser` once + `createProject`).
- **Project** (`/projects/[id]`): live `getProjectStatus` + `getProjectFindings`
  via Convex `useQuery` (reactive — findings stream in as the council runs). A
  "Run sample review" button calls `requestReview` with the sample pack from
  `scripts/run-review.mjs` (factor the pack into a shared module).
- Findings rendered in the **atelier style** (reuse the `website/` tokens:
  Playfair/Inter/JetBrains, bone/ink/brass, `.sev` severity pills, `.source-quote`).
- The **locked disclaimer** in the footer of every page (spec 08).

Deferred to v1: Clerk auth (needs your keys), real file upload via R2 signed URLs
(needs an upload action + R2 keys), classification-confirmation UX, exports.

## File layout
```
src/app/
  layout.tsx            # html shell + ConvexProvider, atelier fonts
  providers.tsx         # "use client" ConvexReactClient(NEXT_PUBLIC_CONVEX_URL)
  globals.css           # atelier tokens (port from website/verifiq-system.css)
  page.tsx              # dashboard
  projects/[id]/page.tsx# status + findings (useQuery, reactive)
  _lib/sample-pack.ts   # shared sample RunInput (also used by run-review.mjs)
tsconfig.app.json       # Next's tsconfig (jsx, react/next types, includes src/app)
next.config.mjs         # typescript.tsconfigPath = "tsconfig.app.json"
```

## Keep the backend merge-gate green (important)
CI's `tsc --noEmit` uses root `tsconfig.json` with `include: ["src/**/*.ts", …]`
— that glob is `*.ts`, so it **never** picks up the app's `*.tsx`. To be fully
safe, also add `"src/app"` to the root tsconfig `exclude`. The Next app is typed
by its **own** `tsconfig.app.json` (pointed to via `next.config.mjs`
`typescript.tsconfigPath`) and validated by `next build` — so backend CI is
untouched no matter what the app contains.

## Deps to add
`next`, `react`, `react-dom`, `@types/react`, `@types/react-dom` (and later
`@clerk/nextjs`). `convex` is already a dependency; the app uses `convex/react`.

## Deploying it
The current Vercel project serves `verifiq26/website` (static marketing site). The
app is a **separate** deploy: a second Vercel project with **Root Directory =
`verifiq26`**, Framework **Next.js**, env `NEXT_PUBLIC_CONVEX_URL` (+ Clerk keys
later). Don't repoint the existing marketing-site project.

## Definition of done (slice)
Sign-in-less: open the app → create a project → click "Run sample review" → watch
findings appear live → numbers match `run-review.mjs`. Then layer Clerk + R2.
