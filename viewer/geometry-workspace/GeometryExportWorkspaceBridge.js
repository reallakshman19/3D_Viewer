import { buildRenderedGeometrySnapshot, buildRenderedGeometrySnapshotSummary } from './RenderedGeometrySnapshotBuilder.js?v=20260622-geometry-workspace-1';
import { discoverRenderedGeometryFields, selectDefaultTableFields, valueAtPath } from './RenderedGeometryFieldDiscovery.js?v=20260622-geometry-workspace-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-geometry-export-workspace-v1');
const BRIDGE_VERSION = '20260622-geometry-workspace-1';
const MAX_TABLE_ROWS = 300;
const MAX_HIERARCHY_DEPTH = 5;

let workspaceState = {
  schemaVersion: 'geometry-export-workspace/v1',
  import: null,
  snapshot: null,
  summary: null,
  fieldDiscovery: null,
  selectedHierarchyPaths: new Set(),
  selectedObjectIds: new Set(),
};

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rootEl() {
  return typeof document === 'undefined' ? null : document.querySelector('[data-rvm-viewer]');
}

function setStatus(text, warning = false) {
  const el = rootEl()?.querySelector?.('#rvm-sb-msg');
  if (!el) return;
  el.textContent = text;
  el.style.color = warning ? '#ffcf70' : '';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function pathKey(parts, depth = MAX_HIERARCHY_DEPTH) {
  return ensureArray(parts).slice(0, depth).join('/');
}

function buildHierarchyRows(snapshot) {
  const rows = new Map();
  for (const record of ensureArray(snapshot?.records)) {
    const parts = ensureArray(record.hierarchyPath).filter(Boolean);
    const usable = parts.length ? parts : [record.displayName || record.id];
    const limit = Math.min(MAX_HIERARCHY_DEPTH, usable.length);
    for (let i = 1; i <= limit; i += 1) {
      const path = pathKey(usable, i);
      if (!rows.has(path)) {
        rows.set(path, { path, name: usable[i - 1], level: i - 1, count: 0, objectIds: new Set() });
      }
      const row = rows.get(path);
      row.count += 1;
      row.objectIds.add(record.id);
    }
  }
  return [...rows.values()].sort((a, b) => a.level - b.level || b.count - a.count || a.path.localeCompare(b.path)).slice(0, 250);
}

function currentDialog() {
  return document.getElementById('geometry-export-workspace-dialog');
}

function activeScope(dialog = currentDialog()) {
  return dialog?.querySelector?.('[data-gew-import-scope]')?.value || 'visible';
}

function importSnapshot(scope = 'visible') {
  const snapshot = buildRenderedGeometrySnapshot({ scope });
  const summary = buildRenderedGeometrySnapshotSummary(snapshot);
  const fieldDiscovery = discoverRenderedGeometryFields(snapshot);
  workspaceState = {
    schemaVersion: 'geometry-export-workspace/v1',
    import: {
      source: `current-${scope}-rendered-objects`,
      importedAt: snapshot.generatedAt,
      objectCount: snapshot.recordCount,
      scanned: snapshot.scanned,
      capped: snapshot.capped
    },
    snapshot,
    summary,
    fieldDiscovery,
    selectedHierarchyPaths: new Set(),
    selectedObjectIds: new Set(),
  };
  renderWorkspace();
  setStatus(`Geometry Workspace: imported ${snapshot.recordCount}${snapshot.capped ? '+' : ''} ${scope} rendered object(s).`, snapshot.capped);
  return workspaceState;
}

function renderSummary() {
  const state = workspaceState;
  const summary = state.summary;
  const fieldDiscovery = state.fieldDiscovery;
  if (!summary) return '<div class="gew-empty">No geometry imported yet. Choose Selected, Visible, or Full rendered model.</div>';
  const topClasses = Object.entries(summary.byClass || {}).slice(0, 8).map(([key, value]) => `<span>${esc(key)} <b>${value}</b></span>`).join('');
  return `
    <div class="gew-summary-grid">
      <div><b>${summary.recordCount}${summary.capped ? '+' : ''}</b><span>objects</span></div>
      <div><b>${summary.scanned}${summary.capped ? '+' : ''}</b><span>scanned</span></div>
      <div><b>${fieldDiscovery?.fieldCount || 0}</b><span>fields</span></div>
      <div><b>${esc(state.import?.source || '')}</b><span>source</span></div>
    </div>
    <div class="gew-class-chips">${topClasses || '<span>No class summary</span>'}</div>`;
}

function renderHierarchy() {
  const snapshot = workspaceState.snapshot;
  if (!snapshot) return '<div class="gew-empty">Import geometry to build hierarchy.</div>';
  const rows = buildHierarchyRows(snapshot);
  if (!rows.length) return '<div class="gew-empty">No hierarchy paths found.</div>';
  return `<div class="gew-hierarchy-list">${rows.map((row) => {
    const checked = workspaceState.selectedHierarchyPaths.has(row.path) ? 'checked' : '';
    return `<label class="gew-hrow" style="--indent:${row.level}"><input type="checkbox" data-gew-hpath="${esc(row.path)}" ${checked}> <span>${esc(row.name || row.path)}</span><b>${row.count}</b></label>`;
  }).join('')}</div>`;
}

function renderFieldDiscovery() {
  const fields = ensureArray(workspaceState.fieldDiscovery?.fieldSet).slice(0, 80);
  if (!fields.length) return '<div class="gew-empty">No field discovery yet.</div>';
  return `<div class="gew-field-list">${fields.map((field) => `
    <div class="gew-field-row">
      <b>${esc(field.path)}</b>
      <span>${esc(field.inferredType)} · seen ${field.seenCount} · confidence ${field.confidence}</span>
      <small>${esc(ensureArray(field.sampleValues).join(' | '))}</small>
    </div>`).join('')}</div>`;
}

function renderRawTable() {
  const snapshot = workspaceState.snapshot;
  const fields = selectDefaultTableFields(workspaceState.fieldDiscovery, 12);
  const records = ensureArray(snapshot?.records).slice(0, MAX_TABLE_ROWS);
  if (!snapshot) return '<div class="gew-empty">Import geometry to view raw table.</div>';
  if (!records.length) return '<div class="gew-empty">Import produced no records.</div>';
  const header = fields.map((field) => `<th title="${esc(field.path)}">${esc(field.key)}</th>`).join('');
  const body = records.map((record) => `<tr data-gew-object-id="${esc(record.id)}">${fields.map((field) => `<td>${esc(valueAtPath(record, field.path))}</td>`).join('')}</tr>`).join('');
  return `
    <div class="gew-table-note">Showing ${Math.min(records.length, MAX_TABLE_ROWS)} of ${snapshot.recordCount}${snapshot.capped ? '+' : ''} imported records. Columns are dynamic from field discovery.</div>
    <div class="gew-table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderMappingPreview() {
  const fields = ensureArray(workspaceState.fieldDiscovery?.fieldSet);
  if (!fields.length) return '<div class="gew-empty">Import geometry to preview mapping candidates.</div>';
  const candidates = [
    ['supportType', ['rawFields.DTXR', 'rawFields.SUPPORT_KIND', 'rawFields.SUPPORT_TYPE', 'rawFields.CMPSUPTYPE', 'rawFields.MDSSUPPTYPE']],
    ['supportTag', ['rawFields.REF', 'rawFields.NAME', 'rawFields.SUPPORT_TAG']],
    ['pipe.odMm', ['rawFields.ATTACHED_PIPE_OD', 'rawFields.DIAMETER', 'rawFields.BORE']],
    ['pipe.wallThicknessMm', ['rawFields.WALL_THICK', 'rawFields.WT']],
    ['material', ['rawFields.MATERIAL', 'rawFields.MATL']],
  ];
  const fieldPaths = new Set(fields.map((field) => field.path));
  return `<div class="gew-map-list">${candidates.map(([target, paths]) => {
    const found = paths.find((path) => fieldPaths.has(path));
    return `<div class="gew-map-row"><b>${esc(target)}</b><span>${found ? `candidate: ${esc(found)}` : 'unmapped'}</span></div>`;
  }).join('')}</div>`;
}

function renderWorkspace() {
  const dialog = currentDialog();
  if (!dialog) return;
  const body = dialog.querySelector('[data-gew-body]');
  if (!body) return;
  body.innerHTML = `
    <section data-gew-tab-panel="import">
      ${renderSummary()}
      <div class="gew-subgrid"><div><h4>Top 5 hierarchy import tree</h4>${renderHierarchy()}</div><div><h4>Dynamic field discovery</h4>${renderFieldDiscovery()}</div></div>
    </section>
    <section data-gew-tab-panel="raw">${renderRawTable()}</section>
    <section data-gew-tab-panel="mapping"><h4>Automatic mapping candidates</h4>${renderMappingPreview()}<p class="gew-note">Mapping is preview-only in PR-1. Calculation modules will consume confirmed mappings in later phases.</p></section>
    <section data-gew-tab-panel="calc"><div class="gew-empty">Calculation Canvas shell. Next phases add mapping profiles, resolvers, and support-load modules.</div></section>`;
  setActiveTab(dialog, dialog.dataset.gewActiveTab || 'import');
}

function setActiveTab(dialog, tab) {
  dialog.dataset.gewActiveTab = tab;
  dialog.querySelectorAll('[data-gew-tab]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.gewTab === tab));
  dialog.querySelectorAll('[data-gew-tab-panel]').forEach((panel) => { panel.hidden = panel.dataset.gewTabPanel !== tab; });
}

function ensureDialog() {
  let dialog = currentDialog();
  if (dialog) return dialog;
  dialog = document.createElement('div');
  dialog.id = 'geometry-export-workspace-dialog';
  dialog.className = 'geometry-export-workspace-dialog';
  dialog.setAttribute('aria-hidden', 'true');
  dialog.dataset.gewActiveTab = 'import';
  dialog.innerHTML = `
    <div class="gew-card" role="dialog" aria-modal="false" aria-label="Geometry Export Workspace">
      <div class="gew-head">
        <div><b>Export Geometry Workspace</b><small>${esc(BRIDGE_VERSION)} · rendered graphics snapshot</small></div>
        <button type="button" data-gew-close="true" aria-label="Close geometry workspace">×</button>
      </div>
      <div class="gew-toolbar">
        <label>Source <select data-gew-import-scope><option value="selected">Canvas selection</option><option value="visible" selected>Visible rendered geometry</option><option value="all">Full rendered model</option></select></label>
        <button type="button" data-gew-import="true">Import</button>
        <button type="button" data-gew-refresh="true">Refresh</button>
        <button type="button" data-gew-export-json="true">Export Snapshot JSON</button>
      </div>
      <nav class="gew-tabs">
        <button type="button" data-gew-tab="import" class="is-active">Import</button>
        <button type="button" data-gew-tab="raw">Raw Geometry</button>
        <button type="button" data-gew-tab="mapping">Mapping Preview</button>
        <button type="button" data-gew-tab="calc">Calculation Canvas</button>
      </nav>
      <div class="gew-body" data-gew-body></div>
    </div>`;
  document.body.appendChild(dialog);
  bindDialog(dialog);
  renderWorkspace();
  return dialog;
}

function openDialog() {
  const dialog = ensureDialog();
  dialog.classList.add('is-open');
  dialog.setAttribute('aria-hidden', 'false');
  renderWorkspace();
}

function closeDialog() {
  const dialog = currentDialog();
  if (!dialog) return;
  dialog.classList.remove('is-open');
  dialog.setAttribute('aria-hidden', 'true');
}

function downloadSnapshot() {
  if (!workspaceState.snapshot) {
    setStatus('Geometry Workspace: import geometry before exporting snapshot.', true);
    return;
  }
  const blob = new Blob([JSON.stringify({ ...workspaceState, selectedHierarchyPaths: [...workspaceState.selectedHierarchyPaths], selectedObjectIds: [...workspaceState.selectedObjectIds] }, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'rendered-geometry-workspace-snapshot.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindDialog(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-gew-close]')) { closeDialog(); return; }
    const tab = event.target?.closest?.('[data-gew-tab]')?.dataset?.gewTab;
    if (tab) { setActiveTab(dialog, tab); return; }
    if (event.target?.closest?.('[data-gew-import]')) { importSnapshot(activeScope(dialog)); return; }
    if (event.target?.closest?.('[data-gew-refresh]')) { if (workspaceState.snapshot) importSnapshot(workspaceState.snapshot.scope); else renderWorkspace(); return; }
    if (event.target?.closest?.('[data-gew-export-json]')) { downloadSnapshot(); }
  }, true);
  dialog.addEventListener('change', (event) => {
    const hpath = event.target?.dataset?.gewHpath;
    if (!hpath) return;
    if (event.target.checked) workspaceState.selectedHierarchyPaths.add(hpath);
    else workspaceState.selectedHierarchyPaths.delete(hpath);
  }, true);
}

function injectToolbar(root) {
  const ribbon = root?.querySelector?.('.geo-top-ribbon');
  if (!ribbon) return;
  let section = ribbon.querySelector('.geometry-export-workspace-tool-group');
  if (section?.dataset?.gewVersion === BRIDGE_VERSION) return;
  if (!section) {
    section = document.createElement('div');
    section.className = 'rvm-ribbon-section rvm-tool-group geometry-export-workspace-tool-group';
    const report = ribbon.querySelector('.rvm-report-export-tool-group');
    ribbon.insertBefore(section, report?.nextSibling || ribbon.querySelector('.rvm-model-health-tool-group') || null);
  }
  section.dataset.gewVersion = BRIDGE_VERSION;
  section.innerHTML = `
    <span class="rvm-ribbon-label">Geometry</span>
    <div class="rvm-ribbon-button-row">
      <button type="button" class="rvm-tool-btn" data-geometry-export-workspace-open="true" title="Open rendered geometry export workspace"><span aria-hidden="true">⇲</span><span>Export</span></button>
      <button type="button" class="rvm-tool-btn" data-geometry-export-workspace-quick-visible="true" title="Import visible rendered geometry into workspace"><span aria-hidden="true">RAW</span><span>Visible</span></button>
    </div>
    <div class="geometry-export-workspace-summary">Raw geometry · dynamic fields · mapping preview</div>`;
}

function injectStyles() {
  if (document.getElementById('geometry-export-workspace-style')) return;
  const style = document.createElement('style');
  style.id = 'geometry-export-workspace-style';
  style.textContent = `
    .geometry-export-workspace-summary{margin-top:3px;color:#94a3b8;font-size:9.5px;white-space:nowrap}.geometry-export-workspace-dialog{position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;padding:64px 18px 18px;background:rgba(2,6,23,.50);z-index:12250}.geometry-export-workspace-dialog.is-open{display:flex}.gew-card{width:min(1180px,calc(100vw - 44px));max-height:calc(100vh - 88px);display:grid;grid-template-rows:auto auto auto minmax(0,1fr);gap:10px;border:1px solid rgba(126,190,255,.28);border-radius:14px;background:#0b1424;box-shadow:0 24px 80px rgba(0,0,0,.52);padding:12px;color:#dbeafe}.gew-head{display:flex;align-items:center;justify-content:space-between}.gew-head b{font-size:15px;color:#bfdbfe}.gew-head small{display:block;color:#7f94b7;font-size:10px}.gew-head button{border:1px solid rgba(148,163,184,.30);background:#111827;color:#e5e7eb;border-radius:8px;width:30px;height:28px}.gew-toolbar,.gew-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gew-toolbar label{display:flex;align-items:center;gap:6px;color:#bcd8ff;font-size:12px}.gew-toolbar select,.gew-toolbar button,.gew-tabs button{border:1px solid rgba(126,190,255,.24);border-radius:8px;background:#132238;color:#dbeafe;padding:7px 10px}.gew-tabs button.is-active{background:#1d4ed8;color:#fff}.gew-body{min-height:0;overflow:auto;border:1px solid rgba(126,190,255,.12);border-radius:10px;background:rgba(255,255,255,.025);padding:10px}.gew-empty{padding:18px;border:1px dashed rgba(148,163,184,.22);border-radius:10px;color:#9fb3cc;text-align:center}.gew-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:8px}.gew-summary-grid div{border:1px solid rgba(126,190,255,.15);border-radius:9px;padding:8px;background:rgba(255,255,255,.035)}.gew-summary-grid b{display:block;color:#dbeafe}.gew-summary-grid span{display:block;color:#8ea8c8;font-size:11px}.gew-class-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.gew-class-chips span{border:1px solid rgba(126,190,255,.18);border-radius:999px;padding:4px 7px;background:#111827;color:#bfd7ff;font-size:11px}.gew-subgrid{display:grid;grid-template-columns:minmax(260px,.9fr) minmax(320px,1.1fr);gap:10px}.gew-subgrid h4,.gew-body h4{margin:0 0 8px;color:#bfdbfe}.gew-hierarchy-list,.gew-field-list,.gew-map-list{display:grid;gap:5px;max-height:390px;overflow:auto}.gew-hrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px 8px 6px calc(8px + var(--indent,0)*14px);border:1px solid rgba(126,190,255,.13);border-radius:8px;background:#111827;color:#dbeafe;font-size:12px}.gew-hrow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gew-hrow b{font-size:11px;color:#93c5fd}.gew-field-row,.gew-map-row{border:1px solid rgba(126,190,255,.13);border-radius:8px;background:#111827;padding:7px;display:grid;gap:3px}.gew-field-row b,.gew-map-row b{font-size:12px;color:#dbeafe}.gew-field-row span,.gew-map-row span,.gew-field-row small{font-size:11px;color:#9fb3cc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gew-table-note,.gew-note{margin:0 0 8px;color:#9fb3cc;font-size:11px}.gew-table-wrap{overflow:auto;max-height:500px}.gew-table-wrap table{border-collapse:collapse;min-width:100%;font-size:11px}.gew-table-wrap th,.gew-table-wrap td{border:1px solid rgba(126,190,255,.13);padding:5px 7px;text-align:left;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}.gew-table-wrap th{position:sticky;top:0;background:#132238;color:#bfdbfe;z-index:1}
  `;
  document.head.appendChild(style);
}

function attach() {
  const root = rootEl();
  if (!root) return false;
  injectToolbar(root);
  return true;
}

function onDocumentClick(event) {
  if (event.target?.closest?.('[data-geometry-export-workspace-open]')) {
    event.preventDefault();
    event.stopPropagation();
    openDialog();
    return;
  }
  if (event.target?.closest?.('[data-geometry-export-workspace-quick-visible]')) {
    event.preventDefault();
    event.stopPropagation();
    openDialog();
    importSnapshot('visible');
  }
}

export function installGeometryExportWorkspaceBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  injectStyles();
  document.addEventListener('click', onDocumentClick, true);
  let attempts = 0;
  const waitAttach = () => {
    attempts += 1;
    const ok = attach();
    if (!ok && attempts < 180) setTimeout(waitAttach, 300);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitAttach, { once: true });
  else waitAttach();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => { attach(); }, 320));
  globalThis.__PCF_GLB_GEOMETRY_EXPORT_WORKSPACE__ = {
    version: BRIDGE_VERSION,
    open: openDialog,
    importSnapshot,
    state: () => workspaceState,
    schemas: {
      workspace: 'geometry-export-workspace/v1',
      snapshot: 'rendered-geometry-snapshot/v1',
      fieldDiscovery: 'geometry-field-discovery/v1'
    }
  };
}
