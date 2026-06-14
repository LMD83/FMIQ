/**
 * Charity Cloud — Convex Auth configuration.
 *
 * MVP: email + password via Convex Auth (no social login — CLAUDE.md).
 * The production target is email MAGIC LINK only; that needs an email-sending
 * key (Resend EU). The swap is a one-provider change here once AUTH_RESEND_KEY
 * exists — tracked in docs/ROADMAP-WEEKEND.md. Password is acceptable for the
 * local pilot demo because no real requester data is involved.
 */
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
