# Deploying the VerifIQ marketing site

This folder is a **static website** — plain HTML + CSS, no build step. It's what
goes live on `www.verifiq.ie`. (The product app in `verifiq26/src/` is separate
and not part of this deploy.)

## What's here

| File | Page |
|---|---|
| `index.html` | Homepage — the front door |
| `hunt.html` | VerifIQ Hunt landing (contractors) |
| `dashboard.html` | Post-login product UI mockup |
| `dashboard-live.html` | "Atelier Console" live dashboard mockup |
| `three-products.html` | Plain-English portfolio explainer |
| `case-study-01.html` | 327-findings validation case study |
| `about.html` | About / pilot reviewer |
| `cad-library.html` | Design-system component library |
| `legal.html` | Legal notice / scope of the tool |
| `404.html` | Not-found page |
| `verifiq-system.css` / `verifiq-cad.css` | Shared stylesheets |

---

## Option A — Railway (container, what this repo is configured for)

The repo root has a `Dockerfile` + `Caddyfile` that serve this folder.

1. Go to **railway.app** → sign in with GitHub → **New Project → Deploy from GitHub repo** → pick `lmd83/fmiq`.
2. Railway detects the `Dockerfile` at the repo root and builds it. No env vars needed.
3. Once deployed, open **Settings → Networking → Generate Domain** to get a temporary `*.up.railway.app` URL and confirm the site loads.
4. **Custom domain:** Settings → Networking → **Custom Domain** → add `www.verifiq.ie`. Railway shows a `CNAME` target.
5. At your domain registrar (where you bought `verifiq.ie`), add that **CNAME** record for `www`. For the bare `verifiq.ie`, add a redirect to `www` (most registrars offer URL forwarding), or a second custom domain in Railway.
6. HTTPS is issued automatically. Live in a few minutes.

> Note: Railway runs a container 24/7, so it bills usage even for a static site.
> For a pure marketing site, Option B is cheaper/simpler — and this folder works
> there unchanged.

## Option B — Vercel / Cloudflare Pages / Netlify (static, recommended for a marketing site)

Free, automatic HTTPS, built for static sites. Same folder, no Docker.

**Vercel:** vercel.com → Import `lmd83/fmiq` → set **Root Directory** to
`verifiq26/website`, Framework preset **Other**, leave build command empty,
output directory `.` → Deploy. Then **Settings → Domains → add `verifiq.ie`
and `www.verifiq.ie`** and copy the DNS records it gives you to your registrar.

**Cloudflare Pages / Netlify:** same idea — connect the repo, set the root/output
directory to `verifiq26/website`, no build command.

---

## Test it locally first

```bash
# from repo root, with Docker:
docker build -t verifiq-site . && docker run --rm -e PORT=8080 -p 8080:8080 verifiq-site
# open http://localhost:8080

# or, no Docker — just serve the folder:
cd verifiq26/website && python3 -m http.server 8080
# open http://localhost:8080
```

## After it's live

- **Wire the magic-code intake (docs/42).** The "Start your First Read" /
  "Request the brief" forms POST to the Convex `/intake` endpoint, which creates
  the project and emails the customer a secure, single-use upload link. Point the
  site at your deployment by setting the endpoint URL in **one** place per
  surface:
  - `first-read.html` — set `window.VERIFIQ_INTAKE_ENDPOINT` (and optionally the
    Stripe `window.VERIFIQ_FIRST_READ_URL`) in the inline `<script>` at the top.
  - everything else (`three-products.html`, etc., via `verifiq-atelier.js`) —
    set `INTAKE_ENDPOINT` at the top of `verifiq-atelier.js`, or define
    `window.VERIFIQ_INTAKE_ENDPOINT` before that script loads.

  The URL looks like `https://<your-convex-deployment>.convex.site/intake`.
  Until it's set, the forms fall back to a pre-filled mail to `liam@goviq.ie`
  (so nothing breaks pre-launch). The endpoint needs `UPLOAD_TOKEN_PEPPER`,
  `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL` and `INTAKE_ALLOWED_ORIGIN`
  (the live site origin) set on the Convex deployment — see
  `verifiq26/.env.local.example`.
- `dashboard.html` / `dashboard-live.html` are **mockups** — they show the
  product UI but aren't wired to the real engine. Keep or unlink from nav as you
  prefer before a public launch.
