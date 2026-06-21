import { RuntimeEvents } from '../contracts/runtime-events.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';
import { installRvmProgressiveModelRootPatch } from '../rvm-viewer/RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import { isLikelyRvmFileName } from '../rvm/BrowserRvmParser.js';
import { loadRvmFileInBrowser } from '../rvm/BrowserRvmLoadBridge.js?v=20260620-rvm-flat-tree-1';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js?v=20260618-rvm-rich-ui-support-kind-1';
import {
  applyRvmSupportSymbolSettings,
  getRvmSupportSymbolSettings,
} from '../rvm-viewer/RvmSupportSymbols.js?v=20260618-rvm-rich-ui-support-kind-1';
import '../rvm-viewer/RvmSupportIndexAttributeBridge.js?v=20260620-rvm-direct-tab-1';

installRvmProgressiveModelRootPatch(RvmViewer3D);

const RVM_TAB_JS_VERSION = '20260621-rvm-button-hardening-1';
const SUPPORT_DEFAULT_SCALE = 1.0;
const SUPPORT_MAX_LABELS = 18;
const JSON_TREE_RENDER_LIMIT = 2600;
const RVM_TREE_RENDER_LIMIT = 320;
const STATUS_TRAVERSE_LIMIT = 4000;

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
  SNAP_ISO_NE: 'NE',
  SNAP_ISO_SW: 'SW',
  SNAP_ISO_SE: 'SE',
};

const ACTION_ICONS = {
  NAV_SELECT: '⌖', NAV_ORBIT: '⟳', NAV_PAN: '↔', MARQUEE_SELECT: '□', MEASURE_TOOL: '↕',
  VIEW_FIT_ALL: '⛶', VIEW_FIT_SELECTION: '◉', VIEW_TOGGLE_PROJECTION: '▣', VIEW_MARQUEE_ZOOM: '⌕',
  SECTION_BOX: '▧', SECTION_PLANE_UP: '⊥', SECTION_DISABLE: '⊘',
  NAV_PLAN_X: 'T', NAV_ROTATE_Y: 'F', NAV_ROTATE_Z: 'R', SNAP_ISO_NW: 'NW', SNAP_ISO_NE: 'NE', SNAP_ISO_SW: 'SW', SNAP_ISO_SE: 'SE',
};

const TOOL_GROUPS = [
  { label: 'Navigate', actions: ['NAV_SELECT', 'NAV_ORBIT', 'NAV_PAN', 'MARQUEE_SELECT', 'MEASURE_TOOL'] },
  { label: 'View', actions: ['VIEW_FIT_ALL', 'VIEW_FIT_SELECTION', 'VIEW_TOGGLE_PROJECTION', 'VIEW_MARQUEE_ZOOM'] },
  { label: 'Section', actions: ['SECTION_BOX', 'SECTION_PLANE_UP', 'SECTION_DISABLE'] },
  { label: 'Orient', actions: ['NAV_PLAN_X', 'NAV_ROTATE_Y', 'NAV_ROTATE_Z', 'SNAP_ISO_NW', 'SNAP_ISO_NE', 'SNAP_ISO_SW', 'SNAP_ISO_SE'] },
];

const MODE_ACTIONS = new Set(['NAV_SELECT', 'NAV_ORBIT', 'NAV_PAN', 'MARQUEE_SELECT', 'MEASURE_TOOL', 'VIEW_MARQUEE_ZOOM']);
const ICON_ONLY_ACTIONS = new Set(['NAV_PLAN_X', 'NAV_ROTATE_Y', 'NAV_ROTATE_Z', 'SNAP_ISO_NW', 'SNAP_ISO_NE', 'SNAP_ISO_SW', 'SNAP_ISO_SE']);

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  const text = [attrs.CMPSUPTYPE, attrs.MDSSUPPTYPE, attrs.DTXR, attrs.SKEY, attrs.SPRE, attrs.DESCRIPTION, attrs.DESC, attrs.NAME, attrs.SUPPORT_TYPE, attrs.SUPPORT_MAPPER_KIND, attrs.SUPPORT_KIND]
    .map((value) => String(value ?? '').toUpperCase()).join(' ');
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
      attrs.SUPPORT_KIND = kind; attrs.SUPPORT_MAPPER_KIND = kind; attrs.SUPPORT_TYPE = kind;
      if (!attrs.CMPSUPTYPE || /^(REST|SUPPORT|ATTA)$/i.test(String(attrs.CMPSUPTYPE))) attrs.CMPSUPTYPE = kind;
    }
    for (const key of ['children', 'items', 'branches']) if (Array.isArray(node[key])) node[key].forEach(visit);
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
  return { scaleMultiplier: normalizeUiSupportScale(scaleMultiplier), labelsVisible: Boolean(labelsVisible), maxVisibleLabels: labelsVisible ? SUPPORT_MAX_LABELS : 0, labelGridFactor: 2.1 };
}

