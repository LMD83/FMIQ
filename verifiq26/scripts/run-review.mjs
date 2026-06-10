#!/usr/bin/env node
/**
 * VerifIQ — run a real review from the terminal (Phase 6 smoke).
 *
 * Proves the whole engine end-to-end against a LIVE Convex deployment: it creates
 * a throwaway project, sends a small sample pack with planted issues through the
 * council, polls until the pipeline parks the pack in the reviewer queue, then
 * prints the findings.
 *
 * Prerequisites (see docs/35-backend-provisioning-runbook.md):
 *   1) `npx convex dev` running (writes NEXT_PUBLIC_CONVEX_URL into .env.local)
 *   2) ANTHROPIC_API_KEY / OPENAI_API_KEY (and R2_* if used) set in the Convex
 *      environment:  `npx convex env set ANTHROPIC_API_KEY sk-ant-...`
 *
 * Usage:   node scripts/run-review.mjs
 *
 * Output is indicative. The reviewer verifies locally.
 */

import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";

// ── resolve the Convex deployment URL ───────────────────────────────────────
function convexUrl() {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* fall through */
  }
  throw new Error(
    "No Convex URL. Run `npx convex dev` first (it writes NEXT_PUBLIC_CONVEX_URL to .env.local), or set CONVEX_URL.",
  );
}

// The generated API only exists as importable JS after `npx convex dev` / codegen.
async function loadApi() {
  try {
    const mod = await import("../src/convex/_generated/api.js");
    return mod.api;
  } catch {
    throw new Error(
      "Could not load src/convex/_generated/api.js — run `npx convex dev` first so Convex generates it.",
    );
  }
}

// ── a small sample pack with planted issues (anonymised, illustrative) ───────
const SAMPLE_PACK = {
  projectName: "Demo · Adult Day Service (Stage 2C)",
  projectStage: "pre-tender",
  buildingType: "Adult Day Service",
  reviewDate: new Date().toISOString().slice(0, 10),
  corpusVersion: "IE-2026.06",
  reviewerInitials: "LD",
  projectContext:
    "Anonymised Stage 2C tender pack. Public-sector Adult Day Service, Dublin. Procured under CWMF using PW-CF5 (Employer-Designed). FSC granted; BCAR applies.",
  documentsByDiscipline: {
    architect: [
      {
        filename: "Architectural Works Specification.txt",
        text: [
          "SECTION K10 — DRY LINING / PARTITIONS",
          "Wall Types 1-4: proprietary metal-stud partitions. Fire resistance of complete",
          "partition assembly: REI 30 or better to BS EN 13501-2. No compartment wall type",
          "is scheduled.",
          "",
          "PRELIMINARIES: VAT to be applied at 21%.",
          "Cover page: 'Proposed School, Co. Mayo' (project is an Adult Day Service in Dublin).",
        ].join("\n"),
      },
    ],
    fire: [
      {
        filename: "Fire Safety Strategy.txt",
        text: [
          "Compartmentation: FSC Condition 3 (granted) requires compartment walls to TGD-B",
          "2024 with minimum 60 minutes fire resistance (REI 60).",
          "Fire dampers: provide to BS 476: Part 7 (note: BS 476-7 is a surface-spread-of-flame",
          "test, withdrawn for this purpose).",
          "Cause-and-effect matrix: to be provided (Appendix F not included in this issue).",
        ].join("\n"),
      },
    ],
    access: [
      {
        filename: "Sanitary Schedule 40006.txt",
        text: [
          "Room 0.06 Changing Places WC: HOI001 ceiling-mounted track hoist, full coverage.",
          "No SWL stated; no structural pad/back-plate; no commissioning standard referenced.",
        ].join("\n"),
      },
    ],
    qs: [
      {
        filename: "Form of Tender — Schedule Part 1.txt",
        text: [
          "Contract: PW-CF5 (Employer-Designed Works).",
          "Section 4.2 — Date for Substantial Completion: ____________ (left blank).",
          "Liquidated Damages per PW-CF5 Clause 9.5.",
        ].join("\n"),
      },
    ],
  },
};

const ACTIVE = new Set([
  "pending",
  "uploading",
  "classifying",
  "confirm_classify",
  "scanning",
  "cross_ref",
  "peer_challenge",
  "adjudicate",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = convexUrl();
  const api = await loadApi();
  const client = new ConvexHttpClient(url);
  console.log(`\nVerifIQ · run-review\nConvex: ${url}\n`);

  console.log("→ creating throwaway user + project…");
  const userId = await client.mutation(api.mutations.createUser, {
    email: "demo@verifiq.ie",
    name: "Demo",
  });
  const projectId = await client.mutation(api.mutations.createProject, {
    owner_user_id: userId,
    name: SAMPLE_PACK.projectName,
    building_type: SAMPLE_PACK.buildingType,
    stage: SAMPLE_PACK.projectStage,
  });
  console.log(`  project: ${projectId}`);

  console.log("→ dispatching review (this calls the live model — costs a few cents)…");
  await client.mutation(api.reviewData.requestReview, {
    project_id: projectId,
    payload_json: JSON.stringify({ ...SAMPLE_PACK, projectId }),
  });

  const deadline = Date.now() + 10 * 60 * 1000; // 10 minutes
  let last = "";
  for (;;) {
    const s = await client.query(api.projectData.getProjectStatus, { project_id: projectId });
    const line = `  state=${s.scan_state}  findings=${s.finding_count}  (C${s.by_severity.critical}/H${s.by_severity.high}/M${s.by_severity.medium}/L${s.by_severity.low})`;
    if (line !== last) {
      console.log(line);
      last = line;
    }
    if (!ACTIVE.has(s.scan_state)) break; // reviewer_queue / released = pipeline done
    if (Date.now() > deadline) {
      console.log("  (timed out waiting — check the Convex dashboard logs)");
      break;
    }
    await sleep(5000);
  }

  const findings = await client.query(api.projectData.getProjectFindings, { project_id: projectId });
  console.log(`\n${findings.length} finding(s):\n`);
  for (const f of findings.slice(0, 25)) {
    console.log(`  [${String(f.risk).toUpperCase()}] ${f.issue_id} · ${f.discipline_origin}`);
    console.log(`    ${f.finding}`);
    console.log(`    source: ${f.source_document} · ${f.source_reference}`);
    if (f.question) console.log(`    please verify: ${f.question}`);
    console.log("");
  }

  console.log(
    "Output is indicative. The reviewer verifies locally. Full register is in the\nConvex dashboard → Data → findings.\n",
  );
}

main().catch((e) => {
  console.error("\nrun-review failed:", e.message ?? e);
  process.exit(1);
});
