# Sprint 1 Kickoff — for Claude Code

> **To start:** open a terminal in the project root, run `claude`, and type:
> **“Read docs/SPRINT-1-KICKOFF.md and begin Sprint 1. Work issue by issue, stop after GOV-71 for my review.”**

---

## Mission

Build the **platform primitives** for FMIQ — the substrate every later module depends on. Nothing user-facing this sprint; this is maximum risk reduction. Source of truth: `docs/PROJECT-PLAN.md` §5 and the Linear board (project *FMIQ — Phase 1*).

## Read first (do not skip)

- `app/CLAUDE.md` — engineering rules (non-negotiable).
- `app/CODEBASE.md` — the codebase map, conventions, gotchas, add-a-module recipe.
- `app/packages/api/db/migrations/001_init.sql` — existing schema, RLS pattern to copy.
- `app/packages/api/src/db/withTenant.ts` and `domain/collectionCare.ts` — the patterns to mirror.
- `docs/PROJECT-PLAN.md` §5 — the Sprint 1 stories with acceptance criteria.

## Non-negotiable rules (from app/CLAUDE.md)

1. All tenant data access goes through `withTenant(tenantId, fn)`. Never `pool.query()` tenant data directly.
2. Every new tenant table: `ENABLE` + `FORCE` RLS + `tenant_isolation` policy + `tenant_id` composite index + `GRANT` to `fmiq_app`, in the same migration. Reuse the `DO $$ FOREACH` block from `001_init.sql`.
3. Migrations are sequential and immutable — add `002_*`, `003_*`; never edit `001`. Keep `001_init.sql` and `001_init.dev.sql` in sync.
4. ESM import paths end in `.js` (NodeNext), even for `.ts` files.
5. Audit every state change to the append-only `core_audit_log`.
6. Logic-heavy work lives in `src/domain/*` as `(client, tenantId, …)` functions; mirror `collectionCare.ts`.
7. Run `npm run typecheck` and `npm run build` before declaring any story done. For DB work use `npm run db:reset`.

## Order of work (stop after GOV-71 for review)

**GOV-69 — RLS isolation test harness** *(do first; it protects everything after)*
- Add a test runner (vitest) + a CI-friendly Postgres (the embedded one via `npm run dev` infra, or Docker).
- Pattern: insert as tenant A via `withTenant(A)`, query as tenant B via `withTenant(B)`, assert **zero rows**.
- Cover every existing tenant table (`core_*`, `est_*`, `cc_*`, `wo_*`, `cmp_*`, `prj_*`).
- Document how to add a table → add a test.

**GOV-70 — migration `002_gate_engine.sql`**
- `gate_definition` (id, tenant_id, checks jsonb, mode, on_block, override_roles[]) and `wo_gate_check` (work_order_id, check_id, status, blocking_detail, checked_at, override_by, override_reason).
- Full RLS treatment per rule 2. Apply to both prod and dev migration variants. Extend GOV-69 tests to the new tables.

**GOV-71 — `domain/gateEngine.ts`**
- `GATE_REGISTRY` (task type → applicable checks), `evaluateGates(ctx, client) → {allPassed, results, blockedBy}`, `overrideGate(...)`.
- Each check queries the DB; a HARD block returns the first failing `blockMessage`; every evaluation + override writes to `core_audit_log`.
- Unit tests for every check (pass/fail) + override path, >90% branch coverage.

**⏸ CHECKPOINT — stop here, summarise, and wait for review before continuing.**

Then (next session): **GOV-72** `003_eventing.sql` + `domain/outbox.ts` (transactional outbox, `ON CONFLICT (idempotency_key) DO NOTHING`) → **GOV-73** outbox relay worker (`FOR UPDATE SKIP LOCKED`) → **GOV-74** CI pipeline (lint → typecheck → unit → RLS integration → build) → **GOV-75** repo hygiene (`.gitignore packages/api/.data/`, `git rm --cached` it) → **GOV-76** ADRs (gate engine + eventing).

## Definition of Done (every story)

Acceptance criteria met · `npm run typecheck` + `npm run build` green · RLS isolation test covers any new tenant table and passes · audit trail written for state changes · no `pool.query()` on tenant data outside `withTenant`.

## Do NOT

- Do not build module features (PPM, compliance, mobile) this sprint — primitives only.
- Do not introduce Convex patterns; this is Fastify + Postgres + RLS (see `app/CLAUDE.md` §2).
- Do not edit `001_init.sql`.
- Do not weaken tenant isolation or use a BYPASSRLS role on the request path.

## When done with the checkpoint

Post a short summary: what shipped, test results, and any decisions needed. Commit on a branch per issue (Linear suggests branch names like `liam/gov-70-...`).
