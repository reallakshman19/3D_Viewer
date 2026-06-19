import * as THREE from 'three';
import { state } from '../core/state.js';

export const INPUTXML_AUTO_BEND_ROOT = '__RVM_INPUTXML_AUTO_BEND_GRAPHICS__';
export const INPUTXML_AXIS_ROOT = '__RVM_CANVAS_AXIS_TRIAD__';
export const INPUTXML_NODE_GRAPH_KEY = '__RVM_INPUTXML_NODE_GRAPH__';

const PIPE_MAT = new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.62, metalness: 0.08 });
const BEND_MAT = new THREE.MeshStandardMaterial({ color: 0x9c4c9f, roughness: 0.6, metalness: 0.06 });
const NODE_MAT = new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.7, metalness: 0.04 });
const SOURCE_BEND_MAT = new THREE.MeshStandardMaterial({ color: 0x8b5fc9, roughness: 0.62, metalness: 0.06 });
const TOL = 1e-3;

function s(v) { return v == null ? '' : String(v); }
function up(v) { return s(v).trim().toUpperCase(); }
function n(v, fallback = NaN) {
  const x = Number.parseFloat(s(v).replace(/mm/ig, '').replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : fallback;
}

function axisConfig() {
  let verticalAxis = 'Y';
  let northAxis = 'X';
  try { verticalAxis = up(localStorage.getItem('rvm.inputxml.verticalAxis') || 'Y') || 'Y'; } catch {}
  try { northAxis = up(localStorage.getItem('rvm.inputxml.northAxis') || 'X') || 'X'; } catch {}
  if (!['X', 'Y', 'Z'].includes(verticalAxis)) verticalAxis = 'Y';
  if (!['X', 'Y', 'Z'].includes(northAxis) || northAxis === verticalAxis) northAxis = verticalAxis === 'X' ? 'Y' : 'X';
  const eastAxis = ['X', 'Y', 'Z'].find((axis) => axis !== verticalAxis && axis !== northAxis) || 'Z';
  return { verticalAxis, northAxis, eastAxis };
}
function putAxis(out, axisName, value) {
  if (axisName === 'X') out.x = value;
  else if (axisName === 'Y') out.y = value;
  else out.z = value;
}
function mapNamedCoord(text) {
  const parts = s(text).trim().split(/\s+/g);
  const map = axisConfig();
  const out = { x: 0, y: 0, z: 0 };
  let ok = false;
  for (let i = 0; i < parts.length - 1; i += 2) {
    const axis = up(parts[i]);
    const value = n(parts[i + 1]);
    if (!Number.isFinite(value)) continue;
    if (axis === 'E') { putAxis(out, map.eastAxis, value); ok = true; }
    else if (axis === 'W') { putAxis(out, map.eastAxis, -value); ok = true; }
    else if (axis === 'N') { putAxis(out, map.northAxis, value); ok = true; }
    else if (axis === 'S') { putAxis(out, map.northAxis, -value); ok = true; }
    else if (axis === 'U') { putAxis(out, map.verticalAxis, value); ok = true; }
    else if (axis === 'D') { putAxis(out, map.verticalAxis, -value); ok = true; }
  }
  return ok ? new THREE.Vector3(out.x, out.y, out.z) : null;
}

export function inputXmlPoint(v) {
  if (!v && v !== 0) return null;
  if (typeof v === 'string') {
    const named = mapNamedCoord(v);
    if (named) return named;
    const vals = s(v).match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
    return vals.length >= 3 ? new THREE.Vector3(vals[0], vals[1], vals[2]) : null;
  }
  if (Array.isArray(v) && v.length >= 3) {
    const p = new THREE.Vector3(n(v[0]), n(v[1]), n(v[2]));
    return [p.x, p.y, p.z].every(Number.isFinite) ? p : null;
  }
  if (typeof v === 'object') {
    const p = new THREE.Vector3(n(v.x ?? v.X), n(v.y ?? v.Y), n(v.z ?? v.Z));
    return [p.x, p.y, p.z].every(Number.isFinite) ? p : null;
  }
  return null;
}

function isInputXmlNode(node) {
  const a = node?.attributes || {};
  return /INPUTXML/i.test([node?.name, node?.canonicalObjectId, a.SOURCE_FORMAT, a.SOURCE_CONVERTER, a.SOURCE_FILE, a.NAME, a.REF].map(s).join(' '));
}
function isSupportNode(node) {
  const a = node?.attributes || {};
  const t = up(node?.kind || node?.type || a.TYPE || a.RAW_TYPE);
  return ['ATTA', 'ANCI', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT'].includes(t) || /SUPPORT|RESTRAINT/.test(up(a.NAME || node?.name));
}
function hasInputXmlNodeEdge(node) {
  const a = node?.attributes || {};
  return Boolean(s(a.FROM_NODE).trim() && s(a.TO_NODE).trim());
}
function bore(a) {
  return Math.max(n(a.BORE ?? a.ABORE ?? a.LBORE ?? a.DIAMETER ?? a.ATTACHED_PIPE_OD, 100), 1);
}
function key(p) {
  return `${Math.round(p.x / TOL)}|${Math.round(p.y / TOL)}|${Math.round(p.z / TOL)}`;
}
function nodeKey(value, fallback) {
  const text = s(value).trim();
  return text || fallback || '';
}
function isSourceBend(seg) {
  return ['BEND', 'ELBO', 'ELBOW'].includes(up(seg?.sourceType));
}

function allIndexNodes() {
  return Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
}

function cylinderBetween(a, b, radius, material, name, sourceAttrs = {}) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 24), material);
  mesh.name = name || 'INPUTXML_PIPE';
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.userData = {
    inputXmlAutoBend: true,
    kind: 'PIPE',
    attributes: {
      TYPE: 'PIPE',
      RAW_TYPE: 'PIPE',
      AUTO_BEND_GRAPHICS: 'true',
      LABEL_POLICY: 'PIPE_ONLY',
      FROM_NODE: sourceAttrs.FROM_NODE || '',
      TO_NODE: sourceAttrs.TO_NODE || '',
      SOURCE_ELEMENT_ID: sourceAttrs.SOURCE_ELEMENT_ID || sourceAttrs.NAME || '',
    },
  };
  return mesh;
}
function makeNodeMarker(position, radius, name) {
  const r = Math.max(radius * 0.72, 2);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), NODE_MAT);
  mesh.name = name || 'INPUTXML_NODE_MARKER';
  mesh.position.copy(position);
  mesh.userData = { inputXmlAutoBend: true, kind: 'NODE', attributes: { TYPE: 'PIPE', RAW_TYPE: 'PIPE', LABEL_POLICY: 'PIPE_ONLY' } };
  return mesh;
}
function makeArc(fromDir, toDir, corner, radius, pipeRadius, material, name, maxTrimA = Infinity, maxTrimB = Infinity) {
  const d1 = fromDir.clone().normalize();
  const d2 = toDir.clone().normalize();
  const dot = THREE.MathUtils.clamp(d1.dot(d2), -1, 1);
  if (Math.abs(dot) > 0.985) return null;

  const normal = new THREE.Vector3().crossVectors(d1, d2);
  if (normal.lengthSq() < 1e-10) return null;
  normal.normalize();
  const angle = Math.acos(dot);
  const geometricTrim = Math.abs(radius * Math.tan(angle / 2));
  const safeTrim = Math.min(geometricTrim, radius * 2.5, maxTrimA, maxTrimB);
  if (!Number.isFinite(safeTrim) || safeTrim < Math.max(pipeRadius * 0.35, 0.5)) return null;

  const p1 = corner.clone().add(d1.clone().multiplyScalar(safeTrim));
  const p2 = corner.clone().add(d2.clone().multiplyScalar(safeTrim));
  const bisector = d1.clone().add(d2);
  if (bisector.lengthSq() < 1e-10) return null;
  bisector.normalize();
  const centerDistance = radius / Math.sin(angle / 2);
  const center = corner.clone().add(bisector.multiplyScalar(centerDistance));

  const v1 = p1.clone().sub(center);
  const pts = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const theta = (angle * i) / steps;
    pts.push(center.clone().add(v1.clone().applyAxisAngle(normal, theta)));
  }
  pts[0].copy(p1);
  pts[pts.length - 1].copy(p2);
  const curve = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, steps * 2, pipeRadius, 18, false), material);
  mesh.name = name || 'INPUTXML_AUTO_BEND_1_5D';
  mesh.userData = { inputXmlAutoBend: true, kind: 'BEND', attributes: { TYPE: 'PIPE', RAW_TYPE: 'PIPE', AUTO_BEND: '1.5D', AUTO_BEND_TRIM_MM: safeTrim.toFixed(3), LABEL_POLICY: 'PIPE_ONLY' } };
  return { mesh, p1, p2, trim: safeTrim };
}

