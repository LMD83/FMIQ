/**
 * Import engine — PURE functions for the asset-register import wizard (PRD §4–§6,
 * docs/product/PRD-asset-register-import.md). No DB access, no side effects, no
 * Date.now() — callers supply state and persist results (same pattern as gateEngine).
 *
 * Covers: header detection, mapping suggestion (exact > remembered > fuzzy — no AI in
 * Sprint 1), value mapping, row normalisation + validation (errors block / warnings
 * pass), dedupe keys (asset tag; serial+model), hierarchy extraction + entity matching,
 * dry-run diff, CSV serialisation.
 */

// ---------------------------------------------------------------------------
// Target field registry
// ---------------------------------------------------------------------------

export type FieldKind = 'text' | 'enum' | 'date' | 'number';

export interface TargetField {
  /** Canonical key used in imp_mapping.target_field and imp_row.normalised. */
  field: string;
  /** est_asset column, or null for location/virtual fields resolved at Stage 5. */
  column: string | null;
  synonyms: string[];
  required?: boolean;
  kind: FieldKind;
  enumValues?: string[];
}

export const TARGET_FIELDS: TargetField[] = [
  { field: 'name', column: 'name', kind: 'text', required: true,
    synonyms: ['asset name', 'asset description', 'description', 'item', 'equipment', 'equipment name', 'plant item'] },
  { field: 'code', column: 'code', kind: 'text',
    synonyms: ['asset code', 'asset ref', 'asset reference', 'reference', 'ref', 'asset id', 'equipment code', 'plant ref'] },
  { field: 'asset_tag', column: 'asset_tag', kind: 'text',
    synonyms: ['tag', 'tag no', 'tag number', 'asset tag no', 'barcode', 'label', 'asset label'] },
  { field: 'serial_no', column: 'serial_no', kind: 'text',
    synonyms: ['serial', 'serial number', 'serial no', 's n', 'sn', 'serial num'] },
  { field: 'model', column: 'model', kind: 'text',
    synonyms: ['model no', 'model number', 'model ref'] },
  { field: 'manufacturer', column: 'manufacturer', kind: 'text',
    synonyms: ['make', 'maker', 'brand', 'oem', 'manufacturer name', 'make model'] },
  { field: 'asset_type', column: 'asset_type', kind: 'text',
    synonyms: ['type', 'category', 'asset category', 'equipment type', 'asset class', 'plant type'] },
  { field: 'uniclass_code', column: 'uniclass_code', kind: 'text',
    synonyms: ['uniclass', 'uniclass 2015', 'uniclass code', 'uniclass ref', 'classification code'] },
  { field: 'sfg20_ref', column: 'sfg20_ref', kind: 'text',
    synonyms: ['sfg20', 'sfg 20', 'sfg20 code', 'sfg20 ref', 'maintenance template', 'sfg20 schedule'] },
  { field: 'condition_grade', column: 'condition_grade', kind: 'enum', enumValues: ['A', 'B', 'C', 'D'],
    synonyms: ['condition', 'condition grade', 'condition rating', 'condition score', 'cond'] },
  { field: 'criticality', column: 'criticality', kind: 'enum', enumValues: ['critical', 'high', 'medium', 'low'],
    synonyms: ['criticality rating', 'business criticality', 'risk rating', 'priority', 'crit'] },
  { field: 'install_date', column: 'install_date', kind: 'date',
    synonyms: ['installation date', 'installed', 'date installed', 'date of installation', 'install', 'commissioned date'] },
  { field: 'expected_life_years', column: 'expected_life_years', kind: 'number',
    synonyms: ['expected life', 'life expectancy', 'useful life', 'life years', 'expected life yrs', 'asset life'] },
  { field: 'replacement_cost', column: 'replacement_cost', kind: 'number',
    synonyms: ['replacement value', 'cost to replace', 'reinstatement cost', 'capital cost', 'replacement cost eur'] },
  { field: 'warranty_expiry', column: 'warranty_expiry', kind: 'date',
    synonyms: ['warranty', 'warranty end', 'warranty end date', 'warranty expiry date', 'guarantee expiry'] },
  // Location anchors — virtual fields resolved during hierarchy resolution (Stage 5).
  { field: 'site', column: null, kind: 'text',
    synonyms: ['site name', 'campus', 'estate', 'location site'] },
  { field: 'building', column: null, kind: 'text',
    synonyms: ['building name', 'block', 'property', 'premises'] },
  { field: 'floor', column: null, kind: 'text',
    synonyms: ['level', 'storey', 'floor name', 'floor level'] },
  { field: 'space', column: null, kind: 'text',
    synonyms: ['room', 'room name', 'room no', 'space name', 'location', 'area', 'zone', 'room space'] },
];

