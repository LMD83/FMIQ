import Anthropic from '@anthropic-ai/sdk';
import { normaliseTriage, ruleBasedTriage, type AssistantGateway, type TriageGateway, type TriageResult } from '../../domain/ai.js';

/**
 * Claude adapters for the AI ports (model claude-opus-4-8, adaptive thinking). Resolved
 * only when ANTHROPIC_API_KEY is set (see adapters/resolve.ts). On any API error we fall
 * back to the deterministic rule-based gateway so triage never hard-fails.
 */

const MODEL = 'claude-opus-4-8';

function textOf(content: Anthropic.ContentBlock[]): string {
  let out = '';
  for (const block of content) if (block.type === 'text') out += block.text;
  return out;
}

/** Tolerant JSON extraction — the model is asked for JSON only, but be defensive. */
function parseTriageText(text: string, fallbackSummary: string): TriageResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return normaliseTriage({}, fallbackSummary);
  try {
    return normaliseTriage(JSON.parse(match[0]), fallbackSummary);
  } catch {
    return normaliseTriage({}, fallbackSummary);
  }
}

export function claudeTriageGateway(client: Anthropic): TriageGateway {
  return {
    async triage(report: string): Promise<TriageResult> {
      try {
        // `thinking: {type:'adaptive'}` is the correct value for claude-opus-4-8; the
        // installed SDK's types pre-date adaptive thinking, hence the cast.
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          thinking: { type: 'adaptive' },
          system:
            'You triage facilities fault reports for the National Museum of Ireland. ' +
            'Return ONLY a JSON object: {"category": one of water|fire|electrical|collection_care|mechanical|general, ' +
            '"priority": one of routine|high|critical, "summary": a one-line plain-English summary}. ' +
            'Anything threatening the collection or life-safety is at least high.',
          messages: [{ role: 'user', content: report }],
        } as unknown as Anthropic.MessageCreateParamsNonStreaming);
        return parseTriageText(textOf(res.content), report.trim().slice(0, 140));
      } catch {
        return ruleBasedTriage.triage(report); // never hard-fail triage
      }
    },
  };
}

export function claudeAssistantGateway(client: Anthropic): AssistantGateway {
  return {
    async answer(question: string, context: string[]): Promise<string> {
      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2048,
          thinking: { type: 'adaptive' },
          system:
            'You are a bilingual (EN/GA) O&M assistant for museum facilities staff. Answer ONLY from the ' +
            'provided O&M context. If the answer is not in the context, say so plainly. Be concise.',
          messages: [{ role: 'user', content: `Context:\n${context.join('\n---\n')}\n\nQuestion: ${question}` }],
        } as unknown as Anthropic.MessageCreateParamsNonStreaming);
        return textOf(res.content);
      } catch {
        return 'The O&M assistant is unavailable right now.';
      }
    },
  };
}
