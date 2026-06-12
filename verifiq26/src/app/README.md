# VerifIQ app (Next.js 14 App Router)

The self-serve slice (`docs/36-frontend-build-plan.md`): **create a project →
run a review → watch findings render live** against the Convex backend.

## What's here

```
src/app/
  layout.tsx              # html shell + ConvexProvider + locked disclaimer footer
  providers.tsx           # "use client" ConvexReactClient(NEXT_PUBLIC_CONVEX_URL)
  globals.css             # atelier tokens (Playfair/Inter/JetBrains, bone/ink/brass)
  page.tsx                # dashboard — project list + "New project" form
  projects/[id]/page.tsx  # live status + findings register (useQuery, reactive)
  _lib/sample-pack.ts     # shared sample RunInput + disclaimer + active-state set
```

Config lives at the project root: `tsconfig.app.json` (the app's own TS config,
pointed to by `next.config.mjs`) and `next.config.mjs`. The backend's root
`tsconfig.json` excludes `src/app`, so backend CI (`tsc --noEmit`) never compiles
the `.tsx` — the app is validated separately by `next build`.

## Running it locally

1. Provision Convex (see `docs/35-backend-provisioning-runbook.md`) and run
   `npx convex dev` so `src/convex/_generated/` exists.
2. Add the deployment URL to `.env.local`:
   ```
   NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
   ```
3. Install the app deps and start Next:
   ```
   npm install
   npx next dev
   ```
4. Open the app → create a project → open it → **Run sample review** → watch the
   findings stream in. The numbers should match `node scripts/run-review.mjs`.

## Deploying

A **separate** Vercel project (don't repoint the marketing-site project):
Root Directory = `verifiq26`, Framework = Next.js, env `NEXT_PUBLIC_CONVEX_URL`.

## Deferred (v1)

Clerk auth (keys needed), real R2 upload via signed URLs, the
classification-confirmation UX, and exports (PDF/DOCX/XLSX/CSV/JSON).
