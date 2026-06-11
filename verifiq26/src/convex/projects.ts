import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUserId } from "./lib/requireAuth";

export const get = internalQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getStatus = internalQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return null;

    const disciplineUploads = await ctx.db
      .query("disciplineUploads")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    return { ...project, disciplineUploads };
  },
});

export const markCrossDisciplineComplete = internalMutation({
  args: {
    projectId: v.id("projects"),
    crossDisciplineFindingsCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      crossDisciplineComplete: true,
      crossDisciplineFindingsCount: args.crossDisciplineFindingsCount,
      updatedAt: Date.now(),
    });
  },
});

export const getPublic = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    return {
      _id: project._id,
      name: project.name,
      contractType: project.contractType,
      tier: project.tier,
    };
  },
});
