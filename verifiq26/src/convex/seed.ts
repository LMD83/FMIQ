import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthEmail } from "./lib/requireAuth";

/** Dev helper — creates a demo org + project for dashboard testing. */
export const createDemoProject = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = await requireAuthEmail(ctx);
    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: "Demo Organisation",
      createdAt: now,
    });

    const projectId = await ctx.db.insert("projects", {
      orgId,
      name: args.name ?? "Office project",
      contractType: "PW-CF5",
      tier: "mid",
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("scanStates", {
      projectId,
      phase: "pending",
      progressPct: 0,
      filesProcessed: 0,
      filesTotal: 0,
      findingsCount: 0,
      updatedAt: now,
    });

    return { orgId, projectId };
  },
});
