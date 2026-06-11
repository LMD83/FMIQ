import { useCallback, useState } from 'react';

const REPORTS = [
  'Loan facility report', 'Board conservation summary', 'Bizot Green Protocol',
  'Statutory compliance pack', 'Backlog maintenance', 'Accessibility statement (ACR)',
];

/** Reports launcher (route /reports). */
export function ReportsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2800); }, []);

  return (
    <>
      <div className="page-head"><div><div className="page-title">Reports</div><div className="page-sub">Scheduled, accessible (WCAG 2.2 AA), board- and funder-ready. Per-work-order evidence packs live under <strong>Evidence packs</strong>.</div></div></div>
      <div className="grid3">
        {REPORTS.map((r) => (
          <button type="button" className="panel report-card" key={r} onClick={() => flash(`${r} generated`)}>
            <div className="panel-body"><div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600 }}>{r}</div><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Generate from live data</div></div>
          </button>
        ))}
      </div>
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </>
  );
}
