import type { PoolClient } from 'pg';
import { slaState } from './sla.js';

/**
 * Evidence packs — one-click, audit-ready bundles assembled from live data
 * (core CAFM/IWMS; CAFM-COVERAGE.md item 1). The hard part is the *assembler*:
 * pulling a work order's full chain — gate checks ("no paperwork, no work" proof),
 * RAMS, permits, linked golden-thread documents, certificates and the append-only
 * audit trail — into one structured bundle, plus a print-ready HTML rendering.
 *
 * PDF/A conversion is a thin-interop renderer step at deployment (headless Chrome /
 * Gotenberg) per architecture-adr.md — the HTML here is the print source and is fully
 * testable without a binary dependency.
 */

export interface EvidencePack {
  kind: 'work_order';
  generatedAt: string;
  workOrder: {
    id: string; ref: string; title: string; source: string; priority: string; status: string;
    openedAt: string; closedAt: string | null; slaDue: string | null; slaOutcome: string;
    space: string | null; asset: string | null; contractor: string | null; conservationNotes: string | null;
  };
  gateChecks: Array<{ gate_code: string; check_id: string; status: string; blocking_detail: string | null; override_reason: string | null; checked_at: string }>;
  rams: Array<{ title: string; version: number; status: string; valid_to: string | null }>;
  permits: Array<{ permit_type: string; status: string; valid_from: string | null; valid_to: string | null }>;
  documents: Array<{ id: string; title: string; doc_type: string; version_no: number | null }>;
  certificates: Array<{ cert_type_code: string; ref: string | null; issuer: string | null; expiry_date: string | null; status: string }>;
  auditTrail: Array<{ action: string; entity: string; at: string }>;
}

/** Assemble the full evidence pack for a work order from live data. */
export async function workOrderEvidencePack(client: PoolClient, workOrderId: string): Promise<EvidencePack> {
  const woRes = await client.query<{
    id: string; ref: string; title: string; source: string; priority: string; status: string;
    opened_at: string; closed_at: string | null; sla_due: string | null; conservation_notes: string | null;
    space: string | null; asset: string | null; contractor: string | null;
  }>(
    `SELECT w.id, w.ref, w.title, w.source, w.priority, w.status, w.opened_at, w.closed_at, w.sla_due, w.conservation_notes,
            s.name AS space, a.name AS asset, c.name AS contractor
       FROM wo_work_order w
       LEFT JOIN est_space s ON s.id = w.space_id
       LEFT JOIN est_asset a ON a.id = w.asset_id
       LEFT JOIN wo_contractor c ON c.id = w.contractor_id
      WHERE w.id = $1`,
    [workOrderId],
  );
  const wo = woRes.rows[0];
  if (!wo) throw new Error('work order not found');

  // Sequential: a single PoolClient cannot run queries concurrently.
  const gates = await client.query(`SELECT gate_code, check_id, status, blocking_detail, override_reason, checked_at FROM wo_gate_check WHERE work_order_id = $1 ORDER BY checked_at`, [workOrderId]);
  const rams = await client.query(`SELECT title, version, status, valid_to FROM hs_rams WHERE work_order_id = $1 ORDER BY version DESC`, [workOrderId]);
  const permits = await client.query(`SELECT permit_type, status, valid_from, valid_to FROM hs_permit WHERE work_order_id = $1`, [workOrderId]);
  const docs = await client.query(
    `SELECT d.id, d.title, d.doc_type, v.version_no
       FROM doc_link l JOIN doc_document d ON d.id = l.document_id
       LEFT JOIN doc_version v ON v.id = d.current_version_id
      WHERE l.entity_type = 'work_order' AND l.entity_id = $1`, [workOrderId]);
  const certs = await client.query(
    `SELECT DISTINCT cert.cert_type_code, cert.ref, cert.issuer, cert.expiry_date, cert.status
       FROM cmp_certificate cert
       JOIN wo_work_order w ON w.id = $1
      WHERE cert.asset_id = w.asset_id`, [workOrderId]);
  const audit = await client.query(`SELECT action, entity, at FROM core_audit_log WHERE entity_id = $1 ORDER BY at`, [workOrderId]);

  return {
    kind: 'work_order',
    generatedAt: new Date().toISOString(),
    workOrder: {
      id: wo.id, ref: wo.ref, title: wo.title, source: wo.source, priority: wo.priority, status: wo.status,
      openedAt: wo.opened_at, closedAt: wo.closed_at, slaDue: wo.sla_due,
      slaOutcome: slaState({ openedAt: wo.opened_at, slaDue: wo.sla_due, closedAt: wo.closed_at }),
      space: wo.space, asset: wo.asset, contractor: wo.contractor, conservationNotes: wo.conservation_notes,
    },
    gateChecks: gates.rows as EvidencePack['gateChecks'],
    rams: rams.rows as EvidencePack['rams'],
    permits: permits.rows as EvidencePack['permits'],
    documents: docs.rows as EvidencePack['documents'],
    certificates: certs.rows as EvidencePack['certificates'],
    auditTrail: audit.rows as EvidencePack['auditTrail'],
  };
}

