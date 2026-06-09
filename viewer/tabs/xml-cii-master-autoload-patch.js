import { isXmlCiiRigidNode } from '../converters/xml-cii2019-core/weight-match-model.js';
import { notify } from '../diagnostics/notification-center.js';

const FLAG = '__xmlCiiDefaultMasterAutoload_v7_stable';
const FETCH_PATCH_FLAG = '__xmlCiiDefaultMasterFetchFallback_v5_stable';
const INPUT_SELECTOR = '[data-option-key="supportConfigJson"]';
const STATUS_ID = 'xml-cii-master-autoload-status';
const PATH_PANEL_ID = 'xml-cii-master-paths-panel';
const RAW_BASE = 'https://raw.githubusercontent.com/reallaksh19/3D_Viewer/main/';

const DEFAULT_MASTER_PATHS = Object.freeze({
  materialMapPath: 'docs/Masters/PCF_MAT_MAP.TXT',
  weightPath: 'docs/Masters/wtValveweights.json',
  pipingClassIndexPath: 'docs/Masters/SpecwisePipingClass/index.json',
  pipingClassIndexCompatPath: 'docs/Masters/SpecwisePipingClass/index.js',
  pipingClassShardFolder: 'docs/Masters/SpecwisePipingClass/',
  legacyPipingMasterPath: 'docs/Masters/Piping_class_master.json',
});

const PIPING_PLACEHOLDER_ROW = Object.freeze({
  _smartMasterPlaceholder: true,
  pipingClass: '__ON_DEMAND__',
  convertedBore: '',
  wallThickness: '',
  materialName: '',
  rating: '',
  corrosion: '',
  schedule: '',
});

const MASTER_SOURCES = Object.freeze({
  pipingClass: Object.freeze({
    title: 'Piping Class',
    sectionKey: 'pipingClass',
    rowsKey: 'masterRows',
    fieldMapKey: 'fieldMap',
    pathKey: 'pipingClassIndexPath',
    aliases: Object.freeze({
      pipingClass: Object.freeze(['Piping Class', 'PIPING_CLASS', 'Class', 'SPEC', 'Spec', 'pipingClass']),
      convertedBore: Object.freeze(['convertedBore', 'Converted Bore', 'Size', 'DN', 'NB', 'Bore', 'NPS']),
      componentType: Object.freeze(['Component Type', 'COMPONENT_TYPE', 'Type', 'Item Type', 'componentType']),
      rating: Object.freeze(['Rating', 'RATING', 'Pressure Class', 'Class Rating', 'rating']),
      materialName: Object.freeze(['Material_Name', 'Material', 'MATERIAL', 'Material Name', 'materialName']),
      schedule: Object.freeze(['Schedule', 'SCHEDULE', 'SCH', 'schedule']),
      wallThickness: Object.freeze(['Wall Thickness', 'WALL_THICKNESS', 'WT', 'WallThickness', 'wallThickness']),
      corrosion: Object.freeze(['Corrosion', 'Corrosion Allowance', 'CORROSION_ALLOWANCE', 'CA', 'corrosion']),
      endCondition: Object.freeze(['End Condition', 'END_CONDITION', 'End Type', 'endCondition']),
    }),
    canonicalFieldMap: Object.freeze({
      pipingClass: 'pipingClass',
      convertedBore: 'convertedBore',
      componentType: 'componentType',
      rating: 'rating',
      materialName: 'materialName',
      schedule: 'schedule',
      wallThickness: 'wallThickness',
      corrosion: 'corrosion',
      endCondition: 'endCondition',
    }),
  }),
  material: Object.freeze({
    title: 'Material Map',
    sectionKey: 'material',
    rowsKey: 'mapRows',
    fieldMapKey: 'fieldMap',
    pathKey: 'materialMapPath',
    aliases: Object.freeze({
      code: Object.freeze(['code', 'Code', 'Material Code', 'MATERIAL_CODE', 'CA3']),
      material: Object.freeze(['material', 'Material', 'Material_Name', 'Description', 'Name']),
      spec: Object.freeze(['Spec', 'Specification']),
    }),
    canonicalFieldMap: Object.freeze({ code: 'code', material: 'material', spec: 'spec' }),
  }),
  weight: Object.freeze({
    title: 'Weights / Valve CA8',
    sectionKey: 'weight',
    rowsKey: 'masterRows',
    fieldMapKey: 'fieldMap',
    pathKey: 'weightPath',
    aliases: Object.freeze({
      bore: Object.freeze(['bore', 'convertedBore', 'Converted Bore', 'Size (NPS)', 'Size', 'NPS', 'NS', 'DN', 'NB', 'Bore']),
      rating: Object.freeze(['rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']),
      length: Object.freeze(['length', 'Length (RF-F/F)', 'RF-F/F', 'Length', 'LEN', 'Face To Face', 'faceToFace']),
      valveType: Object.freeze(['valveType', 'Type Description', 'TypeDesc', 'Valve Type', 'Type', 'Description']),
      weight: Object.freeze(['weight', 'RF/RTJ KG', 'Valve Weight', 'Weight', 'valveWeight']),
    }),
    canonicalFieldMap: Object.freeze({
      bore: 'bore',
      rating: 'rating',
      length: 'length',
      valveType: 'valveType',
      weight: 'weight',
    }),
  }),
});

function isBrowserReady() {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && typeof location !== 'undefined';
}

function text(value) {
  return value == null ? '' : String(value);
}

function clean(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function esc(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rowCount(section, source) {
  const rows = source?.[section.rowsKey];
  return Array.isArray(rows) ? rows.length : 0;
}

function parseConfig(input) {
  try {
    const cfg = JSON.parse(input.value || '{}');
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  } catch {
    return null;
  }
}

function ensureSection(config, section) {
  const key = section.sectionKey;
  if (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key])) config[key] = {};
  if (!config[key][section.fieldMapKey] || typeof config[key][section.fieldMapKey] !== 'object' || Array.isArray(config[key][section.fieldMapKey])) {
    config[key][section.fieldMapKey] = {};
  }
  return config[key];
}

function masterPaths(config) {
  const existing = config.masterPaths && typeof config.masterPaths === 'object' && !Array.isArray(config.masterPaths)
    ? config.masterPaths
    : {};
  return { ...DEFAULT_MASTER_PATHS, ...existing };
}

