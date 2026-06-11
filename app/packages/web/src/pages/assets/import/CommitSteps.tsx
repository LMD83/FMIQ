import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { shortDate } from '../../../lib/format';
import { StepShell, keyToPath } from './common';
import {
  commitImport, errMessage, runDryRun, undoImport,
  type DryRunResult, type ImportSession,
} from './importApi';

/**
 * Step 7 — Dry-run. A no-write simulation whose counts are produced by the SAME
 * gate as the commit loop, so dry-run counts equal commit counts exactly (AC3).
 */
export function DryRunStep({ session, onBack, onContinue }: {
  session: ImportSession; onBack: () => void; onContinue: () => void;
}) {
  const qc = useQueryClient();
  const ran = useRef(false);
  const [result, setResult] = useState<DryRunResult | null>(session.stats?.dryRun ?? null);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const { dryRun } = await runDryRun(session.id);
        setResult(dryRun);
        await qc.invalidateQueries({ queryKey: ['import-session', session.id] });
      } catch (err) {
        setError(errMessage(err));
      } finally {
        setRunning(false);
      }
    })();
  }, [session.id, qc]);

  const newEntityCount = result ? Object.values(result.newEntities).reduce((n, a) => n + a.length, 0) : 0;
  const blocked = (result?.blockedErrors ?? 0) > 0;

  return (
    <StepShell
      title="Dry-run — what commit will do"
      hint="No-write simulation; these counts equal the commit counts exactly"
      error={error}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onBack} disabled={running}>Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {result && <button type="button" className="btn ghost" onClick={() => downloadSummary(session, result)}>Download summary</button>}
            {blocked && <span style={{ fontSize: 12, color: 'var(--garnet)' }}>{result!.blockedErrors} rows have blocking errors — go back to Validate.</span>}
            <button type="button" className="btn" disabled={running || !result || blocked} onClick={onContinue}>Proceed to commit</button>
          </div>
        </>
      }
    >
      <div className="panel-body">
        {running && <div className="muted" style={{ fontSize: 13 }}>Simulating the commit…</div>}
        {result && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Figure label="Assets to create" value={result.creates} strong />
              <Figure label="Skipped duplicates" value={result.skippedDuplicates} />
              <Figure label="Blocked by errors" value={result.blockedErrors} alert={blocked} />
              <Figure label="Excluded rows" value={result.excluded} />
              <Figure label="Rows with warnings" value={result.warnings} />
              <Figure label="New locations" value={newEntityCount} />
              <Figure label="Linked to existing" value={result.linkedEntities} />
            </div>
            {newEntityCount > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>New locations to be created</div>
                {Object.entries(result.newEntities).map(([entity, keys]) => (
                  <div key={entity} style={{ fontSize: 12.5, marginBottom: 4 }}>
                    <span className="muted" style={{ textTransform: 'capitalize' }}>{entity}s ({keys.length}): </span>
                    {keys.map(keyToPath).join('; ')}
                  </div>
                ))}
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
              Nothing has been written. Commit is transactional and undoable for 7 days (or until a record is edited).
            </div>
          </>
        )}
      </div>
    </StepShell>
  );
}