async function loadJsonOrUxmlFile(file, viewer, statusEl, scaleMultiplier, labelsVisible) {
  if (isLikelyRvmFileName(file?.name)) throw new Error('Internal routing error: binary RVM reached JSON/UXML loader.');
  const text = await file.text();
  const source = parseJsonSource(text, file.name);
  const loader = new AvevaJsonLoader();
  const payload = await loader.load(source, {}, makeAsyncSession(statusEl));
  if (!payload?.gltf?.scene) throw new Error('RVM/AVEVA JSON loader produced no scene.');
  viewer.ctx.identityMap = payload.identityMap;
  viewer.setModel(payload.gltf.scene, payload.manifest?.runtime?.upAxis || 'Z');
  applyRvmSupportSymbolSettings(viewer, supportOptions(scaleMultiplier, labelsVisible));
  return payload;
}

function renderToolButton(action) {
  const label = ACTION_LABELS[action] || action;
  const iconOnly = ICON_ONLY_ACTIONS.has(action);
  return `<button class="rvm-tool-btn ${action === 'NAV_ORBIT' ? 'is-active' : ''} ${iconOnly ? 'is-icon-only' : ''}" data-action="${escapeHtml(action)}" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span aria-hidden="true">${escapeHtml(ACTION_ICONS[action] || '')}</span>${iconOnly ? '' : `<span>${escapeHtml(label)}</span>`}</button>`;
}

function renderToolGroup(group) {
  return `<div class="rvm-ribbon-section rvm-tool-group" aria-label="${escapeHtml(group.label)} tools"><span class="rvm-ribbon-label">${escapeHtml(group.label)}</span><div class="rvm-ribbon-button-row">${group.actions.map(renderToolButton).join('')}</div></div>`;
}

