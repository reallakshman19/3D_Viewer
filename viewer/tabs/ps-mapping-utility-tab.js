import {
  PS_MAPPING_SAMPLE_TABLE1,
  PS_MAPPING_SAMPLE_TABLE1A,
  PS_MAPPING_SAMPLE_TABLE1B,
  PS_MAPPING_SAMPLE_TABLE1C,
  PS_MAPPING_SAMPLE_TABLE1D,
  PS_MAPPING_SAMPLE_TABLE2,
} from './ps-mapping-utility/ps-mapping-sample-data.js';
import { runPsMappingResolver, rowsToCsv } from './ps-mapping-utility/ps-mapping-engine.js';

const STYLE_ID = 'ps-mapping-utility-style';

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function countRows(text) {
  return Math.max(0, String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length - 1);
}
function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-tile-row{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch}.psmap-modal-bg{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:10020;display:flex;align-items:center;justify-content:center;padding:18px}.psmap-modal{width:min(1440px,98vw);height:min(920px,94vh);display:flex;flex-direction:column;border:1px solid rgba(143,197,255,.25);border-radius:16px;background:#0f1724;color:#d9e6f7;overflow:hidden;font-family:system-ui}.psmap-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid rgba(143,197,255,.16);background:#162238}.psmap-head h2{margin:0;color:#8fc5ff}.psmap-head p{margin:4px 0 0;color:#9fb2c7}.psmap-toolbar,.psmap-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(143,197,255,.14);background:#101a2b}.psmap-btn{border:1px solid rgba(143,197,255,.28);border-radius:8px;background:#1d4ed8;color:#fff;padding:8px 12px;cursor:pointer;font-weight:800}.psmap-btn.secondary{background:#111827}.psmap-tab{border:1px solid rgba(143,197,255,.18);border-radius:999px;background:#0b1220;color:#b7c9dd;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:900}.psmap-tab.active{background:#1d4ed8;color:#fff}.psmap-body{flex:1;overflow:auto;padding:14px;display:grid;gap:14px}.psmap-panel{display:none}.psmap-panel.active{display:grid;gap:14px}.psmap-card{border:1px solid rgba(143,197,255,.2);border-radius:14px;background:#101a2b;overflow:hidden}.psmap-card-head{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;border-bottom:1px solid rgba(143,197,255,.15);background:#162238}.psmap-card-body{padding:12px;display:grid;gap:12px}.psmap-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.psmap-field{display:grid;gap:5px}.psmap-field label{font-size:12px;color:#b7c9dd;font-weight:900}.psmap-field textarea,.psmap-field input,.psmap-field select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.2);border-radius:8px;background:#0b1220;color:#e5edf7;padding:8px;font:12px ui-monospace,Consolas,monospace}.psmap-field textarea{min-height:170px;resize:vertical}.psmap-field.wide{grid-column:1/-1}.psmap-banner{font-size:12px;line-height:1.5;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psmap-summary{display:grid;grid-template-columns:repeat(10,minmax(100px,1fr));gap:8px}.psmap-summary div{background:#0b1220;border:1px solid rgba(143,197,255,.15);border-radius:10px;padding:9px}.psmap-summary b{display:block;color:#8fc5ff;font-size:18px}.psmap-summary span{font-size:11px;color:#9fb2c7}.psmap-tablewrap{overflow:auto;max-height:560px}.psmap-table{width:100%;border-collapse:collapse;font-size:12px}.psmap-table th,.psmap-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap;vertical-align:top}.psmap-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psmap-table pre{margin:0;max-width:560px;white-space:pre-wrap;font-size:11px}.psmap-ok{color:#86efac;font-weight:900}.psmap-warn{color:#fcd34d;font-weight:900}.psmap-error{color:#fca5a5;font-weight:900}@media(max-width:1000px){.psmap-grid,.psmap-summary{grid-template-columns:1fr}.psmap-modal{height:96vh}}`;
  document.head.appendChild(style);
}

function defaultState() {
  return {
    activeTab: 'source',
    source: {
      table1: PS_MAPPING_SAMPLE_TABLE1,
      table1A: PS_MAPPING_SAMPLE_TABLE1A,
      table1B: PS_MAPPING_SAMPLE_TABLE1B,
      table1C: PS_MAPPING_SAMPLE_TABLE1C,
      table1D: PS_MAPPING_SAMPLE_TABLE1D,
      table2: PS_MAPPING_SAMPLE_TABLE2,
    },
    options: { boreMode: 'prefer', lineMode: 'prefer', supportMode: 'prefer', odToleranceMm: 1.5, allowRawDiaMatch: true, allowDnMatch: true, allowDuplicateAssignment: true },
    result: null,
  };
}

