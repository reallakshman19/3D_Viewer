import * as THREE from 'three';

export const BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA = 'browser-rvm-remaining-primitives/v1-pyramid-line-facet-diagnostics';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-remaining-primitive-runtime-patch-v1');
const UPGRADE_FLAG = Symbol.for('pcf-glb-rvm-remaining-primitive-upgraded-v1');
const GLOBAL_STATE_KEY = '__PCF_GLB_RVM_REMAINING_PRIMITIVES__';
const GLOBAL_DIAGNOSTICS_KEY = '__PCF_GLB_RVM_REMAINING_PRIMITIVES_DIAGNOSTICS__';
const MAX_OBJECTS = 8000;

export function installBrowserRvmRemainingPrimitiveRuntimePatch() {
  if (globalThis[PATCH_FLAG]) return globalThis[PATCH_FLAG];
  const state = {
    installed: true,
    schemaVersion: BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA,
    installedAt: new Date().toISOString(),
    runs: 0,
    lastDiagnostics: null,
    runNow() { return runAndPublish(); },
    getDiagnostics() { return state.lastDiagnostics || globalThis[GLOBAL_DIAGNOSTICS_KEY] || null; },
  };
  globalThis[PATCH_FLAG] = state;
  globalThis[GLOBAL_STATE_KEY] = state;

  const schedule = () => requestAnimationFrameSafe(runAndPublish);
  state.schedule = schedule;

  function runAndPublish() {
    const diagnostics = upgradeActiveRvmRemainingPrimitives();
    if (diagnostics) {
      state.runs += 1;
      state.lastDiagnostics = diagnostics;
      publishDiagnostics(diagnostics);
    }
    return diagnostics;
  }

  try { globalThis.addEventListener?.('rvm-browser-parse-diagnostics', schedule); } catch (_) {}
  try { globalThis.addEventListener?.('rvm-native-tessellation-diagnostics', schedule); } catch (_) {}
  for (const delay of [700, 1800, 3600, 6500]) setTimeout(schedule, delay);
  return state;
}

export function upgradeActiveRvmRemainingPrimitives() {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  if (!viewer?.modelGroup) return makeDiagnostics({ reason: 'viewer-not-ready' });
  const diagnostics = upgradeRvmRemainingPrimitives(viewer.modelGroup);
  annotateViewer(viewer, diagnostics);
  return diagnostics;
}

export function upgradeRvmRemainingPrimitives(root) {
  const diagnostics = makeDiagnostics({ reason: '' });
  if (!root?.traverse) return diagnostics;
  const replacements = [];
  root.traverse((object) => {
    if (!object || replacements.length >= MAX_OBJECTS) return;
    if (object === root || !object.parent || !object.isMesh) return;
    diagnostics.scannedCount += 1;
    if (object[UPGRADE_FLAG] || object.userData?.browserRvmRemainingPrimitiveUpgraded) {
      diagnostics.alreadyUpgradedCount += 1;
      return;
    }
    const attrs = object.userData?.browserRvmAttributes || object.userData?.attributes || object.userData?.browserRvmProperties?.attributes || null;
    const params = parseNativeParams(attrs?.RVM_NATIVE_PRIMITIVE_PARAMS);
    const matrix = parseNumericArray(attrs?.RVM_TRANSFORM_3X4, 12);
    const code = Number(params?.kind || attrs?.RVM_PRIMITIVE_CODE);
    if (!Number.isFinite(code)) return;
    bump(diagnostics.kindCounts, params?.kindName || attrs?.RVM_PRIMITIVE_KIND_NAME || `Kind-${code}`);

    if (code === 11) {
      diagnostics.facetGroupUnsupportedCount += 1;
      bump(diagnostics.skippedReasons, 'facet-group-native-stream-not-decoded');
      return;
    }
    if (!params?.decoded || !matrix) return;
    if (code !== 1 && code !== 10) return;
    diagnostics.candidateCount += 1;
    const native = buildNativeObject(code, params, matrix, materialForSource(object));
    if (!native) {
      diagnostics.skippedCount += 1;
      bump(diagnostics.skippedReasons, `unsupported-kind-${code}`);
      return;
    }
    replacements.push({ source: object, native, params, code });
  });

  for (const item of replacements) {
    replaceObject(item.source, item.native, item.params, item.code);
    diagnostics.upgradedCount += 1;
    if (item.code === 1) diagnostics.pyramidTessellatedCount += 1;
    if (item.code === 10) diagnostics.lineTessellatedCount += 1;
    bump(diagnostics.upgradedKindCounts, item.params.kindName || `Kind-${item.code}`);
  }
  if (replacements.length >= MAX_OBJECTS) {
    diagnostics.skippedCount += 1;
    bump(diagnostics.skippedReasons, 'upgrade-object-limit');
  }
  return diagnostics;
}

