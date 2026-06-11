import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../../../components/StatusBadge';
import { CountPills, StepShell } from './common';
import {
  errMessage, fieldLabel, getMappings, listRows, patchRows, runValidation,
  type ImportSession, type RowState, type StagedRow,
} from './importApi';

const PAGE = 50;

/**
 * Step 4 — Validate + fix in grid. Errors block, warnings pass (PRD §1.2).
 * Failing cells are edited in place (Enter saves, Esc cancels) via PATCH
 * /imports/:id/rows, which re-normalises and re-validates the row server-side.
 */
export function ValidationStep({ session, onBack, onContinue }: {
  session: ImportSession; onBack: () => void; onContinue: () => void;
}) {
  const qc = useQueryClient();
  const [stateFilter, setStateFilter] = useState<RowState | ''>('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranOnce = useRef(false);

  const mappingsQ = useQuery({ queryKey: ['import-mappings', session.id], queryFn: () => getMappings(session.id) });
  const rowsQ = useQuery({
    queryKey: ['import-rows', session.id, stateFilter, offset],
    queryFn: () => listRows(session.id, { state: stateFilter || undefined, limit: PAGE, offset }),
  });

  const counts = session.rowCounts;
  const pending = counts.pending ?? 0;
  const errors = counts.error ?? 0;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['import-session', session.id] }),
      qc.invalidateQueries({ queryKey: ['import-rows', session.id] }),
    ]);
  };

  const validate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { counts: c } = await runValidation(session.id);
      await refresh();
      // Land the user on the errors if there are any (filter-to-errors, PRD Stage 4).
      setStateFilter(c.error > 0 ? 'error' : '');
      setOffset(0);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // First entry (or pending rows after a mapping change): run validation automatically.
  useEffect(() => {
    if (ranOnce.current || busy) return;
    if (pending > 0 || (errors === 0 && (counts.valid ?? 0) === 0 && (counts.warning ?? 0) === 0)) {
      ranOnce.current = true;
      void validate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const columns = useMemo(() => (mappingsQ.data?.mappings ?? [])
    .filter((m) => m.target_field !== null)
    .map((m) => ({ source: m.source_column, field: m.target_field as string })), [mappingsQ.data]);

  const editCell = async (rowId: string, sourceColumn: string, value: string) => {
    setBusy(true);
    setError(null);
    try {
      await patchRows(session.id, [{ rowId, raw: { [sourceColumn]: value === '' ? null : value } }]);
      await refresh();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setExcluded = async (row: StagedRow, exclude: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // Restore = re-validate with an empty patch; exclude = state 'excluded'.
      await patchRows(session.id, [exclude ? { rowId: row.id, exclude: true } : { rowId: row.id, raw: {} }]);
      await refresh();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rows = rowsQ.data?.rows ?? [];
  const validated = pending === 0 && ((counts.valid ?? 0) + (counts.warning ?? 0) + errors + (counts.excluded ?? 0)) > 0;
  const canContinue = validated && errors === 0 && !busy;

  return (
    <StepShell
      title="Validate and fix rows"
      hint="Errors block the import; warnings pass. Fix cells in the grid or exclude rows."
      error={error}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onBack} disabled={busy}>Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {errors > 0 && <span style={{ fontSize: 12, color: 'var(--garnet)' }}>{errors} rows still have blocking errors — fix or exclude them.</span>}
            <button type="button" className="btn" disabled={!canContinue} onClick={onContinue}>Continue to hierarchy</button>
          </div>
        </>
      }
    >
      <div className="panel-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 12 }}>
        <CountPills counts={counts} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={stateFilter}
            aria-label="Filter rows by validation state"
            onChange={(e) => { setStateFilter(e.target.value as RowState | ''); setOffset(0); }}
            style={{ padding: '6px 9px', border: '1px solid var(--granite)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--f-ui)', background: '#fff' }}
          >
            <option value="">All rows</option>
            <option value="error">Errors only</option>
            <option value="warning">Warnings only</option>
            <option value="valid">Valid only</option>
            <option value="excluded">Excluded only</option>
          </select>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void validate()}>
            {busy ? 'Working…' : 'Re-run validation'}
          </button>
        </div>
      </div>

      {(rowsQ.isLoading || mappingsQ.isLoading) && <div className="panel-body muted" style={{ fontSize: 13, paddingTop: 0 }}>Loading rows…</div>}
      {rowsQ.isError && <div className="panel-body" style={{ paddingTop: 0 }}><div className="banner err" style={{ marginTop: 0 }}>Couldn’t load the staged rows.</div></div>}
      {!rowsQ.isLoading && rows.length === 0 && (
        <div className="panel-body muted" style={{ fontSize: 13, paddingTop: 0 }}>
          {stateFilter ? `No rows in state "${stateFilter}".` : 'No rows.'}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th className="tnum">Row</th>
                <th>State</th>
                {columns.map((c) => <th key={c.source} title={c.source}>{fieldLabel(c.field)}</th>)}
                <th>Issues</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.state === 'excluded' ? { opacity: 0.55 } : undefined}>
                  <td className="tnum">{r.source_row_no}</td>
                  <td><RowStateBadge state={r.state} /></td>
                  {columns.map((c) => (
                    <EditableCell
                      key={c.source}
                      value={r.raw[c.source]}
                      invalid={(r.issues ?? []).some((i) => i.field === c.field && i.severity === 'error')}
                      disabled={busy || r.state === 'excluded'}
                      onSave={(v) => void editCell(r.id, c.source, v)}
                    />
                  ))}
                  <td style={{ maxWidth: 280 }}>
                    {(r.issues ?? []).map((i, idx) => (
                      <div key={idx} style={{ fontSize: 11.5, color: i.severity === 'error' ? 'var(--garnet)' : 'var(--gold)' }}>{i.message}</div>
                    ))}
                  </td>
                  <td>
                    {r.state === 'excluded'
                      ? <button type="button" disabled={busy} onClick={() => void setExcluded(r, false)} style={{ fontSize: 12, textDecoration: 'underline', color: 'var(--info)' }}>Restore</button>
                      : <button type="button" disabled={busy} onClick={() => void setExcluded(r, true)} style={{ fontSize: 12, textDecoration: 'underline', color: 'var(--slate)' }}>Exclude</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '10px 18px', borderTop: '1px solid var(--granite)' }}>
        <button type="button" className="btn ghost" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
        <button type="button" className="btn ghost" disabled={rows.length < PAGE || busy} onClick={() => setOffset(offset + PAGE)}>Next</button>
      </div>
    </StepShell>
  );
}

function RowStateBadge({ state }: { state: RowState }) {
  switch (state) {
    case 'valid': return <StatusBadge tone="ok">Valid</StatusBadge>;
    case 'warning': return <StatusBadge tone="amber">Warning</StatusBadge>;
    case 'error': return <StatusBadge tone="crit">Error</StatusBadge>;
    case 'excluded': return <StatusBadge tone="neutral">Excluded</StatusBadge>;
    default: return <StatusBadge tone="neutral">Pending</StatusBadge>;
  }
}

/** Click-to-edit cell. Enter saves, Escape cancels, blur saves when changed. */
function EditableCell({ value, invalid, disabled, onSave }: {
  value: string | number | null; invalid: boolean; disabled: boolean; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = value == null || value === '' ? '—' : String(value);

  if (editing) {
    return (
      <td>
        <input
          autoFocus
          value={draft}
          aria-label="Edit cell value"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setEditing(false); if (draft !== display) onSave(draft); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => { setEditing(false); if (draft !== (value == null ? '' : String(value))) onSave(draft); }}
          style={{ width: '100%', minWidth: 90, padding: '4px 7px', border: '1px solid var(--heritage-green)', borderRadius: 4, fontSize: 12.5, fontFamily: 'var(--f-body)' }}
        />
      </td>
    );
  }
  return (
    <td
      onClick={() => { if (!disabled) { setDraft(value == null ? '' : String(value)); setEditing(true); } }}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDraft(value == null ? '' : String(value)); setEditing(true); } }}
      tabIndex={disabled ? -1 : 0}
      role={disabled ? undefined : 'button'}
      aria-label={disabled ? undefined : `Edit value ${display}`}
      style={{
        cursor: disabled ? 'default' : 'pointer', fontSize: 12.5,
        background: invalid ? '#F7E2DA' : undefined,
        color: value == null ? 'var(--slate)' : undefined,
      }}
    >
      {display}
    </td>
  );
}