function saveMasterPath(config, key, value) {
  if (!config.masterPaths || typeof config.masterPaths !== 'object' || Array.isArray(config.masterPaths)) config.masterPaths = {};
  config.masterPaths[key] = clean(value) || DEFAULT_MASTER_PATHS[key] || '';
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[_\-/()."'°]/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitPipeSegments(value) {
  return text(value).split(/\s*\|\s*/g).map((segment) => segment.trim()).filter(Boolean);
}

function scoreHeader(header, aliases) {
  const segments = splitPipeSegments(header);
  const candidates = segments.length > 1 ? segments : [header];
  let best = 0;
  for (const candidate of candidates) {
    const h = normalizeHeader(candidate);
    if (!h) continue;
    for (const alias of aliases || []) {
      const a = normalizeHeader(alias);
      if (!a) continue;
      if (h === a) best = Math.max(best, 100);
      else if (h.includes(a) || a.includes(h)) best = Math.max(best, 82);
      else {
        const hTokens = new Set(h.split(' ').filter(Boolean));
        const aTokens = a.split(' ').filter(Boolean);
        const hits = aTokens.filter((token) => hTokens.has(token)).length;
        if (hits) best = Math.max(best, Math.round((hits / aTokens.length) * 70));
      }
    }
  }
  return best;
}

function headersFromRows(rows) {
  const headers = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows.slice(0, 50) : []) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers;
}

function autoFieldMap(rows, section, existingMap = {}) {
  const usableRows = (rows || []).filter((row) => !row?._smartMasterPlaceholder);
  const headers = headersFromRows(usableRows.length ? usableRows : rows);
  const next = { ...(existingMap || {}) };
  const claimed = new Set(Object.values(next).filter(Boolean));

  for (const [fieldName, aliases] of Object.entries(section.aliases || {})) {
    if (next[fieldName]) continue;
    let bestHeader = '';
    let bestScore = 0;
    for (const header of headers) {
      if (claimed.has(header)) continue;
      const score = scoreHeader(header, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }
    if (bestScore >= 70 && bestHeader) {
      next[fieldName] = bestHeader;
      claimed.add(bestHeader);
    }
  }
  return next;
}

function rawValue(row, keys) {
  if (!row) return '';
  for (const key of keys || []) {
    if (!key) continue;
    const value = row[key] ?? row._raw?.[key];
    if (value != null && clean(value) !== '') return clean(value);
  }
  return '';
}

function numericText(value) {
  const match = clean(value).match(/[-+]?\d*\.?\d+/);
  return match ? match[0] : '';
}

function normalizePipingRow(row, index = 0) {
  return {
    ...row,
    _raw: row,
    _sourceRowIndex: row?._sourceRowIndex || row?._rowIndex || index + 1,
    pipingClass: rawValue(row, ['pipingClass', 'Piping Class', 'PIPING_CLASS', 'Class', 'SPEC', 'Spec']),
    convertedBore: rawValue(row, ['convertedBore', 'Converted Bore', 'DN', 'NB', 'Bore', 'NPS', 'Size']),
    componentType: rawValue(row, ['componentType', 'Component Type', 'COMPONENT_TYPE', 'Type', 'Item Type']),
    rating: rawValue(row, ['rating', 'Rating', 'RATING', 'Class Rating', 'Pressure Class']),
    materialName: rawValue(row, ['materialName', 'Material_Name', 'Material', 'MATERIAL', 'Material Name']),
    schedule: rawValue(row, ['schedule', 'Schedule', 'SCHEDULE', 'SCH']),
    wallThickness: rawValue(row, ['wallThickness', 'Wall Thickness', 'WALL_THICKNESS', 'WT', 'WallThickness']),
    corrosion: rawValue(row, ['corrosion', 'Corrosion', 'Corrosion Allowance', 'CORROSION_ALLOWANCE', 'CA']),
    endCondition: rawValue(row, ['endCondition', 'End Condition', 'END_CONDITION', 'End Type']),
  };
}

function normalizeWeightRow(row, index = 0) {
  const bore = rawValue(row, ['bore', 'convertedBore', 'Converted Bore', 'DN', 'NB', 'Bore', 'NPS', 'NS', 'Size', 'Size (NPS)']);
  const length = rawValue(row, ['length', 'lengthMm', 'Length (RF-F/F)', 'RF-F/F', 'Length', 'LEN', 'faceToFace', 'Face To Face']);
  return {
    ...row,
    _raw: row,
    _sourceRowIndex: row?._sourceRowIndex || row?._rowIndex || index + 1,
    bore: numericText(bore) || bore,
    convertedBore: numericText(bore) || bore,
    rating: rawValue(row, ['rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']),
    length: numericText(length) || length,
    valveType: rawValue(row, ['valveType', 'Type Description', 'TypeDesc', 'Valve Type', 'Type', 'Description']),
    weight: rawValue(row, ['weight', 'valveWeight', 'RF/RTJ KG', 'Valve Weight', 'Weight']),
  };
}

function normalizeRows(sectionKey, rows) {
  if (!Array.isArray(rows)) return [];
  if (sectionKey === 'pipingClass') return rows.map(normalizePipingRow).filter((row) => clean(row.pipingClass) && !row._smartMasterPlaceholder);
  if (sectionKey === 'weight') return rows.map(normalizeWeightRow).filter((row) => clean(row.bore) || clean(row.rating) || clean(row.length) || clean(row.weight));
  return rows;
}

function canonicalFieldMap(section) {
  return { ...(section.canonicalFieldMap || {}) };
}

function parseJsonRows(rawText) {
  const trimmed = clean(rawText).replace(/^export\s+default\s+/i, '').replace(/;\s*$/g, '');
  const parsed = JSON.parse(trimmed || '[]');
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  for (const key of ['rows', 'masterRows', 'mapRows', 'data', 'items']) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value) && value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return value;
  }
  return [];
}

