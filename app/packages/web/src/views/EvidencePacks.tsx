import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getWorkOrderEvidence, openWorkOrderEvidence, type WorkOrder } from '../api';
import { priorityBadge } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';

/**
 * Evidence packs — one-click, audit-ready bundles assembled from live data (SSoW gate
 * checks, RAMS, permits, golden-thread documents, certs, audit trail). Pick a work order,
 * preview the assembled pack, and open the print-ready HTML (browser → PDF; PDF/A via the
 * deployment renderer).
 */
export function EvidencePacks() {
  const { data, isError } = useQuery({ queryKey: ['work-orders'], queryFn: () => api<{ workOrders: WorkOrder[] }>('/api/v1/work-orders') });
  const workOrders = data?.workOrders ?? [];
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const pack = useQuery({
    queryKey: ['evidence', selected?.id],
    queryFn: () => getWorkOrderEvidence(selected!.id),
    enabled: !!selected,
  });

  const counts = (pack.data?.pack ?? {}) as Record<string, unknown[]>;
  const count = (k: string) => (Array.isArray(counts[k]) ? (counts[k] as unknown[]).length : 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Evidence packs</div>
          <div className="page-sub">One-click audit / HSA / loan bundle — the full work-order chain, assembled from live data.</div>
        </div>
      </div>
      {isError && <div className="banner err">Couldn’t load work orders — start the stack with “npm run dev”.</div>}

      <div className="grid2">
        <div className="panel">
          <div className="panel-head"><h3>Work orders</h3><span className="hint">{workOrders.length} shown</span></div>
          <table>
            <thead><tr><th>Ref</th><th>Title</th><th>Priority</th><th /></tr></thead>
            <tbody>
              {workOrders.map((w) => {
                const p = priorityBadge(w.priority);
                return (
                  <tr key={w.id} aria-selected={selected?.id === w.id}>
                    <td className="wo-id">{w.ref}</td>
                    <td>{w.title}</td>
                    <td><StatusBadge tone={p.tone}>{p.label}</StatusBadge></td>
                    <td><button className="btn ghost" onClick={() => setSelected(w)} aria-label={`Build evidence pack for ${w.ref}`}>Build pack</button></td>
                  </tr>
                );
              })}
              {!workOrders.length && <tr><td colSpan={4} className="muted">No work orders.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Pack contents</h3>{selected && <span className="hint">{selected.ref}</span>}</div>
          <div className="panel-body">
            {!selected && <div className="muted" style={{ fontSize: 13 }}>Select a work order to assemble its evidence pack.</div>}
            {selected && pack.isLoading && <div className="muted">Assembling…</div>}
            {selected && pack.data && (
              <>
                <div className="kpi-row">
                  <div className="kpi"><div className="lbl">Gate checks</div><div className="val tnum">{count('gateChecks')}</div></div>
                  <div className="kpi"><div className="lbl">RAMS / permits</div><div className="val tnum">{count('rams') + count('permits')}</div></div>
                  <div className="kpi"><div className="lbl">Documents</div><div className="val tnum">{count('documents')}</div></div>
                  <div className="kpi"><div className="lbl">Certs</div><div className="val tnum">{count('certificates')}</div></div>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Includes the SSoW gate checks (“no paperwork, no work” proof), RAMS, permits, linked golden-thread documents,
                  asset certificates and the append-only audit trail.
                </p>
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={async () => { setBusy(true); try { await openWorkOrderEvidence(selected.id); } finally { setBusy(false); } }}
                  >
                    {busy ? 'Opening…' : 'Open print-ready pack'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        The print-ready HTML opens in a new tab; print to PDF, or convert to PDF/A via the deployment renderer for archival submission.
      </p>
    </>
  );
}
