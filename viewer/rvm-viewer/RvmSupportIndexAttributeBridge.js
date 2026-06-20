import { RvmViewer3D } from './RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { state } from '../core/state.js';
import { applyRvmSupportSymbolSettings } from './RvmSupportSymbols.js?v=20260618-support-kind-authority-1';
import { isLikelyRvmFileName } from '../rvm/BrowserRvmParser.js';
import { parseRvmArrayBuffer } from '../rvm/BrowserRvmHierarchyParser.js';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-support-index-attribute-bridge-v2');
const RVM_TAB_FILE_FALLBACK_FLAG = Symbol.for('pcf-glb-rvm-browser-tab-file-fallback-v1');
const RVM_TAB_DOM_PATCH_FLAG = Symbol.for('pcf-glb-rvm-browser-tab-dom-patch-v1');
const RVM_ATT_SIDECAR_CACHE = Symbol.for('pcf-glb-rvm-att-sidecar-cache-v1');
const RVM_BROWSER_PARSE_DIAGNOSTICS = Symbol.for('pcf-glb-rvm-browser-parse-diagnostics-v1');

const AUTHORITATIVE_SUPPORT_FIELDS = new Set([
  'SUPPORT_KIND',
  'SUPPORT_MAPPER_KIND',
  'SUPPORT_TYPE',
  'CMPSUPTYPE',
  'MDSSUPPTYPE',
  'STYP',
  'SKEY',
  'SPRE',
  'DTXR',
  'RAW_TYPE',
  'TYPE',
  'SUPPORT_TAG',
  'CMPSUPREFN',
  'LBOP',
  'LBOS',
  'SUPPORTCOORD',
  'SUPPORT_COORD',
  'SUPPORT_POINT',
  'SUPPORT_POS',
  'PIPE_AXIS',
  'ROUTE_AXIS',
  'ATTACHED_PIPE_BORE',
  'ATTACHED_PIPE_OD',
  'SUPPORT_GAP_MM',
  'GAP_MM',
  'GAP',
]);

function normalizeKey(value) {
  return String(value ?? '').trim();
}

function normalizeFieldName(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function indexNodeAttributes() {
  const map = new Map();
  const nodes = Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const attrs = node.attributes && typeof node.attributes === 'object' ? node.attributes : null;
    if (!attrs) continue;
    for (const key of [node.sourceObjectId, node.canonicalObjectId, node.name]) {
      const normalized = normalizeKey(key);
      if (normalized && !map.has(normalized)) map.set(normalized, attrs);
    }
  }
  return map;
}

function objectIdentityKeys(obj) {
  const keys = [];
  const push = (value) => {
    const normalized = normalizeKey(value);
    if (normalized && !keys.includes(normalized)) keys.push(normalized);
  };

  push(obj?.userData?.canonicalObjectId);
  push(obj?.userData?.sourceObjectId);
  push(obj?.userData?.name);
  push(obj?.name);
  return keys;
}

function isAuthoritativeSupportField(key) {
  const normalized = normalizeFieldName(key);
  return AUTHORITATIVE_SUPPORT_FIELDS.has(normalized)
    || normalized.startsWith('SUPPORT_')
    || normalized.startsWith('ATTACHED_PIPE_');
}

function shouldOverwrite(existingValue, nextValue, key) {
  if (nextValue === undefined || nextValue === null || nextValue === '') return false;
  if (existingValue === undefined || existingValue === null || existingValue === '') return true;
  return isAuthoritativeSupportField(key);
}

function mergeAttributes(existing, injected) {
  const out = { ...(existing && typeof existing === 'object' ? existing : {}) };
  for (const [key, value] of Object.entries(injected || {})) {
    if (!shouldOverwrite(out[key], value, key)) continue;
    if (isAuthoritativeSupportField(key) && out[key] !== undefined && out[key] !== value) {
      const originalKey = `INDEX_BRIDGE_PREVIOUS_${normalizeFieldName(key)}`;
      if (out[originalKey] === undefined) out[originalKey] = out[key];
    }
    out[key] = value;
  }
  return out;
}

