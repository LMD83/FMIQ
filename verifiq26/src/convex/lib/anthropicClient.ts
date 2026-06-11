/**
 * VerifIQ — Anthropic API Client Wrapper
 *
 * Wraps the Anthropic SDK with:
 *  - Prompt caching for system prompts (corpus + skill persona reused across files)
 *  - Multi-provider fallback (Anthropic primary → OpenAI on persistent failure)
 *  - Retry with exponential backoff on rate limit / 5xx
 *  - Structured findings extraction from JSON response
 *  - Cost tracking per call
 *
 * Prompt cache delivers ~90% cost reduction on the cached portion (system prompt
 * containing the 800+ standards corpus + skill persona ~12k tokens).
 */

import { Anthropic } from "@anthropic-ai/sdk";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

export interface ClaudeRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  images?: string[];        // base64-encoded image data
  cacheControl?: { type: "ephemeral" };
}

export interface ClaudeResponse {
  findings: Array<{
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
  }>;
  usage: { input_tokens: number; output_tokens: number };
  raw: any;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaudeWithCache(req: ClaudeRequest): Promise<ClaudeResponse> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages: any[] = [];

      // Build user message with optional image
      const userContent: any[] = [];
      if (req.images?.length) {
        for (const img of req.images) {
          userContent.push({
            type: "image",
            source: { type: "base64", media_type: "image/png", data: img },
          });
        }
      }
      userContent.push({ type: "text", text: req.userPrompt });
      messages.push({ role: "user", content: userContent });

      // System prompt with cache control marker
      // The system prompt block is cached for ~5 mins; subsequent calls within
      // that window pay ~10% of original cost for the cached portion.
      const systemBlocks: any[] = [
        {
          type: "text",
          text: req.systemPrompt,
          cache_control: req.cacheControl,
        },
      ];

      const response = await anthropic.messages.create({
        model: req.model,
        system: systemBlocks,
        messages,
        max_tokens: req.maxTokens || 4_000,
      });

      // Parse JSON findings from response
      const text = response.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");

      const findings = parseFindings(text);

      return {
        findings,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
        raw: response,
      };
    } catch (err: any) {
      lastError = err;

      // Rate limit or 5xx — retry with backoff
      const isRetryable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!isRetryable || attempt === MAX_RETRIES) break;

      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // All retries failed — try OpenAI fallback (production code; stubbed here)
  if (process.env.OPENAI_FALLBACK === "1") {
    return await callOpenAIFallback(req);
  }

  throw lastError || new Error("Claude API call failed after retries.");
}

// ===========================================================
// FINDINGS PARSING
// ===========================================================

function parseFindings(text: string): ClaudeResponse["findings"] {
  // Claude is prompted to return findings as JSON array.
  // Multiple strategies for resilience: code-block, raw array, line-delimited.
  try {
    // Look for a fenced JSON block first
    const fencedMatch = text.match(/```json\s*([\s\S]+?)\s*```/);
    if (fencedMatch) return JSON.parse(fencedMatch[1]);

    // Then try raw array
    const arrayMatch = text.match(/\[[\s\S]+\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);

    // Then try line-delimited JSON objects
    const lines = text.split("\n").filter((l) => l.trim().startsWith("{"));
    return lines.map((l) => JSON.parse(l)).filter(Boolean);
  } catch (e) {
    console.warn("Failed to parse findings JSON:", e);
    return [];
  }
}

// ===========================================================
// FALLBACK (stubbed — production wires up OpenAI Chat Completions)
// ===========================================================

async function callOpenAIFallback(req: ClaudeRequest): Promise<ClaudeResponse> {
  // Production: call OpenAI with equivalent prompt + parse same finding schema
  // Stubbed here to keep POC focused.
  throw new Error("OpenAI fallback not implemented in POC.");
}

// ===========================================================
// COST UTILITIES
// ===========================================================

const PRICING_PER_M_TOKENS = {
  "claude-sonnet-4-6-20250115":  { input: 12, output: 50 }, // €
  "claude-haiku-4-5-20251001":   { input: 0.8, output: 3 }, // €
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_PER_M_TOKENS[model as keyof typeof PRICING_PER_M_TOKENS];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}
