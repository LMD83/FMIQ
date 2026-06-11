import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, previewGate, setWorkOrderStatus, ackNotification, resolveAssetByQr, reportIssue, type WorkOrder, type GateEvaluation, type ResolvedAsset, type CaptureResult } from '../api';
import { GateBanner } from '../components/GateBanner';
import { StatusBadge } from '../components/StatusBadge';
import { OfflineQueue, indexedDbStorage, type QueuedAction } from '../offline/queue';

/**
 * Field app (mobile/PWA shell, S11). Glove-friendly job list with the readiness gate
 * front-and-centre, photo capture, and an OFFLINE WRITE-QUEUE: actions taken with no
 * signal are persisted (IndexedDB) and replayed on reconnect (at-least-once).
 */
const queue = new OfflineQueue(indexedDbStorage());

/** Replay a queued action against the API. */
async function sendQueued(action: QueuedAction): Promise<void> {
  if (action.kind === 'wo_status') {
    const p = action.payload as { id: string; status: 'in_progress' | 'closed' };
    await setWorkOrderStatus(p.id, p.status);
  } else if (action.kind === 'ack') {
    const p = action.payload as { id: string };
    await ackNotification(p.id);
  }
  // 'photo' upload lands when the blob store is wired (EP-6).
}

/**
 * QR issue capture (S11, Snapfix-style). Scan/enter an asset's QR → resolve the asset →
 * one line of text → a reactive work order in seconds, location pre-filled. Camera scan
 * plugs into the QR input (a scanner library writes the decoded uid here); manual entry
 * keeps it glove- and offline-friendly.
 */
function ReportIssue({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [qrUid, setQrUid] = useState('');
  const [asset, setAsset] = useState<ResolvedAsset | null>(null);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'routine' | 'high' | 'critical'>('routine');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setQrUid(''); setAsset(null); setDescription(''); setPriority('routine'); setResult(null); setError(null); };

  const resolve = async () => {
    setError(null); setAsset(null);
    if (!qrUid.trim()) return;
    try {
      setBusy(true);
      setAsset((await resolveAssetByQr(qrUid.trim())).asset);
    } catch {
      setError('No asset matches that QR code.');
    } finally { setBusy(false); }
  };

  const submit = async () => {
    setError(null);
    if (!description.trim()) { setError('Add a short description of the fault.'); return; }
    try {
      setBusy(true);
      const r = await reportIssue({ qrUid: asset ? undefined : qrUid.trim() || undefined, assetId: asset?.assetId, description: description.trim(), priority });
      setResult(r);
      onCreated();
    } catch {
      setError('Couldn’t log the issue — it needs a valid asset (scan a QR) and a description.');
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <div className="field-card">
        <button className="btn" onClick={() => { reset(); setOpen(true); }}>📷 Report an issue (scan QR)</button>
      </div>
    );
  }

  return (
    <div className="field-card">
      <div className="fc-title">Report an issue</div>
      {result ? (
        <div role="status" aria-live="polite">
          <div className="banner" style={{ marginTop: 8 }}>Logged <strong>{result.ref}</strong> on {result.asset.name} ({result.asset.location ?? 'location n/a'}).</div>
          <div className="field-actions">
            <button className="btn ghost" onClick={reset}>Report another</button>
            <button className="btn" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      ) : (
        <>
          <label htmlFor="qr-uid" className="fc-meta">Asset QR code</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input id="qr-uid" value={qrUid} onChange={(e) => setQrUid(e.target.value)} placeholder="Scan or type the QR id" style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => void resolve()} disabled={busy || !qrUid.trim()}>Find asset</button>
          </div>
          {asset && <div className="banner" role="status" style={{ marginTop: 8 }}>{asset.code} — {asset.name} · {asset.location ?? 'location n/a'}</div>}

          <label htmlFor="issue-desc" className="fc-meta" style={{ marginTop: 8, display: 'block' }}>What’s wrong?</label>
          <textarea id="issue-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: '100%', marginTop: 4 }} />

          <label htmlFor="issue-prio" className="fc-meta" style={{ marginTop: 8, display: 'block' }}>Priority</label>
          <select id="issue-prio" value={priority} onChange={(e) => setPriority(e.target.value as 'routine' | 'high' | 'critical')} style={{ marginTop: 4 }}>
            <option value="routine">Routine</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {error && <div className="banner err" role="alert" style={{ marginTop: 8 }}>{error}</div>}
          <div className="field-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn" onClick={() => void submit()} disabled={busy}>Log issue</button>
          </div>
        </>
      )}
    </div>
  );
}

export function Field() {
  const { data, isError, refetch } = useQuery({ queryKey: ['field-wo'], queryFn: () => api<{ workOrders: WorkOrder[] }>('/api/v1/work-orders') });
  const [openId, setOpenId] = useState<string | null>(null);
  const [gate, setGate] = useState<GateEvaluation | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const refreshPending = useCallback(async () => setPending((await queue.pending()).length), []);

  const flush = useCallback(async () => {
    await queue.flush(sendQueued);
    await refreshPending();
    void refetch();
  }, [refreshPending, refetch]);

  useEffect(() => {
    void refreshPending();
    const goOnline = () => { setOnline(true); void flush(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [flush, refreshPending]);

  const checkGate = async (id: string) => {
    setOpenId(id);
    setGate(null);
    try {
      setGate((await previewGate(id)).gate);
    } catch {
      setGate(null);
    }
  };

  const start = async (id: string) => {
    try {
      await setWorkOrderStatus(id, 'in_progress');
      void refetch();
    } catch {
      // Offline or failed → queue for replay on reconnect.
      await queue.enqueue('wo_status', { id, status: 'in_progress' });
      await refreshPending();
    }
  };

  const jobs = (data?.workOrders ?? []).filter((w) => w.status !== 'closed');

  return (
    <div className="field">
      <h2>My jobs today</h2>
      {!online && <div className="banner" role="status">Offline — actions are saved and will sync when you reconnect{pending ? ` (${pending} queued)` : ''}.</div>}
      {online && pending > 0 && <div className="banner" role="status">{pending} queued action(s) — <button className="lang-toggle" onClick={() => void flush()}>sync now</button></div>}
      {isError && <div className="banner err">Couldn’t load jobs. They’ll appear when back online.</div>}

      <ReportIssue onCreated={() => void refetch()} />

      {jobs.map((w) => (
        <div className="field-card" key={w.id}>
          <div className="fc-title">{w.title}</div>
          <div className="fc-meta">{w.ref} · {w.location ?? '—'}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge tone={w.priority === 'critical' ? 'crit' : w.priority === 'high' ? 'watch' : 'neutral'}>{w.priority}</StatusBadge>
            <StatusBadge tone="info">{w.status}</StatusBadge>
          </div>
          {openId === w.id && <GateBanner gate={gate} />}
          <div className="field-actions">
            <button className="btn ghost" onClick={() => void checkGate(w.id)}>Check gate</button>
            <button className="btn" onClick={() => void start(w.id)} disabled={!!gate && openId === w.id && gate.blocked}>Start</button>
            <label className="btn ghost" style={{ cursor: 'pointer' }}>
              Photo
              <input type="file" accept="image/*" capture="environment" hidden onChange={() => { void queue.enqueue('photo', { woId: w.id }).then(refreshPending); }} />
            </label>
          </div>
        </div>
      ))}
      {!jobs.length && <div className="muted" style={{ padding: 16 }}>No open jobs. Nice.</div>}
    </div>
  );
}
