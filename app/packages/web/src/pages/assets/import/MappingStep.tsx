import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfidenceBadge, StepShell } from './common';
import {
  TARGET_FIELDS, errMessage, getMappings, listRows, putMappings,
  type ImportSession, type MappingProvenance,
} from './importApi';

/**
 * Step 2 — Column mapping. Every auto-suggestion shows confidence + provenance
 * (exact / remembered / fuzzy) and is overridable; unmapped columns are explicitly
 * "Not imported" — never silent (PRD Stage 2, AC2/AC3). Required gate: asset name
 * plus a location anchor (site or building).
 */
export function MappingStep({ session, onBack, onContinue }: {
  session: ImportSession; onBack: () => void; onContinue: () => void;
}) {
  const qc = useQueryClient();
  const mappingsQ = useQuery({ queryKey: ['import-mappings', session.id], queryFn: () => getMappings(session.id) });
  const sampleQ = useQuery({ queryKey: ['import-sample', session.id], queryFn: () => listRows(session.id, { limit: 5 }) });

  // Local edits: source column → target field (null = explicitly skipped).
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mappings = mappingsQ.data?.mappings ?? [];
  const effective = useMemo(() => mappings.map((m) => ({
    ...m,
    target: m.source_column in edits ? edits[m.source_column] : m.target_field,
    edited: m.source_column in edits,
  })), [mappings, edits]);

  const targetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of effective) if (m.target) counts.set(m.target, (counts.get(m.target) ?? 0) + 1);
    return counts;
  }, [effective]);

  const duplicates = [...targetCounts.entries()].filter(([, n]) => n > 1).map(([f]) => f);
  const hasName = targetCounts.has('name');
  const hasAnchor = targetCounts.has('site') || targetCounts.has('building');
  const canContinue = hasName && hasAnchor && duplicates.length === 0 && !busy && mappings.length > 0;

  const samples = useMemo(() => {
    const rows = sampleQ.data?.rows ?? [];
    const bySource = new Map<string, string>();
    for (const m of mappings) {
      const vals = rows
        .map((r) => r.raw[m.source_column])
        .filter((v) => v != null && String(v).trim() !== '')
        .slice(0, 3)
        .map((v) => String(v));
      bySource.set(m.source_column, [...new Set(vals)].join(' · '));
    }
    return bySource;
  }, [sampleQ.data, mappings]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await putMappings(session.id, effective.map((m) => ({ sourceColumn: m.source_column, targetField: m.target ?? null })));
      await qc.invalidateQueries({ queryKey: ['import-mappings', session.id] });
      onContinue();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sheet = session.sheets.find((s) => s.classification === 'data') ?? session.sheets[0];

  return (
    <StepShell
      title="Map columns to register fields"
      hint={sheet ? `Sheet "${sheet.name}" · header on row ${sheet.header_row + 1} · ${sheet.row_count} data rows${session.stats?.droppedBlankRows ? ` · ${session.stats.droppedBlankRows} blank rows dropped` : ''}` : undefined}
      error={error}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onBack} disabled={busy}>Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!hasName && mappings.length > 0 && <span className="muted" style={{ fontSize: 12 }}>Map a column to Asset name to continue.</span>}
            {hasName && !hasAnchor && <span className="muted" style={{ fontSize: 12 }}>Map a location anchor (Site or Building) to continue.</span>}
            {duplicates.length > 0 && <span style={{ fontSize: 12, color: 'var(--garnet)' }}>Two columns target the same field: {duplicates.join(', ')}.</span>}
            <button type="button" className="btn" disabled={!canContinue} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Confirm mappings'}
            </button>
          </div>
        </>
      }
    >
      {mappingsQ.isError && <div className="panel-body"><div className="banner err" style={{ marginTop: 0 }}>Couldn’t load the column mappings.</div></div>}
      {mappingsQ.isLoading && <div className="panel-body muted" style={{ fontSize: 13 }}>Loading suggested mappings…</div>}
      {mappings.length > 0 && (
        <table>
          <thead><tr><th>Source column</th><th>Sample values</th><th>Imports as</th><th>Suggestion</th></tr></thead>
          <tbody>
            {effective.map((m) => (
              <tr key={m.source_column}>
                <td><strong>{m.source_column}</strong></td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {samples.get(m.source_column) || <span className="muted">—</span>}
                </td>
                <td>
                  <select
                    value={m.target ?? ''}
                    aria-label={`Target field for ${m.source_column}`}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [m.source_column]: e.target.value || null }))}
                    style={{
                      padding: '6px 9px', border: '1px solid var(--granite)', borderRadius: 6, fontSize: 13,
                      fontFamily: 'var(--f-ui)', background: '#fff',
                      color: m.target ? 'var(--charcoal)' : 'var(--slate)', minWidth: 220,
                    }}
                  >
                    <option value="">Not imported (skip column)</option>
                    {groupedOptions().map(([group, fields]) => (
                      <optgroup key={group} label={group}>
                        {fields.map((f) => (
                          <option key={f.field} value={f.field}>
                            {f.label}{f.required ? ' (required)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td><ConfidenceBadge provenance={(m.edited ? 'manual' : m.provenance) as MappingProvenance} confidence={m.edited ? 1 : m.confidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StepShell>
  );
}

function groupedOptions(): Array<[string, typeof TARGET_FIELDS]> {
  const groups = new Map<string, typeof TARGET_FIELDS>();
  for (const f of TARGET_FIELDS) {
    const arr = groups.get(f.group);
    if (arr) arr.push(f); else groups.set(f.group, [f]);
  }
  return [...groups.entries()];
}
