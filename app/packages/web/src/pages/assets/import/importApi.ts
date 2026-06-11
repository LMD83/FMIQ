import { api } from '../../../api';

/**
 * Typed client for the import-wizard API (routes/imports.ts). Reads come back
 * snake_case straight from Postgres; write payloads are camelCase per the zod
 * schemas. Shapes mirror the server EXACTLY — change them together.
 */

// --- Session ---------------------------------------------------------------

export type SessionStatus =
  | 'mapping' | 'validating' | 'hierarchy' | 'dedupe' | 'dry_run'
  | 'committing' | 'committed' | 'undone';

export interface SessionStats {
  rows?: number; droppedBlankRows?: number; sheets?: number;
  validation?: RowCounts;
  dedupe?: { groups: number };
  dryRun?: DryRunResult;
  committed?: { created: number; skipped: number; newEntities: number };
  undo?: { reverted: number; skippedEdited: number; revertedEntities: number };
}

export interface ImportSession {
  id: string; status: SessionStatus; target_mode: string; profile: string;
  current_stage: number; source_fingerprint: string | null; stats: SessionStats | null;
  created_at: string; committed_at: string | null; undone_at: string | null;
  undo_expires_at: string | null; created_by: string | null;
  files: Array<{ id: string; filename: string; size_bytes: number; kind: string; uploaded_at: string }>;
  sheets: Array<{ id: string; name: string; classification: string; header_row: number; row_count: number }>;
  rowCounts: Partial<Record<RowState, number>>;
}

export interface ImportSessionSummary {
  id: string; status: SessionStatus; target_mode: string; profile: string;
  current_stage: number; stats: SessionStats | null;
  created_at: string; committed_at: string | null; undone_at: string | null;
  undo_expires_at: string | null; created_by_name: string | null;
  filename: string | null; size_bytes: number | null;
}

// --- Mappings / value maps / rows / decisions / dedupe ----------------------

export type MappingProvenance = 'exact' | 'remembered' | 'fuzzy' | 'manual' | 'none';

export interface MappingRow {
  id: string; source_column: string; target_field: string | null;
  confidence: number | string | null; provenance: MappingProvenance; accepted_by: string | null;
}

export interface ValueMapRow {
  id: string; target_field: string; source_value: string;
  mapped_value: string | null; provenance: string;
}

export type RowState = 'pending' | 'valid' | 'warning' | 'error' | 'excluded';
export interface RowCounts { valid: number; warning: number; error: number; excluded: number }

export interface RowIssue { field: string; severity: 'error' | 'warning'; code: string; message: string }

export interface StagedRow {
  id: string; source_row_no: number;
  raw: Record<string, string | number | null>;
  normalised: Record<string, unknown> | null;
  state: RowState; issues: RowIssue[] | null;
  dedupe_group_id: string | null;
  resolution: { action?: string; assetId?: string; reason?: string } | null;
}

export interface EntityDecision {
  id: string; entity: 'site' | 'building' | 'floor' | 'space';
  inbound_key: string; action: 'link' | 'create'; linked_id: string | null;
  confidence: number | string | null; confirmed_by: string | null;
}

/** POST /dedupe response (importEngine.DuplicateGroup). */
export interface DuplicateGroup {
  key: string; keyKind: 'asset_tag' | 'serial_model';
  rowIds: string[]; existingAssetIds: string[];
  kind: 'within_file' | 'existing' | 'both';
}

/** GET /duplicates response row (json_agg over imp_row). */
export interface DuplicateGroupRows {
  dedupe_group_id: string;
  rows: Array<{
    rowId: string; sourceRowNo: number; state: RowState;
    resolution: { action?: string } | null; normalised: Record<string, unknown> | null;
  }>;
}

export interface DryRunResult {
  creates: number; skippedDuplicates: number; blockedErrors: number;
  excluded: number; warnings: number;
  newEntities: Record<string, string[]>; linkedEntities: number;
}

// --- Fetchers ---------------------------------------------------------------

export const createImport = (body: { filename: string; contentBase64: string; targetMode: 'create_only' }) =>
  api<{ sessionId: string; sheet: { name: string; headerRow: number; rowCount: number }; mappings: unknown[] }>(
    '/api/v1/imports', { method: 'POST', body: JSON.stringify(body) });

export const listImports = () => api<{ sessions: ImportSessionSummary[] }>('/api/v1/imports');
export const getImport = (id: string) => api<{ session: ImportSession }>(`/api/v1/imports/${id}`);

export const getMappings = (id: string) => api<{ mappings: MappingRow[] }>(`/api/v1/imports/${id}/mappings`);
export const putMappings = (id: string, mappings: Array<{ sourceColumn: string; targetField: string | null }>) =>
  api<{ mappings: MappingRow[] }>(`/api/v1/imports/${id}/mappings`, { method: 'PUT', body: JSON.stringify({ mappings }) });

export const getValueMaps = (id: string) => api<{ valueMaps: ValueMapRow[] }>(`/api/v1/imports/${id}/value-maps`);
export const putValueMaps = (id: string, valueMaps: Array<{ targetField: string; sourceValue: string; mappedValue: string | null }>) =>
  api<{ valueMaps: ValueMapRow[] }>(`/api/v1/imports/${id}/value-maps`, { method: 'PUT', body: JSON.stringify({ valueMaps }) });

export const runValidation = (id: string) =>
  api<{ counts: RowCounts }>(`/api/v1/imports/${id}/validate`, { method: 'POST' });

export const listRows = (id: string, opts: { state?: RowState; limit?: number; offset?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.state) q.set('state', opts.state);
  if (opts.limit != null) q.set('limit', String(opts.limit));
  if (opts.offset != null) q.set('offset', String(opts.offset));
  const qs = q.toString();
  return api<{ rows: StagedRow[] }>(`/api/v1/imports/${id}/rows${qs ? `?${qs}` : ''}`);
};

