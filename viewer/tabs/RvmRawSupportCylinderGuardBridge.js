import * as THREE from 'three';

const CACHE_KEY = '20260622-rvm-raw-support-cylinder-guard-2-hide-inputxml-prims';
const GLOBAL_KEY = '__PCF_GLB_RVM_RAW_SUPPORT_CYLINDER_GUARD__';
const RAW_INPUTXML_SUPPORT_PRIMITIVES_KEY = 'rvm.rawInputXmlSupportPrimitives';
const SUPPORT_SYMBOL_ROOTS = new Set([
  '__RVM_SUPPORT_SYMBOLS__',
  '__RVM_GEOMETRY_SUPPORT_SYMBOLS__',
  '__RVM_SUPPORT_ASSEMBLY_MARKERS__'
]);
const PIPE_LIKE_RE = /\b(PE_\d+_(PIPE|BEND|ELBOW|VALVE|FLANGE|TEE|GASKET|REDUCER)|PIPE|BEND|ELBOW|VALVE|FLANGE|TEE)\b/i;
const SUPPORT_LIKE_RE = /\b(INPUTXML-\d+-(REST|GUIDE|LINESTOP|STOP|ANCHOR|SUPPORT)|SUPPORT|REST|GUIDE|LINE\s*STOP|LINESTOP|ANCHOR|SHOE)\b/i;
const INPUTXML_SUPPORT_PRIM_RE = /\bINPUTXML[-_ ]?\d+[-_ ]?(REST|GUIDE|LINESTOP|LINE\s*STOP|STOP|ANCHOR|LIMIT|LIM|SUPPORT|SHOE)\b/i;

export function installRvmRawSupportCylinderGuardBridge() {
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root && viewer) bind(root, viewer);
    if ((!root || !viewer) && attempts < 180) setTimeout(attach, 300);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function bind(root, viewer) {
  if (!root || root.dataset.rvmRawSupportCylinderGuard === CACHE_KEY) return;
  root.dataset.rvmRawSupportCylinderGuard = CACHE_KEY;
  const run = () => applyGuard(root, viewer);
  for (const delay of [250, 900, 1800, 3600, 7000]) setTimeout(run, delay);
  const timer = setInterval(run, 2200);
  root._rvmRawSupportCylinderGuardCleanup = () => clearInterval(timer);
  globalThis[GLOBAL_KEY] = { cacheKey: CACHE_KEY, apply: run, last: null };
}

function applyGuard(root, viewer) {
  const diag = {
    schema: 'rvm-raw-support-cylinder-guard/v2-hide-inputxml-raw-support-primitives',
    cacheKey: CACHE_KEY,
    convertedSupportStandCount: 0,
    protectedRawCylinderCount: 0,
    hiddenInputXmlRawSupportPrimitiveCount: 0,
    restoredInputXmlRawSupportPrimitiveCount: 0,
    clearedPipeLikeSupportCandidateCount: 0,
    removedRawModeSymbolRootCount: 0,
    hiddenPipeLikeGeneratedSymbolCount: 0,
    skippedMissingAxisCount: 0,
  };

  const supportMode = String(root?.dataset?.rvmSupportMode || '').toLowerCase() || currentSupportMode();
  const showRawInputXmlSupportPrimitives = rawInputXmlSupportPrimitivesEnabled();
  if (supportMode === 'raw') removeSupportSymbolRoots(viewer, diag);

  viewer?.modelGroup?.updateMatrixWorld?.(true);
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!obj) return;
    const text = objectText(obj);
    if (isPipeLikeFalseSupport(obj, text)) {
      clearSupportCandidateFlags(obj);
      diag.clearedPipeLikeSupportCandidateCount += 1;
      return;
    }
    if (isInputXmlGeneratedRawSupportPrimitive(obj, text)) {
      if (showRawInputXmlSupportPrimitives) {
        if (restoreInputXmlRawSupportPrimitive(obj)) diag.restoredInputXmlRawSupportPrimitiveCount += 1;
      } else {
        hideInputXmlRawSupportPrimitive(obj);
        diag.hiddenInputXmlRawSupportPrimitiveCount += 1;
        return;
      }
    }
    if (!isRawSupportCylinderPreserved(obj)) return;
    diag.protectedRawCylinderCount += 1;
    const eff = String(obj.userData?.effectiveRenderPrimitive || '').toUpperCase();
    if (eff === 'SUPPORT_STAND' || obj.userData?.renderSource === 'support-preserved-rvm-cylinder-raw') {
      if (convertSupportStandToRawCylinder(obj)) diag.convertedSupportStandCount += 1;
      else diag.skippedMissingAxisCount += 1;
    }
  });

  viewer?.scene?.traverse?.((obj) => {
    if (!obj || obj.isScene) return;
    const data = obj.userData || {};
    if (!(data.supportSymbol || data.rvmSupportSymbolGenerated || data.rvmSupportAssembly)) return;
    const text = objectText(obj);
    if (PIPE_LIKE_RE.test(text) && !SUPPORT_LIKE_RE.test(text)) {
      obj.visible = false;
      data.rvmHiddenByRawSupportCylinderGuard = true;
      data.nonSelectableReason = 'pipe-like false support symbol hidden by raw support guard';
      diag.hiddenPipeLikeGeneratedSymbolCount += 1;
    }
  });

  globalThis[GLOBAL_KEY] = { cacheKey: CACHE_KEY, apply: () => applyGuard(root, viewer), last: diag };
  return diag;
}

