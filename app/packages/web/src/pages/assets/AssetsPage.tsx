import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { shortDate } from '../../lib/format';
import { EstateTree } from './EstateTree';
import { conditionTone, criticalityTone, useAssets, useEstateTree, type EstateNode } from './useEstate';
import { apiText, type AssetListFilter } from '../../api';

const PAGE_SIZE = 50;
const CRITICALITIES = ['critical', 'high', 'medium', 'low'];

/**
 * Register browse (route /assets) — server-side search/filter/pagination over
 * GET /api/v1/assets, scoped by the location tree (GET /api/v1/locations/tree).
 * PRD-asset-register-import §4.2. Accepts ?importSession=<id> ("show me what this
 * import created" — Research §1.5 pattern 6).
 */
export function AssetsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const importSessionId = params.get('importSession') ?? undefined;

  const treeQ = useEstateTree();
  const [chain, setChain] = useState<EstateNode[]>([]);
  const selected = chain.length ? chain[chain.length - 1] : null;

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [condition, setCondition] = useState('');
  const [criticality, setCriticality] = useState('');
  const [assetType, setAssetType] = useState('');
  const [offset, setOffset] = useState(0);

  // Debounce the search box into the server-side q parameter.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Tree node → server filter. Floors have no server-side filter; scope to their building.
  const locationFilter = useMemo((): Pick<AssetListFilter, 'spaceId' | 'buildingId' | 'siteId'> => {
    if (!selected) return {};
    if (selected.kind === 'space') return { spaceId: selected.id };
    if (selected.kind === 'building') return { buildingId: selected.id };
    if (selected.kind === 'floor') {
      const building = [...chain].reverse().find((n) => n.kind === 'building');
      return building ? { buildingId: building.id } : {};
    }
    return { siteId: selected.id };
  }, [selected, chain]);

  const filter = useMemo((): AssetListFilter => ({
    q: q || undefined,
    conditionGrade: condition || undefined,
    criticality: criticality || undefined,
    assetType: assetType || undefined,
    importSessionId,
    ...locationFilter,
    limit: PAGE_SIZE,
    offset,
  }), [q, condition, criticality, assetType, importSessionId, locationFilter, offset]);

  // Any filter change resets to the first page.
  useEffect(() => { setOffset(0); }, [q, condition, criticality, assetType, importSessionId, locationFilter]);

  const assetsQ = useAssets(filter);
  const assets = assetsQ.data?.assets ?? [];
  const total = assetsQ.data?.total ?? 0;

  const types = useMemo(
    () => [...new Set(assets.map((a) => a.asset_type).filter((t): t is string => !!t))].sort(),
    [assets],
  );

  return (
    <>
      {(treeQ.isError || assetsQ.isError) && (
        <div className="banner err">Couldn’t load the asset register — start the stack with "npm run dev".</div>
      )}
      <div className="page-head">
        <div>
          <div className="page-title">Estate &amp; Assets</div>
          <div className="page-sub">The Asset Information Model — Site, Building, Floor, Space, Asset. Heritage and protected-structure aware; every change audit-trailed.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn ghost" onClick={() => downloadCsv(filter)}>Export CSV</button>
          <Link to="/assets/import" className="btn" style={{ textDecoration: 'none' }}>Import register</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head"><h3>Estate hierarchy</h3></div>
          <div className="panel-body" style={{ padding: 10 }}>
            {treeQ.isLoading
              ? <div className="muted" style={{ fontSize: 12, padding: '6px 8px' }}>Loading estate…</div>
              : <EstateTree nodes={treeQ.data ?? []} selectedId={selected?.id ?? null} onSelect={setChain} />}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <h3>
              <nav aria-label="Location breadcrumb" style={{ display: 'inline' }}>
                <button type="button" onClick={() => setChain([])} style={{ font: 'inherit', color: chain.length ? 'var(--info)' : 'inherit' }}>All assets</button>
                {chain.map((n, i) => (
                  <span key={n.id}>
                    <span className="muted"> / </span>
                    <button type="button" onClick={() => setChain(chain.slice(0, i + 1))} style={{ font: 'inherit', color: i < chain.length - 1 ? 'var(--info)' : 'inherit' }}>{n.name}</button>
                  </span>
                ))}
              </nav>
            </h3>
            <span className="hint tnum">
              {total ? `${offset + 1}–${offset + assets.length} of ${total}` : assetsQ.isLoading ? 'Loading…' : '0 assets'}
            </span>
          </div>
          <div className="panel-body" style={{ paddingBottom: 0 }}>
            {importSessionId && (
              <div className="banner" style={{ marginTop: 0, marginBottom: 10 }}>
                Showing assets created by one import session.
                <button type="button" onClick={() => { params.delete('importSession'); setParams(params, { replace: true }); }} style={{ font: 'inherit', textDecoration: 'underline' }}>Clear</button>
              </div>
            )}
            {selected?.kind === 'floor' && (
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                Floor selected — results are scoped to its building (assets filter by site, building or space).
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, tag, serial, manufacturer, model"
                aria-label="Search assets"
                style={{ flex: '1 1 260px', padding: '8px 12px', border: '1px solid var(--granite)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--f-body)' }}
              />
              <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Filter by condition grade" style={selectStyle}>
                <option value="">Condition: all</option>
                {['A', 'B', 'C', 'D'].map((g) => <option key={g} value={g}>Condition {g}</option>)}
              </select>
              <select value={criticality} onChange={(e) => setCriticality(e.target.value)} aria-label="Filter by criticality" style={selectStyle}>
                <option value="">Criticality: all</option>
                {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={assetType} onChange={(e) => setAssetType(e.target.value)} aria-label="Filter by asset type" style={selectStyle}>
                <option value="">Type: all</option>
                {assetType && !types.includes(assetType) && <option value={assetType}>{assetType}</option>}
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Location</th><th>Condition</th><th>Criticality</th><th>Installed</th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} onClick={() => navigate(`/assets/${a.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="wo-id"><Link to={`/assets/${a.id}`} onClick={(e) => e.stopPropagation()}>{a.code}</Link></td>
                  <td><strong>{a.name}</strong></td>
                  <td className="muted">{a.asset_type ?? '—'}</td>
                  <td className="muted">{[a.building, a.location].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{a.condition_grade ? <StatusBadge tone={conditionTone(a.condition_grade)}>{a.condition_grade}</StatusBadge> : <span className="muted">—</span>}</td>
                  <td>{a.criticality ? <StatusBadge tone={criticalityTone(a.criticality)}>{a.criticality}</StatusBadge> : <span className="muted">—</span>}</td>
                  <td className="tnum">{shortDate(a.install_date)}</td>
                </tr>
              ))}
              {!assets.length && (
                <tr><td colSpan={7} className="muted">
                  {assetsQ.isLoading ? 'Loading assets…'
                    : total === 0 && !q && !condition && !criticality && !assetType && !selected
                      ? 'No assets in the register yet — use Import register or the API to add them.'
                      : 'No assets match the current search/filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: '1px solid var(--granite)' }}>
              <button type="button" className="btn ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
              <span className="hint tnum">Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button type="button" className="btn ghost" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Auth-aware filtered CSV export (GET /api/v1/assets/export.csv) saved via a blob URL. */
async function downloadCsv(filter: AssetListFilter): Promise<void> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (k === 'limit' || k === 'offset') continue;
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  const csv = await apiText(`/api/v1/assets/export.csv${qs ? `?${qs}` : ''}`);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fmiq-asset-register.csv';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const selectStyle = {
  padding: '8px 10px', border: '1px solid var(--granite)', borderRadius: 6,
  fontSize: 13, fontFamily: 'var(--f-ui)', background: '#fff', color: 'var(--charcoal)',
} as const;
