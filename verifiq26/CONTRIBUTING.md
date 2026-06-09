# Contributing to VerifIQ

## Branching & ownership of `main`

- `main` is **single-track**: one integrator owns it. No direct pushes; all work
  lands via PR with the `typecheck · lint · test` check (incl. the hygiene guard)
  green.
- Converge on the canonical stack in
  [ADR-001](docs/ADR-001-canonical-review-stack.md) — the **review-dispatch**
  stack. Never re-add the retired queue-runner stack or a second classifier /
  prompt-bundle.

## Generated files

- Generated artefacts (Convex `_generated/`, the prompt bundle) are **gitignored
  and regenerated** (`npm run codegen:stub`, `npm run bundle:prompts`) — never
  committed. A file may not be both tracked and gitignored. The hygiene guard
  (`npm run check:hygiene`) enforces this.

## Local build (mirror CI from a clean tree)

```sh
cd verifiq26
npm ci
npm run check:hygiene
npm run codegen:stub        # gitignored src/convex/_generated/
npm run bundle:prompts      # gitignored src/agents/prompts.generated.ts
npm run typecheck && npm run lint && npm test
```

Reproduce a true clean checkout (catches "works on my machine"):

```sh
rm -rf src/convex/_generated src/agents/prompts.generated.ts
npm run codegen:stub && npm run bundle:prompts && npm run typecheck
```

## Merge checklist (paste into every PR)

- [ ] Clean checkout builds (wipe gitignored artefacts → regenerate → `npm ci && npm run typecheck`).
- [ ] `npm run check:hygiene` green; no orphaned generated files; no phantom imports.
- [ ] `typecheck` clean · `lint` 0 · `vitest` green.
- [ ] No duplicate dir/file for one concern (classify, review dispatch, prompt bundle).
- [ ] No new public Convex data mutation without auth.
- [ ] Completion-doc claims match `git ls-files`; one phase = one completion doc.
- [ ] Merged via PR with all required checks green.