function removeSupportSymbolRoots(viewer, diag) {
  removeSupportSymbolRootsFrom(viewer?.scene, diag);
  removeSupportSymbolRootsFrom(viewer?.modelGroup, diag);
}

function removeSupportSymbolRootsFrom(parent, diag) {
  if (!parent?.getObjectByName) return;
  for (const name of SUPPORT_SYMBOL_ROOTS) {
    let root = parent.getObjectByName(name);
    while (root) {
      root.parent?.remove?.(root);
      disposeObject(root);
      diag.removedRawModeSymbolRootCount += 1;
      root = parent.getObjectByName(name);
    }
  }
}

function convertSupportStandToRawCylinder(obj) {
  if (obj.userData?.rvmRawSupportCylinderGuardConverted) return true;
  const attrs = attrsFor(obj);
  const start = parseVec3(attrs.RVM_BROWSER_AXIS_START || attrs.RVM_PRIMITIVE_AXIS_START || attrs.AXIS_START);
  const end = parseVec3(attrs.RVM_BROWSER_AXIS_END || attrs.RVM_PRIMITIVE_AXIS_END || attrs.AXIS_END);
  const radius = finiteNumber(attrs.RVM_BROWSER_RADIUS || attrs.RVM_PRIMITIVE_RADIUS || attrs.RADIUS) || fallbackRadiusFromObject(obj);
  if (!start || !end || !Number.isFinite(radius) || radius <= 0) return false;
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (!Number.isFinite(length) || length <= 1e-9) return false;

  while (obj.children?.length) {
    const child = obj.children.pop();
    if (child) disposeObject(child);
  }
  const material = rawSupportMaterial(obj);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'RVM_RAW_SUPPORT_CYLINDER_PRESERVED';
  mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  mesh.userData = {
    ...(obj.userData || {}),
    rvmRawSupportCylinderGuardChild: true,
    effectiveRenderPrimitive: 'RVM_NATIVE_CYLINDER',
    renderQuality: 'direct-raw-support-cylinder',
    pickable: true,
  };
  obj.add(mesh);
  obj.userData.rvmRawSupportCylinderGuardConverted = true;
  obj.userData.effectiveRenderPrimitive = 'RVM_NATIVE_CYLINDER';
  obj.userData.renderQuality = 'direct-raw-support-cylinder';
  obj.userData.supportStandSuppressedReason = 'raw support code-8 cylinder preserved; generated support stand removed';
  return true;
}

function isRawSupportCylinderPreserved(obj) {
  const attrs = attrsFor(obj);
  return String(attrs.RVM_BROWSER_SUPPORT_RAW_CYLINDER_PRESERVED || obj.userData?.RVM_BROWSER_SUPPORT_RAW_CYLINDER_PRESERVED || '').toLowerCase() === 'true';
}

function isInputXmlGeneratedRawSupportPrimitive(obj, text = objectText(obj)) {
  const attrs = attrsFor(obj);
  const recordTag = String(attrs.RVM_RECORD_TAG || '').toUpperCase();
  const code = Number.parseInt(String(attrs.RVM_PRIMITIVE_CODE ?? attrs.RVM_BINARY_PRIMITIVE_CODE ?? '').trim(), 10);
  const primitive = String(attrs.RVM_BROWSER_RENDER_PRIMITIVE || obj?.userData?.renderPrimitive || obj?.userData?.effectiveRenderPrimitive || '').toUpperCase();
  const nativeLike = recordTag === 'PRIM'
    || Number.isFinite(code)
    || /RVM_(NATIVE_)?(CYLINDER|PYRAMID|BOX|SPHERE)|PIPE_CYLINDER|CYLINDER_BBOX/.test(primitive)
    || /^\s*RVM\s+(CYLINDER|PYRAMID|BOX|SPHERE|TORUS|SNOUT|FACET)/i.test(String(obj?.name || ''));
  return nativeLike && INPUTXML_SUPPORT_PRIM_RE.test(String(text || ''));
}

