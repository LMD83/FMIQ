import { mutation } from "./_generated/server";
import { requireAuthUserId } from "./lib/requireAuth";

/** Returns a short-lived URL for direct browser → Convex file storage upload. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
