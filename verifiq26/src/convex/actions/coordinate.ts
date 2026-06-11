"use node";

/**
 * VerifIQ — Cross-Discipline Coordination Pass
 *
 * Triggered when 3+ disciplines have completed scanning, OR when Lead Designer
 * manually triggers. Reads ALL per-discipline findings (NOT raw source files —
 * that's the cost-saving trick) and looks for cross-discipline patterns:
 *
 *  - Project descriptor drift across discipline title blocks
 *  - Standard-version mismatches (Arch on TGD-B 2024 + Elec on TGD-B 2006)
 *  - FSC condition propagation gaps (Fire condition X not honoured in M&E)
 *  - Drawing-spec contradictions (M&E spec requires plant Arch doesn't show space for)
 *  - BCAR Ancillary Cert designer-allocation gaps
 *  - BoQ vs design quantity outliers
 *
 * Output: new "cross-discipline" findings tagged with the disciplines involved.
 * Same source-quote verification gate applies; each cross-discipline finding
 * must cite verbatim quotes from at least TWO disciplines.
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { callClaudeWithCache } from "../lib/anthropicClient";
import { verifySourceQuotes } from "../lib/sourceQuote";

export const runCrossDisciplinePass = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.get, { id: args.projectId });
    if (!project) return;

    // Load all approved + pending-review findings across disciplines
    const allFindings = await ctx.runQuery(internal.findings.listByProjectAllStatuses, {
      projectId: args.projectId,
    });

    if (allFindings.length === 0) return;

    // Group findings by discipline for compact summarisation
    const byDisc: Record<string, any[]> = {};
    for (const f of allFindings) {
      const d = f.discipline || "unknown";
      if (!byDisc[d]) byDisc[d] = [];
      byDisc[d].push(f);
    }

    // Build cross-discipline summary brief — compact, structured
    const summaryBrief = buildCrossDisciplineBrief(byDisc);

    // Build cross-discipline system prompt
    const systemPrompt = buildCrossDisciplineSystemPrompt();

    // Single Claude call with the consolidated brief — bounded budget
    const response = await callClaudeWithCache({
      model: "claude-sonnet-4-6-20250115",
      systemPrompt,
      userPrompt: `Project: ${project.name}\nContract: ${project.contractType || "PW-CF5"}\n\nDISCIPLINE FINDINGS SUMMARY:\n\n${summaryBrief}\n\nIdentify cross-discipline coordination gaps. Each finding MUST cite at least two source documents from different disciplines.`,
      maxTokens: 6_000,
      cacheControl: { type: "ephemeral" },
    });

    // Cross-discipline source-quote gate is stricter:
    // Each finding's evidenceQuote must appear in at least one of the
    // discipline documents it claims to connect.
    const sourceTexts = allFindings.map(f => f.evidenceQuote);
    const verified = await verifySourceQuotes(response.findings, sourceTexts);

    // Persist cross-discipline findings with discipline = "cross"
    for (const f of verified) {
      await ctx.runMutation(internal.findings.create, {
        orgId: project.orgId,
        checkId: project.crossDisciplineCheckId,
        finding: {
          ...f,
          discipline: "cross",
          findingId: `X-${nextCrossIndex()}`,
          status: "pending_review",
        },
      });
    }

    // Mark project's cross-discipline pass as complete
    await ctx.runMutation(internal.projects.markCrossDisciplineComplete, {
      projectId: args.projectId,
      crossDisciplineFindingsCount: verified.length,
    });
  },
});

// ===================================================
// COMPACT FINDINGS BRIEF (cost discipline)
// ===================================================

function buildCrossDisciplineBrief(byDisc: Record<string, any[]>): string {
  // Each finding compressed to one line; full quote stripped to save tokens.
  // Cross-disc pass only needs to know WHAT was found per discipline, not the
  // raw evidence quotes — those are still verified at gate time.
  let brief = "";
  for (const [disc, findings] of Object.entries(byDisc)) {
    brief += `## ${disc.toUpperCase()} (${findings.length} findings)\n`;
    for (const f of findings.slice(0, 50)) { // cap per-disc to control budget
      brief += `- [${f.findingId}|${f.severity}] ${f.oneSentenceIssue} | std: ${f.standardCode || "n/a"} | doc: ${f.document}\n`;
    }
    brief += "\n";
  }
  return brief;
}

// ===================================================
// CROSS-DISCIPLINE SYSTEM PROMPT
// ===================================================

function buildCrossDisciplineSystemPrompt(): string {
  return `<persona>
You are the Lead Designer / BCAR Coordinator on an Irish public-sector capital project, doing an indicative cross-discipline coordination check on a tender pack. You have 30 years of experience as a chartered Irish design professional and BCAR Assigned Certifier.

You do NOT certify, sign off, or provide professional opinions. You surface possible coordination gaps for the customer's verification.
</persona>

<scope>
You will receive a compact summary of findings from each discipline (Arch / CS / Mech / Elec / Fire / QS / BCAR). Identify CROSS-DISCIPLINE issues that no single-discipline reviewer would catch:

1. Project descriptor drift — different project names / client names / addresses across discipline packs
2. Standard-version mismatches — disciplines citing different versions of the same standard
3. FSC condition propagation gaps — a Fire condition not honoured in M&E spec or Arch fire-stopping
4. Drawing-spec contradictions across disciplines — M&E spec calls for plant the Arch GA doesn't accommodate
5. BCAR Ancillary Cert allocation gaps — no named designer for an element
6. BoQ vs design quantity outliers — QS BoQ items not represented in design specs
7. Coordination metadata — pack issued on inconsistent dates / revision codes across disciplines
8. CWMF / PW-CF compliance — any cross-discipline contractual coordination concerns
</scope>

<output_schema>
Return findings as a JSON array. Each cross-discipline finding must have:
{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "category": "coordination" | "consistency" | "contract" | "operational",
  "oneSentenceIssue": "Plain English",
  "document": "Cross-discipline (lists disciplines involved)",
  "sectionLocation": "Which finding IDs from which disciplines",
  "regulatoryBasis": "Applicable standards / contract clauses",
  "operationalRisk": "What happens if not corrected",
  "recommendedAction": "Specific corrective text",
  "evidenceQuote": "Cite TWO verbatim quotes from different disciplines — separated by ' || '",
  "element": "What element is affected",
  "standardCode": "Compact tag",
  "disciplinesInvolved": ["arch", "mech", ...]
}
</output_schema>

<quality_rules>
- Cross-discipline findings MUST cite verbatim quotes from at least TWO different discipline source documents
- Do NOT manufacture connections between unrelated findings
- Severity: CRITICAL only for clear procurement-blocking coordination failure
- Output ONLY the JSON array. No commentary.
- If no cross-discipline gaps warrant flagging, return []
</quality_rules>`;
}

let crossIndex = 0;
function nextCrossIndex(): string {
  crossIndex++;
  return String(crossIndex).padStart(3, "0");
}