function buildNativeObject(code, params, matrix3x4, material) {
  let geometry = null;
  let primitive = '';
  if (code === 1) {
    geometry = pyramidGeometry(params);
    primitive = 'RVM_NATIVE_PYRAMID';
  } else if (code === 10) {
    geometry = lineBoxGeometry(params);
    primitive = 'RVM_NATIVE_LINE';
  }
  if (!geometry) return null;
  geometry.applyMatrix4(matrix4FromCppMat3x4(matrix3x4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals?.();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = primitive;
  mesh.userData = {
    schemaVersion: BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA,
    browserRvmRemainingPrimitiveUpgraded: true,
    browserRvmRemainingPrimitiveSchema: BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA,
    effectiveRenderPrimitive: primitive,
    renderQuality: 'native-cpp-remaining-primitive',
  };
  mesh[UPGRADE_FLAG] = true;
  return mesh;
}

function pyramidGeometry(params) {
  const bx = positive(Math.abs(params.bottomX), 0.001) * 0.5;
  const by = positive(Math.abs(params.bottomY), 0.001) * 0.5;
  const tx = positive(Math.abs(params.topX), 0.001) * 0.5;
  const ty = positive(Math.abs(params.topY), 0.001) * 0.5;
  const ox = finite(params.offsetX, 0);
  const oy = finite(params.offsetY, 0);
  const h = positive(Math.abs(params.height), Math.max(bx, by, tx, ty) * 2);
  const z0 = -h * 0.5;
  const z1 = h * 0.5;
  const positions = [
    -bx, -by, z0,   bx, -by, z0,   bx,  by, z0,  -bx,  by, z0,
    ox - tx, oy - ty, z1,   ox + tx, oy - ty, z1,   ox + tx, oy + ty, z1,   ox - tx, oy + ty, z1,
  ];
  const indices = [];
  quad(indices, 0, 1, 2, 3);
  quad(indices, 4, 7, 6, 5);
  quad(indices, 0, 4, 5, 1);
  quad(indices, 1, 5, 6, 2);
  quad(indices, 2, 6, 7, 3);
  quad(indices, 3, 7, 4, 0);
  return bufferGeometry(positions, indices);
}

function lineBoxGeometry(params) {
  const a = positive(Math.abs(params.a), 0.001);
  const b = positive(Math.abs(params.b), a);
  const length = Math.max(a, b, 0.001);
  const thickness = Math.max(Math.min(a, b) * 0.04, length * 0.01, 0.001);
  const geometry = new THREE.BoxGeometry(thickness, thickness, length);
  return geometry;
}

function replaceObject(source, native, params, code) {
  const parent = source.parent;
  if (!parent) return;
  native.name = source.name || native.name;
  native.userData = {
    ...(source.userData || {}),
    ...(native.userData || {}),
    browserRvmRemainingPrimitiveUpgraded: true,
    browserRvmRemainingPrimitiveSchema: BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA,
    browserRvmRemainingPrimitiveKind: params.kindName || `Kind-${code}`,
    browserRvmRemainingPrimitiveCode: String(code),
    previousEffectiveRenderPrimitive: source.userData?.effectiveRenderPrimitive || '',
    previousRenderQuality: source.userData?.renderQuality || '',
    effectiveRenderPrimitive: native.userData.effectiveRenderPrimitive,
    renderQuality: 'native-cpp-remaining-primitive',
    pickable: true,
  };
  const index = parent.children.indexOf(source);
  if (index >= 0) parent.children[index] = native;
  native.parent = parent;
  source.parent = null;
  disposeObject(source);
}

function makeDiagnostics(extra = {}) {
  return {
    schemaVersion: BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA,
    capturedAt: new Date().toISOString(),
    reason: extra.reason || '',
    scannedCount: 0,
    candidateCount: 0,
    upgradedCount: 0,
    alreadyUpgradedCount: 0,
    skippedCount: 0,
    pyramidTessellatedCount: 0,
    lineTessellatedCount: 0,
    facetGroupUnsupportedCount: 0,
    kindCounts: {},
    upgradedKindCounts: {},
    skippedReasons: {},
  };
}

function publishDiagnostics(diagnostics = {}) {
  const payload = { schemaVersion: BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA, capturedAt: new Date().toISOString(), ...(diagnostics || {}) };
  globalThis[GLOBAL_DIAGNOSTICS_KEY] = payload;
  try { globalThis.dispatchEvent?.(new CustomEvent('rvm-remaining-primitive-diagnostics', { detail: payload })); } catch (_) {}
  return payload;
}

function annotateViewer(viewer, diagnostics) {
  const root = viewer?.modelGroup?.children?.[0] || viewer?.modelGroup || null;
  if (!root) return;
  root.userData = { ...(root.userData || {}), browserRvmRemainingPrimitiveDiagnostics: diagnostics };
  if (root.userData.browserRvmRender) {
    root.userData.browserRvmRender = {
      ...root.userData.browserRvmRender,
      remainingPrimitiveDiagnostics: diagnostics,
      remainingPrimitiveUpgradedCount: diagnostics.upgradedCount,
      facetGroupUnsupportedCount: diagnostics.facetGroupUnsupportedCount,
    };
  }
}

function bufferGeometry(positions, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}
function quad(indices, a, b, c, d) { indices.push(a, b, c, c, d, a); }
function matrix4FromCppMat3x4(m) {
  return new THREE.Matrix4().set(
    m[0], m[3], m[6], m[9],
    m[1], m[4], m[7], m[10],
    m[2], m[5], m[8], m[11],
    0, 0, 0, 1
  );
}
function materialForSource(object) {
  let material = null;
  object?.traverse?.((child) => { if (!material && child?.isMesh && child.material) material = Array.isArray(child.material) ? child.material[0] : child.material; });
  if (!material && object?.material) material = Array.isArray(object.material) ? object.material[0] : object.material;
  return material?.clone?.() || material || new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72, metalness: 0.08 });
}
function parseNativeParams(value) { if (!value) return null; try { return JSON.parse(String(value)); } catch (_) { return null; } }
function parseNumericArray(value, expected) {
  let arr = null;
  try { arr = JSON.parse(String(value || '')); } catch (_) { arr = String(value || '').split(/[\s,]+/g).map(Number).filter(Number.isFinite); }
  if (!Array.isArray(arr) || arr.length < expected) return null;
  const out = arr.slice(0, expected).map(Number);
  return out.every(Number.isFinite) ? out : null;
}
function disposeObject(root) { root?.traverse?.((obj) => { obj.geometry?.dispose?.(); }); }
function bump(target, key) { const name = String(key || '').trim() || 'UNKNOWN'; target[name] = (target[name] || 0) + 1; }
function positive(value, fallback) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function requestAnimationFrameSafe(fn) { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn); else setTimeout(fn, 0); }
