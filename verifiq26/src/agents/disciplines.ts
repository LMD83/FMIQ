/**
 * VerifIQ — MVP discipline definitions.
 *
 * The six MVP agents per verifiq-prompts/12_mvp_scope.md: Architect, Fire,
 * Access (DAC), M&E (Mechanical + Electrical combined for MVP), QS, and Chair.
 * Each discipline maps to one or more file-04 prompt sections, a finding-id
 * prefix, and the discipline-match tokens used by self-check Check 2.
 *
 * Version: 0.4.0-phase2
 */

export interface DisciplineDef {
  /** Stable agent id (used in prompt_version + audit). */
  agentId: string;
  /** Human display name; agents set `discipline_origin` to this. */
  displayName: string;
  /** file-04 section ids that compose this agent's discipline prompt. */
  sections: string[];
  /** Finding-id prefix ({prefix}-{stage}-{seq}). */
  issuePrefix: string;
  /** Lower-case tokens accepted in discipline_origin (self-check Check 2). */
  matchTokens: string[];
  /** Semver prompt version recorded against emitted findings (file 15). */
  promptVersion: string;
}

/** The five discipline review agents (Chair is handled separately). */
export const MVP_DISCIPLINES: Record<string, DisciplineDef> = {
  architect: {
    agentId: "architect",
    displayName: "Architect",
    sections: ["04.1"],
    issuePrefix: "ARCH",
    matchTokens: ["architect", "architectural"],
    promptVersion: "arch-agent-v1.0.0",
  },
  fire: {
    agentId: "fire",
    displayName: "Fire Safety",
    sections: ["04.2"],
    issuePrefix: "FIRE",
    matchTokens: ["fire"],
    promptVersion: "fire-agent-v1.0.0",
  },
  access: {
    agentId: "access",
    displayName: "DAC / Accessibility",
    sections: ["04.3"],
    issuePrefix: "ACC",
    matchTokens: ["dac", "access", "accessibility"],
    promptVersion: "access-agent-v1.0.0",
  },
  "m-and-e": {
    agentId: "m-and-e",
    displayName: "M&E",
    sections: ["04.4", "04.5"],
    issuePrefix: "ME",
    matchTokens: ["mechanical", "electrical", "m&e", "m and e"],
    promptVersion: "mande-agent-v1.0.0",
  },
  qs: {
    agentId: "qs",
    displayName: "Quantity Surveyor",
    sections: ["04.9"],
    issuePrefix: "QS",
    matchTokens: ["quantity", "qs", "cost"],
    promptVersion: "qs-agent-v1.0.0",
  },
};

/** Map a project stage to the stage code used in issue ids. */
export const STAGE_CODE: Record<string, string> = {
  design: "DES",
  "pre-tender": "PRE",
  "pre-build": "PRB",
  construction: "CON",
  handover: "HAN",
};
