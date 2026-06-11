# VerifIQ — Implementation Review Council

**Doc ID:** `verifiq-implementation-review-v0.1`  
**Status:** Independent review of the build plan · Strategic position paper for founder + board  
**Purpose:** Tear the build plan apart from the perspective of project managers, designers, developers, the Convex platform expert, the product owner / manager and the lead engineer — then have an independent auditor adversarially review the council itself. Identify bottlenecks. Solve the upload-capacity problem. Solve the drawing-naming heterogeneity. Offer an ISO 19650 standardisation pathway. Surface features we should be considering.  
**Format:** 9 voices, each with a defined remit. Final decision matrix. Single-sentence summary.  
**Date:** 2026-06-01

---

## The frame

The build plan to date covers: product positioning (Docs 12–15), legal posture (13), pricing (14), shoestring operating frame (15), solo-reviewer phase (16), full action backlog (17), email + sales + compliance + GTM + finance (18–24), and a 20-file Codex/Claude Code-ready prompt pack (`verifiq-prompts/01–19`).

What the plan does NOT yet cover with technical confidence:

1. Can we ingest **600 PDFs averaging 25 MB each** without the upload failing?
2. Can we **classify drawings whose filenames range from `A-101_RevB.pdf` to `24001-ARCH-100-revB-FINAL-USE-THIS.pdf`** without false-routing them to the wrong discipline?
3. Should we **offer customers ISO 19650 standardisation** of their pack as a side benefit — and if so, how?
4. What **second-order features** are we missing that would make the product worth 2× the price?

The council below pressure-tests these and the wider build.

---

## The Council

1. **Project Manager (Chair)** — programme, dependencies, critical path
2. **UX Designer** — upload flows, mental models, error states
3. **UI Designer** — visual register, brand coherence, component decisions
4. **Frontend Developer** — Next.js 14, edge functions, performance
5. **Backend Developer** — Convex schema, mutations, actions, jobs
6. **Convex Platform Expert** — file storage limits, file streaming, scheduled jobs, reactive query cost
7. **Product Owner** — feature prioritisation, what to build / when / what NEVER
8. **Lead Engineer** — system architecture, deployment, observability
9. **Independent Auditor** — tears holes in the other eight; adversarial review

Each voice answers two questions: *(a) what bottleneck or risk does my discipline see in the current plan? (b) what specific change or addition would I make?*

---

## I · Project Manager (Chair)

**Remit:** programme, dependencies, critical path, "is this shippable in the time we have."

**Position:**

The MVP scope in `verifiq-prompts/12_mvp_scope.md` and the issuance plan in `16_issuance_commands.md` is 7 phases over ~1 week of Claude Code time, then 3–6 weeks of integration and reviewer-panel hand-checks. **This is not a programme. It is a wish.**

Realistic MVP from a programme-management perspective:

| Week | Phase | Owner | Risk |
|---|---|---|---|
| 1 | Phase 1 (schema) + Phase 2 (LLM adapter) | Claude Code + Liam | Low — known patterns |
| 2 | Phase 3 (six MVP agents) + self-check protocol | Claude Code + Liam | Medium — agent calibration takes more passes than expected |
| 3 | Phase 4 (workflow orchestration) | Claude Code + Liam | High — Convex actions vs scheduled jobs vs queueing not yet decided |
| 4 | Phase 5 (peer challenge) + Phase 6 (council chair + exports) | Claude Code + Liam | Medium |
| 5 | Phase 7 (UI) | Claude Code + Liam | Medium |
| 6 | Phase 8 (feedback loop) + end-to-end on validation pack | Liam | High — first integration of all components |
| 7 | First chartered reviewer hand-test on validation pack | Liam + reviewer panel chair | Medium |
| 8 | First paid pack from a friendly customer | Liam | Critical gate |

That is **8 weeks**, not 1 week, and assumes Liam is full-time on this and the reviewer panel chair commits 5 hours per week during weeks 7–8. With realistic interruptions (sales calls, fundraise prep, legal back-and-forth) it slips to 10–12 weeks.