function annotateBrowserRvmFallbackHierarchy(roots, diagnostics = {}) {
  const rootList = Array.isArray(roots) ? roots : [];
  for (const root of rootList) {
    if (!root || typeof root !== 'object') continue;
    root.attributes = {
      ...(root.attributes && typeof root.attributes === 'object' ? root.attributes : {}),
      BROWSER_RVM_TAB_FALLBACK: 'true',
      BROWSER_RVM_PARSE_FIDELITY: diagnostics.parseFidelity || 'UNKNOWN',
      BROWSER_RVM_PRIMITIVE_CANDIDATES: String(diagnostics.primitiveCandidateCount ?? 0),
      BROWSER_RVM_BINARY_PRIMITIVES: String(diagnostics.binaryPrimitiveRecordCount ?? 0),
      BROWSER_RVM_RECORDS: String(diagnostics.rvmRecordCount ?? 0),
      BROWSER_RVM_HIERARCHY_GROUPS: String(diagnostics.hierarchyGroupCount ?? 0),
      BROWSER_RVM_WARNING: diagnostics.warning || 'Browser RVM fallback generated a partial/placeholder scene.',
    };
  }
  return rootList;
}

function isLikelyAttFileName(fileName = '') {
  return /\.att$/i.test(String(fileName || '').trim());
}

function sidecarKey(fileName = '') {
  return String(fileName || '').trim().toLowerCase().replace(/\.[^.]+$/, '');
}

function attSidecarCache() {
  if (!globalThis[RVM_ATT_SIDECAR_CACHE]) globalThis[RVM_ATT_SIDECAR_CACHE] = new Map();
  return globalThis[RVM_ATT_SIDECAR_CACHE];
}

async function rawFileText(file) {
  const proto = globalThis.File?.prototype;
  const rawText = proto?.__pcfGlbOriginalTextForRvmFallback || proto?.text;
  if (typeof rawText !== 'function') return '';
  return rawText.call(file);
}

function cacheRvmAttSidecars(files) {
  const list = Array.from(files || []);
  const attFiles = list.filter((file) => isLikelyAttFileName(file?.name));
  if (!attFiles.length) return;
  const cache = attSidecarCache();
  for (const attFile of attFiles) {
    const key = sidecarKey(attFile.name);
    if (!key) continue;
    cache.set(key, rawFileText(attFile).catch(() => ''));
  }
}

async function readCachedAttSidecarText(fileName) {
  const cache = attSidecarCache();
  const promise = cache.get(sidecarKey(fileName));
  if (!promise) return '';
  try {
    return String(await promise || '');
  } catch (_) {
    return '';
  }
}

function setLastBrowserRvmDiagnostics(diagnostics = {}, fileName = '') {
  const payload = {
    ...(diagnostics && typeof diagnostics === 'object' ? diagnostics : {}),
    fileName: fileName || diagnostics.fileName || '',
    capturedAt: new Date().toISOString(),
  };
  globalThis[RVM_BROWSER_PARSE_DIAGNOSTICS] = payload;
  globalThis.__PCF_GLB_RVM_BROWSER_PARSE_DIAGNOSTICS__ = payload;
  try {
    globalThis.dispatchEvent?.(new CustomEvent('rvm-browser-parse-diagnostics', { detail: payload }));
  } catch (_) {}
  return payload;
}

function lastBrowserRvmDiagnostics() {
  return globalThis[RVM_BROWSER_PARSE_DIAGNOSTICS] || globalThis.__PCF_GLB_RVM_BROWSER_PARSE_DIAGNOSTICS__ || null;
}

