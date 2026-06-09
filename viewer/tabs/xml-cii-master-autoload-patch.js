import { notify } from '../diagnostics/notification-center.js';

const FLAG = '__xmlCiiDefaultMasterAutoload_v5';
const FETCH_PATCH_FLAG = '__xmlCiiDefaultMasterFetchFallback_v3';
const INPUT_SELECTOR = '[data-option-key="supportConfigJson"]';
const STATUS_ID = 'xml-cii-master-autoload-status';
const RAW_BASE = 'https://raw.githubusercontent.com/reallaksh19/3D_Viewer/main/';
const PIPING_MASTER_PATH = 'docs/Masters/Piping_class_master.json';

const PIPING_PLACEHOLDER_ROW = Object.freeze({
  _smartMasterPlaceholder: true,
  'Piping Class': '__ON_DEMAND__',
  convertedBore: '',
  'Wall thickness': '',
  Material_Name: '',
  Rating: '',
  Corrosion: '',
});

const MASTER_SOURCES = Object.freeze({
  pipingClass: Object.freeze({
    title: 'Piping Class',
    sectionKey: 'pipingClass',
    rowsKey: 'masterRows',
    fieldMapKey: 'fieldMap',
    path: PIPING_MASTER_PATH,
    smartOnDemand: true,
    aliases: Object.freeze({
      pipingClass: Object.freeze(['Piping Class', 'PIPING_CLASS', 'Class', 'SPEC', 'Spec']),
      convertedBore: Object.freeze(['convertedBore', 'Converted Bore', 'Size', 'DN', 'NB', 'Bore', 'NPS']),
      componentType: Object.freeze(['Component Type', 'COMPONENT_TYPE', 'Type', 'Item Type']),
      rating: Object.freeze(['Rating', 'RATING', 'Pressure Class', 'Class Rating']),
      materialName: Object.freeze(['Material_Name', 'Material', 'MATERIAL', 'Material Name']),
      schedule: Object.freeze(['Schedule', 'SCHEDULE', 'SCH']),
      wallThickness: Object.freeze(['Wall Thickness', 'WALL_THICKNESS', 'WT', 'WallThickness']),
      corrosion: Object.freeze(['Corrosion', 'Corrosion Allowance', 'CORROSION_ALLOWANCE', 'CA']),
      endCondition: Object.freeze(['End Condition', 'END_CONDITION', 'End Type']),
    }),
  }),
  material: Object.freeze({
    title: 'Material Map',
    sectionKey: 'material',
    rowsKey: 'mapRows',
    fieldMapKey: 'fieldMap',
    path: 'docs/Masters/PCF_MAT_MAP.TXT',
    aliases: Object.freeze({
      code: Object.freeze(['code', 'Code', 'Material Code', 'MATERIAL_CODE', 'CA3']),
      material: Object.freeze(['material', 'Material', 'Material_Name', 'Description', 'Name']),
      spec: Object.freeze(['Spec', 'Specification']),
    }),
  }),
  weight: Object.freeze({
    title: 'Weights / Valve CA8',
    sectionKey: 'weight',
    rowsKey: 'masterRows',
    fieldMapKey: 'fieldMap',
    path: 'docs/Masters/wtValveweights.json',
    aliases: Object.freeze({
      bore: Object.freeze(['convertedBore', 'Converted Bore', 'Size (NPS)', 'Size', 'NPS', 'NS', 'DN', 'NB', 'Bore']),
      rating: Object.freeze(['Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']),
      length: Object.freeze(['Length (RF-F/F)', 'RF-F/F', 'Length', 'LEN', 'Face To Face', 'faceToFace']),
      valveType: Object.freeze(['Type Description', 'TypeDesc', 'Valve Type', 'Type', 'Description']),
      weight: Object.freeze(['RF/RTJ KG', 'Valve Weight', 'Weight', 'weight', 'valveWeight']),
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

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[_\-/()."'°]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreHeader(header, aliases) {
  const h = normalizeHeader(header);
  if (!h) return 0;
  let best = 0;
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

function parseJsonRows(rawText) {
  const parsed = JSON.parse(rawText || '[]');
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

function rawUrlForMasterPath(masterPath) {
  const encoded = text(masterPath).split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
  return `${RAW_BASE}${encoded}`;
}

function masterPathFromUrl(input) {
  const raw = typeof input === 'string' || input instanceof URL ? text(input) : text(input?.url || '');
  if (!raw || !/docs\/Masters\//i.test(raw)) return '';
  try {
    const url = new URL(raw, location.href);
    const match = url.pathname.match(/(?:^|\/)docs\/Masters\/([^/?#]+)$/i);
    return match ? `docs/Masters/${decodeURIComponent(match[1])}` : '';
  } catch {
    const match = raw.match(/docs\/Masters\/([^/?#]+)$/i);
    return match ? `docs/Masters/${decodeURIComponent(match[1])}` : '';
  }
}

function isPipingMasterPath(masterPath) {
  return /Piping_class_master\.json$/i.test(text(masterPath));
}

function pipingPlaceholderResponse() {
  return new Response(JSON.stringify([PIPING_PLACEHOLDER_ROW]), {
    status: 200,
    headers: { 'content-type': 'application/json;charset=utf-8', 'x-xml-cii-smart-master': 'piping-class-placeholder' },
  });
}

function candidateUrls(masterPath) {
  const filename = text(masterPath).split('/').pop();
  const origin = location.origin;
  return unique([
    new URL(`../${masterPath}`, import.meta.url).href,
    new URL(`../../${masterPath}`, import.meta.url).href,
    `${origin}${appBasePath()}${masterPath}`,
    `${origin}/${masterPath}`,
    rawUrlForMasterPath(masterPath),
    filename ? rawUrlForMasterPath(`docs/Masters/${filename}`) : '',
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

    if (isPipingMasterPath(masterPath) && !/[?&]xmlCiiFullMaster=1\b/.test(rawInput)) {
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

async function fetchTextFromCandidates(section, { fullPiping = false } = {}) {
  const errors = [];
  for (const url of candidateUrls(section.path)) {
    try {
      const requestUrl = fullPiping && isPipingMasterPath(section.path)
        ? `${url}${url.includes('?') ? '&' : '?'}xmlCiiFullMaster=1`
        : url;
      const fetchFn = fullPiping ? (window.__xmlCiiMasterOriginalFetch || window.fetch).bind(window) : window.fetch.bind(window);
      const response = await fetchFn(requestUrl, { cache: 'no-store', mode: 'cors' });
      if (!response.ok) {
        errors.push(`${requestUrl}: HTTP ${response.status}`);
        continue;
      }
      const rawText = await response.text();
      if (!clean(rawText)) {
        errors.push(`${requestUrl}: empty response`);
        continue;
      }
      return { rawText, url: requestUrl };
    } catch (error) {
      errors.push(`${url}: ${clean(error?.message || error)}`);
    }
  }
  throw new Error(`${section.title} default master failed to load. Tried: ${errors.join(' | ')}`);
}

async function fetchRows(sectionKey, section, options = {}) {
  const { rawText, url } = await fetchTextFromCandidates(section, options);
  const rows = sectionKey === 'material' ? parseMaterialMap(rawText) : parseJsonRows(rawText);
  if (!Array.isArray(rows) || rows.length <= 0) throw new Error(`${section.title} default master loaded 0 rows from ${url}`);
  return { rows, url };
}

function dispatchConfigChange(input) {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
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

function sectionIsSmartLoaded(config, sectionKey) {
  const section = config?.[sectionKey];
  return section && (section._smartMode === 'on-demand' || section._smartMode === 'filtered-on-demand');
}

function missingMasterSignature(config) {
  return Object.entries(MASTER_SOURCES)
    .map(([key, section]) => `${key}:${rowCount(section, config[section.sectionKey])}:${config?.[section.sectionKey]?._smartMode || ''}`)
    .join('|');
}

function ensurePipingPlaceholder(config, url = rawUrlForMasterPath(PIPING_MASTER_PATH)) {
  const section = ensureSection(config, MASTER_SOURCES.pipingClass);
  const rows = Array.isArray(section.masterRows) ? section.masterRows : [];
  if (rows.length && !rows.every((row) => row?._smartMasterPlaceholder)) return false;
  section.masterRows = [{ ...PIPING_PLACEHOLDER_ROW }];
  section.fieldMap = {
    pipingClass: 'Piping Class',
    convertedBore: 'convertedBore',
    materialName: 'Material_Name',
    rating: 'Rating',
    wallThickness: 'Wall thickness',
    corrosion: 'Corrosion',
    ...(section.fieldMap || {}),
  };
  section.masterUrl = section.masterUrl || url;
  section.defaultUrl = section.defaultUrl || url;
  section._smartMode = 'on-demand';
  section._autoloadedRows = 0;
  section._sourceTotalRows = section._sourceTotalRows || 10699;
  section._note = 'Full piping class master is not embedded. It is fetched and filtered when XML/line-list keys are available.';
  return true;
}

function rawValue(row, key) {
  if (!row || !key) return '';
  if (row[key] != null && clean(row[key]) !== '') return clean(row[key]);
  if (row._raw && row._raw[key] != null && clean(row._raw[key]) !== '') return clean(row._raw[key]);
  return '';
}

function firstRowValue(row, keys) {
  for (const key of keys || []) {
    const value = rawValue(row, key);
    if (value) return value;
  }
  return '';
}

function normalizeClass(value) {
  return clean(value).toUpperCase().replace(/\s+/g, '').replace(/^["']|["']$/g, '');
}

function normalizeBore(value) {
  const source = clean(value).toLowerCase();
  if (!source) return '';
  const n = Number(source.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return '';
  if (/in|"/.test(source) && n < 100) {
    const npsToDn = new Map([[0.5, 15], [0.75, 20], [1, 25], [1.5, 40], [2, 50], [3, 80], [4, 100], [6, 150], [8, 200], [10, 250], [12, 300], [14, 350], [16, 400], [18, 450], [20, 500], [24, 600], [30, 750], [36, 900], [42, 1050], [48, 1200]]);
    return String(npsToDn.get(n) || Math.round(n * 25.4));
  }
  return String(Math.round(n));
}

function lineListPairs(config) {
  const list = config?.linelist || {};
  const rows = Array.isArray(list.masterRows) ? list.masterRows : [];
  const fm = list.fieldMap || {};
  const pairs = new Map();

  for (const row of rows) {
    const cls = normalizeClass(firstRowValue(row, ['pipingClass', 'Piping Class', 'PIPING_CLASS', 'Class', fm.pipingClass].filter(Boolean)));
    const bore = normalizeBore(firstRowValue(row, ['convertedBore', 'Bore', 'Size', 'NPS', 'DN', 'NB', fm.convertedBore].filter(Boolean)));
    if (!cls) continue;
    const key = `${cls}|${bore || '*'}`;
    pairs.set(key, { cls, bore });
  }

  return [...pairs.values()];
}

async function fullPipingClassRows() {
  if (Array.isArray(window.__xmlCiiPipingClassFullRows) && window.__xmlCiiPipingClassFullRows.length) return window.__xmlCiiPipingClassFullRows;
  const { rows } = await fetchRows('pipingClass', MASTER_SOURCES.pipingClass, { fullPiping: true });
  window.__xmlCiiPipingClassFullRows = rows;
  return rows;
}

function filterPipingRows(rows, pairs) {
  if (!Array.isArray(rows) || !pairs.length) return [];
  const classSet = new Set(pairs.map((p) => p.cls).filter(Boolean));
  const exactPairs = new Set(pairs.filter((p) => p.cls && p.bore).map((p) => `${p.cls}|${p.bore}`));
  const classOnly = pairs.some((p) => p.cls && !p.bore);

  return rows.filter((row) => {
    const cls = normalizeClass(row['Piping Class'] ?? row.PIPING_CLASS ?? row.Class ?? row.Spec ?? row.SPEC);
    if (!classSet.has(cls)) return false;
    if (classOnly) return true;
    const bore = normalizeBore(row.convertedBore ?? row['Converted Bore'] ?? row.Size ?? row.NPS ?? row.DN ?? row.NB ?? row.Bore);
    return exactPairs.has(`${cls}|${bore}`);
  });
}

let hydrateBusy = false;
let lastHydrateSignature = '';

async function hydratePipingMasterFromLineList({ force = false } = {}) {
  if (hydrateBusy) return;
  const input = document.querySelector(INPUT_SELECTOR);
  if (!input) return;
  const config = parseConfig(input);
  if (!config) return;
  const pairs = lineListPairs(config);
  if (!pairs.length) return;

  const signature = pairs.map((p) => `${p.cls}|${p.bore || '*'}`).sort().join(';');
  const piping = config.pipingClass || {};
  const currentRows = Array.isArray(piping.masterRows) ? piping.masterRows.filter((row) => !row?._smartMasterPlaceholder) : [];
  if (!force && signature === lastHydrateSignature && currentRows.length > 0 && piping._smartMode === 'filtered-on-demand') return;

  hydrateBusy = true;
  lastHydrateSignature = signature;
  showStatus(`Filtering Piping Class master for ${pairs.length} line-list class/bore key(s)…`);

  try {
    const allRows = await fullPipingClassRows();
    const filtered = filterPipingRows(allRows, pairs);
    const section = ensureSection(config, MASTER_SOURCES.pipingClass);
    section.masterRows = filtered.length ? filtered : [{ ...PIPING_PLACEHOLDER_ROW }];
    section.fieldMap = autoFieldMap(filtered.length ? filtered : allRows.slice(0, 20), MASTER_SOURCES.pipingClass, section.fieldMap);
    section.masterUrl = rawUrlForMasterPath(PIPING_MASTER_PATH);
    section.defaultUrl = rawUrlForMasterPath(PIPING_MASTER_PATH);
    section._smartMode = filtered.length ? 'filtered-on-demand' : 'on-demand';
    section._sourceTotalRows = allRows.length;
    section._autoloadedRows = filtered.length;
    section._filterKeyCount = pairs.length;
    section._filteredAt = new Date().toISOString();
    input.value = JSON.stringify(config, null, 2);
    dispatchConfigChange(input);

    const msg = filtered.length
      ? `Piping Class filtered: ${filtered.length} of ${allRows.length} row(s) kept for this line list.`
      : `Piping Class kept on-demand: no class/bore rows matched ${pairs.length} key(s).`;
    showStatus(msg, filtered.length ? 'ok' : 'info');
    notify({ level: filtered.length ? 'success' : 'warning', title: 'XML->CII Masters', message: msg });
    maybeRefreshWorkflow();
  } catch (error) {
    const msg = `Piping Class smart filter failed: ${clean(error?.message || error)}`;
    showStatus(msg, 'error');
    notify({ level: 'error', title: 'XML->CII Masters', message: msg });
  } finally {
    hydrateBusy = false;
  }
}

let busy = false;
let lastAttemptSignature = '';
let lastFailureSignature = '';
let failureNotified = false;

async function autoloadMasters(input) {
  if (busy) return;
  const config = parseConfig(input);
  if (config == null) return;
  if (config.disableDefaultMasterAutoload === true || config._disableDefaultMasterAutoload === true) return;

  const signature = missingMasterSignature(config);
  const missing = Object.entries(MASTER_SOURCES).filter(([sectionKey, section]) => {
    const target = config[section.sectionKey];
    if (sectionKey === 'pipingClass' && sectionIsSmartLoaded(config, sectionKey)) return false;
    return rowCount(section, target) <= 0;
  });

  if (!missing.length) {
    hydratePipingMasterFromLineList().catch((error) => console.warn('XML->CII piping smart filter failed', error));
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
        if (sectionKey === 'pipingClass') {
          ensurePipingPlaceholder(config);
          loaded.push('Piping Class: smart on-demand (full 10,699-row preview skipped)');
          continue;
        }

        const { rows, url } = await fetchRows(sectionKey, section);
        target[section.rowsKey] = rows;
        target[section.fieldMapKey] = autoFieldMap(rows, section, target[section.fieldMapKey]);
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
        mode: 'smart-piping-on-demand; compact config',
        counts: Object.fromEntries(Object.entries(MASTER_SOURCES).map(([key, section]) => [key, rowCount(section, config[section.sectionKey])])),
      };
      input.value = JSON.stringify(config, null, 2);
      dispatchConfigChange(input);
      showStatus(`Autoloaded ${loaded.join(' · ')}.`, 'ok');
      notify({ level: 'success', title: 'XML->CII Masters', message: `Autoloaded ${loaded.join(' · ')}.` });
      maybeRefreshWorkflow();
      hydratePipingMasterFromLineList().catch((error) => console.warn('XML->CII piping smart filter failed', error));
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
}

let raf = 0;
let observer = null;

function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const input = document.querySelector(INPUT_SELECTOR);
    if (!input) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    autoloadMasters(input).catch((error) => console.warn('XML->CII master autoload failed', error));
  });
}

export function installXmlCiiDefaultMasterAutoload() {
  if (!isBrowserReady()) return;
  if (window[FLAG]) return;
  window[FLAG] = true;
  installMasterFetchFallback();
  schedule();

  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (document.querySelector(INPUT_SELECTOR)) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-xml-cii-phase], [data-json-popup-key="supportConfigJson"], [data-xml-cii-load-default]')) schedule();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.matches?.(INPUT_SELECTOR)) {
      lastAttemptSignature = '';
      lastFailureSignature = '';
      schedule();
      hydratePipingMasterFromLineList({ force: true }).catch((error) => console.warn('XML->CII piping smart filter failed', error));
    }
    if (event.target?.matches?.('input[type="file"]')) {
      setTimeout(() => hydratePipingMasterFromLineList({ force: true }).catch((error) => console.warn('XML->CII piping smart filter failed', error)), 0);
    }
  }, true);
}
