import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  DedupeRow, DryRunDecisionInput, DryRunRowInput, ExistingAssetKey, ValueMapEntry,
  PLACEHOLDER_FLOOR, computeDryRun, extractHierarchy, findDuplicates, matchEntity,
  normaliseAndValidate, normaliseHeader, getTargetField, sourceFingerprint, suggestMappings,
  willCommitRow,
} from './importEngine.js';
import type { ParsedUpload } from './importParse.js';

/**
 * Import session orchestration (create-only Sprint-1 path). Pure logic lives in
 * importEngine.ts; this module persists state and is always called inside
 * withTenant(), so RLS scopes every query and a thrown error rolls the whole
 * operation back (transactional commit, AC6).
 */

export class ImportError extends Error {
  constructor(
    public code:
      | 'not_found' | 'bad_state' | 'too_many_rows' | 'unknown_target_field'
      | 'errors_block_commit' | 'unconfirmed_entities' | 'unresolved_duplicates'
      | 'undo_expired' | 'invalid_decision',
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

const UNDO_WINDOW = "interval '7 days'";

async function audit(
  client: PoolClient, tenantId: string, entity: string, entityId: string | null,
  action: string, userId: string | null, before: unknown, after: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, before, after)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [tenantId, userId, entity, entityId, action,
      before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)],
  );
}

interface SessionRow {
  id: string; status: string; target_mode: string; profile: string; current_stage: number;
  source_fingerprint: string | null; stats: Record<string, unknown> | null;
  created_at: string; committed_at: string | null; undone_at: string | null;
  undo_expires_at: string | null; created_by: string | null;
}

async function loadSession(client: PoolClient, sessionId: string): Promise<SessionRow> {
  const { rows } = await client.query<SessionRow>(`SELECT * FROM imp_session WHERE id = $1`, [sessionId]);
  if (!rows[0]) throw new ImportError('not_found', 'Import session not found.');
  return rows[0];
}