function hideInputXmlRawSupportPrimitive(obj) {
  const data = obj.userData || {};
  obj.visible = false;
  data.rvmHiddenInputXmlRawSupportPrimitive = true;
  data.pickable = false;
  data.selectable = false;
  data.nonSelectableReason = 'InputXML-generated raw support primitive hidden by default; enable rvm.rawInputXmlSupportPrimitives to inspect file support markers';
}

function restoreInputXmlRawSupportPrimitive(obj) {
  const data = obj.userData || {};
  if (!data.rvmHiddenInputXmlRawSupportPrimitive) return false;
  obj.visible = true;
  data.rvmHiddenInputXmlRawSupportPrimitive = false;
  data.pickable = true;
  data.selectable = true;
  delete data.nonSelectableReason;
  return true;
}

function isPipeLikeFalseSupport(obj, text) {
  if (!PIPE_LIKE_RE.test(text)) return false;
  if (SUPPORT_LIKE_RE.test(text)) return false;
  const data = obj.userData || {};
  return Boolean(data.rvmSupportCandidate || data.RVM_BROWSER_SUPPORT_HINT === 'true' || data.rvmSupportCandidateKind || data.rvmSupportEngineMapped);
}

function clearSupportCandidateFlags(obj) {
  const data = obj.userData || {};
  for (const key of [
    'rvmSupportCandidate',
    'rvmSupportCandidateKind',
    'rvmSupportCandidateReason',
    'rvmSupportCandidateByGeometry',
    'rvmSupportEngineMapped',
    'rvmSupportEngineConfidence',
    'RVM_BROWSER_SUPPORT_HINT',
    'RVM_BROWSER_SUPPORT_KIND',
  ]) delete data[key];
  const attrs = data.browserRvmAttributes;
  if (attrs && typeof attrs === 'object') {
    for (const key of ['TYPE', 'SUPPORT_KIND', 'RVM_BROWSER_SUPPORT_HINT', 'RVM_BROWSER_SUPPORT_KIND', 'supportStagedJsonRole', 'supportEngineSchema']) delete attrs[key];
  }
}

function attrsFor(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  return { ...(data || {}), ...(data.browserRvmAttributes || {}), ...(props.attributes || {}), ...(data.attributes || {}) };
}

function objectText(obj) {
  const attrs = attrsFor(obj);
  return [
    obj?.name,
    obj?.userData?.displayName,
    obj?.userData?.sourcePath,
    obj?.userData?.type,
    obj?.userData?.kind,
    obj?.userData?.effectiveRenderPrimitive,
    attrs.NAME,
    attrs.TYPE,
    attrs.RVM_RECORD_TAG,
    attrs.RVM_PRIMITIVE_CODE,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.RVM_BROWSER_SUPPORT_KIND,
  ].map((value) => String(value || '')).join(' ');
}

function parseVec3(value) {
  if (!value) return null;
  if (value.isVector3) return value.clone();
  if (typeof value === 'object') {
    const x = Number(value.x), y = Number(value.y), z = Number(value.z);
    if ([x, y, z].every(Number.isFinite)) return new THREE.Vector3(x, y, z);
  }
  const nums = String(value).match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  if (nums.length >= 3 && nums.slice(0, 3).every(Number.isFinite)) return new THREE.Vector3(nums[0], nums[1], nums[2]);
  return null;
}

function fallbackRadiusFromObject(obj) {
  try {
    obj.updateMatrixWorld?.(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((a, b) => a - b);
    return Math.max(dims[0] * 0.5, 0.001);
  } catch (_) {
    return 0.001;
  }
}

function rawSupportMaterial(obj) {
  const source = firstMaterial(obj);
  if (source?.clone) return source.clone();
  return new THREE.MeshStandardMaterial({ color: 0x9aa7b0, roughness: 0.68, metalness: 0.12 });
}

function firstMaterial(obj) {
  let found = null;
  obj?.traverse?.((child) => { if (!found && child?.material) found = Array.isArray(child.material) ? child.material[0] : child.material; });
  return found;
}

function currentSupportMode() {
  try {
    const saved = localStorage.getItem('rvm_support_render_mode_v1') || '';
    return ['raw', 'symbol', 'both'].includes(saved) ? saved : 'raw';
  } catch (_) {
    return 'raw';
  }
}

function rawInputXmlSupportPrimitivesEnabled() {
  try {
    return localStorage.getItem(RAW_INPUTXML_SUPPORT_PRIMITIVES_KEY) === 'on';
  } catch (_) {
    return false;
  }
}

function finiteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function disposeObject(root) {
  root?.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat?.dispose?.());
    else obj.material?.dispose?.();
  });
}