function diagnosticValue(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function renderDiagnosticRows(diagnostics = {}) {
  const rows = [
    ['File', diagnostics.fileName],
    ['Fidelity', diagnostics.parseFidelity],
    ['RVM records', diagnostics.rvmRecordCount],
    ['CNTB containers', diagnostics.rvmContainerCount],
    ['Binary PRIM', diagnostics.binaryPrimitiveRecordCount],
    ['Primitive candidates', diagnostics.primitiveCandidateCount],
    ['Hierarchy groups', diagnostics.hierarchyGroupCount],
    ['Semantic mode', diagnostics.primitiveSemantics],
  ];
  return rows.map(([label, value]) => `<div class="rvm-browser-diag-row"><span>${label}</span><b>${diagnosticValue(value)}</b></div>`).join('');
}

function ensureBrowserRvmDiagnosticsPanel(root = document) {
  if (!root?.querySelector) return null;
  const doc = root.ownerDocument || document;
  let panel = root.querySelector('#rvm-browser-parse-diagnostics') || doc.querySelector('#rvm-browser-parse-diagnostics');
  if (panel) return panel;
  const rightPanel = root.querySelector('.rvm-right-panel') || doc.querySelector('.rvm-right-panel');
  if (!rightPanel) return null;

  const header = doc.createElement('div');
  header.className = 'rvm-panel-header';
  header.textContent = 'Browser RVM Parse';
  header.setAttribute('data-rvm-browser-diagnostics-header', 'true');

  panel = doc.createElement('div');
  panel.id = 'rvm-browser-parse-diagnostics';
  panel.className = 'rvm-tag-list rvm-browser-parse-diagnostics';
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('data-browser-rvm-diagnostics-panel', 'true');
  panel.innerHTML = '<div class="rvm-empty-state">No browser RVM parse yet.</div>';

  rightPanel.append(header, panel);
  return panel;
}

function renderBrowserRvmDiagnostics(diagnostics = lastBrowserRvmDiagnostics(), root = document) {
  if (!diagnostics) return;
  const panel = ensureBrowserRvmDiagnosticsPanel(root);
  if (!panel) return;
  panel.innerHTML = `
    <div class="rvm-browser-diag-grid">
      ${renderDiagnosticRows(diagnostics)}
    </div>
    <div class="rvm-browser-diag-warning">${diagnosticValue(diagnostics.warning, 'Browser fallback parse active.')}</div>
  `;
}

export function installBrowserRvmTabFileFallback() {
  if (globalThis[RVM_TAB_FILE_FALLBACK_FLAG]) return;
  globalThis[RVM_TAB_FILE_FALLBACK_FLAG] = true;

  const FileCtor = globalThis.File;
  const proto = FileCtor?.prototype;
  if (proto && typeof proto.text === 'function' && typeof proto.arrayBuffer === 'function') {
    const originalText = proto.__pcfGlbOriginalTextForRvmFallback || proto.text;
    if (!proto.__pcfGlbOriginalTextForRvmFallback) {
      Object.defineProperty(proto, '__pcfGlbOriginalTextForRvmFallback', {
        value: originalText,
        configurable: true,
      });
    }

    proto.text = async function patchedRvmFileText(...args) {
      if (!isLikelyRvmFileName(this?.name)) return originalText.apply(this, args);
      const arrayBuffer = await this.arrayBuffer();
      const attText = await readCachedAttSidecarText(this.name);
      const parsed = await parseRvmArrayBuffer(arrayBuffer, { fileName: this.name, attText });
      const diagnostics = setLastBrowserRvmDiagnostics(parsed.diagnostics, this.name);
      renderBrowserRvmDiagnostics(diagnostics);
      const hierarchy = annotateBrowserRvmFallbackHierarchy(parsed.hierarchy, diagnostics);
      return JSON.stringify(hierarchy);
    };
  }
}

function patchRvmTabDom(root = document) {
  if (!root?.querySelectorAll) return;
  const inputs = root.querySelectorAll('#rvm-file-input, input[type="file"]');
  inputs.forEach((input) => {
    const accept = String(input.getAttribute('accept') || '');
    const isRvmTabInput = input.id === 'rvm-file-input' || /\.uxml|\.json/i.test(accept);
    if (!isRvmTabInput) return;
    input.setAttribute('accept', '.json,.uxml,.uxml.json,.rvm,.rev,.att');
    input.setAttribute('multiple', 'multiple');
    input.setAttribute('data-browser-rvm-fallback', 'true');
    input.setAttribute('data-browser-rvm-att-sidecar', 'true');
    if (!input.__pcfGlbRvmAttSidecarCacheListener) {
      input.addEventListener('change', () => cacheRvmAttSidecars(input.files), { capture: true });
      input.__pcfGlbRvmAttSidecarCacheListener = true;
    }
  });

  const placeholder = root.querySelector?.('#rvm-placeholder');
  if (placeholder && /JSON\s*\/\s*UXML/i.test(placeholder.textContent || '')) {
    placeholder.textContent = 'Load RVM / REV / ATT / JSON / UXML to begin.';
  }
  const treeEmpty = root.querySelector?.('#rvm-tree .rvm-empty-state');
  if (treeEmpty && /JSON\s*\/\s*UXML/i.test(treeEmpty.textContent || '')) {
    treeEmpty.textContent = 'Load RVM / REV / ATT / JSON / UXML to view hierarchy.';
  }
  ensureBrowserRvmDiagnosticsPanel(root);
  renderBrowserRvmDiagnostics(lastBrowserRvmDiagnostics(), root);
}

export function installBrowserRvmTabDomPatch() {
  if (globalThis[RVM_TAB_DOM_PATCH_FLAG]) return;
  globalThis[RVM_TAB_DOM_PATCH_FLAG] = true;
  if (typeof document === 'undefined') return;

  patchRvmTabDom(document);
  globalThis.addEventListener?.('rvm-browser-parse-diagnostics', (event) => renderBrowserRvmDiagnostics(event.detail));
  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'childList') continue;
      for (const node of record.addedNodes || []) patchRvmTabDom(node.nodeType === 1 ? node : document);
    }
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
}

