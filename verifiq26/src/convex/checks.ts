import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { PackTier } from "./schema";

export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    packId: v.optional(v.string()),
    initiatedBy: v.string(),
    tier: PackTier,
    corpusVersion: v.string(),
    skillsRun: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("checks", {
      orgId: args.orgId,
      packId: args.packId,
      initiatedBy: args.initiatedBy,
      tier: args.tier,
      corpusVersion: args.corpusVersion,
      skillsRun: args.skillsRun,
      status: "running",
      createdAt: Date.now(),
    });
  },
});

export const complete = internalMutation({
  args: {
    checkId: v.id("checks"),
    findingCount: v.number(),
    inputTokensConsumed: v.number(),
    outputTokensConsumed: v.number(),
    inferenceCost_cents: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.checkId, {
      status: "completed",
      findingCount: args.findingCount,
      inputTokensConsumed: args.inputTokensConsumed,
      outputTokensConsumed: args.outputTokensConsumed,
      inferenceCost_cents: args.inferenceCost_cents,
      completedAt: Date.now(),
    });
  },
});