async function mergeStats(client: PoolClient, sessionId: string, patch: Record<string, unknown>): Promise<void> {
  await client.query(
    `UPDATE imp_session SET stats = COALESCE(stats, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
    [sessionId, JSON.stringify(patch)],
  );
}

// ---------------------------------------------------------------------------
// Session creation (Stage 0–2: upload → parse → auto-map)
// ---------------------------------------------------------------------------

export async function createImportSession(
  client: PoolClient,
  tenantId: string,
  args: { filename: string; sizeBytes: number; parsed: ParsedUpload; targetMode: 'create_only' },
  actorUserId: string,
): Promise<{ sessionId: string; sheet: { name: string; headerRow: number; rowCount: number }; mappings: unknown[] }> {
  const { parsed } = args;
  // Sprint-1 narrow path: first data sheet only; others stored as 'skipped'.
  const dataSheet = parsed.sheets[0];
  const fp = createHash('sha256').update(sourceFingerprint(dataSheet.headers)).digest('hex');

  const { rows: [session] } = await client.query<{ id: string }>(
    `INSERT INTO imp_session (tenant_id, created_by, status, target_mode, current_stage, source_fingerprint, stats)
     VALUES ($1,$2,'mapping',$3,2,$4,$5) RETURNING id`,
    [tenantId, actorUserId, args.targetMode, fp,
      JSON.stringify({ rows: dataSheet.records.length, droppedBlankRows: dataSheet.droppedBlankRows, sheets: parsed.sheets.length })],
  );
  const { rows: [file] } = await client.query<{ id: string }>(
    `INSERT INTO imp_file (tenant_id, session_id, filename, size_bytes, kind)
     VALUES ($1,$2,$3,$4,'original') RETURNING id`,
    [tenantId, session.id, args.filename, args.sizeBytes],
  );

  let dataSheetId = '';
  for (let i = 0; i < parsed.sheets.length; i++) {
    const s = parsed.sheets[i];
    const { rows: [sheet] } = await client.query<{ id: string }>(
      `INSERT INTO imp_sheet (tenant_id, session_id, file_id, name, classification, header_row, row_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [tenantId, session.id, file.id, s.name, i === 0 ? 'data' : 'skipped', s.headerRow, s.records.length],
    );
    if (i === 0) dataSheetId = sheet.id;
  }

  // Staged rows, chunked multi-row inserts.
  const CHUNK = 500;
  for (let off = 0; off < dataSheet.records.length; off += CHUNK) {
    const chunk = dataSheet.records.slice(off, off + CHUNK);
    const params: unknown[] = [tenantId, session.id, dataSheetId];
    const tuples = chunk.map((rec, i) => {
      params.push(off + i + 1, JSON.stringify(rec));
      return `($1,$2,$3,$${params.length - 1},$${params.length})`;
    });
    await client.query(
      `INSERT INTO imp_row (tenant_id, session_id, sheet_id, source_row_no, raw) VALUES ${tuples.join(',')}`,
      params,
    );
  }

  // Mapping memory: prefer this fingerprint, fall back to any prior file (most recent).
  const { rows: memRows } = await client.query<{ source_column: string; target_field: string }>(
    `SELECT DISTINCT ON (source_column) source_column, target_field
       FROM imp_mapping_memory
      ORDER BY source_column, (source_fingerprint = $1) DESC, last_used_at DESC`,
    [fp],
  );
  const memory: Record<string, string> = {};
  for (const m of memRows) memory[normaliseHeader(m.source_column)] = m.target_field;

  const suggestions = suggestMappings(dataSheet.headers, memory);
  for (const s of suggestions) {
    await client.query(
      `INSERT INTO imp_mapping (tenant_id, session_id, sheet_id, source_column, target_field, confidence, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, session.id, dataSheetId, s.sourceColumn, s.targetField, s.confidence, s.provenance],
    );
  }

  await audit(client, tenantId, 'imp_session', session.id, 'import.session_created', actorUserId, null,
    { filename: args.filename, rows: dataSheet.records.length, targetMode: args.targetMode });

  return {
    sessionId: session.id,
    sheet: { name: dataSheet.name, headerRow: dataSheet.headerRow, rowCount: dataSheet.records.length },
    mappings: suggestions,
  };
}

// ---------------------------------------------------------------------------
// Session reads
// ---------------------------------------------------------------------------

export async function listSessions(client: PoolClient): Promise<unknown[]> {
  const { rows } = await client.query(
    `SELECT s.id, s.status, s.target_mode, s.profile, s.current_stage, s.stats,
            s.created_at, s.committed_at, s.undone_at, s.undo_expires_at,
            u.display_name AS created_by_name, f.filename, f.size_bytes
       FROM imp_session s
       LEFT JOIN core_user u ON u.id = s.created_by
       LEFT JOIN imp_file f ON f.session_id = s.id AND f.kind = 'original'
      ORDER BY s.created_at DESC
      LIMIT 200`);
  return rows;
}

export async function getSession(client: PoolClient, sessionId: string): Promise<unknown> {
  const session = await loadSession(client, sessionId);
  const { rows: files } = await client.query(
    `SELECT id, filename, size_bytes, kind, uploaded_at FROM imp_file WHERE session_id = $1`, [sessionId]);
  const { rows: sheets } = await client.query(
    `SELECT id, name, classification, header_row, row_count FROM imp_sheet WHERE session_id = $1`, [sessionId]);
  const { rows: counts } = await client.query(
    `SELECT state, count(*)::int AS n FROM imp_row WHERE session_id = $1 GROUP BY state`, [sessionId]);
  return { ...session, files, sheets, rowCounts: Object.fromEntries(counts.map((c: { state: string; n: number }) => [c.state, c.n])) };
}

// ---------------------------------------------------------------------------
// Mappings + value maps (Stages 2–3)
// ---------------------------------------------------------------------------

export async function getMappings(client: PoolClient, sessionId: string): Promise<unknown[]> {
  await loadSession(client, sessionId);
  const { rows } = await client.query(
    `SELECT id, source_column, target_field, confidence, provenance, accepted_by
       FROM imp_mapping WHERE session_id = $1 ORDER BY source_column`, [sessionId]);
  return rows;
}

export async function setMappings(
  client: PoolClient, tenantId: string, sessionId: string,
  mappings: Array<{ sourceColumn: string; targetField: string | null }>, actorUserId: string,
): Promise<unknown[]> {
  await loadSession(client, sessionId);
  for (const m of mappings) {
    if (m.targetField !== null && !getTargetField(m.targetField)) {
      throw new ImportError('unknown_target_field', `Unknown target field: ${m.targetField}`);
    }
    await client.query(
      `UPDATE imp_mapping SET target_field = $3, provenance = 'manual', confidence = 1, accepted_by = $4
        WHERE session_id = $1 AND source_column = $2`,
      [sessionId, m.sourceColumn, m.targetField, actorUserId],
    );
  }
  // Mapping changes invalidate prior validation: reset rows and regress the
  // session so downstream stages must re-run (F1 fix, VERIFICATION_REPORT.md).
  await client.query(
    `UPDATE imp_row SET state = 'pending', normalised = NULL, issues = NULL
      WHERE session_id = $1 AND state <> 'excluded'`,
    [sessionId],
  );
  await client.query(
    `UPDATE imp_session SET status = 'mapping', current_stage = 2 WHERE id = $1`,
    [sessionId],
  );
  await audit(client, tenantId, 'imp_session', sessionId, 'import.mappings_updated', actorUserId, null, { mappings });
  return getMappings(client, sessionId);
}

export async function getValueMaps(client: PoolClient, sessionId: string): Promise<unknown[]> {
  await loadSession(client, sessionId);
  const { rows } = await client.query(
    `SELECT id, target_field, source_value, mapped_value, provenance
       FROM imp_value_map WHERE session_id = $1 ORDER BY target_field, source_value`, [sessionId]);
  return rows;
}

export async function setValueMaps(
  client: PoolClient, tenantId: string, sessionId: string,
  maps: Array<{ targetField: string; sourceValue: string; mappedValue: string | null }>, actorUserId: string,
): Promise<unknown[]> {
  await loadSession(client, sessionId);
  for (const m of maps) {
    const def = getTargetField(m.targetField);
    if (!def || def.kind !== 'enum') {
      throw new ImportError('unknown_target_field', `Value maps only apply to enum fields; got: ${m.targetField}`);
    }
    if (m.mappedValue !== null && !def.enumValues!.includes(m.mappedValue)) {
      throw new ImportError('invalid_decision', `"${m.mappedValue}" is not a valid ${m.targetField} value.`);
    }
    await client.query(
      `INSERT INTO imp_value_map (tenant_id, session_id, target_field, source_value, mapped_value, provenance, accepted_by)
       VALUES ($1,$2,$3,$4,$5,'manual',$6)
       ON CONFLICT (session_id, target_field, source_value)
       DO UPDATE SET mapped_value = EXCLUDED.mapped_value, accepted_by = EXCLUDED.accepted_by`,
      [tenantId, sessionId, m.targetField, m.sourceValue, m.mappedValue, actorUserId],
    );
  }
  // Value-map changes invalidate prior validation: reset rows and regress the
  // session so downstream stages must re-run (F1 fix, VERIFICATION_REPORT.md).
  await client.query(
    `UPDATE imp_row SET state = 'pending', normalised = NULL, issues = NULL
      WHERE session_id = $1 AND state <> 'excluded'`,
    [sessionId],
  );
  await client.query(
    `UPDATE imp_session SET status = 'mapping', current_stage = 2 WHERE id = $1`,
    [sessionId],
  );
  await audit(client, tenantId, 'imp_session', sessionId, 'import.value_maps_updated', actorUserId, null, { maps });
  return getValueMaps(client, sessionId);
}

// ---------------------------------------------------------------------------
// Validation (Stage 4) — errors block, warnings pass
// ---------------------------------------------------------------------------

async function loadAcceptedMappings(client: PoolClient, sessionId: string): Promise<Array<{ source_column: string; target_field: string }>> {
  const { rows } = await client.query<{ source_column: string; target_field: string }>(
    `SELECT source_column, target_field FROM imp_mapping WHERE session_id = $1 AND target_field IS NOT NULL`,
    [sessionId]);
  return rows;
}

async function loadValueMapEntries(client: PoolClient, sessionId: string): Promise<ValueMapEntry[]> {
  const { rows } = await client.query<{ target_field: string; source_value: string; mapped_value: string | null }>(
    `SELECT target_field, source_value, mapped_value FROM imp_value_map WHERE session_id = $1`, [sessionId]);
  return rows.map((r) => ({ targetField: r.target_field, sourceValue: r.source_value, mappedValue: r.mapped_value }));
}

export async function runValidation(
  client: PoolClient, tenantId: string, sessionId: string, today: string, actorUserId: string,
): Promise<{ valid: number; warning: number; error: number; excluded: number }> {
  await loadSession(client, sessionId);
  const mappings = await loadAcceptedMappings(client, sessionId);
  const valueMaps = await loadValueMapEntries(client, sessionId);

  const { rows } = await client.query<{ id: string; raw: Record<string, string | number | null> }>(
    `SELECT id, raw FROM imp_row WHERE session_id = $1 AND state <> 'excluded' ORDER BY source_row_no`, [sessionId]);

  const counts = { valid: 0, warning: 0, error: 0, excluded: 0 };
  const CHUNK = 500;
  for (let off = 0; off < rows.length; off += CHUNK) {
    const chunk = rows.slice(off, off + CHUNK);
    const ids: string[] = []; const norms: string[] = []; const states: string[] = []; const issues: string[] = [];
    for (const r of chunk) {
      const rec: Record<string, string | number | null> = {};
      for (const m of mappings) rec[m.target_field] = r.raw[m.source_column] ?? null;
      const result = normaliseAndValidate(rec, valueMaps, { today });
      counts[result.state]++;
      ids.push(r.id); norms.push(JSON.stringify(result.values));
      states.push(result.state); issues.push(JSON.stringify(result.issues));
    }
    await client.query(
      `UPDATE imp_row r SET normalised = u.normalised::jsonb, state = u.state, issues = u.issues::jsonb
         FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[]) AS u(id, normalised, state, issues)
        WHERE r.id = u.id`,
      [ids, norms, states, issues],
    );
  }
  const { rows: [{ n: excluded }] } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM imp_row WHERE session_id = $1 AND state = 'excluded'`, [sessionId]);
  counts.excluded = excluded;

  await client.query(`UPDATE imp_session SET status = 'validating', current_stage = 4 WHERE id = $1`, [sessionId]);
  await mergeStats(client, sessionId, { validation: counts });
  await audit(client, tenantId, 'imp_session', sessionId, 'import.validated', actorUserId, null, counts);
  return counts;
}

