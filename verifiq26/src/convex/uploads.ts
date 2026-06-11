import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const get = internalQuery({
  args: { id: v.id("disciplineUploads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    projectId: v.id("projects"),
    discipline: v.string(),
    invitationId: v.id("uploadInvitations"),
    zipStorageId: v.id("_storage"),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const uploadId = await ctx.db.insert("disciplineUploads", {
      orgId: args.orgId,
      projectId: args.projectId,
      discipline: args.discipline,
      invitationId: args.invitationId,
      zipStorageId: args.zipStorageId,
      uploadedBy: args.uploadedBy,
      uploadedAt: args.uploadedAt,
      fileIds: [],
      fileCount: 0,
      totalSizeBytes: 0,
      estimatedPages: 0,
      classificationStatus: "pending",
      scanStatus: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.scanState.syncFromUpload, {
      projectId: args.projectId,
    });

    return uploadId;
  },
});

export const finalise = internalMutation({
  args: {
    uploadId: v.id("disciplineUploads"),
    fileIds: v.array(v.id("files")),
    fileCount: v.number(),
    totalSizeBytes: v.number(),
    estimatedPages: v.number(),
  },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return;

    await ctx.db.patch(args.uploadId, {
      fileIds: args.fileIds,
      fileCount: args.fileCount,
      totalSizeBytes: args.totalSizeBytes,
      estimatedPages: args.estimatedPages,
    });

    await ctx.scheduler.runAfter(0, internal.scanState.syncFromUpload, {
      projectId: upload.projectId,
    });
  },
});

export const markClassified = internalMutation({
  args: { uploadId: v.id("disciplineUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return;

    await ctx.db.patch(args.uploadId, {
      classificationStatus: "classified",
      scanStatus: "queued",
    });

    await ctx.scheduler.runAfter(0, internal.scanState.syncFromUpload, {
      projectId: upload.projectId,
    });
  },
});

export const markScanning = internalMutation({
  args: { uploadId: v.id("disciplineUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return;

    await ctx.db.patch(args.uploadId, { scanStatus: "scanning" });

    await ctx.scheduler.runAfter(0, internal.scanState.syncFromUpload, {
      projectId: upload.projectId,
    });
  },
});

export const markScanComplete = internalMutation({
  args: {
    uploadId: v.id("disciplineUploads"),
    checkId: v.id("checks"),
    findingsCount: v.number(),
  },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return;

    await ctx.db.patch(args.uploadId, {
      scanStatus: "completed",
      checkId: args.checkId,
      findingsCount: args.findingsCount,
    });

    await ctx.scheduler.runAfter(0, internal.scanState.syncFromUpload, {
      projectId: upload.projectId,
    });
  },
});
