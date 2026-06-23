import {
  buildSupportLoadMasterDataSummary,
  DEFAULT_SUPPORT_LOAD_MASTER_DATA,
  getSupportLoadMasterData,
  resetSupportLoadMasterData,
  setSupportLoadMasterData,
  SUPPORT_LOAD_MASTER_DATA_SCHEMA,
  SUPPORT_LOAD_MASTER_DATA_VERSION
} from './GeometrySupportLoadMasterData.js?v=20260622-support-load-master-data-manager-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-geometry-support-load-master-data-bridge-v1');
let lastError = '';

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function workspaceApi() { return globalThis.__PCF_GLB_GEOMETRY_EXPORT_WORKSPACE__ || null; }
function workspaceState() { return workspaceApi()?.state?.() || {}; }
function dialog() { return document.getElementById('geometry-support-load-master-data-dialog'); }
function currentMasterData() { return workspaceState().supportLoadMasterData || getSupportLoadMasterData(); }
function store(masterData) {
  const s = workspaceState();
  if (s && typeof s === 'object') s.supportLoadMasterData = masterData;
  setSupportLoadMasterData(masterData);
  globalThis.dispatchEvent?.(new CustomEvent('pcf-glb-support-load-master-data-changed', { detail: { schema: SUPPORT_LOAD_MASTER_DATA_SCHEMA, version: SUPPORT_LOAD_MASTER_DATA_VERSION } }));
  return masterData;
}
function textarea() { return dialog()?.querySelector?.('[data-gslmd-json]'); }
function summaryHtml(masterData) {
  const s = buildSupportLoadMasterDataSummary(masterData);
  return `<div class="gslmd-summary"><div><b>${esc(s.depSpanRowCount)}</b><span>DEP spans</span></div><div><b>${esc(s.materialDensityRowCount)}</b><span>materials</span></div><div><b>${esc(s.pipeWeightRowCount)}</b><span>pipe weights</span></div><div><b>${esc(s.hydroProfileCount)}</b><span>hydro profiles</span></div><div><b>${esc(s.activeHydroProfileId)}</b><span>hydro active</span></div><div><b>${esc(s.formulaProfileId)}</b><span>profile</span></div></div>`;
}
function spanRows(masterData) {
  const rows = Array.isArray(masterData?.depSpanRows) ? masterData.depSpanRows.slice(0, 40) : [];
  return `<h4>DEP Span Table</h4><div class="gslmd-table-wrap"><table><thead><tr><th>NPS</th><th>OD mm</th><th>DEPSpan mm</th><th>Source</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.nps)}</td><td>${esc(r.pipeOdMm)}</td><td>${esc(r.depSpanMm)}</td><td>${esc(r.source)}</td></tr>`).join('')}</tbody></table></div>`;
}
function materialRows(masterData) {
  const rows = Array.isArray(masterData?.materialDensityRows) ? masterData.materialDensityRows : [];
  return `<h4>Material Density Table</h4><div class="gslmd-table-wrap"><table><thead><tr><th>Key</th><th>Density kg/m3</th><th>Aliases</th><th>Source</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.key)}</td><td>${esc(r.densityKgM3)}</td><td>${esc((r.aliases || []).join(', '))}</td><td>${esc(r.source)}</td></tr>`).join('')}</tbody></table></div>`;
}
function render() {
  const d = dialog();
  if (!d) return;
  const masterData = currentMasterData();
  d.querySelector('[data-gslmd-body]').innerHTML = `<div class="gslmd-toolbar"><button type="button" data-gslmd-apply="true">Apply JSON</button><button type="button" data-gslmd-default="true">Reset Defaults</button><button type="button" data-gslmd-export="true">Export JSON</button><button type="button" data-gslmd-open-inputs="true">Open LOAD Inputs</button><span>${esc(SUPPORT_LOAD_MASTER_DATA_VERSION)} · ${esc(SUPPORT_LOAD_MASTER_DATA_SCHEMA)}</span></div><p class="gslmd-note">Managed support-load master data is the controlled source for DEP spans, material density, pipe-weight rows, hydro density, temperature function metadata, and Access rounding constants. It hydrates pipe input packages only; it does not run formulas or top-up calculated results.</p>${lastError ? `<div class="gslmd-error">${esc(lastError)}</div>` : ''}${summaryHtml(masterData)}<textarea data-gslmd-json spellcheck="false">${esc(JSON.stringify(masterData, null, 2))}</textarea>${spanRows(masterData)}${materialRows(masterData)}`;
}
function applyJson() {
  try {
    const parsed = JSON.parse(textarea()?.value || '{}');
    store(parsed);
    lastError = '';
  } catch (error) {
    lastError = `Invalid master-data JSON: ${error.message}`;
  }
  render();
}
function resetDefault() {
  store(resetSupportLoadMasterData());
  lastError = '';
  render();
}
function download() {
  const blob = new Blob([JSON.stringify(currentMasterData(), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'geometry-support-load-master-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ensure() {
  let d = dialog();
  if (d) return d;
  d = document.createElement('div');
  d.id = 'geometry-support-load-master-data-dialog';
  d.className = 'geometry-support-load-master-data-dialog';
  d.innerHTML = `<div class="gslmd-card" role="dialog"><div class="gslmd-head"><div><b>Support Load Master Data Manager</b><small>${SUPPORT_LOAD_MASTER_DATA_VERSION}</small></div><button type="button" data-gslmd-close="true">x</button></div><div data-gslmd-body></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => {
    if (e.target?.closest?.('[data-gslmd-close]')) { d.classList.remove('is-open'); return; }
    if (e.target?.closest?.('[data-gslmd-apply]')) { applyJson(); return; }
    if (e.target?.closest?.('[data-gslmd-default]')) { resetDefault(); return; }
    if (e.target?.closest?.('[data-gslmd-export]')) { download(); return; }
    if (e.target?.closest?.('[data-gslmd-open-inputs]')) { globalThis.__PCF_GLB_GEOMETRY_SUPPORT_LOAD_INPUTS__?.open?.(); return; }
  }, true);
  return d;
}
function open() { const d = ensure(); d.classList.add('is-open'); render(); }
function styles() {
  if (document.getElementById('geometry-support-load-master-data-style')) return;
  const s = document.createElement('style');
  s.id = 'geometry-support-load-master-data-style';
  s.textContent = '.geometry-support-load-master-data-dialog{position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;padding:74px 20px;background:rgba(2,6,23,.56);z-index:12382}.geometry-support-load-master-data-dialog.is-open{display:flex}.gslmd-card{width:min(1320px,calc(100vw - 44px));max-height:calc(100vh - 92px);overflow:auto;background:#0b1424;border:1px solid rgba(126,190,255,.30);border-radius:14px;padding:12px;color:#dbeafe}.gslmd-head,.gslmd-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.gslmd-toolbar{justify-content:flex-start}.gslmd-head b,.gslmd-card h4{color:#bfdbfe}.gslmd-head small,.gslmd-toolbar span,.gslmd-note{color:#9fb3cc;font-size:11px}.gslmd-head button,.gslmd-toolbar button{border:1px solid rgba(126,190,255,.24);border-radius:8px;background:#132238;color:#dbeafe;padding:7px 10px}.gslmd-error{margin:8px 0;padding:8px;border:1px solid rgba(248,113,113,.4);border-radius:9px;background:rgba(127,29,29,.28);color:#fecaca}.gslmd-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:8px 0}.gslmd-summary div{border:1px solid rgba(126,190,255,.15);border-radius:9px;padding:8px;background:rgba(255,255,255,.035)}.gslmd-summary span{display:block;color:#9fb3cc;font-size:11px}.gslmd-card textarea{width:100%;min-height:300px;background:#07111f;color:#dbeafe;border:1px solid rgba(126,190,255,.22);border-radius:10px;padding:10px;font-family:ui-monospace,monospace;font-size:11px}.gslmd-table-wrap{overflow:auto;max-height:320px}.gslmd-table-wrap table{border-collapse:collapse;min-width:100%;font-size:11px}.gslmd-table-wrap th,.gslmd-table-wrap td{border:1px solid rgba(126,190,255,.13);padding:5px 7px;text-align:left;white-space:nowrap}.gslmd-table-wrap th{position:sticky;top:0;background:#132238;color:#bfdbfe}';
  document.head.appendChild(s);
}
function injectToolbar(root) {
  const section = root?.querySelector?.('.geometry-export-workspace-tool-group');
  if (!section || section.querySelector('[data-geometry-support-load-master-data-open]')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'rvm-tool-btn';
  b.dataset.geometrySupportLoadMasterDataOpen = 'true';
  b.title = 'Manage controlled support-load master data';
  b.innerHTML = '<span aria-hidden="true">LOAD</span><span>Master</span>';
  section.querySelector('.rvm-ribbon-button-row')?.appendChild(b);
}
function attach() { const root = document.querySelector('[data-rvm-viewer]'); if (!root) return false; injectToolbar(root); return true; }
function click(e) { if (!e.target?.closest?.('[data-geometry-support-load-master-data-open]')) return; e.preventDefault(); e.stopPropagation(); open(); }

export function installGeometrySupportLoadMasterDataBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  setSupportLoadMasterData(currentMasterData(), { persist: false });
  styles();
  document.addEventListener('click', click, true);
  let attempts = 0;
  const wait = () => { attempts += 1; if (!attach() && attempts < 180) setTimeout(wait, 300); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait, { once: true });
  else wait();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(wait, 320));
  globalThis.__PCF_GLB_GEOMETRY_SUPPORT_LOAD_MASTER_DATA__ = {
    version: SUPPORT_LOAD_MASTER_DATA_VERSION,
    schema: SUPPORT_LOAD_MASTER_DATA_SCHEMA,
    open,
    get: currentMasterData,
    set: store,
    reset: resetDefault,
    defaults: () => DEFAULT_SUPPORT_LOAD_MASTER_DATA,
    summary: () => buildSupportLoadMasterDataSummary(currentMasterData())
  };
}
