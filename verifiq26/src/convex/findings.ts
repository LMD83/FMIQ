import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { FindingReviewStatus, FindingSeverity } from "./schema";
import { requireAuthUserId } from "./lib/requireAuth";

const findingPayload = v.object({
  findingId: v.string(),
  discipline: v.string(),
  severity: FindingSeverity,
  category: v.string(),
  oneSentenceIssue: v.string(),
  document: v.string(),
  sectionLocation: v.optional(v.string()),
  regulatoryBasis: v.string(),
  operationalRisk: v.string(),
  recommendedAction: v.string(),
  evidenceQuote: v.string(),
  element: v.optional(v.string()),
  standardCode: v.optional(v.string()),
  status: FindingReviewStatus,
  sourceFile: v.optional(v.string()),
  sourcePageRange: v.optional(v.string()),
});

export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    projectId: v.id("projects"),
    checkId: v.optional(v.id("checks")),
    finding: findingPayload,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("findings", {
      orgId: args.orgId,
      projectId: args.projectId,
      checkId: args.checkId,
      ...args.finding,
      createdAt: Date.now(),
    });
  },
});

export const listByProjectAllStatuses = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(FindingReviewStatus),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    if (args.status !== undefined) {
      return await ctx.db
        .query("findings")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", args.status!),
        )
        .collect();
    }

    return await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const summaryByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "CRITICAL").length,
      high: findings.filter((f) => f.severity === "HIGH").length,
      medium: findings.filter((f) => f.severity === "MEDIUM").length,
      low: findings.filter((f) => f.severity === "LOW").length,
      pendingReview: findings.filter((f) => f.status === "pending_review").length,
    };
  },
});