function renderShell(container) {
  const scale = initialSupportScale();
  container.innerHTML = `
    <div class="rvm-tab-root geo-theme-navisdark" data-rvm-viewer data-rvm-tab-version="${escapeHtml(RVM_TAB_JS_VERSION)}">
      <div class="rvm-capability-banner" id="rvm-capability-banner" data-mode="worker-first">RVM / REV / ATT / JSON / UXML viewer ready — direct RVM worker path</div>
      <div class="geo-top-ribbon">
        ${TOOL_GROUPS.map(renderToolGroup).join('')}
        <div class="rvm-ribbon-section rvm-ribbon-load"><label class="rvm-btn rvm-btn-file" title="Load RVM / REV / ATT / JSON / UXML"><span>Load</span><input id="rvm-file-input" type="file" accept=".json,.uxml,.uxml.json,.rvm,.rev,.att" multiple data-browser-rvm-fallback="true" data-browser-rvm-att-sidecar="true" data-rvm-direct-worker-load="true" style="display:none" /></label></div>
        <div class="rvm-ribbon-section"><span class="rvm-theme-shell">Support <input id="rvm-support-scale" type="range" min="0.25" max="2" step="0.25" value="${escapeHtml(scale)}" style="width:86px; accent-color:#4a9eff;"><span id="rvm-support-scale-value">${Number(scale).toFixed(2)}×</span></span><button id="rvm-support-labels" class="rvm-btn" type="button" aria-pressed="false">Labels Off</button></div>
        <div class="rvm-ribbon-search"><input id="rvm-search-input" placeholder="Search hierarchy / support tag…" /></div><span class="mode-chip" id="rvm-mode-chip">Orbit</span>
      </div>
      <div id="rvm-status-strip" class="rvm-status-strip" aria-live="polite"><span class="rvm-status-chip" data-rvm-status-chip="objects">Objects: 0</span><span class="rvm-status-chip" data-rvm-status-chip="visible">Visible: 0</span><span class="rvm-status-chip" data-rvm-status-chip="supports">Supports: 0</span><span class="rvm-status-chip" data-rvm-status-chip="selected">Selected: 0</span><span class="rvm-status-chip" data-rvm-status-chip="kind">Kinds: -</span></div>
      <div class="rvm-body">
        <aside class="rvm-left-panel"><div class="rvm-panel-header">Hierarchy</div><div class="rvm-panel-filter-row"><input id="rvm-tree-filter" class="rvm-panel-filter" placeholder="Filter tree…"></div><ul id="rvm-tree" class="rvm-tree"><li class="rvm-empty-state">Load RVM / REV / ATT / JSON / UXML to view hierarchy.</li></ul></aside>
        <section class="rvm-viewport"><div id="rvm-canvas" class="rvm-canvas"></div><div class="rvm-placeholder" id="rvm-placeholder">Load RVM / REV / ATT / JSON / UXML to begin.</div></section>
        <aside class="rvm-right-panel"><div class="rvm-panel-header">Properties</div><div id="rvm-attributes-panel" class="rvm-attributes-panel"><div class="rvm-empty-state">No object selected.</div></div><div class="rvm-panel-header">Support Summary</div><div id="rvm-support-summary" class="rvm-tag-list"><div class="rvm-empty-state">No supports loaded.</div></div><div class="rvm-panel-header" data-rvm-browser-diagnostics-header="true">Browser RVM Performance</div><div id="rvm-browser-parse-diagnostics" class="rvm-tag-list rvm-browser-parse-diagnostics" aria-live="polite" data-browser-rvm-diagnostics-panel="true"><div class="rvm-empty-state">No browser RVM load yet.</div></div></aside>
      </div>
      <div class="viewer-statusbar"><span id="rvm-sb-msg">Ready</span><span>Selection <b id="rvm-sel-count">0</b></span></div>
    </div>`;
}

function nodeDisplayName(node) { return node?.name || node?.canonicalObjectId || node?.sourceObjectId || node?.id || 'Node'; }
function nodeKind(node) { return String(node?.kind || node?.attributes?.TYPE || '').toUpperCase() || 'NODE'; }

