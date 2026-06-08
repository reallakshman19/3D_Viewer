const FLAG = '__xmlCiiLineListHydroScopedFix_v1';
const HYDRO_COL = 'data-xml-cii-hydro-col';
const PREVIEW_HYDRO_COL = 'data-xml-cii-preview-hydro-col';
const FIELD_STORAGE = 'xmlCii.hydroPressureField';
const POPUP_SELECTOR = '.model-converters-workflow-popup-overlay .model-converters-workflow-popup';

function txt(value) { return value == null ? '' : String(value); }
function clean(value) { return txt(value).replace(/\s+/g, ' ').trim(); }
function norm(value) { return clean(value).toUpperCase().replace(/\s+/g, ''); }
function activePopup() { return document.querySelector(POPUP_SELECTOR); }
function esc(value) { return txt(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function parseConfig() {
  const input = document.querySelector('[data-option-key="supportConfigJson"]');
  if (!input) return { input: null, cfg: null, linelist: null };
  try {
    const cfg = JSON.parse(input.value || '{}');
    cfg.linelist = cfg.linelist && typeof cfg.linelist === 'object' ? cfg.linelist : {};
    cfg.linelist.fieldMap = cfg.linelist.fieldMap && typeof cfg.linelist.fieldMap === 'object' ? cfg.linelist.fieldMap : {};
    cfg.linelist.masterRows = Array.isArray(cfg.linelist.masterRows) ? cfg.linelist.masterRows : [];
    cfg.overrides = cfg.overrides && typeof cfg.overrides === 'object' ? cfg.overrides : {};
    cfg.overrides.processData = cfg.overrides.processData && typeof cfg.overrides.processData === 'object' ? cfg.overrides.processData : {};
    return { input, cfg, linelist: cfg.linelist };
  } catch {
    return { input, cfg: null, linelist: null };
  }
}

function writeConfig(state, changed) {
  if (!changed || !state?.input || !state?.cfg) return false;
  const next = JSON.stringify(state.cfg, null, 2);
  if (state.input.value === next) return false;
  state.input.value = next;
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
  state.input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function rowValue(row, keys) {
  if (!row) return '';
  for (const key of (keys || []).filter(Boolean)) {
    if (row[key] != null && clean(row[key]) !== '') return txt(row[key]);
    if (row._raw && row._raw[key] != null && clean(row._raw[key]) !== '') return txt(row._raw[key]);
  }
  return '';
}

function allRowKeys(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    }
    for (const key of Object.keys(row?._raw || {})) {
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    }
  }
  return keys;
}

function detectHydroField(rows) {
  const keys = allRowKeys(rows);
  return keys.find((key) => {
    const probe = `${key} ${(rows || []).slice(0, 12).map((row) => `${rowValue(row, [key])}`).join(' ')}`.toUpperCase();
    return /HYDRO|HYD\s*TEST|TEST\s*PRESS|TESTPRESS|PROOF\s*PRESS/.test(probe);
  }) || '';
}

function preferredHydroField(linelist) {
  const rows = Array.isArray(linelist?.masterRows) ? linelist.masterRows : [];
  let field = clean(linelist?.fieldMap?.hydroPressure);
  if (!field) {
    try { field = clean(localStorage.getItem(FIELD_STORAGE)); } catch {}
  }
  if (!field) field = detectHydroField(rows);
  if (field) {
    try { localStorage.setItem(FIELD_STORAGE, field); } catch {}
  }
  return field;
}

function branchTokens(branchName, delimiter = '-') {
  return clean(branchName).replace(/^\/+/, '').replace(/\/B\d+$/i, '').split(txt(delimiter) || '-').map((token) => token.trim()).filter(Boolean);
}
function tokenAtPosition(branchName, delimiter, oneBasedIndex) {
  const index = Number(oneBasedIndex);
  if (!Number.isFinite(index) || index <= 0) return '';
  return branchTokens(branchName, delimiter)[Math.round(index) - 1] || '';
}
function tokenPositionList(value) {
  if (Array.isArray(value)) return value.map(Number).filter((entry) => Number.isFinite(entry) && entry > 0);
  return txt(value).split(/[,+]/).map((entry) => Number(entry.trim())).filter((entry) => Number.isFinite(entry) && entry > 0);
}
function regexGroup(value, pattern, groupIndex = 1) {
  const patternText = clean(pattern);
  if (!patternText) return '';
  try {
    const match = new RegExp(patternText, 'i').exec(txt(value));
    return clean(match?.[Math.max(0, Number(groupIndex || 0))]);
  } catch { return ''; }
}
function lineKeyFromBranch(branchName, linelist = {}) {
  const positions = tokenPositionList(linelist.lineKeyTokenPositions || '4');
  const byToken = positions.map((pos) => tokenAtPosition(branchName, linelist.tokenDelimiter || '-', pos)).filter(Boolean).join(txt(linelist.lineKeyJoiner));
  return byToken || regexGroup(branchName, linelist.branchNameRegex, linelist.lineNoGroup || 1);
}
function lineKeyFromRow(row, fieldMap = {}) {
  const key1 = rowValue(row, ['lineKey1', 'ColumnX1', 'LINEKEY1', 'Line Key 1', fieldMap.lineKey1]);
  const key2 = rowValue(row, ['lineKey2', 'ColumnX2', 'LINEKEY2', 'Line Key 2', fieldMap.lineKey2]);
  const composite = `${clean(key1)}${clean(key2)}`;
  if (composite) return composite;
  return rowValue(row, [
    'lineNo', 'lineNoKey', 'Line No. Key', 'Line No Key', 'lineKey', 'LineKey',
    'PipelineReference', 'Pipeline Ref', 'PIPELINE_REF', 'ColumnX1', 'lineSeqNo', 'Line Seq No.',
    fieldMap.lineSeqNo,
  ]);
}

const PROCESS_FIELD_KEYS = Object.freeze({
  p1: ['p1', 'P1', 'Design Pr', 'Operating Pressure', 'Op. Pr'],
  t1: ['t1', 'T1', 'Design Temp', 'Design Temperature', 'Operating Temp', 'Op. Temp'],
  t2: ['t2', 'T2', 'Temperature2', 'Temperature 2', 'Temp', 'Temp. C', 'Temp C', 'Temperature'],
  t3: ['t3', 'T3', 'Temperature3', 'Temperature 3', 'Temp Min', 'Min Temp', 'Minimum Temp'],
  insThk: ['insThk', 'InsThk', 'Insulation', 'Ins Thk', 'Insulation thickness'],
  density: ['density', 'Density', 'densityMixed', 'Density Mixed', 'Mixed kg/m3', 'Mixed Density', 'densityGas', 'Density Gas', 'Gas kg/m3', 'densityLiquid', 'Density Liquid', 'Liquid kg/m3'],
});

function syncLineListRows() {
  const st = parseConfig();
  if (!st.input || !st.cfg || !st.linelist) return false;
  const rows = st.linelist.masterRows;
  const fieldMap = st.linelist.fieldMap || {};
  let changed = false;

  if (!clean(st.linelist.lineKeyTokenPositions) && !clean(st.linelist.branchNameRegex)) {
    st.linelist.lineKeyTokenPositions = '4';
    changed = true;
  }

  const hydroField = preferredHydroField(st.linelist);
  if (hydroField && st.linelist.fieldMap.hydroPressure !== hydroField) {
    st.linelist.fieldMap.hydroPressure = hydroField;
    changed = true;
  }

  for (const row of rows) {
    const key = clean(lineKeyFromRow(row, fieldMap));
    if (key) {
      if (norm(row.lineNo) !== norm(key)) { row.lineNo = key; changed = true; }
      if (norm(row.lineNoKey) !== norm(key)) { row.lineNoKey = key; changed = true; }
      if (norm(row.lineKey) !== norm(key)) { row.lineKey = key; changed = true; }
    }
    for (const [target, keys] of Object.entries(PROCESS_FIELD_KEYS)) {
      const mapped = fieldMap[target] ? [fieldMap[target], ...keys] : keys;
      const value = rowValue(row, mapped);
      if (clean(value) && clean(row[target]) !== clean(value)) { row[target] = value; changed = true; }
    }
    const hydro = rowValue(row, [fieldMap.hydroPressure, hydroField, 'hydroPressure', 'Hydro Test Pressure', 'Hydrotest Pressure', 'Hydro Pressure', 'HYDRO_TEST_PRESSURE']);
    if (clean(hydro) && clean(row.hydroPressure) !== clean(hydro)) { row.hydroPressure = hydro; changed = true; }
    if (key && st.cfg.overrides?.processData) {
      const processOverride = st.cfg.overrides.processData[key] || {};
      for (const field of ['p1', 't1', 't2', 't3', 'insThk', 'density', 'hydroPressure']) {
        const value = clean(row[field]);
        if (value && clean(processOverride[field]) !== value) {
          processOverride[field] = value;
          st.cfg.overrides.processData[key] = processOverride;
          changed = true;
        }
      }
    }
  }
  return writeConfig(st, changed);
}

function hydroForLineKey(lineKey) {
  const st = parseConfig();
  const rows = st.linelist?.masterRows || [];
  for (const row of rows) {
    if (norm(lineKeyFromRow(row, st.linelist?.fieldMap || {})) === norm(lineKey)) {
      return rowValue(row, ['hydroPressure', st.linelist?.fieldMap?.hydroPressure, preferredHydroField(st.linelist)]);
    }
  }
  return '';
}

function cellTexts(row) { return Array.from(row?.children || []).map((cell) => clean(cell.textContent)); }
function addSavedRowsHydroColumn() {
  const popup = activePopup();
  const st = parseConfig();
  if (!popup || !st.linelist?.masterRows?.length) return;
  const hydroField = preferredHydroField(st.linelist);
  if (!hydroField) return;

  for (const table of Array.from(popup.querySelectorAll('table'))) {
    table.querySelectorAll(`[${HYDRO_COL}]`).forEach((node) => node.remove());
    const headerRow = Array.from(table.querySelectorAll('tr')).find((tr) => {
      const joined = cellTexts(tr).join('|').toLowerCase();
      return (joined.includes('line no. key') || joined.includes('line seq no') || joined.includes('_sourcerowindex'))
        && (joined.includes('p1') || joined.includes('t3') || joined.includes('density') || joined.includes('bore'));
    });
    if (!headerRow || cellTexts(headerRow).some((h) => /hydro\s*test\s*pressure/i.test(h))) continue;
    const heads = cellTexts(headerRow);
    const insertAfter = Math.max(0, heads.findIndex((h) => /^T3$/i.test(h) || /^P1$/i.test(h) || /density/i.test(h)));
    const sourceCol = Math.max(0, heads.findIndex((h) => /_sourcerowindex|source row|^#$/i.test(h)));
    const th = document.createElement('th');
    th.setAttribute(HYDRO_COL, 'true');
    th.textContent = 'Hydro Test Pressure';
    (headerRow.children[insertAfter] || headerRow.lastElementChild).insertAdjacentElement('afterend', th);

    Array.from(table.tBodies?.[0]?.rows || []).filter((tr) => tr !== headerRow && tr.children.length).forEach((tr, visualIndex) => {
      const cells = Array.from(tr.children);
      let sourceIndex = Number.parseInt(clean(cells[sourceCol]?.textContent), 10);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 1) sourceIndex = visualIndex + 1;
      const row = st.linelist.masterRows[sourceIndex - 1];
      const td = document.createElement('td');
      td.setAttribute(HYDRO_COL, 'true');
      td.textContent = rowValue(row, ['hydroPressure', hydroField]);
      (cells[Math.min(insertAfter, cells.length - 1)] || tr.lastElementChild).insertAdjacentElement('afterend', td);
    });
  }
}

function addPreviewHydroColumn() {
  const popup = activePopup();
  if (!popup) return;
  const table = popup.querySelector('.mc-preview-table');
  const headerRow = table?.querySelector('thead tr');
  if (!table || !headerRow || headerRow.querySelector(`[${PREVIEW_HYDRO_COL}]`)) return;
  const heads = cellTexts(headerRow);
  const densityIndex = heads.findIndex((h) => /^Density$/i.test(h));
  const insertAfter = densityIndex >= 0 ? densityIndex : Math.max(0, heads.findIndex((h) => /^T3/i.test(h)));
  const th = document.createElement('th');
  th.className = 'mc-preview-th';
  th.setAttribute(PREVIEW_HYDRO_COL, 'true');
  th.textContent = 'Hydro Test Pressure';
  (headerRow.children[insertAfter] || headerRow.lastElementChild).insertAdjacentElement('afterend', th);

  table.querySelectorAll('tbody tr.mc-preview-row').forEach((tr) => {
    const cells = Array.from(tr.children);
    const lineKey = clean(cells[1]?.textContent).replace(/^—$/, '');
    const td = document.createElement('td');
    td.className = 'mc-preview-td';
    td.setAttribute(PREVIEW_HYDRO_COL, 'true');
    td.textContent = hydroForLineKey(lineKey) || '—';
    (cells[Math.min(insertAfter, cells.length - 1)] || tr.lastElementChild).insertAdjacentElement('afterend', td);
  });
}

function refreshRegexLineKeyPreview() {
  const popup = activePopup();
  if (!popup) return;
  const sampleInput = popup.querySelector('[data-xml-cii-regex-path="linelist.sampleBranchName"]');
  const posInput = popup.querySelector('[data-xml-cii-regex-path="linelist.lineKeyTokenPositions"]');
  if (!sampleInput || !posInput) return;
  const st = parseConfig();
  const linelist = {
    ...(st.linelist || {}),
    sampleBranchName: sampleInput.value,
    lineKeyTokenPositions: posInput.value,
    tokenDelimiter: popup.querySelector('[data-xml-cii-regex-path="linelist.tokenDelimiter"]')?.value ?? st.linelist?.tokenDelimiter ?? '-',
    lineKeyJoiner: popup.querySelector('[data-xml-cii-regex-path="linelist.lineKeyJoiner"]')?.value ?? st.linelist?.lineKeyJoiner ?? '',
    branchNameRegex: popup.querySelector('[data-xml-cii-regex-path="linelist.branchNameRegex"]')?.value ?? st.linelist?.branchNameRegex ?? '',
    lineNoGroup: popup.querySelector('[data-xml-cii-regex-path="linelist.lineNoGroup"]')?.value ?? st.linelist?.lineNoGroup ?? 1,
  };
  const key = lineKeyFromBranch(sampleInput.value, linelist);
  const lineKeyRow = Array.from(popup.querySelectorAll('.mc-regex-extract-table tbody tr')).find((tr) => /^line\s*key$/i.test(clean(tr.children?.[0]?.textContent)));
  const strong = lineKeyRow?.querySelector('.mc-regex-preview-cell strong');
  if (strong) strong.textContent = key || '—';
  const tokenBody = popup.querySelector('.mc-regex-tokens-table tbody');
  if (tokenBody) {
    tokenBody.innerHTML = branchTokens(sampleInput.value, linelist.tokenDelimiter || '-').map((tok, index) => `<tr><td>${index + 1}</td><td>${esc(tok)}</td></tr>`).join('');
  }
}

let raf = 0;
function refresh() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!activePopup() && !document.querySelector('[data-option-key="supportConfigJson"]')) return;
    syncLineListRows();
    refreshRegexLineKeyPreview();
    addSavedRowsHydroColumn();
    addPreviewHydroColumn();
  });
}

export function installXmlCiiLineListHydroFix() {
  if (window[FLAG]) return;
  window[FLAG] = true;
  refresh();
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', refresh, true);
  document.addEventListener('input', (event) => {
    if (event.target?.matches?.('[data-xml-cii-regex-path], [data-xml-cii-field-map], [data-option-key="supportConfigJson"]')) refresh();
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.matches?.('[data-xml-cii-regex-path], [data-xml-cii-field-map], [data-option-key="supportConfigJson"]')) refresh();
  }, true);
}

installXmlCiiLineListHydroFix();
