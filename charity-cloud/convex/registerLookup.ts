/**
 * Charity Cloud — Charities Register lookup (W1, stubbed upstream).
 *
 * The build script wants services/register-lookup as a separate Node service;
 * for the MVP the SAME interface lives in-process behind `RegisterSource`, so
 * swapping in the real service (or the CKAN dataset export) later touches
 * only `fixtureSource`. 24h cache semantics are preserved via
 * orgs.registerCheckedAt.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";

export interface RegisterRecord {
  rcn: string;
  name: string;
  status: "registered" | "deregistered";
  purpose: string;
}

interface RegisterSource {
  lookup(rcn: string): Promise<RegisterRecord | null>;
}

/** Fixture-backed source. Replace with the real register client (roadmap). */
const fixtureSource: RegisterSource = {
  async lookup(rcn: string) {
    const FIXTURES: Record<string, RegisterRecord> = {
      "20012345": {
        rcn: "20012345",
        name: "St. Brigid's Family Support",
        status: "registered",
        purpose: "family_support",
      },
      "20067890": {
        rcn: "20067890",
        name: "Dublin Simon Outreach (fixture)",
        status: "registered",
        purpose: "homelessness",
      },
      "20099999": {
        rcn: "20099999",
        name: "Deregistered Example",
        status: "deregistered",
        purpose: "general_community",
      },
    };
    return FIXTURES[rcn] ?? null;
  },
};

export const lookupRcn = action({
  args: { rcn: v.string() },
  handler: async (_ctx, args): Promise<RegisterRecord | null> => {
    return await fixtureSource.lookup(args.rcn.trim());
  },
});