export async function listRows(
  client: PoolClient, sessionId: string,
  filter: { state?: string; limit?: number; offset?: number },
): Promise<unknown[]> {
  await loadSession(client, sessionId);
  const { rows } = await client.query(
    `SELECT id, source_row_no, raw, normalised, state, issues, dedupe_group_id, resolution
       FROM imp_row
      WHERE session_id = $1 AND ($2::text IS NULL OR state = $2)
      ORDER BY source_row_no
      LIMIT $3 OFFSET $4`,
    [sessionId, filter.state ?? null, Math.min(filter.limit ?? 200, 1000), filter.offset ?? 0]);
  return rows;
}

export async function patchRows(
  client: PoolClient, tenantId: string, sessionId: string,
  edits: Array<{ rowId: string; raw?: Record<string, string | number | null>; exclude?: boolean }>,
  today: string, actorUserId: string,
): Promise<{ updated: number }> {
  await loadSession(client, sessionId);
  const mappings = await loadAcceptedMappings(client, sessionId);
  const valueMaps = await loadValueMapEntries(client, sessionId);
  let updated = 0;

  for (const e of edits) {
    const { rows: [row] } = await client.query<{ id: string; raw: Record<string, string | number | null> }>(
      `SELECT id, raw FROM imp_row WHERE session_id = $1 AND id = $2`, [sessionId, e.rowId]);
    if (!row) throw new ImportError('not_found', `Row ${e.rowId} not found in this session.`);

    if (e.exclude === true) {
      await client.query(`UPDATE imp_row SET state = 'excluded' WHERE id = $1`, [row.id]);
      updated++; continue;
    }
    const raw = { ...row.raw, ...(e.raw ?? {}) };
    const rec: Record<string, string | number | null> = {};
    for (const m of mappings) rec[m.target_field] = raw[m.source_column] ?? null;
    const result = normaliseAndValidate(rec, valueMaps, { today });
    await client.query(
      `UPDATE imp_row SET raw = $2::jsonb, normalised = $3::jsonb, state = $4, issues = $5::jsonb WHERE id = $1`,
      [row.id, JSON.stringify(raw), JSON.stringify(result.values), result.state, JSON.stringify(result.issues)]);
    updated++;
  }
  await audit(client, tenantId, 'imp_session', sessionId, 'import.rows_patched', actorUserId, null, { count: updated });
  return { updated };
}