function parseIndex(rawText) {
  const trimmed = clean(rawText)
    .replace(/^export\s+default\s+/i, '')
    .replace(/^window\.[A-Za-z0-9_$]+\s*=\s*/i, '')
    .replace(/;\s*$/g, '');
  const parsed = JSON.parse(trimmed || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Piping class index must be an object.');
  if (!parsed.classes || typeof parsed.classes !== 'object') throw new Error('Piping class index has no classes object.');
  return parsed;
}

function parseMaterialMap(rawText) {
  return text(rawText)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !/^\d{4}$/.test(line))
    .map((line, index) => {
      const match = line.match(/^(\S+)\s+(.+)$/);
      return {
        _rowIndex: index + 1,
        code: match ? match[1].trim() : '',
        material: match ? match[2].trim() : line,
      };
    });
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function appBasePath() {
  const first = location.pathname.split('/').filter(Boolean)[0] || '';
  return first ? `/${first}/` : '/';
}

function normalizeMasterPath(value) {
  return clean(value).replace(/^\/+/, '');
}

function rawUrlForMasterPath(masterPath) {
  const normalized = normalizeMasterPath(masterPath);
  const encoded = normalized.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
  return `${RAW_BASE}${encoded}`;
}

function masterPathFromUrl(input) {
  const raw = typeof input === 'string' || input instanceof URL ? text(input) : text(input?.url || '');
  if (!raw || !/docs\/Masters\//i.test(raw)) return '';
  try {
    const url = new URL(raw, location.href);
    const match = url.pathname.match(/(?:^|\/)docs\/Masters\/(.+)$/i);
    return match ? `docs/Masters/${decodeURIComponent(match[1]).replace(/[?#].*$/, '')}` : '';
  } catch {
    const match = raw.match(/docs\/Masters\/(.+)$/i);
    return match ? `docs/Masters/${decodeURIComponent(match[1]).replace(/[?#].*$/, '')}` : '';
  }
}

function isLegacyPipingMasterPath(masterPath) {
  return /Piping_class_master\.json$/i.test(text(masterPath));
}

function pipingPlaceholderResponse() {
  return new Response(JSON.stringify([PIPING_PLACEHOLDER_ROW]), {
    status: 200,
    headers: { 'content-type': 'application/json;charset=utf-8', 'x-xml-cii-smart-master': 'piping-class-placeholder' },
  });
}

function candidateUrls(masterPath) {
  const normalized = normalizeMasterPath(masterPath);
  const origin = location.origin;
  return unique([
    new URL(`../${normalized}`, import.meta.url).href,
    new URL(`../../${normalized}`, import.meta.url).href,
    `${origin}${appBasePath()}${normalized}`,
    `${origin}/${normalized}`,
    rawUrlForMasterPath(normalized),
  ]);
}

function installMasterFetchFallback() {
  if (window[FETCH_PATCH_FLAG] || typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);
  window.__xmlCiiMasterOriginalFetch = window.__xmlCiiMasterOriginalFetch || originalFetch;

  window.fetch = async function xmlCiiMasterFetch(input, init) {
    const rawInput = typeof input === 'string' || input instanceof URL ? text(input) : text(input?.url || '');
    const masterPath = masterPathFromUrl(input);
    if (!masterPath) return originalFetch(input, init);

    if (isLegacyPipingMasterPath(masterPath) && !/[?&]xmlCiiFullMaster=1\b/.test(rawInput)) {
      return pipingPlaceholderResponse();
    }

    const rawUrl = rawUrlForMasterPath(masterPath);
    const shouldPreferRaw = /(^|\.)github\.io$/i.test(location.hostname);
    if (shouldPreferRaw) {
      try {
        const rawResponse = await originalFetch(rawUrl, { ...(init || {}), cache: 'no-store', mode: 'cors' });
        if (rawResponse.ok) return rawResponse;
      } catch {}
    }

    const response = await originalFetch(input, init);
    if (response.ok || response.status !== 404) return response;

    try {
      const rawResponse = await originalFetch(rawUrl, { ...(init || {}), cache: 'no-store', mode: 'cors' });
      if (rawResponse.ok) return rawResponse;
    } catch {}
    return response;
  };

  window[FETCH_PATCH_FLAG] = true;
}

async function fetchTextByPath(masterPath) {
  const errors = [];
  for (const url of candidateUrls(masterPath)) {
    try {
      const response = await window.fetch(url, { cache: 'no-store', mode: 'cors' });
      if (!response.ok) {
        errors.push(`${url}: HTTP ${response.status}`);
        continue;
      }
      const rawText = await response.text();
      if (!clean(rawText)) {
        errors.push(`${url}: empty response`);
        continue;
      }
      return { rawText, url };
    } catch (error) {
      errors.push(`${url}: ${clean(error?.message || error)}`);
    }
  }
  throw new Error(`Failed to load ${masterPath}. Tried: ${errors.join(' | ')}`);
}

async function fetchRows(sectionKey, section, config) {
  const paths = masterPaths(config);
  const path = paths[section.pathKey] || DEFAULT_MASTER_PATHS[section.pathKey];
  const { rawText, url } = await fetchTextByPath(path);
  const parsedRows = sectionKey === 'material' ? parseMaterialMap(rawText) : parseJsonRows(rawText);
  const rows = normalizeRows(sectionKey, parsedRows);
  if (!Array.isArray(rows) || rows.length <= 0) throw new Error(`${section.title} default master loaded 0 usable rows from ${url}`);
  return { rows, url };
}

let suppressScheduleUntil = 0;
function dispatchConfigChange(input) {
  suppressScheduleUntil = Date.now() + 250;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function writeConfigIfChanged(input, config) {
  const next = JSON.stringify(config, null, 2);
  if (input.value === next) return false;
  input.value = next;
  dispatchConfigChange(input);
  return true;
}

function statusHost() {
  let host = document.getElementById(STATUS_ID);
  if (host) return host;
  host = document.createElement('div');
  host.id = STATUS_ID;
  host.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #2f4770;border-radius:8px;background:#0f1b2c;color:#b9d7ff;font-size:12px;';
  return host;
}

function showStatus(message, tone = 'info') {
  const phaseTitle = Array.from(document.querySelectorAll('.model-converters-workflow-detail-title'))
    .find((el) => /Import Masters|Run|Config|Preview/i.test(clean(el.textContent)));
  if (!phaseTitle) return;
  const host = statusHost();
  host.textContent = message;
  host.style.borderColor = tone === 'error' ? '#7f3040' : tone === 'ok' ? '#2b7656' : '#2f4770';
  host.style.color = tone === 'error' ? '#ffc2c2' : tone === 'ok' ? '#7dffc0' : '#b9d7ff';
  if (!host.isConnected) phaseTitle.insertAdjacentElement('afterend', host);
}

function maybeRefreshWorkflow() {
  const activeImportTab = Array.from(document.querySelectorAll('[data-xml-cii-phase]'))
    .find((button) => button.classList.contains('is-active') && button.getAttribute('data-xml-cii-phase') === 'import-masters');
  if (activeImportTab) setTimeout(() => activeImportTab.click(), 30);
}

function normalizeContainsText(value) {
  return clean(value).toUpperCase().replace(/\s+/g, '').replace(/^\/+/, '').replace(/["']/g, '');
}

function extractBranchNames(xmlText) {
  const source = text(xmlText);
  const names = [];
  if (typeof DOMParser !== 'undefined') {
    try {
      const document = new DOMParser().parseFromString(source, 'application/xml');
      if (!document.getElementsByTagName('parsererror').length) {
        for (const node of [...document.getElementsByTagName('Branchname')]) {
          const name = clean(node.textContent);
          if (name) names.push(name);
        }
      }
    } catch {}
  }
  if (!names.length) {
    for (const match of source.matchAll(/<Branchname[^>]*>([\s\S]*?)<\/Branchname>/gi)) {
      const name = clean(match[1].replace(/<[^>]+>/g, ''));
      if (name) names.push(name);
    }
  }
  return Array.from(new Set(names));
}

function matchedClassesFromIndex(index, branchNames) {
  const normalizedBranches = branchNames.map(normalizeContainsText).filter(Boolean);
  const classes = index?.classes && typeof index.classes === 'object' ? index.classes : {};
  const matches = [];
  for (const [classKey, meta] of Object.entries(classes)) {
    const tokens = unique([classKey, ...(Array.isArray(meta?.matchTokens) ? meta.matchTokens : [])])
      .map(normalizeContainsText)
      .filter(Boolean);
    if (!tokens.length) continue;
    const branchHits = normalizedBranches.filter((branch) => tokens.some((token) => branch.includes(token)));
    if (branchHits.length) matches.push({ classKey, meta, branchHits });
  }
  return matches;
}

function joinPath(folder, file) {
  const f = normalizeMasterPath(folder || '').replace(/\/+$/, '');
  const n = clean(file).replace(/^\/+/, '');
  return f ? `${f}/${n}` : n;
}

function primaryXmlFile() {
  const fileInput = document.querySelector('#model-converters-primary-input');
  return fileInput?.files?.[0] || null;
}

function pipingFieldMap() {
  return canonicalFieldMap(MASTER_SOURCES.pipingClass);
}

function xmlFileSignature(file) {
  if (!file) return 'no-xml';
  return `${file.name || ''}:${file.size || 0}:${file.lastModified || 0}`;
}

function rescanSignature({ xmlFile, paths, branchNames }) {
  return JSON.stringify({
    xml: xmlFileSignature(xmlFile),
    branchCount: branchNames.length,
    index: paths.pipingClassIndexPath,
    indexCompat: paths.pipingClassIndexCompatPath,
    shardFolder: paths.pipingClassShardFolder,
  });
}

function currentPipingScanSignature(config) {
  return clean(config?.pipingClass?._rescanSignature || '');
}

let rescanBusy = false;
async function rescanPipingClassFromXml({ force = false, notifyUser = false } = {}) {
  if (rescanBusy) return false;
  const input = document.querySelector(INPUT_SELECTOR);
  if (!input) return false;
  const config = parseConfig(input);
  if (!config) return false;
  if (!force && config.disableDefaultMasterAutoload === true) return false;

  const xmlFile = primaryXmlFile();
  if (!xmlFile) {
    renderMasterPathsPanel(input, 'Piping Class: waiting for XML input; use Rescan XML after selecting XML.', 'info');
    return false;
  }

  const paths = masterPaths(config);
  const xmlText = await xmlFile.text();
  const branchNames = extractBranchNames(xmlText);
  if (!branchNames.length) {
    renderMasterPathsPanel(input, 'Piping Class: no Branchname values found in XML.', 'error');
    return false;
  }

  const scanSig = rescanSignature({ xmlFile, paths, branchNames });
  const existingRows = rowCount(MASTER_SOURCES.pipingClass, config.pipingClass);
  if (!force && currentPipingScanSignature(config) === scanSig && existingRows > 0) {
    renderMasterPathsPanel(input);
    return false;
  }

  rescanBusy = true;
  renderMasterPathsPanel(input, `Scanning ${branchNames.length} XML branchname(s) against specwise piping class index…`, 'info');

  try {
    let indexLoad = null;
    let index = null;
    const indexCandidates = unique([paths.pipingClassIndexPath, paths.pipingClassIndexCompatPath, DEFAULT_MASTER_PATHS.pipingClassIndexPath, DEFAULT_MASTER_PATHS.pipingClassIndexCompatPath].filter(Boolean));
    const indexErrors = [];
    for (const indexPath of indexCandidates) {
      try {
        indexLoad = await fetchTextByPath(indexPath);
        index = parseIndex(indexLoad.rawText);
        paths.pipingClassIndexPath = indexPath;
        break;
      } catch (error) {
        indexErrors.push(`${indexPath}: ${clean(error?.message || error)}`);
      }
    }
    if (!index) throw new Error(`Unable to load specwise piping class index. ${indexErrors.join(' | ')}`);

    const matches = matchedClassesFromIndex(index, branchNames);
    const rows = [];
    const loadedShardFiles = [];
    const shardFolder = paths.pipingClassShardFolder || index.shardBase || DEFAULT_MASTER_PATHS.pipingClassShardFolder;

    for (const match of matches) {
      const file = clean(match.meta?.file);
      if (!file) continue;
      const shardPath = joinPath(shardFolder, file);
      const shardLoad = await fetchTextByPath(shardPath);
      const shardRows = normalizeRows('pipingClass', parseJsonRows(shardLoad.rawText));
      if (shardRows.length) {
        rows.push(...shardRows);
        loadedShardFiles.push(file);
      }
    }

    const section = ensureSection(config, MASTER_SOURCES.pipingClass);
    section.masterRows = rows.length ? rows : [{ ...PIPING_PLACEHOLDER_ROW }];
    section.fieldMap = pipingFieldMap();
    section.masterUrl = indexLoad.url;
    section.defaultUrl = indexLoad.url;
    section.indexPath = paths.pipingClassIndexPath;
    section.shardFolder = shardFolder;
    section._smartMode = rows.length ? 'specwise-shard' : 'specwise-index-no-match';
    section._sourceTotalRows = Number(index.rowCount) || null;
    section._sourceClassCount = Number(index.classCount) || Object.keys(index.classes || {}).length;
    section._autoloadedRows = rows.length;
    section._matchedClassCount = matches.length;
    section._loadedShardCount = loadedShardFiles.length;
    section._loadedShardFiles = loadedShardFiles;
    section._branchNameCount = branchNames.length;
    section._rescanAt = new Date().toISOString();
    section._rescanSignature = scanSig;

    if (!config.masterPaths || typeof config.masterPaths !== 'object') config.masterPaths = {};
    Object.assign(config.masterPaths, paths);

    const changed = writeConfigIfChanged(input, config);
    const msg = rows.length
      ? `Piping Class: ${loadedShardFiles.length}/${matches.length} shard(s), ${rows.length} row(s), ${branchNames.length} branchname(s).`
      : `Piping Class: 0/${matches.length} shard(s), 0 row(s), ${branchNames.length} branchname(s).`;
    renderMasterPathsPanel(input, msg, rows.length ? 'ok' : 'error');
    showStatus(msg, rows.length ? 'ok' : 'error');
    if (notifyUser) notify({ level: rows.length ? 'success' : 'warning', title: 'XML->CII Masters', message: msg });
    if (changed) maybeRefreshWorkflow();
    return rows.length > 0;
  } finally {
    rescanBusy = false;
  }
}

function missingMasterSignature(config) {
  return Object.entries(MASTER_SOURCES)
    .filter(([key]) => key !== 'pipingClass')
    .map(([key, section]) => `${key}:${rowCount(section, config[section.sectionKey])}:${masterPaths(config)[section.pathKey] || ''}`)
    .join('|');
}

let busy = false;
let lastAttemptSignature = '';
let lastFailureSignature = '';
let failureNotified = false;

async function autoloadMasters(input) {
  if (busy) return;
  const config = parseConfig(input);
  if (config == null) return;
  renderMasterPathsPanel(input);
  if (config.disableDefaultMasterAutoload === true || config._disableDefaultMasterAutoload === true) return;

  const signature = missingMasterSignature(config);
  const missing = Object.entries(MASTER_SOURCES).filter(([sectionKey, section]) => {
    if (sectionKey === 'pipingClass') return false;
    return rowCount(section, config[section.sectionKey]) <= 0;
  });

  if (!missing.length) {
    lastAttemptSignature = signature;
    rescanPipingClassFromXml({ force: false }).catch((error) => console.warn('XML->CII specwise piping scan failed', error));
    return;
  }
  if (signature === lastAttemptSignature || signature === lastFailureSignature) return;

  busy = true;
  lastAttemptSignature = signature;
  showStatus(`Autoloading ${missing.map(([, section]) => section.title).join(', ')} from docs/Masters…`);
  const loaded = [];
  const errors = [];

  try {
    for (const [sectionKey, section] of missing) {
      try {
        const target = ensureSection(config, section);
        const { rows, url } = await fetchRows(sectionKey, section, config);
        target[section.rowsKey] = rows;
        target[section.fieldMapKey] = canonicalFieldMap(section);
        target.masterUrl = target.masterUrl || url;
        target.defaultUrl = target.defaultUrl || url;
        target._autoloadedFrom = url;
        target._autoloadedRows = rows.length;
        loaded.push(`${section.title}: ${rows.length} row(s)`);
      } catch (error) {
        errors.push(`${section.title}: ${clean(error?.message || error)}`);
      }
    }

    if (loaded.length) {
      config._defaultMastersAutoloaded = {
        loadedAt: new Date().toISOString(),
        source: 'docs/Masters + raw.githubusercontent.com fallback',
        mode: 'material+weight canonical rows; specwise piping shards',
        counts: Object.fromEntries(Object.entries(MASTER_SOURCES).map(([key, section]) => [key, rowCount(section, config[section.sectionKey])])),
      };
      const changed = writeConfigIfChanged(input, config);
      showStatus(`Autoloaded ${loaded.join(' · ')}.`, 'ok');
      notify({ level: 'success', title: 'XML->CII Masters', message: `Autoloaded ${loaded.join(' · ')}.` });
      if (changed) maybeRefreshWorkflow();
    }

    if (errors.length) {
      lastFailureSignature = missingMasterSignature(config);
      const message = `Default master autoload skipped for some masters: ${errors.join(' || ')}`;
      showStatus(message, 'error');
      if (!failureNotified) {
        failureNotified = true;
        notify({ level: 'error', title: 'XML->CII Masters', message });
      }
    }
  } finally {
    busy = false;
  }

  rescanPipingClassFromXml({ force: false }).catch((error) => console.warn('XML->CII specwise piping scan failed', error));
}

function pathPanelStatus(config, statusText = '') {
  if (statusText) return statusText;
  const piping = config?.pipingClass || {};
  if (piping._smartMode === 'specwise-shard') {
    return `Piping Class: ${piping._loadedShardCount || 0}/${piping._matchedClassCount || 0} shard(s), ${rowCount(MASTER_SOURCES.pipingClass, piping)} row(s), ${piping._branchNameCount || 0} branchname(s).`;
  }
  return 'Piping Class: select XML, then Rescan XML to load specwise shard rows.';
}

function pathPanelSignature(config, status, tone) {
  const piping = config?.pipingClass || {};
  return JSON.stringify({
    paths: masterPaths(config),
    status,
    tone,
    pipingMode: piping._smartMode || '',
    pipingRows: rowCount(MASTER_SOURCES.pipingClass, piping),
    shardCount: piping._loadedShardCount || 0,
    matchedClassCount: piping._matchedClassCount || 0,
    branchNameCount: piping._branchNameCount || 0,
  });
}

function pathPanelHtml(config, status, tone = 'info') {
  const paths = masterPaths(config);
  return `
    <div id="${PATH_PANEL_ID}" class="model-converters-workflow-master-card" style="margin:10px 0;border-color:#25466b;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div>
          <div class="model-converters-workflow-detail-title">Master Paths / Specwise Piping Class Index</div>
          <div class="model-converters-workflow-detail-text">Editable paths used by XML→CII master loading. Piping Class uses shard index + branchname contains search.</div>
        </div>
        <button type="button" class="model-converters-run-btn" data-xml-cii-rescan-piping>Rescan XML</button>
      </div>
      <div class="model-converters-workflow-regex-grid" style="margin-top:10px;grid-template-columns:repeat(5,minmax(160px,1fr));">
        ${pathFieldHtml('Material Map Path', 'materialMapPath', paths.materialMapPath, DEFAULT_MASTER_PATHS.materialMapPath)}
        ${pathFieldHtml('Weights / Valve CA8 Path', 'weightPath', paths.weightPath, DEFAULT_MASTER_PATHS.weightPath)}
        ${pathFieldHtml('Piping Class Index Path', 'pipingClassIndexPath', paths.pipingClassIndexPath, DEFAULT_MASTER_PATHS.pipingClassIndexPath)}
        ${pathFieldHtml('Piping Class Shard Folder', 'pipingClassShardFolder', paths.pipingClassShardFolder, DEFAULT_MASTER_PATHS.pipingClassShardFolder)}
        ${pathFieldHtml('Legacy Full Piping Class Master', 'legacyPipingMasterPath', paths.legacyPipingMasterPath, DEFAULT_MASTER_PATHS.legacyPipingMasterPath, 'Fallback/source file only; not autoloaded')}
      </div>
      <div data-xml-cii-path-status style="margin-top:8px;padding:8px 10px;border:1px solid ${tone === 'error' ? '#7f3040' : '#2b7656'};border-radius:8px;color:${tone === 'error' ? '#ffc2c2' : '#7dffc0'};background:#0f1b2c;font-size:12px;">${esc(status)}</div>
    </div>
  `;
}

function pathFieldHtml(label, key, value, defaultValue, note = '') {
  return `
    <label class="model-converters-workflow-regex-field">
      <span>${esc(label)}</span>
      <input type="text" value="${esc(value)}" data-xml-cii-master-path="${esc(key)}">
      <small>Default: ${esc(defaultValue)}${note ? `<br>${esc(note)}` : ''}</small>
    </label>
  `;
}

function renderMasterPathsPanel(input, statusText = '', tone = 'info') {
  if (!input) return;
  const config = parseConfig(input);
  if (!config) return;
  const importTitle = Array.from(document.querySelectorAll('.model-converters-workflow-detail-title'))
    .find((el) => /^1\s+Import Masters$/i.test(clean(el.textContent)));
  if (!importTitle) return;

  const status = pathPanelStatus(config, statusText);
  const signature = pathPanelSignature(config, status, tone);
  let panel = document.getElementById(PATH_PANEL_ID);
  if (panel && panel.dataset.renderSignature === signature) {
    bindPathPanel(input);
    return;
  }

  const html = pathPanelHtml(config, status, tone);
  if (panel) {
    panel.outerHTML = html;
  } else {
    const textBlock = importTitle.nextElementSibling;
    (textBlock || importTitle).insertAdjacentHTML('afterend', html);
  }
  panel = document.getElementById(PATH_PANEL_ID);
  if (panel) panel.dataset.renderSignature = signature;
  bindPathPanel(input);
}

function bindPathPanel(input) {
  const panel = document.getElementById(PATH_PANEL_ID);
  if (!panel || panel.dataset.bound === 'true') return;
  panel.dataset.bound = 'true';
  panel.querySelectorAll('[data-xml-cii-master-path]').forEach((field) => {
    field.addEventListener('change', () => {
      const config = parseConfig(input);
      if (!config) return;
      saveMasterPath(config, field.getAttribute('data-xml-cii-master-path') || '', field.value);
      writeConfigIfChanged(input, config);
      renderMasterPathsPanel(input, 'Master paths updated. Rescan XML to reload specwise piping class rows.', 'ok');
    });
  });
  panel.querySelector('[data-xml-cii-rescan-piping]')?.addEventListener('click', () => {
    rescanPipingClassFromXml({ force: true, notifyUser: true }).catch((error) => {
      const message = `Piping Class rescan failed: ${clean(error?.message || error)}`;
      renderMasterPathsPanel(input, message, 'error');
      showStatus(message, 'error');
      notify({ level: 'error', title: 'XML->CII Masters', message });
    });
  });
}

let raf = 0;
let observer = null;
let schedulePending = false;

function schedule() {
  if (Date.now() < suppressScheduleUntil) return;
  if (schedulePending) return;
  schedulePending = true;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
  const run = () => {
    schedulePending = false;
    const input = document.querySelector(INPUT_SELECTOR);
    if (!input) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    autoloadMasters(input).catch((error) => console.warn('XML->CII master autoload failed', error));
  };
  if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export function installXmlCiiDefaultMasterAutoload() {
  installXmlCiiRecoveryHandlers();
  if (!isBrowserReady()) return;
  if (window[FLAG]) return;
  window[FLAG] = true;
  installMasterFetchFallback();
  schedule();

  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', () => setTimeout(schedule, 0), true);
  document.addEventListener('change', () => setTimeout(schedule, 0), true);
  document.addEventListener('input', (event) => {
    if (event.target?.matches?.(INPUT_SELECTOR)) setTimeout(schedule, 0);
  }, true);
}


// ---- Recovery logic ----

const INSTALL_FLAG = '__xmlCiiRecoveryPatch_v1';
const RECOVERY_RECOVERY_INPUT_SELECTOR = '[data-option-key="supportConfigJson"]';
const RECOVERY_RECOVERY_PRIMARY_FILE_SELECTOR = '#model-converters-primary-input';
const RECOVERY_RECOVERY_RAW_BASE = 'https://raw.githubusercontent.com/reallaksh19/3D_Viewer/main/';

const RECOVERY_DEFAULT_PATHS = Object.freeze({
  pipingClassIndexPath: 'docs/Masters/SpecwisePipingClass/index.json',
  pipingClassShardFolder: 'docs/Masters/SpecwisePipingClass/',
});

function recovery_text(value) {
  return value == null ? '' : String(value);
}

function recovery_clean(value) {
  return recovery_text(value).trim();
}

function recovery_normalizeKey(value) {
  return recovery_clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recovery_read(row, keys) {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    const value = row[key] ?? row._raw?.[key];
    if (value !== undefined && value !== null && recovery_clean(value)) return recovery_clean(value);
  }
  return '';
}

function recovery_numericText(value) {
  const match = recovery_clean(value).match(/[-+]?\d*\.?\d+/);
  return match ? match[0] : recovery_clean(value);
}

function recovery_parseConfig(input) {
  try {
    const parsed = JSON.parse(input?.value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function recovery_writeConfigIfChanged(input, config) {
  if (!input || !config) return false;
  const next = JSON.stringify(config, null, 2);
  if (input.value === next) return false;
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function recovery_lineNoValue(row) {
  return recovery_read(row, ['lineNoKey', 'lineNo', 'lineKey', 'Line No', 'Line Number', 'PipelineReference', 'ColumnX1']);
}

function recovery_isHeaderishLineNoKey(value) {
  const key = recovery_normalizeKey(value);
  if (!key) return true;
  if (!/\d/.test(key)) return true;
  if (/^SERVICE(?:SERVICE)*LINE(?:NUMBER|NO)?$/.test(key)) return true;
  if (/^(LINE(?:NUMBER|NO)?|SERVICE|PIPINGCLASS|MATERIAL|FLUID|DENSITY|PHASE)$/.test(key)) return true;
  return false;
}

function recovery_isHeaderishLineListRow(row) {
  const key = recovery_lineNoValue(row);
  if (recovery_isHeaderishLineNoKey(key)) return true;
  const values = Object.values(row || {}).map((value) => recovery_normalizeKey(value)).filter(Boolean);
  const joined = values.join('|');
  if (/PIPINGCLASS|NOMINALPIPESIZE|DESIGNCONDITIONS|TESTPRESSURE|INSULATIONTHICKNESS/.test(joined) && !/\b[A-Z]{1,8}\d{3,}/.test(joined)) {
    return true;
  }
  return false;
}

function recovery_cleanupLineListRows(config) {
  const rows = Array.isArray(config?.linelist?.masterRows) ? config.linelist.masterRows : [];
  if (!rows.length) return false;
  const cleaned = rows.filter((row) => !recovery_isHeaderishLineListRow(row));
  if (cleaned.length === rows.length) return false;
  config.linelist.masterRows = cleaned;
  return true;
}

function recovery_masterPaths(config) {
  const existing = config?.recovery_masterPaths && typeof config.recovery_masterPaths === 'object' && !Array.isArray(config.recovery_masterPaths)
    ? config.recovery_masterPaths
    : {};
  return { ...DEFAULT_PATHS, ...existing };
}

function recovery_pathCandidates(path) {
  const p = recovery_clean(path).replace(/^\.\//, '');
  const out = [];
  if (!p) return out;
  out.push(p);
  if (!p.startsWith('../')) out.push(`../${p}`);
  if (!/^https?:\/\//i.test(p)) out.push(`${RECOVERY_RAW_BASE}${p.replace(/^\.\.\//, '')}`);
  return [...new Set(out)];
}

async function recovery_fetchTextAny(path) {
  if (typeof fetch !== 'function') throw new Error('fetch unavailable');
  let last = '';
  for (const url of recovery_pathCandidates(path)) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        last = `${url}: ${response.status}`;
        continue;
      }
      return await response.recovery_text();
    } catch (error) {
      last = `${url}: ${error?.message || error}`;
    }
  }
  throw new Error(last || `Unable to fetch ${path}`);
}

function recovery_parseJsonText(raw) {
  const trimmed = recovery_clean(raw).replace(/^export\s+default\s+/i, '').replace(/;\s*$/g, '');
  return JSON.parse(trimmed || '{}');
}

function recovery_extractBranchNames(xmlText) {
  const source = recovery_text(xmlText);
  if (!source) return [];
  const out = [];
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      for (const node of [...doc.getElementsByTagName('Branchname')]) {
        const value = recovery_clean(node.textContent);
        if (value) out.push(value);
      }
    } catch {}
  }
  if (!out.length) {
    for (const match of source.matchAll(/<Branchname[^>]*>([\s\S]*?)<\/Branchname>/gi)) {
      const value = recovery_clean(match[1]);
      if (value) out.push(value);
    }
  }
  return [...new Set(out)];
}

function recovery_tokenAt(branchName, delimiter, oneBasedIndex) {
  const parts = recovery_text(branchName).split(delimiter || '-');
  const idx = Math.max(1, Number(oneBasedIndex || 1)) - 1;
  return recovery_clean(parts[idx] || '');
}

function recovery_deriveRequestedClass(branchName, config) {
  const rxText = recovery_clean(config?.rating?.pipingClassRegex);
  if (rxText) {
    try {
      const m = new RegExp(rxText, 'i').exec(branchName);
      const group = Math.max(0, Number(config?.rating?.pipingClassGroup || 1));
      if (m?.[group]) return recovery_clean(m[group]);
    } catch {}
  }
  return recovery_tokenAt(branchName, config?.rating?.tokenDelimiter || '-', config?.rating?.pipingClassTokenIndex || 5);
}

function recovery_matchedClassKeys(branchNames, index, config) {
  const classes = index?.classes && typeof index.classes === 'object' ? index.classes : {};
  const wanted = new Set();
  for (const branchName of branchNames) {
    const requested = recovery_normalizeKey(recovery_deriveRequestedClass(branchName, config));
    const branchNorm = recovery_normalizeKey(branchName);
    if (!requested && !branchNorm) continue;
    for (const [classKey, meta] of Object.entries(classes)) {
      const classNorm = recovery_normalizeKey(classKey);
      const tokens = Array.isArray(meta?.matchTokens) && meta.matchTokens.length ? meta.matchTokens : [classKey];
      const hit = tokens.some((token) => {
        const tok = recovery_normalizeKey(token);
        return tok && (requested.includes(tok) || tok.includes(requested) || branchNorm.includes(tok));
      });
      if (classNorm && hit) wanted.add(classKey);
    }
  }
  return [...wanted];
}

function recovery_normalizePipingRow(row, index = 0) {
  const cls = recovery_read(row, ['pipingClass', 'Piping Class', 'PIPING_CLASS', 'Class', 'SPEC', 'Spec']);
  return {
    ...row,
    _raw: row,
    _sourceRowIndex: row?._sourceRowIndex || row?._rowIndex || index + 1,
    pipingClass: cls,
    convertedBore: recovery_numericText(recovery_read(row, ['convertedBore', 'Converted Bore', 'DN', 'NB', 'Bore', 'NPS', 'Size'])),
    componentType: recovery_read(row, ['componentType', 'Component Type', 'COMPONENT_TYPE', 'Type', 'Item Type']),
    rating: recovery_read(row, ['rating', 'Rating', 'RATING', 'Class Rating', 'Pressure Class']),
    materialName: recovery_read(row, ['materialName', 'Material_Name', 'Material', 'MATERIAL', 'Material Name']),
    schedule: recovery_read(row, ['schedule', 'Schedule', 'SCHEDULE', 'SCH']),
    wallThickness: recovery_read(row, ['wallThickness', 'Wall Thickness', 'Wall thickness', 'WALL_THICKNESS', 'WT', 'WallThickness']),
    corrosion: recovery_read(row, ['corrosion', 'Corrosion', 'Corrosion Allowance', 'CORROSION_ALLOWANCE', 'CA']),
    endCondition: recovery_read(row, ['endCondition', 'End Condition', 'END_CONDITION', 'End Type']),
  };
}

function recovery_loadedClassKeys(config) {
  return new Set((Array.isArray(config?.pipingClass?.masterRows) ? config.pipingClass.masterRows : [])
    .map((row) => recovery_normalizeKey(recovery_read(row, ['pipingClass', 'Piping Class', 'Class'])))
    .filter(Boolean));
}

function recovery_hasOnlyPipingPlaceholder(config) {
  const rows = Array.isArray(config?.pipingClass?.masterRows) ? config.pipingClass.masterRows : [];
  return !rows.length || rows.every((row) => row?._smartMasterPlaceholder || recovery_normalizeKey(row?.pipingClass) === 'ONDEMAND');
}

async function recovery_ensurePipingClassShardsForXml(config, xmlFile) {
  if (!xmlFile || typeof xmlFile.recovery_text !== 'function') return false;
  const xmlText = await xmlFile.recovery_text();
  const branchNames = recovery_extractBranchNames(xmlText);
  if (!branchNames.length) return false;
  const paths = recovery_masterPaths(config);
  const index = recovery_parseJsonText(await recovery_fetchTextAny(paths.pipingClassIndexPath));
  const classKeys = recovery_matchedClassKeys(branchNames, index, config);
  if (!classKeys.length) return false;

  const loaded = recovery_loadedClassKeys(config);
  const missing = recovery_hasOnlyPipingPlaceholder(config) ? classKeys : classKeys.filter((key) => !loaded.has(recovery_normalizeKey(key)));
  if (!missing.length && !recovery_hasOnlyPipingPlaceholder(config)) return false;

  const folder = recovery_clean(paths.pipingClassShardFolder || index.shardBase || RECOVERY_DEFAULT_PATHS.pipingClassShardFolder).replace(/\/?$/, '/');
  const rows = [];
  for (const key of classKeys) {
    const meta = index.classes?.[key] || {};
    const file = recovery_clean(meta.file || `${key}.json`);
    const shard = recovery_parseJsonText(await recovery_fetchTextAny(`${folder}${file}`));
    const shardRows = Array.isArray(shard?.rows) ? shard.rows : (Array.isArray(shard) ? shard : []);
    rows.push(...shardRows.map(recovery_normalizePipingRow));
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

let recoveryBusy = false;
let recoveryQueued = false;

async function recovery_runRecovery() {
  if (recoveryBusy) {
    recoveryQueued = true;
    return;
  }
  recoveryBusy = true;
  try {
    const input = document.querySelector(RECOVERY_INPUT_SELECTOR);
    const primary = document.querySelector(RECOVERY_PRIMARY_FILE_SELECTOR);
    const xmlFile = primary?.files?.[0] || null;
    const config = recovery_parseConfig(input);
    if (!input || !config) return;
    let changed = recovery_cleanupLineListRows(config);
    try {
      changed = (await recovery_ensurePipingClassShardsForXml(config, xmlFile)) || changed;
    } catch (error) {
      console.warn('XML->CII recovery: piping class shard load skipped:', error);
    }
    if (changed) recovery_writeConfigIfChanged(input, config);
  } finally {
    recoveryBusy = false;
    if (recoveryQueued) {
      recoveryQueued = false;
      setTimeout(recovery_runRecovery, 50);
    }
  }
}

function recovery_scheduleRecovery() {
  setTimeout(recovery_runRecovery, 0);
}

function installXmlCiiRecoveryHandlers() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  // legacy-adapter.js has one old internal path that still calls this name
  // without importing it. Defining the global keeps 4 Diagnostics / 4A Weight
  // Match from failing while the canonical core export remains the source.
  globalThis.isXmlCiiRigidNode = isXmlCiiRigidNode;

  document.addEventListener('change', (event) => {
    if (event.target?.matches?.(`${RECOVERY_INPUT_SELECTOR}, ${RECOVERY_PRIMARY_FILE_SELECTOR}`)) recovery_scheduleRecovery();
  }, true);
  document.addEventListener('input', (event) => {
    if (event.target?.matches?.(RECOVERY_INPUT_SELECTOR)) recovery_scheduleRecovery();
  }, true);
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-xml-cii-phase], [data-xml-cii-save-master], [data-xml-cii-master-tab]')) recovery_scheduleRecovery();
  }, true);
  recovery_scheduleRecovery();
}
