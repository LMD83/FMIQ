/**
 * VerifIQ — agents barrel (Phase 2).
 *
 * The six MVP agents: five discipline review agents (Architect, Fire, Access,
 * M&E, QS) and the Council Chair. Each loads its prompts from verifiq-prompts/
 * and uses the Phase 1 LLM adapter.
 *
 * Version: 0.4.0-phase2
 */

export { PromptLoader, extractSection, bundledPromptLoader } from "./prompts.js";
export { MVP_DISCIPLINES, STAGE_CODE, type DisciplineDef } from "./disciplines.js";
export {
  DisciplineAgent,
  createDisciplineAgent,
  type ReviewInput,
  type ReviewResult,
  type ReviewDocument,
  type AgentDeps,
  type SelfCheckSink,
} from "./agent.js";
export { ChairAgent, createChairAgent, deriveDecision, type ChairInput, type ChairDeps } from "./chair.js";
export {
  PeerChallengeAgent,
  createPeerChallengeAgent,
  type ChallengeRecord,
  type ChallengeInput,
  type ChallengeDeps,
  type ChallengeAuditEntry,
  type ChallengeSink,
} from "./challenge.js";
export {
  AdjudicatorAgent,
  createAdjudicatorAgent,
  type AdjudicateInput,
  type AdjudicateResult,
  type AdjudicationRecord,
  type AdjudicationState,
  type AdjudicatorDeps,
  type AdjudicationSink,
} from "./adjudicate.js";
export {
  runSelfCheck,
  CHECK_LABELS,
  type SelfCheckAuditEntry,
  type SelfCheckContext,
  type SelfCheckResult,
  type SelfCheckOutcome,
  type EvidenceType,
} from "./self-check.js";
export { parseFindings, type ParseResult } from "./parse.js";

import type { AgentDeps } from "./agent.js";
import { DisciplineAgent } from "./agent.js";
import { MVP_DISCIPLINES } from "./disciplines.js";

/** Construct all five MVP discipline agents from shared deps. */
export function createMvpDisciplineAgents(deps: AgentDeps): Record<string, DisciplineAgent> {
  const agents: Record<string, DisciplineAgent> = {};
  for (const [key, def] of Object.entries(MVP_DISCIPLINES)) {
    agents[key] = new DisciplineAgent(def, deps);
  }
  return agents;
}