export const patchRows = (id: string, edits: Array<{ rowId: string; raw?: Record<string, string | number | null>; exclude?: boolean }>) =>
  api<{ updated: number }>(`/api/v1/imports/${id}/rows`, { method: 'PATCH', body: JSON.stringify({ edits }) });

export const resolveHierarchy = (id: string) =>
  api<{ decisions: EntityDecision[] }>(`/api/v1/imports/${id}/hierarchy/resolve`, { method: 'POST' });
export const getEntityDecisions = (id: string) =>
  api<{ decisions: EntityDecision[] }>(`/api/v1/imports/${id}/entity-decisions`);
export const putEntityDecisions = (id: string, decisions: Array<{ entity: string; inboundKey: string; action: 'link' | 'create'; linkedId?: string | null }>) =>
  api<{ decisions: EntityDecision[] }>(`/api/v1/imports/${id}/entity-decisions`, { method: 'PUT', body: JSON.stringify({ decisions }) });

export const runDedupe = (id: string) =>
  api<{ groups: DuplicateGroup[] }>(`/api/v1/imports/${id}/dedupe`, { method: 'POST' });
export const listDuplicates = (id: string) =>
  api<{ groups: DuplicateGroupRows[] }>(`/api/v1/imports/${id}/duplicates`);
export const putResolutions = (id: string, resolutions: Array<{ rowId: string; action: 'create' | 'skip' }>) =>
  api<{ updated: number }>(`/api/v1/imports/${id}/duplicates/resolutions`, { method: 'PUT', body: JSON.stringify({ resolutions }) });

export const runDryRun = (id: string) =>
  api<{ dryRun: DryRunResult }>(`/api/v1/imports/${id}/dry-run`, { method: 'POST' });
export const commitImport = (id: string) =>
  api<{ created: number; skipped: number; newEntities: number }>(`/api/v1/imports/${id}/commit`, { method: 'POST' });
export const undoImport = (id: string) =>
  api<{ reverted: number; skippedEdited: number; revertedEntities: number }>(`/api/v1/imports/${id}/undo`, { method: 'POST' });

// --- Target-field registry (mirror of importEngine.TARGET_FIELDS — keep in sync) ---

export interface TargetFieldDef {
  field: string; label: string; kind: 'text' | 'enum' | 'date' | 'number';
  required?: boolean; enumValues?: string[]; group: string;
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  { field: 'name', label: 'Asset name', kind: 'text', required: true, group: 'Identity' },
  { field: 'code', label: 'Asset code', kind: 'text', group: 'Identity' },
  { field: 'asset_tag', label: 'Asset tag / barcode', kind: 'text', group: 'Identity' },
  { field: 'serial_no', label: 'Serial number', kind: 'text', group: 'Identity' },
  { field: 'model', label: 'Model', kind: 'text', group: 'Identity' },
  { field: 'manufacturer', label: 'Manufacturer', kind: 'text', group: 'Identity' },
  { field: 'asset_type', label: 'Asset type', kind: 'text', group: 'Classification' },
  { field: 'uniclass_code', label: 'Uniclass code', kind: 'text', group: 'Classification' },
  { field: 'sfg20_ref', label: 'SFG20 reference', kind: 'text', group: 'Classification' },
  { field: 'condition_grade', label: 'Condition grade (A–D)', kind: 'enum', enumValues: ['A', 'B', 'C', 'D'], group: 'Condition' },
  { field: 'criticality', label: 'Criticality', kind: 'enum', enumValues: ['critical', 'high', 'medium', 'low'], group: 'Condition' },
  { field: 'install_date', label: 'Install date', kind: 'date', group: 'Lifecycle' },
  { field: 'expected_life_years', label: 'Expected life (years)', kind: 'number', group: 'Lifecycle' },
  { field: 'replacement_cost', label: 'Replacement cost', kind: 'number', group: 'Lifecycle' },
  { field: 'warranty_expiry', label: 'Warranty expiry', kind: 'date', group: 'Lifecycle' },
  { field: 'site', label: 'Site', kind: 'text', group: 'Location' },
  { field: 'building', label: 'Building', kind: 'text', group: 'Location' },
  { field: 'floor', label: 'Floor', kind: 'text', group: 'Location' },
  { field: 'space', label: 'Space / room', kind: 'text', group: 'Location' },
];

export const fieldLabel = (field: string | null): string =>
  field ? (TARGET_FIELDS.find((f) => f.field === field)?.label ?? field) : 'Not imported';

/** Client-side prefill for Stage 3 (1–5 / Good–Fair–Poor / RAG vocabularies) — always user-confirmed. */
export function suggestEnumValue(field: string, source: string): string | null {
  const s = source.trim().toLowerCase();
  if (field === 'condition_grade') {
    const map: Record<string, string> = {
      '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'D',
      excellent: 'A', good: 'A', fair: 'B', average: 'B', poor: 'C', bad: 'D',
      'very poor': 'D', 'end of life': 'D', new: 'A',
    };
    return map[s] ?? null;
  }
  if (field === 'criticality') {
    if (['critical', 'red', 'essential', 'vital', '1'].includes(s)) return 'critical';
    if (['high', 'important', 'amber', 'orange', '2'].includes(s)) return 'high';
    if (['medium', 'normal', 'standard', 'yellow', '3'].includes(s)) return 'medium';
    if (['low', 'minor', 'green', 'non-critical', 'noncritical', '4', '5'].includes(s)) return 'low';
  }
  return null;
}

// --- Misc helpers ------------------------------------------------------------

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong — try again.';
}
