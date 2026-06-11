import {
  PS_MAPPING_SAMPLE_TABLE1,
  PS_MAPPING_SAMPLE_TABLE1A,
  PS_MAPPING_SAMPLE_TABLE1B,
  PS_MAPPING_SAMPLE_TABLE1C,
  PS_MAPPING_SAMPLE_TABLE1D,
  PS_MAPPING_SAMPLE_TABLE2,
} from './ps-mapping-utility/ps-mapping-sample-data.js';
import { DEFAULT_OPTIONS, runPsMappingResolver, rowsToCsv } from './ps-mapping-utility/ps-mapping-engine-diagnostics.js?v=20260611-line-diagnostics-1';

const STYLE_ID = 'ps-mapping-utility-style';

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countRows(text) {
  return Math.max(0, String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length - 1);
}

function displayList(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

function tableToTsv(rows = [], keys = []) {
  return [keys, ...rows.map((row) => keys.map((key) => displayList(row?.[key])))]
    .map((line) => line.map((value) => String(value ?? '').replace(/\t/g, ' ')).join('\t'))
    .join('\n');
}

function yn(value) {
  return value === true || String(value || '').toUpperCase() === 'YES' ? 'YES' : '';
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-tile{height:160px;width:220px;border:1px solid rgba(143,197,255,.25);border-radius:18px;background:linear-gradient(145deg,#10213a,#0b1220);color:#e8f2ff;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.28);display:grid;place-items:center;text-align:center;padding:16px;margin-top:18px}.psmap-tile-icon{font-size:42px;margin-bottom:8px}.psmap-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.75);z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px}.psmap-modal{width:min(1480px,98vw);height:min(920px,94vh);display:flex;flex-direction:column;background:#0f1724;color:#d9e6f7;border:1px solid rgba(143,197,255,.25);border-radius:16px;overflow:hidden}.psmap-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(143,197,255,.16);background:#162238}.psmap-title{margin:0;color:#8fc5ff}.psmap-sub{margin:4px 0 0;color:#9fb2c7}.psmap-btn{border:1px solid rgba(143,197,255,.28);border-radius:8px;background:#1d4ed8;color:#fff;padding:8px 12px;cursor:pointer;font-weight:700}.psmap-btn.secondary{background:#111827}.psmap-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(143,197,255,.14);background:#101a2b}.psmap-tab{border:1px solid rgba(143,197,255,.18);border-radius:999px;background:#0b1220;color:#b7c9dd;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:800}.psmap-tab.active{background:#1d4ed8;color:#fff}.psmap-body{flex:1;overflow:auto;padding:14px;display:grid;gap:14px}.psmap-panel{display:none}.psmap-panel.active{display:grid;gap:14px}.psmap-card{border:1px solid rgba(143,197,255,.2);border-radius:14px;background:#101a2b;overflow:hidden}.psmap-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(143,197,255,.15);background:#162238}.psmap-card-body{padding:12px;display:grid;gap:12px}.psmap-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.psmap-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.psmap-field{display:grid;gap:4px}.psmap-field label{font-size:12px;color:#b7c9dd;font-weight:800}.psmap-field input,.psmap-field textarea,.psmap-field select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.2);border-radius:8px;background:#0b1220;color:#e5edf7;padding:8px;font:12px ui-monospace,Consolas,monospace}.psmap-field input[type=checkbox]{width:auto}.psmap-field textarea{min-height:150px;resize:vertical}.psmap-check{display:flex;align-items:center;gap:8px;font-size:12px;color:#d9e6f7}.psmap-summary{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}.psmap-summary div{background:#0b1220;border:1px solid rgba(143,197,255,.15);border-radius:10px;padding:9px}.psmap-summary b{display:block;color:#8fc5ff;font-size:18px}.psmap-summary span{font-size:11px;color:#9fb2c7}.psmap-banner{font-size:12px;line-height:1.5;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psmap-tablewrap{overflow:auto;max-height:560px}.psmap-table{width:100%;border-collapse:collapse;font-size:12px}.psmap-table th,.psmap-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap;vertical-align:top}.psmap-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psmap-badge{border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800;background:rgba(59,130,246,.18);color:#93c5fd}@media(max-width:1100px){.psmap-grid-2,.psmap-grid-3,.psmap-summary{grid-template-columns:1fr}.psmap-modal{height:96vh}}`;
  document.head.appendChild(style);
}

function tab(id, label, state) {
  return `<button type="button" class="psmap-tab ${state.activeTab === id ? 'active' : ''}" data-psmap-tab="${h(id)}">${h(label)}</button>`;
}

function panel(id, state, html) {
  return `<section class="psmap-panel ${state.activeTab === id ? 'active' : ''}" data-psmap-panel="${h(id)}">${html}</section>`;
}

function table(rows = [], columns = []) {
  if (!rows.length) return '<div class="psmap-banner">No rows.</div>';
  return `<div class="psmap-tablewrap"><table class="psmap-table"><thead><tr>${columns.map((c) => `<th>${h(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((c) => `<td>${h(displayList(c.value ? c.value(row) : row[c.key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function makeState() {
  return {
    activeTab: 'source',
    source: {
      table1Text: PS_MAPPING_SAMPLE_TABLE1,
      table1AText: PS_MAPPING_SAMPLE_TABLE1A,
      table1BText: PS_MAPPING_SAMPLE_TABLE1B,
      table1CText: PS_MAPPING_SAMPLE_TABLE1C,
      table1DText: PS_MAPPING_SAMPLE_TABLE1D,
      table2Text: PS_MAPPING_SAMPLE_TABLE2,
    },
    setup: { ...DEFAULT_OPTIONS },
    result: null,
  };
}

function summary(state) {
  const s = state.result?.summary || {};
  return `<div class="psmap-summary"><div><b>${countRows(state.source.table1Text)}</b><span>Table-1 rows</span></div><div><b>${countRows(state.source.table1CText)}</b><span>Table-1C rows</span></div><div><b>${s.table1Rows ?? 0}</b><span>Consolidated T1</span></div><div><b>${s.table2Rows ?? 0}</b><span>Consolidated T2</span></div><div><b>${s.mapped ?? 0}</b><span>Mapped</span></div><div><b>${s.review ?? 0}</b><span>Review</span></div><div><b>${s.noMatch ?? 0}</b><span>No Match</span></div><div><b>${s.candidateRows ?? 0}</b><span>Candidates</span></div><div><b>${s.supportCoverageIssues ?? 0}</b><span>Coverage Issues</span></div></div>`;
}

function sourcePanel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Source Tables</b><div><button class="psmap-btn secondary" data-psmap-action="loadSample">Load Sample</button> <button class="psmap-btn" data-psmap-action="run">Run Mapping</button></div></div><div class="psmap-card-body"><div class="psmap-banner"><b>Table-1C can be simple Node/ISONOTE or rich Line No / Node / PS No / Pipe size / ISONOTE / Mandatory.</b> Rich Table-1C can synthesize Table-1/1A/1B reference data.</div><div class="psmap-grid-2"><div class="psmap-field"><label>Table-1 - PS No / Node Optional</label><textarea data-psmap-source="table1Text">${h(state.source.table1Text)}</textarea></div><div class="psmap-field"><label>Table-2 - Model PS Data</label><textarea data-psmap-source="table2Text">${h(state.source.table2Text)}</textarea></div></div><div class="psmap-grid-3"><div class="psmap-field"><label>Table-1A - Node / Dia Optional</label><textarea data-psmap-source="table1AText">${h(state.source.table1AText)}</textarea></div><div class="psmap-field"><label>Table-1B - Node / Line No Optional</label><textarea data-psmap-source="table1BText">${h(state.source.table1BText)}</textarea></div><div class="psmap-field"><label>Table-1D - Master Keyword Searcher</label><textarea data-psmap-source="table1DText">${h(state.source.table1DText)}</textarea></div></div><div class="psmap-field"><label>Table-1C - Support Master / ISONOTE Master</label><textarea data-psmap-source="table1CText" style="min-height:210px">${h(state.source.table1CText)}</textarea></div></div></section>`;
}

function setupPanel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Resolver Setup</b><button class="psmap-btn" data-psmap-action="run">Run Mapping</button></div><div class="psmap-card-body"><div class="psmap-grid-3"><div class="psmap-field"><label>Bore Mode</label><select data-psmap-setup="boreMode"><option value="prefer" ${state.setup.boreMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.setup.boreMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.setup.boreMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>Line Mode</label><select data-psmap-setup="lineMode"><option value="prefer" ${state.setup.lineMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.setup.lineMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.setup.lineMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>Support Mode</label><select data-psmap-setup="supportMode"><option value="prefer" ${state.setup.supportMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.setup.supportMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.setup.supportMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div></div></div></section>`;
}

function optionChecked(state, key) { return state.setup[key] !== false ? 'checked' : ''; }
function presetOptions(value) {
  return `<option value="SERVICE_STEM_SIZE_OPTIONAL" ${value === 'SERVICE_STEM_SIZE_OPTIONAL' ? 'selected' : ''}>Service Stem, Size Optional</option><option value="STRICT_SIZE_SERVICE_STEM" ${value === 'STRICT_SIZE_SERVICE_STEM' ? 'selected' : ''}>Strict Size + Service Stem</option><option value="RAW_EXACT_ONLY" ${value === 'RAW_EXACT_ONLY' ? 'selected' : ''}>Raw Exact Only</option>`;
}
function configPanel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Config / Diagnostics</b><button class="psmap-btn" data-psmap-action="run">Run Mapping</button></div><div class="psmap-card-body"><div class="psmap-banner"><b>Line Family is now size-free.</b> Examples: 6&quot;-S8811951, 6&quot;-S-8811951, and ASIM-1885-6&quot;-S-8811951-91261M7-HC all normalize to <b>S8811951</b>. Pipe size/DN is checked separately.</div><div class="psmap-grid-2"><div class="psmap-field"><label>Table-1 Line Regex Preset</label><select data-psmap-setup="lineFamilyTable1Preset">${presetOptions(state.setup.lineFamilyTable1Preset)}</select></div><div class="psmap-field"><label>Table-2 Line Regex Preset</label><select data-psmap-setup="lineFamilyTable2Preset">${presetOptions(state.setup.lineFamilyTable2Preset)}</select></div></div><div class="psmap-grid-3"><label class="psmap-check"><input type="checkbox" data-psmap-setup="showTable1LineRegexBasis" ${optionChecked(state, 'showTable1LineRegexBasis')}> Show Table-1 regex basis</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="showTable2LineRegexBasis" ${optionChecked(state, 'showTable2LineRegexBasis')}> Show Table-2 regex basis</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="normalizeServiceDash" ${optionChecked(state, 'normalizeServiceDash')}> Normalize service dash: S-8811951 → S8811951</label></div><div class="psmap-grid-3"><label class="psmap-check"><input type="checkbox" data-psmap-setup="stripLeadingSlashForLine" ${optionChecked(state, 'stripLeadingSlashForLine')}> Strip leading slash</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="stripProjectPrefixForLine" ${optionChecked(state, 'stripProjectPrefixForLine')}> Strip project prefix for line-family extraction</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="enableNearLineDiagnostic" ${optionChecked(state, 'enableNearLineDiagnostic')}> Enable near line-family diagnostic</label></div><div class="psmap-grid-3"><div class="psmap-field"><label>Near max edit distance</label><input type="number" min="0" max="3" step="1" data-psmap-setup="nearLineMaxEditDistance" value="${h(state.setup.nearLineMaxEditDistance)}"></div><div class="psmap-field"><label>Near min stem length</label><input type="number" min="1" max="20" step="1" data-psmap-setup="nearLineMinStemLength" value="${h(state.setup.nearLineMinStemLength)}"></div><label class="psmap-check"><input type="checkbox" data-psmap-setup="nearLineReviewOnly" ${optionChecked(state, 'nearLineReviewOnly')}> Near diagnostic is review-only</label></div><div class="psmap-banner"><b>Near diagnostic logic:</b> after Base PS matches, DN/support are acceptable, and exact line family fails, the resolver calculates edit distance between Table-2 and Table-1 line families. Distance ≤ configured max becomes LINE_FAMILY_NEAR_MISMATCH, USER_REVIEW_REQUIRED, never auto-corrected.</div></div></section>`;
}

const CONSOLIDATED_T1_COLUMNS = [
  { key: 'id', label: 'ID' }, { key: 'source', label: 'Source' }, { key: 'sourceRow', label: 'Source Row' }, { key: 'table1PsNo', label: 'Table-1 PS No' }, { key: 'basePs', label: 'Base PS' }, { key: 'tag', label: 'Tag' }, { key: 'node', label: 'Node' }, { key: 'nodeLine', label: 'Line No' }, { key: 'lineFamily', label: 'Line Family' }, { key: 'lineRegexBasis', label: 'Line Regex Basis' }, { key: 'lineNormalized', label: 'Line Normalized' }, { key: 'lineTransforms', label: 'Line Transforms' }, { key: 'lineWarning', label: 'Line Warning' }, { key: 'pipeSizeRaw', label: 'Pipe Size' }, { key: 'nps', label: 'NPS' }, { key: 'derivedDn', label: 'Derived DN' }, { key: 'nodeDia', label: 'Dia/OD' }, { key: 'boreSource', label: 'Bore Source' }, { key: 'mandatory', label: 'Mandatory', value: (r) => yn(r.mandatory) }, { key: 'nodeIsonote', label: 'ISONOTE' }, { key: 'supportTypesAvailable', label: 'Master Keywords' },
];
const CONSOLIDATED_T2_COLUMNS = [
  { key: 'id', label: 'ID' }, { key: 'sourceRow', label: 'Source Row' }, { key: 'psnoModel', label: 'PSNO_Model' }, { key: 'basePs', label: 'Base PS' }, { key: 'modelTag', label: 'Model Tag' }, { key: 'isDatum', label: 'Datum', value: (r) => yn(r.isDatum) }, { key: 'boreRaw', label: 'Bore Raw' }, { key: 'bore', label: 'Bore' }, { key: 'boreStatus', label: 'Bore Status' }, { key: 'pipe', label: 'Pipe' }, { key: 'pipeKey', label: 'Pipe Key' }, { key: 'lineFamily', label: 'Line Family' }, { key: 'lineRegexBasis', label: 'Line Regex Basis' }, { key: 'lineNormalized', label: 'Line Normalized' }, { key: 'lineTransforms', label: 'Line Transforms' }, { key: 'lineWarning', label: 'Line Warning' }, { key: 'dtxr', label: 'DTXR' }, { key: 'supportTypesRequested', label: 'DTXR Keywords' }, { key: 'mandatory', label: 'Mandatory', value: (r) => yn(r.mandatory) }, { key: 'parseWarnings', label: 'Parse Warnings' }, { key: 'rawColumns', label: 'Raw Columns', value: (r) => JSON.stringify(r.rawColumns || {}, null, 2) },
];
const VALIDATOR_COLUMNS = [
  { key: 'enabled', label: 'Enabled', value: (r) => yn(r.enabled) }, { key: 'psnoModel', label: 'PSNO_Model' }, { key: 'node', label: 'Node' }, { key: 'table1PsNo', label: 'Table-1 PS No' }, { key: 'tag', label: 'Tag' }, { key: 'source', label: 'T1 Source' }, { key: 'modelLineFamily', label: 'T2 Line Family' }, { key: 'nodeLineFamily', label: 'T1 Line Family' }, { key: 'modelLineRegexBasis', label: 'T2 Regex Basis' }, { key: 'nodeLineRegexBasis', label: 'T1 Regex Basis' }, { key: 'nearDistance', label: 'Near Distance' }, { key: 'modelBore', label: 'T2 Bore' }, { key: 'derivedDn', label: 'T1 Derived DN' }, { key: 'dtxr', label: 'T2 DTXR' }, { key: 'mandatory', label: 'T2 Mandatory', value: (r) => yn(r.mandatory) }, { key: 'supportMatch', label: 'Support match' }, { key: 'basis', label: 'Basis' }, { key: 'finalStatus', label: 'Final Status' }, { key: 'confidence', label: 'Confidence' }, { key: 'confidenceScore', label: 'Confidence Score' }, { key: 'reviewAction', label: 'Review Action' }, { key: 'lineWarning', label: 'Line Warning' }, { key: 'warnings', label: 'Warnings' }, { key: 'nodeCoverageNote', label: 'Node Coverage Note' },
];
const CANDIDATE_COLUMNS = [
  { key: 'psnoModel', label: 'PSNO_Model' }, { key: 'candidateNode', label: 'Candidate Node' }, { key: 'table1PsNo', label: 'Table-1 PS No' }, { key: 'tag', label: 'Tag' }, { key: 'nodeIsonote', label: 'ISONOTE' }, { key: 'source', label: 'Source' }, { key: 'lineFamily', label: 'T2 Line Family' }, { key: 'nodeLineFamily', label: 'T1 Line Family' }, { key: 'lineRegexBasis', label: 'T2 Regex Basis' }, { key: 'nodeLineRegexBasis', label: 'T1 Regex Basis' }, { key: 'nearDistance', label: 'Near Distance' }, { key: 'nodeLine', label: 'Line No' }, { key: 'pipeSizeRaw', label: 'Pipe Size' }, { key: 'derivedDn', label: 'Derived DN' }, { key: 'psBasis', label: 'PS Basis' }, { key: 'boreBasis', label: 'Bore Basis' }, { key: 'lineBasis', label: 'Line Basis' }, { key: 'supportBasis', label: 'Support Basis' }, { key: 'supportMatch', label: 'Support match' }, { key: 'eligible', label: 'Eligible', value: (r) => yn(r.eligible) }, { key: 'autoSelectable', label: 'Auto Selectable', value: (r) => yn(r.autoSelectable) }, { key: 'reviewRequired', label: 'Review Required', value: (r) => yn(r.reviewRequired) }, { key: 'selected', label: 'Selected', value: (r) => yn(r.selected) }, { key: 'finalStatus', label: 'Final Status' }, { key: 'confidence', label: 'Confidence' }, { key: 'confidenceScore', label: 'Confidence Score' }, { key: 'score', label: 'Score' }, { key: 'warnings', label: 'Warnings' }, { key: 'reason', label: 'Reason' }, { key: 'nodeCoverageNote', label: 'Node Coverage Note' },
];
const COVERAGE_COLUMNS = [
  { key: 'node', label: 'Node' }, { key: 'table1PsNo', label: 'Table-1 PS No' }, { key: 'tag', label: 'Tag' }, { key: 'source', label: 'Source' }, { key: 'lineNo', label: 'Line No' }, { key: 'lineFamily', label: 'Line Family' }, { key: 'pipeSizeRaw', label: 'Pipe Size' }, { key: 'derivedDn', label: 'Derived DN' }, { key: 'isonote', label: 'ISONOTE' }, { key: 'mandatory', label: 'Mandatory' }, { key: 'masterKeywords', label: 'Master Keywords' }, { key: 'mappedPsnoModel', label: 'Mapped PSNO_Model' }, { key: 'coveredDtxrKeywords', label: 'Covered DTXR Keywords' }, { key: 'missingMasterKeywords', label: 'Missing Master Keywords' }, { key: 'extraDtxrKeywords', label: 'Extra DTXR Keywords' }, { key: 'coverageStatus', label: 'Coverage Status' }, { key: 'action', label: 'Action' },
];
const USER_LOG_COLUMNS = [
  { key: 'level', label: 'Level' }, { key: 'stage', label: 'Stage' }, { key: 'psnoModel', label: 'PSNO_Model' }, { key: 'node', label: 'Node' }, { key: 'table1PsNo', label: 'Table-1 PS No' }, { key: 'tag', label: 'Tag' }, { key: 'subject', label: 'Subject' }, { key: 'message', label: 'Message' }, { key: 'action', label: 'Action' },
];

function consolidatedTable1Panel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Consolidated Table-1</b><button class="psmap-btn secondary" data-psmap-action="copyT1">Copy Consolidated T1</button></div><div class="psmap-card-body"><div class="psmap-banner">This is the exact Table-1 reference model passed into the resolver. Line Family is size-free; Pipe size/DN is shown separately.</div>${table(state.result?.consolidatedTable1Rows || [], CONSOLIDATED_T1_COLUMNS)}</div></section>`;
}
function consolidatedTable2Panel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Consolidated Table-2</b><button class="psmap-btn secondary" data-psmap-action="copyT2">Copy Consolidated T2</button></div><div class="psmap-card-body"><div class="psmap-banner">This shows exactly how model Table-2 was parsed before matching, including size-free Line Family and regex basis.</div>${table(state.result?.consolidatedTable2Rows || [], CONSOLIDATED_T2_COLUMNS)}</div></section>`;
}
function validatorPanel(state) { return `<section class="psmap-card"><div class="psmap-card-head"><b>Table 2 Validator</b><button class="psmap-btn secondary" data-psmap-action="copyOutput">Copy CSV</button></div><div class="psmap-card-body">${table(state.result?.rows || [], VALIDATOR_COLUMNS)}</div></section>`; }
function candidatesPanel(state) { return `<section class="psmap-card"><div class="psmap-card-head"><b>Candidate Matrix</b><button class="psmap-btn secondary" data-psmap-action="copyCandidates">Copy Candidates</button></div><div class="psmap-card-body"><div class="psmap-banner">Near line-family mismatch and duplicate equivalent Table-1C candidates are review-only. They are never auto-approved.</div>${table(state.result?.candidates || [], CANDIDATE_COLUMNS)}</div></section>`; }
function coveragePanel(state) { return `<section class="psmap-card"><div class="psmap-card-head"><b>Table 1 Support Coverage</b><button class="psmap-btn secondary" data-psmap-action="copyCoverage">Copy Coverage</button></div><div class="psmap-card-body">${table(state.result?.supportCoverageRows || [], COVERAGE_COLUMNS)}</div></section>`; }
function logPanel(state, debug = false) { return `<section class="psmap-card"><div class="psmap-card-head"><b>${debug ? 'Debug Log' : 'User Log'}</b><button class="psmap-btn secondary" data-psmap-action="${debug ? 'copyDebug' : 'copyUser'}">Copy</button></div><div class="psmap-card-body">${table(debug ? state.result?.debugLog || [] : state.result?.userLog || [], debug ? [{ key: 'time', label: 'Time' }, { key: 'level', label: 'Level' }, { key: 'code', label: 'Code' }, { key: 'subject', label: 'Subject' }, { key: 'details', label: 'Details', value: (r) => JSON.stringify(r.details || {}) }] : USER_LOG_COLUMNS)}</div></section>`; }

function renderModal(state) {
  return `<div class="psmap-backdrop" data-psmap-modal><div class="psmap-modal"><div class="psmap-head"><div><h2 class="psmap-title">PS Mapping Utility</h2><p class="psmap-sub">Consolidated Table-1 + Consolidated Table-2 → Resolver → Validator</p></div><button class="psmap-btn secondary" data-psmap-action="close">Close</button></div><div class="psmap-tabs">${tab('source', 'Source Tables', state)}${tab('setup', 'Resolver Setup', state)}${tab('config', 'Config / Diagnostics', state)}${tab('ct1', 'Consolidated Table-1', state)}${tab('ct2', 'Consolidated Table-2', state)}${tab('validator', 'Table 2 Validator', state)}${tab('coverage', 'Table 1 Support Coverage', state)}${tab('candidates', 'Candidate Matrix', state)}${tab('user', 'User Log', state)}${tab('debug', 'Debug Log', state)}</div><div class="psmap-body">${summary(state)}${panel('source', state, sourcePanel(state))}${panel('setup', state, setupPanel(state))}${panel('config', state, configPanel(state))}${panel('ct1', state, consolidatedTable1Panel(state))}${panel('ct2', state, consolidatedTable2Panel(state))}${panel('validator', state, validatorPanel(state))}${panel('coverage', state, coveragePanel(state))}${panel('candidates', state, candidatesPanel(state))}${panel('user', state, logPanel(state, false))}${panel('debug', state, logPanel(state, true))}</div></div></div>`;
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  installStyle();
  const root = document.createElement('div');
  root.innerHTML = `<button type="button" class="psmap-tile" data-psmap-action="open"><div><div class="psmap-tile-icon">🧭</div><div><b>PS Mapping Utility</b></div><div class="psmap-sub">Support PS → Model PS</div></div></button>`;
  container.appendChild(root);
  let state = makeState();

  function refresh() {
    const modal = document.querySelector('[data-psmap-modal]');
    if (modal) modal.outerHTML = renderModal(state);
  }
  function run() {
    state.result = runPsMappingResolver({
      table1PsNodeText: state.source.table1Text,
      table1aNodeDiaText: state.source.table1AText,
      table1bNodeLineText: state.source.table1BText,
      table1cNodeIsonoteText: state.source.table1CText,
      table1dKeywordText: state.source.table1DText,
      table2ModelText: state.source.table2Text,
      options: state.setup,
    });
    state.activeTab = 'ct2';
    refresh();
    const review = state.result.summary.review || 0;
    ctx.showToast?.(`PS Mapping complete: ${state.result.summary.mapped} mapped, ${review} review, ${state.result.summary.noMatch} no match.`, state.result.summary.noMatch || review ? 'warning' : 'success');
  }
  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => ctx.showToast?.('Copied.', 'success')).catch((error) => ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error'));
  }

  function onClick(event) {
    const action = event.target?.closest?.('[data-psmap-action]')?.dataset?.psmapAction;
    const tabBtn = event.target?.closest?.('[data-psmap-tab]');
    if (tabBtn) { state.activeTab = tabBtn.dataset.psmapTab; refresh(); return; }
    if (!action) return;
    if (action === 'open') { document.body.insertAdjacentHTML('beforeend', renderModal(state)); return; }
    if (action === 'close') { document.querySelector('[data-psmap-modal]')?.remove(); return; }
    if (action === 'loadSample') { state = makeState(); refresh(); return; }
    if (action === 'run') { run(); return; }
    if (action === 'copyOutput') copy(rowsToCsv(state.result?.rows || []));
    if (action === 'copyT1') copy(tableToTsv(state.result?.consolidatedTable1Rows || [], CONSOLIDATED_T1_COLUMNS.map((c) => c.key)));
    if (action === 'copyT2') copy(tableToTsv(state.result?.consolidatedTable2Rows || [], CONSOLIDATED_T2_COLUMNS.map((c) => c.key)));
    if (action === 'copyCandidates') copy(tableToTsv(state.result?.candidates || [], CANDIDATE_COLUMNS.map((c) => c.key)));
    if (action === 'copyCoverage') copy(tableToTsv(state.result?.supportCoverageRows || [], COVERAGE_COLUMNS.map((c) => c.key)));
    if (action === 'copyUser') copy(tableToTsv(state.result?.userLog || [], USER_LOG_COLUMNS.map((c) => c.key)));
    if (action === 'copyDebug') copy(tableToTsv(state.result?.debugLog || [], ['time', 'level', 'code', 'subject', 'details']));
  }
  function onInput(event) {
    const source = event.target?.closest?.('[data-psmap-source]');
    if (source) { state.source[source.dataset.psmapSource] = source.value; return; }
    const setup = event.target?.closest?.('[data-psmap-setup]');
    if (setup) {
      const key = setup.dataset.psmapSetup;
      if (setup.type === 'checkbox') state.setup[key] = setup.checked;
      else if (setup.type === 'number') state.setup[key] = Number(setup.value);
      else state.setup[key] = setup.value;
    }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('input', onInput);
    document.removeEventListener('change', onInput);
    root.remove();
  };
}