let state = defaultState();
let ctxRef = null;

function toast(message, type = 'info') {
  try { ctxRef?.showToast?.(message, type); } catch {}
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(String(text || '')); toast('Copied.', 'success'); }
  catch (error) { toast(`Copy failed: ${error.message || error}`, 'error'); }
}

function statusClass(level) {
  const text = String(level || '').toUpperCase();
  if (text === 'ERROR' || text === 'NO_MATCH' || text === 'MISSING_ALL' || text === 'EXTRA_ONLY') return 'psmap-error';
  if (text === 'WARNING' || text === 'MEDIUM' || text === 'PARTIAL' || text === 'COVERED_WITH_EXTRA') return 'psmap-warn';
  return 'psmap-ok';
}
function summaryHtml(result) {
  const s = result?.summary || { mapped: 0, noMatch: 0, warnings: 0, table1Rows: countRows(state.source.table1), table2Rows: countRows(state.source.table2), candidateRows: 0, supportMatches: 0, supportCoverageRows: 0, supportCoverageWarnings: 0 };
  return `<div class="psmap-summary"><div><b>${s.table1Rows || 0}</b><span>Table-1 rows</span></div><div><b>${countRows(state.source.table1A)}</b><span>Table-1A rows</span></div><div><b>${countRows(state.source.table1B)}</b><span>Table-1B rows</span></div><div><b>${countRows(state.source.table1C)}</b><span>Table-1C rows</span></div><div><b>${countRows(state.source.table1D)}</b><span>Table-1D rows</span></div><div><b>${s.table2Rows || 0}</b><span>Table-2 rows</span></div><div><b>${s.mapped || 0}</b><span>Mapped</span></div><div><b>${s.supportMatches || 0}</b><span>Support Matches</span></div><div><b>${s.supportCoverageWarnings || 0}</b><span>Coverage Warnings</span></div><div><b>${s.noMatch || 0}</b><span>No Match</span></div></div>`;
}
function tab(id, label) {
  return `<button class="psmap-tab ${state.activeTab === id ? 'active' : ''}" data-psmap-tab="${id}">${h(label)}</button>`;
}
function panel(id, html) {
  return `<section class="psmap-panel ${state.activeTab === id ? 'active' : ''}" data-psmap-panel="${id}">${html}</section>`;
}
function sourcePanel() {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Source Tables</b><span>PS Mapping Utility</span></div><div class="psmap-card-body"><div class="psmap-banner">Table-1 and Table-2 are required. Table-1A Dia, Table-1B Line No, Table-1C ISONOTE, and Table-1D keyword searcher are optional. Table-1 Tag after | is propagated to validator, coverage, candidates, logs, and CSV as audit metadata only.</div><div class="psmap-grid"><div class="psmap-field"><label>Table-1 — PS No / Node</label><textarea data-psmap-source="table1">${h(state.source.table1)}</textarea></div><div class="psmap-field"><label>Table-2 — PSNO_Model / Bore / pipe / DTXR Optional</label><textarea data-psmap-source="table2">${h(state.source.table2)}</textarea></div><div class="psmap-field"><label>Table-1A — Node / Dia Optional</label><textarea data-psmap-source="table1A">${h(state.source.table1A)}</textarea></div><div class="psmap-field"><label>Table-1B — Node / Line No Optional</label><textarea data-psmap-source="table1B">${h(state.source.table1B)}</textarea></div><div class="psmap-field wide"><label>Table-1C — Node / ISONOTE Optional</label><textarea data-psmap-source="table1C">${h(state.source.table1C)}</textarea></div><div class="psmap-field wide"><label>Table-1D — Master Keyword Searcher Optional</label><textarea data-psmap-source="table1D">${h(state.source.table1D)}</textarea></div></div></div></section>`;
}
function setupPanel() {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Resolver Setup</b></div><div class="psmap-card-body"><div class="psmap-grid"><div class="psmap-field"><label>Bore Mode</label><select data-psmap-option="boreMode"><option value="prefer" ${state.options.boreMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.options.boreMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.options.boreMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>Support Mode</label><select data-psmap-option="supportMode"><option value="prefer" ${state.options.supportMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.options.supportMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.options.supportMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>Line Mode</label><select data-psmap-option="lineMode"><option value="prefer" ${state.options.lineMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.options.lineMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.options.lineMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>OD / raw dia tolerance mm</label><input data-psmap-option="odToleranceMm" value="${h(state.options.odToleranceMm)}"></div><div class="psmap-banner"><b>Rules:</b> PS cleanup removes decimal suffix, /Datum, and |tag for base matching. Tag is copied from Table-1 only and is not used for ranking. Dia is OD; model Bore can match derived DN or raw OD/dia. Table-1D keywords define support extraction.</div></div></div></section>`;
}
function outputPanel() {
  const rows = state.result?.rows || [];
  const body = rows.length ? rows.map((row) => `<tr><td>${row.enabled ? 'YES' : 'NO'}</td><td>${h(row.psnoModel)}</td><td>${h(row.node)}</td><td>${h(row.tag)}</td><td>${h(row.supportMatch)}</td><td>${h(row.nodeCoverageNote)}</td><td>${h(row.basis)}</td><td class="${statusClass(row.confidence)}">${h(row.confidence)}</td><td>${h((row.warnings || []).join('; '))}</td></tr>`).join('') : '<tr><td colspan="9">Run Mapping to populate Table 2 Validator.</td></tr>';
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Table 2 Validator</b><button class="psmap-btn secondary" data-psmap-action="copy-csv">Copy CSV</button></div><div class="psmap-card-body">${summaryHtml(state.result)}<div class="psmap-tablewrap"><table class="psmap-table"><thead><tr><th>Enabled</th><th>PSNO_Model</th><th>Node</th><th>Tag</th><th>Support match</th><th>Node Coverage Note</th><th>Basis</th><th>Confidence</th><th>Warnings</th></tr></thead><tbody>${body}</tbody></table></div></div></section>`;
}
function coveragePanel() {
  const rows = state.result?.supportCoverageRows || [];
  const body = rows.length ? rows.map((row) => `<tr><td>${h(row.node)}</td><td>${h(row.table1PsNo)}</td><td>${h(row.tag)}</td><td>${h(row.dia)}</td><td>${h(row.derivedDn)}</td><td>${h(row.lineNo)}</td><td>${h(row.isonote)}</td><td>${h((row.masterKeywords || []).join(', '))}</td><td>${h((row.mappedPsnos || []).join(', '))}</td><td>${h((row.coveredDtxrKeywords || []).join(', '))}</td><td>${h((row.missingMasterKeywords || []).join(', '))}</td><td>${h((row.extraDtxrKeywords || []).join(', '))}</td><td class="${statusClass(row.coverageStatus)}">${h(row.coverageStatus)}</td><td>${h(row.action)}</td></tr>`).join('') : '<tr><td colspan="14">Run Mapping to populate Table 1 Support Coverage.</td></tr>';
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Table 1 Support Coverage</b><span>${rows.length} node(s)</span></div><div class="psmap-card-body"><div class="psmap-banner">Node-level audit: validates whether support keywords found in Table-1C master ISONOTE are covered by mapped Table-2 DTXR rows. Tag is the unique Table-1 tag set for the node.</div><div class="psmap-tablewrap"><table class="psmap-table"><thead><tr><th>Node</th><th>Table-1 PS No</th><th>Tag</th><th>Dia</th><th>Derived DN</th><th>Line No</th><th>ISONOTE</th><th>Master Keywords</th><th>Mapped PSNO_Model</th><th>Covered DTXR Keywords</th><th>Missing Master Keywords</th><th>Extra DTXR Keywords</th><th>Coverage Status</th><th>Action</th></tr></thead><tbody>${body}</tbody></table></div></div></section>`;
}
function candidatePanel() {
  const rows = state.result?.candidates || [];
  const body = rows.length ? rows.map((row) => `<tr><td>${h(row.psnoModel)}</td><td>${h(row.node)}</td><td>${h(row.table1PsNo)}</td><td>${h(row.tag)}</td><td>${h(row.psBasis)}</td><td>${h(row.boreBasis)}</td><td>${h(row.supportBasis)}</td><td>${h(row.supportMatch)}</td><td>${h(row.lineBasis)}</td><td>${row.eligible ? 'YES' : 'NO'}</td><td>${row.selected ? 'YES' : ''}</td><td>${h(row.nodeCoverageNote || '')}</td><td>${h(row.rejectReason || (row.selected ? 'Selected' : 'Lower ranked'))}</td></tr>`).join('') : '<tr><td colspan="13">Run Mapping to populate candidates.</td></tr>';
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Candidate Matrix</b><span>${rows.length} candidate(s)</span></div><div class="psmap-card-body"><div class="psmap-tablewrap"><table class="psmap-table"><thead><tr><th>PSNO_Model</th><th>Candidate Node</th><th>Table-1 PS No</th><th>Tag</th><th>PS Basis</th><th>Bore Basis</th><th>Support Basis</th><th>Support match</th><th>Line Basis</th><th>Eligible</th><th>Selected</th><th>Node Coverage Note</th><th>Reason</th></tr></thead><tbody>${body}</tbody></table></div></div></section>`;
}
function userLogPanel() {
  const rows = state.result?.userLog || [];
  const body = rows.length ? rows.map((row) => `<tr><td class="${statusClass(row.level)}">${h(row.level)}</td><td>${h(row.stage)}</td><td>${h(row.psnoModel || '')}</td><td>${h(row.node || '')}</td><td>${h(row.table1PsNo || '')}</td><td>${h(row.tag || '')}</td><td>${h(row.subject)}</td><td>${h(row.message)}</td><td>${h(row.action || '')}</td></tr>`).join('') : '<tr><td colspan="9">Run Mapping to populate user log.</td></tr>';
  return `<section class="psmap-card"><div class="psmap-card-head"><b>User Log</b><button class="psmap-btn secondary" data-psmap-action="copy-user-log">Copy User Log</button></div><div class="psmap-card-body"><div class="psmap-tablewrap"><table class="psmap-table"><thead><tr><th>Level</th><th>Stage</th><th>PSNO_Model</th><th>Node</th><th>Table-1 PS No</th><th>Tag</th><th>Subject</th><th>Message</th><th>Action</th></tr></thead><tbody>${body}</tbody></table></div></div></section>`;
}
function debugLogPanel() {
  const rows = state.result?.debugLog || [];
  const body = rows.length ? rows.slice(0, 500).map((row) => `<tr><td>${h(row.time)}</td><td>${h(row.level)}</td><td>${h(row.code)}</td><td>${h(row.subject)}</td><td><pre>${h(JSON.stringify(row.details, null, 2))}</pre></td></tr>`).join('') : '<tr><td colspan="5">Run Mapping to populate debug log.</td></tr>';
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Debug Log</b><button class="psmap-btn secondary" data-psmap-action="copy-debug-json">Copy Debug JSON</button></div><div class="psmap-card-body"><div class="psmap-tablewrap"><table class="psmap-table"><thead><tr><th>Time</th><th>Level</th><th>Code</th><th>Subject</th><th>Details</th></tr></thead><tbody>${body}</tbody></table></div></div></section>`;
}

