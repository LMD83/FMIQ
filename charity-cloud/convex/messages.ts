/**
 * Charity Cloud — match chat (W3 step 4) with the PII guard (rule 7).
 *
 * Participants only (the match's donor, or the org's caseworkers/admin).
 * Every send runs the PII regexes: a hit flags the message, warns the sender
 * (returned in the mutation result), and enqueues a moderation item. PPSNs
 * are additionally redacted before storage (rule 4). Messages are TTL'd.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUser } from "./lib/rbac";
import { scanPii, cleanFreeText, MESSAGE_TTL_MS } from "./lib/guards";
import { type Doc } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx } from "./_generated/server";

async function requireParticipant(
  ctx: QueryCtx | MutationCtx,
  matchId: Doc<"matches">["_id"],
): Promise<{ user: Doc<"appUsers">; match: Doc<"matches"> }> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Not signed in");
  const match = await ctx.db.get(matchId);
  if (!match) throw new Error("Match not found");
  const isDonor = user._id === match.donorUserId;
  const isOrg =
    (user.role === "caseworker" || user.role === "orgAdmin") && user.orgId === match.orgId;
  if (!isDonor && !isOrg) throw new Error("Forbidden: not a participant");
  return { user, match };
}

export const send = mutation({
  args: { matchId: v.id("matches"), body: v.string() },
  handler: async (ctx, args) => {
    const { user, match } = await requireParticipant(ctx, args.matchId);
    if (match.status !== "active") throw new Error("Chat is closed");
    if (args.body.trim().length === 0) throw new Error("Empty message");
    if (args.body.length > 1000) throw new Error("Message too long");

    const scan = scanPii(args.body);
    const stored = cleanFreeText(args.body).text; // PPSN redacted (rule 4)
    const messageId = await ctx.db.insert("messages", {
      matchId: args.matchId,
      senderUserId: user._id,
      body: stored,
      flagged: scan.flagged,
      ttlAt: Date.now() + MESSAGE_TTL_MS,
    });
    if (scan.flagged) {
      await ctx.db.insert("moderationItems", {
        kind: "chatFlag",
        messageId,
        needId: match.needId,
        reason: "PII pattern detected in chat",
        status: "open",
      });
    }
    // Rule 7: warn the sender. The UI surfaces this immediately.
    return {
      messageId,
      warning: scan.flagged
        ? "Heads up: this message looks like it contains personal details (phone number or Eircode). Please arrange handover only at the agreed neutral point — a moderator will review."
        : null,
    };
  },
});

export const list = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const { user } = await requireParticipant(ctx, args.matchId);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();
    return rows.map((m) => ({
      id: m._id,
      mine: m.senderUserId === user._id,
      body: m.body,
      flagged: m.flagged,
      at: m._creationTime,
    }));
  },
});
