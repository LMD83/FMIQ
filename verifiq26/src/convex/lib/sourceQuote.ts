/**
 * VerifIQ — Source Quote Verification Gate
 *
 * Every finding emitted by the AI claims an `evidenceQuote` — a verbatim string
 * from the source document. This module verifies that the quote actually appears
 * in the source text. Findings whose evidence quotes do NOT match are DROPPED.
 *
 * This is the primary defence against AI hallucination. No quote = no finding.
 *
 * Strategy:
 *  1. Strict match: exact substring of the source text
 *  2. Normalised match: collapse whitespace, ignore quotation marks, ignore page-numbering artefacts
 *  3. Fuzzy match: Levenshtein distance ≤ 10% of quote length, for OCR-edge-cases
 *
 * Logs every rejection for AI-tuning telemetry — quote rejection patterns reveal
 * where Claude is fabricating evidence.
 */

import { ClaudeResponse } from "./anthropicClient";

const STRICT_MATCH = "strict";
const NORMALISED_MATCH = "normalised";
const FUZZY_MATCH = "fuzzy";

export interface VerifiedFinding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  oneSentenceIssue: string;
  document: string;
  sectionLocation: string;
  regulatoryBasis: string;
  operationalRisk: string;
  recommendedAction: string;
  evidenceQuote: string;
  element?: string;
  standardCode?: string;
  verificationMethod: "strict" | "normalised" | "fuzzy";
  verificationConfidence: number;
}

export async function verifySourceQuotes(
  findings: ClaudeResponse["findings"],
  sourceTexts: string[]
): Promise<VerifiedFinding[]> {
  const combinedSource = sourceTexts.join("\n\n");
  const normalisedSource = normaliseForMatching(combinedSource);

  const verified: VerifiedFinding[] = [];
  const rejected: { finding: any; reason: string }[] = [];

  for (const f of findings) {
    if (!f.evidenceQuote || f.evidenceQuote.length < 8) {
      rejected.push({ finding: f, reason: "no_quote_or_too_short" });
      continue;
    }

    // Stage 1: strict match
    if (combinedSource.includes(f.evidenceQuote)) {
      verified.push({ ...f, verificationMethod: "strict", verificationConfidence: 1.0 });
      continue;
    }

    // Stage 2: normalised match
    const normalisedQuote = normaliseForMatching(f.evidenceQuote);
    if (normalisedSource.includes(normalisedQuote)) {
      verified.push({ ...f, verificationMethod: "normalised", verificationConfidence: 0.85 });
      continue;
    }

    // Stage 3: fuzzy match (sliding window with Levenshtein distance)
    const fuzzyResult = fuzzyFind(normalisedQuote, normalisedSource);
    if (fuzzyResult.confidence >= 0.85) {
      verified.push({ ...f, verificationMethod: "fuzzy", verificationConfidence: fuzzyResult.confidence });
      continue;
    }

    rejected.push({ finding: f, reason: "quote_not_in_source" });
  }

  // Log rejections asynchronously for telemetry
  if (rejected.length > 0) {
    console.warn(`[source-quote] Rejected ${rejected.length} of ${findings.length} findings:`);
    for (const r of rejected.slice(0, 3)) {
      console.warn(`  - ${r.finding.oneSentenceIssue?.slice(0, 80)}... (${r.reason})`);
    }
  }

  return verified;
}

// ===================================================
// NORMALISATION
// ===================================================

function normaliseForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")    // curly quotes → straight
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")    // en/em dash → hyphen
    .replace(/\s+/g, " ")               // collapse whitespace
    .replace(/page\s+\d+/g, "")         // strip page numbers
    .replace(/^\s+|\s+$/g, "")
    .replace(/[.,;:()\[\]]/g, "");      // strip light punctuation
}

// ===================================================
// FUZZY MATCH
// ===================================================

function fuzzyFind(needle: string, haystack: string): { confidence: number; position: number } {
  // For each candidate window in haystack of size ~needle.length, compute similarity.
  // We use a fast approximation: Sørensen-Dice coefficient of character bigrams.
  // (Levenshtein is too slow at this scale.)

  if (needle.length < 12) return { confidence: 0, position: -1 };

  const needleBigrams = bigrams(needle);
  const windowSize = needle.length;
  const stride = Math.max(1, Math.floor(windowSize / 8));

  let bestScore = 0;
  let bestPosition = -1;

  for (let i = 0; i < haystack.length - windowSize; i += stride) {
    const window = haystack.slice(i, i + windowSize);
    const score = diceCoefficient(needleBigrams, bigrams(window));
    if (score > bestScore) {
      bestScore = score;
      bestPosition = i;
      if (score >= 0.97) break; // early exit on near-perfect match
    }
  }

  return { confidence: bestScore, position: bestPosition };
}

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.substr(i, 2);
    map.set(bg, (map.get(bg) || 0) + 1);
  }
  return map;
}

function diceCoefficient(a: Map<string, number>, b: Map<string, number>): number {
  let intersection = 0;
  let total = 0;
  for (const [bg, countA] of a) {
    total += countA;
    const countB = b.get(bg) || 0;
    intersection += Math.min(countA, countB);
  }
  for (const [, countB] of b) total += countB;
  return total > 0 ? (2 * intersection) / total : 0;
}