export function bridgeRvmIndexAttributesToRenderObjects(viewer) {
  const modelGroup = viewer?.modelGroup;
  if (!modelGroup) return { scanned: 0, injected: 0, indexNodes: 0, authoritativeSupportUpdates: 0 };

  const attrByPath = indexNodeAttributes();
  let scanned = 0;
  let injected = 0;
  let authoritativeSupportUpdates = 0;

  modelGroup.traverse((obj) => {
    scanned += 1;
    const matchedKey = objectIdentityKeys(obj).find((key) => attrByPath.has(key));
    if (!matchedKey) return;

    const attrs = attrByPath.get(matchedKey);
    const beforeKind = obj.userData?.attributes?.SUPPORT_KIND || obj.userData?.rawAttributes?.SUPPORT_KIND;
    obj.userData = obj.userData || {};
    obj.userData.attributes = mergeAttributes(obj.userData.attributes, attrs);
    obj.userData.rawAttributes = mergeAttributes(obj.userData.rawAttributes, attrs);
    obj.userData.supportIndexAttributeBridge = true;
    obj.userData.supportIndexMatchedKey = matchedKey;

    const afterKind = obj.userData?.attributes?.SUPPORT_KIND || obj.userData?.rawAttributes?.SUPPORT_KIND;
    if (beforeKind !== afterKind && afterKind) authoritativeSupportUpdates += 1;
    injected += 1;
  });

  return { scanned, injected, indexNodes: attrByPath.size, authoritativeSupportUpdates };
}

export function installRvmSupportIndexAttributeBridge() {
  if (RvmViewer3D.prototype[PATCH_FLAG]) return;

  const originalSetModel = RvmViewer3D.prototype.setModel;
  if (typeof originalSetModel !== 'function') return;

  RvmViewer3D.prototype.setModel = function patchedSetModelWithSupportIndexAttrs(...args) {
    const result = originalSetModel.apply(this, args);
    const diagnostics = bridgeRvmIndexAttributesToRenderObjects(this);
    this.supportIndexAttributeBridgeDiagnostics = diagnostics;

    if (diagnostics.injected > 0) {
      try { applyRvmSupportSymbolSettings(this, { preserveSelection: true }); } catch (_) {}
    }
    return result;
  };

  RvmViewer3D.prototype[PATCH_FLAG] = true;
}

installBrowserRvmTabFileFallback();
installBrowserRvmTabDomPatch();
installRvmSupportIndexAttributeBridge();
