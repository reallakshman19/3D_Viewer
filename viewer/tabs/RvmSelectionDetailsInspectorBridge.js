import * as THREE from 'three';

import { RuntimeEvents } from '../contracts/runtime-events.js';
import { on } from '../core/event-bus.js';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-selection-details-inspector-v2-ui');
const BRIDGE_VERSION = '20260629-rvm-selection-details-syntax-fix-1';
const PREVIOUS_VERSION = '20260628-rvm-selected-entity-ui-v2-1';
const MAX_SELECTED_OBJECTS = 1500;
const MAX_ALIAS_SCAN_OBJECTS = 20000;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function rootEl() { return typeof document === 'undefined' ? null : document.querySelector('[data-rvm-viewer]'); }
function viewer() { return globalThis.__3D_RVM_VIEWER__ || null; }
function attrsFor(obj) { const data = obj?.userData || {}; const props = data.browserRvmProperties || {}; return data.browserRvmAttributes || data.attributes || props.attributes || data.rawAttributes || {}; }
function propsFor(obj) { return obj?.userData?.browserRvmProperties || {}; }
function renderIdFor(obj) { return String(obj?.userData?.name || obj?.name || obj?.uuid || '').trim(); }
function sourcePathFor(obj) { const data = obj?.userData || {}; const props = propsFor(obj); const attrs = attrsFor(obj); return data.sourcePath || props.sourcePath || attrs.RVM_OWNER_PATH || attrs.RVM_OWNER_NAME || data.displayName || obj?.name || '-'; }
function typeFor(obj) { const data = obj?.userData || {}; const attrs = attrsFor(obj); return data.type || data.kind || attrs.TYPE || attrs.RVM_TYPE || '-'; }
function primitiveFor(obj) { const data = obj?.userData || {}; const attrs = attrsFor(obj); return data.effectiveRenderPrimitive || data.renderPrimitive || attrs.RVM_BROWSER_RENDER_PRIMITIVE || attrs.RVM_PRIMITIVE_KIND || '-'; }
function fmt(value, digits = 3) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(digits) : '-'; }
function fmtVec(vec) { return vec ? `${fmt(vec.x)} , ${fmt(vec.y)} , ${fmt(vec.z)}` : '-'; }

function normalizePath(value) { return String(value || '').split('\\').join('/'); }
function commonPrefix(values = []) {
  const clean = values.map((value) => normalizePath(value).split('/').filter(Boolean)).filter((parts) => parts.length);
  if (!clean.length) return '';
  const out = [];
  for (let i = 0; i < clean[0].length; i += 1) {
    const part = clean[0][i];
    if (clean.every((parts) => parts[i] === part)) out.push(part);
    else break;
  }
  return out.length ? `/${out.join('/')}` : '';
}

function aliasesFor(obj) {
  const data = obj?.userData || {};
  const props = propsFor(obj);
  const attrs = attrsFor(obj);
  return [renderIdFor(obj), obj?.uuid, obj?.name, data.canonicalObjectId, data.sourceObjectId, data.sourcePath, data.sourceName, data.displayName, props.sourcePath, props.displayName, props.sourceName, attrs.RVM_OWNER_PATH, attrs.RVM_OWNER_NAME, attrs.RVM_REVIEW_NAME, attrs.NAME]
    .map((value) => String(value ?? '').trim()).filter(Boolean);
}

function selectedIdsFromPayload(payload = {}) {
  const selected = new Set();
  for (const value of [payload.canonicalId, payload.renderObjectId, ...(payload.canonicalIds || []), ...(payload.renderObjectIds || [])]) if (value) selected.add(String(value));
  const v = viewer();
  for (const value of v?.selection?.getSelectedCanonicalIds?.() || []) if (value) selected.add(String(value));
  for (const value of v?.selection?.getSelectionRenderIds?.() || []) if (value) selected.add(String(value));
  return selected;
}

function collectSelectedObjects(payload = {}) {
  const v = viewer();
  if (!v?.modelGroup) return [];
  const direct = Array.isArray(v._rvmCanvasSelectedMeshes) ? v._rvmCanvasSelectedMeshes.filter((obj) => obj && (obj.isMesh || obj.isLine || obj.isPoints)) : [];
  if (direct.length) return direct.slice(0, MAX_SELECTED_OBJECTS);
  const ids = selectedIdsFromPayload(payload);
  if (!ids.size) return [];
  const matches = [];
  let scanned = 0;
  v.modelGroup.traverse?.((obj) => {
    if (matches.length >= MAX_SELECTED_OBJECTS || scanned > MAX_ALIAS_SCAN_OBJECTS) return;
    if (!(obj?.isMesh || obj?.isLine || obj?.isPoints)) return;
    scanned += 1;
    if (aliasesFor(obj).some((alias) => ids.has(alias))) matches.push(obj);
  });
  return matches;
}

