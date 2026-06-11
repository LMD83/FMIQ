import { ragChip } from '../../components/Chip';
import { useProjects } from '../../hooks/usePortfolio';

/** Capital projects governed to CWMF (route /projects). */
export function ProjectsPage() {
  const prjQ = useProjects();
  const projects = prjQ.data?.projects ?? [];

  return (
    <>
      {prjQ.isError && <div className="banner err">Couldn’t load projects — start the stack with "npm run dev".</div>}
      <div className="page-head"><div><div className="page-title">Projects &amp; Programmes</div><div className="page-sub">Capital works governed to the CWMF / Public Works Contract. Closure-impact and asset write-back built in.</div></div></div>
      <div className="panel"><div className="panel-head"><h3>Capital projects</h3></div>
        <table><thead><tr><th>Project</th><th>CWMF stage</th><th>Budget</th><th>Spend</th><th>Status</th></tr></thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={i}><td><strong>{p.name}</strong></td><td className="muted">{p.cwmf_stage}</td>
                <td className="tnum">€{((p.budget ?? 0) / 1e6).toFixed(1)}m</td>
                <td><span className="bar"><i style={{ width: `${p.spend_pct}%`, background: p.status_rag === 'amber' ? 'var(--gold-lg)' : 'var(--sage)' }} /></span> <span className="muted tnum" style={{ fontSize: 11 }}>{p.spend_pct}%</span></td>
                <td>{ragChip(p.status_rag)}</td></tr>
            ))}
            {!projects.length && <tr><td colSpan={5} className="muted">No projects.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
