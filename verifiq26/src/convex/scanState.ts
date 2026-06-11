import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUserId } from "./lib/requireAuth";

type ScanPhaseValue =
  | "pending"
  | "uploading"
  | "classifying"
  | "confirm_classify"
  | "scanning"
  | "cross_ref"
  | "peer_challenge"
  | "adjudicate"
  | "reviewer_queue"
  | "released";

function derivePhase(
  uploads: Array<{ scanStatus: string; classificationStatus?: string }>,
  crossDisciplineComplete?: boolean,
): ScanPhaseValue {
  if (uploads.length === 0) return "pending";

  const allCompleted = uploads.every((u) => u.scanStatus === "completed");
  if (allCompleted && crossDisciplineComplete) return "cross_ref";
  if (allCompleted) return "scanning";

  const anyScanning = uploads.some((u) => u.scanStatus === "scanning");
  if (anyScanning) return "scanning";

  const anyQueued = uploads.some((u) => u.scanStatus === "queued");
  if (anyQueued) return "scanning";

  const anyClassifying = uploads.some(
    (u) => u.classificationStatus === "pending" && u.scanStatus === "pending",
  );
  if (anyClassifying) return "classifying";

  const anyClassified = uploads.some((u) => u.classificationStatus === "classified");
  if (anyClassified) return "confirm_classify";

  return "uploading";
}

function deriveProgress(
  phase: ScanPhaseValue,
  uploads: Array<{ scanStatus: string; fileCount: number }>,
): number {
  if (phase === "pending") return 0;
  if (phase === "released") return 100;

  const totalFiles = uploads.reduce((sum, u) => sum + u.fileCount, 0);
  const completedUploads = uploads.filter((u) => u.scanStatus === "completed").length;
  const scanningUploads = uploads.filter((u) => u.scanStatus === "scanning").length;

  const phaseBase: Record<ScanPhaseValue, number> = {
    pending: 0,
    uploading: 10,
    classifying: 25,
    confirm_classify: 35,
    scanning: 50,
    cross_ref: 75,
    peer_challenge: 82,
    adjudicate: 88,
    reviewer_queue: 94,
    released: 100,
  };

  let progress = phaseBase[phase];
  if (uploads.length > 0 && phase === "scanning") {
    const uploadProgress =
      ((completedUploads + scanningUploads * 0.5) / uploads.length) * 30;
    progress += uploadProgress;
  }
  if (totalFiles > 0 && phase === "classifying") {
    progress += Math.min(10, totalFiles / 50);
  }

  return Math.min(99, Math.round(progress));
}

export const syncFromUpload = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return;

    const uploads = await ctx.db
      .query("disciplineUploads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const phase = derivePhase(uploads, project.crossDisciplineComplete);
    const progressPct = deriveProgress(phase, uploads);
    const filesTotal = uploads.reduce((sum, u) => sum + u.fileCount, 0);
    const filesProcessed = uploads
      .filter((u) => u.scanStatus === "completed" || u.scanStatus === "scanning")
      .reduce((sum, u) => sum + u.fileCount, 0);

    const existing = await ctx.db
      .query("scanStates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    const state = {
      projectId: args.projectId,
      phase,
      progressPct,
      filesProcessed,
      filesTotal,
      findingsCount: findings.length,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, state);
    } else {
      await ctx.db.insert("scanStates", state);
    }
  },
});

export const getState = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const scanState = await ctx.db
      .query("scanStates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    const uploads = await ctx.db
      .query("disciplineUploads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const severityCounts = {
      critical: findings.filter((f) => f.severity === "CRITICAL").length,
      high: findings.filter((f) => f.severity === "HIGH").length,
      medium: findings.filter((f) => f.severity === "MEDIUM").length,
      low: findings.filter((f) => f.severity === "LOW").length,
    };

    const disciplineCards = uploads.map((u) => ({
      discipline: u.discipline,
      scanStatus: u.scanStatus,
      classificationStatus: u.classificationStatus,
      fileCount: u.fileCount,
      findingsCount: u.findingsCount ?? 0,
    }));

    return {
      project: {
        _id: project._id,
        name: project.name,
        contractType: project.contractType,
        tier: project.tier,
      },
      phase: scanState?.phase ?? "pending",
      progressPct: scanState?.progressPct ?? 0,
      filesProcessed: scanState?.filesProcessed ?? 0,
      filesTotal: scanState?.filesTotal ?? 0,
      findingsCount: scanState?.findingsCount ?? findings.length,
      severityCounts,
      disciplineUploads: disciplineCards,
      crossDisciplineComplete: project.crossDisciplineComplete ?? false,
      updatedAt: scanState?.updatedAt ?? project.updatedAt,
    };
  },
});
