#!/usr/bin/env bash
# VerifIQ — one-command backend go-live (docs/35 runbook, automated).
#
# Run from verifiq26/:   bash scripts/go-live.sh
#
# Stages:
#   1. toolchain + install + prompt bundle (required before any deploy:
#      src/convex/review.ts imports the gitignored prompts.generated.ts)
#   2. Convex provision/push (first run opens a browser to log in; pick an
#      EU region; project name suggestion: verifiq)
#   3. provider keys → the CONVEX deployment environment (the pipeline runs
#      inside Convex; .env.local only carries the deployment URL)
#   4. verify: env list + a live end-to-end council run (run-review.mjs)
#
# R2 keys are optional for today's test — the sample pack is inline text and
# never touches object storage. Set R2_* later for real uploads.

set -euo pipefail
cd "$(dirname "$0")/.."

say()  { printf '\n\033[1m── %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1"; exit 1; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }

# ── Stage 1 · toolchain ──────────────────────────────────────────────────────
say "Stage 1 · toolchain + dependencies + prompt bundle"
command -v node >/dev/null || fail "Node.js not found (need >= 20)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node $NODE_MAJOR found — need >= 20"
ok "node $(node -v)"
npm install
npm run bundle:prompts
ok "dependencies installed, prompts bundled"

# ── Stage 2 · Convex deployment ─────────────────────────────────────────────
say "Stage 2 · Convex provision + schema/function push"
echo "First run: a browser opens to log in / create the project (suggest:"
echo "'verifiq', EU region). This writes .env.local and pushes everything."
npx convex dev --once
grep -q "NEXT_PUBLIC_CONVEX_URL" .env.local 2>/dev/null \
  || fail ".env.local has no NEXT_PUBLIC_CONVEX_URL — provisioning did not complete"
ok "deployment live: $(grep '^NEXT_PUBLIC_CONVEX_URL=' .env.local | cut -d= -f2)"

# ── Stage 3 · provider keys into the Convex environment ─────────────────────
say "Stage 3 · provider keys → Convex deployment env"
set_key() {
  local name="$1" current
  current="$(npx convex env get "$name" 2>/dev/null || true)"
  if [ -n "$current" ]; then ok "$name already set"; return; fi
  if [ -n "${!name:-}" ]; then
    npx convex env set "$name" "${!name}"; ok "$name set from shell env"; return
  fi
  read -r -s -p "Enter $name (input hidden): " value; echo
  [ -n "$value" ] || fail "$name is required for the council to run"
  npx convex env set "$name" "$value"; ok "$name set"
}
set_key ANTHROPIC_API_KEY
set_key OPENAI_API_KEY
for r2 in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_PUBLIC_URL; do
  if [ -n "${!r2:-}" ]; then npx convex env set "$r2" "${!r2}"; ok "$r2 set"; fi
done
echo "(R2_* not required for today's text-pack test — set later for uploads.)"

# ── Stage 4 · verify live ────────────────────────────────────────────────────
say "Stage 4 · verification"
npx convex env list
echo
echo "Dispatching a real council run (live model calls — costs a few cents)…"
node scripts/run-review.mjs
ok "backend is live — full register: Convex dashboard → Data → findings"
