/**
 * VerifIQ — classification Convex functions (file 20 §3–4).
 *
 * Persists the classifier's output to the `documents` row, and implements the
 * classification-confirmation gate: low-confidence rows must be confirmed (or
 * reclassified) before a scan may start, and every reclassification is logged
 * to `audit_log` as labelled training data (file 20 §4 / file 15).
 *
 * Audit writes are mutations (never actions) so they survive retries (file 20 §2).
 *
 * Version: 0.6.0-phase4
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Stage } from "./schema";

/** Default confirm threshold (mirrors classifier CONFIRM_THRESHOLD). */
const CONFIRM_THRESHOLD = 0.7;

/** Save classifier output onto a document and mark it `classified`. */
export const saveClassification = mutation({
  args: {
    document_id: v.id("documents"),
    discipline: v.string(),
    doc_type: v.string(),
    classifier_confidence: v.number(),
    drawing_number: v.optional(v.string()),
    revision: v.optional(v.string()),
    date: v.optional(v.string()),
    author: v.optional(v.string()),
    stage: v.optional(Stage),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.document_id, {
      discipline: args.discipline,
      doc_type: args.doc_type,
      classifier_confidence: args.classifier_confidence,
      ...(args.drawing_number !== undefined ? { drawing_number: args.drawing_number } : {}),
      ...(args.revision !== undefined ? { revision: args.revision } : {}),
      ...(args.date !== undefined ? { date: args.date } : {}),
      ...(args.author !== undefined ? { author: args.author } : {}),
      ...(args.stage !== undefined ? { stage: args.stage } : {}),
      status: "classified",
    });
  },
});

/** Confirm a document's classification as-is (the trust gate, file 20 §4). */
export const confirmDocument = mutation({
  args: { document_id: v.id("documents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.document_id, { status: "confirmed" });
  },
});

/**
 * Reclassify a document (customer correction). Patches the row, confirms it, and
 * logs the correction to audit_log — the single most valuable training signal
 * for the lessons-learnt loop (file 20 §4).
 */
export const reclassifyDocument = mutation({
  args: {
    document_id: v.id("documents"),
    discipline: v.string(),
    doc_type: v.optional(v.string()),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.document_id);
    if (!doc) throw new Error("Document not found");
    const before = { discipline: doc.discipline, doc_type: doc.doc_type };
    await ctx.db.patch(args.document_id, {
      discipline: args.discipline,
      ...(args.doc_type !== undefined ? { doc_type: args.doc_type } : {}),
      status: "confirmed",
    });
    const now = Date.now();
    // Structured training signal (file 20 §4 / file 15).
    await ctx.db.insert("classifier_feedback", {
      project_id: doc.project_id,
      document_id: args.document_id,
      sha256: doc.sha256,
      ...(before.discipline !== undefined ? { from_discipline: before.discipline } : {}),
      to_discipline: args.discipline,
      ...(before.doc_type !== undefined ? { from_doc_type: before.doc_type } : {}),
      ...(args.doc_type !== undefined ? { to_doc_type: args.doc_type } : {}),
      ...(doc.classifier_confidence !== undefined
        ? { prior_confidence: doc.classifier_confidence }
        : {}),
      corrected_by: args.actor,
      corrected_at: now,
    });
    // Audit log remains the non-negotiable trust artefact.
    await ctx.db.insert("audit_log", {
      project_id: doc.project_id,
      actor: args.actor,
      action: "reclassify",
      target_type: "document",
      target_id: args.document_id,
      payload_json: JSON.stringify({
        before,
        after: { discipline: args.discipline, doc_type: args.doc_type ?? doc.doc_type },
        prior_confidence: doc.classifier_confidence,
      }),
      occurred_at: now,
    });
  },
});

/** Documents that still need confirmation before a scan can start. */
export const listForConfirmation = query({
  args: { project_id: v.id("projects") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    return docs.filter((d) => d.status !== "confirmed");
  },
});

/**
 * The forced-confirm gate (file 20 §4): a scan may start only when no
 * low-confidence row is still unconfirmed.
 */
export const canStartScan = query({
  args: { project_id: v.id("projects"), threshold: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const threshold = args.threshold ?? CONFIRM_THRESHOLD;
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("project_id", args.project_id))
      .collect();
    const blocking = docs.filter(
      (d) => d.status !== "confirmed" && (d.classifier_confidence ?? 0) < threshold,
    );
    return { ready: blocking.length === 0, blocking_count: blocking.length };
  },
});
