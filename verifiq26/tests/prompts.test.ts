/**
 * VerifIQ — prompt-bundling test (Phase 5 unblock).
 *
 * Proves the agents can load prompts from an in-memory bundle (the Convex
 * runtime path) identically to the filesystem path — so the `"use node"`
 * orchestrator runner can run agents server-side without `node:fs`.
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PromptLoader,
  FsPromptSource,
  RecordPromptSource,
} from "../src/agents/index.js";

const dir = join(process.cwd(), "verifiq-prompts");
const read = (f: string) => readFileSync(join(dir, f), "utf8");

const bundle: Record<string, string> = {
  "01_master_system_prompt.md": read("01_master_system_prompt.md"),
  "04_agent_prompts.md": read("04_agent_prompts.md"),
  "07_council_prompts.md": read("07_council_prompts.md"),
  "13_agent_self_check_protocol.md": read("13_agent_self_check_protocol.md"),
};

describe("PromptLoader bundling", () => {
  it("a bundled RecordPromptSource matches the filesystem source", async () => {
    const fs = new PromptLoader(new FsPromptSource());
    const rec = new PromptLoader(new RecordPromptSource(bundle));

    expect(await rec.master()).toBe(await fs.master());
    expect(await rec.disciplineSection("04.1")).toBe(await fs.disciplineSection("04.1"));
    expect((await rec.councilSection("07.3")).length).toBeGreaterThan(0);
    expect((await rec.selfCheck()).length).toBeGreaterThan(0);
  });

  it("throws a clear error when a prompt file is missing from the bundle", async () => {
    const rec = new PromptLoader(new RecordPromptSource({}));
    await expect(rec.master()).rejects.toThrow(/not in bundle/);
  });

  it("still accepts a directory string (backward compatible)", async () => {
    const loader = new PromptLoader(dir);
    expect((await loader.master()).length).toBeGreaterThan(0);
  });
});
