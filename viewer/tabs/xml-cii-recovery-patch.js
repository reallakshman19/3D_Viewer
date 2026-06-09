import { isXmlCiiRigidNode } from '../converters/xml-cii2019-core/weight-match-model.js';

const INSTALL_FLAG = '__xmlCiiRecoveryPatch_v1';
const INPUT_SELECTOR = '[data-option-key="supportConfigJson"]';
const PRIMARY_FILE_SELECTOR = '#model-converters-primary-input';
const RAW_BASE = 'https://raw.githubusercontent.com/reallaksh19/3D_Viewer/main/';

const DEFAULT_PATHS = Object.freeze({
  pipingClassIndexPath: 'docs/Masters/SpecwisePipingClass/index.json',
  pipingClassShardFolder: 'docs/Masters/SpecwisePipingClass/',
});

function text(value) {
  return value == null ? '' : String(value);
}

function clean(value) {
  return text(value).trim();
}

function normalizeKey(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function read(row, keys) {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    const value = row[key] ?? row._raw?.[key];
    if (value !== undefined && value !== null && clean(value)) return clean(value);
  }
  return '';
}

function numericText(value) {
  const match = clean(value).match(/[-+]?\d*\.?\d+/);
  return match ? match[0] : clean(value);
}

function parseConfig(input) {
  try {
    const parsed = JSON.parse(input?.value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeConfigIfChanged(input, config) {
  if (!input || !config) return false;
  const next = JSON.stringify(config, null, 2);
  if (input.value === next) return false;
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function lineNoValue(row) {
  return read(row, ['lineNoKey', 'lineNo', 'lineKey', 'Line No', 'Line Number', 'PipelineReference', 'ColumnX1']);
}

function isHeaderishLineNoKey(value) {
  const key = normalizeKey(value);
  if (!key) return true;
  if (!/\d/.test(key)) return true;
  if (/^SERVICE(?:SERVICE)*LINE(?:NUMBER|NO)?$/.test(key)) return true;
  if (/^(LINE(?:NUMBER|NO)?|SERVICE|PIPINGCLASS|MATERIAL|FLUID|DENSITY|PHASE)$/.test(key)) return true;
  return false;
}

function isHeaderishLineListRow(row) {
  const key = lineNoValue(row);
  if (isHeaderishLineNoKey(key)) return true;
  const values = Object.values(row || {}).map((value) => normalizeKey(value)).filter(Boolean);
  const joined = values.join('|');
  if (/PIPINGCLASS|NOMINALPIPESIZE|DESIGNCONDITIONS|TESTPRESSURE|INSULATIONTHICKNESS/.test(joined) && !/\b[A-Z]{1,8}\d{3,}/.test(joined)) {
    return true;
  }
  return false;
}

function cleanupLineListRows(config) {
  const rows = Array.isArray(config?.linelist?.masterRows) ? config.linelist.masterRows : [];
  if (!rows.length) return false;
  const cleaned = rows.filter((row) => !isHeaderishLineListRow(row));
  if (cleaned.length === rows.length) return false;
  config.linelist.masterRows = cleaned;
  return true;
}

function masterPaths(config) {
  const existing = config?.masterPaths && typeof config.masterPaths === 'object' && !Array.isArray(config.masterPaths)
    ? config.masterPaths
    : {};
  return { ...DEFAULT_PATHS, ...existing };
}

function pathCandidates(path) {
  const p = clean(path).replace(/^\.\//, '');
  const out = [];
  if (!p) return out;
  out.push(p);
  if (!p.startsWith('../')) out.push(`../${p}`);
  if (!/^https?:\/\//i.test(p)) out.push(`${RAW_BASE}${p.replace(/^\.\.\//, '')}`);
  return [...new Set(out)];
}

async function fetchTextAny(path) {
  if (typeof fetch !== 'function') throw new Error('fetch unavailable');
  let last = '';
  for (const url of pathCandidates(path)) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        last = `${url}: ${response.status}`;
        continue;
      }
      return await response.text();
    } catch (error) {
      last = `${url}: ${error?.message || error}`;
    }
  }
  throw new Error(last || `Unable to fetch ${path}`);
}

function parseJsonText(raw) {
  const trimmed = clean(raw).replace(/^export\s+default\s+/i, '').replace(/;\s*$/g, '');
  return JSON.parse(trimmed || '{}');
}

function extractBranchNames(xmlText) {
  const source = text(xmlText);
  if (!source) return [];
  const out = [];
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      for (const node of [...doc.getElementsByTagName('Branchname')]) {
        const value = clean(node.textContent);
        if (value) out.push(value);
      }
    } catch {}
  }
  if (!out.length) {
    for (const match of source.matchAll(/<Branchname[^>]*>([\s\S]*?)<\/Branchname>/gi)) {
      const value = clean(match[1]);
      if (value) out.push(value);
    }
  }
  return [...new Set(out)];
}

function tokenAt(branchName, delimiter, oneBasedIndex) {
  const parts = text(branchName).split(delimiter || '-');
  const idx = Math.max(1, Number(oneBasedIndex || 1)) - 1;
  return clean(parts[idx] || '');
}

function deriveRequestedClass(branchName, config) {
  const rxText = clean(config?.rating?.pipingClassRegex);
  if (rxText) {
    try {
      const m = new RegExp(rxText, 'i').exec(branchName);
      const group = Math.max(0, Number(config?.rating?.pipingClassGroup || 1));
      if (m?.[group]) return clean(m[group]);
    } catch {}
  }
  return tokenAt(branchName, config?.rating?.tokenDelimiter || '-', config?.rating?.pipingClassTokenIndex || 5);
}

function matchedClassKeys(branchNames, index, config) {
  const classes = index?.classes && typeof index.classes === 'object' ? index.classes : {};
  const wanted = new Set();
  for (const branchName of branchNames) {
    const requested = normalizeKey(deriveRequestedClass(branchName, config));
    const branchNorm = normalizeKey(branchName);
    if (!requested && !branchNorm) continue;
    for (const [classKey, meta] of Object.entries(classes)) {
      const classNorm = normalizeKey(classKey);
      const tokens = Array.isArray(meta?.matchTokens) && meta.matchTokens.length ? meta.matchTokens : [classKey];
      const hit = tokens.some((token) => {
        const tok = normalizeKey(token);
        return tok && (requested.includes(tok) || tok.includes(requested) || branchNorm.includes(tok));
      });
      if (classNorm && hit) wanted.add(classKey);
    }
  }
  return [...wanted];
}

function normalizePipingRow(row, index = 0) {
  const cls = read(row, ['pipingClass', 'Piping Class', 'PIPING_CLASS', 'Class', 'SPEC', 'Spec']);
  return {
    ...row,
    _raw: row,
    _sourceRowIndex: row?._sourceRowIndex || row?._rowIndex || index + 1,
    pipingClass: cls,
    convertedBore: numericText(read(row, ['convertedBore', 'Converted Bore', 'DN', 'NB', 'Bore', 'NPS', 'Size'])),
    componentType: read(row, ['componentType', 'Component Type', 'COMPONENT_TYPE', 'Type', 'Item Type']),
    rating: read(row, ['rating', 'Rating', 'RATING', 'Class Rating', 'Pressure Class']),
    materialName: read(row, ['materialName', 'Material_Name', 'Material', 'MATERIAL', 'Material Name']),
    schedule: read(row, ['schedule', 'Schedule', 'SCHEDULE', 'SCH']),
    wallThickness: read(row, ['wallThickness', 'Wall Thickness', 'Wall thickness', 'WALL_THICKNESS', 'WT', 'WallThickness']),
    corrosion: read(row, ['corrosion', 'Corrosion', 'Corrosion Allowance', 'CORROSION_ALLOWANCE', 'CA']),
    endCondition: read(row, ['endCondition', 'End Condition', 'END_CONDITION', 'End Type']),
  };
}

function loadedClassKeys(config) {
  return new Set((Array.isArray(config?.pipingClass?.masterRows) ? config.pipingClass.masterRows : [])
    .map((row) => normalizeKey(read(row, ['pipingClass', 'Piping Class', 'Class'])))
    .filter(Boolean));
}

function hasOnlyPipingPlaceholder(config) {
  const rows = Array.isArray(config?.pipingClass?.masterRows) ? config.pipingClass.masterRows : [];
  return !rows.length || rows.every((row) => row?._smartMasterPlaceholder || normalizeKey(row?.pipingClass) === 'ONDEMAND');
}

async function ensurePipingClassShardsForXml(config, xmlFile) {
  if (!xmlFile || typeof xmlFile.text !== 'function') return false;
  const xmlText = await xmlFile.text();
  const branchNames = extractBranchNames(xmlText);
  if (!branchNames.length) return false;
  const paths = masterPaths(config);
  const index = parseJsonText(await fetchTextAny(paths.pipingClassIndexPath));
  const classKeys = matchedClassKeys(branchNames, index, config);
  if (!classKeys.length) return false;

  const loaded = loadedClassKeys(config);
  const missing = hasOnlyPipingPlaceholder(config) ? classKeys : classKeys.filter((key) => !loaded.has(normalizeKey(key)));
  if (!missing.length && !hasOnlyPipingPlaceholder(config)) return false;

  const folder = clean(paths.pipingClassShardFolder || index.shardBase || DEFAULT_PATHS.pipingClassShardFolder).replace(/\/?$/, '/');
  const rows = [];
  for (const key of classKeys) {
    const meta = index.classes?.[key] || {};
    const file = clean(meta.file || `${key}.json`);
    const shard = parseJsonText(await fetchTextAny(`${folder}${file}`));
    const shardRows = Array.isArray(shard?.rows) ? shard.rows : (Array.isArray(shard) ? shard : []);
    rows.push(...shardRows.map(normalizePipingRow));
  }
  if (!rows.length) return false;

  if (!config.pipingClass || typeof config.pipingClass !== 'object' || Array.isArray(config.pipingClass)) config.pipingClass = {};
  config.pipingClass.masterRows = rows;
  config.pipingClass.fieldMap = {
    pipingClass: 'pipingClass',
    convertedBore: 'convertedBore',
    componentType: 'componentType',
    rating: 'rating',
    materialName: 'materialName',
    schedule: 'schedule',
    wallThickness: 'wallThickness',
    corrosion: 'corrosion',
    endCondition: 'endCondition',
  };
  config.pipingClass._smartMode = 'specwise-index-shards';
  config.pipingClass._loadedClassKeys = classKeys;
  config.pipingClass._rowCount = rows.length;
  return true;
}

let busy = false;
let queued = false;

async function runRecovery() {
  if (busy) {
    queued = true;
    return;
  }
  busy = true;
  try {
    const input = document.querySelector(INPUT_SELECTOR);
    const primary = document.querySelector(PRIMARY_FILE_SELECTOR);
    const xmlFile = primary?.files?.[0] || null;
    const config = parseConfig(input);
    if (!input || !config) return;
    let changed = cleanupLineListRows(config);
    try {
      changed = (await ensurePipingClassShardsForXml(config, xmlFile)) || changed;
    } catch (error) {
      console.warn('XML->CII recovery: piping class shard load skipped:', error);
    }
    if (changed) writeConfigIfChanged(input, config);
  } finally {
    busy = false;
    if (queued) {
      queued = false;
      setTimeout(runRecovery, 50);
    }
  }
}

function scheduleRecovery() {
  setTimeout(runRecovery, 0);
}

export function installXmlCiiRecoveryPatch() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  // legacy-adapter.js has one old internal path that still calls this name
  // without importing it. Defining the global keeps 4 Diagnostics / 4A Weight
  // Match from failing while the canonical core export remains the source.
  globalThis.isXmlCiiRigidNode = isXmlCiiRigidNode;

  document.addEventListener('change', (event) => {
    if (event.target?.matches?.(`${INPUT_SELECTOR}, ${PRIMARY_FILE_SELECTOR}`)) scheduleRecovery();
  }, true);
  document.addEventListener('input', (event) => {
    if (event.target?.matches?.(INPUT_SELECTOR)) scheduleRecovery();
  }, true);
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-xml-cii-phase], [data-xml-cii-save-master], [data-xml-cii-master-tab]')) scheduleRecovery();
  }, true);
  scheduleRecovery();
}
