const FLAG = '__xmlCiiLineListSmartMap_v1';
const INPUT_SELECTOR = '[data-option-key="supportConfigJson"]';

const TARGETS = Object.freeze({
  lineKey1: Object.freeze(['service']),
  lineKey2: Object.freeze(['line number', 'line no', 'lineno', 'line']),
  pipingClass: Object.freeze(['piping class', 'pipe class', 'spec class', 'class spec', 'spec']),
  t1: Object.freeze(['temp max', 'maximum temp', 'max temp', 't1']),
  t2: Object.freeze(['temp ºc', 'temp °c', 'temperature ºc', 'temperature °c', 'operating temp', 'normal temp', 't2']),
  t3: Object.freeze(['temp min', 'minimum temp', 'min temp', 't3']),
  hydroPressure: Object.freeze(['test pressure', 'hydro pressure', 'hydro test pressure', 'hydrostatic pressure', 'pressure test', 'proof pressure', 'hp']),
  insThk: Object.freeze(['insulation thickness', 'ins thickness', 'insul thickness', 'ins thk', 'insulation thk']),
  densityMixed: Object.freeze(['mixed kg/m3', 'mixed kg/m³', 'mixed density', 'density mixed']),
  densityGas: Object.freeze(['gas kg/m3', 'gas kg/m³', 'density gas', 'gas density']),
  densityLiquid: Object.freeze(['liquid kg/m3', 'liquid kg/m³', 'density liquid', 'liquid density']),
  phase: Object.freeze(['fluid', 'phase', 'fluid phase', 'medium']),
});

