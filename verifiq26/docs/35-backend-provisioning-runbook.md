# Stage 1 — Provision the VerifIQ backend (runbook)

The backend **code** is complete and green (typecheck / lint / 33 tests all pass).
This runbook stands up the **live** backend. These steps need your accounts and a
browser login, so they're yours to run locally — they can't be done from CI.

> **Key nuance:** the review pipeline (`src/convex/review.ts`) runs **inside
> Convex**, and reads provider/storage keys from the environment. So the API keys
> go in the **Convex deployment environment** (`npx convex env set …`), *not* in
> `.env.local`. `.env.local` only holds the Convex URL (and later the frontend
> Clerk key).

---

## 0. Prerequisites
- Node.js 20+ installed, this repo cloned locally.
- Accounts you'll create below: **Convex**, **Anthropic**, **OpenAI**,
  **Cloudflare** (R2). (Clerk/Stripe come with the frontend later.)
- A card on the Anthropic + OpenAI accounts — inference is pay-per-use.

```bash
cd verifiq26
npm install
npm run bundle:prompts   # required before any deploy: src/convex/review.ts
                         # imports the gitignored prompts.generated.ts
```

> **One-command alternative:** `bash scripts/go-live.sh` runs this whole
> runbook (stages 1–4, R2 optional) and finishes with a live council run.

## 1. Convex deployment
```bash
npx convex dev
```
First run: opens a browser → log in / create a Convex account → create a project
(call it `verifiq`). Convex then:
- writes `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL` into `.env.local` for you,
- generates `src/convex/_generated/`,
- pushes the schema (documents, findings, `workflow_state`, `inference_cache`,
  audit log, …) and functions, and starts watching.

Leave it running in this terminal. (Pick an **EU** region when prompted, to match
the GDPR/EU-residency decision.)

## 2. Provider keys → set in the CONVEX environment
Anthropic (primary): https://console.anthropic.com → **API keys** → create.
```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-xxxxx
```
OpenAI (fallback / peer challenge): https://platform.openai.com → **API keys**.
```bash
npx convex env set OPENAI_API_KEY sk-xxxxx
```

## 3. Cloudflare R2 (file storage, EU)
Cloudflare dashboard → **R2**:
1. **Create bucket** `verifiq-prod-eu-west` (choose an **EU** jurisdiction).
2. **Manage R2 API Tokens** → create a token with **Object Read & Write** — it
   gives you an Access Key ID, a Secret Access Key, and your Account ID.

```bash
npx convex env set R2_ACCOUNT_ID        <account-id>
npx convex env set R2_ACCESS_KEY_ID     <access-key-id>
npx convex env set R2_SECRET_ACCESS_KEY <secret>
npx convex env set R2_BUCKET_NAME       verifiq-prod-eu-west
npx convex env set R2_PUBLIC_URL        https://<your-r2-public-host>
```

## 4. Verify it's live
```bash
npx convex env list          # shows ANTHROPIC_/OPENAI_/R2_ keys are set
```
- Convex **dashboard → Data**: the tables from the schema are deployed.
- Convex **dashboard → Logs**: watch here when the first review runs.
- The "verify locally" gates (per docs/28): a real Anthropic call succeeds, the
  OpenAI failover path works, and an R2 signed upload URL works.

> There's no public "start a review" button yet — the only public entry is
> `reviewData.requestReview` (ownership-checked), and there's no frontend to call
> it. That's **Stage 2** (the Next.js app). Until then you can exercise the
> pipeline from the Convex dashboard or a small seed script.

## 5. Costs (rough)
- **Convex** — free tier is fine for dev.
- **Cloudflare R2** — generous free tier; zero egress.
- **Anthropic + OpenAI** — pay-per-use; set a low monthly cap while testing.

---

## What's NOT done yet (Stage 2)
- **No frontend app** — `src/app/` is an empty placeholder; there's no
  `next.config`. The Next.js 14 app (upload a pack → confirm classification →
  see the review → export) is the next build.
- **Auth not wired** — Clerk is stubbed; `requestReview` only enforces ownership
  when a Clerk identity is present. Wire Clerk before any public use.
- Phase-6 items from CLAUDE.md: concrete PDF render/extract adapters, tus.io
  resumable upload, exports (PDF/DOCX/XLSX/CSV/JSON), classification-confirmation
  UX, and the authed public "start review" entry.