function removeRoot(scene, name) {
  const old = scene?.getObjectByName(name);
  if (!old) return;
  scene.remove(old);
  old.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.());
    if (o.element?.parentNode) o.element.parentNode.removeChild(o.element);
  });
}
function hideOriginalInputXmlModel(viewer, hide) {
  if (!viewer?.modelGroup) return;
  viewer.modelGroup.visible = !hide;
  viewer.userData = viewer.userData || {};
  viewer.userData.inputXmlAutoBendHidesOriginal = Boolean(hide);
}
function autoBendEnabled() {
  try { return localStorage.getItem('rvm.inputxml.autoBend') !== 'off'; } catch { return true; }
}
function axisVisible() {
  try { return localStorage.getItem('rvm.canvasAxis.visible') !== 'off'; } catch { return true; }
}

export function isInputXmlRvmModel() {
  return allIndexNodes().some(isInputXmlNode);
}
function addEndpoint(map, id, seg, endName, p) {
  if (!id) return;
  if (!map.has(id)) map.set(id, []);
  map.get(id).push({ seg, endName, p });
}
function outwardDirection(item) {
  return (item.endName === 'p0'
    ? item.seg.p1.clone().sub(item.seg.p0)
    : item.seg.p0.clone().sub(item.seg.p1)).normalize();
}
function sameNodePoint(items) {
  if (!items.length) return null;
  const base = items[0].p.clone();
  let maxDist = 0;
  for (const item of items) maxDist = Math.max(maxDist, base.distanceTo(item.p));
  if (maxDist > Math.max(...items.map((item) => item.seg.diameter)) * 4) return null;
  return items.reduce((acc, item) => acc.add(item.p), new THREE.Vector3()).multiplyScalar(1 / items.length);
}