function buildNodeTree(nodes = [], options = {}) {
  if (options.flat === true) return buildFlatNodeTree(nodes, options);
  const limit = options.limit || JSON_TREE_RENDER_LIMIT;
  const recursive = options.recursive !== false;
  const children = new Map();
  for (const node of nodes) {
    if (!node?.canonicalObjectId) continue;
    const parent = node.parentCanonicalObjectId || '';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
  const roots = children.get('') || nodes.filter((n) => !n.parentCanonicalObjectId).slice(0, limit);
  const renderNode = (node, depth = 0) => {
    const kids = children.get(node.canonicalObjectId) || [];
    const childHtml = recursive && kids.length && depth < 10 ? `<ul>${kids.slice(0, limit).map((k) => renderNode(k, depth + 1)).join('')}</ul>` : '';
    return `<li data-node-id="${escapeHtml(node.canonicalObjectId || '')}" data-depth="${depth}"><button type="button" class="rvm-tree-node"><span class="rvm-kind">${escapeHtml(nodeKind(node))}</span><span>${escapeHtml(nodeDisplayName(node))}</span>${kids.length ? `<span class="rvm-tree-count">${kids.length}</span>` : ''}</button>${childHtml}</li>`;
  };
  const rows = roots.slice(0, limit).map((node) => renderNode(node));
  const suffix = nodes.length > limit ? `<li class="rvm-empty-state">Tree capped at ${limit} rows for responsive RVM loading.</li>` : '';
  return rows.join('') + suffix || '<li class="rvm-empty-state">No hierarchy nodes.</li>';
}

function buildFlatNodeTree(nodes = [], options = {}) {
  const limit = options.limit || RVM_TREE_RENDER_LIMIT;
  const list = Array.isArray(nodes) ? nodes.filter((node) => node?.canonicalObjectId) : [];
  const rowNodes = list.slice(0, limit);
  const childCounts = new Map();
  for (const node of list) {
    const parent = node.parentCanonicalObjectId || '';
    if (!parent) continue;
    childCounts.set(parent, (childCounts.get(parent) || 0) + 1);
  }
  const rows = rowNodes.map((node) => renderFlatTreeRow(node, depthForNode(node, list), childCounts.get(node.canonicalObjectId) || 0));
  const suffix = list.length > limit ? `<li class="rvm-empty-state">Showing first ${limit} of ${list.length} hierarchy nodes. Use search/filter to narrow.</li>` : '';
  return rows.join('') + suffix || '<li class="rvm-empty-state">No hierarchy nodes.</li>';
}

function renderFlatTreeRow(node, depth, childCount) {
  const attrs = node.attributes || {};
  const kind = nodeKind(node);
  const name = nodeDisplayName(node);
  const depthPx = Math.min(Math.max(Number(depth) || 0, 0), 12) * 12;
  const sub = attrs.RVM_OWNER_NAME || attrs.TYPE || attrs.RVM_PRIMITIVE_KIND || node.parentCanonicalObjectId || '';
  return `<li data-node-id="${escapeHtml(node.canonicalObjectId || '')}" data-depth="${escapeHtml(depth)}" data-flat-rvm-tree-row="true"><button type="button" class="rvm-tree-node" style="padding-left:${depthPx}px"><span class="rvm-kind">${escapeHtml(kind)}</span><span>${escapeHtml(name)}</span>${sub ? `<span class="rvm-tree-sub">${escapeHtml(sub)}</span>` : ''}${childCount ? `<span class="rvm-tree-count">${childCount}</span>` : ''}</button></li>`;
}

function depthForNode(node, nodes) {
  const byId = depthForNode._cacheNodes === nodes ? depthForNode._cache : new Map(nodes.map((item) => [item.canonicalObjectId, item]));
  depthForNode._cacheNodes = nodes;
  depthForNode._cache = byId;
  let depth = 0;
  let parent = node?.parentCanonicalObjectId || '';
  const seen = new Set([node?.canonicalObjectId]);
  while (parent && byId.has(parent) && !seen.has(parent) && depth < 16) {
    depth += 1;
    seen.add(parent);
    parent = byId.get(parent)?.parentCanonicalObjectId || '';
  }
  return depth;
}

function bindToolbar(viewer, root, stateBag) {
  root.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    try {
      let handled = false;
      if (typeof viewer.dispatchAction === 'function') handled = viewer.dispatchAction(action) !== false;
      if (MODE_ACTIONS.has(action) && typeof viewer.setToolMode === 'function') handled = viewer.setToolMode(action) !== false || handled;
      if (MODE_ACTIONS.has(action)) syncActiveToolbarAction(root, action);
      if (!handled) setStatusMessage(root, `${ACTION_LABELS[action] || action}: no applicable selection/model`);
      if (!handled) reportRvmActionError(new Error(`${ACTION_LABELS[action] || action} did not complete`), { action, source: 'toolbar' });
    } catch (err) {
      setStatusMessage(root, `${ACTION_LABELS[action] || action} failed: ${err.message || err}`);
      reportRvmActionError(err, { action, source: 'toolbar' });
      console.warn('[RVM tab] toolbar action failed', action, err);
    }
  }));
  const scaleInput = root.querySelector('#rvm-support-scale');
  const labelsBtn = root.querySelector('#rvm-support-labels');
  const syncSupport = () => {
    const scale = normalizeUiSupportScale(scaleInput?.value);
    const labels = labelsBtn?.getAttribute('aria-pressed') === 'true';
    const valueEl = root.querySelector('#rvm-support-scale-value');
    if (valueEl) valueEl.textContent = `${scale.toFixed(2)}×`;
    applyRvmSupportSymbolSettings(viewer, supportOptions(scale, labels));
  };
  scaleInput?.addEventListener('input', syncSupport);
  labelsBtn?.addEventListener('click', () => { const next = labelsBtn.getAttribute('aria-pressed') !== 'true'; labelsBtn.setAttribute('aria-pressed', next ? 'true' : 'false'); labelsBtn.textContent = next ? 'Labels On' : 'Labels Off'; syncSupport(); });
  stateBag.syncSupport = syncSupport;
}

