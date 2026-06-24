/**
 * Functionality: parses selected-geometry enrichment master files supplied from
 * the RVM UI. Parameters: browser File/text input plus master kind. Outputs:
 * frozen row arrays with source metadata. Fallback: empty files return no rows;
 * malformed JSON/CSV/XLSX raises an explicit parse error with the file name.
 */

import { freezeDeep, text } from './selected-geometry-shared.js';

const WORKBOOK_FILE_RE = /\.(xlsx|xlsm|xlsb|xls|ods)$/i;

export async function parseSelectedGeometryMasterFile(file, masterKind) {
  if (!file || (typeof file.text !== 'function' && typeof file.arrayBuffer !== 'function')) {
    throw new TypeError(`Master file is not readable for ${text(masterKind) || 'unknown master'}.`);
  }
  if (isWorkbookFileName(file.name)) {
    if (typeof file.arrayBuffer !== 'function') {
      throw new TypeError(`Workbook master file "${text(file.name)}" is not readable as binary data.`);
    }
    const rawBuffer = await file.arrayBuffer();
    const xlsxModule = await getXlsxModule();
    return parseSelectedGeometryMasterWorkbook(rawBuffer, file.name, masterKind, xlsxModule);
  }
  const rawText = await file.text();
  return parseSelectedGeometryMasterText(rawText, file.name, masterKind);
}

export function parseSelectedGeometryMasterWorkbook(rawBuffer, fileName, masterKind, xlsxModule) {
  const name = text(fileName);
  const kind = text(masterKind);
  const XLSX = xlsxModule;
  if (!XLSX?.read || !XLSX?.utils?.sheet_to_json) {
    throw new TypeError(`XLSX parser is not valid for workbook master file "${name}".`);
  }
  let workbook = null;
  try {
    workbook = XLSX.read(rawBuffer, { type: 'array', cellDates: false, raw: false });
  } catch (error) {
    throw new SyntaxError(`Cannot parse workbook master file "${name}": ${error?.message || error}`);
  }
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) {
    throw new SyntaxError(`Workbook master file "${name}" contains no readable sheets.`);
  }
  const firstSheetName = sheetNames[0];
  const worksheet = workbook.Sheets?.[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
    .map((row, index) => normalizeWorkbookRow(row, index));
  return freezeDeep({
    kind,
    fileName: name,
    format: 'workbook',
    version: `${name}#${firstSheetName}`,
    sheetName: firstSheetName,
    sheetNames,
    rows,
  });
}

export function parseSelectedGeometryMasterText(rawText, fileName, masterKind) {
  const name = text(fileName);
  const kind = text(masterKind);
  const body = String(rawText ?? '');
  if (!body.trim()) {
    return freezeDeep({ kind, fileName: name, format: 'empty', version: name, rows: [] });
  }
  if (isJsonFile(name, body)) {
    return parseJsonMaster(body, name, kind);
  }
  if (kind === 'materialMap') {
    const materialRows = parseMaterialMapTextRows(body);
    if (materialRows.length) {
      return freezeDeep({
        kind,
        fileName: name,
        format: 'material-map-text',
        version: name,
        rows: materialRows,
      });
    }
  }
  const delimiter = detectDelimiter(name, body);
  const rows = parseDelimitedRows(body, delimiter);
  return freezeDeep({
    kind,
    fileName: name,
    format: delimiter === '\t' ? 'tsv' : 'csv',
    version: name,
    rows,
  });
}

function isWorkbookFileName(fileName) {
  return WORKBOOK_FILE_RE.test(text(fileName));
}

async function getXlsxModule() {
  const host = typeof window === 'undefined' ? globalThis : window;
  if (host?.XLSX) return host.XLSX;
  try {
    return await import('xlsx');
  } catch {}
  try {
    return await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  } catch (error) {
    throw new Error(`XLSX parser is not available for selected-geometry master import: ${error?.message || error}`);
  }
}

function normalizeWorkbookRow(row, index) {
  const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
  return { _rowIndex: index + 1, ...source };
}

export function parseDelimitedRows(rawText, delimiter) {
  const records = parseDelimitedRecords(rawText, delimiter);
  const header = records[0] || [];
  const columns = header.map((value, index) => text(value) || `column_${index + 1}`);
  if (!columns.length) return freezeDeep([]);
  const rows = records.slice(1)
    .filter((record) => record.some((value) => text(value)))
    .map((record) => rowFromRecord(columns, record));
  return freezeDeep(rows);
}

function isJsonFile(fileName, rawText) {
  const lowerName = text(fileName).toLowerCase();
  const trimmed = String(rawText ?? '').trim();
  return lowerName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');
}

function parseJsonMaster(rawText, fileName, masterKind) {
  let documentValue = null;
  try {
    documentValue = JSON.parse(rawText);
  } catch (error) {
    throw new SyntaxError(`Cannot parse JSON master file "${fileName}": ${error?.message || error}`);
  }
  const rows = rowsFromJsonDocument(documentValue);
  return freezeDeep({
    kind: text(masterKind),
    fileName: text(fileName),
    format: 'json',
    version: text(documentValue?.version || documentValue?.metadata?.version || fileName),
    rows,
  });
}

function parseMaterialMapTextRows(rawText) {
  const rows = [];
  for (const line of String(rawText ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s+(.+?)\s*$/);
    if (!match) continue;
    if (/^code$/i.test(match[1]) || /^material$/i.test(match[1])) continue;
    rows.push({ code: match[1], material: match[2] });
  }
  return rows;
}

function rowsFromJsonDocument(documentValue) {
  if (Array.isArray(documentValue)) return documentValue.map(normalizeJsonRow);
  if (!documentValue || typeof documentValue !== 'object') return [];
  for (const key of ['rows', 'masterRows', 'mapRows', 'data', 'items', 'records']) {
    const value = documentValue[key];
    if (Array.isArray(value)) return value.map(normalizeJsonRow);
  }
  return [normalizeJsonRow(documentValue)];
}

function normalizeJsonRow(row) {
  if (row && typeof row === 'object' && !Array.isArray(row)) return { ...row };
  return { value: row };
}

function detectDelimiter(fileName, rawText) {
  const lowerName = text(fileName).toLowerCase();
  if (lowerName.endsWith('.tsv') || lowerName.endsWith('.tab')) return '\t';
  const firstLine = String(rawText ?? '').split(/\r?\n/, 1)[0] || '';
  const tabs = countChars(firstLine, '\t');
  const commas = countChars(firstLine, ',');
  return tabs > commas ? '\t' : ',';
}

function countChars(value, needle) {
  let count = 0;
  for (const char of String(value ?? '')) {
    if (char === needle) count += 1;
  }
  return count;
}

function parseDelimitedRecords(rawText, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  const source = String(rawText ?? '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      record.push(field);
      field = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      record.push(field);
      records.push(record);
      field = '';
      record = [];
      if (char === '\r' && next === '\n') index += 1;
      continue;
    }
    field += char;
  }
  if (quoted) throw new SyntaxError('Delimited master file has an unterminated quoted field.');
  record.push(field);
  if (record.some((value) => text(value))) records.push(record);
  return records;
}

function rowFromRecord(columns, record) {
  const row = {};
  for (let index = 0; index < columns.length; index += 1) {
    row[columns[index]] = record[index] === undefined ? '' : record[index];
  }
  return row;
}
