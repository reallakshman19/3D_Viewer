import { RuntimeEvents } from '../contracts/runtime-events.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import { loadRvmSource } from '../rvm/RvmLoadPipeline.js';
import { RvmStaticBundleLoader } from '../rvm/RvmStaticBundleLoader.js';
import { RvmHelperBridge } from '../converters/rvm-helper-bridge.js';
import { convertRevFileToAvevaHierarchy } from '../rvm/RevLocalLoader.js?v=20260508-preview-geometry';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js?v=20260618-rvm-rich-ui-support-kind-1';
import {
  applyRvmSupportSymbolSettings,
  getRvmSupportSymbolSettings,
} from '../rvm-viewer/RvmSupportSymbols.js?v=20260618-rvm-rich-ui-support-kind-1';
import '../rvm-viewer/RvmSupportIndexAttributeBridge.js?v=20260618-rvm-rich-ui-support-kind-1';

const SUPPORT_DEFAULT_SCALE = 1.0;
const SUPPORT_MAX_LABELS = 18;
const TREE_RENDER_LIMIT = 2600;

const ACTION_LABELS = {
  NAV_SELECT: 'Select',
  NAV_ORBIT: 'Orbit',
  NAV_PAN: 'Pan',
  MARQUEE_SELECT: 'Box Sel',
  MEASURE_TOOL: 'Measure',
  VIEW_MARQUEE_ZOOM: 'Zoom',
  VIEW_FIT_ALL: 'Fit All',
  VIEW_FIT_SELECTION: 'Fit Sel',
  VIEW_TOGGLE_PROJECTION: 'Ortho',
  SECTION_BOX: 'Sec Box',
  SECTION_PLANE_UP: 'Sec Up',
  SECTION_DISABLE: 'Sec Off',
  NAV_PLAN_X: 'Top',
  NAV_ROTATE_Y: 'Front',
  NAV_ROTATE_Z: 'Right',
  SNAP_ISO_NW: 'Iso NW',
  SNAP_ISO_NE: 'Iso NE',
  SNAP_ISO_SW: 'Iso SW',
  SNAP_ISO_SE: 'Iso SE',
};

const ACTION_ICONS = {
  NAV_SELECT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>',
  NAV_ORBIT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  NAV_PAN: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>',
  MARQUEE_SELECT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="1" stroke-dasharray="3 2"/><path d="m14 14 7 7"/></svg>',
  MEASURE_TOOL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="8" rx="2"/><path d="M6 8v4"/><path d="M10 8v4"/><path d="M14 8v4"/><path d="M18 8v4"/></svg>',
  VIEW_MARQUEE_ZOOM: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="1" stroke-dasharray="3 2"/><circle cx="17" cy="17" r="3"/><path d="m21 21-2.15-2.15"/></svg>',
  VIEW_FIT_ALL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4"/><path d="M19 9V5h-4"/><path d="M5 15v4h4"/><path d="M19 15v4h-4"/></svg>',
  VIEW_FIT_SELECTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4"/><path d="M19 9V5h-4"/><path d="M5 15v4h4"/><path d="M19 15v4h-4"/><circle cx="12" cy="12" r="3"/></svg>',
  VIEW_TOGGLE_PROJECTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18"/><path d="m3 3 18 18"/><path d="m21 3-18 18"/></svg>',
  SECTION_BOX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M4 10h16"/><path d="M10 4v16"/></svg>',
  SECTION_PLANE_UP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16h18"/><path d="M12 4v10"/><path d="m8.5 8.5 3.5-4 3.5 4"/></svg>',
  SECTION_DISABLE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
  NAV_PLAN_X: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M5 15.5 12 19l7-3.5-7-3.5-7 3.5Z"/><path d="M12 12V4"/><path d="m8.8 7.2 3.2-3.2 3.2 3.2"/><path d="M5 15.5V9l7-3.5L19 9v6.5"/></svg>',
  NAV_ROTATE_Y: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M8 7.5 12 5l4 2.5v5L12 15l-4-2.5v-5Z"/><path d="M12 3v18"/><path d="M5.5 8.2C3.9 9.1 3 10.4 3 12c0 3 4 5.4 9 5.4s9-2.4 9-5.4c0-1.6-.9-2.9-2.5-3.8"/><path d="m17.7 6.1 1.4 2.6-2.9.5"/></svg>',
  NAV_ROTATE_Z: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M7 14.5 12 17l5-2.5L12 12l-5 2.5Z"/><path d="M12 12V4"/><path d="m9.3 6.7 2.7-2.7 2.7 2.7"/><path d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4"/><path d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4"/></svg>',
  SNAP_ISO_NW: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/><path d="M12 3.5v8"/><path d="M5 8.5 12 12l7-4.5"/><path d="M8 6.2 4.5 4.5 6.2 8"/></svg>',
  SNAP_ISO_NE: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/><path d="M12 3.5v8"/><path d="M5 8.5 12 12l7-4.5"/><path d="M16 6.2 19.5 4.5 17.8 8"/></svg>',
  SNAP_ISO_SW: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/><path d="M12 3.5v8"/><path d="M5 8.5 12 12l7-4.5"/><path d="M8 17.8 4.5 19.5 6.2 16"/></svg>',
  SNAP_ISO_SE: '<svg class="rvm-svg-view" viewBox="0 0 24 24" fill="none"><path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/><path d="M12 3.5v8"/><path d="M5 8.5 12 12l7-4.5"/><path d="M16 17.8 19.5 19.5 17.8 16"/></svg>',
};

