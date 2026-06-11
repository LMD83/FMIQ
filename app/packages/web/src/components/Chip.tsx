import type { ReactNode } from 'react';

/**
 * Legacy chip — status carried by icon + text (theme.css ::before glyphs),
 * never colour alone (WCAG 1.4.1). Prefer StatusBadge for new screens.
 */
export function Chip({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`chip ${kind}`}>{children}</span>;
}

export function ragChip(rag: string | null) {
  const k = rag === 'green' ? 'green' : rag === 'red' ? 'red' : 'amber';
  const label = rag === 'green' ? 'On track' : rag === 'red' ? 'At risk' : 'Due soon';
  return <Chip kind={k}>{label}</Chip>;
}