function boxForObjects(objects = []) {
  const box = new THREE.Box3();
  let any = false;
  for (const obj of objects) {
    try { const itemBox = new THREE.Box3().setFromObject(obj); if (itemBox && !itemBox.isEmpty()) { box.union(itemBox); any = true; } } catch (_) {}
  }
  return any ? box : null;
}

function row(key, value) { return `<div class="rvm-selection-detail-row"><span>${esc(key)}</span><b title="${esc(value)}">${esc(value === undefined || value === null || value === '' ? '-' : String(value))}</b></div>`; }
function kpi(label, value) { return `<span class="rvm-selection-kpi"><b>${esc(value)}</b><small>${esc(label)}</small></span>`; }

function renderPanel(objects = [], reason = '') {
  const root = rootEl();
  const panel = root?.querySelector?.('#rvm-attributes-panel');
  if (!root || !panel) return;
  const visible = objects.filter((obj) => obj?.visible !== false).length;
  const hidden = objects.length - visible;
  const box = boxForObjects(objects);
  const size = box ? box.getSize(new THREE.Vector3()) : null;
  const center = box ? box.getCenter(new THREE.Vector3()) : null;
  const first = objects[0] || null;
  const attrs = attrsFor(first);
  const paths = objects.map(sourcePathFor).filter((path) => path && path !== '-');
  const summary = objects.length ? [
    ['Selection objects', objects.length],
    ['Visible / hidden', `${visible} / ${hidden}`],
    ['First object', first?.userData?.displayName || first?.name || '-'],
    ['Source path', commonPrefix(paths) || sourcePathFor(first)],
    ['Type', typeFor(first)],
    ['Primitive', primitiveFor(first)],
    ['RVM primitive code', attrs.RVM_PRIMITIVE_CODE || attrs.RVM_CODE || first?.userData?.primitiveCode || '-'],
    ['Size XYZ', size ? `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}` : '-'],
    ['Center XYZ', fmtVec(center)],
  ] : [['Selection', reason || 'no selection']];
  const attrRows = Object.entries(attrs || {}).slice(0, 42);
  panel.dataset.rvmSelectionDetailsUi = BRIDGE_VERSION;
  panel.innerHTML = `<div class="rvm-selection-details-card" data-rvm-selection-details-inspector="true" data-rvm-selection-details-ui="${esc(BRIDGE_VERSION)}"><div class="rvm-selection-details-title"><span>Selected Entity</span><small>${esc(BRIDGE_VERSION)}</small></div><div class="rvm-selection-kpi-strip">${[['Objects', objects.length], ['Visible', visible], ['Hidden', hidden]].map(([label, value]) => kpi(label, value)).join('')}</div><div class="rvm-selection-detail-grid">${summary.map(([key, value]) => row(key, value)).join('')}</div><div class="rvm-selection-details-title rvm-selection-subtitle"><span>Attributes</span><small>${esc(attrRows.length)} row(s)</small></div><div class="rvm-selection-detail-grid">${(attrRows.length ? attrRows : [['Attributes', 'No attributes attached to selected object']]).map(([key, value]) => row(key, value)).join('')}</div></div>`;
  const chip = root.querySelector('[data-rvm-status-chip="selected"]');
  const footer = root.querySelector('#rvm-sel-count');
  if (chip) chip.textContent = `Selected: ${objects.length}`;
  if (footer) footer.textContent = String(objects.length || 0);
}

function refresh(payload = {}, reason = 'selection-event') { renderPanel(collectSelectedObjects(payload), reason); }
function installStyles() { if (typeof document === 'undefined' || document.getElementById('rvm-selection-details-inspector-style')) return; const style = document.createElement('style'); style.id = 'rvm-selection-details-inspector-style'; style.textContent = `.rvm-selection-details-card{display:grid;gap:8px;min-width:0}.rvm-selection-details-title{display:flex;justify-content:space-between;color:#93c5fd;font-weight:800;font-size:12px}.rvm-selection-kpi-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.rvm-selection-kpi{padding:6px 4px;border:1px solid rgba(126,190,255,.13);border-radius:8px;text-align:center}.rvm-selection-detail-grid{display:grid;gap:3px}.rvm-selection-detail-row{display:grid;grid-template-columns:minmax(90px,.64fr) minmax(0,1.36fr);gap:6px;padding:4px 6px;border:1px solid rgba(126,190,255,.12);border-radius:6px;font-size:10px}.rvm-selection-detail-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`; document.head.appendChild(style); }

export function installRvmSelectionDetailsInspectorBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  installStyles();
  on(RuntimeEvents.RVM_NODE_SELECTED, (payload) => setTimeout(() => refresh(payload, 'rvm-node-selected'), 0));
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => refresh({}, 'model-loaded'), 180));
  globalThis.__PCF_GLB_RVM_SELECTION_DETAILS_INSPECTOR__ = { version: BRIDGE_VERSION, previousVersion: PREVIOUS_VERSION, refresh, collectSelectedObjects };
}
