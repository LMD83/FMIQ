import type { PoolClient } from 'pg';

/**
 * Document / O&M management — the "golden thread" (core CAFM/IWMS).
 *
 * A versioned document register linked polymorphically to estate, compliance and
 * project entities. Each upload is an immutable version; the document points at its
 * current version. Supports the BCAR/CWMF golden thread (surfaced, not scattered) and
 * the loan/audit evidence packs. See CAFM-COVERAGE.md item 2.
 */

export type DocType =
  | 'om_manual' | 'drawing' | 'certificate' | 'warranty' | 'policy'
  | 'rams' | 'datasheet' | 'report' | 'specification' | 'other';

export type LinkEntity =
  | 'asset' | 'building' | 'space' | 'site' | 'certificate' | 'handover' | 'work_order' | 'project';

export interface RegisterInput {
  title: string;
  docType?: DocType;
  discipline?: string | null;
  reference?: string | null;
  goldenThread?: boolean;
  createdBy?: string | null;
  /** First version content. */
  blobUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  notes?: string | null;
}

export interface DocumentRecord {
  id: string;
  title: string;
  docType: DocType;
  status: string;
  versionNo: number;
  currentVersionId: string;
}

/** Register a new document and store its first version (v1) as the current version. */
export async function registerDocument(client: PoolClient, tenantId: string, input: RegisterInput): Promise<DocumentRecord> {
  const doc = await client.query<{ id: string }>(
    `INSERT INTO doc_document (tenant_id, title, doc_type, discipline, reference, golden_thread, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, input.title, input.docType ?? 'other', input.discipline ?? null, input.reference ?? null,
     input.goldenThread ?? false, input.createdBy ?? null],
  );
  const documentId = doc.rows[0].id;
  const ver = await client.query<{ id: string }>(
    `INSERT INTO doc_version (tenant_id, document_id, version_no, blob_uri, file_name, mime_type, size_bytes, checksum, notes, is_current, uploaded_by)
     VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,true,$9) RETURNING id`,
    [tenantId, documentId, input.blobUri, input.fileName ?? null, input.mimeType ?? null,
     input.sizeBytes ?? null, input.checksum ?? null, input.notes ?? null, input.createdBy ?? null],
  );
  const currentVersionId = ver.rows[0].id;
  await client.query(`UPDATE doc_document SET current_version_id = $2 WHERE id = $1`, [documentId, currentVersionId]);
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'doc_document',$2,'document.registered',$3)`,
    [tenantId, documentId, JSON.stringify({ title: input.title, docType: input.docType ?? 'other', versionNo: 1 })],
  );
  return { id: documentId, title: input.title, docType: input.docType ?? 'other', status: 'current', versionNo: 1, currentVersionId };
}

export interface VersionInput {
  blobUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  notes?: string | null;
  uploadedBy?: string | null;
}

/** Add a new version, superseding the prior one (golden-thread history is preserved). */
export async function addVersion(client: PoolClient, tenantId: string, documentId: string, input: VersionInput): Promise<{ versionId: string; versionNo: number }> {
  const exists = await client.query<{ id: string }>(`SELECT id FROM doc_document WHERE id = $1`, [documentId]);
  if (!exists.rows[0]) throw new Error('document not found');

  const next = await client.query<{ n: number }>(
    `SELECT COALESCE(MAX(version_no), 0) + 1 AS n FROM doc_version WHERE document_id = $1`, [documentId],
  );
  const versionNo = next.rows[0].n;

  await client.query(`UPDATE doc_version SET is_current = false WHERE document_id = $1 AND is_current = true`, [documentId]);
  const ver = await client.query<{ id: string }>(
    `INSERT INTO doc_version (tenant_id, document_id, version_no, blob_uri, file_name, mime_type, size_bytes, checksum, notes, is_current, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10) RETURNING id`,
    [tenantId, documentId, versionNo, input.blobUri, input.fileName ?? null, input.mimeType ?? null,
     input.sizeBytes ?? null, input.checksum ?? null, input.notes ?? null, input.uploadedBy ?? null],
  );
  const versionId = ver.rows[0].id;
  await client.query(
    `UPDATE doc_document SET current_version_id = $2, status = 'current', updated_at = now() WHERE id = $1`,
    [documentId, versionId],
  );
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'doc_document',$2,'document.versioned',$3)`,
    [tenantId, documentId, JSON.stringify({ versionNo })],
  );
  return { versionId, versionNo };
}

/** Link a document to an estate/compliance/project entity (idempotent on the unique key). */
export async function linkDocument(client: PoolClient, tenantId: string, documentId: string, entityType: LinkEntity, entityId: string): Promise<void> {
  await client.query(
    `INSERT INTO doc_link (tenant_id, document_id, entity_type, entity_id)
     VALUES ($1,$2,$3,$4) ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING`,
    [tenantId, documentId, entityType, entityId],
  );
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'doc_link',$2,'document.linked',$3)`,
    [tenantId, documentId, JSON.stringify({ entityType, entityId })],
  );
}

export interface DocumentListItem {
  id: string;
  title: string;
  doc_type: string;
  discipline: string | null;
  reference: string | null;
  status: string;
  golden_thread: boolean;
  version_no: number | null;
  updated_at: string;
}

/** List documents, optionally filtered by type or golden-thread flag. */
export async function listDocuments(
  client: PoolClient,
  filters: { docType?: DocType; goldenThread?: boolean } = {},
): Promise<DocumentListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.docType) { params.push(filters.docType); where.push(`d.doc_type = $${params.length}`); }
  if (filters.goldenThread !== undefined) { params.push(filters.goldenThread); where.push(`d.golden_thread = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await client.query<DocumentListItem>(
    `SELECT d.id, d.title, d.doc_type, d.discipline, d.reference, d.status, d.golden_thread, v.version_no, d.updated_at
       FROM doc_document d
       LEFT JOIN doc_version v ON v.id = d.current_version_id
       ${clause}
       ORDER BY d.updated_at DESC LIMIT 500`,
    params,
  );
  return rows;
}

/** Full version history for a document (newest first). */
export async function documentVersions(client: PoolClient, documentId: string): Promise<Array<{ id: string; version_no: number; blob_uri: string; file_name: string | null; is_current: boolean; uploaded_at: string }>> {
  const { rows } = await client.query(
    `SELECT id, version_no, blob_uri, file_name, is_current, uploaded_at
       FROM doc_version WHERE document_id = $1 ORDER BY version_no DESC`,
    [documentId],
  );
  return rows as Array<{ id: string; version_no: number; blob_uri: string; file_name: string | null; is_current: boolean; uploaded_at: string }>;
}

/**
 * The golden thread for an entity: all current documents linked to it, with their
 * current version. This is what surfaces O&M manuals, certs, warranties and drawings
 * against an asset/building so an FM never hunts a shared drive.
 */
export async function goldenThread(client: PoolClient, entityType: LinkEntity, entityId: string): Promise<DocumentListItem[]> {
  const { rows } = await client.query<DocumentListItem>(
    `SELECT d.id, d.title, d.doc_type, d.discipline, d.reference, d.status, d.golden_thread, v.version_no, d.updated_at
       FROM doc_link l
       JOIN doc_document d ON d.id = l.document_id
       LEFT JOIN doc_version v ON v.id = d.current_version_id
       WHERE l.entity_type = $1 AND l.entity_id = $2 AND d.status <> 'archived'
       ORDER BY d.doc_type, d.updated_at DESC`,
    [entityType, entityId],
  );
  return rows;
}