**My recommendation:** publicly commit to *"first paid pack in 12 weeks from kick-off"* and structure the personal calendar around that. Move EI HPSU application + solicitor brief into week 1 alongside Phase 1.

**The critical-path dependency the plan understates:** the chartered reviewer panel-chair conversation. The MVP cannot launch a paid pack without one chartered eye reading the output. If that conversation slips past week 4, the entire end-game slips with it. **Book the conversation this week.**

---

## II · UX Designer

**Remit:** upload flows, mental models, error states, customer trust at each step.

**Position:**

The upload flow as currently described in the prompt pack is: *"magic-link upload, ZIP per discipline gate, SHA-256 hash, file manifest."* That is a backend description. It is not a UX flow.

**The actual upload flow needs to support:**

1. A QS who works in Excel and Word and has never zipped a file in her life.
2. An architect who has a Dropbox link to 487 drawings in a folder structure of his own design.
3. A junior technician who was told "send the pack to VerifIQ" and is now staring at the brief request page.
4. A practice principal who wants to upload from his iPhone in a taxi.

**Recommended upload flow:**

```
1. Customer requests brief → magic-link email arrives.
2. Click link → land on "Upload your pack" page.
3. Three options on screen:
     (a) Drag a folder, OR
     (b) Drag a ZIP, OR
     (c) Connect from Dropbox / OneDrive / SharePoint / iCloud (Phase 2)
4. Files appear in a single staging table — uncategorised, hashes computing.
5. Auto-classifier runs in the background; tags each file by discipline + type.
6. Customer sees a "review the classification" screen — confirm or correct each file's discipline.
7. Confirm → scan starts. Customer can leave the tab.
8. Email arrives when results are ready.
```

The "review the classification" step is the single most important UX in the whole product. It builds trust ("I can see what you think each file is, and correct it") AND it gives us our most valuable training data (every correction is a labelled example).

**Error states to design for:**

- File exceeds size limit (and explain why).
- Hash matches a prior tenant's pack (and prompt: "have you uploaded this somewhere before?").
- Discipline classification confidence is low (and ask for help).
- A discipline has zero files (and prompt: "are you actually missing M&E, or did you forget the M&E ZIP?").
- Upload fails mid-stream (and resume from the last good byte).

**My bottleneck flag:** the design team cannot be the upload bottleneck. Anyone who uses Box or Dropbox daily expects to drag a folder and walk away. Anything less than that loses them in the first minute.

---

## III · UI Designer

**Remit:** visual register, brand coherence, component decisions, especially around live state during long-running scans.

**Position:**