function syncActiveToolbarAction(root, action) {
  root.querySelectorAll('[data-action]').forEach((b) => b.classList.toggle('is-active', b.dataset.action === action));
  const chip = root.querySelector('#rvm-mode-chip');
  if (chip) chip.textContent = ACTION_LABELS[action] || action;
}

function updateStatus(root, viewer, payload = null) {
  const progressive = payload?.browserRvmRender || payload?.manifest?.browserRvmRenderScene || viewer?.modelGroup?.children?.[0]?.userData?.browserRvmRender;
  if (progressive) {
    const objects = Number(progressive.renderableCount ?? progressive.browserRvmRenderableCount ?? 0);
    const primitiveCounts = progressive.primitiveCounts || progressive.effectivePrimitiveCounts || {};
    const supportCount = Number(primitiveCounts.SUPPORT || primitiveCounts.ATTA || primitiveCounts.ANCI || 0);
    setStatusChip(root, 'objects', `Objects: ${objects}`); setStatusChip(root, 'visible', `Visible: ${objects}`); setStatusChip(root, 'supports', `Supports: ${supportCount}`);
    setStatusChip(root, 'selected', `Selected: ${viewer.selection?.getSelectedCanonicalIds?.().length || 0}`);
    const kinds = Object.keys(primitiveCounts).slice(0, 4).join(', '); setStatusChip(root, 'kind', `Kinds: ${kinds || '-'}`); return;
  }
  let total = 0, visible = 0, supports = 0; const kinds = new Set();
  viewer.modelGroup?.traverse((obj) => {
    if (total >= STATUS_TRAVERSE_LIMIT || !(obj?.isMesh || obj?.isLine || obj?.isPoints)) return;
    total += 1; if (obj.visible !== false) visible += 1;
    const attrs = obj.userData?.attributes || obj.userData?.rawAttributes || {};
    if (isSupportNode({ attributes: attrs, type: attrs.TYPE })) supports += 1;
    const kind = attrs.SUPPORT_KIND || attrs.TYPE || obj.userData?.renderPrimitive; if (kind) kinds.add(String(kind));
  });
  setStatusChip(root, 'objects', `Objects: ${total}${total >= STATUS_TRAVERSE_LIMIT ? '+' : ''}`); setStatusChip(root, 'visible', `Visible: ${visible}${total >= STATUS_TRAVERSE_LIMIT ? '+' : ''}`); setStatusChip(root, 'supports', `Supports: ${supports}`); setStatusChip(root, 'selected', `Selected: ${viewer.selection?.getSelectedCanonicalIds?.().length || 0}`); setStatusChip(root, 'kind', `Kinds: ${kinds.size ? Array.from(kinds).slice(0, 4).join(', ') : '-'}`);
}

function setStatusChip(root, key, text) { const el = root.querySelector(`[data-rvm-status-chip="${key}"]`); if (el) el.textContent = text; }
function setStatusMessage(root, text) { const el = root?.querySelector?.('#rvm-sb-msg'); if (el) el.textContent = text; }
function isJsonOrUxmlFileName(fileName = '') { return /\.(json|uxml)$/i.test(String(fileName || '').trim()) || /\.uxml\.json$/i.test(String(fileName || '').trim()); }
function isLikelyAttFileName(fileName = '') { return /\.att$/i.test(String(fileName || '').trim()); }
function sidecarKey(fileName = '') { return String(fileName || '').trim().toLowerCase().replace(/\.[^.]+$/, ''); }
async function readBestAttSidecarText(files, rvmFileName) { const list = Array.from(files || []); const rvmKey = sidecarKey(rvmFileName); const matching = list.find((file) => isLikelyAttFileName(file?.name) && sidecarKey(file.name) === rvmKey); if (!matching || typeof matching.text !== 'function') return ''; try { return String(await matching.text() || ''); } catch (_) { return ''; } }

