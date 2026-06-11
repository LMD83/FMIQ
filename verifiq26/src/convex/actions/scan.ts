"use node";

/**
 * VerifIQ — Per-Discipline Scan Orchestrator
 *
 * Triggered after classification completes for a disciplineUpload.
 *
 * Responsibilities:
 *  1. Group classified files by doc-type (specs / drawings / schedules / reports)
 *  2. For each group, route to the appropriate processing strategy
 *  3. Call Anthropic with prompt-cached system prompt (corpus + skill persona)
 *  4. Stream findings back to Convex `findings` table with status='pending_review'
 *  5. Run source-quote verification gate — any finding without verbatim source quote is dropped
 *  6. On completion, check if cross-discipline pass should trigger
 *
 * Cost discipline:
 *  - Per-discipline budget enforced (Arch 35% / Mech 25% / CS 15% / Elec 12% / Fire 8% / Other 5%)
 *  - Files over per-file token cap (300k) are SAMPLED, not skipped
 *  - Prompt cache reduces system-prompt cost by ~90% across files
 *  - Cheap-model used for hygiene checks; frontier reserved for cross-discipline reasoning
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { callClaudeWithCache, ClaudeResponse } from "../lib/anthropicClient";
import { loadDisciplineCorpus, buildSystemPrompt } from "../lib/corpus";
import { verifySourceQuotes } from "../lib/sourceQuote";
import { extractPdfText, extractPdfImages } from "../lib/extract";

// Tier budgets (tunable per pack tier)
const TIER_TOKEN_BUDGETS = {
  small:     {  total:   600_000, perFile:  60_000 },
  mid:       {  total: 2_200_000, perFile: 120_000 },
  large:     {  total: 6_000_000, perFile: 200_000 },
  programme: {  total: 8_000_000, perFile: 250_000 },
  mega:      {  total: 16_000_000, perFile: 300_000 },
};

const DISCIPLINE_BUDGET_PCT = {
  arch:  0.35,
  cs:    0.15,
  mech:  0.18,
  elec:  0.12,
  fire:  0.08,
  qs:    0.07,
  bcar:  0.05,
};

export const scanDisciplineUpload = internalAction({
  args: { uploadId: v.id("disciplineUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.runQuery(internal.uploads.get, { id: args.uploadId });
    if (!upload || upload.scanStatus !== "queued") return;

    const project = await ctx.runQuery(internal.projects.get, { id: upload.projectId });
    if (!project) return;

    // Mark scanning
    await ctx.runMutation(internal.uploads.markScanning, { uploadId: args.uploadId });

    // Create check record for tracking cost + tokens
    const checkId = await ctx.runMutation(internal.checks.create, {
      orgId: upload.orgId,
      packId: undefined,
      initiatedBy: project.createdBy,
      tier: project.tier || "mid",
      corpusVersion: "v.2026.06",
      skillsRun: [`verifiq-${upload.discipline}-irish`],
    });

    // Compute budget
    const tierBudget = TIER_TOKEN_BUDGETS[project.tier || "mid"];
    const disciplinePct = DISCIPLINE_BUDGET_PCT[upload.discipline as keyof typeof DISCIPLINE_BUDGET_PCT] || 0.1;
    let budgetRemaining = tierBudget.total * disciplinePct;

    // Load classified files
    const files = await ctx.runQuery(internal.files.listClassifiedByUpload, {
      uploadId: args.uploadId,
    });

    // Load corpus + persona system prompt
    const corpus = await loadDisciplineCorpus(upload.discipline, "v.2026.06");
    const systemPrompt = buildSystemPrompt(upload.discipline, corpus);

    // Group files by doc-type for batching
    const grouped = groupByDocType(files);

    let totalFindings = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Process specs first (biggest, highest signal)
    for (const file of grouped.specifications) {
      if (budgetRemaining <= tierBudget.perFile * 0.5) break; // out of budget
      const result = await scanSpecFile(ctx, file, systemPrompt, tierBudget.perFile, upload);
      totalFindings += result.findingsCount;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      budgetRemaining -= (result.inputTokens + result.outputTokens);
    }

    // Then schedules (high data density)
    for (const file of grouped.schedules) {
      if (budgetRemaining <= tierBudget.perFile * 0.3) break;
      const result = await scanScheduleFile(ctx, file, systemPrompt, tierBudget.perFile / 2, upload);
      totalFindings += result.findingsCount;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      budgetRemaining -= (result.inputTokens + result.outputTokens);
    }

    // Then drawings via vision (parallelisable)
    const drawingBatch = grouped.drawings.slice(0, Math.floor(budgetRemaining / 20_000));
    const drawingResults = await Promise.all(
      drawingBatch.map(d => scanDrawingFile(ctx, d, systemPrompt, tierBudget.perFile / 4, upload))
    );
    for (const r of drawingResults) {
      totalFindings += r.findingsCount;
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
    }

    // Reports + register hygiene last (smallest impact)
    for (const file of [...grouped.reports, ...grouped.registers]) {
      if (budgetRemaining <= 30_000) break;
      const result = await scanHygieneFile(ctx, file, systemPrompt, 60_000, upload);
      totalFindings += result.findingsCount;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
    }

    // Finalise check
    await ctx.runMutation(internal.checks.complete, {
      checkId,
      findingCount: totalFindings,
      inputTokensConsumed: totalInputTokens,
      outputTokensConsumed: totalOutputTokens,
      inferenceCost_cents: Math.round(
        (totalInputTokens / 1_000_000) * 1200 +  // €12 per 1M input, in cents (€1=100c)
        (totalOutputTokens / 1_000_000) * 5000   // €50 per 1M output, in cents
      ),
    });

    // Mark discipline upload as scan-complete
    await ctx.runMutation(internal.uploads.markScanComplete, {
      uploadId: args.uploadId,
      checkId,
      findingsCount: totalFindings,
    });

    // Check if cross-discipline coordination should trigger
    const projectStatus = await ctx.runQuery(internal.projects.getStatus, { id: upload.projectId });
    if (shouldTriggerCrossDiscipline(projectStatus)) {
      await ctx.scheduler.runAfter(0, internal.coordinate.runCrossDisciplinePass, {
        projectId: upload.projectId,
      });
    }
  },
});

// ===================================================
// PER-FILE SCAN STRATEGIES
// ===================================================

async function scanSpecFile(
  ctx: any,
  file: any,
  systemPrompt: string,
  budgetTokens: number,
  upload: any
): Promise<{ findingsCount: number; inputTokens: number; outputTokens: number }> {
  // Extract spec text, chunk to ~50 pages per Claude call
  const text = await extractPdfText(ctx, file.storageId, file.estimatedPages);
  const chunks = chunkText(text, 50_000); // ~12k tokens per chunk

  let totalIn = 0, totalOut = 0, findingsCount = 0;

  for (const chunk of chunks) {
    if ((totalIn + totalOut) >= budgetTokens) break;

    const response = await callClaudeWithCache({
      model: "claude-sonnet-4-6-20250115",
      systemPrompt,           // cached — only paid for once across all calls
      userPrompt: `Spec extract — ${file.fileName} (${chunk.page_range}):\n\n${chunk.text}`,
      maxTokens: 4_000,
      cacheControl: { type: "ephemeral" },
    });

    totalIn += response.usage.input_tokens;
    totalOut += response.usage.output_tokens;

    // Source-quote verification gate
    const verified = await verifySourceQuotes(response.findings, [chunk.text]);

    // Persist verified findings
    for (const f of verified) {
      await ctx.runMutation(internal.findings.create, {
        orgId: upload.orgId,
        checkId: file.checkId,
        finding: {
          ...f,
          findingId: nextFindingId(upload.discipline, findingsCount),
          status: "pending_review",
          sourceFile: file.fileName,
          sourcePageRange: chunk.page_range,
        },
      });
      findingsCount++;
    }
  }

  return { findingsCount, inputTokens: totalIn, outputTokens: totalOut };
}

async function scanScheduleFile(ctx: any, file: any, systemPrompt: string, budget: number, upload: any) {
  // Schedules are dense tables; read full text, check for blank fields, inconsistencies, value drift
  const text = await extractPdfText(ctx, file.storageId, file.estimatedPages);

  const response = await callClaudeWithCache({
    model: "claude-sonnet-4-6-20250115",
    systemPrompt,
    userPrompt: `Schedule sheet — ${file.fileName}:\n\n${text.slice(0, 40_000)}\n\nCheck for: blank required fields, inconsistent values, missing standards references, content mismatched to schedule name.`,
    maxTokens: 3_000,
    cacheControl: { type: "ephemeral" },
  });

  const verified = await verifySourceQuotes(response.findings, [text]);
  let count = 0;
  for (const f of verified) {
    await ctx.runMutation(internal.findings.create, { orgId: upload.orgId, checkId: file.checkId,
      finding: { ...f, findingId: nextFindingId(upload.discipline, count), status: "pending_review", sourceFile: file.fileName },
    });
    count++;
  }
  return { findingsCount: count, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

async function scanDrawingFile(ctx: any, file: any, systemPrompt: string, budget: number, upload: any) {
  // Drawings: vision-based, page-by-page
  const images = await extractPdfImages(ctx, file.storageId, file.estimatedPages);
  let totalIn = 0, totalOut = 0, findingsCount = 0;

  for (const img of images.slice(0, 8)) { // cap pages per drawing
    const response = await callClaudeWithCache({
      model: "claude-sonnet-4-6-20250115",
      systemPrompt,
      userPrompt: `Drawing page — ${file.fileName} (page ${img.page}):\n\nCheck title block, drawing number, status code, revision, scale, dimensions, standards references.`,
      images: [img.base64],
      maxTokens: 2_000,
      cacheControl: { type: "ephemeral" },
    });

    totalIn += response.usage.input_tokens;
    totalOut += response.usage.output_tokens;

    const verified = await verifySourceQuotes(response.findings, [`Drawing ${file.fileName} page ${img.page}`]);
    for (const f of verified) {
      await ctx.runMutation(internal.findings.create, { orgId: upload.orgId, checkId: file.checkId,
        finding: { ...f, findingId: nextFindingId(upload.discipline, findingsCount), status: "pending_review", sourceFile: file.fileName, sourcePageRange: String(img.page) },
      });
      findingsCount++;
    }
  }
  return { findingsCount, inputTokens: totalIn, outputTokens: totalOut };
}

async function scanHygieneFile(ctx: any, file: any, systemPrompt: string, budget: number, upload: any) {
  // Use CHEAP model for register / drawing-index hygiene
  const text = await extractPdfText(ctx, file.storageId, file.estimatedPages);
  const response = await callClaudeWithCache({
    model: "claude-haiku-4-5-20251001", // cheap model — hygiene only
    systemPrompt,
    userPrompt: `Document hygiene check — ${file.fileName}:\n\n${text.slice(0, 20_000)}\n\nFlag: blank fields, spelling errors, duplicate drawing numbers, missing revision codes, status code inconsistencies.`,
    maxTokens: 1_500,
    cacheControl: { type: "ephemeral" },
  });

  const verified = await verifySourceQuotes(response.findings, [text]);
  let count = 0;
  for (const f of verified) {
    await ctx.runMutation(internal.findings.create, { orgId: upload.orgId, checkId: file.checkId,
      finding: { ...f, findingId: nextFindingId(upload.discipline, count), status: "pending_review", sourceFile: file.fileName },
    });
    count++;
  }
  return { findingsCount: count, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

// ===================================================
// HELPERS
// ===================================================

function groupByDocType(files: any[]) {
  return {
    specifications: files.filter(f => f.docType === "specification"),
    schedules:      files.filter(f => f.docType === "schedule"),
    drawings:       files.filter(f => f.docType === "drawing"),
    reports:        files.filter(f => f.docType === "report"),
    registers:      files.filter(f => f.docType === "register"),
    other:          files.filter(f => !["specification","schedule","drawing","report","register"].includes(f.docType)),
  };
}

function chunkText(text: string, maxCharsPerChunk: number) {
  const chunks = [];
  let current = "", page = 1, pageStart = 1;
  const pages = text.split(/\f|\n--- Page \d+ ---\n/);
  for (const p of pages) {
    if (current.length + p.length > maxCharsPerChunk) {
      chunks.push({ text: current, page_range: `p.${pageStart}-${page-1}` });
      current = p;
      pageStart = page;
    } else {
      current += "\n\n" + p;
    }
    page++;
  }
  if (current) chunks.push({ text: current, page_range: `p.${pageStart}-${page-1}` });
  return chunks;
}

let findingCounter = 0;
function nextFindingId(disc: string, base: number): string {
  findingCounter++;
  const prefix = ({ arch: "A", cs: "S", mech: "M", elec: "E", fire: "F", qs: "Q", bcar: "B" } as any)[disc] || "X";
  return `${prefix}-${String(findingCounter).padStart(3, "0")}`;
}

function shouldTriggerCrossDiscipline(projectStatus: any): boolean {
  // Run cross-disc pass when 3+ disciplines have completed
  // OR when customer manually triggers
  const completedDisciplines = projectStatus.disciplineUploads.filter(
    (du: any) => du.scanStatus === "completed"
  ).length;
  return completedDisciplines >= 3;
}
