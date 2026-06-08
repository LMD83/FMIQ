/**
 * VerifIQ — council assembly (Phase 5).
 *
 * Wires the Phase 2 agents into the `OrchestratorDeps` the workflow expects, from
 * a single LLM client + PromptLoader + persistence port. This is the seam the
 * server-side runner uses: build the council once per job with bundled prompts
 * (no node:fs) and a ConvexPersistence, then `Orchestrator.run(input)`.
 *
 * Version: 0.8.0-phase5
 */

import {
  createMvpDisciplineAgents,
  createPeerChallengeAgent,
  createAdjudicatorAgent,
  createChairAgent,
  type PromptLoader,
} from "../agents/index.js";
import type { LLMClient } from "../llm/index.js";
import type { OrchestratorDeps } from "./workflow.js";
import type { PersistencePort } from "./types.js";

export interface CouncilDeps {
  llm: LLMClient;
  prompts: PromptLoader;
  persistence: PersistencePort;
}

/** Assemble the full council (five disciplines + challenge + adjudicator + chair). */
export function createCouncil(deps: CouncilDeps): OrchestratorDeps {
  const base = { llm: deps.llm, prompts: deps.prompts };
  return {
    disciplineAgents: createMvpDisciplineAgents(base),
    challengeAgent: createPeerChallengeAgent(base),
    adjudicator: createAdjudicatorAgent(base),
    chair: createChairAgent(base),
    persistence: deps.persistence,
  };
}