function makeDiagnosticsSeed(fileName) { return { fileName, loadedJsVersion: RVM_TAB_JS_VERSION, browserRvmDirectTabLoadPath: true, browserRvmLegacyJsonHandlerBypassed: true, browserRvmWorkerFirstPipeline: true, browserRvmWorkerLoaded: undefined, browserRvmWorkerMessageReceived: false, browserRvmProgressiveMountSafe: true, browserRvmLoadState: 'starting', capturedAt: new Date().toISOString() }; }
function renderDiagnostics(root, diagnostics = {}) {
  const panel = root?.querySelector?.('#rvm-browser-parse-diagnostics'); if (!panel) return;
  const timings = diagnostics.browserRvmStageTimingsMs || diagnostics.browserRvmWorkerTimingsMs || {}; const render = diagnostics.browserRvmRender || diagnostics.render || {};
  const rows = [
    ['Loaded JS version/hash', diagnostics.loadedJsVersion || RVM_TAB_JS_VERSION], ['Worker loaded', boolText(diagnostics.browserRvmWorkerLoaded ?? diagnostics.browserRvmWorkerEnabled)], ['Worker message received', boolText(diagnostics.browserRvmWorkerMessageReceived ?? diagnostics.browserRvmWorkerEnabled)], ['Legacy handler bypassed', boolText(diagnostics.browserRvmLegacyJsonHandlerBypassed)], ['Parse time', timingText(timings['worker.parse.renderInstructions'] ?? timings.parse)], ['Render-instruction time', timingText(timings.renderInstructionGeneration ?? diagnostics.browserRvmRenderInstructionMs)], ['First geometry', timingText(diagnostics.browserRvmFirstGeometryMs)], ['Scene creation', timingText(timings['scene.progressiveCreate'] ?? diagnostics.browserRvmSceneCreationMs)], ['Objects rendered', diagnostics.browserRvmRenderableCount ?? render.renderableCount], ['Skipped objects', diagnostics.browserRvmSkippedCount ?? render.skippedCount], ['Tree nodes rendered', diagnostics.browserRvmTreeNodesRendered], ['Max event-loop stall', timingText(diagnostics.browserRvmMaxEventLoopStallMs)], ['Max single batch time', timingText(diagnostics.browserRvmMaxSingleBatchMs ?? render.maxSingleBatchMs)], ['Long tasks >100 ms', diagnostics.browserRvmEventLoopStallCount], ['Binary PRIM', diagnostics.binaryPrimitiveRecordCount], ['Hierarchy groups', diagnostics.hierarchyGroupCount], ['Fit guard', diagnostics.browserRvmProgressiveFitGuard?.progressiveFitGuard || diagnostics.progressiveFitGuard],
  ];
  panel.innerHTML = `<div class="rvm-browser-diag-grid">${rows.map(([label, value]) => diagnosticRow(label, value)).join('')}</div>${diagnostics.error ? `<div class="rvm-browser-diag-warning">${escapeHtml(diagnostics.error)}</div>` : ''}`;
}
function diagnosticRow(label, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value === undefined || value === null || value === '' ? '-' : value)}</b></div>`; }
function boolText(value) { return value === undefined || value === null ? '-' : (value ? 'yes' : 'no'); }
function timingText(value) { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(1)} ms` : '-'; }

