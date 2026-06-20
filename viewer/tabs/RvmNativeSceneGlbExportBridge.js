import * as THREE from 'three';
import { exportSceneToGLB } from '../js/pcf2glb/glb/exportSceneToGLB.js';

const VERSION = 'rvm-native-scene-glb-export/v1-att-extras';
const CACHE_KEY = '20260620-rvm-native-scene-glb-export-1';
const GLOBAL_KEY = '__PCF_GLB_RVM_NATIVE_GLB_EXPORT_DIAGNOSTICS__';
const API_KEY = '__PCF_GLB_RVM_NATIVE_GLB_EXPORT__';

export function installRvmNativeSceneGlbExportBridge() {
  injectStyles();
  const api = {
    version: VERSION,
    exportVisible: () => exportScope('visible'),
    exportSelected: () => exportScope('selected'),
    downloadAudit: () => downloadAudit(),
    getDiagnostics: () => globalThis[GLOBAL_KEY] || null,
  };
  globalThis[API_KEY] = api;
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root) injectControls(root, viewer);
    if ((!root || !viewer) && attempts < 160) setTimeout(attach, 350);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
  return api;
}

function injectControls(root) {
  const ribbon = root?.querySelector?.('.geo-top-ribbon');
  if (!ribbon || root.querySelector('[data-rvm-native-glb-export]')) return;
  const section = document.createElement('div');
  section.className = 'rvm-ribbon-section rvm-native-glb-export-section';
  section.dataset.rvmNativeGlbExport = CACHE_KEY;
  section.innerHTML = `
    <span class="rvm-ribbon-label">Export</span>
    <div class="rvm-native-glb-export-buttons" role="group" aria-label="RVM native scene export">
      <button class="rvm-btn" type="button" data-rvm-native-glb-export-action="visible">Visible GLB</button>
      <button class="rvm-btn" type="button" data-rvm-native-glb-export-action="selected">Selected GLB</button>
      <button class="rvm-btn" type="button" data-rvm-native-glb-export-action="audit">Audit JSON</button>
    </div>`;
  const search = ribbon.querySelector('.rvm-ribbon-search');
  ribbon.insertBefore(section, search || null);
  section.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-rvm-native-glb-export-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.rvmNativeGlbExportAction;
    button.disabled = true;
    try {
      if (action === 'audit') downloadAudit();
      else await exportScope(action === 'selected' ? 'selected' : 'visible');
    } finally {
      button.disabled = false;
    }
  });
  setStatus(root, 'RVM native GLB export ready');
}

async function exportScope(scope) {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const root = document.querySelector('[data-rvm-viewer]');
  const prepared = prepareExportScene(viewer, scope);
  if (!prepared.objects.length) {
    setStatus(root, scope === 'selected' ? 'No selected RVM geometry to export' : 'No visible RVM geometry to export');
    publishDiagnostics(prepared.audit);
    return null;
  }
  setStatus(root, `Exporting ${prepared.objects.length} ${scope} RVM object(s) to GLB...`);
  const blob = await exportSceneToGLB(prepared.scene);
  downloadBlob(blob, `${fileBase(scope)}.glb`);
  downloadJson(prepared.audit, `${fileBase(scope)}.audit.json`);
  publishDiagnostics(prepared.audit);
  setStatus(root, `Exported ${prepared.objects.length} ${scope} RVM object(s) to GLB`);
  return { blob, audit: prepared.audit };
}

