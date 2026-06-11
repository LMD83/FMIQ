import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const findByToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("uploadInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
  },
});

export const markExpired = internalMutation({
  args: { id: v.id("uploadInvitations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "expired" });
  },
});

export const markUploaded = internalMutation({
  args: { id: v.id("uploadInvitations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "uploaded" });
  },
});