export function buildInputXmlNodeGraph() {
  const all = allIndexNodes().filter((node) => isInputXmlNode(node));
  const components = all.filter((node) => !isSupportNode(node));
  const supports = all.filter(isSupportNode);
  const edges = [];
  let skippedNoNodeEdge = 0;
  let skippedNoGeometry = 0;

  components.forEach((node, index) => {
    const a = node.attributes || {};
    if (!hasInputXmlNodeEdge(node)) {
      skippedNoNodeEdge += 1;
      return;
    }
    const p0 = inputXmlPoint(a.APOS || a.HPOS || a.POS || a.LBOP);
    const p1 = inputXmlPoint(a.LPOS || a.TPOS || a.POS2 || a.LBOS);
    if (!p0 || !p1 || p0.distanceTo(p1) < 1e-6) {
      skippedNoGeometry += 1;
      return;
    }
    const d = bore(a);
    const fromNode = nodeKey(a.FROM_NODE, `P0:${key(p0)}`);
    const toNode = nodeKey(a.TO_NODE, `P1:${key(p1)}`);
    edges.push({
      node,
      attrs: a,
      index,
      p0,
      p1,
      fromNode,
      toNode,
      diameter: d,
      radius: d * 0.5,
      length: p0.distanceTo(p1),
      sourceType: up(a.TYPE || a.RAW_TYPE || node.type),
      sourceBend: ['BEND', 'ELBO', 'ELBOW'].includes(up(a.TYPE || a.RAW_TYPE || node.type)),
    });
  });

  const byNode = new Map();
  const nodePoints = new Map();
  edges.forEach((seg) => {
    addEndpoint(byNode, seg.fromNode, seg, 'p0', seg.p0);
    addEndpoint(byNode, seg.toNode, seg, 'p1', seg.p1);
  });
  byNode.forEach((items, id) => {
    const p = sameNodePoint(items) || items[0]?.p?.clone?.() || null;
    if (p) nodePoints.set(id, p);
  });

  const graph = {
    kind: 'INPUTXML_NODE_GRAPH_V1',
    edges,
    supports,
    byNode,
    nodePoints,
    stats: {
      totalInputXmlComponents: components.length,
      totalInputXmlSupports: supports.length,
      routeSegments: edges.length,
      skippedNoNodeEdge,
      skippedNoGeometry,
    },
  };
  try { state.rvm[INPUTXML_NODE_GRAPH_KEY] = graph; } catch {}
  return graph;
}

