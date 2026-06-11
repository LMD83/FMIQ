// Pure formatting helpers shared by the operations screens. Kept dependency-free and
// pure so they are unit-testable in the node test environment (no DOM).

export type Tone = 'ok' | 'watch' | 'crit' | 'neutral';

/** Map a work-order/request priority to a badge tone + label (text, never colour alone). */
export function priorityBadge(priority: string): { tone: Tone; label: string } {
  switch (priority) {
    case 'critical': return { tone: 'crit', label: 'Critical' };
    case 'high': return { tone: 'watch', label: 'High' };
    default: return { tone: 'neutral', label: 'Routine' };
  }
}

/**
 * Derive an SLA badge from the due date relative to now (client-side mirror of the
 * server `slaState`): met/closed → ok; >25% headroom → on track; ≤25% → at risk;
 * past due → breached. `openedAt` is optional; without it we fall back to a 24h window.
 */
export function slaBadge(slaDue: string | null, opts: { closed?: boolean; openedAt?: string | null; now?: Date } = {}): { tone: Tone; label: string } {
  if (opts.closed) return { tone: 'ok', label: 'Met' };
  if (!slaDue) return { tone: 'neutral', label: 'No SLA' };
  const now = opts.now ?? new Date();
  const due = new Date(slaDue).getTime();
  if (now.getTime() > due) return { tone: 'crit', label: 'Breached' };
  const opened = opts.openedAt ? new Date(opts.openedAt).getTime() : due - 24 * 60 * 60 * 1000;
  const elapsed = (now.getTime() - opened) / (due - opened);
  return elapsed >= 0.75 ? { tone: 'watch', label: 'At risk' } : { tone: 'ok', label: 'On track' };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  om_manual: 'O&M manual', drawing: 'Drawing', certificate: 'Certificate', warranty: 'Warranty',
  policy: 'Policy', rams: 'RAMS', datasheet: 'Datasheet', report: 'Report', specification: 'Specification', other: 'Other',
};
export function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

/** PPM statutory classification (red/pink/amber/green) → badge tone + label. */
export function classificationBadge(classification: string | null): { tone: Tone; label: string } {
  switch (classification) {
    case 'red': return { tone: 'crit', label: 'Red — statutory' };
    case 'pink': return { tone: 'crit', label: 'Pink — statutory' };
    case 'amber': return { tone: 'watch', label: 'Amber' };
    case 'green': return { tone: 'ok', label: 'Green' };
    default: return { tone: 'neutral', label: classification ?? '—' };
  }
}

/** Certificate status → badge tone + label. */
export function certStatusBadge(status: string): { tone: Tone; label: string } {
  switch (status) {
    case 'valid': return { tone: 'ok', label: 'Valid' };
    case 'expired': return { tone: 'crit', label: 'Expired' };
    case 'superseded': return { tone: 'neutral', label: 'Superseded' };
    default: return { tone: 'neutral', label: status };
  }
}

/**
 * Stock level vs minimum → badge. At/below min → reorder; within 20% → low; else OK.
 * Accepts numbers or numeric strings (pg returns numeric columns as strings).
 */
export function stockBadge(onHand: number | string | null, min: number | string | null): { tone: Tone; label: string } {
  if (onHand == null) return { tone: 'neutral', label: '—' };
  const oh = Number(onHand);
  const mn = min == null ? null : Number(min);
  if (Number.isNaN(oh)) return { tone: 'neutral', label: '—' };
  if (mn != null && oh <= mn) return { tone: 'crit', label: 'Reorder' };
  if (mn != null && oh <= mn * 1.2) return { tone: 'watch', label: 'Low' };
  return { tone: 'ok', label: 'In stock' };
}

/** Requisition status → badge tone + label. */
export function requisitionBadge(status: string): { tone: Tone; label: string } {
  switch (status) {
    case 'approved': return { tone: 'ok', label: 'Approved' };
    case 'rejected': return { tone: 'crit', label: 'Rejected' };
    case 'committed': return { tone: 'ok', label: 'Committed' };
    case 'pending_approval': return { tone: 'watch', label: 'Pending' };
    case 'draft': return { tone: 'neutral', label: 'Draft' };
    default: return { tone: 'neutral', label: status };
  }
}

/** Short, locale-stable date for tables (en-IE). Falls back to em dash. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IE');
}