function renderModal() {
  installStyle();
  const existing = document.querySelector('[data-psmap-modal-bg]');
  if (existing) existing.remove();
  const bg = document.createElement('div');
  bg.className = 'psmap-modal-bg';
  bg.dataset.psmapModalBg = '1';
  bg.innerHTML = `<div class="psmap-modal"><div class="psmap-head"><div><h2>PS Mapping Utility</h2><p>Map model PS numbers to nodes using PS cleanup, optional bore, support, line number, duplicate resolution, and Table-1 support coverage.</p></div><button class="psmap-btn secondary" data-psmap-action="close">Close</button></div><div class="psmap-toolbar"><button class="psmap-btn secondary" data-psmap-action="load-sample">Load Sample</button><button class="psmap-btn secondary" data-psmap-action="clear">Clear</button><button class="psmap-btn" data-psmap-action="run">Run Mapping</button><button class="psmap-btn secondary" data-psmap-action="copy-csv">Copy Validator CSV</button></div><div class="psmap-tabs">${tab('source', 'Source Tables')}${tab('setup', 'Resolver Setup')}${tab('output', 'Table 2 Validator')}${tab('coverage', 'Table 1 Support Coverage')}${tab('candidates', 'Candidate Matrix')}${tab('userlog', 'User Log')}${tab('debuglog', 'Debug Log')}</div><div class="psmap-body">${panel('source', sourcePanel())}${panel('setup', setupPanel())}${panel('output', outputPanel())}${panel('coverage', coveragePanel())}${panel('candidates', candidatePanel())}${panel('userlog', userLogPanel())}${panel('debuglog', debugLogPanel())}</div></div>`;
  document.body.appendChild(bg);
  bindModal(bg);
}
function readSources(root) {
  root.querySelectorAll('[data-psmap-source]').forEach((el) => { state.source[el.dataset.psmapSource] = el.value; });
  root.querySelectorAll('[data-psmap-option]').forEach((el) => {
    const key = el.dataset.psmapOption;
    state.options[key] = key === 'odToleranceMm' ? Number(el.value) : el.value;
  });
}
function runMapping(root) {
  readSources(root);
  state.result = runPsMappingResolver({ table1PsNodeText: state.source.table1, table1aNodeDiaText: state.source.table1A, table1bNodeLineText: state.source.table1B, table1cNodeIsonoteText: state.source.table1C, table1dKeywordText: state.source.table1D, table2ModelText: state.source.table2, options: state.options });
  state.activeTab = 'output';
  renderModal();
  toast(`PS Mapping completed: ${state.result.summary.mapped} mapped, ${state.result.summary.noMatch} no-match, ${state.result.summary.supportCoverageWarnings} support coverage warning(s).`, state.result.summary.noMatch || state.result.summary.supportCoverageWarnings ? 'warning' : 'success');
}
function userLogToTsv(rows = []) {
  const header = ['Level', 'Stage', 'PSNO_Model', 'Node', 'Table-1 PS No', 'Tag', 'Subject', 'Message', 'Action'];
  return [header, ...rows.map((r) => [r.level, r.stage, r.psnoModel || '', r.node || '', r.table1PsNo || '', r.tag || '', r.subject, r.message, r.action || ''])].map((line) => line.map((v) => String(v ?? '').replace(/\t/g, ' ')).join('\t')).join('\n');
}
function bindModal(root) {
  root.addEventListener('click', async (event) => {
    const tabBtn = event.target.closest('[data-psmap-tab]');
    if (tabBtn) { readSources(root); state.activeTab = tabBtn.dataset.psmapTab; renderModal(); return; }
    const action = event.target.closest('[data-psmap-action]')?.dataset.psmapAction;
    if (!action) return;
    if (action === 'close') { root.remove(); return; }
    if (action === 'load-sample') { state.source = defaultState().source; state.options = defaultState().options; state.result = null; state.activeTab = 'source'; renderModal(); return; }
    if (action === 'clear') { state.source = { table1: '', table1A: '', table1B: '', table1C: '', table1D: PS_MAPPING_SAMPLE_TABLE1D, table2: '' }; state.result = null; state.activeTab = 'source'; renderModal(); return; }
    if (action === 'run') { runMapping(root); return; }
    if (action === 'copy-csv') { await copyText(rowsToCsv(state.result?.rows || [])); return; }
    if (action === 'copy-user-log') { await copyText(userLogToTsv(state.result?.userLog || [])); return; }
    if (action === 'copy-debug-json') { await copyText(JSON.stringify(state.result?.debugLog || [], null, 2)); }
  });
  root.addEventListener('input', (event) => {
    const source = event.target.closest('[data-psmap-source]');
    if (source) state.source[source.dataset.psmapSource] = source.value;
    const option = event.target.closest('[data-psmap-option]');
    if (option) state.options[option.dataset.psmapOption] = option.dataset.psmapOption === 'odToleranceMm' ? Number(option.value) : option.value;
  });
  root.addEventListener('change', (event) => {
    const option = event.target.closest('[data-psmap-option]');
    if (option) state.options[option.dataset.psmapOption] = option.dataset.psmapOption === 'odToleranceMm' ? Number(option.value) : option.value;
  });
}

export function openPsMappingUtility(ctx = null) {
  ctxRef = ctx;
  renderModal();
}

export function installPsMappingUtilityTile(container, ctx = null) {
  installStyle();
  ctxRef = ctx;
  const root = container.querySelector('.psnm-root') || container;
  if (root.querySelector('[data-psmap-launch]')) return;
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'psnm-launch-tile';
  tile.dataset.psmapLaunch = '1';
  tile.innerHTML = `<div><div class="psnm-tile-icon">🔗</div><div><b>PS Mapping Utility</b></div><div style="font-size:12px;color:#9fb2c7;margin-top:6px;">PSNO_Model → Node plus Table 2 validation and Table 1 support coverage.</div></div>`;
  tile.addEventListener('click', () => openPsMappingUtility(ctx));
  const firstTile = root.querySelector('.psnm-launch-tile');
  if (firstTile && firstTile.parentElement) {
    let row = firstTile.parentElement.querySelector(':scope > .psmap-tile-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'psmap-tile-row';
      firstTile.parentElement.insertBefore(row, firstTile);
      row.appendChild(firstTile);
    }
    row.appendChild(tile);
  } else {
    root.appendChild(tile);
  }
}
