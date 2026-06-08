const FLAG = '__xmlCiiRunInputProcessPatch_v1';
const SUPPORT_CONFIG_SELECTOR = '[data-option-key="supportConfigJson"]';
const RUN_SELECTOR = '#model-converters-run';
const PRIMARY_SELECTOR = '#model-converters-primary-input';
const CONVERTER_SELECTOR = '#model-converters-select';

function text(value) { return value == null ? '' : String(value); }
function clean(value) { return text(value).replace(/\s+/g, ' ').trim(); }
function norm(value) { return clean(value).toUpperCase().replace(/[\s_.\-\/()"']/g, ''); }
function isObj(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function localName(el) { return clean(el?.localName || el?.nodeName).replace(/^.*:/, '').toLowerCase(); }
function childrenByName(parent, name) { return Array.from(parent?.children || []).filter((el) => localName(el) === name.toLowerCase()); }
function firstChild(parent, name) { return childrenByName(parent, name)[0] || null; }
function firstText(parent, name) { return clean(firstChild(parent, name)?.textContent); }
function rowValue(row, keys) {
  for (const key of (keys || []).filter(Boolean)) {
    if (row?.[key] != null && clean(row[key]) !== '') return text(row[key]);
    if (row?._raw?.[key] != null && clean(row._raw[key]) !== '') return text(row._raw[key]);
  }
  return '';
}
function numberText(value, preferLast = false) {
  const nums = clean(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) || [];
  return nums.length ? nums[preferLast ? nums.length - 1 : 0] : '';
}
function readConfig() {
  const input = document.querySelector(SUPPORT_CONFIG_SELECTOR);
  try {
    const cfg = JSON.parse(input?.value || '{}');
    cfg.linelist = isObj(cfg.linelist) ? cfg.linelist : {};
    cfg.linelist.fieldMap = isObj(cfg.linelist.fieldMap) ? cfg.linelist.fieldMap : {};
    cfg.linelist.masterRows = Array.isArray(cfg.linelist.masterRows) ? cfg.linelist.masterRows : [];
    cfg.overrides = isObj(cfg.overrides) ? cfg.overrides : {};
    cfg.overrides.processData = isObj(cfg.overrides.processData) ? cfg.overrides.processData : {};
    return cfg;
  } catch { return { linelist: { fieldMap: {}, masterRows: [] }, overrides: { processData: {} } }; }
}
function lineKeyFromBranch(branchName, cfg) {
  const ll = cfg.linelist || {};
  const tokens = clean(branchName).replace(/^\/+/, '').replace(/\/B\d+$/i, '').split(ll.tokenDelimiter || '-').map((p) => p.trim()).filter(Boolean);
  const positions = Array.isArray(ll.lineKeyTokenPositions) ? ll.lineKeyTokenPositions : text(ll.lineKeyTokenPositions || '4').split(/[,+]/).map((x) => Number(x.trim())).filter(Boolean);
  return positions.map((p) => tokens[Math.round(p) - 1] || '').filter(Boolean).join(text(ll.lineKeyJoiner || '')) || tokens[3] || '';
}
function rowLineKey(row, cfg) {
  const fm = cfg.linelist?.fieldMap || {};
  const composite = `${clean(rowValue(row, [fm.lineKey1, 'lineKey1']))}${clean(rowValue(row, [fm.lineKey2, 'lineKey2']))}`;
  if (composite && !/^service\s*line\s*(number|no)?$/i.test(composite)) return composite;
  return rowValue(row, [fm.lineNoKey, fm.lineNo, fm.lineSeqNo, 'lineNoKey', 'lineNo', 'lineKey', 'lineSeqNo', 'Line No', 'Line Number', 'ColumnX1']);
}
function matchingRow(lineKey, cfg) {
  const wanted = norm(lineKey);
  return (cfg.linelist?.masterRows || []).find((row) => norm(rowLineKey(row, cfg)) === wanted) || null;
}
function valueFor(lineKey, cfg, field, fallbacks = [], preferLast = false) {
  const override = cfg.overrides?.processData?.[lineKey]?.[field] || cfg.overrides?.processData?.[norm(lineKey)]?.[field];
  if (clean(override)) return clean(override);
  const row = matchingRow(lineKey, cfg);
  if (!row) return '';
  const fm = cfg.linelist?.fieldMap || {};
  const raw = rowValue(row, [fm[field], field, ...fallbacks]);
  return numberText(raw, preferLast) || clean(raw);
}
function ensureChild(doc, parent, name) {
  let child = firstChild(parent, name);
  if (!child) {
    child = parent.namespaceURI ? doc.createElementNS(parent.namespaceURI, name) : doc.createElement(name);
    parent.appendChild(child);
  }
  return child;
}
function setChild(doc, parent, name, value) {
  const v = clean(value);
  if (!v) return false;
  ensureChild(doc, parent, name).textContent = v;
  return true;
}
function patchXml(xmlText, cfg) {
  if (!/<\s*Branchname\b/i.test(xmlText)) return xmlText;
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) return xmlText;
  let changed = false;
  for (const branch of Array.from(doc.getElementsByTagName('*')).filter((el) => localName(el) === 'branch')) {
    const lineKey = lineKeyFromBranch(firstText(branch, 'Branchname'), cfg);
    if (!lineKey) continue;
    const pressure = ensureChild(doc, branch, 'Pressure');
    const temperature = ensureChild(doc, branch, 'Temperature');
    changed = setChild(doc, pressure, 'Pressure1', valueFor(lineKey, cfg, 'p1', ['P1', 'Design Pressure', 'Operating Pressure'])) || changed;
    changed = setChild(doc, pressure, 'HydroPressure', valueFor(lineKey, cfg, 'hydroPressure', ['HydroPressure', 'Hydro Pressure', 'Hydro Test Pressure', 'Test Pressure'], true) || firstText(pressure, 'HydroPressure') || '0') || changed;
    changed = setChild(doc, temperature, 'Temperature1', valueFor(lineKey, cfg, 't1', ['T1', 'Temp Max', 'Temperature Max'])) || changed;
    changed = setChild(doc, temperature, 'Temperature2', valueFor(lineKey, cfg, 't2', ['T2', 'Temp', 'Temperature'])) || changed;
    changed = setChild(doc, temperature, 'Temperature3', valueFor(lineKey, cfg, 't3', ['T3', 'Temp Min', 'Temperature Min'], true)) || changed;
    const density = valueFor(lineKey, cfg, 'density', ['Density'], true) || valueFor(lineKey, cfg, 'densityMixed', ['Mixed kg/m3', 'Mixed kg/m³', 'Density Mixed'], true) || valueFor(lineKey, cfg, 'densityGas', ['Gas kg/m3', 'Gas kg/m³', 'Density Gas'], true) || valueFor(lineKey, cfg, 'densityLiquid', ['Liquid kg/m3', 'Liquid kg/m³', 'Density Liquid'], true);
    changed = setChild(doc, branch, 'FluidDensity', density) || changed;
    changed = setChild(doc, branch, 'InsulationThickness', valueFor(lineKey, cfg, 'insThk', ['InsThk', 'Insulation Thickness'])) || changed;
  }
  return changed ? new XMLSerializer().serializeToString(doc) : xmlText;
}
async function handleRunClick(event) {
  const run = event.target?.closest?.(RUN_SELECTOR);
  if (!run || run.dataset.xmlCiiInputPatched === 'true') return;
  const converter = document.querySelector(CONVERTER_SELECTOR)?.value || '';
  if (converter !== 'xml_to_cii') return;
  const input = document.querySelector(PRIMARY_SELECTOR);
  const file = input?.files?.[0];
  if (!file || !/\.xml$/i.test(file.name || '')) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const patchedText = patchXml(await file.text(), readConfig());
  if (patchedText !== await file.text()) {
    const patchedFile = new File([patchedText], file.name, { type: file.type || 'application/xml', lastModified: file.lastModified });
    const dt = new DataTransfer();
    dt.items.add(patchedFile);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  run.dataset.xmlCiiInputPatched = 'true';
  run.click();
  setTimeout(() => { delete run.dataset.xmlCiiInputPatched; }, 0);
}
export function installXmlCiiRunInputProcessPatch() {
  if (window[FLAG]) return;
  window[FLAG] = true;
  document.addEventListener('click', (event) => { void handleRunClick(event); }, true);
}
installXmlCiiRunInputProcessPatch();
