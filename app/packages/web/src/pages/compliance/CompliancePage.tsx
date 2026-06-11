import { ragChip } from '../../components/Chip';
import { useObligations } from '../../hooks/usePortfolio';

/** Compliance register — statutory obligations with RAG (route /compliance). */
export function CompliancePage() {
  const oblQ = useObligations();
  const obligations = oblQ.data?.obligations ?? [];

  return (
    <>
      {oblQ.isError && <div className="banner err">Couldn’t load the compliance register — start the stack with "npm run dev".</div>}
      <div className="page-head"><div><div className="page-title">Compliance &amp; Inspections</div><div className="page-sub">Statutory obligations with audit trail — fire, electrical, legionella, asbestos, conservation surveys.</div></div></div>
      <div className="panel"><div className="panel-head"><h3>Compliance register</h3></div>
        <table><thead><tr><th>Obligation</th><th>Building</th><th>Frequency</th><th>Next due</th><th>Status</th></tr></thead>
          <tbody>
            {obligations.map((o, i) => (
              <tr key={i}><td><strong>{o.type}</strong></td><td>{o.building ?? '—'}</td><td className="muted">{o.frequency}</td>
                <td className="tnum">{o.next_due ? new Date(o.next_due).toLocaleDateString('en-IE') : '—'}</td><td>{ragChip(o.status_rag)}</td></tr>
            ))}
            {!obligations.length && <tr><td colSpan={5} className="muted">No obligations.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
