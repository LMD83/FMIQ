import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type EvalResult, type ReadingSeries } from '../../api';
import { Chip } from '../../components/Chip';
import { StatusBadge } from '../../components/StatusBadge';
import { useReadingTrend, useSites, useZones } from '../../hooks/usePortfolio';

const DEMO_SENSOR = '00000000-0000-0000-0000-000000000121';
const DEMO_ZONE = '00000000-0000-0000-0000-000000000101';
const LOOP = ['Sense', 'Evaluate', 'Name risk', 'Route', 'Act', 'Evidence'];

function Trend({ data }: { data: ReadingSeries | null }) {
  if (!data || data.series.length < 2) return <div className="muted" style={{ fontSize: 12 }}>No trend data yet.</div>;
  const w = 640, h = 200, pad = 28;
  const vals = data.series.map((p) => p.value);
  const lo = Math.min(...vals, data.target?.rh_min ?? 100) - 2;
  const hi = Math.max(...vals, data.target?.rh_max ?? 0) + 2;
  const x = (i: number) => pad + (i / (data.series.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2);
  const path = data.series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const bandTop = data.target?.rh_max != null ? y(data.target.rh_max) : null;
  const bandBot = data.target?.rh_min != null ? y(data.target.rh_min) : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }} role="img" aria-label="Relative humidity trend">
      {bandTop != null && bandBot != null && (
        <rect x={pad} y={bandTop} width={w - pad * 2} height={Math.max(0, bandBot - bandTop)} fill="rgba(202,219,192,.35)" />
      )}
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={pad + t * (h - pad * 2)} y2={pad + t * (h - pad * 2)} stroke="#E3E0DA" />
      ))}
      <path d={path} fill="none" stroke="#2E4C6E" strokeWidth={2.2} />
    </svg>
  );
}