function prepareExportScene(viewer, scope = 'visible') {
  const sourceMeshes = collectSourceMeshes(viewer, scope);
  const scene = new THREE.Scene();
  scene.name = `RVM native scene export ${scope}`;
  scene.userData = {
    exporter: VERSION,
    scope,
    source: 'rendered-upgraded-threejs-scene',
    capturedAt: new Date().toISOString(),
  };
  const componentGroups = new Map();
  const audit = baseAudit(scope);
  for (const source of sourceMeshes) {
    const attrs = attrsFor(source);
    const props = source.userData?.browserRvmProperties || {};
    const key = componentKey(source, attrs, props);
    let group = componentGroups.get(key);
    if (!group) {
      group = new THREE.Group();
      group.name = safeName(key || 'RVM_COMPONENT');
      group.userData = serializable({
        exporterComponentGroup: true,
        componentKey: key,
        NAME: attrs.RVM_OWNER_NAME || attrs.NAME || props.displayName || source.name,
        TYPE: attrs.TYPE || props.type || source.userData?.type,
        sourcePath: props.sourcePath || source.userData?.sourcePath || attrs.RVM_OWNER_PATH,
      });
      componentGroups.set(key, group);
      scene.add(group);
      audit.componentCount += 1;
    }
    const clone = cloneExportObject(source, attrs, props);
    if (!clone) { audit.skippedCount += 1; continue; }
    group.add(clone);
    audit.meshCount += 1;
    audit.exportedObjects.push(objectAudit(source, attrs, props));
    bump(audit.primitiveKindCounts, String(attrs.RVM_PRIMITIVE_CODE || attrs.RVM_PRIMITIVE_KIND_NAME || 'UNKNOWN'));
    bump(audit.typeCounts, String(attrs.TYPE || props.type || source.userData?.type || 'UNKNOWN'));
    if (isFallback(source, attrs)) {
      audit.fallbackObjectCount += 1;
      bump(audit.fallbackReasonCounts, fallbackReason(source, attrs));
    }
  }
  return { scene, audit, objects: sourceMeshes };
}

function collectSourceMeshes(viewer, scope) {
  if (!viewer?.modelGroup?.traverse) return [];
  const selected = scope === 'selected' ? new Set((viewer._rvmCanvasSelectedMeshes || []).filter(Boolean)) : null;
  const objects = [];
  viewer.modelGroup.updateMatrixWorld?.(true);
  viewer.modelGroup.traverse((obj) => {
    if (!isExportable(obj)) return;
    if (selected && !selected.has(obj)) return;
    objects.push(obj);
  });
  return unique(objects);
}

function isExportable(obj) {
  if (!obj || obj.visible === false || obj.userData?.rvmHiddenByUser) return false;
  if (!(obj.isMesh || obj.isLine || obj.isPoints)) return false;
  if (!obj.geometry) return false;
  if (obj.userData?.supportAssemblyMarker || obj.userData?.browserRvmSupportContactMarker) return false;
  return true;
}

function cloneExportObject(source, attrs, props) {
  try {
    const clone = source.clone(false);
    clone.geometry = source.geometry?.clone?.() || source.geometry;
    clone.material = cloneMaterial(source);
    clone.name = safeName(props.displayName || attrs.NAME || source.name || source.uuid);
    clone.userData = serializable({
      ...source.userData,
      browserRvmAttributes: attrs,
      attributes: attrs,
      browserRvmProperties: props,
      glbExportSchema: VERSION,
      glbExportSourceUuid: source.uuid,
      glbExportRenderPrimitive: source.userData?.effectiveRenderPrimitive || source.userData?.renderPrimitive || attrs.RVM_BROWSER_RENDER_PRIMITIVE,
      glbExportRenderQuality: source.userData?.renderQuality || '',
      glbExportPrimitiveCode: attrs.RVM_PRIMITIVE_CODE || '',
    });
    clone.matrix.copy(source.matrixWorld);
    clone.matrixAutoUpdate = false;
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    return clone;
  } catch (_) {
    return null;
  }
}

function cloneMaterial(source) {
  const original = source.userData?.rvmCanvasSelectionOriginalMaterial || source.userData?.rvmMaterialModeOriginalMaterial || source.material;
  if (Array.isArray(original)) return original.map((m) => m?.clone?.() || m);
  return original?.clone?.() || original;
}

function attrsFor(obj) {
  const data = obj.userData || {};
  const props = data.browserRvmProperties || {};
  return { ...(data.attributes || {}), ...(props.attributes || {}), ...(data.browserRvmAttributes || {}) };
}

function componentKey(obj, attrs, props) {
  return String(attrs.RVM_OWNER_NAME || attrs.RVM_OWNER_PATH || props.sourcePath || props.displayName || obj.userData?.sourcePath || obj.name || obj.uuid || 'RVM_COMPONENT');
}

