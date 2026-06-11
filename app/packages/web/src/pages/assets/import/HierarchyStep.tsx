import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../../../components/StatusBadge';
import { useEstateTree, type EstateNode } from '../useEstate';
import { StepShell, keyToPath } from './common';
import {
  errMessage, getEntityDecisions, putEntityDecisions, resolveHierarchy,
  type EntityDecision, type ImportSession,
} from './importApi';

const TIER_LABEL: Record<EntityDecision['entity'], string> = {
  site: 'Sites', building: 'Buildings', floor: 'Floors', space: 'Spaces',
};

interface Candidate { id: string; label: string }

/**
 * Step 5 — Hierarchy resolution. Every inbound site/building/floor/space is an
 * explicit link-vs-create decision with a confirm list — no silent taxonomy
 * creation (the Limble/MaintainX failure; PRD Stage 5, AC3).
 */
export function HierarchyStep({ session, onBack, onContinue }: {
  session: ImportSession; onBack: () => void; onContinue: () => void;
}) {
  const qc = useQueryClient();
  const treeQ = useEstateTree();
  const resolved = useRef(false);
  const [resolving, setResolving] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { action: 'link' | 'create'; linkedId: string | null }>>({});

  const decisionsQ = useQuery({
    queryKey: ['import-decisions', session.id],
    queryFn: () => getEntityDecisions(session.id),
    enabled: !resolving,
  });

  // Refresh suggestions on entry (idempotent server-side; confirmed decisions are preserved).
  useEffect(() => {
    if (resolved.current) return;
    resolved.current = true;
    void (async () => {
      try {
        await resolveHierarchy(session.id);
        await qc.invalidateQueries({ queryKey: ['import-session', session.id] });
      } catch (err) {
        setError(errMessage(err));
      } finally {
        setResolving(false);
      }
    })();
  }, [session.id, qc]);

  const candidates = useMemo(() => buildCandidates(treeQ.data ?? []), [treeQ.data]);
  const decisions = decisionsQ.data?.decisions ?? [];

  const effective = decisions.map((d) => ({
    ...d,
    ...(edits[d.id] ?? { action: d.action, linkedId: d.linked_id }),
  }));
  const creates = effective.filter((d) => d.action === 'create');
  const links = effective.filter((d) => d.action === 'link');

  const confirmAll = async () => {
    setBusy(true);
    setError(null);
    try {
      // PUT requires at least one decision; a file with no location columns has none.
      if (effective.length > 0) {
        await putEntityDecisions(session.id, effective.map((d) => ({
          entity: d.entity, inboundKey: d.inbound_key, action: d.action,
          linkedId: d.action === 'link' ? d.linkedId : null,
        })));
        await qc.invalidateQueries({ queryKey: ['import-decisions', session.id] });
      }
      onContinue();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const loading = resolving || decisionsQ.isLoading;

  return (
    <StepShell
      title="Resolve locations — link or create"
      hint="Every new entity is listed and confirmed before commit; nothing is created silently"
      error={error}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onBack} disabled={busy}>Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {creates.length} new · {links.length} linked to existing
            </span>
            <button type="button" className="btn" disabled={busy || loading || decisions.length === 0} onClick={() => void confirmAll()}>
              {busy ? 'Confirming…' : decisions.length === 0 ? 'Confirm and continue' : `Confirm ${decisions.length} decisions and continue`}
            </button>
          </div>
        </>
      }
    >
      {loading && <div className="panel-body muted" style={{ fontSize: 13 }}>Matching inbound locations against the register…</div>}
      {!loading && decisions.length === 0 && (
        <div className="panel-body muted" style={{ fontSize: 13 }}>No location columns were mapped — assets will import without a location link. Continue.</div>
      )}
      {!loading && decisions.length > 0 && (
        <>
          {(['site', 'building', 'floor', 'space'] as const).map((tier) => {
            const tierDecisions = effective.filter((d) => d.entity === tier);
            if (!tierDecisions.length) return null;
            return (
              <div key={tier}>
                <div style={{ padding: '10px 18px 4px', fontFamily: 'var(--f-ui)', fontWeight: 600, fontSize: 13 }}>{TIER_LABEL[tier]}</div>
                <table>
                  <thead><tr><th>Inbound location</th><th>Decision</th><th>Suggestion</th></tr></thead>
                  <tbody>
                    {tierDecisions.map((d) => (
                      <tr key={d.id}>
                        <td><strong>{keyToPath(d.inbound_key)}</strong></td>
                        <td>
                          <select
                            value={d.action === 'create' ? '' : (d.linkedId ?? '')}
                            aria-label={`Decision for ${tier} ${keyToPath(d.inbound_key)}`}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEdits((prev) => ({
                                ...prev,
                                [d.id]: v === '' ? { action: 'create', linkedId: null } : { action: 'link', linkedId: v },
                              }));
                            }}
                            style={{ padding: '6px 9px', border: '1px solid var(--granite)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--f-ui)', background: '#fff', minWidth: 240 }}
                          >
                            <option value="">Create new {tier}</option>
                            {(candidates[tier] ?? []).map((c) => (
                              <option key={c.id} value={c.id}>Link: {c.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {d.confirmed_by
                            ? <StatusBadge tone="ok">Confirmed</StatusBadge>
                            : d.action === 'link'
                              ? <StatusBadge tone="info">Match {Math.round(Number(d.confidence ?? 0) * 100)}%</StatusBadge>
                              : <StatusBadge tone="amber">New</StatusBadge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div className="panel-body muted" style={{ fontSize: 12 }}>
            Spaces listed without a floor sit under a "Level 0" placeholder floor; spaces created here default to type "office" (survey files rarely carry a space type). Both are created only on commit.
          </div>
        </>
      )}
    </StepShell>
  );
}

function buildCandidates(tree: EstateNode[]): Record<EntityDecision['entity'], Candidate[]> {
  const out: Record<EntityDecision['entity'], Candidate[]> = { site: [], building: [], floor: [], space: [] };
  const walk = (nodes: EstateNode[], path: string[]) => {
    for (const n of nodes) {
      const label = [...path, n.name].join(' / ');
      out[n.kind].push({ id: n.id, label });
      walk(n.children, [...path, n.name]);
    }
  };
  walk(tree, []);
  return out;
}