async function loadDirectBrowserRvm({ root, viewer, files, rvmFile, stateBag }) {
  const status = root.querySelector('#rvm-sb-msg'); const startedAt = performance.now(); let latestDiagnostics = makeDiagnosticsSeed(rvmFile.name);
  status.textContent = `Loading ${rvmFile.name} with direct RVM worker path…`; renderDiagnostics(root, latestDiagnostics);
  const attText = await readBestAttSidecarText(files, rvmFile.name);
  const payload = await loadRvmFileInBrowser(rvmFile, viewer, {
    statusEl: status, attText, signal: stateBag.abortController.signal, allowMainThreadParserFallback: false, buildHierarchyFallback: false,
    renderOptions: { maxRenderableObjects: 6000, batchSize: 64, timeSliceMs: 8 },
    onProgress: (progress = {}) => { if (stateBag.abortController.signal.aborted) return; const next = { ...latestDiagnostics, browserRvmLoadState: progress.stage || latestDiagnostics.browserRvmLoadState || 'loading', browserRvmWorkerLoaded: true, browserRvmWorkerMessageReceived: true, browserRvmProgressProcessed: progress.processed, browserRvmProgressTotal: progress.total, browserRvmRenderableCount: progress.renderableCount ?? latestDiagnostics.browserRvmRenderableCount, browserRvmSkippedCount: progress.skippedCount ?? latestDiagnostics.browserRvmSkippedCount }; if (!Number.isFinite(next.browserRvmFirstGeometryMs) && Number(progress.renderableCount) > 0) next.browserRvmFirstGeometryMs = performance.now() - startedAt; latestDiagnostics = next; renderDiagnostics(root, latestDiagnostics); },
    onDiagnostics: (diagnostics = {}) => { latestDiagnostics = { ...latestDiagnostics, ...diagnostics, loadedJsVersion: RVM_TAB_JS_VERSION, browserRvmDirectTabLoadPath: true, browserRvmLegacyJsonHandlerBypassed: true, browserRvmWorkerLoaded: diagnostics.browserRvmWorkerEnabled ?? latestDiagnostics.browserRvmWorkerLoaded, browserRvmWorkerMessageReceived: true }; renderDiagnostics(root, latestDiagnostics); },
  });
  if (stateBag.abortController.signal.aborted) return null;
  const nodes = payload.manifest?.nodes || payload.manifest?.items || payload.manifest?.runtime?.nodes || [];
  const tree = root.querySelector('#rvm-tree'); if (tree) { tree.innerHTML = buildNodeTree(nodes, { limit: RVM_TREE_RENDER_LIMIT, flat: true }); latestDiagnostics.browserRvmTreeNodesRendered = Math.min(nodes.length, RVM_TREE_RENDER_LIMIT); }
  root.querySelector('#rvm-placeholder')?.remove(); stateBag.syncSupport?.(); updateStatus(root, viewer, payload);
  const fitGuard = viewer?._progressiveFitDiagnostics || viewer?.modelGroup?.children?.[0]?.userData?.browserRvmProgressiveFitGuard || null;
  latestDiagnostics = { ...latestDiagnostics, ...(payload.browserRvmParser || {}), browserRvmProgressiveFitGuard: fitGuard, loadedJsVersion: RVM_TAB_JS_VERSION, browserRvmDirectTabLoadPath: true, browserRvmLegacyJsonHandlerBypassed: true, browserRvmWorkerLoaded: true, browserRvmWorkerMessageReceived: true, browserRvmTreeNodesRendered: Math.min(nodes.length, RVM_TREE_RENDER_LIMIT) }; renderDiagnostics(root, latestDiagnostics);
  const renderCount = payload.browserRvmRender?.renderableCount ?? payload.manifest?.browserRvmRenderScene?.renderableCount; status.textContent = `Loaded browser RVM ${rvmFile.name}${Number.isFinite(renderCount) ? ` (${renderCount} renderable)` : ''}`; return payload;
}

function markRvmModelLoaded(root, reason = 'model-loaded') {
  if (root?.dataset) root.dataset.rvmModelLoaded = 'true';
  try { globalThis.dispatchEvent?.(new CustomEvent('rvm-model-loaded', { detail: { reason, version: RVM_TAB_JS_VERSION } })); } catch (_) {}
  try { globalThis.__PCF_GLB_RVM_BRIDGE_LOADER__?.ensurePostModel?.(reason); } catch (error) { reportRvmActionError(error, { action: 'post-model-bridge-loader', reason }); }
}

function reportRvmActionError(error, context = {}) {
  if (typeof globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__ === 'function') return globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__(error, context);
  console.warn('[RVM tab] action failed', context, error);
  return null;
}

function cancelActiveLoad(stateBag) { try { stateBag.abortController?.abort?.(); } catch (_) {} stateBag.abortController = null; }

function cleanupRvmTab(root, viewer, stateBag) {
  cancelActiveLoad(stateBag);
  try { root?.dispatchEvent?.(new CustomEvent('rvm-tab-dispose')); } catch (_) {}
  try { root?._rvmEscKeyCleanup?.(); } catch (_) {}
  try { root?._rvmSupportGeometryCleanup?.(); } catch (_) {}
  try { globalThis.__PCF_GLB_RVM_BOTTOM_DIAGNOSTICS_DRAWER__?.destroy?.(root); } catch (_) {}
  try { viewer?.dispose?.(); } catch (error) { reportRvmActionError(error, { action: 'viewer-dispose' }); }
  if (globalThis.__3D_RVM_VIEWER__ === viewer) {
    try { delete globalThis.__3D_RVM_VIEWER__; } catch (_) { globalThis.__3D_RVM_VIEWER__ = null; }
  }
}

