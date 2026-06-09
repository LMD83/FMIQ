/**
 * VerifIQ — repo-hygiene guard tests (ADR-001).
 *
 * Proves the guard that prevents the recurring two-track merge breakages:
 * duplicate package.json keys (the kind a merge silently keeps), and the
 * tracked-but-gitignored / committed-generated-artifact catches. Also asserts
 * the live working tree is clean, so a regression fails `npm test`.
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import {
  findDuplicateKeys,
  committedGeneratedArtifacts,
  collectProblems,
} from "../scripts/check-hygiene.mjs";

describe("findDuplicateKeys", () => {
  it("flags a duplicate key in the same object", () => {
    const json = `{ "scripts": { "build": "a", "test": "b", "build": "c" } }`;
    expect(findDuplicateKeys(json)).toContain("build");
  });

  it("allows the same key name in different objects", () => {
    const json = `{ "a": { "name": "x" }, "b": { "name": "y" } }`;
    expect(findDuplicateKeys(json)).toEqual([]);
  });

  it("is not fooled by braces or colons inside string values", () => {
    const json = `{ "desc": "a {nested} : value", "desc2": "ok" }`;
    expect(findDuplicateKeys(json)).toEqual([]);
  });
});

describe("committedGeneratedArtifacts", () => {
  it("flags committed *.generated.ts / *.bundle.ts", () => {
    const tracked = ["src/a.ts", "src/agents/prompts.generated.ts", "src/agents/prompts.bundle.ts"];
    expect(committedGeneratedArtifacts(tracked)).toEqual([
      "src/agents/prompts.generated.ts",
      "src/agents/prompts.bundle.ts",
    ]);
  });
});

describe("live working tree", () => {
  it("has no hygiene problems", () => {
    expect(collectProblems()).toEqual([]);
  });
});