const TOOL_GROUPS = [
  { label: 'Navigate', actions: ['NAV_SELECT', 'NAV_ORBIT', 'NAV_PAN', 'MARQUEE_SELECT', 'MEASURE_TOOL'] },
  { label: 'View', actions: ['VIEW_FIT_ALL', 'VIEW_FIT_SELECTION', 'VIEW_TOGGLE_PROJECTION', 'VIEW_MARQUEE_ZOOM'] },
  { label: 'Section', actions: ['SECTION_BOX', 'SECTION_PLANE_UP', 'SECTION_DISABLE'] },
  { label: 'Orient', actions: ['NAV_PLAN_X', 'NAV_ROTATE_Y', 'NAV_ROTATE_Z', 'SNAP_ISO_NW', 'SNAP_ISO_NE', 'SNAP_ISO_SW', 'SNAP_ISO_SE'] },
];

const ICON_ONLY_ACTIONS = new Set(['NAV_PLAN_X', 'NAV_ROTATE_Y', 'NAV_ROTATE_Z', 'SNAP_ISO_NW', 'SNAP_ISO_NE', 'SNAP_ISO_SW', 'SNAP_ISO_SE']);
const RAW_RVM_EXTENSIONS = new Set(['.rvm', '.rev']);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fileExtension(fileName = '') {
  const lower = String(fileName || '').toLowerCase().trim();
  const idx = lower.lastIndexOf('.');
  return idx >= 0 ? lower.slice(idx) : '';
}

function normalizeUiSupportScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SUPPORT_DEFAULT_SCALE;
  return Math.max(0.25, Math.min(2.0, n));
}

function initialSupportScale() {
  const saved = Number(getRvmSupportSymbolSettings().scaleMultiplier);
  if (!Number.isFinite(saved) || saved > 2.0) return SUPPORT_DEFAULT_SCALE;
  return normalizeUiSupportScale(saved);
}

function makeAsyncSession(statusEl) {
  let stale = false;
  return {
    update(stage, percent) { if (statusEl) statusEl.textContent = `${stage} ${Number.isFinite(percent) ? `${percent}%` : ''}`.trim(); },
    complete() { if (statusEl) statusEl.textContent = 'Loaded'; },
    cancel() { stale = true; },
    isStale() { return stale; },
    isCancelled() { return stale; },
  };
}

function isSupportNode(node) {
  const attrs = node?.attributes || node || {};
  const type = String(node?.type || node?.kind || attrs.TYPE || attrs.RAW_TYPE || '').toUpperCase();
  return ['SUPPORT', 'ATTA', 'ANCI', 'PIPE_SUPPORT', 'PIPESUPPORT'].includes(type)
    || /\bSUPPORT\b|\bATTA\b|\bANCI\b/i.test([attrs.NAME, attrs.DTXR, attrs.CMPSUPTYPE, attrs.SUPPORT_TYPE].join(' '));
}

