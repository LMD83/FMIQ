"use node";
/**
 * VerifIQ — review runner node action (Phase 5).
 *
 * Assembles the council (caching LLM client + bundled prompts + the six agents)
 * and runs the resumable Orchestrator against the Convex schema via
 * `ConvexPersistence`. Because the Orchestrator is idempotent, a re-dispatch
 * (by `reviewData.requestReview` or the resume cron) reloads persisted state and
 * skips finished stages.
 *
 * Runs in Node ("use node") so the agents' prompt loader and the provider SDKs
 * are available. Prompts come from the build-time bundle (no fs at runtime).
 *
 * Verify locally: needs ANTHROPIC_API_KEY / OPENAI_API_KEY and a Convex
 * deployment; not exercised in the credential-less test sandbox.
 *
 * Version: 0.7.0-phase5
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createLLM } from "../llm";
import type { LLMAuditEntry } from "../llm/types";
import { CachingLLMClient } from "../llm/cache";
import { ConvexCacheStore } from "../llm/cache-convex";
import {
  bundledPromptLoader,
  createMvpDisciplineAgents,
  createPeerChallengeAgent,
  createAdjudicatorAgent,
  createChairAgent,
  type SelfCheckAuditEntry,
} from "../agents";
import { ConvexPersistence } from "../orchestrator/convex-port";
import { createOrchestrator, type RunInput } from "../orchestrator";

export const runReview = internalAction({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.reviewData.loadReviewInput, {
      project_id: args.project_id,
    });
    if (!payload) throw new Error(`no review input persisted for project ${args.project_id}`);
    const input = JSON.parse(payload) as RunInput;

    const prompts = bundledPromptLoader();

    const appendAudit = async (action: string, payloadObj: unknown): Promise<void> => {
      await ctx.runMutation(api.mutations.appendAudit, {
        project_id: args.project_id,
        actor: "council",
        action,
        target_type: "review",
        payload_json: JSON.stringify(payloadObj),
      });
    };

    const llm = new CachingLLMClient(
      createLLM({ audit: (e: LLMAuditEntry) => appendAudit(e.action, e) }),
      new ConvexCacheStore(ctx),
      { projectId: args.project_id },
    );

    const selfCheckSink = (e: SelfCheckAuditEntry) => appendAudit("self_check", e);

    const orchestrator = createOrchestrator({
      disciplineAgents: createMvpDisciplineAgents({ llm, prompts, audit: selfCheckSink }),
      challengeAgent: createPeerChallengeAgent({ llm, prompts }),
      adjudicator: createAdjudicatorAgent({ llm, prompts }),
      chair: createChairAgent({ llm, prompts }),
      persistence: new ConvexPersistence(ctx),
    });

    const result = await orchestrator.run({ ...input, projectId: args.project_id });
    return {
      rating: result.report.build_readiness_rating,
      decision: result.report.executive_decision,
    };
  },
});
