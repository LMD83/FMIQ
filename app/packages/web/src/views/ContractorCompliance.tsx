import { useQuery } from '@tanstack/react-query';
import { getContractorVault, type ContractorVaultRow } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { shortDate } from '../lib/format';

/**
 * Contractor compliance vault — Safe Pass / RECI / RGII / insurances per contractor with
 * expiry-driven status, so a facilities manager sees who is clear to work before assigning.
 * Backed by hs_competency (the same records the SSoW Readiness Gate auto-blocks on).
 */
function tone(c: ContractorVaultRow): { tone: 'crit' | 'watch' | 'ok'; label: string } {
  if (c.expired_docs > 0) return { tone: 'crit', label: `${c.expired_docs} expired` };
  if (c.unverified_docs > 0) return { tone: 'watch', label: `${c.unverified_docs} unverified` };
  if (c.total_docs === 0) return { tone: 'watch', label: 'no documents' };
  return { tone: 'ok', label: 'clear to work' };
}

export function ContractorCompliance() {
  const vault = useQuery({ queryKey: ['contractor-vault'], queryFn: getContractorVault });
  const contractors = vault.data?.contractors ?? [];
  const blocked = contractors.filter((c) => c.expired_docs > 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Contractor compliance</div>
          <div className="page-sub">Competency &amp; insurance vault — Safe Pass, RECI/RGII, public &amp; employer liability. Expiry auto-blocks the SSoW gate.</div>
        </div>
      </div>
      {vault.isError && <div className="banner err">Couldn’t load the contractor vault — start the stack with “npm run dev”.</div>}

      {blocked > 0 && (
        <div className="banner err" role="alert" aria-live="polite" style={{ marginBottom: 16 }}>
          {blocked} contractor(s) have expired documents and will be blocked from new work by the SSoW gate.
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><h3>Contractor register</h3><span className="hint">{contractors.length} contractor(s)</span></div>
        <table>
          <thead>
            <tr><th>Contractor</th><th>Prequal</th><th>Insurance expiry</th><th>Documents</th><th>Next expiry</th><th>Status</th></tr>
          </thead>
          <tbody>
            {contractors.map((c) => {
              const b = tone(c);
              return (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td className="muted">{c.prequal_status ?? '—'}</td>
                  <td className="tnum">{shortDate(c.insurance_expiry)}</td>
                  <td className="tnum">{c.valid_docs}/{c.total_docs} valid</td>
                  <td className="tnum">{shortDate(c.next_expiry)}</td>
                  <td><StatusBadge tone={b.tone}>{b.label}</StatusBadge></td>
                </tr>
              );
            })}
            {!contractors.length && <tr><td colSpan={6} className="muted">No contractors.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
