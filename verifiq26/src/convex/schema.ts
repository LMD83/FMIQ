/**
 * VerifIQ MVP — Convex schema
 *
 * Tables used by the upload → classify → scan → release pipeline.
 * Aligns with actions in convex/actions/ and platform architecture doc.
 */

import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const PackTier = v.union(
  v.literal("small"),
  v.literal("mid"),
  v.literal("large"),
  v.literal("programme"),
  v.literal("mega"),
);

export const ScanPhase = v.union(
  v.literal("pending"),
  v.literal("uploading"),
  v.literal("classifying"),
  v.literal("confirm_classify"),
  v.literal("scanning"),
  v.literal("cross_ref"),
  v.literal("peer_challenge"),
  v.literal("adjudicate"),
  v.literal("reviewer_queue"),
  v.literal("released"),
);

export const InvitationStatus = v.union(
  v.literal("sent"),
  v.literal("opened"),
  v.literal("uploaded"),
  v.literal("expired"),
);

export const UploadScanStatus = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("scanning"),
  v.literal("completed"),
  v.literal("failed"),
);

export const FindingSeverity = v.union(
  v.literal("CRITICAL"),
  v.literal("HIGH"),
  v.literal("MEDIUM"),
  v.literal("LOW"),
);

export const FindingReviewStatus = v.union(
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
);

export default defineSchema({
  ...authTables,

  organizations: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  projects: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    contractType: v.optional(v.string()),
    tier: v.optional(PackTier),
    createdBy: v.string(),
    crossDisciplineCheckId: v.optional(v.id("checks")),
    crossDisciplineComplete: v.optional(v.boolean()),
    crossDisciplineFindingsCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"]),

  uploadInvitations: defineTable({
    orgId: v.id("organizations"),
    projectId: v.id("projects"),
    discipline: v.string(),
    tokenHash: v.string(),
    status: InvitationStatus,
    expiresAt: v.number(),
    consultantEmail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_project", ["projectId"]),

  disciplineUploads: defineTable({
    orgId: v.id("organizations"),
    projectId: v.id("projects"),
    discipline: v.string(),
    invitationId: v.optional(v.id("uploadInvitations")),
    zipStorageId: v.id("_storage"),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
    fileIds: v.array(v.id("files")),
    fileCount: v.number(),
    totalSizeBytes: v.number(),
    estimatedPages: v.number(),
    classificationStatus: v.optional(
      v.union(v.literal("pending"), v.literal("classified")),
    ),
    scanStatus: UploadScanStatus,
    checkId: v.optional(v.id("checks")),
    findingsCount: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_discipline", ["projectId", "discipline"]),

  files: defineTable({
    orgId: v.id("organizations"),
    uploadId: v.optional(v.id("disciplineUploads")),
    packId: v.optional(v.string()),
    fileName: v.string(),
    filePath: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id("_storage"),
    estimatedPages: v.number(),
    discipline: v.optional(v.string()),
    docType: v.optional(v.string()),
    classificationConfidence: v.optional(v.number()),
    classificationMethod: v.optional(v.string()),
    checkId: v.optional(v.id("checks")),
  })
    .index("by_upload", ["uploadId"]),

  findings: defineTable({
    orgId: v.id("organizations"),
    projectId: v.id("projects"),
    checkId: v.optional(v.id("checks")),
    findingId: v.string(),
    discipline: v.string(),
    severity: FindingSeverity,
    category: v.string(),
    oneSentenceIssue: v.string(),
    document: v.string(),
    sectionLocation: v.optional(v.string()),
    regulatoryBasis: v.string(),
    operationalRisk: v.string(),
    recommendedAction: v.string(),
    evidenceQuote: v.string(),
    element: v.optional(v.string()),
    standardCode: v.optional(v.string()),
    status: FindingReviewStatus,
    sourceFile: v.optional(v.string()),
    sourcePageRange: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_check", ["checkId"]),

  checks: defineTable({
    orgId: v.id("organizations"),
    packId: v.optional(v.string()),
    initiatedBy: v.string(),
    tier: PackTier,
    corpusVersion: v.string(),
    skillsRun: v.array(v.string()),
    status: v.union(v.literal("running"), v.literal("completed")),
    findingCount: v.optional(v.number()),
    inputTokensConsumed: v.optional(v.number()),
    outputTokensConsumed: v.optional(v.number()),
    inferenceCost_cents: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"]),

  scanStates: defineTable({
    projectId: v.id("projects"),
    phase: ScanPhase,
    progressPct: v.number(),
    etaMs: v.optional(v.number()),
    filesProcessed: v.optional(v.number()),
    filesTotal: v.optional(v.number()),
    findingsCount: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  auditLog: defineTable({
    orgId: v.optional(v.id("organizations")),
    projectId: v.optional(v.id("projects")),
    actor: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    payloadJson: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_occurred", ["occurredAt"]),
});