function text(value) { return value == null ? '' : String(value); }
function clean(value) { return text(value).replace(/\s+/g, ' ').trim(); }
function canon(value) {
  return clean(value)
    .toLowerCase()
    .replace(/º/g, '°')
    .replace(/³/g, '3')
    .replace(/[_\-()[\]/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function normKey(value) { return clean(value).toUpperCase().replace(/[\s_.\-\/()"']/g, ''); }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function isMissingData(value) { const v = clean(value); return !v || v === '-' || /^n\/?a$/i.test(v); }
function firstNumeric(value, preferLast = false) {
  const nums = clean(value).match(/-?\d+(?:\.\d+)?/g) || [];
  if (!nums.length) return '';
  return nums[preferLast ? nums.length - 1 : 0];
}

function parseConfig() {
  const input = document.querySelector(INPUT_SELECTOR);
  if (!input) return { input: null, cfg: null };
  try {
    const cfg = JSON.parse(input.value || '{}');
    cfg.linelist = isObject(cfg.linelist) ? cfg.linelist : {};
    cfg.linelist.fieldMap = isObject(cfg.linelist.fieldMap) ? cfg.linelist.fieldMap : {};
    cfg.linelist.masterRows = Array.isArray(cfg.linelist.masterRows) ? cfg.linelist.masterRows : [];
    cfg.overrides = isObject(cfg.overrides) ? cfg.overrides : {};
    cfg.overrides.processData = isObject(cfg.overrides.processData) ? cfg.overrides.processData : {};
    return { input, cfg };
  } catch {
    return { input, cfg: null };
  }
}
function writeConfig(input, cfg) {
  const next = JSON.stringify(cfg, null, 2);
  if (input.value === next) return false;
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
function rowValue(row, keys) {
  for (const key of (keys || []).filter(Boolean)) {
    if (row?.[key] != null && clean(row[key]) !== '') return text(row[key]);
    if (row?._raw?.[key] != null && clean(row._raw[key]) !== '') return text(row._raw[key]);
  }
  return '';
}
function allKeys(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) if (!seen.has(key)) { seen.add(key); out.push(key); }
    for (const key of Object.keys(row?._raw || {})) if (!seen.has(key)) { seen.add(key); out.push(key); }
  }
  return out.filter((key) => key !== '_raw');
}
function columnSamples(rows, key, limit = 10) {
  const values = [];
  for (const row of rows || []) {
    const v = rowValue(row, [key]);
    if (clean(v) !== '') values.push(clean(v));
    if (values.length >= limit) break;
  }
  return values;
}
function columnProbe(rows, key) {
  return canon([key, ...columnSamples(rows, key, 12)].join(' | '));
}
function includesAny(probe, aliases) {
  return aliases.some((alias) => probe.includes(canon(alias)));
}
function scoreTarget(target, key, rows) {
  const probe = columnProbe(rows, key);
  const header = canon(key);
  let score = 0;
  if (includesAny(probe, TARGETS[target] || [])) score += 80;
  if (includesAny(header, TARGETS[target] || [])) score += 20;

  if (target === 'lineKey1' && /service/.test(probe)) score += 50;
  if (target === 'lineKey2' && /line\s*(number|no)/.test(probe)) score += 55;
  if (target === 'pipingClass' && /piping\s*class/.test(probe)) score += 70;
  if (target === 't1' && /temp/.test(probe) && /max/.test(probe)) score += 80;
  if (target === 't2' && /temp/.test(probe) && !/max|min/.test(probe)) score += 60;
  if (target === 't3' && /temp/.test(probe) && /min/.test(probe)) score += 80;
  if (target === 'hydroPressure' && /pressure/.test(probe) && /(test|hydro|hydrostatic|proof)/.test(probe)) score += 95;
  if (target === 'insThk' && /insulation/.test(probe) && /(thickness|thk)/.test(probe)) score += 95;
  if (target === 'densityMixed' && /mixed/.test(probe) && /(kg\/m3|density)/.test(probe)) score += 95;
  if (target === 'densityGas' && /gas/.test(probe) && /(kg\/m3|density)/.test(probe)) score += 95;
  if (target === 'densityLiquid' && /liquid/.test(probe) && /(kg\/m3|density)/.test(probe)) score += 95;
  if (target === 'phase' && /(fluid|phase)/.test(probe)) score += 80;

  // Avoid the generic Density column taking mixed/liquid when a specific gas/liquid token is present.
  if (target === 'densityMixed' && /gas|liquid/.test(probe) && !/mixed/.test(probe)) score -= 80;
  if (target === 'densityGas' && /liquid|mixed/.test(probe) && !/gas/.test(probe)) score -= 80;
  if (target === 'densityLiquid' && /gas|mixed/.test(probe) && !/liquid/.test(probe)) score -= 80;
  if (target === 't2' && /max|min/.test(probe)) score -= 90;
  if (target === 't1' && /min/.test(probe)) score -= 90;
  if (target === 't3' && /max/.test(probe)) score -= 90;
  return score;
}
function detectMap(rows, existing = {}) {
  const keys = allKeys(rows);
  const result = { ...(existing || {}) };
  const claimed = new Set(Object.values(result).filter(Boolean));
  for (const target of Object.keys(TARGETS)) {
    let best = '';
    let bestScore = 0;
    for (const key of keys) {
      if (claimed.has(key) && result[target] !== key) continue;
      const score = scoreTarget(target, key, rows);
      if (score > bestScore) { bestScore = score; best = key; }
    }
    if (best && bestScore >= 80) {
      result[target] = best;
      claimed.add(best);
    }
  }
  if (!result.density && result.densityMixed) result.density = result.densityMixed;
  return result;
}
function goodValue(value) { return !isMissingData(value); }
function normalizedValue(row, map, target) {
  const v = rowValue(row, [map?.[target], target]);
  return clean(v);
}
function computeLineKey(row, map) {
  const key1 = normalizedValue(row, map, 'lineKey1');
  const key2 = normalizedValue(row, map, 'lineKey2');
  const composite = `${key1}${key2}`;
  if (goodValue(composite) && !/^service\s*line\s*(number|no)?$/i.test(composite)) return composite;
  return rowValue(row, ['lineNo', 'lineNoKey', 'Line No. Key', 'Line No Key', 'lineKey', 'LineKey', map.lineSeqNo, map.lineNo]);
}
function normalizeRows(cfg) {
  const rows = cfg.linelist.masterRows || [];
  const map = cfg.linelist.fieldMap || {};
  let changed = false;
  for (const row of rows) {
    const lineKey = clean(computeLineKey(row, map));
    if (lineKey && clean(row.lineNoKey) !== lineKey) { row.lineNoKey = lineKey; changed = true; }
    if (lineKey && clean(row.lineNo) !== lineKey) { row.lineNo = lineKey; changed = true; }
    if (lineKey && clean(row.lineKey) !== lineKey) { row.lineKey = lineKey; changed = true; }

    const simpleFields = ['pipingClass', 't1', 't2', 't3', 'hydroPressure', 'insThk', 'densityMixed', 'densityGas', 'densityLiquid', 'phase'];
    for (const field of simpleFields) {
      const value = normalizedValue(row, map, field);
      if (goodValue(value) && clean(row[field]) !== value) { row[field] = value; changed = true; }
    }
    const density = goodValue(row.densityMixed) ? row.densityMixed : (goodValue(row.densityGas) ? row.densityGas : (goodValue(row.densityLiquid) ? row.densityLiquid : normalizedValue(row, map, 'density')));
    if (goodValue(density) && clean(row.density) !== clean(density)) { row.density = clean(density); changed = true; }

    // Store numeric extraction helpers used by preview/converter while keeping raw row intact.
    const numericTargets = { t1: false, t2: false, t3: false, hydroPressure: false, insThk: false, density: true, densityMixed: true, densityGas: true, densityLiquid: true };
    for (const [field, preferLast] of Object.entries(numericTargets)) {
      const numeric = firstNumeric(row[field], preferLast);
      if (numeric && clean(row[`${field}Numeric`]) !== numeric) { row[`${field}Numeric`] = numeric; changed = true; }
    }

    if (lineKey) {
      const process = cfg.overrides.processData[lineKey] || {};
      for (const field of ['pipingClass', 't1', 't2', 't3', 'hydroPressure', 'insThk', 'density', 'densityMixed', 'densityGas', 'densityLiquid', 'phase']) {
        const value = clean(row[field]);
        if (goodValue(value) && clean(process[field]) !== value) { process[field] = value; changed = true; }
      }
      cfg.overrides.processData[lineKey] = process;
    }
  }
  return changed;
}
function applySmartMap() {
  const { input, cfg } = parseConfig();
  if (!input || !cfg) return;
  const rows = cfg.linelist.masterRows;
  if (!rows.length) return;
  const nextMap = detectMap(rows, cfg.linelist.fieldMap);
  const old = JSON.stringify(cfg.linelist.fieldMap || {});
  cfg.linelist.fieldMap = nextMap;
  let changed = old !== JSON.stringify(nextMap);
  changed = normalizeRows(cfg) || changed;
  if (changed) writeConfig(input, cfg);
}
let raf = 0;
function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(applySmartMap);
}
export function installXmlCiiLineListSmartMap() {
  if (window[FLAG]) return;
  window[FLAG] = true;
  schedule();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-xml-cii-auto-map="linelist"], [data-xml-cii-save-master="linelist"], [data-xml-cii-master-tab="linelist"]')) {
      setTimeout(schedule, 0);
      setTimeout(schedule, 300);
    }
  }, true);
  document.addEventListener('change', (event) => { if (event.target?.matches?.(INPUT_SELECTOR)) schedule(); }, true);
}
installXmlCiiLineListSmartMap();
