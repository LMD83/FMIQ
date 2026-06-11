import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    uploadId: v.optional(v.id("disciplineUploads")),
    packId: v.optional(v.string()),
    fileName: v.string(),
    filePath: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id("_storage"),
    estimatedPages: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("files", {
      orgId: args.orgId,
      uploadId: args.uploadId,
      packId: args.packId,
      fileName: args.fileName,
      filePath: args.filePath,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      storageId: args.storageId,
      estimatedPages: args.estimatedPages,
    });
  },
});

export const listByIds = internalQuery({
  args: { fileIds: v.array(v.id("files")) },
  handler: async (ctx, args) => {
    const files = await Promise.all(args.fileIds.map((id) => ctx.db.get(id)));
    return files.filter((f) => f !== null);
  },
});

export const listClassifiedByUpload = internalQuery({
  args: { uploadId: v.id("disciplineUploads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .collect();
  },
});

export const updateClassification = internalMutation({
  args: {
    fileId: v.id("files"),
    discipline: v.string(),
    docType: v.string(),
    classificationConfidence: v.number(),
    classificationMethod: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      discipline: args.discipline,
      docType: args.docType,
      classificationConfidence: args.classificationConfidence,
      classificationMethod: args.classificationMethod,
    });
  },
});
