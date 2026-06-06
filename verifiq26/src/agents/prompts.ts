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

/** Loads and caches prompt fragments from the prompts directory. */
export class PromptLoader {
  private cache = new Map<string, string>();
  constructor(private promptsDir: string = defaultPromptsDir()) {}

  private async readCached(file: string): Promise<string> {
    const hit = this.cache.get(file);
    if (hit !== undefined) return hit;
    const text = await readFile(join(this.promptsDir, file), "utf8");
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
