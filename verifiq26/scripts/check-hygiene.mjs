/*
 * Repo-hygiene guard (ADR-001 / CONTRIBUTING merge checklist).
 *
 * Catches the class of two-track merge artifacts that has repeatedly broken
 * `main` even when local builds looked green:
 *   1. Duplicate keys in package.json (a merge interleave; JSON silently keeps
 *      the last, so tsc/lint never see it).
 *   2. A file that is BOTH git-tracked AND gitignored (e.g. a committed bundle
 *      that should be regenerated) — the source of "works on my machine".
 *   3. A committed generated artifact (*.generated.ts / *.bundle.ts) — generated
 *      files must be gitignored + regenerated, never committed (ADR-001).
 *
 * Run: npm run check:hygiene  (also a CI step; logic is unit-tested in
 * tests/hygiene.test.ts). Exits non-zero on any violation.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/** Find duplicate keys within any single object frame (brace/string-aware). */
export function findDuplicateKeys(text) {
  const dups = [];
  const stack = [new Set()];
  let inStr = false;
  let esc = false;
  let str = "";
  let lastString = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') {
        inStr = false;
        lastString = str;
        str = "";
      } else str += c;
      continue;
    }
    if (c === '"') {
      inStr = true;
      str = "";
    } else if (c === "{") {
      stack.push(new Set());
    } else if (c === "}") {
      stack.pop();
    } else if (c === ":" && lastString !== null) {
      const frame = stack[stack.length - 1];
      if (frame.has(lastString)) dups.push(lastString);
      else frame.add(lastString);
      lastString = null;
    } else if (!/\s/.test(c) && c !== ",") {
      lastString = null;
    }
  }
  return [...new Set(dups)];
}

/** Tracked files that match a gitignore rule (should never happen). */
export function trackedButIgnored(tracked) {
  try {
    return execSync("git check-ignore --stdin", { input: tracked.join("\n"), encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch (e) {
    return (e.stdout ?? "").split("\n").filter(Boolean);
  }
}

/** Committed generated artifacts that should be gitignored + regenerated. */
export function committedGeneratedArtifacts(tracked) {
  return tracked.filter((f) => /\.(generated|bundle)\.ts$/.test(f));
}

/** Gather every hygiene problem in the current working tree. */
export function collectProblems() {
  const problems = [];
  const pkgText = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  for (const key of findDuplicateKeys(pkgText)) {
    problems.push(`package.json: duplicate key "${key}"`);
  }
  const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
  for (const f of trackedButIgnored(tracked)) {
    problems.push(`tracked file is gitignored (commit it or stop ignoring it): ${f}`);
  }
  for (const f of committedGeneratedArtifacts(tracked)) {
    problems.push(`committed generated artifact (should be gitignored + regenerated): ${f}`);
  }
  return problems;
}

// CLI entry — only when invoked directly, so the module is importable in tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const problems = collectProblems();
  if (problems.length) {
    console.error("Repo hygiene check FAILED:");
    for (const p of problems) console.error("  ✗ " + p);
    process.exit(1);
  }
  console.log("Repo hygiene check passed.");
}