// ---------------------------------------------------------------------------
// Hierarchy resolution (Stage 5) — explicit link-vs-create, no silent creation
// ---------------------------------------------------------------------------

export async function resolveHierarchy(
  client: PoolClient, tenantId: string, sessionId: string, actorUserId: string,
): Promise<unknown[]> {
  await loadSession(client, sessionId);
  const { rows } = await client.query<{ normalised: Record<string, unknown> }>(
    `SELECT normalised FROM imp_row WHERE session_id = $1 AND state IN ('valid','warning') AND normalised IS NOT NULL`,
    [sessionId]);
  const entities = extractHierarchy(rows.map((r) => r.normalised));

  const { rows: sites } = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM est_site WHERE deleted_at IS NULL`);
  const { rows: buildings } = await client.query<{ id: string; name: string; site_id: string }>(
    `SELECT id, name, site_id FROM est_building WHERE deleted_at IS NULL`);
  const { rows: floors } = await client.query<{ id: string; name: string; building_id: string }>(
    `SELECT id, name, building_id FROM est_floor WHERE deleted_at IS NULL`);
  const { rows: spaces } = await client.query<{ id: string; name: string; floor_id: string }>(
    `SELECT id, name, floor_id FROM est_space WHERE deleted_at IS NULL`);

  const matchByKey = new Map<string, { action: 'link' | 'create'; linkedId: string | null; confidence: number }>();
  for (const e of entities) {
    let candidates: Array<{ id: string; name: string }> = [];
    if (e.entity === 'site') candidates = sites;
    else {
      const parent = e.parentKey ? matchByKey.get(`${parentEntityOf(e.entity)} ${e.parentKey.toLowerCase()}`) : null;
      if (parent?.action === 'link' && parent.linkedId) {
        if (e.entity === 'building') candidates = buildings.filter((b) => b.site_id === parent.linkedId);
        if (e.entity === 'floor') candidates = floors.filter((f) => f.building_id === parent.linkedId);
        if (e.entity === 'space') candidates = spaces.filter((s) => s.floor_id === parent.linkedId);
      }
    }
    const match = matchEntity(e.name, candidates);
    matchByKey.set(`${e.entity} ${e.inboundKey.toLowerCase()}`, match);
    // Upsert suggestion; never clobber a user-confirmed decision.
    await client.query(
      `INSERT INTO imp_entity_decision (tenant_id, session_id, entity, inbound_key, action, linked_id, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (session_id, entity, inbound_key) DO UPDATE
         SET action = EXCLUDED.action, linked_id = EXCLUDED.linked_id, confidence = EXCLUDED.confidence
       WHERE imp_entity_decision.confirmed_by IS NULL`,
      [tenantId, sessionId, e.entity, e.inboundKey, match.action, match.linkedId, match.confidence]);
  }

  await client.query(`UPDATE imp_session SET status = 'hierarchy', current_stage = 5 WHERE id = $1`, [sessionId]);
  await audit(client, tenantId, 'imp_session', sessionId, 'import.hierarchy_resolved', actorUserId, null,
    { entities: entities.length });
  return getEntityDecisions(client, sessionId);
}

function parentEntityOf(entity: string): string {
  return entity === 'building' ? 'site' : entity === 'floor' ? 'building' : 'floor';
}

export async function getEntityDecisions(client: PoolClient, sessionId: string): Promise<unknown[]> {
  const { rows } = await client.query(
    `SELECT id, entity, inbound_key, action, linked_id, confidence, confirmed_by
       FROM imp_entity_decision WHERE session_id = $1
      ORDER BY CASE entity WHEN 'site' THEN 0 WHEN 'building' THEN 1 WHEN 'floor' THEN 2 ELSE 3 END, inbound_key`,
    [sessionId]);
  return rows;
}

export async function setEntityDecisions(
  client: PoolClient, tenantId: string, sessionId: string,
  decisions: Array<{ entity: string; inboundKey: string; action: 'link' | 'create'; linkedId?: string | null }>,
  actorUserId: string,
): Promise<unknown[]> {
  await loadSession(client, sessionId);
  for (const d of decisions) {
    if (d.action === 'link' && !d.linkedId) {
      throw new ImportError('invalid_decision', `Decision for ${d.entity} "${d.inboundKey}" links to nothing.`);
    }
    const { rowCount } = await client.query(
      `UPDATE imp_entity_decision SET action = $4, linked_id = $5, confirmed_by = $6
        WHERE session_id = $1 AND entity = $2 AND inbound_key = $3`,
      [sessionId, d.entity, d.inboundKey, d.action, d.action === 'link' ? d.linkedId : null, actorUserId]);
    if (!rowCount) throw new ImportError('not_found', `No decision row for ${d.entity} "${d.inboundKey}".`);
  }
  await audit(client, tenantId, 'imp_session', sessionId, 'import.entity_decisions_updated', actorUserId, null, { decisions });
  return getEntityDecisions(client, sessionId);
}

// ---------------------------------------------------------------------------
// Dedupe (Stage 6) — exact keys, surfaced explicitly (never first-row-wins)
// ---------------------------------------------------------------------------

export async function runDedupe(
  client: PoolClient, tenantId: string, sessionId: string, actorUserId: string,
): Promise<unknown[]> {
  await loadSession(client, sessionId);
  const { rows } = await client.query<{ id: string; source_row_no: number; normalised: Record<string, unknown> }>(
    `SELECT id, source_row_no, normalised FROM imp_row
      WHERE session_id = $1 AND state IN ('valid','warning') AND normalised IS NOT NULL
      ORDER BY source_row_no`, [sessionId]);

  const dedupeRows: DedupeRow[] = rows.map((r) => ({
    rowId: r.id,
    assetTag: r.normalised['asset_tag'] as string | null,
    serialNo: r.normalised['serial_no'] as string | null,
    model: r.normalised['model'] as string | null,
  }));
  const { rows: existing } = await client.query<{ id: string; asset_tag: string | null; serial_no: string | null; model: string | null }>(
    `SELECT id, asset_tag, serial_no, model FROM est_asset
      WHERE deleted_at IS NULL AND (asset_tag IS NOT NULL OR serial_no IS NOT NULL)`);
  const existingKeys: ExistingAssetKey[] = existing.map((e) => ({
    assetId: e.id, assetTag: e.asset_tag, serialNo: e.serial_no, model: e.model,
  }));

  await client.query(
    `UPDATE imp_row SET dedupe_group_id = NULL,
            resolution = CASE WHEN resolution->>'reason' = 'auto' THEN NULL ELSE resolution END
      WHERE session_id = $1`, [sessionId]);

  const groups = findDuplicates(dedupeRows, existingKeys);
  for (const g of groups) {
    const groupId = randomUUID();
    for (let i = 0; i < g.rowIds.length; i++) {
      // Defaults are explicit + overridable: rows matching the register default to
      // 'skip'; within-file repeats keep the first occurrence, later rows default 'skip'.
      const defaultAction = g.existingAssetIds.length > 0 ? 'skip' : i === 0 ? 'create' : 'skip';
      await client.query(
        `UPDATE imp_row SET dedupe_group_id = $2,
                resolution = COALESCE(resolution, $3::jsonb)
          WHERE id = $1`,
        [g.rowIds[i], groupId, JSON.stringify({ action: defaultAction, reason: 'auto' })]);
    }
  }
  await client.query(`UPDATE imp_session SET status = 'dedupe', current_stage = 6 WHERE id = $1`, [sessionId]);
  await mergeStats(client, sessionId, { dedupe: { groups: groups.length } });
  await audit(client, tenantId, 'imp_session', sessionId, 'import.dedupe_run', actorUserId, null, { groups: groups.length });
  return groups;
}

/** Read-only view of the duplicate groups staged by runDedupe. */
export async function listDuplicates(client: PoolClient, sessionId: string): Promise<unknown[]> {
  await loadSession(client, sessionId);
  const { rows } = await client.query(
    `SELECT dedupe_group_id,
            json_agg(json_build_object(
              'rowId', id, 'sourceRowNo', source_row_no, 'state', state,
              'resolution', resolution, 'normalised', normalised) ORDER BY source_row_no) AS rows
       FROM imp_row
      WHERE session_id = $1 AND dedupe_group_id IS NOT NULL
      GROUP BY dedupe_group_id`, [sessionId]);
  return rows;
}

export async function setDuplicateResolutions(
  client: PoolClient, tenantId: string, sessionId: string,
  resolutions: Array<{ rowId: string; action: 'create' | 'skip' }>, actorUserId: string,
): Promise<{ updated: number }> {
  await loadSession(client, sessionId);
  let updated = 0;
  for (const r of resolutions) {
    const { rowCount } = await client.query(
      `UPDATE imp_row SET resolution = $3::jsonb WHERE session_id = $1 AND id = $2 AND dedupe_group_id IS NOT NULL`,
      [sessionId, r.rowId, JSON.stringify({ action: r.action, reason: 'user', by: actorUserId })]);
    if (!rowCount) throw new ImportError('not_found', `Row ${r.rowId} is not part of a duplicate group.`);
    updated++;
  }
  await audit(client, tenantId, 'imp_session', sessionId, 'import.dedupe_resolved', actorUserId, null, { resolutions });
  return { updated };
}

// ---------------------------------------------------------------------------
// Dry-run (Stage 7a) + commit (Stage 7b) + undo
// ---------------------------------------------------------------------------

async function dryRunInputs(client: PoolClient, sessionId: string): Promise<{
  rows: Array<DryRunRowInput & { id: string; source_row_no: number; normalised: Record<string, unknown> | null }>;
  decisions: Array<DryRunDecisionInput & { linked_id: string | null; confirmed_by: string | null }>;
}> {
  const { rows } = await client.query(
    `SELECT id, source_row_no, normalised, state, resolution FROM imp_row WHERE session_id = $1 ORDER BY source_row_no`,
    [sessionId]);
  const { rows: decisions } = await client.query(
    `SELECT entity, inbound_key, action, linked_id, confirmed_by FROM imp_entity_decision WHERE session_id = $1`,
    [sessionId]);
  return {
    rows: rows.map((r: { id: string; source_row_no: number; normalised: Record<string, unknown> | null; state: DryRunRowInput['state']; resolution: { action?: string } | null }) => ({
      id: r.id, source_row_no: r.source_row_no, normalised: r.normalised, state: r.state, resolution: r.resolution,
    })),
    decisions: decisions.map((d: { entity: string; inbound_key: string; action: 'link' | 'create'; linked_id: string | null; confirmed_by: string | null }) => ({
      entity: d.entity, inboundKey: d.inbound_key, action: d.action, linked_id: d.linked_id, confirmed_by: d.confirmed_by,
    })),
  };
}

export async function runDryRun(
  client: PoolClient, tenantId: string, sessionId: string, actorUserId: string,
): Promise<unknown> {
  await loadSession(client, sessionId);
  const { rows, decisions } = await dryRunInputs(client, sessionId);
  const result = computeDryRun(rows, decisions);
  await client.query(`UPDATE imp_session SET status = 'dry_run', current_stage = 7 WHERE id = $1`, [sessionId]);
  await mergeStats(client, sessionId, { dryRun: result });
  await audit(client, tenantId, 'imp_session', sessionId, 'import.dry_run', actorUserId, null, result);
  return result;
}

export async function commitSession(
  client: PoolClient, tenantId: string, sessionId: string, actorUserId: string,
): Promise<{ created: number; skipped: number; newEntities: number }> {
  const session = await loadSession(client, sessionId);
  if (session.status !== 'dry_run') {
    throw new ImportError('bad_state', `Session is '${session.status}' — run a dry-run immediately before commit.`);
  }
  const { rows, decisions } = await dryRunInputs(client, sessionId);

  // Gates: errors block (unless excluded); every entity decision must be confirmed;
  // every duplicate group must be resolved (resolution is defaulted by runDedupe).
  const blocked = rows.filter((r) => r.state === 'error').length;
  if (blocked > 0) throw new ImportError('errors_block_commit', `${blocked} rows still have blocking errors. Fix or exclude them.`);
  const unconfirmed = decisions.filter((d) => d.confirmed_by === null);
  if (unconfirmed.length > 0) {
    throw new ImportError('unconfirmed_entities',
      `${unconfirmed.length} location decisions are unconfirmed (e.g. ${unconfirmed[0].entity} "${unconfirmed[0].inboundKey}").`);
  }
  const { rows: [{ n: unresolved }] } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM imp_row
      WHERE session_id = $1 AND dedupe_group_id IS NOT NULL AND resolution IS NULL`, [sessionId]);
  if (unresolved > 0) throw new ImportError('unresolved_duplicates', `${unresolved} duplicate rows are unresolved.`);

  await client.query(`UPDATE imp_session SET status = 'committing' WHERE id = $1`, [sessionId]);

  // 1. Create confirmed-new location entities in dependency order; remember ids by key.
  const idByKey = new Map<string, string>();
  for (const d of decisions) {
    if (d.action === 'link' && d.linked_id) idByKey.set(`${d.entity} ${d.inboundKey.toLowerCase()}`, d.linked_id);
  }
  const order = ['site', 'building', 'floor', 'space'];
  let newEntities = 0;
  for (const tier of order) {
    for (const d of decisions) {
      if (d.entity !== tier || d.action !== 'create') continue;
      const parts = d.inboundKey.split('|');
      const name = parts[parts.length - 1];
      const parentKey = parts.slice(0, -1).join('|').toLowerCase();
      let id: string;
      if (tier === 'site') {
        ({ rows: [{ id }] } = await client.query<{ id: string }>(
          `INSERT INTO est_site (tenant_id, name) VALUES ($1,$2) RETURNING id`, [tenantId, name]));
      } else if (tier === 'building') {
        ({ rows: [{ id }] } = await client.query<{ id: string }>(
          `INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,$3) RETURNING id`,
          [tenantId, requireKey(idByKey, `site ${parentKey}`, d.inboundKey), name]));
      } else if (tier === 'floor') {
        ({ rows: [{ id }] } = await client.query<{ id: string }>(
          `INSERT INTO est_floor (tenant_id, building_id, name, level_index) VALUES ($1,$2,$3,0) RETURNING id`,
          [tenantId, requireKey(idByKey, `building ${parentKey}`, d.inboundKey), name]));
      } else {
        // space_type is NOT NULL CHECK-constrained; survey files rarely carry it — default 'office'.
        ({ rows: [{ id }] } = await client.query<{ id: string }>(
          `INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,$3,'office') RETURNING id`,
          [tenantId, requireKey(idByKey, `floor ${parentKey}`, d.inboundKey), name]));
      }
      idByKey.set(`${tier} ${d.inboundKey.toLowerCase()}`, id);
      newEntities++;
      await client.query(
        `INSERT INTO imp_change (tenant_id, session_id, entity, entity_id, action, before, after)
         VALUES ($1,$2,$3,$4,'insert',NULL,$5)`,
        [tenantId, sessionId, `est_${tier}`, id, JSON.stringify({ name, inboundKey: d.inboundKey })]);
      await audit(client, tenantId, `est_${tier}`, id, `${tier}.import_created`, actorUserId, null,
        { name, importSessionId: sessionId });
    }
  }

  // 2. Insert assets (create-only). Same willCommitRow gate as the dry-run (AC3).
  let created = 0; let skipped = 0;
  for (const r of rows) {
    if (r.state === 'excluded' || r.state === 'error') continue;
    if (!willCommitRow(r)) { skipped++; continue; }
    const v = r.normalised ?? {};
    const loc = locationKeys(v);
    const spaceId = loc.spaceKey ? idByKey.get(`space ${loc.spaceKey.toLowerCase()}`) ?? null : null;
    const buildingId = loc.buildingKey ? idByKey.get(`building ${loc.buildingKey.toLowerCase()}`) ?? null : null;
    const code = str(v['code']) ?? `IMP-${sessionId.slice(0, 8).toUpperCase()}-${r.source_row_no}`;

    const { rows: [asset] } = await client.query<{ id: string }>(
      `INSERT INTO est_asset (tenant_id, space_id, building_id, code, name, asset_type, manufacturer, model,
         serial_no, asset_tag, uniclass_code, sfg20_ref, install_date, condition_grade, criticality,
         expected_life_years, replacement_cost, warranty_expiry, qr_uid, import_session_id, source_row)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id`,
      [tenantId, spaceId, buildingId, code, str(v['name']), str(v['asset_type']), str(v['manufacturer']),
        str(v['model']), str(v['serial_no']), str(v['asset_tag']), str(v['uniclass_code']), str(v['sfg20_ref']),
        str(v['install_date']), str(v['condition_grade']), str(v['criticality']),
        num(v['expected_life_years']), num(v['replacement_cost']), str(v['warranty_expiry']),
        `FMIQ-${randomUUID()}`, sessionId, r.source_row_no]);

    await client.query(
      `INSERT INTO imp_change (tenant_id, session_id, entity, entity_id, action, before, after)
       VALUES ($1,$2,'est_asset',$3,'insert',NULL,$4)`,
      [tenantId, sessionId, asset.id, JSON.stringify({ ...v, code, sourceRow: r.source_row_no })]);
    await audit(client, tenantId, 'est_asset', asset.id, 'asset.import_created', actorUserId, null,
      { ...v, code, importSessionId: sessionId, sourceRow: r.source_row_no });
    await client.query(
      `UPDATE imp_row SET resolution = COALESCE(resolution, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
      [r.id, JSON.stringify({ action: 'create', assetId: asset.id })]);
    created++;
  }

  // 3. Remember accepted mappings for the next file from this source.
  const mappings = await loadAcceptedMappings(client, sessionId);
  for (const m of mappings) {
    await client.query(
      `INSERT INTO imp_mapping_memory (tenant_id, source_fingerprint, source_column, target_field, last_used_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (tenant_id, source_fingerprint, source_column)
       DO UPDATE SET target_field = EXCLUDED.target_field, last_used_at = now()`,
      [tenantId, session.source_fingerprint ?? '', m.source_column, m.target_field]);
  }

  await client.query(
    `UPDATE imp_session SET status = 'committed', committed_at = now(), undo_expires_at = now() + ${UNDO_WINDOW}
      WHERE id = $1`, [sessionId]);
  await mergeStats(client, sessionId, { committed: { created, skipped, newEntities } });
  await audit(client, tenantId, 'imp_session', sessionId, 'import.committed', actorUserId, null,
    { created, skipped, newEntities });
  return { created, skipped, newEntities };
}

function requireKey(map: Map<string, string>, key: string, context: string): string {
  const id = map.get(key);
  if (!id) throw new ImportError('invalid_decision', `Missing parent decision (${key}) for "${context}".`);
  return id;
}

function locationKeys(v: Record<string, unknown>): { buildingKey: string | null; spaceKey: string | null } {
  const site = str(v['site']) ?? str(v['building']);
  if (!site) return { buildingKey: null, spaceKey: null };
  const building = str(v['building']) ?? site;
  const buildingKey = `${site}|${building}`;
  let floor = str(v['floor']);
  const space = str(v['space']);
  if (space && !floor) floor = PLACEHOLDER_FLOOR;
  const spaceKey = space && floor ? `${buildingKey}|${floor}|${space}` : null;
  return { buildingKey, spaceKey };
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Undo — create-only reversal within the 7-day window; soft-delete only
// ---------------------------------------------------------------------------

export async function undoSession(
  client: PoolClient, tenantId: string, sessionId: string, actorUserId: string,
): Promise<{ reverted: number; skippedEdited: number; revertedEntities: number }> {
  const session = await loadSession(client, sessionId);
  if (session.status !== 'committed') throw new ImportError('bad_state', `Session is '${session.status}', not committed.`);
  const { rows: [win] } = await client.query<{ ok: boolean }>(
    `SELECT (now() < undo_expires_at) AS ok FROM imp_session WHERE id = $1`, [sessionId]);
  if (!win?.ok) throw new ImportError('undo_expired', 'The 7-day undo window has elapsed.');

  const { rows: changes } = await client.query<{ entity: string; entity_id: string }>(
    `SELECT entity, entity_id FROM imp_change WHERE session_id = $1 AND action = 'insert'`, [sessionId]);

  // Assets first: revert only records untouched since commit (PRD Stage 7).
  let reverted = 0; let skippedEdited = 0;
  for (const c of changes.filter((c) => c.entity === 'est_asset')) {
    const { rows: [gone] } = await client.query<{ id: string }>(
      `UPDATE est_asset SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL AND updated_at <= (SELECT committed_at FROM imp_session WHERE id = $2)
        RETURNING id`,
      [c.entity_id, sessionId]);
    if (gone) {
      reverted++;
      await client.query(
        `INSERT INTO imp_change (tenant_id, session_id, entity, entity_id, action, before, after)
         VALUES ($1,$2,'est_asset',$3,'soft_delete',NULL,$4)`,
        [tenantId, sessionId, c.entity_id, JSON.stringify({ undo: true })]);
      await audit(client, tenantId, 'est_asset', c.entity_id, 'asset.import_undone', actorUserId, null, { importSessionId: sessionId });
    } else {
      skippedEdited++;
    }
  }

  // Locations created by this session: soft-delete child→parent where nothing live remains.
  let revertedEntities = 0;
  const guards: Record<string, string> = {
    est_space: `NOT EXISTS (SELECT 1 FROM est_asset a WHERE a.space_id = t.id AND a.deleted_at IS NULL)`,
    est_floor: `NOT EXISTS (SELECT 1 FROM est_space s WHERE s.floor_id = t.id AND s.deleted_at IS NULL)`,
    est_building: `NOT EXISTS (SELECT 1 FROM est_floor f WHERE f.building_id = t.id AND f.deleted_at IS NULL)
                   AND NOT EXISTS (SELECT 1 FROM est_asset a WHERE a.building_id = t.id AND a.deleted_at IS NULL)`,
    est_site: `NOT EXISTS (SELECT 1 FROM est_building b WHERE b.site_id = t.id AND b.deleted_at IS NULL)`,
  };
  for (const entity of ['est_space', 'est_floor', 'est_building', 'est_site']) {
    for (const c of changes.filter((c) => c.entity === entity)) {
      const { rows: [gone] } = await client.query<{ id: string }>(
        `UPDATE ${entity} t SET deleted_at = now()
          WHERE t.id = $1 AND t.deleted_at IS NULL AND ${guards[entity]}
          RETURNING t.id`, [c.entity_id]);
      if (gone) {
        revertedEntities++;
        await client.query(
          `INSERT INTO imp_change (tenant_id, session_id, entity, entity_id, action, before, after)
           VALUES ($1,$2,$3,$4,'soft_delete',NULL,$5)`,
          [tenantId, sessionId, entity, c.entity_id, JSON.stringify({ undo: true })]);
      }
    }
  }

  await client.query(`UPDATE imp_session SET status = 'undone', undone_at = now() WHERE id = $1`, [sessionId]);
  await mergeStats(client, sessionId, { undo: { reverted, skippedEdited, revertedEntities } });
  await audit(client, tenantId, 'imp_session', sessionId, 'import.undone', actorUserId, null,
    { reverted, skippedEdited, revertedEntities });
  return { reverted, skippedEdited, revertedEntities };
}
