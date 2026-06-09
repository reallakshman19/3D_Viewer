import {
  PSNM_buildMatchTable,
  PSNM_createRunLogger,
  PSNM_deriveTransformFromAnchor,
} from './psnm-utility/psnm-match-engine.js';
import {
  PSNM_resolveMasterPsTable,
  PSNM_recomputeMasterPsRow,
} from './psnm-utility/psnm-master-resolver.js';
import {
  PSNM_applyMasterNodeTransform,
  PSNM_recomputeMasterNodeRow,
  PSNM_resolveMasterNodeTable,
} from './psnm-utility/psnm-master-node-resolver.js';
import {
  PSNM_masterMandatoryNodeRows,
  PSNM_masterNodeCoverageRows,
  PSNM_masterNodeToMatchRows,
  PSNM_masterPsCoverageRows,
  PSNM_masterPsToMatchRows,
} from './psnm-utility/psnm-master-adapter.js';

const SAMPLE_TABLE1 = `PS NAME\tPosition\tp1bore\tMandatory
PS-12231/DATUM\tE 438023.221mm S 1140070.762mm U 1184.15mm\t150.00\t
PS-12697/DATUM\tE 604665.151mm S 1092727mm U 607.15mm\t100.00\t`;
const SAMPLE_TABLE4A = `Mandatory PS Name
PS-12231/DATUM
PS-12697/DATUM`;
const SAMPLE_TABLE2 = `Node\tX\tY\tZ\tBore\tMandatory
22140\t-724492.312 mm.\t998.952 mm.\t-110590.633 mm.\t150\tYES
20015\t-699514.875 mm.\t3024.352 mm.\t-115566.000 mm.\t\t`;
const SAMPLE_TABLE3 = `Node\tDia(mm)
22140\t168.3
20015\t273`;
const SAMPLE_TABLE4B = `Mandatory Node No
22140
20015
22220`;

