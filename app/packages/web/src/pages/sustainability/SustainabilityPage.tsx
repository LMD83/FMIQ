import { useZones } from '../../hooks/usePortfolio';

/** Sustainability & utilities — Bizot compliance from live zones (route /sustainability). */
export function SustainabilityPage() {
  const zonesQ = useZones();
  const zones = zonesQ.data?.zones ?? [];

  return (
    <>
      {zonesQ.isError && <div className="banner err">Couldn’t load zones — start the stack with "npm run dev".</div>}
      <div className="page-head"><div><div className="page-title">Sustainability &amp; Utilities</div><div className="page-sub">Energy, carbon and the Bizot Green Protocol — balancing conservation with decarbonisation.</div></div></div>
      <div className="kpi-row">
        <div className="kpi"><div className="lbl">Energy (YTD)</div><div className="val tnum">2.84<span style={{ fontSize: 15 }}> GWh</span></div><div className="delta">−6% vs last yr</div></div>
        <div className="kpi"><div className="lbl">Carbon</div><div className="val tnum">512<span style={{ fontSize: 15 }}> tCO₂e</span></div><div className="delta">Scope 1+2</div></div>
        <div className="kpi"><div className="lbl">Bizot-compliant zones</div><div className="val tnum">{zones.length ? Math.round((zones.filter((z) => z.status === 'ok').length / zones.length) * 100) : '—'}%</div><div className="delta">live, from monitored zones</div></div>
        <div className="kpi"><div className="lbl">Net-zero path</div><div className="val tnum">On track</div><div className="delta">2030 target</div></div>
      </div>
      <div className="panel"><div className="panel-body muted" style={{ fontSize: 13 }}>Bizot Green Protocol compliance is computed live from the monitored-zone statuses above; utility and carbon figures connect to meter feeds in Phase 2.</div></div>
    </>
  );
}