function supportKindFromIntent(attrs = {}) {
  const text = [
    attrs.CMPSUPTYPE,
    attrs.MDSSUPPTYPE,
    attrs.DTXR,
    attrs.SKEY,
    attrs.SPRE,
    attrs.DESCRIPTION,
    attrs.DESC,
    attrs.NAME,
    attrs.SUPPORT_TYPE,
    attrs.SUPPORT_MAPPER_KIND,
    attrs.SUPPORT_KIND,
  ].map((value) => String(value ?? '').toUpperCase()).join(' ');

  if (/\bGUIDE\b|\bGDE\b|\bGUI\b|\bPG[-_ ]|\bGT0[1-4]\b|\bGT\d{1,3}\b/.test(text)) return 'GUIDE';
  if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bLIMIT\s*STOP\b|\bSTOPPER\b|\bST0[6-8]\b|\bLS[-_ ]|\bSTOP\b/.test(text)) return 'LINESTOP';
  if (/\bLIMIT\b|\bLIM\b/.test(text)) return 'LIMIT';
  if (/\bANCHOR\b|\bFIXED\b|\bAN[-_ ]|\bANC\b/.test(text)) return 'ANCHOR';
  if (/\bSPRING\b|\bHANGER\b/.test(text)) return 'SPRING';
  if (/\bREST\b|\bRESTING\b|\bSHOE\b|\bBASE\s*PLATE\b|\bBEARING\s*PLATE\b|\bWEAR\s*PAD\b|\bBP[-_ ]|\bWP[-_ ]|\bANCI\b|\bATTA\b/.test(text)) return 'REST';
  return '';
}

function normalizeSupportKindsInHierarchy(nodes) {
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const attrs = node.attributes && typeof node.attributes === 'object' ? node.attributes : (node.attributes = {});
    if (isSupportNode(node)) {
      const oldKind = attrs.SUPPORT_KIND || attrs.SUPPORT_MAPPER_KIND || attrs.SUPPORT_TYPE || attrs.CMPSUPTYPE;
      const kind = supportKindFromIntent(attrs) || supportKindFromIntent({ ...attrs, SUPPORT_KIND: '', SUPPORT_MAPPER_KIND: '' }) || 'REST';
      if (oldKind && String(oldKind).toUpperCase() !== kind) attrs.UXML_RAW_SUPPORT_KIND = String(oldKind);
      attrs.SUPPORT_KIND = kind;
      attrs.SUPPORT_MAPPER_KIND = kind;
      attrs.SUPPORT_TYPE = kind;
      if (!attrs.CMPSUPTYPE || /^(REST|SUPPORT|ATTA)$/i.test(String(attrs.CMPSUPTYPE))) attrs.CMPSUPTYPE = kind;
    }
    for (const key of ['children', 'items', 'branches']) {
      if (Array.isArray(node[key])) node[key].forEach(visit);
    }
  };
  (Array.isArray(nodes) ? nodes : [nodes]).forEach(visit);
  return nodes;
}

function parseJsonSource(text, fileName = '') {
  const doc = JSON.parse(text);
  let source;
  if (isUxmlDocument(doc)) source = convertUxmlDocumentToAvevaHierarchy(doc, { fileName });
  else if (isUxmlDocument(doc?.uxml)) source = convertUxmlDocumentToAvevaHierarchy(doc.uxml, { fileName });
  else if (isUxmlDocument(doc?.document)) source = convertUxmlDocumentToAvevaHierarchy(doc.document, { fileName });
  else if (Array.isArray(doc)) source = doc;
  else if (doc?.hierarchy && Array.isArray(doc.hierarchy)) source = doc.hierarchy;
  else if (doc?.nodes && Array.isArray(doc.nodes)) source = doc.nodes;
  else source = doc;
  return normalizeSupportKindsInHierarchy(source);
}

