import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decideRequisition, listRequisitions, type Requisition } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { requisitionBadge, shortDate } from '../lib/format';

/**
 * Approvals — purchase requisitions through the gated approval chain with segregation
 * of duties and the ERP commitment boundary. Engines: domain/approvals.ts.
 */
export function Approvals() {
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey: ['requisitions'], queryFn: listRequisitions });
  const requisitions = data?.requisitions ?? [];
  const [flash, setFlash] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) => decideRequisition(id, decision),
    onSuccess: (_r, v) => { setFlash(`Requisition ${v.decision}.`); void qc.invalidateQueries({ queryKey: ['requisitions'] }); },
    onError: (e) => setFlash((e as Error).message),
  });

  const fmt = (n: number) => `€${n.toLocaleString('en-IE')}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Approvals</div>
          <div className="page-sub">Purchase requisitions through the gated chain — segregation of duties, then the ERP commitment boundary.</div>
        </div>
      </div>
      {isError && <div className="banner err">Couldn’t load requisitions — start the stack with “npm run dev”.</div>}
      {flash && <div className="banner" role="status">{flash}</div>}

      <div className="panel">
        <div className="panel-head"><h3>Requisitions</h3><span className="hint">{requisitions.length} shown</span></div>
        <table>
          <thead><tr><th>Raised</th><th>Amount</th><th>Category</th><th>Cost centre</th><th>Step</th><th>Status</th><th /></tr></thead>
          <tbody>
            {requisitions.map((r: Requisition) => {
              const b = requisitionBadge(r.status);
              const pending = r.status === 'pending_approval';
              return (
                <tr key={r.id}>
                  <td className="muted tnum">{shortDate(r.created_at)}</td>
                  <td className="tnum">{fmt(r.amount_net)}</td>
                  <td className="muted">{r.category ?? '—'}</td>
                  <td className="muted">{r.cost_centre ?? '—'}</td>
                  <td className="tnum">{r.current_step ?? '—'}</td>
                  <td><StatusBadge tone={b.tone}>{b.label}</StatusBadge></td>
                  <td>
                    {pending && (
                      <span style={{ display: 'inline-flex', gap: 8 }}>
                        <button className="btn ghost" onClick={() => decide.mutate({ id: r.id, decision: 'approved' })} disabled={decide.isPending}>Approve</button>
                        <button className="btn ghost" onClick={() => decide.mutate({ id: r.id, decision: 'rejected' })} disabled={decide.isPending}>Reject</button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!requisitions.length && <tr><td colSpan={7} className="muted">No requisitions.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
