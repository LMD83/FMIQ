import type { ReactNode } from 'react';
import { StatusBadge } from '../../../components/StatusBadge';
import type { RagTone } from '../../../components/StatusBadge';
import type { MappingProvenance, RowCounts, SessionStatus } from './importApi';

export const STEP_NAMES = ['Upload', 'Map columns', 'Map values', 'Validate', 'Hierarchy', 'Dedupe', 'Dry-run', 'Commit'] as const;

/**
 * Wizard progress stepper. Forward movement happens only through each step's
 * primary action; the stepper itself navigates back to completed steps.
 */
export function Stepper({ current, maxReached, locked, onGo }: {
  current: number; maxReached: number; locked: boolean; onGo: (step: number) => void;
}) {
  return (
    <nav aria-label="Import progress" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 18 }}>
      {STEP_NAMES.map((name, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        const reachable = !locked && step <= maxReached && step !== current;
        return (
          <button
            key={name}
            type="button"
            disabled={!reachable}
            aria-current={active ? 'step' : undefined}
            onClick={() => reachable && onGo(step)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px',
              borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--f-ui)', fontWeight: active ? 700 : 500,
              background: active ? 'var(--heritage-green)' : done ? 'var(--pale-stone)' : 'transparent',
              color: active ? '#fff' : done ? 'var(--charcoal)' : 'var(--slate)',
              border: '1px solid', borderColor: active ? 'var(--heritage-green)' : 'var(--granite)',
              cursor: reachable ? 'pointer' : 'default', opacity: !active && !done && step > maxReached ? 0.55 : 1,
            }}
          >
            <span className="tnum" aria-hidden>{step}</span> {name}
          </button>
        );
      })}
    </nav>
  );
}

/** Standard step frame: panel + error banner + footer with Back / primary action. */
export function StepShell({ title, hint, error, children, footer }: {
  title: string; hint?: string; error?: string | null; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head"><h3>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
      {error && <div className="panel-body" style={{ paddingBottom: 0 }}><div className="banner err" style={{ marginTop: 0 }}>{error}</div></div>}
      {children}
      {footer && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--granite)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

const PROVENANCE: Record<MappingProvenance, { label: string; tone: RagTone }> = {
  exact: { label: 'Exact match', tone: 'ok' },
  remembered: { label: 'Remembered', tone: 'info' },
  fuzzy: { label: 'Fuzzy', tone: 'amber' },
  manual: { label: 'Manual', tone: 'info' },
  none: { label: 'Unmapped', tone: 'neutral' },
};

/** Confidence + provenance badge for an auto-mapping (PRD AC2: always visible, always overridable). */
export function ConfidenceBadge({ provenance, confidence }: { provenance: MappingProvenance; confidence: number | string | null }) {
  const p = PROVENANCE[provenance] ?? PROVENANCE.none;
  const pct = confidence == null ? null : Math.round(Number(confidence) * 100);
  return (
    <StatusBadge tone={p.tone}>
      {p.label}{provenance !== 'none' && pct != null && !Number.isNaN(pct) ? ` ${pct}%` : ''}
    </StatusBadge>
  );
}

/** Validation count pills — counts stay visible throughout the fix-in-grid loop. */
export function CountPills({ counts }: { counts: Partial<RowCounts> & { pending?: number } }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <StatusBadge tone="ok">{counts.valid ?? 0} valid</StatusBadge>
      <StatusBadge tone="amber">{counts.warning ?? 0} warnings</StatusBadge>
      <StatusBadge tone="crit">{counts.error ?? 0} errors</StatusBadge>
      <StatusBadge tone="neutral">{counts.excluded ?? 0} excluded</StatusBadge>
      {(counts.pending ?? 0) > 0 && <StatusBadge tone="neutral">{counts.pending} not yet validated</StatusBadge>}
    </div>
  );
}

export function sessionStatusBadge(status: SessionStatus): { label: string; tone: RagTone } {
  switch (status) {
    case 'committed': return { label: 'Committed', tone: 'ok' };
    case 'undone': return { label: 'Undone', tone: 'neutral' };
    case 'committing': return { label: 'Committing', tone: 'info' };
    case 'dry_run': return { label: 'Dry-run ready', tone: 'info' };
    default: return { label: 'In progress', tone: 'amber' };
  }
}

/** Pipe-joined inbound hierarchy key → readable path. */
export const keyToPath = (key: string): string => key.split('|').join(' / ');
