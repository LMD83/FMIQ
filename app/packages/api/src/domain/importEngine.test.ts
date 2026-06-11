import { describe, expect, it } from 'vitest';
import {
  computeDryRun, detectHeaderRow, extractHierarchy, findDuplicates, matchEntity,
  normaliseAndValidate, parseDateValue, parseNumberValue, PLACEHOLDER_FLOOR,
  sourceFingerprint, suggestMappings, toCsv, willCommitRow,
} from './importEngine.js';

const TODAY = '2026-06-11';

// ---------------------------------------------------------------------------
// Mapping suggestion — exact > remembered > fuzzy, with confidence + provenance
// ---------------------------------------------------------------------------

describe('suggestMappings', () => {
  it('maps exact canonical names and synonyms with confidence 1', () => {
    const [name, serial, make] = suggestMappings(['Name', 'Serial Number', 'Make']);
    expect(name).toMatchObject({ targetField: 'name', confidence: 1, provenance: 'exact' });
    expect(serial).toMatchObject({ targetField: 'serial_no', provenance: 'exact' });
    expect(make).toMatchObject({ targetField: 'manufacturer', provenance: 'exact' });
  });

  it('ignores case, punctuation and whitespace in headers', () => {
    const [s] = suggestMappings(['  ASSET__NAME!! ']);
    expect(s).toMatchObject({ targetField: 'name', provenance: 'exact' });
  });

  it('prefers remembered mappings over fuzzy ones', () => {
    const [s] = suggestMappings(['Plant Description'], { 'plant description': 'name' });
    expect(s).toMatchObject({ targetField: 'name', confidence: 0.95, provenance: 'remembered' });
  });

  it('fuzzy-matches near-miss headers with conventional FM vocabulary', () => {
    const [cond] = suggestMappings(['Conditon Rating']); // typo
    expect(cond.targetField).toBe('condition_grade');
    expect(cond.provenance).toBe('fuzzy');
    expect(cond.confidence).toBeGreaterThanOrEqual(0.72);
    expect(cond.confidence).toBeLessThanOrEqual(0.9);
  });

  it('leaves unrecognisable headers unmapped — never silently maps', () => {
    const [s] = suggestMappings(['Zebra Quotient']);
    expect(s).toMatchObject({ targetField: null, confidence: 0, provenance: 'none' });
  });

  it('never assigns two columns to the same target — lower confidence demoted', () => {
    const out = suggestMappings(['Asset Name', 'Asset Nam']); // exact + fuzzy to same target
    const mapped = out.filter((s) => s.targetField === 'name');
    expect(mapped).toHaveLength(1);
    expect(mapped[0].sourceColumn).toBe('Asset Name');
    expect(out.find((s) => s.sourceColumn === 'Asset Nam')!.targetField).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Header-row detection — junk rows above the header
// ---------------------------------------------------------------------------

describe('detectHeaderRow', () => {
  it('skips junk rows above the real header', () => {
    const rows = [
      ['Survey of Plant — Collins Barracks', null, null, null],
      [null, null, null, null],
      ['Asset Name', 'Serial Number', 'Condition', 'Room'],
      ['AHU-01', 'SN123', 'B', '1.04'],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it('returns 0 for a clean file', () => {
    expect(detectHeaderRow([['Name', 'Room'], ['AHU', '1.01']])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Validation — errors block, warnings pass (PRD §1.2)
// ---------------------------------------------------------------------------

describe('normaliseAndValidate', () => {
  const base = { name: 'AHU 1', site: 'Kildare St' };

  it('passes a clean row as valid', () => {
    const r = normaliseAndValidate({ ...base, condition_grade: 'B', install_date: '2019-03-01' }, [], { today: TODAY });
    expect(r.state).toBe('valid');
    expect(r.values).toMatchObject({ name: 'AHU 1', condition_grade: 'B', install_date: '2019-03-01' });
  });

  it('blocks rows missing the asset name', () => {
    const r = normaliseAndValidate({ name: '', site: 'X' }, [], { today: TODAY });
    expect(r.state).toBe('error');
    expect(r.issues).toContainEqual(expect.objectContaining({ code: 'required', field: 'name' }));
  });

  it('blocks rows missing a location anchor (site or building)', () => {
    const r = normaliseAndValidate({ name: 'AHU' }, [], { today: TODAY });
    expect(r.state).toBe('error');
    expect(r.issues).toContainEqual(expect.objectContaining({ code: 'location_anchor_required' }));
  });

  it('accepts building as the location anchor', () => {
    const r = normaliseAndValidate({ name: 'AHU', building: 'Main Block' }, [], { today: TODAY });
    expect(r.state).toBe('valid');
  });

  it('maps enum values through value maps (1-5 → A-D, RAG → tiers)', () => {
    const r = normaliseAndValidate(
      { ...base, condition_grade: '2', criticality: 'Red' },
      [
        { targetField: 'condition_grade', sourceValue: '2', mappedValue: 'B' },
        { targetField: 'criticality', sourceValue: 'red', mappedValue: 'critical' },
      ],
      { today: TODAY },
    );
    expect(r.state).toBe('valid');
    expect(r.values).toMatchObject({ condition_grade: 'B', criticality: 'critical' });
  });

  it('warns (never silently nulls) on unmapped enum values', () => {
    const r = normaliseAndValidate({ ...base, condition_grade: 'Good' }, [], { today: TODAY });
    expect(r.state).toBe('warning');
    expect(r.values['condition_grade']).toBeNull();
    expect(r.issues).toContainEqual(expect.objectContaining({ code: 'unmapped_value', severity: 'warning' }));
  });

  it('treats sentinels as blank with a warning, counted and reported', () => {
    const r = normaliseAndValidate({ ...base, serial_no: 'N/A', model: 'TBC' }, [], { today: TODAY });
    expect(r.state).toBe('warning');
    expect(r.values['serial_no']).toBeNull();
    expect(r.issues.filter((i) => i.code === 'sentinel')).toHaveLength(2);
  });

  it('blocks unparseable dates and future install dates', () => {
    const bad = normaliseAndValidate({ ...base, install_date: 'sometime' }, [], { today: TODAY });
    expect(bad.state).toBe('error');
    expect(bad.issues).toContainEqual(expect.objectContaining({ code: 'invalid_date' }));
    const future = normaliseAndValidate({ ...base, install_date: '2031-01-01' }, [], { today: TODAY });
    expect(future.state).toBe('error');
    expect(future.issues).toContainEqual(expect.objectContaining({ code: 'date_in_future' }));
  });

  it('strips units from numbers with a warning and blocks negative costs', () => {
    const r = normaliseAndValidate({ ...base, replacement_cost: '€12,500 approx' }, [], { today: TODAY });
    expect(r.state).toBe('warning');
    expect(r.values['replacement_cost']).toBe(12500);
    const neg = normaliseAndValidate({ ...base, replacement_cost: '-500' }, [], { today: TODAY });
    expect(neg.state).toBe('error');
    expect(neg.issues).toContainEqual(expect.objectContaining({ code: 'negative_cost' }));
  });
});

describe('parseDateValue', () => {
  it('defaults DD/MM for ambiguous dates (IE/UK)', () => {
    expect(parseDateValue('04/03/2021')).toBe('2021-03-04');
  });
  it('detects day-first when unambiguous regardless of default', () => {
    expect(parseDateValue('25/12/2020')).toBe('2020-12-25');
    expect(parseDateValue('12/25/2020')).toBe('2020-12-25');
  });
  it('parses ISO and Excel serial dates', () => {
    expect(parseDateValue('2019-03-01')).toBe('2019-03-01');
    expect(parseDateValue(44197)).toBe('2021-01-01'); // Excel serial for 2021-01-01
  });
  it('rejects nonsense', () => {
    expect(parseDateValue('32/13/2020')).toBeNull();
    expect(parseDateValue('soon')).toBeNull();
  });
});

describe('parseNumberValue', () => {
  it('handles units-in-values ("450 kW", "1,200 ltrs")', () => {
    expect(parseNumberValue('450 kW')).toEqual({ value: 450, strippedUnit: 'kW' });
    expect(parseNumberValue('1,200 ltrs')).toEqual({ value: 1200, strippedUnit: 'ltrs' });
  });
  it('handles currency and plain numbers', () => {
    expect(parseNumberValue('€2,500.50').value).toBe(2500.5);
    expect(parseNumberValue(42)).toEqual({ value: 42, strippedUnit: null });
  });
  it('rejects non-numeric text', () => {
    expect(parseNumberValue('lots').value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dedupe — exact keys: asset tag; serial + model
// ---------------------------------------------------------------------------

describe('findDuplicates', () => {
  it('groups within-file duplicates by asset tag — never silently dropped', () => {
    const groups = findDuplicates(
      [
        { rowId: 'r1', assetTag: 'TAG-1' },
        { rowId: 'r2', assetTag: 'tag-1 ' }, // case/space-insensitive
        { rowId: 'r3', assetTag: 'TAG-2' },
      ],
      [],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ keyKind: 'asset_tag', kind: 'within_file', rowIds: ['r1', 'r2'] });
  });

  it('matches inbound rows against existing register assets on serial+model', () => {
    const groups = findDuplicates(
      [{ rowId: 'r1', serialNo: 'SN-9', model: 'X200' }],
      [{ assetId: 'a1', serialNo: 'sn-9', model: 'x200' }],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ keyKind: 'serial_model', kind: 'existing', existingAssetIds: ['a1'] });
  });

  it('same serial but different model is NOT a serial+model duplicate', () => {
    const groups = findDuplicates(
      [{ rowId: 'r1', serialNo: 'SN-9', model: 'X200' }],
      [{ assetId: 'a1', serialNo: 'SN-9', model: 'Y300' }],
    );
    expect(groups).toHaveLength(0);
  });

  it('flags groups that are both within-file and vs-existing', () => {
    const groups = findDuplicates(
      [{ rowId: 'r1', assetTag: 'T1' }, { rowId: 'r2', assetTag: 'T1' }],
      [{ assetId: 'a1', assetTag: 'T1' }],
    );
    expect(groups[0].kind).toBe('both');
  });

  it('ignores blank keys', () => {
    expect(findDuplicates(
      [{ rowId: 'r1', assetTag: '' }, { rowId: 'r2', assetTag: null }],
      [],
    )).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Hierarchy extraction + entity matching
// ---------------------------------------------------------------------------

describe('extractHierarchy', () => {
  it('emits distinct entities in dependency order with pipe keys', () => {
    const out = extractHierarchy([
      { site: 'Kildare St', building: 'Main', floor: 'L1', space: 'Rm 1.04' },
      { site: 'Kildare St', building: 'Main', floor: 'L1', space: 'Rm 1.05' },
    ]);
    expect(out.map((e) => e.entity)).toEqual(['site', 'building', 'floor', 'space', 'space']);
    expect(out[3].inboundKey).toBe('Kildare St|Main|L1|Rm 1.04');
  });

  it('inserts a placeholder floor when a space arrives without one (PRD D5)', () => {
    const out = extractHierarchy([{ site: 'S', building: 'B', space: 'Rm 9' }]);
    const floor = out.find((e) => e.entity === 'floor');
    expect(floor?.name).toBe(PLACEHOLDER_FLOOR);
    expect(out.find((e) => e.entity === 'space')?.inboundKey).toBe(`S|B|${PLACEHOLDER_FLOOR}|Rm 9`);
  });

  it('uses the building as the site for building-only files', () => {
    const out = extractHierarchy([{ building: 'Collins Barracks' }]);
    expect(out.find((e) => e.entity === 'site')?.name).toBe('Collins Barracks');
  });
});

describe('matchEntity', () => {
  const existing = [{ id: 'x', name: 'Collins Barracks' }, { id: 'y', name: 'Turlough Park' }];
  it('links exact matches with confidence 1', () => {
    expect(matchEntity('collins barracks', existing)).toMatchObject({ action: 'link', linkedId: 'x', confidence: 1 });
  });
  it('links close fuzzy matches above threshold', () => {
    const m = matchEntity('Collins Barracs', existing);
    expect(m.action).toBe('link');
    expect(m.linkedId).toBe('x');
  });
  it('proposes create for unknown names — no silent taxonomy creation', () => {
    expect(matchEntity('Merrion Street', existing).action).toBe('create');
  });
});

// ---------------------------------------------------------------------------
// Dry-run diff — same gate as commit (AC3: dry-run counts == commit counts)
// ---------------------------------------------------------------------------

describe('computeDryRun / willCommitRow', () => {
  it('counts creates, skips, blocked errors, excluded and warnings', () => {
    const result = computeDryRun(
      [
        { state: 'valid', resolution: null },
        { state: 'warning', resolution: null },
        { state: 'valid', resolution: { action: 'skip' } },
        { state: 'error', resolution: null },
        { state: 'excluded', resolution: null },
      ],
      [
        { entity: 'site', inboundKey: 'Kildare St', action: 'create' },
        { entity: 'building', inboundKey: 'Kildare St|Main', action: 'link' },
      ],
    );
    expect(result).toMatchObject({
      creates: 2, skippedDuplicates: 1, blockedErrors: 1, excluded: 1, warnings: 1, linkedEntities: 1,
    });
    expect(result.newEntities).toEqual({ site: ['Kildare St'] });
  });

  it('willCommitRow gates exactly like the dry-run counts', () => {
    expect(willCommitRow({ state: 'valid', resolution: null })).toBe(true);
    expect(willCommitRow({ state: 'warning', resolution: { action: 'create' } })).toBe(true);
    expect(willCommitRow({ state: 'valid', resolution: { action: 'skip' } })).toBe(false);
    expect(willCommitRow({ state: 'error', resolution: null })).toBe(false);
    expect(willCommitRow({ state: 'excluded', resolution: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CSV + fingerprint helpers
// ---------------------------------------------------------------------------

describe('toCsv', () => {
  it('escapes quotes, commas and newlines', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"'], [null, 2]]);
    expect(csv).toBe('a,b\r\n"x,y","he said ""hi"""\r\n,2\r\n');
  });
});

describe('sourceFingerprint', () => {
  it('is order- and case-insensitive over headers', () => {
    expect(sourceFingerprint(['Name', 'Room'])).toBe(sourceFingerprint(['room', ' NAME ']));
    expect(sourceFingerprint(['Name'])).not.toBe(sourceFingerprint(['Room']));
  });
});
