import * as THREE from 'three';

export const BROWSER_RVM_REMAINING_PRIMITIVE_SCHEMA = 'browser-rvm-remaining-primitives/v2-facetgroup-tessellation';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-remaining-primitive-runtime-patch-v2-facetgroup');
const UPGRADE_FLAG = Symbol.for('pcf-glb-rvm-remaining-primitive-upgraded-v2');
const GLOBAL_STATE_KEY = '__PCF_GLB_RVM_REMAINING_PRIMITIVES__';
const GLOBAL_DIAGNOSTICS_KEY = '__PCF_GLB_RVM_REMAINING_PRIMITIVES_DIAGNOSTICS__';
const MAX_OBJECTS = 8000;
const FACET_GROUP_RENDER_QUALITY = 'native-cpp-facetgroup-tessellated';

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

    if (!params?.decoded || !matrix) {
      if (code === 11) {
        diagnostics.facetGroupUnsupportedCount += 1;
        diagnostics.facetGroupDecodeCapSkippedCount += params?.reason ? 1 : 0;
        bump(diagnostics.skippedReasons, params?.reason || 'facet-group-native-stream-not-decoded');
      }
      return;
    }
    if (code !== 1 && code !== 10 && code !== 11) return;
    diagnostics.candidateCount += 1;
    const native = buildNativeObject(code, params, matrix, materialForSource(object), diagnostics);
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
    if (item.code === 11) diagnostics.facetGroupTessellatedCount += 1;
    bump(diagnostics.upgradedKindCounts, item.params.kindName || `Kind-${item.code}`);
  }
  if (replacements.length >= MAX_OBJECTS) {
    diagnostics.skippedCount += 1;
    bump(diagnostics.skippedReasons, 'upgrade-object-limit');
  }
  return diagnostics;
}

function buildNativeObject(code, params, matrix3x4, material, diagnostics) {
  let geometry = null;
  let primitive = '';
  if (code === 1) {
    geometry = pyramidGeometry(params);
    primitive = 'RVM_NATIVE_PYRAMID';
  } else if (code === 10) {
    geometry = lineBoxGeometry(params);
    primitive = 'RVM_NATIVE_LINE';
  } else if (code === 11) {
    geometry = facetGroupGeometry(params, diagnostics);
    primitive = 'RVM_NATIVE_FACET_GROUP';
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
    renderQuality: code === 11 ? FACET_GROUP_RENDER_QUALITY : 'native-cpp-remaining-primitive',
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
  return new THREE.BoxGeometry(thickness, thickness, length);
}

function facetGroupGeometry(params, diagnostics) {
  const positions = [];
  const normals = [];
  const indices = [];
  const polygons = Array.isArray(params?.polygons) ? params.polygons : [];
  let polygonCount = 0;
  let triangleCount = 0;
  let holeSkipped = 0;
  for (const polygon of polygons) {
    const contours = Array.isArray(polygon?.contours) ? polygon.contours : [];
    const contour = contours[0];
    if (!contour || !Array.isArray(contour.vertices) || contour.vertices.length < 9) continue;
    polygonCount += 1;
    if (contours.length > 1) holeSkipped += contours.length - 1;
    const vo = positions.length / 3;
    const vertexCount = Math.floor(contour.vertices.length / 3);
    for (let i = 0; i < vertexCount; i += 1) {
      positions.push(finite(contour.vertices[i * 3], 0), finite(contour.vertices[i * 3 + 1], 0), finite(contour.vertices[i * 3 + 2], 0));
      if (Array.isArray(contour.normals) && contour.normals.length >= (i + 1) * 3) {
        normals.push(finite(contour.normals[i * 3], 0), finite(contour.normals[i * 3 + 1], 0), finite(contour.normals[i * 3 + 2], 1));
      } else {
        normals.push(0, 0, 1);
      }
    }
    if (vertexCount === 3) {
      indices.push(vo, vo + 1, vo + 2);
      triangleCount += 1;
    } else if (vertexCount === 4) {
      const split = quadSplit(contour.vertices);
      if (split === '012') {
        indices.push(vo, vo + 1, vo + 2, vo + 2, vo + 3, vo);
      } else {
        indices.push(vo + 3, vo, vo + 1, vo + 1, vo + 2, vo + 3);
      }
      triangleCount += 2;
    } else {
      for (let i = 1; i < vertexCount - 1; i += 1) indices.push(vo, vo + i, vo + i + 1);
      triangleCount += Math.max(vertexCount - 2, 0);
    }
  }
  diagnostics.facetGroupPolygonCount += polygonCount;
  diagnostics.facetGroupTriangleCount += triangleCount;
  diagnostics.facetGroupContourHoleSkippedCount += holeSkipped;
  if (!positions.length || !indices.length) return null;
  const geometry = bufferGeometry(positions, indices);
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function quadSplit(vertices) {
  const p = (i) => new THREE.Vector3(finite(vertices[i * 3], 0), finite(vertices[i * 3 + 1], 0), finite(vertices[i * 3 + 2], 0));
  const v0 = p(0), v1 = p(1), v2 = p(2), v3 = p(3);
  const n0 = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v3, v0));
  const n1 = new THREE.Vector3().subVectors(v2, v1).cross(new THREE.Vector3().subVectors(v0, v1));
  const n2 = new THREE.Vector3().subVectors(v3, v2).cross(new THREE.Vector3().subVectors(v1, v2));
  const n3 = new THREE.Vector3().subVectors(v0, v3).cross(new THREE.Vector3().subVectors(v2, v3));
  return n0.dot(n2) < n1.dot(n3) ? '012' : '301';
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
    renderQuality: native.userData.renderQuality,
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
    facetGroupTessellatedCount: 0,
    facetGroupRenderQuality: FACET_GROUP_RENDER_QUALITY,
    facetGroupUnsupportedCount: 0,
    facetGroupDecodeCapSkippedCount: 0,
    facetGroupPolygonCount: 0,
    facetGroupTriangleCount: 0,
    facetGroupContourHoleSkippedCount: 0,
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
      facetGroupTessellatedCount: diagnostics.facetGroupTessellatedCount,
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
