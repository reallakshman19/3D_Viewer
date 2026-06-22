import { evaluateGeometryCalculationModules, GEOMETRY_CALCULATION_CANVAS_SCHEMA, GEOMETRY_CALCULATION_CANVAS_VERSION } from './GeometryCalculationModuleRegistry.js?v=20260622-geometry-calc-canvas-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-geometry-calculation-canvas-bridge-v1');
const BRIDGE_VERSION = '20260622-geometry-calc-canvas-1';
const MAX_ROWS = 180;

let lastEvaluation = null;

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function workspaceApi() {
  return globalThis.__PCF_GLB_GEOMETRY_EXPORT_WORKSPACE__ || null;
}

function workspaceState() {
  return workspaceApi()?.state?.() || {};
}

function activeMappedObjects() {
  const state = workspaceState();
  const active = state.activeObjectIds instanceof Set ? state.activeObjectIds : new Set(state.activeObjectIds || []);
  const objects = Array.isArray(state.mapping?.mappedObjects) ? state.mapping.mappedObjects : [];
  return active.size ? objects.filter((object) => active.has(object.sourceId || object.id)) : objects;
}

function currentDialog() {
  return document.getElementById('geometry-calculation-canvas-dialog');
}

function evaluateActiveGeometry() {
  const mappedObjects = activeMappedObjects();
  lastEvaluation = evaluateGeometryCalculationModules(mappedObjects);
  const state = workspaceState();
  if (state && typeof state === 'object') state.calculationCanvas = lastEvaluation;
  renderCalculationDialog();
  return lastEvaluation;
}

function renderSummary(evaluation) {
  const summary = evaluation?.summary || {};
  return `<div class="gcc-summary">
    <div><b>${esc(summary.supportCandidates ?? 0)}</b><span>support candidates</span></div>
    <div><b>${esc(summary.supportReady ?? 0)}</b><span>ready supports</span></div>
    <div><b>${esc(summary.supportBlocked ?? 0)}</b><span>blocked supports</span></div>
    <div><b>${esc(summary.readyModules ?? 0)}</b><span>ready modules</span></div>
    <div><b>${esc(summary.blockedModules ?? 0)}</b><span>blocked modules</span></div>
  </div>`;
}

function renderModuleCards(evaluation) {
  const results = Array.isArray(evaluation?.results) ? evaluation.results : [];
  if (!results.length) return '<div class="gcc-empty">Run validation after importing and mapping geometry.</div>';
  return `<div class="gcc-modules">${results.map((result) => `<div class="gcc-module ${esc(String(result.status || '').toLowerCase())}">
    <h4>${esc(result.displayName || result.moduleId)}</h4>
    <p>${esc(result.moduleId)} · ${esc(result.status)}</p>
    <div class="gcc-mini"><span>Ready <b>${esc(result.readyCount)}</b></span><span>Blocked <b>${esc(result.blockedCount)}</b></span><span>Rejected <b>${esc(result.rejectedCount)}</b></span></div>
    <details><summary>Required fields</summary><code>${esc((result.requiredFields || []).join(', '))}</code></details>
    <details><summary>Assumptions</summary><ul>${(result.assumptions || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></details>
  </div>`).join('')}</div>`;
}

function renderRows(evaluation) {
  const result = Array.isArray(evaluation?.results) ? evaluation.results[0] : null;
  const rows = Array.isArray(result?.rows) ? result.rows.slice(0, MAX_ROWS) : [];
  if (!rows.length) return '<div class="gcc-empty">No support candidates in the active mapped object list.</div>';
  return `<div class="gcc-table-wrap"><table><thead><tr><th>Object</th><th>Support Type</th><th>Status</th><th>Confidence</th><th>Missing Required Fields</th><th>Optional Present</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.status === 'READY' ? 'is-ready' : 'is-blocked'}">
    <td title="${esc(row.objectId)}">${esc(row.displayName)}</td>
    <td>${esc(row.supportType || '')}</td>
    <td>${esc(row.status)}</td>
    <td>${esc(row.mappingConfidence)}</td>
    <td>${esc((row.missingFields || []).join(', '))}</td>
    <td>${esc((row.optionalPresent || []).join(', '))}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderCalculationDialog() {
  const dialog = currentDialog();
  if (!dialog) return;
  const activeCount = activeMappedObjects().length;
  const evaluation = lastEvaluation;
  dialog.querySelector('[data-gcc-body]').innerHTML = `
    <div class="gcc-toolbar"><button type="button" data-gcc-run="true">Run Validation</button><button type="button" data-gcc-open-workspace="true">Open Workspace</button><button type="button" data-gcc-export="true">Export Validation JSON</button><span>${activeCount} active mapped object(s)</span></div>
    <p class="gcc-note">Calculation Canvas validates module readiness only. It does not fabricate process, schedule, material, weight, or load values.</p>
    ${renderSummary(evaluation)}
    ${renderModuleCards(evaluation)}
    <h4>Support Load Readiness Rows</h4>
    ${renderRows(evaluation)}`;
}

function ensureDialog() {
  let dialog = currentDialog();
  if (dialog) return dialog;
  dialog = document.createElement('div');
  dialog.id = 'geometry-calculation-canvas-dialog';
  dialog.className = 'geometry-calculation-canvas-dialog';
  dialog.innerHTML = `<div class="gcc-card" role="dialog" aria-label="Geometry Calculation Canvas"><div class="gcc-head"><div><b>Geometry Calculation Canvas</b><small>${BRIDGE_VERSION} · module registry · readiness validation</small></div><button type="button" data-gcc-close="true">x</button></div><div data-gcc-body></div></div>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-gcc-close]')) { dialog.classList.remove('is-open'); return; }
    if (event.target?.closest?.('[data-gcc-run]')) { evaluateActiveGeometry(); return; }
    if (event.target?.closest?.('[data-gcc-open-workspace]')) { workspaceApi()?.open?.(); return; }
    if (event.target?.closest?.('[data-gcc-export]')) { downloadEvaluation(); }
  }, true);
  return dialog;
}