/** Collection-Care Command Centre — the signature closed-loop demo (route /collection-care). */
export function CommandCentrePage() {
  const qc = useQueryClient();
  const zonesQ = useZones();
  const sitesQ = useSites();
  const trendQ = useReadingTrend(DEMO_ZONE);
  const zones = zonesQ.data?.zones ?? [];
  const sites = sitesQ.data?.sites ?? [];

  const [result, setResult] = useState<EvalResult | null>(null);
  const [loopStep, setLoopStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2800); }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['zones'] }),
      qc.invalidateQueries({ queryKey: ['sites'] }),
      qc.invalidateQueries({ queryKey: ['summary'] }),
      qc.invalidateQueries({ queryKey: ['work-orders'] }),
      qc.invalidateQueries({ queryKey: ['readings'] }),
    ]);
  }, [qc]);

  const simulate = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api<EvalResult>('/api/v1/ingest/readings', {
        method: 'POST',
        body: JSON.stringify({ sensorId: DEMO_SENSOR, zoneId: DEMO_ZONE, metric: 'rh', value: 63.2 }),
      });
      setResult(res); setLoopStep(res.breach ? 4 : 0); setErr(null);
      await refresh();
      flash(res.breach ? `Excursion raised — work order ${res.workOrderRef}` : 'Reading recorded — in band');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [refresh, flash]);

  const acknowledge = useCallback(async () => {
    if (!result?.workOrderRef) return;
    try {
      await api('/api/v1/work-orders/ack', { method: 'POST', body: JSON.stringify({ ref: result.workOrderRef }) });
      setLoopStep(6);
      flash('Dispatched — technician notified, conservator CC’d, evidence log open');
      await refresh();
    } catch (e) { setErr((e as Error).message); }
  }, [result, flash, refresh]);

  const activeExcursionZone = useMemo(() => zones.find((z) => z.status === 'crit'), [zones]);
  const apiDown = zonesQ.isError || sitesQ.isError;

  return (
    <>
      {(err || apiDown) && (
        <div className="banner err">
          {err ?? 'API unavailable — run "npm run dev" to start the database, API and web together.'}
        </div>
      )}

      <div className="page-head">
        <div>
          <div className="page-title">Collection-Care Command Centre</div>
          <div className="page-sub">Live conservation status across every site, gallery, case and store — sensor to response, with the at-risk objects named.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn alt" onClick={() => void simulate()} disabled={busy}>{busy ? 'Sending…' : 'Simulate RH excursion (63.2%)'}</button>
          <button className="btn ghost" onClick={() => void refresh()}>Refresh</button>
        </div>
      </div>

      <div className="portfolio">
        {sites.map((s) => (
          <div className="site-card" key={s.id}>
            <div className="nm">{s.name.split('—')[0].trim()}</div>
            <div className="loc">{s.county ?? ''} · {s.zones} zones</div>
            <div className="stat"><StatusBadge tone={s.status === 'ok' ? 'ok' : 'crit'}>{s.active_excursions > 0 ? `${s.active_excursions} active excursion` : 'All zones compliant'}</StatusBadge></div>
          </div>
        ))}
        {!sites.length && <div className="muted">No sites — start the app with "npm run dev".</div>}
      </div>

      {(result?.breach || activeExcursionZone) && (
        <div className="excursion">
          <div className="exc-top">
            <div className="exc-pulse">⚠</div>
            <div>
              <div className="exc-title">Active excursion — {result?.zoneName ?? activeExcursionZone?.name}</div>
              <div className="exc-meta">
                {result ? `${result.severity?.toUpperCase()} · ${result.kind === 'rate_of_change' ? 'rate-of-change' : 'band'} breach` : 'Relative humidity outside target band'}
              </div>
            </div>
            <div className="exc-readout">
              <div className="big tnum">{(activeExcursionZone?.rh ?? 63.2).toFixed(1)}%</div>
              <div className="small">RH · target {activeExcursionZone?.rh_min ?? 45}–{activeExcursionZone?.rh_max ?? 55}</div>
            </div>
          </div>
          <div className="loop">
            {LOOP.map((s, i) => (
              <span key={s} className={i < loopStep ? 'done' : i === loopStep ? 'active' : ''}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="panel">
          <div className="panel-head"><h3>RH trend — Textile Gallery (24h)</h3>
            <Chip kind={result?.breach || activeExcursionZone ? 'crit' : 'ok'}>{result?.breach || activeExcursionZone ? 'Excursion' : 'In band'}</Chip>
          </div>
          <div className="panel-body"><Trend data={trendQ.data ?? null} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Objects at risk</h3><span className="hint">via Axiell</span></div>
          <div className="panel-body">
            {result?.atRiskObjects?.length ? (
              <>
                {result.atRiskObjects.map((o) => (
                  <div className="obj" key={o.cmsObjectId}>
                    <div>
                      <div className="on">{o.objectName}</div>
                      <div className="om">{o.material} · {o.sensitivity} sensitivity</div>
                    </div>
                    <span className="ref"><Chip kind={o.sensitivity === 'high' ? 'crit' : 'watch'}>{o.sensitivity}</Chip></span>
                  </div>
                ))}
                <div className="banner">Work order <span className="mono">{result.workOrderRef}</span> raised automatically with conservation notes.</div>
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={() => void acknowledge()}>Acknowledge &amp; dispatch</button>
                </div>
              </>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>Press <strong>Simulate RH excursion</strong> to drive the closed loop: the engine names the objects in the affected zone (from the linked collections system) and raises a work order.</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Monitored zones</h3><span className="hint">{zones.length} zones · live</span></div>
        <div className="panel-body">
          <div className="zones">
            {zones.map((z) => {
              const alertRh = z.status !== 'ok';
              return (
                <div className={`zone ${z.status}`} key={z.id}>
                  <div className="zh">
                    <div><div className="zn">{z.name}</div><div className="zl">{z.space_name}</div><div className="zstd">{z.standard ?? '—'}</div></div>
                    <Chip kind={z.status}>{z.status === 'ok' ? 'OK' : z.status === 'watch' ? 'Watch' : 'Excursion'}</Chip>
                  </div>
                  <div className="metrics">
                    <div className={`metric ${alertRh ? 'alert' : ''}`}><div className="ml">RH</div><div className="mv tnum">{z.rh != null ? `${Number(z.rh).toFixed(1)}%` : '—'}</div><div className="mt">target {z.rh_min}–{z.rh_max}</div></div>
                    <div className="metric"><div className="ml">Temp</div><div className="mv tnum">{z.temp != null ? `${Number(z.temp).toFixed(1)}°` : '—'}</div><div className="mt">°C</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </>
  );
}
