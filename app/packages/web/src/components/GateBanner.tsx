import type { GateEvaluation } from '../api';

/**
 * The Readiness Gate banner — the job card's single source of truth: green
 * "Ready to start" or red "Blocked — [exact items]". Uses an ARIA live region so a
 * screen reader announces a block. Text + icon, never colour alone.
 */
export function GateBanner({ gate }: { gate: GateEvaluation | null }) {
  if (!gate) return null;
  if (!gate.blocked) {
    return (
      <div className="gate-banner ready" role="status">
        <span aria-hidden="true">✓</span> Ready to start
      </div>
    );
  }
  return (
    <div className="gate-banner blocked" role="alert">
      <div className="gb-head"><span aria-hidden="true">⚠</span> Blocked — {gate.firstBlockMessage}</div>
      {gate.blockedBy.length > 1 && (
        <ul className="gb-list">
          {gate.blockedBy.map((c) => (
            <li key={c.checkId}>{c.blockMessage ?? c.checkId}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
