import { RvmViewer3D } from './RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { state } from '../core/state.js';
import { applyRvmSupportSymbolSettings } from './RvmSupportSymbols.js?v=20260618-support-index-attrs-1';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-support-index-attribute-bridge-v1');

function normalizeKey(value) {
  return String(value ?? '').trim();
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

function mergeAttributes(existing, injected) {
  const out = { ...(existing && typeof existing === 'object' ? existing : {}) };
  for (const [key, value] of Object.entries(injected || {})) {
    if (value === undefined || value === null) continue;
    if (out[key] === undefined || out[key] === null || out[key] === '') out[key] = value;
  }
  return out;
}

export function bridgeRvmIndexAttributesToRenderObjects(viewer) {
  const modelGroup = viewer?.modelGroup;
  if (!modelGroup) return { scanned: 0, injected: 0, indexNodes: 0 };

  const attrByPath = indexNodeAttributes();
  let scanned = 0;
  let injected = 0;

  modelGroup.traverse((obj) => {
    scanned += 1;
    const matchedKey = objectIdentityKeys(obj).find((key) => attrByPath.has(key));
    if (!matchedKey) return;

    const attrs = attrByPath.get(matchedKey);
    obj.userData = obj.userData || {};
    obj.userData.attributes = mergeAttributes(obj.userData.attributes, attrs);
    obj.userData.rawAttributes = mergeAttributes(obj.userData.rawAttributes, attrs);
    obj.userData.supportIndexAttributeBridge = true;
    injected += 1;
  });

  return { scanned, injected, indexNodes: attrByPath.size };
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
      this.supportSymbolDiagnostics = applyRvmSupportSymbolSettings(this, this.supportSymbolOptions || {});
    }

    return result;
  };

  RvmViewer3D.prototype[PATCH_FLAG] = true;
}

installRvmSupportIndexAttributeBridge();