function supportOptions(scaleMultiplier, labelsVisible) {
  return {
    scaleMultiplier: normalizeUiSupportScale(scaleMultiplier),
    labelsVisible: Boolean(labelsVisible),
    maxVisibleLabels: labelsVisible ? SUPPORT_MAX_LABELS : 0,
    labelGridFactor: 2.1,
  };
}

async function loadAvevaHierarchyIntoViewer(source, viewer, statusEl, scaleMultiplier, labelsVisible) {
  const loader = new AvevaJsonLoader();
  const payload = await loader.load(source, {}, makeAsyncSession(statusEl));
  if (!payload?.gltf?.scene) throw new Error('RVM/AVEVA JSON loader produced no scene.');
  viewer.ctx.identityMap = payload.identityMap;
  viewer.setModel(payload.gltf.scene, payload.manifest?.runtime?.upAxis || 'Z');
  applyRvmSupportSymbolSettings(viewer, supportOptions(scaleMultiplier, labelsVisible));
  return payload;
}

async function loadJsonOrUxmlFile(file, viewer, statusEl, scaleMultiplier, labelsVisible) {
  const text = await file.text();
  const source = parseJsonSource(text, file.name);
  return loadAvevaHierarchyIntoViewer(source, viewer, statusEl, scaleMultiplier, labelsVisible);
}

async function loadRevFile(file, viewer, statusEl, scaleMultiplier, labelsVisible) {
  if (statusEl) statusEl.textContent = `Converting REV ${file.name}`;
  const hierarchy = await convertRevFileToAvevaHierarchy(file);
  return loadAvevaHierarchyIntoViewer(hierarchy, viewer, statusEl, scaleMultiplier, labelsVisible);
}

async function loadRawRvmFile(file, viewer, statusEl, scaleMultiplier, labelsVisible) {
  if (statusEl) statusEl.textContent = `Converting RVM ${file.name}`;
  const payload = await loadRvmSource(
    { kind: 'raw-rvm', file, sidecars: [] },
    {
      capabilities: { deploymentMode: 'assisted', rawRvmImport: true, preconvertedBundleImport: true },
      staticBundleLoader: new RvmStaticBundleLoader(),
      assistedBridge: new RvmHelperBridge(),
    }
  );
  if (!payload?.gltf?.scene) throw new Error('Raw RVM conversion produced no GLB scene.');
  viewer.ctx.identityMap = payload.identityMap;
  viewer.setModel(payload.gltf.scene, payload.manifest?.runtime?.upAxis || 'Y');
  applyRvmSupportSymbolSettings(viewer, supportOptions(scaleMultiplier, labelsVisible));
  return payload;
}

async function loadRvmViewerFile(file, viewer, statusEl, scaleMultiplier, labelsVisible) {
  const ext = fileExtension(file?.name);
  if (ext === '.rvm') return loadRawRvmFile(file, viewer, statusEl, scaleMultiplier, labelsVisible);
  if (ext === '.rev') return loadRevFile(file, viewer, statusEl, scaleMultiplier, labelsVisible);
  if (RAW_RVM_EXTENSIONS.has(ext)) throw new Error(`Unsupported raw RVM extension ${ext}.`);
  return loadJsonOrUxmlFile(file, viewer, statusEl, scaleMultiplier, labelsVisible);
}

function renderToolButton(action) {
  const label = ACTION_LABELS[action] || action;
  const iconOnly = ICON_ONLY_ACTIONS.has(action);
  return `<button class="rvm-tool-btn ${action === 'NAV_ORBIT' ? 'is-active' : ''} ${iconOnly ? 'is-icon-only' : ''}" data-action="${escapeHtml(action)}" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${ACTION_ICONS[action] || ''}${iconOnly ? '' : `<span>${escapeHtml(label)}</span>`}</button>`;
}

function renderToolGroup(group) {
  return `<div class="rvm-ribbon-section rvm-tool-group" aria-label="${escapeHtml(group.label)} tools"><span class="rvm-ribbon-label">${escapeHtml(group.label)}</span><div class="rvm-ribbon-button-row">${group.actions.map(renderToolButton).join('')}</div></div>`;
}

