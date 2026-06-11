# CLAUDE.md — FMIQ `app/` codebase (engineering)

> Engineering working rules for anyone (human or agent) writing code in `app/`. **Read `app/CODEBASE.md` first** — it is the full map. This file is the short list of rules that must hold on every change.
>
> Scope: this is the **codebase** CLAUDE.md. The **strategic/project** CLAUDE.md is at the repo root (`../CLAUDE.md`) — read that for the commercial context, the NMI/PMC situation, and the "no-bespoke" eligibility tension. Don't duplicate it here.

## 1. What this is

FMIQ is a multi-tenant **IWMS product** by GovIQ — Postgres/Azure/Fastify/React. The platform spine (RLS multi-tenancy, Entra auth, audit) and the **collection-care excursion loop** are built; every other operations module is planned in `../docs/FMIQ-master-build-plan.md`. Build toward an **off-the-shelf, configuration-driven product**, never a bespoke-for-NMI fork.

## 2. Relationship to GovIQ — do not copy its stack

FMIQ is part of the GovIQ family and shares its **governance DNA**: Entra ID auth, audit-on-every-write, the public-sector domain (CWMF/OGP/BCAR/HSA), EU data residency. **It does NOT share GovIQ's stack.** GovIQ is Convex; FMIQ is **Postgres + RLS + Azure + Fastify** (`../docs/architecture-adr.md` rejected Convex for residency). Never bring Convex patterns (`convex/`, workpools, `ctx.auth.getUserIdentity()`, `sp_*/gov_*` tables) into this codebase.

## 3. Non-negotiable rules

1. **Tenant data only through `withTenant(tenantId, fn)`.** RLS reads `app.current_tenant`; a raw `pool.query()` for tenant data either returns nothing or risks a leak. No exceptions.
2. **Never weaken tenant isolation.** App connects as the least-privilege `fmiq_app` role. Never use a superuser/`BYPASSRLS` role on the request path. Every new tenant table gets `ENABLE`+`FORCE` RLS + `tenant_isolation` policy + `tenant_id` index + `GRANT`, in the same migration.
3. **Audit every state change** to the append-only `core_audit_log` (who/what/when/before/after). Don't try to update or delete audit rows.
4. **Migrations are sequential and immutable.** Never edit `001_init.sql`; add `002_*`, `003_*`. Keep `001_init.sql` and `001_init.dev.sql` in sync.
5. **Validate input with zod** at the route boundary; logic-heavy work goes in `domain/` as `(client, tenantId, …)` functions (mirror `domain/collectionCare.ts`); role-gate writes with `requireRole(...)`.
6. **ESM import paths end in `.js`** (NodeNext), even for `.ts` files.
7. **`DEV_NO_AUTH` must be `false`** anywhere deployed — it bypasses Entra and injects a dev identity.
8. **Accessibility is a requirement, not a nice-to-have** — web changes hold WCAG 2.2 AA: status by text+icon (never colour alone), keyboard-operable, ARIA live regions for alerts, bilingual-ready (EN/GA). See `../docs/design-system.md`.

## 4. How to work

- **Adding a module?** Follow the recipe in `CODEBASE.md` §8 (migration → domain → routes → register in `server.ts` → types → tests). Build the platform primitives (gate engine, eventing/outbox) before the features that depend on them (`../docs/FMIQ-master-build-plan.md` §3, §9).
- **Definition of Done** for any non-trivial change: typechecks; **RLS isolation test** (two tenants, tenant B sees zero of tenant A's rows); audit trail written; input validated; new endpoint mirrored in `web/src/api.ts`; accessibility check for UI. RLS isolation tests are the single highest-value test in this codebase — write them.
- **Verify, don't assume.** Run `npm run typecheck` and `npm run build`. For DB work use `npm run db:reset` against the embedded Postgres.
- **Be a ruthless engineering partner** (per root CLAUDE.md): if a change isn't shippable, scalable, or testable, say so and fix it. No hype, no theoretical features, MVP discipline.

## 5. Commands

`npm run dev` (Postgres + API + web) · `npm run db:reset` · `npm run typecheck` · `npm run build`. Full list and gotchas in `CODEBASE.md` §9 and §7.