export function currentInputXmlNodeGraph() {
  return state?.rvm?.[INPUTXML_NODE_GRAPH_KEY] || buildInputXmlNodeGraph();
}

function shouldGenerateBendAtNode(items) {
  if (items.length !== 2) return false;
  const [a, b] = items;
  if (a.seg === b.seg) return false;
  // Source BEND/ELBOW edges already represent the bend intent. Do not create one at both ends.
  if (isSourceBend(a.seg) || isSourceBend(b.seg)) return false;
  return true;
}

export function applyInputXmlAutoBendGraphics(viewer, options = {}) {
  if (!viewer?.scene || !viewer?.modelGroup || !isInputXmlRvmModel()) return null;
  const enabled = options.autoBendEnabled ?? autoBendEnabled();
  removeRoot(viewer.scene, INPUTXML_AUTO_BEND_ROOT);
  if (!enabled) {
    hideOriginalInputXmlModel(viewer, false);
    return { enabled: false, created: 0 };
  }
  const graph = buildInputXmlNodeGraph();
  const segs = graph.edges;
  const root = new THREE.Group();
  root.name = INPUTXML_AUTO_BEND_ROOT;
  root.userData.inputXmlAutoBendGraphics = true;

  const trimStart = new Map();
  const trimEnd = new Map();
  let bends = 0;
  let sourceBendEdges = 0;
  let skippedJunctions = 0;
  let skippedRemoteNode = 0;
  let skippedUnsafeTrim = 0;
  let skippedSourceBendAdjacency = 0;
  let nodeMarkers = 0;

  graph.byNode.forEach((items, id) => {
    const corner = graph.nodePoints.get(id) || sameNodePoint(items);
    if (items.length !== 2) {
      skippedJunctions += items.length > 2 ? 1 : 0;
      if (corner && items.length > 2) {
        const dia = Math.min(...items.map((item) => item.seg.diameter).filter(Number.isFinite));
        root.add(makeNodeMarker(corner, Math.max((dia || 50) * 0.5, 3), `INPUTXML_JUNCTION_${id}`));
        nodeMarkers += 1;
      }
      return;
    }
    if (!shouldGenerateBendAtNode(items)) {
      if (items.some((item) => isSourceBend(item.seg))) skippedSourceBendAdjacency += 1;
      return;
    }
    const [a, b] = items;
    if (!corner) {
      skippedRemoteNode += 1;
      return;
    }
    const da = outwardDirection(a);
    const db = outwardDirection(b);
    if (Math.abs(da.dot(db)) > 0.985) return;
    const dia = Math.min(a.seg.diameter, b.seg.diameter);
    const bendRadius = Math.max(dia * 1.5, dia * 0.75);
    const pipeR = Math.max(dia * 0.5, 1);
    const maxTrimA = Math.max(a.seg.length * 0.42, pipeR * 0.5);
    const maxTrimB = Math.max(b.seg.length * 0.42, pipeR * 0.5);
    const bend = makeArc(da, db, corner, bendRadius, pipeR, BEND_MAT, `INPUTXML_AUTO_BEND_${bends + 1}`, maxTrimA, maxTrimB);
    if (!bend) {
      skippedUnsafeTrim += 1;
      root.add(makeNodeMarker(corner, pipeR, `INPUTXML_MITER_NODE_${id}`));
      nodeMarkers += 1;
      return;
    }
    bends += 1;
    root.add(bend.mesh);
    if (a.endName === 'p0') trimStart.set(a.seg, bend.p1); else trimEnd.set(a.seg, bend.p1);
    if (b.endName === 'p0') trimStart.set(b.seg, bend.p2); else trimEnd.set(b.seg, bend.p2);
  });

  let pipes = 0;
  for (const seg of segs) {
    const a = trimStart.get(seg) || seg.p0;
    const b = trimEnd.get(seg) || seg.p1;
    if (a.distanceTo(b) < 1e-3) continue;
    const material = isSourceBend(seg) ? SOURCE_BEND_MAT : PIPE_MAT;
    if (isSourceBend(seg)) sourceBendEdges += 1;
    const mesh = cylinderBetween(a, b, Math.max(seg.radius, 1), material, `INPUTXML_PIPE_${seg.fromNode}_TO_${seg.toNode}`, seg.attrs);
    if (mesh) { root.add(mesh); pipes += 1; }
  }
  viewer.scene.add(root);
  hideOriginalInputXmlModel(viewer, true);
  viewer.inputXmlAutoBendDiagnostics = {
    enabled: true,
    pipes,
    bends,
    routeSegments: segs.length,
    sourceBendEdges,
    skippedNoNodeEdge: graph.stats.skippedNoNodeEdge || 0,
    skippedNoGeometry: graph.stats.skippedNoGeometry || 0,
    totalInputXmlComponents: graph.stats.totalInputXmlComponents || segs.length,
    totalInputXmlSupports: graph.stats.totalInputXmlSupports || 0,
    skippedJunctions,
    skippedRemoteNode,
    skippedUnsafeTrim,
    skippedSourceBendAdjacency,
    nodeMarkers,
    labelPolicy: 'PIPE_ONLY_NODE_GRAPH_SOURCE_BEND_SAFE',
  };
  return viewer.inputXmlAutoBendDiagnostics;
}

