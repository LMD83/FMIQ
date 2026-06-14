#!/usr/bin/env node
/**
 * Charity Cloud — golden-path smoke test against the LIVE local Convex backend.
 *
 * Proves the DEPLOYED backend works end to end (W1→W4 + retention) and that the
 * real privacy helpers hold on the wire. The scenario runs server-side in
 * `internal.smoke.goldenPath` (touching the genuine dto/guards/retention code);
 * this script invokes it via `convex run` (admin) and asserts the JSON report.
 *
 * RBAC + identity are proven separately and exhaustively by `npm test`
 * (tests/flows.test.ts, real identities via convex-test).
 *
 * Usage: npm run smoke   (local backend must be running)
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function runGoldenPath() {
  const out = execFileSync(
    "npx",
    ["convex", "run", "smoke:goldenPath"],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        CONVEX_AGENT_MODE: "anonymous",
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${join(root, "scripts/convex-version-shim.cjs")}`,
      },
    },
  );
  // `convex run` prints the JSON return value; grab the JSON object.
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON in output:\n${out}`);
  return JSON.parse(out.slice(start, end + 1));
}

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

console.log("Charity Cloud — golden-path smoke test (live backend)\n");
const r = runGoldenPath();

console.log("W1/W2 — onboarding + post");
check("need posted, vault row written", r.posted === true && r.vaultRows >= 1);
check("need invisible before moderation approval", r.visibleBeforeApproval === 0);

console.log("\nW2 — moderation + public feed redaction");
check("published need visible to local donor", r.feedCount === 1);
check("DTO distance is coarse 'within ~5km'", r.dto && r.dto.distance === "within ~5km");
check("DTO leaks NO private fields (clientRef/note/geoCell)", r.dtoLeaksPrivate === false);
check("far-away donor would NOT match this cell", r.farDonorSees === false);

console.log("\nW3 — match race + chat guard");
check("exactly one offer accepted, one released", r.acceptedCount === 1 && r.releasedCount === 1);
check("chat PII (Eircode) is flagged by the guard", r.chatPiiFlagged === true);

console.log("\nW4 — fulfilment + retention");
check("need marked fulfilled", r.needStatus === "fulfilled");
check("TTL purge replaced content with [purged]", r.purgedNeeds >= 1 && r.purgedContent === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
