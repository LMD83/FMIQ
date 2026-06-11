import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDocuments, listDocumentVersions, type DocumentItem, type DocumentVersion } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { docTypeLabel, shortDate } from '../lib/format';

/**
 * Document / O&M management — the golden thread. A versioned register of O&M manuals,
 * drawings, certs, warranties and RAMS, linked to assets/certs/handover. Surfaces the
 * BCAR/CWMF golden thread so an FM never hunts a shared drive.
 */
export function Documents() {
  const [goldenOnly, setGoldenOnly] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ['documents', goldenOnly],
    queryFn: () => listDocuments(goldenOnly ? { goldenThread: true } : undefined),
  });
  const documents = data?.documents ?? [];
  const [open, setOpen] = useState<DocumentItem | null>(null);
  const versions = useQuery({
    queryKey: ['document-versions', open?.id],
    queryFn: () => listDocumentVersions(open!.id),
    enabled: !!open,
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Documents &amp; O&amp;M</div>
          <div className="page-sub">The golden thread — versioned O&amp;M manuals, drawings, certs and warranties, linked to the estate.</div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={goldenOnly} onChange={(e) => setGoldenOnly(e.target.checked)} />
          Golden-thread only
        </label>
      </div>
      {isError && <div className="banner err">Couldn’t load documents — start the stack with “npm run dev”.</div>}

      <div className="panel">
        <div className="panel-head"><h3>Register</h3><span className="hint">{documents.length} documents</span></div>
        <table>
          <thead><tr><th>Title</th><th>Type</th><th>Discipline</th><th>Version</th><th>Golden thread</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {documents.map((d: DocumentItem) => (
              <tr key={d.id}>
                <td><strong>{d.title}</strong>{d.reference ? <span className="muted"> · {d.reference}</span> : null}</td>
                <td>{docTypeLabel(d.doc_type)}</td>
                <td className="muted">{d.discipline ?? '—'}</td>
                <td className="tnum">v{d.version_no ?? 1}</td>
                <td>{d.golden_thread ? <StatusBadge tone="ok">In thread</StatusBadge> : <span className="muted">—</span>}</td>
                <td className="muted tnum">{shortDate(d.updated_at)}</td>
                <td><button className="btn ghost" onClick={() => setOpen(d)} aria-label={`View versions of ${d.title}`}>Versions</button></td>
              </tr>
            ))}
            {!documents.length && <tr><td colSpan={7} className="muted">No documents{goldenOnly ? ' flagged for the golden thread' : ''}.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>{open.title} — version history</h3><button className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
          <div className="panel-body">
            {versions.isLoading && <div className="muted">Loading…</div>}
            <table>
              <thead><tr><th>Version</th><th>File</th><th>Uploaded</th><th>Current</th></tr></thead>
              <tbody>
                {(versions.data?.versions ?? []).map((v: DocumentVersion) => (
                  <tr key={v.id}>
                    <td className="tnum">v{v.version_no}</td>
                    <td className="muted">{v.file_name ?? v.blob_uri}</td>
                    <td className="muted tnum">{shortDate(v.uploaded_at)}</td>
                    <td>{v.is_current ? <StatusBadge tone="ok">Current</StatusBadge> : <span className="muted">superseded</span>}</td>
                  </tr>
                ))}
                {!versions.isLoading && !(versions.data?.versions ?? []).length && <tr><td colSpan={4} className="muted">No versions.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