function makeAxisLabel(text, color, p) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#08101c'; ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = color; ctx.font = 'bold 20px system-ui'; ctx.fillText(text, 20, 23);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sp = new THREE.Sprite(mat); sp.position.copy(p); sp.scale.set(70, 35, 1);
  return sp;
}
export function applyCanvasAxisTriad(viewer) {
  if (!viewer?.scene) return null;
  removeRoot(viewer.scene, INPUTXML_AXIS_ROOT);
  if (!axisVisible()) return null;
  const root = new THREE.Group(); root.name = INPUTXML_AXIS_ROOT; root.userData.canvasAxisTriad = true;
  const len = 320;
  const origin = new THREE.Vector3(0, 0, 0);
  const axes = [
    ['X', 0xff5555, new THREE.Vector3(1, 0, 0)],
    ['Y', 0x55ff77, new THREE.Vector3(0, 1, 0)],
    ['Z', 0x55aaff, new THREE.Vector3(0, 0, 1)],
  ];
  axes.forEach(([label, color, dir]) => {
    const end = dir.clone().multiplyScalar(len);
    const line = cylinderBetween(origin, end, 8, new THREE.MeshBasicMaterial({ color }), `AXIS_${label}`);
    if (line) root.add(line);
    root.add(makeAxisLabel(label, `#${color.toString(16).padStart(6, '0')}`, end.clone().multiplyScalar(1.12)));
  });
  viewer.scene.add(root);
  return root;
}
export function refreshInputXmlGraphics(viewer, options = {}) {
  const support = applyInputXmlAutoBendGraphics(viewer, options);
  const axis = applyCanvasAxisTriad(viewer);
  return { support, axis };
}