function openCalculationDialog() {
  const dialog = ensureDialog();
  dialog.classList.add('is-open');
  if (!lastEvaluation) evaluateActiveGeometry();
  else renderCalculationDialog();
}

function downloadEvaluation() {
  if (!lastEvaluation) evaluateActiveGeometry();
  if (!lastEvaluation) return;
  const blob = new Blob([JSON.stringify(lastEvaluation, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'geometry-calculation-readiness.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function injectToolbar(root) {
  const section = root?.querySelector?.('.geometry-export-workspace-tool-group');
  if (!section || section.querySelector('[data-geometry-calculation-canvas-open]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rvm-tool-btn';
  button.dataset.geometryCalculationCanvasOpen = 'true';
  button.title = 'Open independent geometry calculation canvas module registry';
  button.innerHTML = '<span aria-hidden="true">CALC</span><span>Modules</span>';
  section.querySelector('.rvm-ribbon-button-row')?.appendChild(button);
  const summary = section.querySelector('.geometry-export-workspace-summary');
  if (summary) summary.textContent = 'Raw geometry · mapping profiles · calc readiness';
}

function injectStyles() {
  if (document.getElementById('geometry-calculation-canvas-style')) return;
  const style = document.createElement('style');
  style.id = 'geometry-calculation-canvas-style';
  style.textContent = `.geometry-calculation-canvas-dialog{position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;padding:74px 20px;background:rgba(2,6,23,.50);z-index:12340}.geometry-calculation-canvas-dialog.is-open{display:flex}.gcc-card{width:min(1160px,calc(100vw - 44px));max-height:calc(100vh - 92px);overflow:auto;background:#0b1424;border:1px solid rgba(126,190,255,.30);border-radius:14px;padding:12px;color:#dbeafe;box-shadow:0 24px 80px rgba(0,0,0,.55)}.gcc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.gcc-head b{color:#bfdbfe}.gcc-head small{display:block;color:#8ea8c8;font-size:10px}.gcc-head button,.gcc-toolbar button{border:1px solid rgba(126,190,255,.24);border-radius:8px;background:#132238;color:#dbeafe;padding:7px 10px}.gcc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.gcc-toolbar span,.gcc-note{color:#9fb3cc;font-size:11px}.gcc-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:8px 0}.gcc-summary div,.gcc-module{border:1px solid rgba(126,190,255,.15);border-radius:9px;padding:8px;background:rgba(255,255,255,.035)}.gcc-summary b{display:block}.gcc-summary span{display:block;color:#8ea8c8;font-size:11px}.gcc-modules{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px}.gcc-module h4{margin:0;color:#bfdbfe}.gcc-module p,.gcc-module li,.gcc-module code{color:#9fb3cc;font-size:11px}.gcc-mini{display:flex;gap:8px;flex-wrap:wrap;color:#bcd8ff;font-size:11px}.gcc-table-wrap{overflow:auto;max-height:520px}.gcc-table-wrap table{border-collapse:collapse;min-width:100%;font-size:11px}.gcc-table-wrap th,.gcc-table-wrap td{border:1px solid rgba(126,190,255,.13);padding:5px 7px;text-align:left;white-space:nowrap}.gcc-table-wrap th{position:sticky;top:0;background:#132238;color:#bfdbfe;z-index:1}.gcc-table-wrap tr.is-ready td{background:rgba(34,197,94,.06)}.gcc-table-wrap tr.is-blocked td{background:rgba(239,68,68,.06)}.gcc-empty{padding:16px;border:1px dashed rgba(148,163,184,.22);border-radius:10px;color:#9fb3cc;text-align:center}`;
  document.head.appendChild(style);
}

function attach() {
  const root = document.querySelector('[data-rvm-viewer]');
  if (!root) return false;
  injectToolbar(root);
  return true;
}

function onDocumentClick(event) {
  if (!event.target?.closest?.('[data-geometry-calculation-canvas-open]')) return;
  event.preventDefault();
  event.stopPropagation();
  openCalculationDialog();
}

export function installGeometryCalculationCanvasBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  injectStyles();
  document.addEventListener('click', onDocumentClick, true);
  let attempts = 0;
  const waitAttach = () => { attempts += 1; if (!attach() && attempts < 180) setTimeout(waitAttach, 300); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitAttach, { once: true });
  else waitAttach();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(waitAttach, 320));
  globalThis.__PCF_GLB_GEOMETRY_CALCULATION_CANVAS__ = {
    version: BRIDGE_VERSION,
    schema: GEOMETRY_CALCULATION_CANVAS_SCHEMA,
    open: openCalculationDialog,
    evaluate: evaluateActiveGeometry,
    lastEvaluation: () => lastEvaluation
  };
}
