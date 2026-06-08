const FLAG = '__xmlCiiHydroSavedRowsAndCleanup_v5';
const LEGACY_FLAG = '__xmlCiiHydroSavedRowsPatch_v1';
const HYDRO_COL = 'data-xml-cii-hydro-saved-col';
const HYDRO_MAP = 'data-mc-hydro-pressure-map';
const FIELD_STORAGE = 'xmlCii.hydroPressureField';
const MODAL_STYLE_ID = 'xml-cii-workflow-modal-layout-fix';
const POPUP_SELECTOR = '.model-converters-workflow-popup-overlay .model-converters-workflow-popup';
const HYDRO_CONTROL_SELECTOR = `.mc-xml-cii-hydro-map, [${HYDRO_MAP}]`;

function txt(v) { return v == null ? '' : String(v); }
function clean(v) { return txt(v).replace(/\s+/g, ' ').trim(); }
function activePopup() { return document.querySelector(POPUP_SELECTOR); }
function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}
function parseConfig() {
  const input = document.querySelector('[data-option-key="supportConfigJson"]');
  if (!input) return { input: null, cfg: null, list: null };
  try {
    const cfg = JSON.parse(input.value || '{}');
    cfg.linelist = cfg.linelist && typeof cfg.linelist === 'object' ? cfg.linelist : {};
    cfg.linelist.fieldMap = cfg.linelist.fieldMap && typeof cfg.linelist.fieldMap === 'object' ? cfg.linelist.fieldMap : {};
    cfg.linelist.masterRows = Array.isArray(cfg.linelist.masterRows) ? cfg.linelist.masterRows : [];
    return { input, cfg, list: cfg.linelist };
  } catch { return { input, cfg: null, list: null }; }
}
function collectRowKeys(rows) {
  const keys = [];
  const seen = new Set();
  const addKey = (k) => {
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };
  for (const row of rows || []) {
    for (const k of Object.keys(row || {})) addKey(k);
    for (const k of Object.keys(row?._raw || {})) addKey(k);
  }
  return keys;
}
function detectHydroField(rows) {
  const keys = collectRowKeys(rows);
  return keys.find((k) => {
    const probe = `${k} ${(rows || []).slice(0, 8).map((r) => `${txt(r?.[k])} ${txt(r?._raw?.[k])}`).join(' ')}`.toUpperCase();
    return probe.includes('HYDRO') || /TEST\s*PRESS/.test(probe);
  }) || '';
}
function hydroField() {
  const st = parseConfig();
  let field = txt(st.list?.fieldMap?.hydroPressure || '');
  if (!field) { try { field = localStorage.getItem(FIELD_STORAGE) || ''; } catch {} }
  if (!field) field = detectHydroField(st.list?.masterRows || []);
  if (field && st.input && st.cfg) {
    try { localStorage.setItem(FIELD_STORAGE, field); } catch {}
    st.cfg.linelist.fieldMap.hydroPressure = field;
    st.input.value = JSON.stringify(st.cfg, null, 2);
  }
  return field;
}
function sourceValue(row, key) {
  if (!row || !key) return '';
  if (row[key] != null && clean(row[key]) !== '') return txt(row[key]);
  if (row._raw && row._raw[key] != null && clean(row._raw[key]) !== '') return txt(row._raw[key]);
  if (row.hydroPressure != null && clean(row.hydroPressure) !== '') return txt(row.hydroPressure);
  if (row._raw?.hydroPressure != null && clean(row._raw.hydroPressure) !== '') return txt(row._raw.hydroPressure);
  return '';
}
function branchTokens(branchName, delimiter = '-') {
  const cleaned = txt(branchName).trim().replace(/^\/+/, '').replace(/\/B\d+$/i, '');
  const delim = txt(delimiter) || '-';
  return cleaned.split(delim).map((token) => token.trim()).filter(Boolean);
}
function tokenAtPosition(branchName, delimiter, oneBasedIndex) {
  const index = Number(oneBasedIndex);
  if (!Number.isFinite(index) || index <= 0) return '';
  return branchTokens(branchName, delimiter)[Math.round(index) - 1] || '';
}
function tokenPositionList(value) {
  if (Array.isArray(value)) return value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0);
  return txt(value)
    .split(/[,+]/)
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}
function regexGroup(value, pattern, groupIndex = 1) {
  const source = txt(value);
  const patternText = txt(pattern).trim();
  if (!source || !patternText) return '';
  try {
    const match = new RegExp(patternText, 'i').exec(source);
    const index = Math.max(0, Number(groupIndex || 0));
    return txt(match?.[index] || '').trim();
  } catch {
    return '';
  }
}
function lineKeyFromBranch(branchName, linelist = {}) {
  const positions = tokenPositionList(linelist.lineKeyTokenPositions || '4');
  const delimiter = linelist.tokenDelimiter || '-';
  const joiner = txt(linelist.lineKeyJoiner);
  const byToken = positions.map((pos) => tokenAtPosition(branchName, delimiter, pos)).filter(Boolean).join(joiner);
  if (byToken) return byToken;
  return regexGroup(branchName, linelist.branchNameRegex, linelist.lineNoGroup || 1);
}
function normalizeLineKey(value) {
  return txt(value).trim().toUpperCase().replace(/\s+/g, '');
}
function rawValue(row, key) {
  if (!row || !key) return '';
  const direct = row[key];
  if (direct != null && clean(direct) !== '') return txt(direct);
  const raw = row._raw?.[key];
  if (raw != null && clean(raw) !== '') return txt(raw);
  return '';
}
function firstRowValue(row, keys) {
  for (const key of keys || []) {
    const value = rawValue(row, key);
    if (clean(value) !== '') return value;
  }
  return '';
}
function lineListKeyFromRow(row, fieldMap = {}) {
  if (!row) return '';
  const key1 = firstRowValue(row, ['lineKey1', 'ColumnX1', 'LINEKEY1', fieldMap.lineKey1].filter(Boolean));
  const key2 = firstRowValue(row, ['lineKey2', 'ColumnX2', 'LINEKEY2', fieldMap.lineKey2].filter(Boolean));
  const composed = `${clean(key1)}${clean(key2)}`;
  if (composed) return composed;
  return firstRowValue(row, [
    'lineNo', 'lineNoKey', 'Line No. Key', 'Line No Key', 'lineKey', 'LineKey',
    'PipelineReference', 'Pipeline Ref', 'PIPELINE_REF', 'ColumnX1',
    'lineSeqNo', 'Line Seq No.', 'Line Seq No', fieldMap.lineSeqNo,
  ].filter(Boolean));
}
function repairLineListKeysInConfig() {
  const st = parseConfig();
  if (!st.input || !st.cfg || !st.list) return false;
  let changed = false;
  const lineList = st.cfg.linelist;
  const positions = tokenPositionList(lineList.lineKeyTokenPositions);
  if (!positions.length && !clean(lineList.branchNameRegex)) {
    lineList.lineKeyTokenPositions = '4';
    changed = true;
  }
  const rows = Array.isArray(lineList.masterRows) ? lineList.masterRows : [];
  const fieldMap = lineList.fieldMap || {};
  for (const row of rows) {
    const key = clean(lineListKeyFromRow(row, fieldMap));
    if (!key) continue;
    if (normalizeLineKey(row.lineNo) !== normalizeLineKey(key)) { row.lineNo = key; changed = true; }
    if (normalizeLineKey(row.lineNoKey) !== normalizeLineKey(key)) { row.lineNoKey = key; changed = true; }
    if (!clean(row.ColumnX1)) { row.ColumnX1 = key; changed = true; }
  }
  if (changed) st.input.value = JSON.stringify(st.cfg, null, 2);
  return changed;
}
function headerTexts(row) {
  return Array.from(row?.children || []).map((cell) => clean(cell.textContent));
}
function findSavedRowsHeader(table) {
  return Array.from(table.querySelectorAll('tr')).find((tr) => {
    const heads = headerTexts(tr);
    if (!heads.length) return false;
    const joined = heads.join('|').toLowerCase();
    const hasLineIdentity = joined.includes('_sourcerowindex') || joined.includes('line seq no') || joined.includes('line no. key') || joined.includes('line no key');
    const hasProcessFields = joined.includes('density mixed') || joined.includes('bore') || joined.includes('p1') || joined.includes('t3');
    return hasLineIdentity && hasProcessFields;
  });
}
function findInsertIndex(heads) {
  for (const wanted of ['T3', 'P1', 'Bore', 'Line Seq No.']) {
    const idx = heads.findIndex((h) => h.toUpperCase() === wanted.toUpperCase());
    if (idx >= 0) return idx;
  }
  return Math.max(0, heads.length - 1);
}
function addSavedRowsColumn() {
  const popup = activePopup();
  if (!popup) return;
  const st = parseConfig();
  const field = hydroField();
  if (!field || !st.list) return;
  const masterRows = Array.isArray(st.list.masterRows) ? st.list.masterRows : [];
  if (!masterRows.length) return;

  for (const table of Array.from(popup.querySelectorAll('table'))) {
    table.querySelectorAll(`[${HYDRO_COL}="true"]`).forEach((n) => n.remove());
    const headerRow = findSavedRowsHeader(table);
    if (!headerRow) continue;
    const heads = headerTexts(headerRow);
    if (heads.some((h) => /hydro\s*test\s*pressure/i.test(h))) continue;

    const after = findInsertIndex(heads);
    const sourceCol = Math.max(0, heads.findIndex((h) => /_sourcerowindex|^#$|source row/i.test(h)));
    const th = document.createElement(headerRow.children[after]?.tagName || 'th');
    th.setAttribute(HYDRO_COL, 'true');
    th.textContent = 'Hydro Test Pressure';
    (headerRow.children[after] || headerRow.lastElementChild).insertAdjacentElement('afterend', th);

    const bodyRows = Array.from(table.tBodies?.[0]?.rows || [])
      .filter((tr) => tr !== headerRow && tr.children.length);
    bodyRows.forEach((tr, visualIndex) => {
      const cells = Array.from(tr.children);
      let sourceIndex = Number.parseInt(clean(cells[sourceCol]?.textContent), 10);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 1) sourceIndex = visualIndex + 1;
      const td = document.createElement(cells[after]?.tagName === 'TH' ? 'th' : 'td');
      td.setAttribute(HYDRO_COL, 'true');
      td.textContent = sourceValue(masterRows[sourceIndex - 1], field);
      (cells[Math.min(after, cells.length - 1)] || tr.lastElementChild).insertAdjacentElement('afterend', td);
    });
  }
}
function refreshRegexLineKeyPreview() {
  const popup = activePopup();
  if (!popup) return;
  const sampleInput = popup.querySelector('[data-xml-cii-regex-path="linelist.sampleBranchName"]');
  const posInput = popup.querySelector('[data-xml-cii-regex-path="linelist.lineKeyTokenPositions"]');
  if (!sampleInput || !posInput) return;
  const st = parseConfig();
  const linelist = {
    ...(st.list || {}),
    sampleBranchName: sampleInput.value,
    lineKeyTokenPositions: posInput.value,
    tokenDelimiter: popup.querySelector('[data-xml-cii-regex-path="linelist.tokenDelimiter"]')?.value ?? st.list?.tokenDelimiter ?? '-',
    lineKeyJoiner: popup.querySelector('[data-xml-cii-regex-path="linelist.lineKeyJoiner"]')?.value ?? st.list?.lineKeyJoiner ?? '',
    branchNameRegex: popup.querySelector('[data-xml-cii-regex-path="linelist.branchNameRegex"]')?.value ?? st.list?.branchNameRegex ?? '',
    lineNoGroup: popup.querySelector('[data-xml-cii-regex-path="linelist.lineNoGroup"]')?.value ?? st.list?.lineNoGroup ?? 1,
  };
  const key = lineKeyFromBranch(sampleInput.value, linelist);
  const lineKeyRow = Array.from(popup.querySelectorAll('.mc-regex-extract-table tbody tr'))
    .find((tr) => /^line\s*key$/i.test(clean(tr.children?.[0]?.textContent)));
  const strong = lineKeyRow?.querySelector('.mc-regex-preview-cell strong');
  if (strong) strong.textContent = key || '—';
  const tokenBody = popup.querySelector('.mc-regex-tokens-table tbody');
  if (tokenBody) {
    tokenBody.innerHTML = branchTokens(sampleInput.value, linelist.tokenDelimiter || '-')
      .map((tok, index) => `<tr><td>${index + 1}</td><td>${tok.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>`)
      .join('');
  }
}
function hydroControlCandidates(popup) {
  const controls = new Set(Array.from(popup.querySelectorAll(HYDRO_CONTROL_SELECTOR)));
  for (const label of Array.from(popup.querySelectorAll('label'))) {
    if (/hydro\s*test\s*pressure/i.test(clean(label.textContent))) {
      const select = label.querySelector('select');
      if (select) controls.add(select);
    }
  }
  for (const field of Array.from(popup.querySelectorAll('.model-converters-workflow-map-field'))) {
    if (/hydro\s*test\s*pressure/i.test(clean(field.textContent))) {
      const select = field.querySelector('select');
      if (select) controls.add(select);
    }
  }
  return Array.from(controls).filter((el) => el && el.isConnected);
}
function hydroControlWrapper(control) {
  return control.closest('.model-converters-workflow-map-field') || control.closest('label') || control.parentElement || control;
}
function pruneDuplicateHydroControls() {
  const popup = activePopup();
  if (!popup) return;
  const controls = hydroControlCandidates(popup);
  if (controls.length <= 1) return;
  const keep = controls.find((el) => el.closest('.model-converters-workflow-map-grid')) || controls[0];
  const keepWrapper = hydroControlWrapper(keep);
  for (const control of controls) {
    if (control === keep) continue;
    const wrapper = hydroControlWrapper(control);
    if (!wrapper || wrapper === keepWrapper || !popup.contains(wrapper)) continue;
    try { control.blur?.(); } catch {}
    wrapper.remove();
  }
}
function injectModalStyle() {
  if (document.getElementById(MODAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `body.mc-xml-cii-modal-open{overflow:hidden!important}.model-converters-workflow-popup-overlay{position:fixed!important;inset:0!important;overflow:hidden!important;padding:12px!important;align-items:stretch!important;justify-content:center!important;overscroll-behavior:contain!important}.model-converters-workflow-popup{width:min(98vw,calc(100vw - 24px))!important;height:calc(100dvh - 24px)!important;max-height:calc(100dvh - 24px)!important;min-height:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}.model-converters-workflow-popup-head{flex:0 0 auto!important;z-index:20!important}.model-converters-workflow-popup-tabs{flex:0 0 auto!important;z-index:19!important;background:#0f1724!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;scrollbar-gutter:stable!important}.model-converters-workflow-popup-body{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;overscroll-behavior:contain!important;padding:12px 14px 14px!important;scrollbar-gutter:stable both-edges!important}.model-converters-workflow-popup-body>.model-converters-workflow-detail{min-height:0!important;overflow:visible!important}.model-converters-workflow-popup .model-converters-workflow-master-card{min-width:0!important;overflow:hidden!important}.model-converters-workflow-popup .model-converters-workflow-table-wrap{max-height:min(34dvh,300px)!important;min-height:120px!important;overflow:auto!important;overscroll-behavior:contain!important;scrollbar-gutter:stable both-edges!important}.model-converters-workflow-popup .model-converters-workflow-table{min-width:max-content!important}.model-converters-workflow-popup .model-converters-workflow-table th{position:sticky!important;top:0!important;z-index:5!important}.model-converters-workflow-popup .model-converters-workflow-toolbar{position:sticky!important;bottom:0!important;z-index:15!important;background:#0f1724!important;border-top:1px solid #243247!important;padding:8px 0!important}.model-converters-workflow-popup .model-converters-workflow-map-grid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}.model-converters-workflow-popup select{max-width:100%!important;min-width:0!important;box-sizing:border-box!important}.model-converters-workflow-popup .mc-xml-cii-hydro-map,.model-converters-workflow-popup [${HYDRO_MAP}]{position:static!important;display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;background:#182334!important;color:#e6edf5!important;border:1px solid #31455f!important;border-radius:6px!important;padding:6px 8px!important;z-index:auto!important}`;
  document.head.appendChild(style);
}
function updateModalLock() {
  const open = !!activePopup();
  document.body.classList.toggle('mc-xml-cii-modal-open', open);
}
function cleanupFloatingHydro() {
  const popup = activePopup();
  for (const el of Array.from(document.querySelectorAll(HYDRO_CONTROL_SELECTOR))) {
    if (!popup || !popup.contains(el)) {
      try { el.blur?.(); } catch {}
      el.remove();
      continue;
    }
    if (!isVisible(el)) {
      el.remove();
      continue;
    }
    const r = el.getBoundingClientRect();
    const p = popup.getBoundingClientRect();
    const outsidePopup = r.left < p.left - 2 || r.right > p.right + 2 || r.top < p.top - 2 || r.bottom > p.bottom + 2;
    if (outsidePopup) {
      try { el.blur?.(); } catch {}
      el.remove();
      continue;
    }
    if (el.hasAttribute(HYDRO_MAP)) {
      const field = hydroField();
      if (field && el.value !== field && Array.from(el.options || []).some((o) => o.value === field)) el.value = field;
    }
  }
}
let raf = 0;
function refresh() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    injectModalStyle();
    updateModalLock();
    repairLineListKeysInConfig();
    cleanupFloatingHydro();
    pruneDuplicateHydroControls();
    refreshRegexLineKeyPreview();
    addSavedRowsColumn();
  });
}
export function installXmlCiiHydroSavedRowsCleanup() {
  if (window[FLAG]) return;
  window[FLAG] = true;
  window[LEGACY_FLAG] = true;
  refresh();
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    const text = clean(event.target?.textContent).toLowerCase();
    if (text.includes('save mapping') || text.includes('run') || text.includes('dry run')) setTimeout(refresh, 0);
  }, true);
  document.addEventListener('input', (event) => { if (event.target?.matches?.('[data-xml-cii-regex-path]')) setTimeout(refresh, 0); }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.matches?.(`${HYDRO_CONTROL_SELECTOR}, [data-xml-cii-regex-path], [data-xml-cii-field-map]`)) setTimeout(refresh, 0);
  }, true);
  document.addEventListener('blur', (event) => { if (event.target?.matches?.(HYDRO_CONTROL_SELECTOR)) setTimeout(refresh, 0); }, true);
}
installXmlCiiHydroSavedRowsCleanup();