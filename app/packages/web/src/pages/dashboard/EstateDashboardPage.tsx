import { useSites, useSummary } from '../../hooks/usePortfolio';

/** Estate Dashboard — portfolio KPIs (route /dashboard). */
export function EstateDashboardPage() {
  const summaryQ = useSummary();
  const sitesQ = useSites();
  const summary = summaryQ.data ?? null;
  const sites = sitesQ.data?.sites ?? [];

  return (
    <>
      {(summaryQ.isError || sitesQ.isError) && (
        <div className="banner err">API unavailable — run "npm run dev" to start the database, API and web together.</div>
      )}
      <div className="page-head"><div><div className="page-title">Estate Dashboard</div><div className="page-sub">Portfolio health across the National Museum of Ireland estate.</div></div></div>
      <div className="kpi-row">
        <div className="kpi"><div className="lbl">Buildings</div><div className="val tnum">{summary?.buildings ?? '—'}</div><div className="delta">{summary?.sites ?? '—'} sites</div></div>
        <div className="kpi"><div className="lbl">Zones compliant</div><div className="val tnum">{summary?.compliantPct ?? '—'}%</div><div className="delta">{summary?.excursions ?? 0} in excursion</div></div>
        <div className="kpi"><div className="lbl">Open work orders</div><div className="val tnum">{summary?.openWorkOrders ?? '—'}</div><div className="delta">{summary?.workOrdersToday ?? 0} opened today</div></div>
        <div className="kpi"><div className="lbl">Compliance</div><div className="val tnum" style={{ color: 'var(--gold)' }}>{(summary?.complianceRag?.['red'] ?? 0) > 0 ? 'Red' : (summary?.complianceRag?.['amber'] ?? 0) > 0 ? 'Amber' : 'Green'}</div><div className="delta">{summary?.complianceRag?.['amber'] ?? 0} due soon</div></div>
      </div>
      <div className="grid2">
        <div className="panel"><div className="panel-head"><h3>Work orders by status</h3></div><div className="panel-body">
          {summary && Object.entries(summary.workOrdersByStatus).map(([k, v]) => {
            const max = Math.max(1, ...Object.values(summary.workOrdersByStatus));
            return <div className="barrow" key={k}><span className="lab">{k}</span><span className="track"><i style={{ width: `${(v / max) * 100}%` }} /></span><span className="tnum">{v}</span></div>;
          })}
        </div></div>
        <div className="panel"><div className="panel-head"><h3>Conservation status by site</h3></div><div className="panel-body">
          {sites.map((s) => (
            <div className="barrow" key={s.id}><span className="lab" style={{ width: 150 }}>{s.name.split('—')[0].trim()}</span>
              <span className="track"><i style={{ width: `${s.active_excursions > 0 ? 70 : 100}%`, background: s.active_excursions > 0 ? 'var(--terracotta)' : 'var(--sage)' }} /></span>
              <span className="tnum">{s.active_excursions > 0 ? 'Excursion' : 'OK'}</span></div>
          ))}
        </div></div>
      </div>
    </>
  );
}