/** Step 8 — Commit, result, undo, next actions. */
export function CommitStep({ session, onBack, onRestart }: {
  session: ImportSession; onBack: () => void; onRestart: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['import-session', session.id] });

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errMessage(err));
      await refresh(); // status may have moved despite the error surface
    } finally {
      setBusy(false);
    }
  };

  const dryRun = session.stats?.dryRun;
  const committed = session.stats?.committed;
  const undo = session.stats?.undo;
  const undoOpen = session.undo_expires_at != null && new Date(session.undo_expires_at).getTime() > Date.now();

  if (session.status === 'committed' || session.status === 'undone' || session.status === 'committing') {
    return (
      <StepShell
        title={session.status === 'undone' ? 'Import undone' : session.status === 'committing' ? 'Committing…' : 'Import committed'}
        hint={session.files[0]?.filename}
        error={error}
        footer={
          <>
            <span className="muted" style={{ fontSize: 12 }}>
              {session.status === 'committed' && (undoOpen
                ? `Undo available until ${shortDate(session.undo_expires_at)} — or until an imported record is edited.`
                : 'The 7-day undo window has closed.')}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              {session.status === 'committed' && (
                <button type="button" className="btn ghost" disabled={busy || !undoOpen} onClick={() => void act(() => undoImport(session.id))}>
                  {busy ? 'Undoing…' : 'Undo this import'}
                </button>
              )}
              <button type="button" className="btn" onClick={onRestart}>Import another file</button>
            </div>
          </>
        }
      >
        <div className="panel-body">
          {session.status === 'committing' && <div className="muted" style={{ fontSize: 13 }}>Writing assets, locations, provenance and audit rows in one transaction…</div>}
          {session.status === 'committed' && committed && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <Figure label="Assets created" value={committed.created} strong />
                <Figure label="Rows skipped" value={committed.skipped} />
                <Figure label="Locations created" value={committed.newEntities} />
              </div>
              <p style={{ fontSize: 13, marginTop: 14 }}>
                <Link to={`/assets?importSession=${session.id}`}>View the {committed.created} imported assets in the register</Link>
              </p>
            </>
          )}
          {session.status === 'undone' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Figure label="Assets reverted" value={undo?.reverted ?? 0} strong />
              <Figure label="Kept (edited since)" value={undo?.skippedEdited ?? 0} />
              <Figure label="Locations reverted" value={undo?.revertedEntities ?? 0} />
            </div>
          )}
        </div>
      </StepShell>
    );
  }

  // status should be dry_run here; anything else means commit would 409.
  const ready = session.status === 'dry_run';
  return (
    <StepShell
      title="Commit to the register"
      hint="Transactional — a partial failure rolls everything back"
      error={error}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onBack} disabled={busy}>Back</button>
          <button type="button" className="btn" disabled={busy || !ready || (dryRun?.blockedErrors ?? 0) > 0} onClick={() => void act(() => commitImport(session.id))}>
            {busy ? 'Committing…' : `Commit ${dryRun?.creates ?? 0} assets`}
          </button>
        </>
      }
    >
      <div className="panel-body">
        {!ready ? (
          <div className="muted" style={{ fontSize: 13 }}>A fresh dry-run is required immediately before commit — go back one step.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Figure label="Assets to create" value={dryRun?.creates ?? 0} strong />
              <Figure label="Skipped duplicates" value={dryRun?.skippedDuplicates ?? 0} />
              <Figure label="New locations" value={dryRun ? Object.values(dryRun.newEntities).reduce((n, a) => n + a.length, 0) : 0} />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
              Every record is stamped with this import session, source file and row. One-click undo stays available for 7 days, or until a record is subsequently edited.
            </div>
          </>
        )}
      </div>
    </StepShell>
  );
}

function Figure({ label, value, strong, alert }: { label: string; value: number; strong?: boolean; alert?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--granite)', borderRadius: 8, padding: '12px 14px' }}>
      <div className="tnum" style={{ fontSize: strong ? 26 : 20, fontFamily: 'var(--f-display)', color: alert ? 'var(--garnet)' : 'var(--charcoal)' }}>{value}</div>
      <div className="muted" style={{ fontSize: 11.5, fontFamily: 'var(--f-ui)' }}>{label}</div>
    </div>
  );
}

/** Sign-off summary as a small CSV download (the Excel report is a Sprint-2 server feature). */
function downloadSummary(session: ImportSession, r: DryRunResult): void {
  const esc = (s: string) => /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [
    'item,value',
    `file,${esc(session.files[0]?.filename ?? '')}`,
    `session,${session.id}`,
    `generated,${new Date().toISOString()}`,
    `assets to create,${r.creates}`,
    `skipped duplicates,${r.skippedDuplicates}`,
    `blocked errors,${r.blockedErrors}`,
    `excluded rows,${r.excluded}`,
    `rows with warnings,${r.warnings}`,
    `linked locations,${r.linkedEntities}`,
    ...Object.entries(r.newEntities).flatMap(([entity, keys]) => keys.map((k) => `new ${entity},${esc(keyToPath(k))}`)),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `fmiq-import-dryrun-${session.id.slice(0, 8)}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
