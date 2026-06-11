import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { convertRequest, createRequest, listRequests, type ServiceRequest } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { priorityBadge, shortDate, slaBadge } from '../lib/format';

/**
 * Help desk — the self-service demand channel (core CAFM). Curators/wardens log an
 * issue; it is auto-triaged (category + priority); an FM converts it to a work order
 * with the SLA clock applied. Surfaces the SLA state (on track / at risk / breached).
 */
export function Helpdesk() {
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey: ['requests'], queryFn: listRequests });
  const requests = data?.requests ?? [];
  const [description, setDescription] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createRequest({ description, channel: 'web' }),
    onSuccess: () => { setDescription(''); setFlash('Request logged and auto-triaged.'); void qc.invalidateQueries({ queryKey: ['requests'] }); },
  });
  const convert = useMutation({
    mutationFn: (id: string) => convertRequest(id),
    onSuccess: (r) => { setFlash(`Work order ${r.ref} raised (SLA due ${shortDate(r.slaDue)}).`); void qc.invalidateQueries({ queryKey: ['requests'] }); },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Help desk</div>
          <div className="page-sub">Self-service issue intake → auto-triage → work order with SLA. The front door before a job exists.</div>
        </div>
      </div>
      {isError && <div className="banner err">Couldn’t load requests — start the stack with “npm run dev”.</div>}
      {flash && <div className="banner" role="status">{flash}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h3>Log an issue</h3></div>
        <div className="panel-body">
          <form
            onSubmit={(e) => { e.preventDefault(); if (description.trim()) create.mutate(); }}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <label style={{ flex: 1, minWidth: 280 }}>
              <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Describe the issue (location, what you see)</span>
              <input
                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Water staining on ceiling above the print store"
                style={{ width: '100%', padding: '8px 10px', font: 'inherit' }}
                aria-label="Issue description"
              />
            </label>
            <button className="btn" type="submit" disabled={!description.trim() || create.isPending}>
              {create.isPending ? 'Logging…' : 'Log issue'}
            </button>
          </form>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Category and priority are assigned automatically on submission.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Request queue</h3><span className="hint">{requests.length} shown</span></div>
        <table>
          <thead><tr><th>Logged</th><th>Description</th><th>Category</th><th>Priority</th><th>SLA</th><th>Status</th><th /></tr></thead>
          <tbody>
            {requests.map((r: ServiceRequest) => {
              const p = priorityBadge(r.priority);
              const sla = slaBadge(r.sla_due);
              const converted = r.status === 'converted';
              return (
                <tr key={r.id}>
                  <td className="muted tnum">{shortDate(r.created_at)}</td>
                  <td>{r.description}</td>
                  <td className="muted">{r.category ?? '—'}</td>
                  <td><StatusBadge tone={p.tone}>{p.label}</StatusBadge></td>
                  <td>{r.sla_due ? <StatusBadge tone={sla.tone}>{sla.label}</StatusBadge> : <span className="muted">—</span>}</td>
                  <td>{r.status}</td>
                  <td>
                    {!converted && r.status !== 'rejected' && (
                      <button className="btn ghost" onClick={() => convert.mutate(r.id)} disabled={convert.isPending}>
                        Raise work order
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!requests.length && <tr><td colSpan={7} className="muted">No requests yet — log one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
