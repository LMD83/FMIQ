/**
 * VerifIQ — repo-hygiene guard tests (ADR-001).
 *
 * Proves the guard that prevents the recurring two-track merge breakages:
 * duplicate package.json keys, tracked-but-gitignored files, and committed
 * generated artifacts. Also asserts the live working tree is clean.
 */

import { describe, it, expect } from "vitest";
import {
  findDuplicateKeys,
  committedGeneratedArtifacts,
  collectProblems,
} from "../scripts/check-hygiene.mjs";

describe("findDuplicateKeys", () => {
  it("flags a duplicate key in the same object", () => {
    expect(findDuplicateKeys(`{ "s": { "a": "1", "b": "2", "a": "3" } }`)).toContain("a");
  });
  it("allows the same key name in different objects", () => {
    expect(findDuplicateKeys(`{ "a": { "n": "x" }, "b": { "n": "y" } }`)).toEqual([]);
  });
  it("is not fooled by braces/colons inside strings", () => {
    expect(findDuplicateKeys(`{ "d": "a {x} : y", "e": "ok" }`)).toEqual([]);
  });
});

describe("committedGeneratedArtifacts", () => {
  it("flags committed *.generated.ts / *.bundle.ts", () => {
    expect(
      committedGeneratedArtifacts(["src/a.ts", "src/agents/prompts.generated.ts"]),
    ).toEqual(["src/agents/prompts.generated.ts"]);
  });
});

describe("live working tree", () => {
  it("has no hygiene problems", () => {
    expect(collectProblems()).toEqual([]);
  });
});
