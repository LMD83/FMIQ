import { useRef, useState, type DragEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge';
import { shortDate } from '../../../lib/format';
import { StepShell, sessionStatusBadge } from './common';
import {
  createImport, errMessage, fileToBase64, formatBytes, listImports,
  type ImportSessionSummary,
} from './importApi';

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm';
const MAX_BYTES = 50 * 1024 * 1024; // mirror of importParse.MAX_BYTES

/**
 * Step 1 — Upload. Drag-and-drop or pick a survey file; POST /api/v1/imports
 * (JSON + base64, Sprint-1 transport) parses it, detects the header row and
 * auto-maps columns in one round trip. Below: the import history dashboard.
 */
export function UploadStep({ onCreated, onResume }: {
  onCreated: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = async (file: File | undefined | null) => {
    if (!file || busy) return;
    setError(null);
    if (!/\.(csv|tsv|txt|xlsx|xls|xlsm)$/i.test(file.name)) {
      setError(`Unsupported file type: ${file.name}. Use .xlsx, .xls, .csv or .tsv.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)} — the ceiling is 50 MB.`);
      return;
    }
    setBusy(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await createImport({ filename: file.name, contentBase64, targetMode: 'create_only' });
      onCreated(res.sessionId);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void accept(e.dataTransfer.files?.[0]);
  };

  return (
    <>
      <StepShell
        title="Upload your register file"
        hint="Nothing touches the live register until Commit"
        error={error}
      >
        <div className="panel-body">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a spreadsheet — drag and drop, or press Enter to browse"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragOver ? 'var(--heritage-green)' : 'var(--granite)'}`,
              borderRadius: 8, padding: '44px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'var(--pale-stone)' : 'transparent', outlineOffset: 2,
            }}
          >
            {busy ? (
              <>
                <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600, fontSize: 15 }}>Uploading and parsing…</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Detecting the header row and suggesting column mappings.</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600, fontSize: 15 }}>Drag a spreadsheet here, or click to browse</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                  Upload what you have — a contractor survey workbook is fine. Junk header rows, mixed dates and local condition scales are handled in the next steps.
                </div>
                <div className="muted tnum" style={{ fontSize: 12, marginTop: 10 }}>.xlsx · .xls · .csv · .tsv — up to 50 MB / 50,000 rows</div>
              </>
            )}
            <input
              ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
              onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Sprint-1 path: single data sheet, create-only mode. COBie workbooks, multi-sheet union and upsert re-import arrive next sprint.
          </div>
        </div>
      </StepShell>

      <ImportHistory onResume={onResume} />
    </>
  );
}

/** Import history dashboard (PRD AC10) — every session, counts, actor, undo state. */
export function ImportHistory({ onResume }: { onResume?: (sessionId: string) => void }) {
  const q = useQuery({ queryKey: ['import-sessions'], queryFn: listImports });
  const sessions = q.data?.sessions ?? [];

  return (
    <div className="panel">
      <div className="panel-head"><h3>Import history</h3><span className="hint tnum">{sessions.length} sessions</span></div>
      {q.isError && <div className="panel-body"><div className="banner err" style={{ marginTop: 0 }}>Couldn’t load import history.</div></div>}
      {sessions.length ? (
        <table>
          <thead><tr><th>File</th><th>Status</th><th>Rows</th><th>Created</th><th>Skipped</th><th>By</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => <HistoryRow key={s.id} s={s} onResume={onResume} />)}
          </tbody>
        </table>
      ) : (
        !q.isError && <div className="panel-body muted" style={{ fontSize: 13 }}>{q.isLoading ? 'Loading…' : 'No imports yet — your first session will appear here.'}</div>
      )}
    </div>
  );
}

function HistoryRow({ s, onResume }: { s: ImportSessionSummary; onResume?: (id: string) => void }) {
  const badge = sessionStatusBadge(s.status);
  const committed = s.stats?.committed;
  const undoable = s.status === 'committed' && s.undo_expires_at != null && new Date(s.undo_expires_at).getTime() > Date.now();
  const inFlight = !['committed', 'undone', 'committing'].includes(s.status);
  return (
    <tr>
      <td><strong>{s.filename ?? '—'}</strong> <span className="muted tnum" style={{ fontSize: 11 }}>{formatBytes(s.size_bytes)}</span></td>
      <td><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>{s.status === 'committed' && undoable && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>undo until {shortDate(s.undo_expires_at)}</span>}</td>
      <td className="tnum">{s.stats?.rows ?? '—'}</td>
      <td className="tnum">{committed ? committed.created : '—'}</td>
      <td className="tnum">{committed ? committed.skipped : '—'}</td>
      <td className="muted">{s.created_by_name ?? '—'}</td>
      <td className="tnum">{shortDate(s.created_at)}</td>
      <td>
        {inFlight && onResume
          ? <button type="button" className="btn ghost" style={{ height: 30, padding: '4px 10px', fontSize: 12 }} onClick={() => onResume(s.id)}>Resume</button>
          : s.status === 'committed'
            ? <Link to={`/assets?importSession=${s.id}`} style={{ fontSize: 12.5 }}>View assets</Link>
            : null}
      </td>
    </tr>
  );
}