function h(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function csv(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function n(value, decimals = 3) { const x = Number(value); return Number.isFinite(x) ? x.toFixed(decimals) : '-'; }
function countRows(text) { return Math.max(0, String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).filter((x) => !/^-{3,}$/.test(x)).length - 1); }
function nextFrame() { return new Promise((resolve) => requestAnimationFrame(resolve)); }
function triple(value, fallback) { const p = String(value || '').split(',').map((x) => Number(x.trim())); return p.length === 3 && p.every(Number.isFinite) ? { xMm: p[0], yMm: p[1], zMm: p[2] } : { xMm: fallback[0], yMm: fallback[1], zMm: fallback[2] }; }
function objectRowsCsv(rows) { if (!rows?.length) return ''; const keys = Array.from(rows.reduce((set, row) => { Object.keys(row || {}).forEach((key) => set.add(key)); return set; }, new Set())); return [keys.map(csv).join(','), ...rows.map((row) => keys.map((key) => csv(row?.[key])).join(','))].join('\n'); }
async function copyText(text, ctx) { try { await navigator.clipboard.writeText(String(text || '')); ctx.showToast?.('Copied CSV.', 'success'); } catch (error) { ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error'); } }

function makeState() {
  return {
    activeTab: 'source',
    masterSubTab: 'ps',
    sourceDirty: true,
    masterReady: false,
    masterDirty: false,
    source: {
      table1Text: SAMPLE_TABLE1,
      table4AText: SAMPLE_TABLE4A,
      table2Text: SAMPLE_TABLE2,
      table3Text: SAMPLE_TABLE3,
      table4BText: SAMPLE_TABLE4B,
    },
    master: { psRows: [], psIssues: [], nodeRows: [], nodeIssues: [] },
    setup: {
      anchorPsRowId: '',
      anchorNodeRowId: '',
      coordinateDecimals: 0,
      boreMode: 'prefer',
      approx1: '25,25,25',
      approx2: '50,25,50',
      approx3: '50,25,50',
      enableApprox1: true,
      enableApprox2: true,
      enableApprox3: true,
    },
    result: { rows: [], candidateRows: [], mandatoryCoverageRows: [], mandatoryPsCoverageRows: [], userLog: [], debugLog: [] },
    status: { phase: 'Idle', detail: 'Paste source tables, then Resolve Master Tables.', percent: 0 },
  };
}

function installStyle() {
  if (document.getElementById('psnm-style-v6')) return;
  const style = document.createElement('style');
  style.id = 'psnm-style-v6';
  style.textContent = `
.psnm-root{min-height:100%;padding:22px;background:#0f1724;color:#d9e6f7;font-family:system-ui}.psnm-title{margin:0 0 6px;color:#8fc5ff}.psnm-sub{color:#9fb2c7;margin:0}.psnm-launch-tile{height:160px;width:220px;border:1px solid rgba(143,197,255,.25);border-radius:18px;background:linear-gradient(145deg,#10213a,#0b1220);color:#e8f2ff;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.28);display:grid;place-items:center;text-align:center;padding:16px;margin-top:18px}.psnm-tile-icon{font-size:42px;margin-bottom:8px}.psnm-modal-bg{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px}.psnm-modal{width:min(1360px,98vw);height:min(900px,calc(95vh - 1cm));margin-top:1cm;display:flex;flex-direction:column;border:1px solid rgba(143,197,255,.25);border-radius:16px;background:#0f1724;color:#d9e6f7;overflow:hidden}.psnm-p2-fullscreen .psnm-modal{margin-top:0!important}.psnm-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(143,197,255,.16);background:#162238}.psnm-btn{border:1px solid rgba(143,197,255,.28);border-radius:8px;background:#1d4ed8;color:#fff;padding:8px 12px;cursor:pointer;font-weight:700}.psnm-btn-secondary{background:#111827}.psnm-tabs,.psnm-subtabs{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(143,197,255,.14);background:#101a2b}.psnm-tab-btn{border:1px solid rgba(143,197,255,.18);border-radius:999px;background:#0b1220;color:#b7c9dd;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:800}.psnm-tab-btn.active{background:#1d4ed8;color:#fff}.psnm-body{flex:1;overflow:auto;padding:14px;display:grid;gap:14px}.psnm-panel{display:none}.psnm-panel.active{display:grid;gap:14px}.psnm-card{border:1px solid rgba(143,197,255,.2);border-radius:14px;background:#101a2b;overflow:hidden}.psnm-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(143,197,255,.15);background:#162238}.psnm-card-body{padding:12px;display:grid;gap:12px}.psnm-source-ps{display:grid;grid-template-columns:minmax(520px,1fr) 280px;gap:12px}.psnm-source-node{display:grid;grid-template-columns:minmax(460px,1fr) 320px 280px;gap:12px}.psnm-field{display:grid;gap:4px}.psnm-field label{font-size:12px;color:#b7c9dd;font-weight:800}.psnm-field input,.psnm-field textarea,.psnm-field select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.2);border-radius:8px;background:#0b1220;color:#e5edf7;padding:8px;font:12px ui-monospace,Consolas,monospace}.psnm-field textarea{min-height:170px;resize:vertical}.psnm-narrow textarea{min-height:170px}.psnm-setup-grid{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:12px}.psnm-banner{font-size:12px;line-height:1.5;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psnm-summary{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}.psnm-summary div,.psnm-counts div{background:#0b1220;border:1px solid rgba(143,197,255,.15);border-radius:10px;padding:9px}.psnm-summary b{display:block;color:#8fc5ff;font-size:18px}.psnm-summary span,.psnm-counts span{font-size:11px;color:#9fb2c7}.psnm-counts{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.psnm-tablewrap{overflow:auto;max-height:560px}.psnm-table{width:100%;border-collapse:collapse;font-size:12px}.psnm-table th,.psnm-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap;vertical-align:top}.psnm-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psnm-table input,.psnm-table select{background:#0b1220;color:#e5edf7;border:1px solid rgba(143,197,255,.18);border-radius:6px;padding:4px;font-size:12px}.psnm-status-ok{color:#86efac;font-weight:800}.psnm-status-warning,.psnm-status-bore_conflict,.psnm-status-missing_bore,.psnm-status-duplicate_ps{color:#fcd34d;font-weight:800}.psnm-status-error,.psnm-status-invalid_coordinate,.psnm-status-invalid_position,.psnm-status-missing_from_table1,.psnm-status-missing_from_table2,.psnm-status-unmapped,.psnm-status-ambiguous{color:#fca5a5;font-weight:800}.psnm-badge{border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800;background:rgba(59,130,246,.18);color:#93c5fd}.psnm-statusbar{border-top:1px solid rgba(143,197,255,.16);background:#0b1220;padding:9px 12px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.psnm-status-title{font-size:12px;font-weight:800;color:#cfe4ff}.psnm-status-detail{font-size:12px;color:#9fb2c7}.psnm-progress{height:7px;background:#111827;border-radius:999px;overflow:hidden;margin-top:6px}.psnm-progress-fill{height:100%;background:#1d4ed8;transition:width .18s ease}.psnm-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}@media(max-width:1100px){.psnm-source-ps,.psnm-source-node,.psnm-setup-grid,.psnm-summary,.psnm-counts,.psnm-statusbar{grid-template-columns:1fr}.psnm-modal{height:calc(96vh - 1cm)}}`;
  document.head.appendChild(style);
}

function statusClass(value) { return String(value || '').toLowerCase(); }
function summary(state) {
  const rows = state.result.rows || [];
  return `<div class="psnm-summary"><div><b>${countRows(state.source.table1Text)}</b><span>Table 1</span></div><div><b>${countRows(state.source.table2Text)}</b><span>Table 2</span></div><div><b>${state.master.psRows.length}</b><span>Master PS</span></div><div><b>${state.master.nodeRows.length}</b><span>Master Node</span></div><div><b>${state.master.psIssues.length}</b><span>PS Issues</span></div><div><b>${state.master.nodeIssues.length}</b><span>Node Issues</span></div><div><b>${rows.length}</b><span>Match Rows</span></div><div><b>${state.masterReady ? 'Ready' : 'Not Built'}</b><span>Masters</span></div></div>`;
}
function tab(id, label, state) { return `<button class="psnm-tab-btn ${state.activeTab === id ? 'active' : ''}" data-psnm-tab="${id}">${h(label)}</button>`; }
function subtab(id, label, state) { return `<button class="psnm-tab-btn ${state.masterSubTab === id ? 'active' : ''}" data-psnm-subtab="${id}">${h(label)}</button>`; }
function panel(id, state, html) { return `<section class="psnm-panel ${state.activeTab === id ? 'active' : ''}" data-psnm-panel="${id}">${html}</section>`; }
function statusBar(state) { return `<div class="psnm-statusbar"><div><div class="psnm-status-title">${h(state.status.phase)} — ${h(state.status.percent)}%</div><div class="psnm-status-detail">${h(state.status.detail)}</div><div class="psnm-progress"><div class="psnm-progress-fill" style="width:${Math.max(0, Math.min(100, Number(state.status.percent) || 0))}%"></div></div></div><div class="psnm-actions"><button class="psnm-btn" data-psnm-action="resolveMasters">Resolve Master Tables</button><button class="psnm-btn" data-psnm-action="runMatch">Run Match</button></div></div>`; }

function sourcePanel(state) {
  return `<section class="psnm-card"><div class="psnm-card-head"><b>Source Tables</b><button class="psnm-btn" data-psnm-action="resolveMasters">Resolve Master Tables</button></div><div class="psnm-card-body"><div class="psnm-banner"><b>Phase 4B:</b> Table 1+4A resolve Master PS No. Table 2+3+4B resolve Master Node. Matching uses only these Master Tables.</div><div class="psnm-counts"><div><b>${countRows(state.source.table1Text)}</b><br><span>Table 1</span></div><div><b>${countRows(state.source.table4AText)}</b><br><span>Table 4A</span></div><div><b>${countRows(state.source.table2Text)}</b><br><span>Table 2</span></div><div><b>${countRows(state.source.table3Text)}</b><br><span>Table 3</span></div><div><b>${countRows(state.source.table4BText)}</b><br><span>Table 4B</span></div></div><h3>PS Side</h3><div class="psnm-source-ps"><div class="psnm-field"><label>Table 1 - PS Source Table</label><textarea data-source="table1Text">${h(state.source.table1Text)}</textarea></div><div class="psnm-field psnm-narrow"><label>Table 4A - PS Mandatory / Override</label><textarea data-source="table4AText">${h(state.source.table4AText)}</textarea></div></div><h3>Node Side</h3><div class="psnm-source-node"><div class="psnm-field"><label>Table 2 - Node XYZ Source Table</label><textarea data-source="table2Text">${h(state.source.table2Text)}</textarea></div><div class="psnm-field"><label>Table 3 - Node Dia / Bore Source Table</label><textarea data-source="table3Text">${h(state.source.table3Text)}</textarea></div><div class="psnm-field psnm-narrow"><label>Table 4B - Node Mandatory / Override</label><textarea data-source="table4BText">${h(state.source.table4BText)}</textarea></div></div></div></section>`;
}
function masterPsTable(state) {
  const rows = state.master.psRows || [];
  if (!rows.length) return '<div class="psnm-banner">Master PS No is not built.</div>';
  return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>Enabled</th><th>PS Name</th><th>Position Raw</th><th>PS E</th><th>PS U</th><th>PS S</th><th>p1bore</th><th>Mandatory</th><th>Source</th><th>Status</th><th>Edited</th><th>Remarks</th></tr></thead><tbody>${rows.map((row) => `<tr data-master-ps-row="${h(row.rowId)}"><td><input type="checkbox" data-master-ps-field="enabled" ${row.enabled !== false ? 'checked' : ''}></td><td><input data-master-ps-field="psName" value="${h(row.psName)}"></td><td><input data-master-ps-field="positionRaw" value="${h(row.positionRaw)}"></td><td>${n(row.psE)}</td><td>${n(row.psU)}</td><td>${n(row.psS)}</td><td><input data-master-ps-field="p1bore" value="${h(row.p1bore ?? '')}" style="width:80px"></td><td><input type="checkbox" data-master-ps-field="isMandatoryPs" ${row.isMandatoryPs ? 'checked' : ''}></td><td>${h(row.mandatorySource || '-')}</td><td class="psnm-status-${h(statusClass(row.status))}">${h(row.status)}</td><td>${row.userEdited ? 'YES' : 'NO'}</td><td><input data-master-ps-field="remarks" value="${h(row.remarks)}"></td></tr>`).join('')}</tbody></table></div>`;
}
function masterNodeTable(state) {
  const rows = state.master.nodeRows || [];
  if (!rows.length) return '<div class="psnm-banner">Master Node is not built.</div>';
  return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>Enabled</th><th>Node</th><th>Occurrence</th><th>Raw X</th><th>Raw Y</th><th>Raw Z</th><th>Node E</th><th>Node U</th><th>Node S</th><th>Table2 Bore</th><th>Table3 OD</th><th>Derived Bore</th><th>Final Bore</th><th>Bore Source</th><th>Conflict</th><th>Mandatory</th><th>Source</th><th>Status</th><th>Edited</th><th>Remarks</th></tr></thead><tbody>${rows.map((row) => `<tr data-master-node-row="${h(row.rowId)}"><td><input type="checkbox" data-master-node-field="enabled" ${row.enabled !== false ? 'checked' : ''}></td><td><input data-master-node-field="node" value="${h(row.node)}" style="width:80px"></td><td>${h(row.occurrenceId)}</td><td><input data-master-node-field="rawX" value="${h(row.rawX ?? '')}" style="width:110px"></td><td><input data-master-node-field="rawY" value="${h(row.rawY ?? '')}" style="width:90px"></td><td><input data-master-node-field="rawZ" value="${h(row.rawZ ?? '')}" style="width:110px"></td><td>${n(row.nodeE)}</td><td>${n(row.nodeU)}</td><td>${n(row.nodeS)}</td><td>${h(row.table2Bore ?? '-')}</td><td>${h(row.table3Od ?? '-')}</td><td>${h(row.table3DerivedBore ?? '-')}</td><td><input data-master-node-field="finalNodeBore" value="${h(row.finalNodeBore ?? '')}" style="width:80px"></td><td>${h(row.boreSource)}</td><td>${row.boreConflict ? 'YES' : 'NO'}</td><td><input type="checkbox" data-master-node-field="isMandatoryNode" ${row.isMandatoryNode ? 'checked' : ''}></td><td>${h(row.mandatorySource || '-')}</td><td class="psnm-status-${h(statusClass(row.status))}">${h(row.status)}</td><td>${row.userEdited ? 'YES' : 'NO'}</td><td><input data-master-node-field="remarks" value="${h(row.remarks)}"></td></tr>`).join('')}</tbody></table></div>`;
}
function issuesTable(state) {
  const rows = [...(state.master.psIssues || []), ...(state.master.nodeIssues || [])];
  if (!rows.length) return '<div class="psnm-banner">No resolution issues.</div>';
  return resultTableLike(rows, ['psName','node','occurrenceId','status','sourceTable','sourceRow','remarks']);
}
function masterPanel(state) {
  const body = state.masterSubTab === 'ps' ? masterPsTable(state) : state.masterSubTab === 'node' ? masterNodeTable(state) : issuesTable(state);
  return `<section class="psnm-card"><div class="psnm-card-head"><b>Master Tables</b><div class="psnm-actions"><button class="psnm-btn" data-psnm-action="resolveMasters">Rebuild Master Tables</button><button class="psnm-btn psnm-btn-secondary" data-psnm-action="copyMasterPs">Copy Master PS</button><button class="psnm-btn psnm-btn-secondary" data-psnm-action="copyMasterNode">Copy Master Node</button></div></div><div class="psnm-subtabs">${subtab('ps','Master PS No',state)}${subtab('node','Master Node',state)}${subtab('issues','Resolution Issues',state)}</div><div class="psnm-card-body"><div class="psnm-banner"><b>Matching uses only the Master Tables shown here.</b> Raw source tables are not passed directly to the matcher after master resolution.</div>${body}</div></section>`;
}
function setupPanel(state) {
  const psRows = state.master.psRows.filter((row) => row.enabled !== false && row.status === 'OK' && row.positionRaw);
  const nodeRows = state.master.nodeRows.filter((row) => row.enabled !== false && row.status !== 'MISSING_FROM_TABLE2' && row.status !== 'INVALID_COORDINATE' && Number.isFinite(row.rawX) && Number.isFinite(row.rawY) && Number.isFinite(row.rawZ));
  const psOpts = psRows.length ? psRows.map((row) => `<option value="${h(row.rowId)}" ${row.rowId === state.setup.anchorPsRowId ? 'selected' : ''}>${h(row.psName)}</option>`).join('') : '<option value="">Build Master PS first</option>';
  const nodeOpts = nodeRows.length ? nodeRows.map((row) => `<option value="${h(row.rowId)}" ${row.rowId === state.setup.anchorNodeRowId ? 'selected' : ''}>${h(row.node)} (${h(row.occurrenceId)})</option>`).join('') : '<option value="">Build Master Node first</option>';
  const anchor = getAnchorRows(state);
  return `<section class="psnm-card"><div class="psnm-card-head"><b>Anchor & Match Setup</b><button class="psnm-btn" data-psnm-action="runMatch">Run Match from Master Tables</button></div><div class="psnm-card-body"><div class="psnm-banner"><b>Anchor PS and Anchor Node are fetched from Master Tables only.</b></div><div class="psnm-setup-grid"><div class="psnm-field"><label>Anchor PS Name - Master PS No</label><select data-setup="anchorPsRowId">${psOpts}</select></div><div class="psnm-field"><label>Anchor Node - Master Node</label><select data-setup="anchorNodeRowId">${nodeOpts}</select></div><div class="psnm-field"><label>Anchor PS Position</label><input readonly value="${h(anchor.ps?.positionRaw || '')}"></div><div class="psnm-field"><label>Anchor Node X,Y,Z</label><input readonly value="${h(anchor.node ? `${anchor.node.rawX}, ${anchor.node.rawY}, ${anchor.node.rawZ}` : '')}"></div><div class="psnm-field"><label>Exact Decimals</label><input type="number" data-setup="coordinateDecimals" value="${h(state.setup.coordinateDecimals)}"></div><div class="psnm-field"><label>Bore Matching Mode</label><select data-setup="boreMode"><option value="strict" ${state.setup.boreMode === 'strict' ? 'selected' : ''}>Strict Bore</option><option value="prefer" ${state.setup.boreMode === 'prefer' ? 'selected' : ''}>Prefer Bore</option><option value="ignore" ${state.setup.boreMode === 'ignore' ? 'selected' : ''}>Ignore Bore</option></select></div><div class="psnm-field"><label>Approx 1 ΔE,ΔU,ΔS</label><input data-setup="approx1" value="${h(state.setup.approx1)}"></div><div class="psnm-field"><label>Approx 2 ΔE,ΔU,ΔS</label><input data-setup="approx2" value="${h(state.setup.approx2)}"></div><div class="psnm-field"><label>Approx 3 ΔE,ΔU,ΔS</label><input data-setup="approx3" value="${h(state.setup.approx3)}"></div></div></div></section>`;
}
function resultTable(rows) {
  if (!rows?.length) return '<div class="psnm-banner">No rows.</div>';
  return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>PS Name</th><th>Node</th><th>Occurrence</th><th>Match Type</th><th>Final Status</th><th>PS Mandatory</th><th>Node Mandatory</th><th>Bore</th><th>ΔE</th><th>ΔU</th><th>ΔS</th><th>Max Δ</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${h(row.psName)}</td><td>${h(row.matchingNode || '-')}</td><td>${h(row.occurrenceId || '-')}</td><td><span class="psnm-badge">${h(row.matchType)}</span></td><td>${h(row.finalStatus || '-')}</td><td>${row.isMandatoryPs ? 'YES' : 'NO'}</td><td>${row.isMandatoryNode ? 'YES' : 'NO'}</td><td>${h(row.boreStatus || '-')}</td><td>${n(row.dxMm)}</td><td>${n(row.dyMm)}</td><td>${n(row.dzMm)}</td><td>${n(row.maxAxisDeltaMm)}</td></tr>`).join('')}</tbody></table></div>`;
}
function resultTableLike(rows, keys) { if (!rows?.length) return '<div class="psnm-banner">No rows.</div>'; return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr>${keys.map((key) => `<th>${h(key)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${h(row?.[key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function matchPanel(state) { return `<section class="psnm-card"><div class="psnm-card-head"><b>Match Results</b><button class="psnm-btn psnm-btn-secondary" data-psnm-action="copyMatch">Copy CSV</button></div><div class="psnm-card-body">${resultTable(state.result.rows)}</div></section>`; }
function coveragePanel(state) { return `<section class="psnm-card"><div class="psnm-card-head"><b>Coverage / Exceptions</b><button class="psnm-btn psnm-btn-secondary" data-psnm-action="copyCoverage">Copy CSV</button></div><div class="psnm-card-body"><h3>Mandatory PS Coverage - from Master PS No</h3>${resultTableLike(state.result.mandatoryPsCoverageRows, ['psName','mandatorySource','matchedNode','occurrenceId','nodeMandatory','status'])}<h3>Mandatory Node Coverage - from Master Node</h3>${resultTableLike(state.result.mandatoryCoverageRows, ['node','occurrenceId','mandatorySource','inMasterNode','matchedPs','status'])}</div></section>`; }
function logPanel(state, debug = false) { const rows = debug ? state.result.debugLog : state.result.userLog; return `<section class="psnm-card"><div class="psnm-card-head"><b>${debug ? 'Debug Console' : 'User Log'}</b><button class="psnm-btn psnm-btn-secondary" data-psnm-action="${debug ? 'copyDebug' : 'copyUser'}">Copy CSV</button></div><div class="psnm-card-body">${resultTableLike(rows, debug ? ['sequence','level','code','message'] : ['level','category','source','item','reason','suggestedAction'])}</div></section>`; }

function getAnchorRows(state) {
  const ps = state.master.psRows.find((row) => row.rowId === state.setup.anchorPsRowId);
  const node = state.master.nodeRows.find((row) => row.rowId === state.setup.anchorNodeRowId);
  return { ps, node };
}
function selectedAnchor(state) {
  const { ps, node } = getAnchorRows(state);
  if (!ps) throw new Error('Anchor PS must be selected from Master PS No.');
  if (!node) throw new Error('Anchor Node must be selected from Master Node.');
  return { psName: ps.psName, psPosition: ps.positionRaw, node: node.node, nodePosition: `${node.rawX}, ${node.rawY}, ${node.rawZ}` };
}
function ensureAnchors(state) {
  const psRows = state.master.psRows.filter((row) => row.enabled !== false && row.status === 'OK' && row.positionRaw);
  if (!psRows.some((row) => row.rowId === state.setup.anchorPsRowId)) state.setup.anchorPsRowId = psRows[0]?.rowId || '';
  const nodeRows = state.master.nodeRows.filter((row) => row.enabled !== false && row.status !== 'MISSING_FROM_TABLE2' && row.status !== 'INVALID_COORDINATE' && Number.isFinite(row.rawX) && Number.isFinite(row.rawY) && Number.isFinite(row.rawZ));
  if (!nodeRows.some((row) => row.rowId === state.setup.anchorNodeRowId)) state.setup.anchorNodeRowId = nodeRows[0]?.rowId || '';
}
function applyCurrentTransform(state) {
  try {
    const transform = PSNM_deriveTransformFromAnchor(selectedAnchor(state));
    PSNM_applyMasterNodeTransform(state.master.nodeRows, transform, Number(state.setup.coordinateDecimals) || 0);
  } catch {}
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  installStyle();
  let state = makeState();

  function renderModal() {
    return `<div class="psnm-modal-bg" data-psnm="modal"><div class="psnm-modal"><div class="psnm-modal-head"><div><h2 class="psnm-title">PSNM Workbench</h2><p class="psnm-sub">Raw Sources → Master Tables → Match from Masters</p></div><button class="psnm-btn psnm-btn-secondary" data-psnm-action="close">Close</button></div><div class="psnm-tabs">${tab('source','1. Source Tables',state)}${tab('master','2. Master Tables',state)}${tab('setup','3. Anchor & Match Setup',state)}${tab('match','4. Match Results',state)}${tab('coverage','5. Coverage / Exceptions',state)}${tab('user','6. User Log',state)}${tab('debug','7. Debug Console',state)}</div><div class="psnm-body"><div data-summary>${summary(state)}</div>${panel('source',state,sourcePanel(state))}${panel('master',state,masterPanel(state))}${panel('setup',state,setupPanel(state))}${panel('match',state,matchPanel(state))}${panel('coverage',state,coveragePanel(state))}${panel('user',state,logPanel(state,false))}${panel('debug',state,logPanel(state,true))}</div>${statusBar(state)}</div></div>`;
  }
  function refresh() { const modal = container.querySelector('[data-psnm="modal"]'); if (modal) modal.outerHTML = renderModal(); }
  function updateStatus(next) { state.status = { ...state.status, ...next }; refresh(); }
  function resolveMasters() {
    const logger = PSNM_createRunLogger();
    const ps = PSNM_resolveMasterPsTable({ table1Text: state.source.table1Text, table4AText: state.source.table4AText, logger });
    const node = PSNM_resolveMasterNodeTable({ table2Text: state.source.table2Text, table3Text: state.source.table3Text, table4BText: state.source.table4BText, logger });
    state.master.psRows = ps.rows;
    state.master.psIssues = ps.issues;
    state.master.nodeRows = node.rows;
    state.master.nodeIssues = node.issues;
    state.masterReady = true;
    state.masterDirty = false;
    state.sourceDirty = false;
    state.result.userLog = logger.userLog;
    state.result.debugLog = logger.debugLog;
    ensureAnchors(state);
    applyCurrentTransform(state);
    state.activeTab = 'master';
    state.status = { phase: 'Master Tables Ready', detail: `Resolved Master PS ${ps.rows.length} row(s), Master Node ${node.rows.length} row(s).`, percent: 45 };
    refresh();
  }
  async function runMatch() {
    try {
      if (!state.masterReady) throw new Error('Build Master Tables before matching.');
      if (state.sourceDirty) throw new Error('Source tables changed. Rebuild Master Tables before matching.');
      updateStatus({ phase: 'Matching from Master Tables', detail: 'Preparing master-derived PS and Node rows.', percent: 50 });
      await nextFrame();
      const logger = PSNM_createRunLogger();
      const anchor = selectedAnchor(state);
      const transform = PSNM_deriveTransformFromAnchor(anchor);
      PSNM_applyMasterNodeTransform(state.master.nodeRows, transform, Number(state.setup.coordinateDecimals) || 0);
      const psRows = PSNM_masterPsToMatchRows(state.master.psRows);
      const nodeRows = PSNM_masterNodeToMatchRows(state.master.nodeRows);
      const mandatoryNodeRows = PSNM_masterMandatoryNodeRows(state.master.nodeRows);
      const result = PSNM_buildMatchTable({ logger, anchor, psRows, nodeRows, nodeDiaRows: [], mandatoryNodeRows, boreMode: state.setup.boreMode, coordinateDecimals: Number(state.setup.coordinateDecimals) || 0, enableApprox1: state.setup.enableApprox1, enableApprox2: state.setup.enableApprox2, enableApprox3: state.setup.enableApprox3, approx1: triple(state.setup.approx1, [25,25,25]), approx2: triple(state.setup.approx2, [50,25,50]), approx3: triple(state.setup.approx3, [50,25,50]) });
      result.mandatoryPsCoverageRows = PSNM_masterPsCoverageRows(state.master.psRows, result.rows);
      result.mandatoryCoverageRows = PSNM_masterNodeCoverageRows(state.master.nodeRows, result.rows);
      state.result = result;
      state.master.nodeIssues = state.master.nodeRows.filter((row) => row.status !== 'OK');
      state.activeTab = 'match';
      state.status = { phase: 'Complete', detail: `Matched ${result.rows.filter((row) => String(row.finalStatus || '').startsWith('MATCHED')).length} of ${result.rows.length} PS row(s) from Master Tables.`, percent: 100 };
      refresh();
    } catch (error) {
      state.status = { phase: 'Failed', detail: String(error?.message || error), percent: 100 };
      refresh();
      ctx.showToast?.(`PSNM failed: ${error?.message || error}`, 'error');
    }
  }
  function updateMasterPsCell(rowId, field, value, checked) {
    const row = state.master.psRows.find((item) => item.rowId === rowId);
    if (!row) return;
    if (field === 'enabled' || field === 'isMandatoryPs') row[field] = checked === true;
    else if (field === 'p1bore') row[field] = value === '' ? null : Number(value);
    else row[field] = value;
    row.userEdited = true;
    row.sourceTable = row.sourceTable ? `${row.sourceTable};USER_EDIT` : 'USER_EDIT';
    PSNM_recomputeMasterPsRow(row);
    state.master.psIssues = state.master.psRows.filter((item) => item.status !== 'OK');
    state.masterDirty = true;
    ensureAnchors(state);
    applyCurrentTransform(state);
    refresh();
  }
  function updateMasterNodeCell(rowId, field, value, checked) {
    const row = state.master.nodeRows.find((item) => item.rowId === rowId);
    if (!row) return;
    if (field === 'enabled' || field === 'isMandatoryNode') row[field] = checked === true;
    else if (['rawX','rawY','rawZ','finalNodeBore'].includes(field)) row[field] = value === '' ? null : Number(value);
    else row[field] = value;
    row.userEdited = true;
    row.sourceTable = row.sourceTable ? `${row.sourceTable};USER_EDIT` : 'USER_EDIT';
    PSNM_recomputeMasterNodeRow(row);
    state.master.nodeIssues = state.master.nodeRows.filter((item) => item.status !== 'OK');
    state.masterDirty = true;
    ensureAnchors(state);
    applyCurrentTransform(state);
    refresh();
  }
  function onClick(event) {
    const tabBtn = event.target?.closest?.('[data-psnm-tab]');
    if (tabBtn) { state.activeTab = tabBtn.dataset.psnmTab; refresh(); return; }
    const sub = event.target?.closest?.('[data-psnm-subtab]');
    if (sub) { state.masterSubTab = sub.dataset.psnmSubtab; refresh(); return; }
    const action = event.target?.closest?.('[data-psnm-action]')?.dataset?.psnmAction;
    if (!action) return;
    if (action === 'open') { container.insertAdjacentHTML('beforeend', renderModal()); return; }
    if (action === 'close') { container.querySelector('[data-psnm="modal"]')?.remove(); return; }
    if (action === 'resolveMasters') { resolveMasters(); return; }
    if (action === 'runMatch') { void runMatch(); return; }
    if (action === 'copyMasterPs') copyText(objectRowsCsv(state.master.psRows), ctx);
    else if (action === 'copyMasterNode') copyText(objectRowsCsv(state.master.nodeRows), ctx);
    else if (action === 'copyMatch') copyText(objectRowsCsv(state.result.rows), ctx);
    else if (action === 'copyCoverage') copyText(objectRowsCsv(state.result.mandatoryPsCoverageRows || []) + '\n\n' + objectRowsCsv(state.result.mandatoryCoverageRows || []), ctx);
    else if (action === 'copyUser') copyText(objectRowsCsv(state.result.userLog), ctx);
    else if (action === 'copyDebug') copyText(objectRowsCsv(state.result.debugLog), ctx);
  }
  function onInput(event) {
    const source = event.target?.closest?.('[data-source]');
    if (source) {
      state.source[source.dataset.source] = source.value;
      state.sourceDirty = true;
      state.masterReady = false;
      state.status = { phase: 'Sources Edited', detail: 'Source tables changed. Rebuild Master Tables before matching.', percent: 5 };
      return;
    }
    const setup = event.target?.closest?.('[data-setup]');
    if (setup) {
      const key = setup.dataset.setup;
      state.setup[key] = setup.type === 'checkbox' ? setup.checked : setup.value;
      ensureAnchors(state);
      applyCurrentTransform(state);
      return;
    }
    const ps = event.target?.closest?.('[data-master-ps-field]');
    if (ps) {
      const row = event.target.closest('[data-master-ps-row]');
      updateMasterPsCell(row?.dataset.masterPsRow, ps.dataset.masterPsField, ps.value, ps.checked);
      return;
    }
    const node = event.target?.closest?.('[data-master-node-field]');
    if (node) {
      const row = event.target.closest('[data-master-node-row]');
      updateMasterNodeCell(row?.dataset.masterNodeRow, node.dataset.masterNodeField, node.value, node.checked);
    }
  }
  function onKeydown(event) { if (event.key === 'Escape') container.querySelector('[data-psnm="modal"]')?.remove(); }

  container.innerHTML = `<section class="psnm-root"><h1 class="psnm-title">Utilities</h1><p class="psnm-sub">PSNM master-table workbench.</p><button class="psnm-launch-tile" data-psnm-action="open" type="button"><div><div class="psnm-tile-icon">🔗</div><div><b>PSNM Matcher</b></div><div class="psnm-sub">Source → Master → Match</div></div></button></section>`;
  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onInput);
  document.addEventListener('keydown', onKeydown);
  return () => { container.removeEventListener('click', onClick); container.removeEventListener('input', onInput); container.removeEventListener('change', onInput); document.removeEventListener('keydown', onKeydown); };
}