function baseAudit(scope) {
  return {
    schemaVersion: VERSION,
    cacheKey: CACHE_KEY,
    capturedAt: new Date().toISOString(),
    scope,
    source: 'rendered-upgraded-threejs-scene',
    onlyVisible: true,
    includeHidden: false,
    componentCount: 0,
    meshCount: 0,
    skippedCount: 0,
    fallbackObjectCount: 0,
    primitiveKindCounts: {},
    typeCounts: {},
    fallbackReasonCounts: {},
    fallbackDiagnostics: globalThis.__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__ || null,
    materialDiagnostics: globalThis.__PCF_GLB_RVM_MATERIAL_MODE_DIAGNOSTICS__ || null,
    exportedObjects: [],
  };
}

function objectAudit(obj, attrs, props) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  return {
    name: props.displayName || attrs.NAME || obj.name || obj.uuid,
    type: attrs.TYPE || props.type || obj.userData?.type || '',
    primitiveCode: attrs.RVM_PRIMITIVE_CODE || '',
    renderPrimitive: obj.userData?.effectiveRenderPrimitive || obj.userData?.renderPrimitive || attrs.RVM_BROWSER_RENDER_PRIMITIVE || '',
    renderQuality: obj.userData?.renderQuality || '',
    sourcePath: props.sourcePath || obj.userData?.sourcePath || attrs.RVM_OWNER_PATH || '',
    byteOffset: attrs.RVM_BYTE_OFFSET || '',
    bboxSize: [round(size.x), round(size.y), round(size.z)],
    fallbackReason: isFallback(obj, attrs) ? fallbackReason(obj, attrs) : '',
  };
}

function isFallback(obj, attrs) {
  const text = `${obj.userData?.effectiveRenderPrimitive || ''} ${obj.userData?.renderPrimitive || ''} ${attrs.RVM_BROWSER_RENDER_PRIMITIVE || ''}`.toUpperCase();
  return /BBOX|PLACEHOLDER|BOX_SOLID|FALLBACK|UNKNOWN/.test(text);
}

function fallbackReason(obj, attrs) {
  const text = `${obj.userData?.effectiveRenderPrimitive || ''} ${obj.userData?.renderPrimitive || ''} ${attrs.RVM_BROWSER_RENDER_PRIMITIVE || ''}`.toUpperCase();
  if (text.includes('BOX_SOLID')) return 'box-solid-fallback';
  if (text.includes('BBOX')) return 'bbox-placeholder';
  if (text.includes('PLACEHOLDER')) return 'placeholder';
  return 'non-native-rendered';
}

function downloadAudit() {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const prepared = prepareExportScene(viewer, 'visible');
  publishDiagnostics(prepared.audit);
  downloadJson(prepared.audit, `${fileBase('visible')}.audit.json`);
  setStatus(document.querySelector('[data-rvm-viewer]'), 'Downloaded RVM GLB export audit JSON');
}

function fileBase(scope) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').replace('Z', '');
  return `rvm-native-scene-${scope}-${stamp}`;
}

function downloadJson(value, filename) {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function publishDiagnostics(audit) {
  globalThis[GLOBAL_KEY] = audit;
  try { globalThis.dispatchEvent?.(new CustomEvent('rvm-native-glb-export-diagnostics', { detail: audit })); } catch (_) {}
}

function setStatus(root, message) {
  const chip = root?.querySelector?.('#rvm-mode-chip');
  if (chip) chip.textContent = message;
}

function serializable(value) {
  try { return JSON.parse(JSON.stringify(value ?? {})); } catch (_) { return {}; }
}

function safeName(value) { return String(value || 'RVM_OBJECT').replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').slice(0, 180); }
function unique(items) { return Array.from(new Set(items)); }
function bump(map, key) { const name = String(key || '').trim() || 'UNKNOWN'; map[name] = (map[name] || 0) + 1; }
function round(value) { return Math.round(Number(value || 0) * 1e6) / 1e6; }

function injectStyles() {
  if (document.getElementById('rvm-native-scene-glb-export-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-native-scene-glb-export-style';
  style.textContent = `.rvm-native-glb-export-section .rvm-native-glb-export-buttons{display:flex;flex-wrap:wrap;gap:4px}.rvm-native-glb-export-section .rvm-btn{padding:4px 7px;font-size:11px}.rvm-native-glb-export-section .rvm-btn:disabled{opacity:.55;cursor:wait}`;
  document.head.appendChild(style);
}