The bone-paper engineering register (parent repo's `verifiq-system.css` + `verifiq-cad.css`) is strong. It survives the customer test of "does this look like a chartered service or a B2B SaaS startup." Keep it.

**Where the current design surface is incomplete:**

1. **Long-running scan progress.** A pack takes 24–48 hours to scan. The customer cannot stare at the page. We need a state model: pending → uploading → classifying → scanning → reviewing → released — each with a visual + an email at transition. The dashboard-live.html mockup is the right direction but needs to be wired to real state.
2. **Discipline classification confirmation screen.** New — doesn't exist yet. This is the UX-critical step from voice II.
3. **Findings viewer with rejection-feedback drop-down.** Per `14_feedback_taxonomy.md`, every finding must be inspectable and feedback-able. The current findings list in `scan-result-free.html` shows the look but not the interaction.
4. **Audit log viewer.** The reviewer-signed audit log is the customer's primary trust artefact. It should be a first-class screen, not a download.
5. **Comparison view.** When Rev B comes in, customers need to see what changed since Rev A — both in the documents and in the findings register. This is a high-value Phase 2 feature.

**Visual register principle to lock:** the product surface looks like a working drawing. The dashboard does NOT look like a SaaS analytics tool. The findings register does NOT look like a Jira board. If a chartered architect cannot scan the surface and immediately understand what they're looking at, we've lost.

**My recommendation:** before any code in Phase 7, build paper prototypes (Figma or hand-sketched) of the 11 screens. Have the reviewer panel chair walk through them and confirm "this reads like a working drawing." Without that gate, Phase 7 ships a competent generic UI that wins no chartered designer's trust.

---

## IV · Frontend Developer

**Remit:** Next.js 14 (App Router), edge functions, browser performance, especially for large multi-file uploads.

**Position:**

The plan assumes upload via the browser's standard `<input type="file" multiple>` flow. **This will not work at scale.**

**Browser upload realities for our pack profile:**

- Typical Tier III pack: 600 files × average 25 MB = **15 GB total**.
- Browser memory limit during upload: typically 2 GB before tabs crash.
- Network reliability: a 4G mobile upload of 15 GB takes 8+ hours and fails half the time at the carrier level.
- Even on fixed broadband: a single dropped packet on a 12-hour upload kills the session.

**The right upload architecture:**

1. **Resumable / chunked upload protocol.** Use the [tus.io](https://tus.io) open protocol. Browser uploads files in 5 MB chunks; if the connection drops, it resumes from the last good chunk. Industry standard for this pack size.
2. **Direct-to-storage signed URLs.** Browser uploads directly to Convex file storage (or S3-compatible if Convex's limits bind) — NOT through our Next.js server. This bypasses Vercel's serverless function payload limit (4.5 MB by default) and Convex's own per-mutation payload limit.
3. **Parallel-but-bounded.** Upload up to 6 files in parallel (matches HTTP/2 connection limits in most browsers); queue the rest.
4. **Background upload via Service Worker.** Customer closes the tab? The Service Worker keeps uploading. When they reopen, state is preserved in IndexedDB.
5. **Integrity check on completion.** Every uploaded file has its SHA-256 hash computed client-side and verified server-side. Any mismatch triggers re-upload of that specific file.

**Implementation cost:** ~2 weeks of focused frontend work. Worth every hour.

**My bottleneck flag (the one that worries me most):** if upload fails on the first paid customer's pack, that customer is gone forever. The chartered audience is unforgiving on basic reliability. **Upload must be Convex-bombproof before MVP ships.**

---

## V · Backend Developer

**Remit:** API surface, mutations, actions, scheduled jobs, queue management.

**Position:**

The Convex POC scaffolding in `src/convex/` is reasonable but assumes the scan can complete inside a single Convex action invocation. **A Tier III scan cannot.**

Convex action limits:

- Maximum execution time per action: ~10 minutes (longer with Convex's `internalAction` and proper paging, but each step is still bounded).
- Maximum payload per mutation: 1 MB (smaller for nested objects).
- Maximum file storage per upload: limit depends on Convex tier — confirm with Convex Pro tier specs.

A Tier III scan involves:

- 600 files classified (10–30 minutes).
- 7 disciplines reviewed × 600 files = potentially thousands of LLM calls.
- Cross-reference protocol (file 19) adds 30% more LLM calls.
- Peer challenge between disciplines.
- Adjudication.
- Council chair report.

End-to-end: 24–48 hours wall-clock, dozens of inference calls per pack.

**The right backend architecture:**

1. **Job queue with persistent state.** Every scan stage is its own job. Jobs are written to a `jobs` table with state (pending → running → succeeded / failed → retried). A Convex scheduled function runs every minute and picks up the next pending job.
2. **Per-discipline isolation.** Architecture scan failures don't fail the M&E scan. Each discipline is an independent job tree.
3. **Idempotency keys on every LLM call.** If a job retries, the same inference doesn't happen twice — we hit the cache.
4. **Multi-provider failover at the call level.** If Anthropic returns a rate-limit error, the call retries on OpenAI within the same job. Not the same scan; the same call.
5. **Source-document streaming.** Don't load 600 PDFs into a single action's memory. Stream from Convex file storage to the LLM, chunk by chunk.
6. **Audit log writes are mutations, never actions.** Mutations are atomic and don't get rolled back on action failure.

**Estimated backend work:** 3 weeks beyond the schema + LLM adapter. Critical-path.

**My bottleneck flag:** the team will be tempted to put the orchestration in a single big action. Don't. Job queue + small idempotent steps is the only way this scales past one customer.

---

## VI · Convex Platform Expert

**Remit:** specifically the Convex limits, capabilities, and best practices. Often missed by general-backend reviewers.

**Position:**

Convex is the right database + functions layer for the MVP. It is not without its limits.

**Specific limits to design around:**

| Limit | Default | Workaround |
|---|---|---|
| Mutation payload | 1 MB | Multiple small mutations, not one big one |
| Action duration | ~10 min | Job queue with `internalAction` + scheduled runs |
| File storage per blob | Confirm tier-specific (typically MB range, not GB) | Direct-to-storage tus uploads; signed-URL pattern; chunk large files |
| Query result size | 8 MB | Pagination + cursor-based queries |
| Reactive queries (real-time) | Excellent — use this | Subscribe to scan state changes; reduces email-poll cost |
| Cron jobs | Yes, built-in | Use for weekly feedback roll-up (already scheduled) |
| Multi-region | Single region per workspace | Plan for EU-Dublin region for MVP; multi-region later |
| File serving | Via `getUrl` | Sign URLs for customer downloads |

**The Convex pattern that fits VerifIQ best:**

```
projects (table)
documents (table, indexed by project_id) — metadata + storage_id
findings (table, indexed by project_id + discipline)
jobs (table, indexed by status, run_at) — queue
scheduled functions:
  - tick_queue: runs every 60s; picks up next pending job
  - feedback_rollup: runs Friday 16:00
  - 14_day_deletion: runs daily; deletes documents older than 14 days
internal actions:
  - classifyDocuments(project_id, file_ids)
  - runDisciplineReview(project_id, discipline)
  - runPeerChallenge(finding_ids)
  - runAdjudication(project_id)
  - generateReport(project_id)
mutations:
  - createProject
  - addDocument (returns storage upload URL)
  - upsertFinding (idempotent)
  - recordChallenge
  - recordAdjudication
  - emitReport
queries:
  - getProject (reactive)
  - listFindings (reactive, paginated)
  - getReport
  - getScanState (reactive — drives the dashboard live view)
```

**My specific warning to the build team:**

- Do not assume Convex file storage can hold a 100 MB PDF directly. Confirm with Convex support BEFORE Phase 1.
- If file size is a constraint, design for an S3-compatible object store (R2 / Backblaze / Tigris) with Convex holding only metadata + storage URL. Don't discover this in Phase 4.
- Reactive queries are cheap to read but expensive to write at scale. Plan for `findings` table writes to be batched, not per-finding.

**Cost lens:** Convex Pro tier starts at $25/month + usage. A Tier III scan, with ~600 documents stored for 14 days + thousands of findings + audit log entries, lands around $0.50–$1.50 of Convex cost per pack. Trivial against the €890 list price. No alarm.

---

## VII · Product Owner

**Remit:** what we build, what we don't build, what we never build. Specifically: feature backlog including the ones the founder didn't think of.

**Position:**

The MVP scope in `verifiq-prompts/12_mvp_scope.md` is correct: 7 features, 6 agents, 4 regulatory modules. Ship that first. Everything below is for Phase 2+, prioritised by where I would put the next €10k of engineering time.

### Backlog — Phase 2 and beyond

**P1 · Drawing comparison (Rev A vs Rev B)**

When a customer issues a Rev B of their pack, surface the diff: which documents changed, which findings are newly relevant, which previous findings are now closed. This is the killer feature for repeat customers and annual seats. **Build value: high. Build cost: 2 weeks. Build risk: low.**

**P2 · ISO 19650 standardisation as a free bonus**

The customer uploads a chaotic folder. VerifIQ classifies it. As a side benefit (no extra charge), we hand them back a folder structure renamed to ISO 19650 / BS EN ISO 19650-2:2018 naming convention. Format: `{PROJECT}-{ORIGINATOR}-{VOLUME}-{LEVEL}-{TYPE}-{ROLE}-{NUMBER}.pdf`. Folder structure: `00_WIP / 10_Shared / 20_Published / 30_Archived`. **Build value: enormous brand differentiation. Build cost: 1 week. Build risk: low.** See voice IX (Auditor) note below — this is borderline genius.

**P3 · Pre-RFI drafting portal**

After a scan, every finding can be auto-drafted into a CA-routed RFI in DOCX. Customer reviews, edits if needed, downloads. Currently the prompt pack already produces "RFI register" as an export — extend this to a per-RFI fillable form. **Build value: medium. Build cost: 1 week.**

**P4 · Cost-impact estimator on Critical findings**

For each Critical finding, estimate the variation exposure if left unresolved. Already done qualitatively (€24–270k on the validation pack). Make it quantitative + automated. **Build value: high — sells the product to QSs. Build cost: 2 weeks.**

**P5 · Programme-impact analyser**

For each Critical finding, estimate the tender release delay if the finding requires document re-issue. Connects to Hunt product directly. **Build value: high for contractors. Build cost: 2 weeks.**

**P6 · Anonymised industry benchmarking**

"Your pack has 3 critical findings; industry average for comparable public-sector office packs is 2.4." Powerful for the customer's internal politics. **Build value: medium. Build cost: 1 week. Privacy considerations: significant — must be properly anonymised.**

**P7 · BCMS / eTenders connector**

Direct upload to BCMS for the Commencement Notice. Direct cross-check against the eTenders public listing for procurement coherence. **Build value: high for public-sector customers. Build cost: 3 weeks. Build risk: medium (external API stability).**

**P8 · IFC model review (BIM)**

Customers using Revit can export an IFC file. VerifIQ can read it for cross-discipline coordination. Major Phase 3 feature. **Build value: huge for sophisticated customers. Build cost: 6 weeks. Build risk: high.**

**P9 · Multi-pack programme view**

For HSE / OPW / large local authority customers running 5–20 capital projects in parallel: a programme view across all their scans, with rolled-up risk and trend analysis. **Build value: enterprise sales unlock. Build cost: 2 weeks.**

**P10 · HIQA inspection prep pack**

Once a facility is operational, the design pack can be re-run against HIQA's current inspection methodology to prep for inspections. Annual subscription opportunity. **Build value: recurring revenue. Build cost: 2 weeks.**

### Backlog — what to NEVER build

| Feature | Why not |
|---|---|
| "AI architect" generative design | Out of scope; we don't design |
| In-browser BIM model viewer | Vendor specialism — partner instead (Bentley, BIM 360) |
| Live chat with AI about findings | Defeats the council framing |
| Compliance "score" 0–100 | Implies certifying — banned in marketing |
| Mobile drafting / drawing app | We're not a CAD tool |
| Slack / Teams integration as primary surface | Tender pack work happens in folders, not chat |

---

## VIII · Lead Engineer

**Remit:** system architecture, deployability, observability, on-call.

**Position:**

The plan is architecturally sound at the prompt-pack level. The platform-level architecture has three gaps the founder + Claude Code build alone cannot fix:

### Gap 1 · Observability

There is no observability plan. No metrics dashboard, no error tracking, no inference-cost monitoring. **At MVP launch we will not know when something is broken.**

Recommended:

- **Sentry** for error tracking — free tier sufficient for MVP. Wire into both client and Convex actions.
- **Prometheus-compatible metrics** for: scan job queue depth, scan turnaround time per discipline, LLM call cost per scan, classifier accuracy.
- **Grafana** dashboard (free Cloud tier) for these metrics.
- **PagerDuty** trial (free for 14 days) for paging the founder on Sev-1 incidents.

Cost: ~€20/month total. **Non-negotiable before first paid customer.**

### Gap 2 · CI/CD + safe deployment

The plan does not mention CI/CD. **At MVP launch we will deploy by `git push to main` and hope.**

Recommended:

- **GitHub Actions** for CI: lint, type-check, run tests.
- **Convex preview deployments** for every PR.
- **Vercel preview deployments** for every PR.
- **Manual promotion to production** — no auto-deploy until we have integration tests.
- Test pack: the 327-finding validation pack as the integration suite. Every production deploy must pass: scan completes; finding count within tolerance; locked disclaimer in every export.

### Gap 3 · Secrets management

The plan does not mention secrets management. **API keys for Anthropic, OpenAI, Stripe, Clerk, Resend, Convex must be rotated, never logged, never committed.**

Recommended:

- All secrets in **Vercel environment variables** (production) + **Convex environment variables** (server-side).
- Never in `.env.local` checked into git.
- Rotate quarterly. Document the rotation procedure.
- Use **1Password** (or **Bitwarden**) for the human-readable backup.

### My critical-path bottleneck flag

The lessons-learnt loop (`15_lessons_learnt_loop.md`) requires that we A/B test prompt changes in production. We have no A/B framework specified. The plan assumes we will build it. **Plan for the A/B framework as a Phase 2 dedicated workstream — not bolted onto whatever Claude Code generates in Phase 8.**

---

## IX · Independent Auditor

**Remit:** adversarial review. What did the council miss?

**Position:**

The eight voices above are thoughtful. They miss four things.

### Audit point 1 · The "drawing name chaos" problem is bigger than the council says

The UX Designer (voice II) says classification confirmation is the key UX. The Frontend Developer (voice IV) says upload reliability is the big risk. Both correct. **Neither has reckoned with the actual heterogeneity of customer pack file-naming.**

Real-world Irish tender-pack samples I've seen include:

- `A-100.pdf`, `A-101.pdf`, `A-102 Rev B.pdf` (sensible)
- `24-001-ARC-100-rev-B-FINAL-USE-THIS.pdf` (Irish practice convention)
- `Architectural Drawing 100.pdf` (descriptive)
- `Plan-Ground-Floor.pdf` (semantic)
- `LH-01-rev-c.dwg` (CAD-only, no PDF)
- `IMG_2438.pdf` (photographed from a screen — yes, this happens)
- `Drawing.pdf`, `Drawing(1).pdf`, `Drawing(2).pdf` (auto-numbered downloads)
- `Final_Final_REALFINAL_v3.pdf` (we've all been there)
- Filenames in Irish, French (engineers on cross-border projects), or other languages

The classifier must handle ALL of this without losing trust. A misclassification of a critical fire-strategy document as "architectural" routes the wrong discipline to the wrong agent and produces nonsense.

**Recommendation: build the classifier to extract metadata from THREE sources, not one.**

1. The filename (current plan).
2. The **first page header / title block** of the PDF itself. Title blocks contain drawing number, title, discipline code, revision, date — all far more reliable than filename.
3. The **document content** (first 500 tokens) for textual classification when title block is absent or low-quality.

Title-block extraction is the killer feature. Every chartered drawing has one. They follow a small number of conventions. Build a vision-model pass that reads the title block as a structured extraction. **Build cost: 1 week. Build value: solves 80% of the heterogeneity problem.**

### Audit point 2 · ISO 19650 standardisation is more than a "nice bonus"

The Product Owner (voice VII) marked it P2. That's an under-rating.

ISO 19650 / BS EN ISO 19650-2:2018 is the international standard for organising and digitising information about buildings. The CWMF in Ireland is moving toward 19650 alignment. The UK has been there since 2018. EU markets are converging.

A VerifIQ pack that ALSO returns the customer's documents in 19650-compliant naming + folder structure is:

- A free gift the customer didn't know they needed.
- A subtle nudge toward 19650 adoption — good for the industry.
- A massive UX winner: every future pack from that customer is now self-classifying, and trust in our classifier rises.
- A potential standalone product: "ISO 19650 Standardiser" as a $99 SaaS add-on.

**Move it to P1.** Build alongside the classifier.

### Audit point 3 · The chartered reviewer panel is the actual bottleneck, not the platform

The Project Manager (voice I) flagged this but understated it. **The reviewer panel is the entire critical path.**

If the panel chair conversation is not booked this week, the founder is the sole reviewer through Q4 — which means the throughput cap from Doc 16 (4 packs / week) holds and revenue is bounded at ~€14k/month at Tier III. Not enough for seed-credible momentum.

**Hard rule: the founder cannot have a "build week" without a parallel "panel chair recruitment week" running alongside.** If the platform ships before the panel exists, the platform sits idle.

### Audit point 4 · Three features the council did not surface

These are competitive moves the founder has not yet considered:

1. **Real-time scan-state push to the customer's Slack / Teams / email.** Customer doesn't have to check the dashboard. The scan tells them when it transitions states. Trivial to build, brand-defining.
2. **Reviewer-signed audit log as a verifiable cryptographic artefact.** The reviewer signs the audit log with a private key; customers can verify the signature without trusting VerifIQ. Solves the "is this real" question for adversarial procurement panels. Builds defensibility in litigation.
3. **Anonymised peer comparison: "your design vs. industry baseline."** The Product Owner mentioned P6 benchmarking; I'd go further — at the PRINCIPLE level. "Your fire strategy is more compartmented than 65% of comparable office packs we've reviewed." Builds trust + sells to the customer's board.

---

## Consolidated Decision Matrix

The matrix records what the council collectively decides + what it escalates.

| Decision | Council position | Disputed by | Status |
|---|---|---|---|
| 8-12 week MVP timeline (not 1 week) | PM + Auditor | None | **Adopted — 12-week public commitment** |
| Upload via tus.io resumable + direct-to-storage | FE Dev | None | **Mandatory before MVP** |
| Job queue architecture (not single big action) | BE Dev + Convex Expert | None | **Mandatory before MVP** |
| Title-block extraction for classification | Auditor | None | **Adopted as P1 alongside classifier** |
| Discipline-confirmation UX screen | UX | None | **Mandatory before first paid pack** |
| Long-running scan state model + emails | UI Designer | None | **Mandatory before MVP** |
| Paper prototype review with panel chair before Phase 7 | UI Designer | None | **Adopted** |
| ISO 19650 standardisation as free bonus | PO + Auditor (move from P2 to P1) | None | **Adopted as P1** |
| Sentry + metrics + Grafana before first paid customer | Lead Engineer | None | **Mandatory** |
| CI/CD before production deploys | Lead Engineer | None | **Mandatory** |
| A/B framework as dedicated Phase 2 workstream | Lead Engineer | None | **Adopted** |
| Drawing comparison (Rev A vs Rev B) — P1 | PO | None | **Adopted as P1 Phase 2** |
| Cost-impact estimator on Critical findings — P1 | PO | None | **Adopted as P1 Phase 2** |
| Programme-impact analyser — P2 | PO | None | **Adopted as P2** |
| Slack/Teams push for scan state | Auditor | None | **Adopted as P2** |
| Cryptographic audit log signature | Auditor | None | **Adopted as P3** |
| Anonymised principle-level peer comparison | Auditor | None | **Adopted as P2** |
| Panel chair conversation this week — non-negotiable | Auditor + PM | None | **Hard gate** |
| Founder cannot have build-only week without parallel panel recruitment | Auditor | None | **Hard rule** |

---

## What the council REFUSED unanimously

- A chat interface for compliance questions.
- A "compliance score 0–100."
- A live BIM viewer in-browser (partner instead).
- A mobile drafting tool.
- Slack / Teams as the primary product surface.
- Auto-deploy to production without integration tests.
- Treating the chartered reviewer panel as a "later" problem.
- Shipping the MVP without observability.

---

## Three immediate actions for the founder, in priority order

1. **Book the chartered reviewer panel chair conversation this week.** Without it, none of the rest of this matters.
2. **Confirm Convex file storage limits with Convex support BEFORE Phase 1.** If they bind, design for S3-compatible object storage with Convex holding metadata. Discovering this in Phase 4 wastes 4 weeks.
3. **Add the title-block extraction + ISO 19650 standardisation features into the MVP scope.** They cost 2 weeks combined and transform the product from "AI document review" to "the design team's filing room with a council attached."

---

## The single sentence

> *The build plan is right at the prompt-pack level and wrong at the platform level — the council recommends a 12-week MVP timeline, a tus.io upload + job-queue + title-block-classifier + ISO-19650-standardiser architecture, a Sentry + CI/CD + A/B platform foundation, and a hard rule that the founder cannot ship the platform without the chartered reviewer panel chair signed first.*

---

*Adopt the matrix. Book the panel chair this week. Build the rest in 12 weeks.*
