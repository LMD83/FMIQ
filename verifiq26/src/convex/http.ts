/**
 * VerifIQ — HTTP routes (docs/42 §3, §5.3 B1).
 *
 * `POST /intake` is the public front door the website calls in place of the old
 * `mailto:` link: it validates the intake JSON, creates the project + magic
 * code, and emails the upload link — all via the internal `submitIntake` action.
 *
 * The response NEVER contains the magic code (it travels only by email). CORS is
 * restricted to the configured site origin (`INTAKE_ALLOWED_ORIGIN`, default `*`
 * for local dev). Per-IP / per-email rate limiting is layered here (docs/42
 * §5.4 N1) — wired to a store in Sprint 1 §1.7; this skeleton enforces shape
 * and origin and leaves a single marked seam for the limiter.
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

function corsHeaders(): Record<string, string> {
  const origin = process.env.INTAKE_ALLOWED_ORIGIN ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

/** Minimal, dependency-free email shape check (defence in depth; the real gate is delivery). */
function looksLikeEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

const http = httpRouter();

http.route({
  path: "/intake",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders() })),
});

http.route({
  path: "/intake",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object") {
      return json({ ok: false, error: "bad_request" }, 400);
    }

    const b = body as Record<string, unknown>;

    // Honeypot: bots fill hidden fields; humans never do (docs/42 §5.1 W4).
    if (nonEmpty(b.company_website)) {
      return json({ ok: true }, 200); // silently accept-and-drop
    }

    if (!nonEmpty(b.name) || !looksLikeEmail(b.email) || !nonEmpty(b.project_name)) {
      return json({ ok: false, error: "missing_fields" }, 422);
    }

    // TODO(Sprint 1 §1.7): per-IP + per-email rate limit before issuing.

    const result = await ctx.runAction(internal.uploadTokens.submitIntake, {
      name: (b.name as string).trim(),
      email: (b.email as string).trim(),
      project_name: (b.project_name as string).trim(),
      building_type: nonEmpty(b.building_type) ? (b.building_type as string).trim() : undefined,
      purpose: b.purpose === "pilot_upload" ? "pilot_upload" : "first_read",
    });

    // Never leak the code or whether the email existed — just confirm receipt.
    return json({ ok: true, projectId: result.projectId }, 200);
  }),
});

export default http;
