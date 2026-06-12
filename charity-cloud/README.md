# Charity Cloud

Demand-led, hyperlocal in-kind giving for Ireland. Charities post **specific
verified needs** on behalf of pseudonymous clients; donors within **~5km** offer
the item; handover happens at a **neutral point**. Goods only — no money, no food.
Privacy is enforced in code, not policy.

> Built as a working MVP: the full golden path (charity onboarding → need loop →
> match → fulfilment), 10 privacy invariants in code, 35 tests, and a live
> end-to-end smoke test. See [`docs/ROADMAP-WEEKEND.md`](docs/ROADMAP-WEEKEND.md)
> for the path to a pilot-ready product.

## Quick start

```bash
npm install

# 1. Start the local Convex backend (anonymous mode, no account needed).
#    The shim answers the (sandbox-blocked) version endpoint with a pinned release.
NODE_OPTIONS="--require ./scripts/convex-version-shim.cjs" CONVEX_AGENT_MODE=anonymous \
  npx convex dev --local-backend-version precompiled-2026-06-09-b6aaa1a

# 2. In another shell: seed demo data and start the web app.
npm run seed
npm run dev            # http://localhost:5173
```

Sign up with a seeded invite email to get that role — e.g. `cw@simon.demo.ie`
(caseworker), `mod@demo.ie` (moderator), `ops@demo.ie` (platform ops). Any other
email becomes a **donor** (give it a Dublin routing key like `D08` so you see needs).

## Verify it works

```bash
npm test         # 35 unit + integration tests (convex-test, real identities)
npm run smoke    # live golden-path W1→W4 against the running backend
npm run build    # production build
```

## Architecture

- **`convex/`** — backend. Functions per workflow (`needs`, `offers`, `matches`,
  `messages`, `moderation`, `orgs`, `users`), `lib/` (rbac, dto, guards), `vault.ts`
  (internal-only identity vault), `retention.ts` + `crons.ts` (TTL purge), `smoke.ts`
  (live golden-path orchestrator).
- **`packages/shared/`** — single source of truth for the need taxonomy, geohash
  utilities, the Irish routing-key→area resolver, and PII regexes. Used by both
  frontend and backend.
- **`src/`** — React app, role-routed: donor feed/offers/chat, charity console,
  moderation queue, ops console.

## Privacy model (the 10 rules)

No addresses or full Eircodes are ever stored — locations are coarse geohash-5
cells. Public queries return explicit redacted DTOs (snapshot-tested). The identity
vault is internal-only and audited. PPSNs are never stored. Requester content is
TTL-purged hourly. Chat is PII-scanned. Categories are whitelisted at the mutation
layer. Donors only ever see "within ~5km" — never a distance or a map. Every
function is RBAC-guarded. See [`CLAUDE.md`](CLAUDE.md) for the enforced list.