function renderShell(container) {
  const scale = initialSupportScale();
  const isStaticMode = false; // rawRvmImport is enabled through the assisted bridge when a local helper is available.
  container.innerHTML = `
    <div class="rvm-tab-root geo-theme-navisdark" data-rvm-viewer data-static-mode="${String(isStaticMode)}">
      <div class="rvm-capability-banner" id="rvm-capability-banner" data-mode="assisted">RVM / REV / JSON / UXML viewer ready</div>
      <div class="geo-top-ribbon">
        ${TOOL_GROUPS.map(renderToolGroup).join('')}
        <div class="rvm-ribbon-section rvm-ribbon-load">
          <label class="rvm-btn rvm-btn-file" title="Load RVM / REV / JSON / UXML">
            <span>Load RVM</span>
            <input id="rvm-file-input" type="file" accept=".rvm,.rev,.json,.uxml,.uxml.json" style="display:none" />
          </label>
        </div>
        <div class="rvm-ribbon-section">
          <span class="rvm-theme-shell">Support <input id="rvm-support-scale" type="range" min="0.25" max="2" step="0.25" value="${escapeHtml(scale)}" style="width:86px; accent-color:#4a9eff;"><span id="rvm-support-scale-value">${Number(scale).toFixed(2)}×</span></span>
          <button id="rvm-support-labels" class="rvm-btn" type="button" aria-pressed="false">Labels Off</button>
        </div>
        <div class="rvm-ribbon-search"><input id="rvm-search-input" placeholder="Search hierarchy / support tag…" /></div>
        <span class="mode-chip" id="rvm-mode-chip">Orbit</span>
      </div>
      <div id="rvm-status-strip" class="rvm-status-strip" aria-live="polite">
        <span class="rvm-status-chip" data-rvm-status-chip="objects">Objects: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="visible">Visible: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="supports">Supports: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="selected">Selected: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="kind">Kinds: -</span>
      </div>
      <div class="rvm-body">
        <aside class="rvm-left-panel">
          <div class="rvm-panel-header">Hierarchy</div>
          <div class="rvm-panel-filter-row"><input id="rvm-tree-filter" class="rvm-panel-filter" placeholder="Filter tree…"></div>
          <ul id="rvm-tree" class="rvm-tree" data-alias="rvm-hierarchy-tree"><li class="rvm-empty-state">Load RVM/REV/JSON/UXML to view hierarchy.</li></ul>
        </aside>
        <section class="rvm-viewport">
          <div id="rvm-canvas" class="rvm-canvas"></div>
          <div class="rvm-placeholder" id="rvm-placeholder">Load RVM / REV / JSON / UXML to begin.</div>
          <div id="rvm-selection-hud" class="rvm-selection-hud" hidden></div>
          <div id="rvm-context-menu" class="rvm-context-menu" hidden></div>
        </section>
        <aside class="rvm-right-panel">
          <div class="rvm-panel-header">Properties</div>
          <div id="rvm-attributes-panel" class="rvm-attributes-panel" data-alias="rvm-attributes-content"><div class="rvm-empty-state">No object selected.</div></div>
          <div class="rvm-panel-header">Support Summary</div>
          <div id="rvm-support-summary" class="rvm-tag-list"><div class="rvm-empty-state">No supports loaded.</div></div>
        </aside>
      </div>
      <div class="viewer-statusbar"><span id="rvm-sb-msg">Ready</span><span>Selection <b id="rvm-sel-count">0</b></span></div>
    </div>
  `;
}

function nodeDisplayName(node) {
  return node?.name || node?.canonicalObjectId || node?.sourceObjectId || node?.id || 'Node';
}

function nodeKind(node) {
  return String(node?.kind || node?.type || node?.attributes?.TYPE || '').toUpperCase() || 'NODE';
}

