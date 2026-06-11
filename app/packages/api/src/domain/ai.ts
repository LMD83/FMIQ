/**
 * AI assistance ports (P3): fault triage and an O&M assistant. Both are behind a
 * gateway interface with a deterministic, no-LLM default (rule-based) so dev/test never
 * call out; a Claude adapter (adapters/ai/claude.ts, model claude-opus-4-8) is resolved
 * when ANTHROPIC_API_KEY is configured. Critical-asset actions stay human-in-the-loop.
 */

export type WorkOrderPriority = 'routine' | 'high' | 'critical';

export interface TriageResult {
  category: string; // water | fire | electrical | collection_care | mechanical | general
  priority: WorkOrderPriority;
  summary: string;
}

export interface TriageGateway {
  triage(report: string): Promise<TriageResult>;
}

export interface AssistantGateway {
  answer(question: string, context: string[]): Promise<string>;
}

/** Normalise a possibly-untrusted triage payload (from an LLM) into a safe result. */
export function normaliseTriage(raw: { category?: unknown; priority?: unknown; summary?: unknown }, fallbackSummary = ''): TriageResult {
  const category = typeof raw.category === 'string' ? raw.category : 'general';
  const p = typeof raw.priority === 'string' ? raw.priority : 'routine';
  const priority: WorkOrderPriority = p === 'critical' ? 'critical' : p === 'high' ? 'high' : 'routine';
  const summary = typeof raw.summary === 'string' && raw.summary.length > 0 ? raw.summary : fallbackSummary;
  return { category, priority, summary };
}

/** Deterministic keyword triage — the default, and a safe fallback if the LLM errors. */
export const ruleBasedTriage: TriageGateway = {
  async triage(report: string): Promise<TriageResult> {
    const r = report.toLowerCase();
    const summary = report.trim().slice(0, 140);
    if (/(fire|smoke|alarm|burning)/.test(r)) return { category: 'fire', priority: 'critical', summary };
    if (/(water|leak|flood|burst|damp)/.test(r)) return { category: 'water', priority: 'high', summary };
    if (/(mould|mold|pest|moth|humidity|\brh\b|condensation|silverfish)/.test(r)) return { category: 'collection_care', priority: 'high', summary };
    if (/(electric|power|spark|tripped|breaker)/.test(r)) return { category: 'electrical', priority: 'high', summary };
    if (/(hvac|chiller|ahu|boiler|pump|lift|fan)/.test(r)) return { category: 'mechanical', priority: 'routine', summary };
    return { category: 'general', priority: 'routine', summary };
  },
};

/** Deterministic assistant — returns the most relevant retrieved snippet (keyword overlap). */
export const ruleBasedAssistant: AssistantGateway = {
  async answer(question: string, context: string[]): Promise<string> {
    if (context.length === 0) return 'No O&M documentation is available for this asset yet.';
    const q = new Set(question.toLowerCase().split(/\W+/).filter(Boolean));
    let best = context[0];
    let bestScore = -1;
    for (const c of context) {
      const score = c.toLowerCase().split(/\W+/).filter((w) => q.has(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  },
};
