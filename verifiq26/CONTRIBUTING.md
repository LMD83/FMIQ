# Contributing to VerifIQ

## Branching & ownership of `main`

- `main` is **single-track**: one integrator owns it. No direct pushes.
- All work lands via **PR** onto a branch-protected `main` with the required
  `typecheck · lint · test` check (incl. the hygiene guard) green.
- Two AI build sessions run on separate branches; converge per
  [ADR-001](docs/ADR-001-canonical-review-stack.md) — never re-add a retired
  track (single-action `review.ts` dispatch, `src/classify/`,
  `convex-port.ts`, `cache-convex.ts`).

## Generated files

- Generated artefacts (the prompt bundle, Convex `_generated/`) follow ADR-001:
  **one** name, **one** export, produced by the committed script, **gitignored**
  and regenerated in CI. Either commit an artefact **or** generate it — never
  both, and never gitignored-but-imported.
- A file may not be both tracked and gitignored. A committed generated file is a
  defect. The hygiene guard (`npm run check:hygiene`) enforces this.

## Local build (mirror CI from a clean tree)

```sh
cd verifiq26
npm ci
npm run check:hygiene          # duplicate keys / tracked-ignored / committed artefacts
npm run codegen:stub           # writes gitignored src/convex/_generated/
npm run bundle:prompts         # writes gitignored src/agents/prompts.bundle.ts
npm run typecheck && npm run lint && npm test
```

To reproduce a true clean checkout (catches "works on my machine"):

```sh
rm -rf src/convex/_generated src/agents/prompts.bundle.ts
npm run codegen:stub && npm run bundle:prompts && npm run typecheck
```

## Merge checklist (paste into every PR)

- [ ] **Clean checkout builds:** wipe gitignored artefacts → run generators →
      `npm ci && npm run typecheck` passes.
- [ ] **No orphaned generated files; no phantom imports** — every import
      resolves to a tracked file; `npm run check:hygiene` is green.
- [ ] **`typecheck` clean · `lint` 0 errors · `vitest` green.**
- [ ] **No duplicate dir/file for one concern** (classify, review dispatch,
      prompt bundle) — one canonical path per ADR-001.
- [ ] **No duplicate `package.json` keys.**
- [ ] **Completion-doc claims match `git ls-files`** — if a doc says "removed
      X", X is actually gone. One phase = one completion doc.
- [ ] **Merged via PR** with all required checks green.