const FIELD_BY_NAME = new Map(TARGET_FIELDS.map((f) => [f.field, f]));

export function getTargetField(field: string): TargetField | undefined {
  return FIELD_BY_NAME.get(field);
}

// ---------------------------------------------------------------------------
// Header normalisation + fuzzy matching
// ---------------------------------------------------------------------------

export function normaliseHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 string similarity: combined char-level (levenshtein) and token-overlap. */
export function similarity(a: string, b: string): number {
  const na = normaliseHeader(a);
  const nb = normaliseHeader(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const lev = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  const tok = common / Math.max(ta.size, tb.size);
  return Math.max(lev, tok * 0.9 + lev * 0.1);
}

export type MappingProvenance = 'exact' | 'remembered' | 'fuzzy' | 'none';

export interface MappingSuggestion {
  sourceColumn: string;
  targetField: string | null;
  confidence: number;
  provenance: MappingProvenance;
}

const FUZZY_THRESHOLD = 0.72;

/**
 * Layered mapping suggestion (PRD Stage 2): exact header > remembered mapping >
 * fuzzy/synonym. Never silently maps two columns to one target — the lower-confidence
 * duplicate is demoted to unmapped.
 * @param memory normalised source column → target field (from imp_mapping_memory)
 */
export function suggestMappings(headers: string[], memory: Record<string, string> = {}): MappingSuggestion[] {
  const suggestions: MappingSuggestion[] = headers.map((header) => {
    const norm = normaliseHeader(header);

    // 1. exact: canonical field name (underscores as spaces) or a synonym
    for (const f of TARGET_FIELDS) {
      const canonical = f.field.replace(/_/g, ' ');
      if (norm === canonical || f.synonyms.some((s) => normaliseHeader(s) === norm)) {
        return { sourceColumn: header, targetField: f.field, confidence: 1, provenance: 'exact' as const };
      }
    }
    // 2. remembered (per-tenant mapping memory)
    const remembered = memory[norm];
    if (remembered && FIELD_BY_NAME.has(remembered)) {
      return { sourceColumn: header, targetField: remembered, confidence: 0.95, provenance: 'remembered' as const };
    }
    // 3. fuzzy against field names + synonyms
    let best: { field: string; score: number } | null = null;
    for (const f of TARGET_FIELDS) {
      const candidates = [f.field.replace(/_/g, ' '), ...f.synonyms];
      for (const c of candidates) {
        const score = similarity(norm, c);
        if (!best || score > best.score) best = { field: f.field, score };
      }
    }
    if (best && best.score >= FUZZY_THRESHOLD) {
      return { sourceColumn: header, targetField: best.field, confidence: Math.min(best.score, 0.9), provenance: 'fuzzy' as const };
    }
    return { sourceColumn: header, targetField: null, confidence: 0, provenance: 'none' as const };
  });

  // De-duplicate targets: highest confidence wins, others demoted to unmapped.
  const byTarget = new Map<string, MappingSuggestion>();
  for (const s of suggestions) {
    if (!s.targetField) continue;
    const cur = byTarget.get(s.targetField);
    if (!cur || s.confidence > cur.confidence) {
      if (cur) { cur.targetField = null; cur.confidence = 0; cur.provenance = 'none'; }
      byTarget.set(s.targetField, s);
    } else {
      s.targetField = null; s.confidence = 0; s.provenance = 'none';
    }
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Header-row detection (junk rows above the header — PRD Stage 1)
// ---------------------------------------------------------------------------

/**
 * Returns the 0-based index of the most header-like row within the first
 * `maxScan` rows: the earliest row maximising distinct, non-empty, non-numeric cells.
 */
export function detectHeaderRow(rows: (string | number | null | undefined)[][], maxScan = 10): number {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map((c) => (c == null ? '' : String(c).trim())).filter((c) => c !== '');
    const textCells = cells.filter((c) => Number.isNaN(Number(c)));
    const distinct = new Set(textCells.map((c) => c.toLowerCase()));
    const score = distinct.size;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Value parsing + row validation
// ---------------------------------------------------------------------------

export const SENTINELS = new Set(['n/a', 'na', 'n.a.', 'tbc', 'tba', '-', '--', '?', 'unknown', 'none', 'nil']);

export interface RowIssue {
  field: string;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ValueMapEntry {
  targetField: string;
  sourceValue: string;
  mappedValue: string | null;
}

/** Parse a date cell: ISO, DD/MM/YYYY (default day-first, IE/UK), or Excel serial. Returns YYYY-MM-DD or null. */
export function parseDateValue(v: string | number, dayFirst = true): string | null {
  if (typeof v === 'number' || (/^\d{4,6}(\.\d+)?$/.test(String(v).trim()) && Number(String(v)) > 10000)) {
    // Excel serial date (days since 1899-12-30); plausible window 1900–2100
    const serial = Number(v);
    if (serial < 367 || serial > 73415) return null;
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (dmy) {
    let [a, b] = [Number(dmy[1]), Number(dmy[2])];
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    let day: number, month: number;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { day = b; month = a; }
    else if (dayFirst) { day = a; month = b; }
    else { day = b; month = a; }
    return buildDate(year, month, day);
  }
  const ymd = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (ymd) return buildDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  return null;
}

function buildDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Parse a numeric cell, tolerating currency symbols, thousands separators and trailing units ("450 kW"). */
export function parseNumberValue(v: string | number): { value: number | null; strippedUnit: string | null } {
  if (typeof v === 'number') return { value: Number.isFinite(v) ? v : null, strippedUnit: null };
  const s = String(v).trim().replace(/^[€£$]\s*/, '');
  const m = /^(-?\d[\d,\s]*(?:\.\d+)?)\s*(.*)$/.exec(s);
  if (!m) return { value: null, strippedUnit: null };
  const num = Number(m[1].replace(/[,\s]/g, ''));
  if (!Number.isFinite(num)) return { value: null, strippedUnit: null };
  return { value: num, strippedUnit: m[2] ? m[2].trim() : null };
}

export interface NormalisedRow {
  values: Record<string, unknown>;
  issues: RowIssue[];
  state: 'valid' | 'warning' | 'error';
}

export interface ValidationOptions {
  /** Reference date (YYYY-MM-DD) for "not in the future" checks — injected, never Date.now(). */
  today: string;
  dayFirst?: boolean;
}

/**
 * Normalise and validate one row. `rec` maps target field → raw cell value (already
 * routed through the column mappings). Errors block commit; warnings pass (PRD §1.2).
 */
export function normaliseAndValidate(
  rec: Record<string, string | number | null | undefined>,
  valueMaps: ValueMapEntry[],
  opts: ValidationOptions,
): NormalisedRow {
  const issues: RowIssue[] = [];
  const values: Record<string, unknown> = {};
  const vmIndex = new Map<string, string | null>();
  for (const vm of valueMaps) vmIndex.set(`${vm.targetField} ${vm.sourceValue.trim().toLowerCase()}`, vm.mappedValue);

  for (const [field, rawIn] of Object.entries(rec)) {
    const def = FIELD_BY_NAME.get(field);
    if (!def) continue;
    let raw: string | number | null = rawIn == null ? null : rawIn;

    // Sentinels → blank, counted and reported (PRD edge case 5)
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (t === '') raw = null;
      else if (SENTINELS.has(t.toLowerCase())) {
        issues.push({ field, severity: 'warning', code: 'sentinel', message: `"${t}" treated as blank.` });
        raw = null;
      }
    }
    if (raw == null) { values[field] = null; continue; }

    switch (def.kind) {
      case 'text':
        values[field] = String(raw).trim();
        break;
      case 'enum': {
        const src = String(raw).trim();
        const mapped = vmIndex.get(`${field} ${src.toLowerCase()}`);
        let candidate = mapped !== undefined ? mapped : src;
        if (candidate !== null) {
          const match = def.enumValues!.find((e) => e.toLowerCase() === String(candidate).trim().toLowerCase());
          if (match) { values[field] = match; }
          else {
            // Unmapped enum values become warnings, never silent nulls (PRD Stage 3)
            issues.push({ field, severity: 'warning', code: 'unmapped_value',
              message: `Value "${src}" is not a recognised ${field.replace(/_/g, ' ')} and has no value mapping; left blank.` });
            values[field] = null;
          }
        } else {
          values[field] = null; // explicitly mapped to blank
        }
        break;
      }
      case 'date': {
        const parsed = parseDateValue(raw, opts.dayFirst ?? true);
        if (parsed === null) {
          issues.push({ field, severity: 'error', code: 'invalid_date', message: `"${raw}" is not a recognisable date.` });
          values[field] = null;
        } else {
          if (field === 'install_date' && parsed > opts.today) {
            issues.push({ field, severity: 'error', code: 'date_in_future', message: `Install date ${parsed} is in the future.` });
          }
          values[field] = parsed;
        }
        break;
      }
      case 'number': {
        const { value, strippedUnit } = parseNumberValue(raw);
        if (value === null) {
          issues.push({ field, severity: 'error', code: 'invalid_number', message: `"${raw}" is not a number.` });
          values[field] = null;
        } else {
          if (strippedUnit) {
            issues.push({ field, severity: 'warning', code: 'unit_stripped', message: `Unit "${strippedUnit}" stripped from "${raw}".` });
          }
          if (field === 'replacement_cost' && value < 0) {
            issues.push({ field, severity: 'error', code: 'negative_cost', message: 'Replacement cost cannot be negative.' });
          }
          if (field === 'expected_life_years' && (value < 0 || value > 200)) {
            issues.push({ field, severity: 'error', code: 'out_of_range', message: `Expected life ${value} years is out of range.` });
          }
          values[field] = value;
        }
        break;
      }
    }
  }

  // Required: asset name + a location anchor (site or building) — PRD Stage 2
  const name = values['name'];
  if (name == null || String(name).trim() === '') {
    issues.push({ field: 'name', severity: 'error', code: 'required', message: 'Asset name is required.' });
  }
  if (values['site'] == null && values['building'] == null) {
    issues.push({ field: 'site', severity: 'error', code: 'location_anchor_required',
      message: 'A location anchor (site or building) is required.' });
  }

  const state = issues.some((i) => i.severity === 'error') ? 'error'
    : issues.length > 0 ? 'warning' : 'valid';
  return { values, issues, state };
}

// ---------------------------------------------------------------------------
// Dedupe — exact keys: asset tag; serial + model (PRD Stage 6, Sprint-1 slice)
// ---------------------------------------------------------------------------

function normKey(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim().toLowerCase().replace(/\s+/g, ' ');
  return t === '' ? null : t;
}

export interface DedupeRow {
  rowId: string;
  assetTag?: string | null;
  serialNo?: string | null;
  model?: string | null;
}

export interface ExistingAssetKey {
  assetId: string;
  assetTag?: string | null;
  serialNo?: string | null;
  model?: string | null;
}

export interface DuplicateGroup {
  key: string;
  keyKind: 'asset_tag' | 'serial_model';
  rowIds: string[];
  existingAssetIds: string[];
  kind: 'within_file' | 'existing' | 'both';
}

/** Exact-key duplicate detection, inbound vs existing register AND within-file. */
export function findDuplicates(rows: DedupeRow[], existing: ExistingAssetKey[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  const keysFor = (r: { assetTag?: string | null; serialNo?: string | null; model?: string | null }) => {
    const out: Array<{ key: string; keyKind: DuplicateGroup['keyKind'] }> = [];
    const tag = normKey(r.assetTag);
    if (tag) out.push({ key: `tag:${tag}`, keyKind: 'asset_tag' });
    const serial = normKey(r.serialNo);
    if (serial) out.push({ key: `sm:${serial} ${normKey(r.model) ?? ''}`, keyKind: 'serial_model' });
    return out;
  };

  const ensure = (key: string, keyKind: DuplicateGroup['keyKind']) => {
    let g = groups.get(key);
    if (!g) { g = { key, keyKind, rowIds: [], existingAssetIds: [], kind: 'within_file' }; groups.set(key, g); }
    return g;
  };

  for (const e of existing) {
    for (const { key, keyKind } of keysFor(e)) ensure(key, keyKind).existingAssetIds.push(e.assetId);
  }
  for (const r of rows) {
    for (const { key, keyKind } of keysFor(r)) ensure(key, keyKind).rowIds.push(r.rowId);
  }

  const out: DuplicateGroup[] = [];
  for (const g of groups.values()) {
    const withinFile = g.rowIds.length > 1;
    const vsExisting = g.rowIds.length >= 1 && g.existingAssetIds.length >= 1;
    if (!withinFile && !vsExisting) continue;
    g.kind = withinFile && vsExisting ? 'both' : withinFile ? 'within_file' : 'existing';
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hierarchy extraction + entity matching (Stage 5)
// ---------------------------------------------------------------------------

export interface HierarchyEntity {
  entity: 'site' | 'building' | 'floor' | 'space';
  /** Pipe-joined path including ancestors, e.g. 'Kildare St|Main Block|Level 1|Rm 1.04'. */
  inboundKey: string;
  name: string;
  parentKey: string | null;
}

export const PLACEHOLDER_FLOOR = 'Level 0';

/**
 * Distinct location entities referenced by the rows, in dependency order
 * (sites, then buildings, then floors, then spaces). When a space is given without a
 * floor, a placeholder floor (PLACEHOLDER_FLOOR) is inserted — surfaced for explicit
 * confirmation, never silently created (PRD D5).
 */
export function extractHierarchy(rows: Array<Record<string, unknown>>): HierarchyEntity[] {
  const seen = new Set<string>();
  const out: HierarchyEntity[] = [];
  const push = (e: HierarchyEntity) => {
    const k = `${e.entity} ${e.inboundKey.toLowerCase()}`;
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  };

  const collected: HierarchyEntity[][] = [[], [], [], []];
  for (const v of rows) {
    const site = strOrNull(v['site']);
    const building = strOrNull(v['building']);
    let floor = strOrNull(v['floor']);
    const space = strOrNull(v['space']);
    if (!site && !building) continue;
    const siteName = site ?? building!; // building-only files: building doubles as the site
    const siteKey = siteName;
    collected[0].push({ entity: 'site', inboundKey: siteKey, name: siteName, parentKey: null });
    const buildingName = building ?? siteName;
    const buildingKey = `${siteKey}|${buildingName}`;
    collected[1].push({ entity: 'building', inboundKey: buildingKey, name: buildingName, parentKey: siteKey });
    if (space && !floor) floor = PLACEHOLDER_FLOOR;
    if (floor) {
      const floorKey = `${buildingKey}|${floor}`;
      collected[2].push({ entity: 'floor', inboundKey: floorKey, name: floor, parentKey: buildingKey });
      if (space) {
        collected[3].push({ entity: 'space', inboundKey: `${floorKey}|${space}`, name: space, parentKey: floorKey });
      }
    }
  }
  for (const tier of collected) for (const e of tier) push(e);
  return out;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export interface ExistingEntity { id: string; name: string }

export interface EntityMatch {
  action: 'link' | 'create';
  linkedId: string | null;
  confidence: number;
}

const LINK_THRESHOLD = 0.85;

/** Match an inbound entity name against existing register entities (exact then fuzzy). */
export function matchEntity(inboundName: string, existing: ExistingEntity[]): EntityMatch {
  let best: { id: string; score: number } | null = null;
  for (const e of existing) {
    const score = similarity(inboundName, e.name);
    if (!best || score > best.score) best = { id: e.id, score };
  }
  if (best && best.score >= 1) return { action: 'link', linkedId: best.id, confidence: 1 };
  if (best && best.score >= LINK_THRESHOLD) return { action: 'link', linkedId: best.id, confidence: best.score };
  return { action: 'create', linkedId: null, confidence: best?.score ?? 0 };
}

// ---------------------------------------------------------------------------
// Dry-run diff (Stage 7) — counts must equal commit counts exactly (AC3)
// ---------------------------------------------------------------------------

export interface DryRunRowInput {
  state: 'pending' | 'valid' | 'warning' | 'error' | 'excluded';
  resolution: { action?: string } | null;
}

export interface DryRunDecisionInput {
  entity: string;
  inboundKey: string;
  action: 'link' | 'create';
}

export interface DryRunResult {
  creates: number;
  skippedDuplicates: number;
  blockedErrors: number;
  excluded: number;
  warnings: number;
  newEntities: Record<string, string[]>;
  linkedEntities: number;
}

/**
 * Create-only dry-run: a row commits iff state is valid/warning and it has not been
 * resolved as a duplicate skip. Error rows block; excluded rows are out.
 * The SAME function gates the commit loop, so dry-run counts == commit counts.
 */
export function willCommitRow(row: DryRunRowInput): boolean {
  if (row.state !== 'valid' && row.state !== 'warning') return false;
  if (row.resolution?.action === 'skip') return false;
  return true;
}

export function computeDryRun(rows: DryRunRowInput[], decisions: DryRunDecisionInput[]): DryRunResult {
  const result: DryRunResult = {
    creates: 0, skippedDuplicates: 0, blockedErrors: 0, excluded: 0, warnings: 0,
    newEntities: {}, linkedEntities: 0,
  };
  for (const r of rows) {
    if (r.state === 'excluded') { result.excluded++; continue; }
    if (r.state === 'error') { result.blockedErrors++; continue; }
    if (r.state === 'warning') result.warnings++;
    if (willCommitRow(r)) result.creates++;
    else result.skippedDuplicates++;
  }
  for (const d of decisions) {
    if (d.action === 'create') {
      (result.newEntities[d.entity] ??= []).push(d.inboundKey);
    } else {
      result.linkedEntities++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// CSV serialisation (register export — no external dependency needed to write)
// ---------------------------------------------------------------------------

export function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(r.map(csvEscape).join(','));
  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Source fingerprint (mapping memory key) — pure: caller supplies headers
// ---------------------------------------------------------------------------

/** Stable fingerprint of a source schema: normalised, sorted headers. Hash at the edge if needed. */
export function sourceFingerprint(headers: string[]): string {
  return headers.map(normaliseHeader).filter((h) => h !== '').sort().join('|');
}
