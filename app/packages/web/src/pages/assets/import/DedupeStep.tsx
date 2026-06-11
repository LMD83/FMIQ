import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge';
import { StepShell } from './common';
import {
  errMessage, listDuplicates, putResolutions, runDedupe,
  type DuplicateGroup, type ImportSession,
} from './importApi';

const KIND_LABEL: Record<DuplicateGroup['kind'], string> = {
  within_file: 'Repeated within the file',
  existing: 'Matches the register',
  both: 'In the file twice AND in the register',
};

const KEY_LABEL: Record<DuplicateGroup['keyKind'], string> = {
  asset_tag: 'Asset tag', serial_model: 'Serial + model',
};

/**
 * Step 6 — Dedupe review. Exact keys (asset tag; serial + model), inbound vs the
 * register and within-file. Every group is surfaced with an explicit keep/skip
 * resolution — never first-row-wins (PRD Stage 6, AC5). Field-level merge is a
 * Sprint-2 capability; this slice resolves keep (create anyway) or skip.
 */
export function DedupeStep({ session, onBack, onContinue }: {
  session: ImportSession; onBack: () => void; onContinue: () => void;
}) {
  const qc = useQueryClient();
  const ran = useRef(false);
  const [running, setRunning] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicatesQ = useQuery({
    queryKey: ['import-duplicates', session.id],
    queryFn: () => listDuplicates(session.id),
    enabled: !running,
  });

  // Run detection on entry — idempotent; user resolutions are preserved server-side.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const res = await runDedupe(session.id);
        setGroups(res.groups);
        await qc.invalidateQueries({ queryKey: ['import-session', session.id] });
      } catch (err) {
        setError(errMessage(err));
      } finally {
        setRunning(false);
      }
    })();
  }, [session.id, qc]);

  // POST gives key/kind/existing matches; GET gives per-row detail + resolutions. Join on rowId.
  const groupMeta = useMemo(() => {
    const byRowId = new Map<string, DuplicateGroup>();
    for (const g of groups) for (const rowId of g.rowIds) byRowId.set(rowId, g);
    return byRowId;
  }, [groups]);

  const resolve = async (rowId: string, action: 'create' | 'skip') => {
    setBusy(true);
    setError(null);
    try {
      await putResolutions(session.id, [{ rowId, action }]);
      await qc.invalidateQueries({ queryKey: ['import-duplicates', session.id] });
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const dupGroups = duplicatesQ.data?.groups ?? [];
  const loading = running || duplicatesQ.isLoading;

  return (
    <StepShell
      title="Review possible duplicates"
      hint="Exact keys: asset tag, then serial + model — within the file and against the register"
      error={error}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onBack} disabled={busy}>Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {dupGroups.length === 0 ? 'No duplicate groups found.' : `${dupGroups.length} groups — defaults are pre-set, every row overridable.`}
            </span>
            <button type="button" className="btn" disabled={busy || loading} onClick={onContinue}>Continue to dry-run</button>
          </div>
        </>
      }
    >
      {loading && <div className="panel-body muted" style={{ fontSize: 13 }}>Checking for duplicates…</div>}
      {!loading && dupGroups.length === 0 && !error && (
        <div className="panel-body muted" style={{ fontSize: 13 }}>
          No exact-key duplicates were found within the file or against the existing register.
        </div>
      )}
      {!loading && dupGroups.map((g) => {
        const meta = groupMeta.get(g.rows[0]?.rowId ?? '');
        return (
          <div key={g.dedupe_group_id} style={{ borderTop: '1px solid var(--granite)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 18px 4px' }}>
              {meta && <strong style={{ fontFamily: 'var(--f-ui)', fontSize: 13 }}>{KEY_LABEL[meta.keyKind]}: <span className="mono">{meta.key.replace(/^(tag|sm):/, '')}</span></strong>}
              {meta && <StatusBadge tone={meta.kind === 'within_file' ? 'amber' : 'crit'}>{KIND_LABEL[meta.kind]}</StatusBadge>}
              {meta && meta.existingAssetIds.length > 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Already in register:{' '}
                  {meta.existingAssetIds.map((id, i) => (
                    <span key={id}>{i > 0 && ', '}<Link to={`/assets/${id}`}>view asset {i + 1}</Link></span>
                  ))}
                </span>
              )}
            </div>
            <table>
              <thead><tr><th className="tnum">Row</th><th>Name</th><th>Tag</th><th>Serial</th><th>Resolution</th></tr></thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.rowId}>
                    <td className="tnum">{r.sourceRowNo}</td>
                    <td><strong>{str(r.normalised?.['name'])}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{str(r.normalised?.['asset_tag'])}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{str(r.normalised?.['serial_no'])}</td>
                    <td>
                      <select
                        value={r.resolution?.action === 'skip' ? 'skip' : 'create'}
                        aria-label={`Resolution for row ${r.sourceRowNo}`}
                        disabled={busy}
                        onChange={(e) => void resolve(r.rowId, e.target.value as 'create' | 'skip')}
                        style={{ padding: '6px 9px', border: '1px solid var(--granite)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--f-ui)', background: '#fff' }}
                      >
                        <option value="create">Keep — create anyway</option>
                        <option value="skip">Skip this row</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </StepShell>
  );
}

function str(v: unknown): string {
  return v == null || v === '' ? '—' : String(v);
}
