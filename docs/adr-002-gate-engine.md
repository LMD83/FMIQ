# ADR-002 — Gate engine (shared readiness / approval gates)

**Status:** Accepted (2026-06-08) · **Decision owner:** Liam / GovIQ · **Implements:** `FMIQ-master-build-plan.md` §3.2, §5; Sprint 1 GOV-70/71.

## Context

Two of FMIQ's design laws are *"no paperwork, no work"* (the system **blocks**, it does not warn) and a defensible-to-HSA audit trail. Multiple modules need the same machinery: the **SSoW Readiness Gate** blocks a work order from starting until RAMS/permit/competency/insurance/parts/pre-task/keys are all green; the **value-band approval chains** block a requisition until the right roles have signed. Building gate logic separately in each module would duplicate the hardest, highest-liability code and drift.

We need one reusable evaluator, available before the modules that depend on it (it is on the critical path — `PROJECT-PLAN.md` §9).

## Decision

A single gate engine: **configuration as data, checks as code.**

- **`gate_definition`** (per tenant, `002_gate_engine`) holds gate *config*: `mode` (`ALL`/`ANY`), `on_block` (`HARD`/`SOFT`), `override_roles[]`, `active`. Tenants can tune a gate without code.
- **`GATE_REGISTRY`** (in `src/domain/gateEngine.ts`) maps a gate code → an ordered list of **check implementations**. Each check is `(client, tenantId, ctx) → {passed, detail}` and queries the DB. Modules declare which checks apply; they never embed gate logic.
- **`evaluateGates(client, tenantId, ctx)`** runs the checks, writes a per-check snapshot to **`wo_gate_check`**, appends a `gate.evaluated` / `gate.blocked` entry to the append-only `core_audit_log`, and returns `{ allPassed, satisfied, blocked, results, blockedBy, firstBlockMessage }`. `blocked = on_block==='HARD' && !satisfied`.
- **`overrideGate(...)`** requires a role in `override_roles` (else the platform default `SystemAdmin/TenantAdmin/FacilitiesManager`) **and** a non-empty reason, records `override` snapshots + a `gate.overridden` audit entry. No silent overrides.
- Defaults when no `gate_definition` row exists: `ALL` / `HARD` / default override roles — so a gate works the moment its checks are registered.

The engine mirrors `domain/collectionCare.ts`: pure-ish `(client, tenantId, …)` functions run inside a `withTenant` transaction. The WO state machine (`PATCH /api/v1/work-orders/:id/status`, future) calls `evaluateGates` before allowing `in_progress` and returns 409 with `firstBlockMessage` when blocked.

## Consequences

- **Adding a check** = one entry in `GATE_REGISTRY` (testable in isolation). **Adding/тuning a gate** = a `gate_definition` row (no deploy). This is the "configuration, not code" discipline (CLAUDE.md §2) applied to safety gates.
- `wo_gate_check` is the per-check evidence record served to HSA/FOI alongside `core_audit_log`.
- Sprint 1 ships four checks against today's schema (work-order existence/status/assignment, contractor insurance currency). The full SSoW checks (RAMS approved, permit active, competency valid, parts reserved, pre-task done, keys signed) plug in as `hs_*`/`inv_*` land — the engine does not change.
- Snapshots are skipped when the work order row is absent (FK on `wo_gate_check`); the evaluation is still audited.
- Unit tested to >90% branch coverage (every check pass/fail, override allowed/forbidden/no-reason, ANY/SOFT config, unknown gate).

## Alternatives considered

- **Fully declarative checks** (interpret a jsonb spec like `ENTITY_FIELD`/`LINKED_RECORD`): more flexible but harder to test and premature for Sprint 1. `gate_definition.checks jsonb` is reserved for this if needed; today checks are code.
- **Gate logic embedded per module:** rejected — duplicates the highest-liability code and drifts.
- **A rules engine dependency:** rejected — overkill; a registry + SQL checks is simpler and fully under our audit control.
