/**
 * VerifIQ — prompt loader.
 *
 * Loads agent system prompts from the canonical files in `verifiq-prompts/`.
 * Prompts are NEVER inlined in source (CLAUDE.md anti-pattern); this module
 * reads them from disk and assembles the layered system prompt:
 *   master system prompt (file 01) + discipline prompt (file 04 / 07) +
 *   self-check protocol (file 13).
 *
 * Spec references: verifiq-prompts/CLAUDE.md § Modular architecture;
 * docs/28 Phase 2 (each agent loads master + self-check + discipline prompt).
 * Version: 0.4.0-phase2
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BUNDLED_PROMPTS } from "./prompts.generated.js";

const MASTER_FILE = "01_master_system_prompt.md";
const DISCIPLINE_FILE = "04_agent_prompts.md";
const COUNCIL_FILE = "07_council_prompts.md";
const SELF_CHECK_FILE = "13_agent_self_check_protocol.md";

/** Default prompts directory: `<cwd>/verifiq-prompts`. Override via constructor. */
function defaultPromptsDir(): string {
  const cwd = (globalThis as { process?: { cwd(): string } }).process?.cwd() ?? ".";
  return join(cwd, "verifiq-prompts");
}

/**
 * Extract a numbered section (e.g. "04.1", "07.3") from a prompt file. Sections
 * are delimited by level-2 markdown headings ("## 04.1 · ..."). Returns the
 * body text up to the next level-2 heading.
 */
export function extractSection(markdown: string, sectionId: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex(
    (l) => l.startsWith("## ") && l.includes(sectionId),
  );
  if (startIdx === -1) {
    throw new Error(`Prompt section "${sectionId}" not found`);
  }
  const rest = lines.slice(startIdx + 1);
  const endRel = rest.findIndex((l) => l.startsWith("## "));
  const body = (endRel === -1 ? rest : rest.slice(0, endRel)).join("\n").trim();
  return body;
}

/**
 * Loads and caches prompt fragments. The source is either a filesystem
 * directory (default — reads `verifiq-prompts/` via node:fs) or an in-memory
 * map of filename→content (used by `bundledPromptLoader()` so prompts work in
 * the Convex runtime, where arbitrary repo files can't be read).
 */
export class PromptLoader {
  private cache = new Map<string, string>();
  private dir: string | null;
  private memory: Record<string, string> | null;

  constructor(source: string | Record<string, string> = defaultPromptsDir()) {
    if (typeof source === "string") {
      this.dir = source;
      this.memory = null;
    } else {
      this.dir = null;
      this.memory = source;
    }
  }

  private async readCached(file: string): Promise<string> {
    const hit = this.cache.get(file);
    if (hit !== undefined) return hit;
    let text: string;
    if (this.memory) {
      const found = this.memory[file];
      if (found === undefined) throw new Error(`Bundled prompt "${file}" not found`);
      text = found;
    } else {
      text = await readFile(join(this.dir!, file), "utf8");
    }
    this.cache.set(file, text);
    return text;
  }

  /** The master system prompt (file 01), loaded at the top of every session. */
  master(): Promise<string> {
    return this.readCached(MASTER_FILE);
  }

  /** The universal 7-check self-check protocol (file 13). */
  selfCheck(): Promise<string> {
    return this.readCached(SELF_CHECK_FILE);
  }

  /** A discipline prompt section from file 04 (e.g. "04.1" for Architect). */
  async disciplineSection(sectionId: string): Promise<string> {
    return extractSection(await this.readCached(DISCIPLINE_FILE), sectionId);
  }

  /** A council prompt section from file 07 (e.g. "07.3" for the Chair). */
  async councilSection(sectionId: string): Promise<string> {
    return extractSection(await this.readCached(COUNCIL_FILE), sectionId);
  }
}

/**
 * A PromptLoader backed by the build-time bundle (src/agents/prompts.generated.ts),
 * for runtimes that cannot read repo files (Convex). Regenerate the bundle with
 * `npm run bundle:prompts`.
 */
export function bundledPromptLoader(): PromptLoader {
  return new PromptLoader(BUNDLED_PROMPTS);
}
