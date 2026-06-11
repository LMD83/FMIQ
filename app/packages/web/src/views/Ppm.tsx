import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generatePpm, listPpmSchedules, type PpmSchedule } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { classificationBadge, shortDate } from '../lib/format';

/**
 * Planned maintenance (PPM) — SFG20-aligned schedules with statutory classification
 * (red/pink/amber/green) and a compliance clock. "Generate due work orders" raises the
 * jobs falling due, bundled per asset. Engines: domain/ppm.ts.
 */
export function Ppm() {
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey: ['ppm-schedules'], queryFn: listPpmSchedules });
  const schedules = data?.schedules ?? [];
  const [flash, setFlash] = useState<string | null>(null);
  const generate = useMutation({
    mutationFn: generatePpm,
    onSuccess: (r) => { setFlash(`${r.generated.length} work order(s) generated from due PPM.`); void qc.invalidateQueries({ queryKey: ['ppm-schedules'] }); },
  });

  const dueSoon = schedules.filter((s) => s.next_due && new Date(s.next_due).getTime() < Date.now() + 30 * 864e5).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Planned maintenance (PPM)</div>
          <div className="page-sub">SFG20-aligned schedules with statutory classification and the compliance clock.</div>
        </div>
        <button className="btn" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? 'Generating…' : 'Generate due work orders'}
        </button>
      </div>
      {isError && <div className="banner err">Couldn’t load PPM schedules — start the stack with “npm run dev”.</div>}
      {flash && <div className="banner" role="status">{flash}</div>}

      <div className="kpi-row">
        <div className="kpi"><div className="lbl">Schedules</div><div className="val tnum">{schedules.length}</div></div>
        <div className="kpi"><div className="lbl">Due within 30 days</div><div className="val tnum">{dueSoon}</div></div>
        <div className="kpi"><div className="lbl">Statutory</div><div className="val tnum">{schedules.filter((s) => s.statutory_flag).length}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Schedules</h3><span className="hint">{schedules.length} shown</span></div>
        <table>
          <thead><tr><th>Asset</th><th>Task</th><th>Frequency</th><th>Classification</th><th>Next due</th><th>Active</th></tr></thead>
          <tbody>
            {schedules.map((s: PpmSchedule) => {
              const c = classificationBadge(s.classification);
              return (
                <tr key={s.id}>
                  <td className="wo-id">{s.asset_code ?? '—'}</td>
                  <td>{s.task}</td>
                  <td className="muted">{s.frequency ?? '—'}</td>
                  <td><StatusBadge tone={c.tone}>{c.label}</StatusBadge></td>
                  <td className="tnum">{shortDate(s.next_due)}</td>
                  <td>{s.active ? <StatusBadge tone="ok">Active</StatusBadge> : <span className="muted">paused</span>}</td>
                </tr>
              );
            })}
            {!schedules.length && <tr><td colSpan={6} className="muted">No PPM schedules.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
