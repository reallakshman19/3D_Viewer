import { CONVERTER_DEFINITIONS } from './model-converters/definitions.js';
import { getDefaultValuesForConverter } from './model-converters/defaults.js';
import { modelConverterState } from './model-converters/state.js';
import { buildBaseLayout } from './model-converters/layout.js';
import { renderConverterTabs } from './model-converters/tabs.js';
import { setupDropZone, wireInput } from './model-converters/file-handling.js';
import { renderOptionsPanel, renderInputGroups } from './model-converters/options.js';
import { createRunner } from './model-converters/runner.js';
import { loadStoredState, saveStoredState } from './model-converters/storage.js';
import { notify } from '../diagnostics/notification-center.js';
import { exportTableToXlsx } from './model-converters/excel-exporter.js';
import {
  buildLineListFromRows,
  computeLineNoKey,
  detectLineListFieldMap,
  mapMaterialTextToCiiCode,
  detectProcessFields,
  cleanMaterialText,
  cleanMaterialCode,
} from '../converters/xml-cii2019-core/linelist-mapping.js';
import { parseXmlCiiEnrichmentConfig, migrateXmlCiiSupportConfigJson } from '../converters/xml-cii2019-core/config.js';
import { buildPipingClassIndex, findBestPipingClassRow } from '../converters/xml-cii2019-core/piping-class-resolver.js';
import { enrichXmlForCii2019 } from './model-converters/converters/xmltocii2019_helper/enrichment-core.js';
import { xmlCiiRenderRegexPhase, bindXmlCiiRegexPhase } from './model-converters/converters/xmltocii2019_helper/regex-editor.js';
import { xmlCiiRenderPreviewPhase, xmlCiiBuildAndRenderPreview as xmlCiiBuildAndRenderPreviewImported } from './model-converters/converters/xmltocii2019_helper/preview-renderer.js';
import { xmlCiiRenderWeightMatchPhase, bindXmlCiiWeightMatchPhase } from './model-converters/converters/xmltocii2019_helper/weight-match-renderer.js';
import { applyXmlCiiRigidWeightOverrides } from '../converters/xml-cii2019-core/weight-match-model.js';
import { WorkflowModal } from './model-converters/shared/WorkflowModal.js';
import { updateProgress } from './model-converters/shared/progress-utils.js';
import { renderWorkflowTable } from './model-converters/shared/table-renderer.js';
import { renderDiagnostics } from './model-converters/shared/diagnostics-panel.js';
import { css } from './model-converters/styles.js';

const XML_CII_STORAGE_MASTER_ARRAY_PATHS = Object.freeze([
  ['linelist', 'masterRows'],
  ['pipingClass', 'masterRows'],
  ['material', 'mapRows'],
  ['weight', 'masterRows'],
]);

// Backward-compatible alias used by the compact XML->CII Config editor.
// Keep this module-local so the Config tab cannot fail with a ReferenceError if
// storage internals are changed or tree-shaken.
const STORAGE_MASTER_ARRAY_PATHS = XML_CII_STORAGE_MASTER_ARRAY_PATHS;

function _toText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function _escape(value) {
  return _toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
}

function _escapeAttr(value) {
  return _escape(value).replace(/'/g, '&#39;');
}

function _decodeTextUtf8(bytes) {
  if (!bytes) return '';
  try {
    if (bytes instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(bytes);
    if (ArrayBuffer.isView(bytes)) return new TextDecoder('utf-8').decode(bytes);
  } catch {}
  return _toText(bytes);
}

function _encodeTextUtf8(text) {
  return new TextEncoder().encode(_toText(text)).buffer;
}

function _bytesToBase64(bytes) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function _base64ToBytes(base64) {
  const binary = atob(base64 || '');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

function _baseNameWithoutExtension(name) {
  const safe = _toText(name).split(/[\\/]/).pop() || 'output';
  return safe.replace(/\.[^.]+$/, '') || 'output';
}

function _downloadText(name, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([_toText(text)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function _downloadBlob(name, bytes, mime = 'application/octet-stream') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download.bin';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function _formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function _guessMimeFromName(name) {
  const lower = _toText(name).toLowerCase();
  if (lower.endsWith('.cii')) return 'text/plain;charset=utf-8';
  if (lower.endsWith('.xml')) return 'text/xml;charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json;charset=utf-8';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

function _isTextLikeOutput(output) {
  const name = _toText(output?.name).toLowerCase();
  const mime = _toText(output?.mime).toLowerCase();
  return !!output?.text || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || name.endsWith('.cii') || name.endsWith('.txt') || name.endsWith('.xml') || name.endsWith('.json');
}

function _jsonClone(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function _normalizeCsvCell(value) {
  return _toText(value).trim();
}

function _parseDelimitedRows(text, delimiter = ',') {
  const source = _toText(text).replace(/^\uFEFF/, '');
  if (!source.trim()) return [];
  const rows = [];
  let cell = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      row.push(_normalizeCsvCell(cell));
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(_normalizeCsvCell(cell));
      cell = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(_normalizeCsvCell(cell));
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

function _rowsToObjects(rows) {
  if (!rows.length) return [];
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const headers = rows[0].map((h, idx) => _normalizeHeader(h) || `ColumnX${idx + 1}`);
  while (headers.length < maxCols) headers.push(`ColumnX${headers.length + 1}`);
  const uniqueHeaders = [];
  const seen = new Map();
  for (const header of headers) {
    const base = header || `ColumnX${uniqueHeaders.length + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    uniqueHeaders.push(count ? `${base}_${count + 1}` : base);
  }
  return rows.slice(1).map((row) => {
    const obj = {};
    uniqueHeaders.forEach((h, idx) => { obj[h] = row[idx] ?? ''; });
    return obj;
  });
}

function _normalizeHeader(value) {
  return _toText(value).trim().replace(/\s+/g, ' ');
}

function _parseJsonRows(text) {
  const parsed = JSON.parse(_toText(text) || '[]');
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (parsed && typeof parsed === 'object') {
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value) && value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return value;
    }
  }
  return [];
}