function buildNodeTree(nodes = []) {
  const byId = new Map();
  const children = new Map();
  for (const node of nodes) {
    if (!node?.canonicalObjectId) continue;
    byId.set(node.canonicalObjectId, node);
    const parent = node.parentCanonicalObjectId || '';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
  return { byId, children };
}

function renderTree(container, nodes = [], selectedId = '') {
  const tree = container.querySelector('#rvm-tree');
  const { children } = buildNodeTree(nodes);
  let count = 0;
  const out = [];
  const write = (list, depth) => {
    for (const node of list || []) {
      if (count >= TREE_RENDER_LIMIT) return;
      count += 1;
      const id = node.canonicalObjectId;
      const kind = nodeKind(node);
      const tag = node.attributes?.SUPPORT_TAG || node.attributes?.NAME || '';
      out.push(`<li data-node-id="${escapeHtml(id)}" class="${id === selectedId ? 'is-selected' : ''}" title="${escapeHtml(id)}" style="padding-left:${8 + depth * 12}px"><span style="color:#8fbef5">${escapeHtml(kind)}</span> ${escapeHtml(tag || nodeDisplayName(node))}</li>`);
      write(children.get(id), depth + 1);
    }
  };
  write(children.get('') || nodes.filter((n) => !n.parentCanonicalObjectId).slice(0, 80), 0);
  if (nodes.length > count) out.push(`<li class="rvm-empty-state">Showing ${count.toLocaleString()} of ${nodes.length.toLocaleString()} nodes. Use search/filter to narrow.</li>`);
  tree.innerHTML = out.length ? out.join('') : '<li class="rvm-empty-state">No hierarchy records.</li>';
}

function setStatusChip(container, key, label, value) {
  const chip = container.querySelector(`[data-rvm-status-chip="${key}"]`);
  if (chip) chip.textContent = `${label}: ${value}`;
}

function supportKindCountsFromViewer(viewer) {
  const counts = {};
  const root = viewer?.scene?.getObjectByName('__RVM_SUPPORT_SYMBOLS__');
  root?.children?.forEach((child) => {
    const kind = String(child.userData?.supportKind || 'SUPPORT').toUpperCase();
    counts[kind] = (counts[kind] || 0) + 1;
  });
  return counts;
}

function renderSupportSummary(container, viewer) {
  const host = container.querySelector('#rvm-support-summary');
  const counts = supportKindCountsFromViewer(viewer);
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  host.innerHTML = entries.length
    ? entries.map(([kind, count]) => `<div class="rvm-tag-item"><span class="rvm-tag-text">${escapeHtml(kind)}</span><strong>${count}</strong></div>`).join('')
    : '<div class="rvm-empty-state">No support symbols found.</div>';
  return counts;
}

function updateStatus(container, viewer, fileName = '') {
  const nodes = viewer?._lastIndexNodes || [];
  const supports = viewer?.supportSymbolDiagnostics?.created ?? 0;
  const counts = renderSupportSummary(container, viewer);
  setStatusChip(container, 'objects', 'Objects', nodes.length.toLocaleString());
  setStatusChip(container, 'visible', 'Visible', nodes.length.toLocaleString());
  setStatusChip(container, 'supports', 'Supports', supports.toLocaleString());
  setStatusChip(container, 'selected', viewer?.selection?.getSelectedCanonicalIds?.()?.length || 0);
  setStatusChip(container, 'kind', 'Kinds', Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ') || '-');
  const msg = container.querySelector('#rvm-sb-msg');
  if (msg) msg.textContent = fileName ? `Loaded ${fileName}; indexAttrs=${viewer?.supportIndexAttributeBridgeDiagnostics?.injected ?? 0}` : 'Ready';
}

function renderAttributes(container, node) {
  const host = container.querySelector('#rvm-attributes-panel');
  if (!node) {
    host.innerHTML = '<div class="rvm-empty-state">No object selected.</div>';
    return;
  }
  const attrs = node.attributes || {};
  const rows = [
    ['Name', nodeDisplayName(node)],
    ['Kind', nodeKind(node)],
    ['Canonical', node.canonicalObjectId],
    ...Object.entries(attrs),
  ].slice(0, 260);
  host.innerHTML = rows.map(([key, value]) => `<div class="rvm-attr-row"><span class="rvm-attr-key">${escapeHtml(key)}</span><span class="rvm-attr-value" title="${escapeHtml(value)}">${escapeHtml(value)}</span></div>`).join('');
}

function filterTree(container) {
  const q = String(container.querySelector('#rvm-tree-filter')?.value || container.querySelector('#rvm-search-input')?.value || '').toLowerCase().trim();
  container.querySelectorAll('#rvm-tree li[data-node-id]').forEach((li) => {
    li.hidden = Boolean(q) && !li.textContent.toLowerCase().includes(q) && !li.title.toLowerCase().includes(q);
  });
}

function setActiveTool(container, action) {
  container.querySelectorAll('.rvm-tool-btn[data-action]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.action === action));
  const chip = container.querySelector('#rvm-mode-chip');
  if (chip) chip.textContent = ACTION_LABELS[action] || action;
}

function handleAction(action, viewer, container) {
  switch (action) {
    case 'NAV_ORBIT': viewer.setNavMode('orbit'); setActiveTool(container, action); break;
    case 'NAV_PAN': viewer.setNavMode('pan'); setActiveTool(container, action); break;
    case 'NAV_SELECT': viewer.setNavMode('select'); setActiveTool(container, action); break;
    case 'MARQUEE_SELECT': viewer.setNavMode('marquee_select'); setActiveTool(container, action); break;
    case 'MEASURE_TOOL': viewer.setNavMode('measure'); setActiveTool(container, action); break;
    case 'VIEW_MARQUEE_ZOOM': viewer.setNavMode('zoom'); setActiveTool(container, action); break;
    case 'VIEW_FIT_ALL': viewer.fitAll?.(); break;
    case 'VIEW_FIT_SELECTION': viewer.fitSelection?.(); break;
    case 'VIEW_TOGGLE_PROJECTION': viewer.toggleProjection?.(); break;
    case 'SECTION_BOX': viewer.setSectionMode?.('BOX'); setActiveTool(container, action); break;
    case 'SECTION_PLANE_UP': viewer.setSectionMode?.('PLANE_UP'); setActiveTool(container, action); break;
    case 'SECTION_DISABLE': viewer.disableSection?.(); setActiveTool(container, 'NAV_ORBIT'); break;
    case 'NAV_PLAN_X': viewer.snapToPreset?.('TOP'); break;
    case 'NAV_ROTATE_Y': viewer.snapToPreset?.('FRONT'); break;
    case 'NAV_ROTATE_Z': viewer.snapToPreset?.('RIGHT'); break;
    case 'SNAP_ISO_NW': viewer.snapToPreset?.('ISO_NW'); break;
    case 'SNAP_ISO_NE': viewer.snapToPreset?.('ISO_NE'); break;
    case 'SNAP_ISO_SW': viewer.snapToPreset?.('ISO_SW'); break;
    case 'SNAP_ISO_SE': viewer.snapToPreset?.('ISO_SE'); break;
  }
}

function safeCssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export function renderViewer3DRvm(container, ctx = {}) {
  renderShell(container);

  const root = container.querySelector('[data-rvm-viewer]');
  const canvas = container.querySelector('#rvm-canvas');
  const placeholder = container.querySelector('#rvm-placeholder');
  const fileInput = container.querySelector('#rvm-file-input');
  const scaleInput = container.querySelector('#rvm-support-scale');
  const scaleValue = container.querySelector('#rvm-support-scale-value');
  const labelsBtn = container.querySelector('#rvm-support-labels');
  const tree = container.querySelector('#rvm-tree');
  const searchInput = container.querySelector('#rvm-search-input');
  const treeFilter = container.querySelector('#rvm-tree-filter');

  const viewer = new RvmViewer3D(canvas, ctx);
  let labelsVisible = false;
  let nodeById = new Map();
  let _shortcutHandler = null;

  const currentScale = () => normalizeUiSupportScale(scaleInput.value);
  const currentSupportOptions = () => supportOptions(currentScale(), labelsVisible);
  const refreshLabelButton = () => {
    labelsBtn.textContent = labelsVisible ? `Labels Smart (${SUPPORT_MAX_LABELS})` : 'Labels Off';
    labelsBtn.classList.toggle('is-active', labelsVisible);
    labelsBtn.setAttribute('aria-pressed', String(labelsVisible));
    root.classList.toggle('rvm-support-labels-off', !labelsVisible);
  };

  const selectNode = (id) => {
    const node = nodeById.get(id);
    if (!node) return;
    viewer.selectByCanonicalId?.(id);
    renderAttributes(container, node);
    tree.querySelectorAll('li.is-selected').forEach((li) => li.classList.remove('is-selected'));
    tree.querySelector(`li[data-node-id="${safeCssEscape(id)}"]`)?.classList.add('is-selected');
    container.querySelector('#rvm-sel-count').textContent = '1';
    updateStatus(container, viewer);
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      container.querySelector('#rvm-sb-msg').textContent = `Loading ${file.name}`;
      const payload = await loadRvmViewerFile(file, viewer, container.querySelector('#rvm-sb-msg'), currentScale(), labelsVisible);
      const nodes = payload.indexJson?.nodes || [];
      viewer._lastIndexNodes = nodes;
      nodeById = new Map(nodes.map((node) => [node.canonicalObjectId, node]));
      renderTree(container, nodes);
      renderAttributes(container, null);
      placeholder.hidden = true;
      applyRvmSupportSymbolSettings(viewer, currentSupportOptions());
      updateStatus(container, viewer, file.name);
      ctx.emit?.(RuntimeEvents.RVM_SOURCE_LOADED, { fileName: file.name, kind: fileExtension(file.name) });
      ctx.emit?.(RuntimeEvents.RVM_MODEL_LOADED, payload);
    } catch (error) {
      console.error(error);
      container.querySelector('#rvm-sb-msg').textContent = `Load failed: ${error?.message || error}`;
    }
  };

  const onScale = () => {
    const value = currentScale();
    scaleValue.textContent = `${value.toFixed(2)}×`;
    applyRvmSupportSymbolSettings(viewer, currentSupportOptions());
    updateStatus(container, viewer);
  };

  const onLabels = () => {
    labelsVisible = !labelsVisible;
    refreshLabelButton();
    applyRvmSupportSymbolSettings(viewer, currentSupportOptions());
    updateStatus(container, viewer);
  };

  const onSelection = (payload = {}) => {
    const id = payload.canonicalId || payload.canonicalObjectId || payload.canonicalIds?.[0] || '';
    const node = nodeById.get(id);
    renderAttributes(container, node || null);
    tree.querySelectorAll('li.is-selected').forEach((li) => li.classList.remove('is-selected'));
    if (id) tree.querySelector(`li[data-node-id="${safeCssEscape(id)}"]`)?.classList.add('is-selected');
    container.querySelector('#rvm-sel-count').textContent = String(payload.canonicalIds?.length || (id ? 1 : 0));
    updateStatus(container, viewer);
  };

  const unsubSelection = ctx.on?.(RuntimeEvents.RVM_NODE_SELECTED, onSelection);

  refreshLabelButton();
  fileInput.addEventListener('change', onFile);
  scaleInput.addEventListener('input', onScale);
  labelsBtn.addEventListener('click', onLabels);
  searchInput.addEventListener('input', filterTree.bind(null, container));
  treeFilter.addEventListener('input', filterTree.bind(null, container));
  tree.addEventListener('click', (event) => {
    const li = event.target.closest('li[data-node-id]');
    if (li) selectNode(li.dataset.nodeId);
  });
  container.addEventListener('click', (event) => {
    const button = event.target.closest('.rvm-tool-btn[data-action], .rvm-btn-file');
    if (!button || !container.contains(button)) return;
    if (button.classList.contains('rvm-btn-file')) {
      fileInput.click();
      return;
    }
    handleAction(button.dataset.action, viewer, container);
  });

  const _disposeRvmViewer = () => {
    unsubSelection?.();
    fileInput.removeEventListener('change', onFile);
    scaleInput.removeEventListener('input', onScale);
    labelsBtn.removeEventListener('click', onLabels);
    _shortcutHandler = null;
    viewer.dispose?.();
    container.innerHTML = '';
  };

  return _disposeRvmViewer;
}