function esc(v: unknown): string {
  return String(v ?? '—').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}

function rows<T>(items: T[], cols: Array<{ h: string; get: (i: T) => unknown }>): string {
  if (items.length === 0) return '<p class="empty">None recorded.</p>';
  const head = cols.map((c) => `<th scope="col">${esc(c.h)}</th>`).join('');
  const body = items.map((i) => `<tr>${cols.map((c) => `<td>${esc(c.get(i))}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Render a self-contained, accessible, print-ready HTML evidence pack.
 * Status is conveyed by text (never colour alone) per the design system (WCAG 1.4.1).
 */
export function renderEvidenceHtml(pack: EvidencePack): string {
  const w = pack.workOrder;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidence Pack — ${esc(w.ref)}</title>
<style>
  :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #11181c; }
  body { max-width: 880px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.05rem; margin-top: 2rem; border-bottom: 2px solid #11181c; padding-bottom: 0.25rem; }
  .meta { color: #4a5568; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #d0d7de; vertical-align: top; }
  th { background: #f1f3f5; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; font-size: 0.9rem; }
  dt { font-weight: 600; }
  .empty { color: #6b7280; font-style: italic; }
  .badge { font-weight: 600; }
  footer { margin-top: 3rem; font-size: 0.8rem; color: #6b7280; border-top: 1px solid #d0d7de; padding-top: 0.75rem; }
  @media print { body { margin: 0; max-width: none; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head>
<body>
<header>
  <h1>Evidence Pack — ${esc(w.ref)}</h1>
  <p class="meta">${esc(w.title)} · Generated ${esc(pack.generatedAt)} · FMIQ by GovIQ</p>
</header>

<h2>Work order</h2>
<dl>
  <dt>Reference</dt><dd>${esc(w.ref)}</dd>
  <dt>Status</dt><dd class="badge">${esc(w.status)}</dd>
  <dt>Priority</dt><dd>${esc(w.priority)}</dd>
  <dt>Source</dt><dd>${esc(w.source)}</dd>
  <dt>Asset</dt><dd>${esc(w.asset)}</dd>
  <dt>Location</dt><dd>${esc(w.space)}</dd>
  <dt>Contractor</dt><dd>${esc(w.contractor)}</dd>
  <dt>Opened</dt><dd>${esc(w.openedAt)}</dd>
  <dt>Closed</dt><dd>${esc(w.closedAt)}</dd>
  <dt>SLA due</dt><dd>${esc(w.slaDue)}</dd>
  <dt>SLA outcome</dt><dd class="badge">${esc(w.slaOutcome)}</dd>
  <dt>Conservation notes</dt><dd>${esc(w.conservationNotes)}</dd>
</dl>

<h2>Safe-system-of-work gate checks</h2>
<p class="meta">Proof of the "no paperwork, no work" readiness gate at job start.</p>
${rows(pack.gateChecks, [
  { h: 'Check', get: (g) => g.check_id },
  { h: 'Status', get: (g) => g.status },
  { h: 'Detail', get: (g) => g.blocking_detail ?? g.override_reason },
  { h: 'When', get: (g) => g.checked_at },
])}

<h2>Risk assessments / method statements (RAMS)</h2>
${rows(pack.rams, [
  { h: 'Title', get: (r) => r.title },
  { h: 'Version', get: (r) => r.version },
  { h: 'Status', get: (r) => r.status },
  { h: 'Valid to', get: (r) => r.valid_to },
])}

<h2>Permits to work</h2>
${rows(pack.permits, [
  { h: 'Type', get: (p) => p.permit_type },
  { h: 'Status', get: (p) => p.status },
  { h: 'From', get: (p) => p.valid_from },
  { h: 'To', get: (p) => p.valid_to },
])}

<h2>Linked documents (golden thread)</h2>
${rows(pack.documents, [
  { h: 'Title', get: (d) => d.title },
  { h: 'Type', get: (d) => d.doc_type },
  { h: 'Version', get: (d) => d.version_no },
])}

<h2>Asset certificates</h2>
${rows(pack.certificates, [
  { h: 'Type', get: (c) => c.cert_type_code },
  { h: 'Ref', get: (c) => c.ref },
  { h: 'Issuer', get: (c) => c.issuer },
  { h: 'Expiry', get: (c) => c.expiry_date },
  { h: 'Status', get: (c) => c.status },
])}

<h2>Audit trail</h2>
<p class="meta">Append-only record (who/what/when) from core_audit_log.</p>
${rows(pack.auditTrail, [
  { h: 'Action', get: (a) => a.action },
  { h: 'Entity', get: (a) => a.entity },
  { h: 'When', get: (a) => a.at },
])}

<footer>FMIQ evidence pack. Generated from live system data; integrity backed by the append-only audit log.
Convert to PDF/A via the deployment renderer for archival submission.</footer>
</body></html>`;
}
