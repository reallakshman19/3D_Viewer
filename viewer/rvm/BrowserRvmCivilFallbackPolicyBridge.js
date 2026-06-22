import * as THREE from 'three';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-civil-fallback-policy-v2');
const VERSION = '20260622-rvm-civil-grid-fdns-panel-fallback-2';
const GLOBAL_KEY = '__PCF_GLB_RVM_CIVIL_FALLBACK_POLICY__';
const DIAG_KEY = '__PCF_GLB_RVM_CIVIL_FALLBACK_POLICY_DIAGNOSTICS__';
const LARGE_MAX_DIM = 700;
const LARGE_DIAGONAL = 1400;

export function installBrowserRvmCivilFallbackPolicyBridge() {
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  const state = { version: VERSION, runs: 0, lastDiagnostics: null, runNow: () => runPolicy(state) };
  globalThis[INSTALL_FLAG] = state;
  globalThis[GLOBAL_KEY] = state;
  const schedule = () => setTimeout(() => runPolicy(state), 0);
  for (const event of ['rvm-model-loaded', 'rvm-render-policy-diagnostics', 'rvm-browser-parse-diagnostics', 'rvm-native-facet-diagnostics']) {
    try { globalThis.addEventListener?.(event, schedule); } catch (_) {}
  }
  for (const delay of [300, 900, 1800, 3600, 7200]) setTimeout(schedule, delay);
  return state;
}

export function runBrowserRvmCivilFallbackPolicy(modelGroup = globalThis.__3D_RVM_VIEWER__?.modelGroup) {
  const diagnostics = baseDiagnostics();
  if (!modelGroup?.traverse) return { ...diagnostics, reason: 'model-not-ready' };
  modelGroup.traverse((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isLineSegments || obj?.isGroup)) return;
    diagnostics.scannedCount += 1;
    const policy = classifyCivilFallback(obj);
    if (!policy) return;
    diagnostics.policyCount += 1;
    diagnostics.byKind[policy.kind] = (diagnostics.byKind[policy.kind] || 0) + 1;
    obj.userData = { ...(obj.userData || {}), ...policy.userData, browserRvmCivilFallbackPolicyVersion: VERSION };
    if (policy.action === 'hide') {
      obj.visible = false;
      diagnostics.hiddenCount += 1;
    } else if (policy.action === 'wireframe') {
      applyWireframe(obj, policy.opacity);
      diagnostics.wireframeCount += 1;
    }
  });
  return diagnostics;
}

function runPolicy(state) {
  const diagnostics = runBrowserRvmCivilFallbackPolicy();
  state.runs += 1;
  state.lastDiagnostics = diagnostics;
  globalThis[DIAG_KEY] = diagnostics;
  try { globalThis.dispatchEvent?.(new CustomEvent('rvm-civil-fallback-policy-diagnostics', { detail: diagnostics })); } catch (_) {}
  return diagnostics;
}

function classifyCivilFallback(obj) {
  const data = obj.userData || {};
  const text = sourceText(obj, data);
  const kind = civilKind(text);
  if (!kind) return null;
  if (!isLargeEnvelope(obj)) return null;

  const primitive = String(data.effectiveRenderPrimitive || data.effectivePrimitive || data.renderPrimitive || data.renderKind || '').toUpperCase();
  const code = Number(data.primitiveCode || data.browserRvmPrimitiveCode || data.rvmPrimitiveCode || data.browserRvmNativePrimitiveCode || 0);
  const nativeFacetLike = data.browserRvmNativeFacetGroupPrimary || /NATIVE_FACET_GROUP|FACET/.test(primitive) || code === 11;
  const fallbackLike = /BBOX|BOX|PLACEHOLDER|GENERIC|UNKNOWN|STRUCTURE/.test(primitive) || data.browserRvmBboxPlaceholderWireframe || data.bboxPromotedSolidBlocked;
  const civilPanelLike = nativeFacetLike && /PANEL|FRAME|FRMWORK|FRAMEWORK|SBFRAMEWORK|FDNS|FOUNDATION|PAVE|GRID|GRAD|ROAD|PITS/.test(text);
  if (!fallbackLike && !civilPanelLike) return null;

  if (kind === 'GRID') return policy('GRID', 'hide', 'grid-container-or-code11-panel-hidden-not-grid-line-geometry', 0.08);
  if (kind === 'FDNS') return policy('FDNS', 'wireframe', 'foundation-code11-or-bbox-container-wireframe-not-solid-foundation', 0.12);
  if (kind === 'PANEL') return policy('PANEL', 'wireframe', 'large-civil-panel-code11-wireframe-diagnostic-not-solid-box', 0.10);
  return policy(kind, 'wireframe', `${kind.toLowerCase()}-civil-container-wireframe-diagnostic`, 0.14);
}

function policy(kind, action, reason, opacity = 0.18) {
  return {
    kind,
    action,
    opacity,
    userData: {
      pickable: false,
      selectable: false,
      nonSelectableReason: reason,
      fallbackReason: reason,
      geometryPolicy: action === 'hide' ? 'civil-container-hidden-diagnostic' : 'civil-container-wireframe-diagnostic',
      materialPolicy: 'civil-fallback-diagnostic',
      rvmCivilFallbackKind: kind,
    },
  };
}

function sourceText(obj, data) {
  const attrs = data.browserRvmAttributes || data.attributes || {};
  const props = data.browserRvmProperties || {};
  return [
    obj.name,
    data.displayName,
    data.sourceName,
    data.sourcePath,
    data.reviewName,
    props.sourcePath,
    props.SourcePath,
    props.displayName,
    attrs.RVM_OWNER_PATH,
    attrs.RVM_OWNER_NAME,
    attrs.NAME,
    attrs.TYPE,
    attrs.RVM_PRIMITIVE_KIND,
  ].filter(Boolean).join('/').toUpperCase();
}

function civilKind(text) {
  if (/(^|[-_/])GRID($|[-_/])|CU-CI-GRID/.test(text)) return 'GRID';
  if (/(^|[-_/])FDNS($|[-_/])|FOUNDATION|CU-CI-FDNS/.test(text)) return 'FDNS';
  if (/(^|[-_/])ROAD($|[-_/])|CU-CI-ROAD/.test(text)) return 'ROAD';
  if (/(^|[-_/])GRAD($|[-_/])|CU-CI-GRAD/.test(text)) return 'GRAD';
  if (/(^|[-_/])PITS($|[-_/])|CU-CI-PITS/.test(text)) return 'PITS';
  if (/PANEL|FRMWORK|FRAMEWORK|SBFRAMEWORK|PAVE/.test(text)) return 'PANEL';
  return '';
}

function isLargeEnvelope(obj) {
  let box = null;
  try { box = new THREE.Box3().setFromObject(obj); } catch (_) { return false; }
  if (!box || box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z));
  const diagonal = Math.hypot(size.x, size.y, size.z);
  return maxDim >= LARGE_MAX_DIM || diagonal >= LARGE_DIAGONAL;
}

function applyWireframe(obj, opacity = 0.18) {
  obj.traverse?.((child) => {
    if (!child?.material || !child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      const cloned = mat?.clone ? mat.clone() : new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
      cloned.wireframe = true;
      cloned.transparent = true;
      cloned.opacity = opacity;
      cloned.depthWrite = false;
      return cloned;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

function baseDiagnostics() {
  return { version: VERSION, capturedAt: new Date().toISOString(), scannedCount: 0, policyCount: 0, hiddenCount: 0, wireframeCount: 0, byKind: {} };
}
