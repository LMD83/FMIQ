import type { ReactNode } from 'react';

/**
 * Accessible RAG status — **text + icon, never colour alone** (WCAG 1.4.1, the live
 * defect this fixes). Colour is decorative; the icon shape and the label carry meaning.
 */

export type RagTone = 'ok' | 'watch' | 'crit' | 'green' | 'amber' | 'red' | 'info' | 'neutral';

const TONE: Record<RagTone, { cls: string; icon: ReactNode }> = {
  ok: { cls: 'sb-ok', icon: <CheckIcon /> },
  green: { cls: 'sb-ok', icon: <CheckIcon /> },
  watch: { cls: 'sb-watch', icon: <AlertIcon /> },
  amber: { cls: 'sb-watch', icon: <AlertIcon /> },
  crit: { cls: 'sb-crit', icon: <StopIcon /> },
  red: { cls: 'sb-crit', icon: <StopIcon /> },
  info: { cls: 'sb-info', icon: <DotIcon /> },
  neutral: { cls: 'sb-neutral', icon: <DotIcon /> },
};

export function StatusBadge({ tone, children }: { tone: RagTone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span className={`status-badge ${t.cls}`}>
      <span className="sb-icon" aria-hidden="true">{t.icon}</span>
      <span>{children}</span>
    </span>
  );
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}
function AlertIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
}
function StopIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9L7.9 2Z" /><path d="M12 8v4M12 16h.01" /></svg>;
}
function DotIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>;
}
