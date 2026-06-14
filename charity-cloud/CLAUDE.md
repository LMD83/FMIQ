# Charity Cloud

Demand-led, hyperlocal in-kind giving platform (Ireland). Charities post specific
verified needs on behalf of clients; donors within ~5km offer the item; handover at
neutral points. Requesters are pseudonymous end-to-end. Goods only — no money, no food.

## Source of truth
- docs/04-prd-mvp.md — requirements F1–F14, workflows W1–W6, data model
- docs/05-architecture.md — Convex schema, geo design, privacy enforcement, ADRs
- docs/03-gdpr-data-protection.md — privacy rules that override convenience
- docs/02-regulatory-compliance.md — banned categories, DSA moderation duties
If code and docs conflict, stop and ask. (Note: the docs/ pack was not present in
this repo when the MVP was built — the schema/rules below were reconstructed from
docs/08-build-script.md. Reconcile against the canonical pack when it lands.)

## Stack
Convex (EU deployment) + React (Vite, TS) + Node.js edge services.
Auth: Convex Auth (email/password in the MVP; magic-link only is the target — see
docs/ROADMAP-WEEKEND.md). No social login.
UI: Tailwind v4 (shadcn/ui is a roadmap upgrade). Shared types/taxonomy/geo in packages/shared.

## Non-negotiable privacy rules (enforced in code, not policy)
1. NEVER persist addresses or full Eircodes. Geocode transiently → snap to
   geohash-5 cell → discard input. (MVP: `packages/shared/src/geo-ie.ts` resolves a
   routing key to a coarse cell+label without any external call.)
2. Public queries return explicit DTOs only — never raw docs. `needs.privateNote`,
   `postedByUserId`, and org linkage never leave the server. Every public DTO has a
   snapshot test asserting its exact field set (`tests/privacy.test.ts`).
3. identityVault is touched only by internal.* functions (`convex/vault.ts`); every
   read writes auditLog.
4. PPSN: never collect, never store. Rejected/redacted in every free-text field.
5. All requester-content tables (needs, messages) carry ttlAt; hourly cron purges
   (`convex/retention.ts` + `convex/crons.ts`).
6. needs.publish requires a live consents row; consent withdrawal cascades to unpublish.
7. Chat mutations run PII regexes (Eircode, IE phone) → flag + warn sender + enqueue
   for moderation (`convex/messages.ts`, `packages/shared/src/pii.ts`).
8. Banned categories are a whitelist check at the mutation layer, not just UI
   (`convex/lib/guards.ts` + the taxonomy in `packages/shared`).
9. Donor-visible distance is only the area label + "within ~5km" — never exact distance.
10. Every mutation/query begins with requireRole(ctx, ...) (`convex/lib/rbac.ts`).

## Conventions
- Trunk-based; small PRs; conventional commits.
- Definition of done: tests + (roadmap) WCAG 2.1 AA check on new UI + analytics event wired.
- Taxonomy is versioned data in packages/shared — single source for FE and BE.
- Tests: vitest. Priority order: DTO redaction snapshots, geo neighbour math, TTL cron,
  consent gating, RBAC matrix. All in `tests/`.
- Accessibility is a P0 product feature (user base skews assistive-tech).

## Build & run (local, offline-friendly)
This repo runs Convex's **anonymous local backend** (no account). The CLI's version
endpoint (`version.convex.dev`) is blocked in some sandboxes, so a tiny preload shim
answers only that call with a pinned backend release; everything else is normal.

```bash
npm install
# start the backend (writes .env.local, pushes schema, generates convex/_generated):
NODE_OPTIONS="--require ./scripts/convex-version-shim.cjs" CONVEX_AGENT_MODE=anonymous \
  npx convex dev --local-backend-version precompiled-2026-06-09-b6aaa1a
npm run seed         # 2 orgs, handover points, 6 role invites
npm run dev          # Vite on :5173
npm test             # 35 unit/integration tests (convex-test)
npm run smoke        # live golden-path W1→W4 against the running backend
```

Seeded role invites (sign up with these emails to claim the role): `ops@demo.ie`
(platformOps), `mod@demo.ie` (moderator), `admin@simon.demo.ie` / `cw@simon.demo.ie`
(orgAdmin/caseworker), plus the Brigid's pair. Any other email becomes a donor.

## Status
MVP complete through the golden path (W1 onboarding → W2 need loop + moderation →
W3 match + chat → W4 fulfilment + retention). Hardening, real auth, email, exports,
and the EU-hosted geocoder are scoped in docs/ROADMAP-WEEKEND.md.

## Things to never do
- Add a map view, exact distances, or social login without asking.
- Describe the platform as "a charity" in any UI copy (s.46 Charities Act — criminal).
- Add free-text category fields or diagnosis/condition fields.
- Store IDV document images or vetting documents.
