"use node";

/**
 * VerifIQ — Per-Discipline ZIP Upload Action
 *
 * Receives a ZIP uploaded by a consultant via magic-link, extracts it server-side,
 * classifies each file, queues per-discipline scan.
 *
 * Flow:
 *  1. Verify magic-link token (uploadInvitations.tokenHash match, not expired, not consumed)
 *  2. Stream ZIP from Convex storage, extract entries
 *  3. Write each extracted file to storage with link to disciplineUpload
 *  4. Trigger classification action (async, parallel per file)
 *  5. When classification complete → trigger scan action for this discipline
 *
 * Failure modes:
 *  - Token invalid / expired → 410 Gone
 *  - ZIP corrupt → mark upload as failed, notify customer
 *  - Individual file extraction failure → log + continue (resilient)
 *  - ZIP > 1GB → reject with 413, ask customer to split
 */

import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import StreamZip from "node-stream-zip";

const MAX_ZIP_SIZE_BYTES = 1_000_000_000; // 1 GB cap per discipline ZIP
const MAX_FILE_SIZE_BYTES = 60_000_000;    // 60 MB per individual file
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".xls", ".dwg", ".dxf", ".rvt"];

export const submitDisciplineZip = action({
  args: {
    magicLinkToken: v.string(),
    zipStorageId: v.id("_storage"),
    consultantEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Verify token
    const invitation = await ctx.runQuery(internal.invitations.findByToken, {
      tokenHash: hashToken(args.magicLinkToken),
    });

    if (!invitation) {
      throw new Error("Invalid or expired upload link.");
    }
    if (invitation.status !== "sent" && invitation.status !== "opened") {
      throw new Error("Upload link has already been used or expired.");
    }
    if (Date.now() > invitation.expiresAt) {
      await ctx.runMutation(internal.invitations.markExpired, { id: invitation._id });
      throw new Error("Upload link has expired. Ask the customer for a new one.");
    }

    // 2. Get ZIP blob from storage
    const zipBlob = await ctx.storage.get(args.zipStorageId);
    if (!zipBlob) throw new Error("ZIP not found in storage.");
    const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());
    if (zipBuffer.byteLength > MAX_ZIP_SIZE_BYTES) {
      throw new Error(`ZIP exceeds ${MAX_ZIP_SIZE_BYTES / 1e6}MB cap. Split into multiple uploads.`);
    }

    // 3. Create disciplineUpload record
    const uploadId = await ctx.runMutation(internal.uploads.create, {
      orgId: invitation.orgId,
      projectId: invitation.projectId,
      discipline: invitation.discipline,
      invitationId: invitation._id,
      zipStorageId: args.zipStorageId,
      uploadedBy: args.consultantEmail,
      uploadedAt: Date.now(),
    });

    // 4. Extract entries
    const zip = new StreamZip.async({ file: zipBufferToTempPath(zipBuffer) });
    const entries = await zip.entries();
    const extractedFiles: string[] = [];
    let totalSize = 0;
    let estimatedPages = 0;

    for (const [name, entry] of Object.entries(entries)) {
      if (entry.isDirectory) continue;

      const ext = name.toLowerCase().substring(name.lastIndexOf("."));
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        console.warn(`Skipping unsupported file: ${name}`);
        continue;
      }
      if (entry.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`Skipping oversized file: ${name} (${entry.size} bytes)`);
        continue;
      }

      const data = await zip.entryData(name);
      const fileStorageId = await ctx.storage.store(new Blob([data]));
      totalSize += entry.size;
      estimatedPages += estimatePagesFromSize(entry.size, ext);

      const fileId = await ctx.runMutation(internal.files.create, {
        orgId: invitation.orgId,
        packId: undefined, // legacy pack model; using disciplineUpload now
        fileName: name.split("/").pop() || name,
        filePath: name,
        mimeType: mimeFromExt(ext),
        sizeBytes: entry.size,
        storageId: fileStorageId,
        estimatedPages: estimatePagesFromSize(entry.size, ext),
      });
      extractedFiles.push(fileId);
    }
    await zip.close();

    // 5. Finalise upload
    await ctx.runMutation(internal.uploads.finalise, {
      uploadId,
      fileIds: extractedFiles,
      fileCount: extractedFiles.length,
      totalSizeBytes: totalSize,
      estimatedPages,
    });

    // 6. Mark invitation as consumed
    await ctx.runMutation(internal.invitations.markUploaded, { id: invitation._id });

    // 7. Trigger classification (async, fire-and-forget)
    await ctx.scheduler.runAfter(0, internal.classify.classifyDisciplineUpload, {
      uploadId,
    });

    return { uploadId, fileCount: extractedFiles.length, totalSizeBytes: totalSize };
  },
});

// ===== HELPERS =====

function hashToken(token: string): string {
  // In production: SHA-256 of token + server salt
  return require("crypto").createHash("sha256").update(token).digest("hex");
}

function zipBufferToTempPath(buf: Buffer): string {
  // Convex actions run in Node — write to /tmp for node-stream-zip
  const fs = require("fs");
  const path = require("path");
  const tmpPath = path.join("/tmp", `verifiq_zip_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`);
  fs.writeFileSync(tmpPath, buf);
  return tmpPath;
}

function estimatePagesFromSize(sizeBytes: number, ext: string): number {
  // Rough heuristic; refined post-classification by reading actual page count
  const bytesPerPage = {
    ".pdf":  60_000,   // ~60KB / page average
    ".docx": 25_000,
    ".xlsx": 8_000,
    ".xls":  8_000,
    ".dwg":  200_000,  // CAD = 1 sheet
    ".dxf":  150_000,
    ".rvt":  500_000,
  } as Record<string, number>;
  return Math.max(1, Math.round(sizeBytes / (bytesPerPage[ext] || 60_000)));
}

function mimeFromExt(ext: string): string {
  const map = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls":  "application/vnd.ms-excel",
    ".dwg":  "application/acad",
    ".dxf":  "application/dxf",
    ".rvt":  "application/octet-stream",
  } as Record<string, string>;
  return map[ext] || "application/octet-stream";
}
