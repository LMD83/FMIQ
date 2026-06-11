import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { shortDate } from '../../lib/format';
import { conditionTone, criticalityTone, locationChain, useAssetDetail, useEstateTree } from './useEstate';

const CONDITION_LABEL: Record<string, string> = {
  A: 'A — Good', B: 'B — Fair', C: 'C — Poor', D: 'D — Very poor / end of life',
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'asset.created': 'Created', 'asset.updated': 'Updated', 'asset.deleted': 'Deleted',
  'asset.import_created': 'Created by import', 'asset.import_undone': 'Import undone',
};

/** Asset detail (route /assets/:id) — GET /api/v1/assets/:id → { asset, provenance, audit }. */
export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detailQ = useAssetDetail(id);
  const treeQ = useEstateTree();
  const asset = detailQ.data?.asset ?? null;
  const provenance = detailQ.data?.provenance ?? null;
  const audit = detailQ.data?.audit ?? [];

  if (detailQ.isError) {
    return (
      <>
        <div className="banner err">Asset not found, or the API is unavailable.</div>
        <p style={{ marginTop: 12 }}><Link to="/assets">Back to the asset register</Link></p>
      </>
    );
  }
  if (!asset) return <div className="muted">Loading asset…</div>;

  const chain = locationChain(treeQ.data, { spaceId: asset.space_id, buildingId: asset.building_id })
    ?? (asset.space_id || asset.building_id ? 'Resolving location…' : 'Unassigned');

  return (
    <>
      <div className="page-head">
        <div>
          <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
            <Link to="/assets">Estate &amp; Assets</Link> <span aria-hidden>/</span> <span className="mono">{asset.code}</span>
          </nav>
          <div className="page-title">{asset.name}</div>
          <div className="page-sub">{asset.asset_type ?? 'Untyped asset'} · {chain}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/assets" className="btn ghost" style={{ textDecoration: 'none' }}>Back to register</Link>
        </div>
      </div>

      <div className="grid3">
        <div className="panel"><div className="panel-head"><h3>Identity</h3></div><div className="panel-body">
          <DetailRow label="Code"><span className="mono">{asset.code}</span></DetailRow>
          <DetailRow label="Asset tag"><span className="mono">{asset.asset_tag ?? '—'}</span></DetailRow>
          <DetailRow label="Serial no"><span className="mono">{asset.serial_no ?? '—'}</span></DetailRow>
          <DetailRow label="QR tag"><span className="mono">{asset.qr_uid ?? '—'}</span></DetailRow>
          <DetailRow label="Parent asset">{asset.parent_asset_id ? <Link to={`/assets/${asset.parent_asset_id}`}>View parent</Link> : '—'}</DetailRow>
        </div></div>

        <div className="panel"><div className="panel-head"><h3>Classification &amp; condition</h3></div><div className="panel-body">
          <DetailRow label="Type">{asset.asset_type ?? '—'}</DetailRow>
          <DetailRow label="Uniclass"><span className="mono">{asset.uniclass_code ?? '—'}</span></DetailRow>
          <DetailRow label="SFG20"><span className="mono">{asset.sfg20_ref ?? '—'}</span></DetailRow>
          <DetailRow label="Condition grade">
            {asset.condition_grade
              ? <StatusBadge tone={conditionTone(asset.condition_grade)}>{CONDITION_LABEL[asset.condition_grade] ?? asset.condition_grade}</StatusBadge>
              : <span className="muted">Not graded</span>}
          </DetailRow>
          <DetailRow label="Criticality">
            {asset.criticality
              ? <StatusBadge tone={criticalityTone(asset.criticality)}>{asset.criticality}</StatusBadge>
              : <span className="muted">Not set</span>}
          </DetailRow>
        </div></div>

        <div className="panel"><div className="panel-head"><h3>Location &amp; lifecycle</h3></div><div className="panel-body">
          <DetailRow label="Location">{chain}</DetailRow>
          <DetailRow label="Manufacturer">{asset.manufacturer ?? '—'}</DetailRow>
          <DetailRow label="Model">{asset.model ?? '—'}</DetailRow>
          <DetailRow label="Installed"><span className="tnum">{shortDate(asset.install_date)}</span></DetailRow>
          <DetailRow label="Expected life">{asset.expected_life_years != null ? `${asset.expected_life_years} years` : '—'}</DetailRow>
          <DetailRow label="Replacement cost"><span className="tnum">{money(asset.replacement_cost)}</span></DetailRow>
          <DetailRow label="Warranty expiry"><span className="tnum">{shortDate(asset.warranty_expiry)}</span></DetailRow>
        </div></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Provenance</h3>{provenance && <span className="hint">Every imported record carries its session, file and row</span>}</div>
        <div className="panel-body">
          {provenance ? (
            <>
              <DetailRow label="Source file">{provenance.filename ?? '—'}</DetailRow>
              <DetailRow label="Source row"><span className="tnum">{provenance.source_row ?? '—'}</span></DetailRow>
              <DetailRow label="Imported by">{provenance.imported_by ?? '—'}</DetailRow>
              <DetailRow label="Committed"><span className="tnum">{shortDate(provenance.committed_at)}</span></DetailRow>
              <DetailRow label="Import session">
                <Link to={`/assets/import?session=${provenance.session_id}`}>View import session</Link>
              </DetailRow>
            </>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>Created directly in the register (not via import).</span>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Audit history</h3><span className="hint tnum">{audit.length} events</span></div>
        {audit.length ? (
          <table>
            <thead><tr><th>When</th><th>Action</th><th>Actor</th></tr></thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.id}>
                  <td className="tnum">{new Date(e.at).toLocaleString('en-IE')}</td>
                  <td>{AUDIT_ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{e.user_id ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="panel-body muted" style={{ fontSize: 13 }}>No audit events recorded for this asset.</div>
        )}
      </div>
    </>
  );
}

function money(v: number | string | null): string {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--granite)', fontSize: 13, alignItems: 'baseline' }}>
      <span className="muted" style={{ width: 130, flexShrink: 0, fontFamily: 'var(--f-ui)', fontSize: 12 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
