/**
 * Upload parsing — turns an uploaded CSV/TSV/XLSX/XLS buffer into sheets of raw cell
 * rows for the import engine. The only module that touches papaparse / SheetJS.
 * Header detection itself is pure (importEngine.detectHeaderRow).
 */
import Papa from 'papaparse';
import xlsx from 'xlsx';
import { detectHeaderRow } from './importEngine.js';

// Default-import + destructure: xlsx is CJS, and named ESM imports of its exports are
// not reliably detected by Node's cjs-module-lexer.
const { read: xlsxRead, utils: xlsxUtils } = xlsx;

export const MAX_ROWS = 50_000; // PRD Stage 0 ceiling
export const MAX_BYTES = 50 * 1024 * 1024;

export class ImportParseError extends Error {
  constructor(
    public code: 'unsupported_format' | 'too_large' | 'too_many_rows' | 'empty_file' | 'parse_failed',
    message: string,
  ) {
    super(message);
    this.name = 'ImportParseError';
  }
}

export interface ParsedSheet {
  name: string;
  headerRow: number;           // 0-based index within the sheet
  headers: string[];
  /** Data rows (after the header), each keyed by header text. Blank rows dropped. */
  records: Array<Record<string, string | number | null>>;
  droppedBlankRows: number;
}

export interface ParsedUpload {
  sheets: ParsedSheet[];
  totalRows: number;
}

function isCsvLike(filename: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(filename);
}

function isWorkbook(filename: string): boolean {
  return /\.(xlsx|xls|xlsm)$/i.test(filename);
}

export function parseUpload(filename: string, buf: Buffer): ParsedUpload {
  if (buf.length === 0) throw new ImportParseError('empty_file', 'The uploaded file is empty.');
  if (buf.length > MAX_BYTES) {
    throw new ImportParseError('too_large', `File exceeds the ${MAX_BYTES / (1024 * 1024)} MB ceiling.`);
  }

  let sheets: Array<{ name: string; matrix: (string | number | null)[][] }>;
  if (isCsvLike(filename)) {
    sheets = [{ name: 'Sheet1', matrix: parseCsvMatrix(buf, /\.tsv$/i.test(filename) ? '\t' : undefined) }];
  } else if (isWorkbook(filename)) {
    sheets = parseWorkbookMatrices(buf);
  } else {
    throw new ImportParseError('unsupported_format', `Unsupported file type: ${filename}. Use .xlsx, .xls, .csv or .tsv.`);
  }

  const parsed: ParsedSheet[] = [];
  let totalRows = 0;
  for (const s of sheets) {
    const sheet = toSheet(s.name, s.matrix);
    if (!sheet) continue;
    totalRows += sheet.records.length;
    parsed.push(sheet);
  }
  if (parsed.length === 0) throw new ImportParseError('empty_file', 'No data rows found in the file.');
  if (totalRows > MAX_ROWS) {
    throw new ImportParseError('too_many_rows', `File holds ${totalRows} rows; the ceiling is ${MAX_ROWS}.`);
  }
  return { sheets: parsed, totalRows };
}

function parseCsvMatrix(buf: Buffer, delimiter?: string): (string | number | null)[][] {
  // BOM + delimiter detection are papaparse defaults; values stay strings (no dynamic typing
  // so the engine controls all coercion deterministically).
  const text = buf.toString('utf8').replace(new RegExp('^\\uFEFF'), '');
  const result = Papa.parse<string[]>(text, {
    delimiter: delimiter ?? '',   // '' = auto-detect
    skipEmptyLines: false,
  });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new ImportParseError('parse_failed', `CSV parse failed: ${result.errors[0].message}`);
  }
  return result.data as (string | null)[][];
}

function parseWorkbookMatrices(buf: Buffer): Array<{ name: string; matrix: (string | number | null)[][] }> {
  let wb;
  try {
    wb = xlsxRead(buf, { type: 'buffer', cellDates: false });
  } catch (err) {
    throw new ImportParseError('parse_failed', `Workbook parse failed: ${(err as Error).message}`);
  }
  return wb.SheetNames.map((name) => ({
    name,
    matrix: xlsxUtils.sheet_to_json<(string | number | null)[]>(wb.Sheets[name], {
      header: 1,        // array-of-arrays
      raw: true,        // keep numbers (incl. Excel date serials) — engine parses them
      defval: null,
      blankrows: false,
    }),
  }));
}

function toSheet(name: string, matrix: (string | number | null)[][]): ParsedSheet | null {
  if (matrix.length === 0) return null;
  const headerRow = detectHeaderRow(matrix);
  const headerCells = matrix[headerRow] ?? [];
  const headers: string[] = headerCells.map((c, i) => {
    const t = c == null ? '' : String(c).trim();
    return t === '' ? `Column ${i + 1}` : t;
  });
  while (headers.length > 0 && headers[headers.length - 1].startsWith('Column ')) {
    const idx = headers.length - 1;
    const hasData = matrix.slice(headerRow + 1).some((r) => r[idx] != null && String(r[idx]).trim() !== '');
    if (hasData) break;
    headers.pop();
  }
  if (headers.length === 0) return null;

  const records: Array<Record<string, string | number | null>> = [];
  let droppedBlankRows = 0;
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const allBlank = headers.every((_, j) => row[j] == null || String(row[j]).trim() === '');
    if (allBlank) { droppedBlankRows++; continue; }
    const rec: Record<string, string | number | null> = {};
    headers.forEach((h, j) => {
      const v = row[j];
      rec[h] = v == null ? null : typeof v === 'number' ? v : String(v);
    });
    records.push(rec);
  }
  if (records.length === 0) return null;
  return { name, headerRow, headers, records, droppedBlankRows };
}
