const FLAG = '__xmlCiiLineListHydroScopedFix_v3';
const HYDRO_COL = 'data-xml-cii-hydro-col';
const PREVIEW_HYDRO_COL = 'data-xml-cii-preview-hydro-col';
const HYDRO_PANEL_ID = 'xml-cii-hydro-map-panel';
const FIELD_STORAGE = 'xmlCii.hydroPressureField';
const POPUP_SELECTOR = '.model-converters-workflow-popup-overlay .model-converters-workflow-popup';

const HYDRO_ALIASES = Object.freeze([
  'hydroPressure', 'Hydro Test Pressure', 'Hydrotest Pressure', 'Hydro Pressure',
  'Hydro Pr', 'Hyd Test Pr', 'Hyd. Test Pressure', 'Test Pressure',
  'TEST_PRESSURE', 'HYDRO_TEST_PRESSURE', 'Pressure Test', 'Proof Pressure',
]);

function txt(value) { return value == null ? '' : String(value); }
function clean(value) { return txt(value).replace(/\s+/g, ' ').trim(); }
function norm(value) { return clean(value).toUpperCase().replace(/[\s_.\-\/()]/g, ''); }
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

function scoreHydroHeader(key, rows) {
  const k = norm(key);
  if (!k) return 0;
  let score = 0;
  for (const alias of HYDRO_ALIASES) {
    const a = norm(alias);
    if (k === a) score = Math.max(score, 100);
    else if (k.includes(a) || a.includes(k)) score = Math.max(score, 82);
  }
  if (/HYDRO|HYD/.test(k)) score = Math.max(score, 75);
  if (/TEST.*PRESS|PRESS.*TEST|PROOF.*PRESS/.test(k)) score = Math.max(score, 72);
  const sample = (rows || []).slice(0, 12).map((row) => rowValue(row, [key])).join(' ').toUpperCase();
  if (/HYDRO|HYD\s*TEST|TEST\s*PRESS|PROOF\s*PRESS/.test(`${key} ${sample}`)) score = Math.max(score, 68);
  return score;
}

function detectHydroField(rows) {
  let best = '';
  let bestScore = 0;
  for (const key of allRowKeys(rows)) {
    const score = scoreHydroHeader(key, rows);
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return bestScore >= 68 ? best : '';
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
  hydroPressure: HYDRO_ALIASES,
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
    const hydro = rowValue(row, [fieldMap.hydroPressure, hydroField, ...HYDRO_ALIASES]);
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
  const override = st.cfg?.overrides?.processData?.[lineKey]?.hydroPressure;
  if (clean(override)) return clean(override);
  for (const row of rows) {
    if (norm(lineKeyFromRow(row, st.linelist?.fieldMap || {})) === norm(lineKey)) {
      return rowValue(row, ['hydroPressure', st.linelist?.fieldMap?.hydroPressure, preferredHydroField(st.linelist), ...HYDRO_ALIASES]);
    }
  }
  return '';
}

function cellTexts(row) { return Array.from(row?.children || []).map((cell) => clean(cell.textContent)); }

function injectHydroMapPanel() {
  const popup = activePopup();
  const st = parseConfig();
  if (!popup || !st.linelist?.masterRows?.length) return;
  const detail = popup.querySelector('.model-converters-workflow-detail');
  if (!detail || document.getElementById(HYDRO_PANEL_ID)) return;
  const headers = allRowKeys(st.linelist.masterRows).filter((key) => key !== '_raw');
  if (!headers.length) return;
  const current = preferredHydroField(st.linelist);
  const options = [''].concat(headers).map((h) => `<option value="${esc(h)}" ${h === current ? 'selected' : ''}>${h ? esc(h) : '— Select hydro pressure column —'}</option>`).join('');
  const html = `<div id="${HYDRO_PANEL_ID}" style="margin:8px 0 12px;padding:10px;border:1px solid #38506d;border-radius:8px;background:#101b2b;">
    <div style="font-weight:700;color:#d7e6ff;margin-bottom:6px;">Hydro Test Pressure Mapping</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <label style="color:#9cc5ff;font-size:12px;">Line List Hydro Pressure Column</label>
      <select data-xml-cii-hydro-field style="background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:5px;padding:6px 8px;min-width:260px;">${options}</select>
      <span style="color:#8da7c3;font-size:12px;">Used for Saved/Mapped Rows, Preview, and overrides.processData[lineKey].hydroPressure.</span>
    </div>
  </div>`;
  const title = detail.querySelector('.model-converters-workflow-detail-title') || detail.firstElementChild;
  if (title) title.insertAdjacentHTML('afterend', html);
  const select = detail.querySelector('[data-xml-cii-hydro-field]');
  select?.addEventListener('change', () => {
    const next = clean(select.value);
    const state = parseConfig();
    if (!state.cfg) return;
    state.cfg.linelist.fieldMap = state.cfg.linelist.fieldMap || {};
    state.cfg.linelist.fieldMap.hydroPressure = next;
    try { localStorage.setItem(FIELD_STORAGE, next); } catch {}
    writeConfig(state, true);
    refresh();
  });
}

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
      td.textContent = rowValue(row, ['hydroPressure', hydroField, ...HYDRO_ALIASES]);
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
  th.innerHTML = 'Hydro Test Pressure<span class="mc-preview-edit-hint">Edit</span>';
  (headerRow.children[insertAfter] || headerRow.lastElementChild).insertAdjacentElement('afterend', th);

  table.querySelectorAll('tbody tr.mc-preview-row').forEach((tr) => {
    const cells = Array.from(tr.children);
    const lineKey = clean(cells[1]?.textContent).replace(/^—$/, '');
    const value = hydroForLineKey(lineKey);
    const td = document.createElement('td');
    td.className = 'mc-preview-td mc-preview-pd-td';
    td.setAttribute(PREVIEW_HYDRO_COL, 'true');
    td.innerHTML = `<div class="mc-preview-pd-cell ${value ? 'mc-preview-pd-linelist' : 'mc-preview-pd-empty'}">
      <input type="text" class="mc-preview-pd-input" value="${esc(value)}" data-mc-pd-field="hydroPressure" data-mc-pd-linekey="${esc(lineKey)}" title="Hydro Test Pressure from line list — editable" placeholder="—">
    </div>`;
    (cells[Math.min(insertAfter, cells.length - 1)] || tr.lastElementChild).insertAdjacentElement('afterend', td);
    const input = td.querySelector('input');
    input?.addEventListener('input', () => {
      const state = parseConfig();
      if (!state.cfg || !lineKey) return;
      state.cfg.overrides.processData[lineKey] = { ...(state.cfg.overrides.processData[lineKey] || {}), hydroPressure: clean(input.value) };
      writeConfig(state, true);
    });
  });
  table.querySelectorAll('.mc-preview-node-row .mc-preview-node-cell').forEach((td) => {
    const colspan = Number(td.getAttribute('colspan') || 0);
    if (Number.isFinite(colspan) && colspan > 0) td.setAttribute('colspan', String(colspan + 1));
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
    injectHydroMapPanel();
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
    if (event.target?.matches?.('[data-xml-cii-regex-path], [data-xml-cii-field-map], [data-option-key="supportConfigJson"], [data-xml-cii-hydro-field]')) refresh();
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.matches?.('[data-xml-cii-regex-path], [data-xml-cii-field-map], [data-option-key="supportConfigJson"], [data-xml-cii-hydro-field]')) refresh();
  }, true);
}

installXmlCiiLineListHydroFix();
