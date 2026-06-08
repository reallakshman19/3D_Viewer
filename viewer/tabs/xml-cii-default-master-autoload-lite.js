const FLAG = '__xmlCiiDefaultMaterialWeightAutoload_v1';
const INPUT_SELECTOR = '[data-option-key="supportConfigJson"]';
const MASTER_BASE = 'https://raw.githubusercontent.com/reallaksh19/3D_Viewer/main/docs/Masters/';

const DEFAULTS = Object.freeze({
  material: Object.freeze({
    title: 'Material Map',
    sectionKey: 'material',
    rowsKey: 'mapRows',
    filename: 'PCF_MAT_MAP.TXT',
    parse: parseMaterialMap,
    fieldMap: Object.freeze({ code: 'code', material: 'material' }),
  }),
  weight: Object.freeze({
    title: 'Weights / Valve CA8',
    sectionKey: 'weight',
    rowsKey: 'masterRows',
    filename: 'wtValveweights.json',
    parse: parseJsonRows,
    aliases: Object.freeze({
      bore: Object.freeze(['convertedBore', 'Converted Bore', 'Size (NPS)', 'Size', 'NPS', 'DN', 'NB', 'Bore']),
      rating: Object.freeze(['Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']),
      length: Object.freeze(['Length (RF-F/F)', 'RF-F/F', 'Length', 'LEN', 'Face To Face', 'faceToFace']),
      valveType: Object.freeze(['Type Description', 'Valve Type', 'Type', 'Description']),
      weight: Object.freeze(['RF/RTJ KG', 'Valve Weight', 'Weight', 'weight', 'valveWeight']),
    }),
  }),
});

function text(value) { return value == null ? '' : String(value); }
function clean(value) { return text(value).replace(/\s+/g, ' ').trim(); }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }

function parseConfig() {
  const input = document.querySelector(INPUT_SELECTOR);
  if (!input) return { input: null, config: null };
  try {
    const config = JSON.parse(input.value || '{}');
    return { input, config: isObject(config) ? config : {} };
  } catch {
    return { input, config: null };
  }
}

function writeConfig(input, config) {
  const next = JSON.stringify(config, null, 2);
  if (input.value === next) return;
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function parseJsonRows(rawText) {
  const parsed = JSON.parse(rawText || '[]');
  if (Array.isArray(parsed)) return parsed;
  if (!isObject(parsed)) return [];
  for (const key of ['rows', 'masterRows', 'mapRows', 'data', 'items']) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value) && value.every((item) => isObject(item))) return value;
  }
  return [];
}

function parseMaterialMap(rawText) {
  return text(rawText)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d{4}$/.test(line))
    .map((line, index) => {
      const match = line.match(/^(\S+)\s+(.+)$/);
      return {
        _rowIndex: index + 1,
        code: match ? match[1].trim() : '',
        material: match ? match[2].trim() : line,
      };
    });
}

function rowKeys(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of (rows || []).slice(0, 50)) {
    for (const key of Object.keys(row || {})) {
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    }
  }
  return keys;
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[_\-/()."']/g, ' ').replace(/\s+/g, ' ').trim();
}

function autoFieldMap(rows, aliases, existingMap = {}) {
  const headers = rowKeys(rows);
  const next = { ...(existingMap || {}) };
  for (const [field, names] of Object.entries(aliases || {})) {
    if (next[field]) continue;
    let best = '';
    let score = 0;
    for (const header of headers) {
      const h = normalizeHeader(header);
      for (const name of names) {
        const n = normalizeHeader(name);
        const current = h === n ? 100 : (h.includes(n) || n.includes(h) ? 80 : 0);
        if (current > score) { score = current; best = header; }
      }
    }
    if (best && score >= 80) next[field] = best;
  }
  return next;
}

function candidateUrls(filename) {
  const encoded = encodeURIComponent(filename);
  const base = location.pathname.replace(/[^/]*$/, '');
  return Array.from(new Set([
    `docs/Masters/${encoded}`,
    `./docs/Masters/${encoded}`,
    `../docs/Masters/${encoded}`,
    `${location.origin}${base}docs/Masters/${encoded}`,
    `${location.origin}/3D_Viewer/docs/Masters/${encoded}`,
    `${MASTER_BASE}${encoded}`,
  ]));
}

async function fetchRows(def) {
  const errors = [];
  for (const url of candidateUrls(def.filename)) {
    try {
      const response = await fetch(url, { cache: 'force-cache', mode: 'cors' });
      if (!response.ok) { errors.push(`${url}: HTTP ${response.status}`); continue; }
      const rawText = await response.text();
      const rows = def.parse(rawText);
      if (!rows.length) { errors.push(`${url}: 0 rows`); continue; }
      return { rows, url };
    } catch (error) {
      errors.push(`${url}: ${clean(error?.message || error)}`);
    }
  }
  throw new Error(`${def.title} could not be loaded. ${errors.join(' | ')}`);
}

let busy = false;
let lastSignature = '';
async function autoloadDefaults() {
  if (busy) return;
  const { input, config } = parseConfig();
  if (!input || !config) return;
  const signature = Object.entries(DEFAULTS).map(([key, def]) => `${key}:${Array.isArray(config?.[def.sectionKey]?.[def.rowsKey]) ? config[def.sectionKey][def.rowsKey].length : 0}`).join('|');
  if (signature === lastSignature) return;
  lastSignature = signature;
  const missing = Object.entries(DEFAULTS).filter(([, def]) => !Array.isArray(config?.[def.sectionKey]?.[def.rowsKey]) || config[def.sectionKey][def.rowsKey].length <= 0);
  if (!missing.length) return;
  busy = true;
  const loaded = [];
  try {
    for (const [, def] of missing) {
      const { rows, url } = await fetchRows(def);
      const section = isObject(config[def.sectionKey]) ? config[def.sectionKey] : {};
      section[def.rowsKey] = rows;
      section.fieldMap = def.fieldMap ? { ...(section.fieldMap || {}), ...def.fieldMap } : autoFieldMap(rows, def.aliases, section.fieldMap || {});
      section.defaultUrl = section.defaultUrl || url;
      section.masterUrl = section.masterUrl || url;
      section._autoloadedFrom = url;
      section._autoloadedRows = rows.length;
      section._autoloadedAt = new Date().toISOString();
      config[def.sectionKey] = section;
      loaded.push(`${def.title}: ${rows.length} row(s)`);
    }
    config._xmlCiiDefaultMasters = {
      ...(config._xmlCiiDefaultMasters || {}),
      materialAndWeightLoadedAt: new Date().toISOString(),
      loaded,
      note: 'Material Map and Weights/Valve CA8 are autoloaded by default. Piping Class is not autoloaded.',
    };
    writeConfig(input, config);
    console.info(`XML->CII default masters loaded: ${loaded.join(' · ')}`);
  } catch (error) {
    console.warn('XML->CII default material/weight autoload failed:', error);
  } finally {
    busy = false;
  }
}

let raf = 0;
function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => autoloadDefaults());
}

export function installXmlCiiDefaultMaterialWeightAutoload() {
  if (window[FLAG]) return;
  window[FLAG] = true;
  schedule();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', (event) => { if (event.target?.matches?.(INPUT_SELECTOR)) schedule(); }, true);
}

installXmlCiiDefaultMaterialWeightAutoload();