export function mountViewer3DRvmTab(container) {
  renderShell(container);
  const root = container.querySelector('[data-rvm-viewer]'); const canvas = root.querySelector('#rvm-canvas'); const status = root.querySelector('#rvm-sb-msg'); const tree = root.querySelector('#rvm-tree');
  const viewer = new RvmViewer3D(canvas, { runtimeEvents: RuntimeEvents, autoFit: true, supportSymbols: supportOptions(initialSupportScale(), false) });
  const stateBag = { abortController: null }; bindToolbar(viewer, root, stateBag);
  root.querySelector('#rvm-file-input')?.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []); if (!files.length) return;
    cancelActiveLoad(stateBag); stateBag.abortController = new AbortController();
    const rvmFile = files.find((file) => isLikelyRvmFileName(file?.name));
    if (rvmFile) {
      event.preventDefault?.(); event.stopPropagation?.();
      try { const payload = await loadDirectBrowserRvm({ root, viewer, files, rvmFile, stateBag }); if (payload) markRvmModelLoaded(root, 'browser-rvm-load-success'); }
      catch (err) { if (stateBag.abortController?.signal?.aborted || err?.name === 'AbortError') { status.textContent = `Cancelled RVM load ${rvmFile.name}`; return; } status.textContent = `RVM load failed: ${err.message || err}`; renderDiagnostics(root, { ...makeDiagnosticsSeed(rvmFile.name), browserRvmLoadFailed: true, browserRvmWorkerLoaded: false, error: err.message || String(err) }); reportRvmActionError(err, { action: 'load-rvm', fileName: rvmFile.name }); console.error('[RVM tab] direct worker RVM load failed', err); }
      return;
    }
    const jsonFile = files.find((file) => isJsonOrUxmlFileName(file?.name));
    if (!jsonFile) { const onlyAtt = files.every((file) => isLikelyAttFileName(file?.name)); status.textContent = onlyAtt ? 'ATT sidecar selected. Select the matching RVM/REV file with it.' : 'Unsupported RVM tab file selection.'; return; }
    status.textContent = `Loading ${jsonFile.name}…`;
    try { const payload = await loadJsonOrUxmlFile(jsonFile, viewer, status, root.querySelector('#rvm-support-scale')?.value, root.querySelector('#rvm-support-labels')?.getAttribute('aria-pressed') === 'true'); const nodes = payload.manifest?.nodes || payload.manifest?.items || payload.manifest?.runtime?.nodes || []; tree.innerHTML = buildNodeTree(nodes, { limit: JSON_TREE_RENDER_LIMIT, recursive: true }); status.textContent = `Loaded ${jsonFile.name}`; root.querySelector('#rvm-placeholder')?.remove(); stateBag.syncSupport?.(); updateStatus(root, viewer, payload); markRvmModelLoaded(root, 'json-uxml-load-success'); }
    catch (err) { status.textContent = `Load failed: ${err.message}`; reportRvmActionError(err, { action: 'load-json-uxml', fileName: jsonFile.name }); console.error('[RVM tab] JSON/UXML load failed', err); }
  });
  tree.addEventListener('click', (event) => { const li = event.target.closest?.('li[data-node-id]'); if (!li) return; const id = li.dataset.nodeId; try { viewer.selection?.set?.([id]); viewer.selection?.selectByCanonicalId?.(id); viewer.fitSelection?.(); updateStatus(root, viewer); } catch (err) { reportRvmActionError(err, { action: 'tree-selection', nodeId: id }); console.warn('[RVM tab] selection failed', err); } });
  const bindFilter = (selector) => root.querySelector(selector)?.addEventListener('input', (event) => { const q = event.target.value.trim().toLowerCase(); tree.querySelectorAll('li[data-node-id]').forEach((li) => { li.style.display = !q || li.textContent.toLowerCase().includes(q) ? '' : 'none'; }); });
  bindFilter('#rvm-search-input'); bindFilter('#rvm-tree-filter');
  window.__3D_RVM_VIEWER__ = viewer;
  requestAnimationFrame(() => updateStatus(root, viewer));
  return () => cleanupRvmTab(root, viewer, stateBag);
}
