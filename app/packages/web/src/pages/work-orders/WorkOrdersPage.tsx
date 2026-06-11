import { Chip } from '../../components/Chip';
import { useWorkOrders } from '../../hooks/usePortfolio';

/** Maintenance — reactive + excursion-sourced work orders (route /work-orders). */
export function WorkOrdersPage() {
  const woQ = useWorkOrders();
  const workOrders = woQ.data?.workOrders ?? [];

  return (
    <>
      {woQ.isError && <div className="banner err">Couldn’t load work orders — start the stack with "npm run dev".</div>}
      <div className="page-head"><div><div className="page-title">Maintenance</div><div className="page-sub">Reactive and planned work orders. Excursion-triggered jobs carry conservation context and object-risk priority.</div></div></div>
      <div className="panel"><div className="panel-head"><h3>Work orders</h3><span className="hint">{workOrders.length} shown</span></div>
        <table><thead><tr><th>Ref</th><th>Title</th><th>Location</th><th>Source</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>
            {workOrders.map((w) => (
              <tr key={w.ref}><td className="wo-id">{w.ref}</td><td>{w.title}</td><td className="muted">{w.location ?? '—'}</td>
                <td><Chip kind="neutral">{w.source}</Chip></td>
                <td style={{ fontWeight: 600, color: w.priority === 'critical' ? 'var(--terracotta)' : w.priority === 'high' ? 'var(--gold)' : 'var(--slate)' }}>{w.priority}</td>
                <td>{w.status}</td></tr>
            ))}
            {!workOrders.length && <tr><td colSpan={6} className="muted">No work orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
