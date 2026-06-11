import { useQuery } from '@tanstack/react-query';
import { listParts, type Part } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { stockBadge } from '../lib/format';

/**
 * Stores / inventory — the spares catalogue with stock levels and reorder flags
 * (on-hand vs minimum). Engines: domain/inventory.ts (reserve/issue against work orders).
 */
export function Inventory() {
  const { data, isError } = useQuery({ queryKey: ['parts'], queryFn: listParts });
  const parts = data?.parts ?? [];
  const reorder = parts.filter((p) => p.qty_on_hand != null && p.min_qty != null && Number(p.qty_on_hand) <= Number(p.min_qty)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Stores &amp; inventory</div>
          <div className="page-sub">Spares catalogue with stock levels, reservations and auto-reorder at minimum.</div>
        </div>
      </div>
      {isError && <div className="banner err">Couldn’t load parts — start the stack with “npm run dev”.</div>}

      <div className="kpi-row">
        <div className="kpi"><div className="lbl">Parts</div><div className="val tnum">{parts.length}</div></div>
        <div className="kpi"><div className="lbl">At/below minimum</div><div className="val tnum">{reorder}</div></div>
        <div className="kpi"><div className="lbl">Critical spares</div><div className="val tnum">{parts.filter((p) => p.critical).length}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Catalogue</h3><span className="hint">{parts.length} shown</span></div>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>On hand</th><th>Reserved</th><th>Min</th><th>Level</th></tr></thead>
          <tbody>
            {parts.map((p: Part) => {
              const b = stockBadge(p.qty_on_hand, p.min_qty);
              return (
                <tr key={p.id}>
                  <td className="wo-id">{p.code}</td>
                  <td>{p.name}{p.critical ? <span className="muted"> · critical</span> : null}</td>
                  <td className="tnum">{p.qty_on_hand ?? '—'}</td>
                  <td className="tnum muted">{p.qty_reserved ?? '—'}</td>
                  <td className="tnum muted">{p.min_qty ?? '—'}</td>
                  <td><StatusBadge tone={b.tone}>{b.label}</StatusBadge></td>
                </tr>
              );
            })}
            {!parts.length && <tr><td colSpan={6} className="muted">No parts in the catalogue.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
