import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Zone } from '../api';
import { useT } from '../i18n';
import { StatusBadge } from '../components/StatusBadge';

/**
 * Live floor-map "twin" (P3, 2D). Zones laid out spatially, colour-coded by live
 * conservation status with text + icon (never colour alone). This is the data-bound
 * foundation; real floor-plan polygons load from IFC/COBie (PostGIS) — the 3D/IFC
 * viewer (xeokit) is the deferred browser-3D step. See FMIQ-operations-modules-spec §7.
 */
function statusLabel(s: Zone['status']): string {
  return s === 'ok' ? 'In band' : s === 'watch' ? 'Watch' : 'Excursion';
}

export function FloorMap() {
  const { t } = useT();
  const { data, isError } = useQuery({ queryKey: ['zones'], queryFn: () => api<{ zones: Zone[] }>('/api/v1/zones') });
  const zones = data?.zones ?? [];
  const [selected, setSelected] = useState<Zone | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t('nav.floorMap')}</div>
          <div className="page-sub">Every monitored zone, live — green/amber/red by conservation status, with the metric on the tile.</div>
        </div>
      </div>
      {isError && <div className="banner err">Couldn’t load zones — start the stack with “npm run dev”.</div>}

      <div className="twin" role="group" aria-label="Live floor map of monitored zones">
        {zones.map((z) => (
          <button
            key={z.id}
            className={`twin-zone ${z.status}`}
            aria-label={`${z.name}, ${z.space_name}: ${statusLabel(z.status)}, RH ${z.rh != null ? `${Number(z.rh).toFixed(0)} percent` : 'unknown'}`}
            aria-pressed={selected?.id === z.id}
            onClick={() => setSelected(z)}
          >
            <span className="tz-name">{z.name}</span>
            <span className="tz-rh tnum">{z.rh != null ? `${Number(z.rh).toFixed(0)}%` : '—'}</span>
            <StatusBadge tone={z.status === 'ok' ? 'ok' : z.status === 'watch' ? 'watch' : 'crit'}>{statusLabel(z.status)}</StatusBadge>
          </button>
        ))}
        {!zones.length && <div className="muted" style={{ padding: 16 }}>No monitored zones yet.</div>}
      </div>

      {selected && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>{selected.name}</h3><span className="hint">{selected.space_name}</span></div>
          <div className="panel-body">
            <div className="kpi-row">
              <div className="kpi"><div className="lbl">RH</div><div className="val tnum">{selected.rh != null ? `${Number(selected.rh).toFixed(1)}%` : '—'}</div><div className="delta">target {selected.rh_min}–{selected.rh_max}</div></div>
              <div className="kpi"><div className="lbl">Temp</div><div className="val tnum">{selected.temp != null ? `${Number(selected.temp).toFixed(1)}°` : '—'}</div></div>
              <div className="kpi"><div className="lbl">Standard</div><div className="val" style={{ fontSize: 18 }}>{selected.standard ?? '—'}</div></div>
              <div className="kpi"><div className="lbl">Status</div><div style={{ marginTop: 8 }}><StatusBadge tone={selected.status === 'ok' ? 'ok' : selected.status === 'watch' ? 'watch' : 'crit'}>{statusLabel(selected.status)}</StatusBadge></div></div>
            </div>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Spatial layout approximates the estate. Real floor-plan polygons load from IFC/COBie (PostGIS); the 3D/IFC viewer is on the Phase-3 roadmap.
      </p>
    </>
  );
}
