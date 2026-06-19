import * as THREE from 'three';
import { state } from '../core/state.js';

const ROOT_NAME = '__RVM_INPUTXML_AUTO_BEND_GRAPHICS__';
const AXIS_NAME = '__RVM_CANVAS_AXIS_TRIAD__';
const PIPE_MAT = new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.62, metalness: 0.08 });
const BEND_MAT = new THREE.MeshStandardMaterial({ color: 0x9c4c9f, roughness: 0.6, metalness: 0.06 });
const TOL = 1e-3;
const ROUTE_TYPES = new Set(['PIPE', 'BEND', 'ELBO', 'ELBOW']);

function s(v) { return v == null ? '' : String(v); }
function up(v) { return s(v).trim().toUpperCase(); }
function n(v, fallback = NaN) {
  const x = Number.parseFloat(s(v).replace(/mm/ig, '').replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : fallback;
}
function isInputXmlNode(node) {
  const a = node?.attributes || {};
  return /INPUTXML/i.test([node?.name, node?.canonicalObjectId, a.SOURCE_FORMAT, a.SOURCE_CONVERTER, a.SOURCE_FILE, a.NAME, a.REF].map(s).join(' '));
}
function isSupportNode(node) {
  const a = node?.attributes || {};
  const t = up(node?.kind || node?.type || a.TYPE || a.RAW_TYPE);
  return ['ATTA', 'ANCI', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT'].includes(t);
}
function isRouteCarrier(node) {
  const a = node?.attributes || {};
  const type = up(node?.kind || node?.type || a.TYPE);
  const raw = up(a.RAW_TYPE || a.DTXR || a.NAME || node?.name);
  if (ROUTE_TYPES.has(type)) return true;
  if (/\bPIPE\b|\bBEND\b|\bELBOW\b/.test(raw)) return true;
  return false;
}
function point(v) {
  if (!v && v !== 0) return null;
  if (Array.isArray(v) && v.length >= 3) {
    const p = new THREE.Vector3(n(v[0]), n(v[1]), n(v[2]));
    return [p.x, p.y, p.z].every(Number.isFinite) ? p : null;
  }
  if (typeof v === 'object') {
    const p = new THREE.Vector3(n(v.x ?? v.X), n(v.y ?? v.Y), n(v.z ?? v.Z));
    return [p.x, p.y, p.z].every(Number.isFinite) ? p : null;
  }
  const vals = s(v).match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return vals.length >= 3 ? new THREE.Vector3(vals[0], vals[1], vals[2]) : null;
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
function cylinderBetween(a, b, radius, material, name) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 24), material);
  mesh.name = name || 'INPUTXML_PIPE';
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.userData = { inputXmlAutoBend: true, kind: 'PIPE', attributes: { TYPE: 'PIPE', AUTO_BEND_GRAPHICS: 'true', LABEL_POLICY: 'PIPE_ONLY' } };
  return mesh;
}
function makeArc(fromDir, toDir, corner, radius, pipeRadius, material, name) {
  const d1 = fromDir.clone().normalize();
  const d2 = toDir.clone().normalize();
  const dot = THREE.MathUtils.clamp(d1.dot(d2), -1, 1);
  if (Math.abs(dot) > 0.985) return null;

  // Build a stable arc in the plane of the two segment directions.
  const normal = new THREE.Vector3().crossVectors(d1, d2);
  if (normal.lengthSq() < 1e-10) return null;
  normal.normalize();
  const angle = Math.acos(dot);
  const trim = Math.min(radius * Math.tan(angle / 2), radius * 2.5);
  const p1 = corner.clone().add(d1.clone().multiplyScalar(trim));
  const p2 = corner.clone().add(d2.clone().multiplyScalar(trim));
  const bisector = d1.clone().add(d2).normalize();
  if (bisector.lengthSq() < 1e-10) return null;
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
  mesh.userData = { inputXmlAutoBend: true, kind: 'BEND', attributes: { TYPE: 'PIPE', AUTO_BEND: '1.5D', LABEL_POLICY: 'PIPE_ONLY' } };
  return { mesh, p1, p2 };
}
function nodes() {
  return Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
}
function segments() {
  const all = nodes().filter((node) => isInputXmlNode(node) && !isSupportNode(node));
  const route = [];
  let skipped = 0;
  all.forEach((node, index) => {
    if (!isRouteCarrier(node)) {
      skipped += 1;
      return;
    }
    const a = node.attributes || {};
    const p0 = point(a.APOS || a.HPOS || a.POS);
    const p1 = point(a.LPOS || a.TPOS || a.POS2);
    if (!p0 || !p1 || p0.distanceTo(p1) < 1e-6) return;
    const d = bore(a);
    const fromNode = nodeKey(a.FROM_NODE, `P0:${key(p0)}`);
    const toNode = nodeKey(a.TO_NODE, `P1:${key(p1)}`);
    route.push({ node, attrs: a, index, p0, p1, fromNode, toNode, diameter: d, radius: d * 0.5 });
  });
  route.skippedNonRoute = skipped;
  route.totalInputXmlComponents = all.length;
  return route;
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
  return nodes().some(isInputXmlNode);
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
export function applyInputXmlAutoBendGraphics(viewer, options = {}) {
  if (!viewer?.scene || !viewer?.modelGroup || !isInputXmlRvmModel()) return null;
  const enabled = options.autoBendEnabled ?? autoBendEnabled();
  removeRoot(viewer.scene, ROOT_NAME);
  if (!enabled) {
    hideOriginalInputXmlModel(viewer, false);
    return { enabled: false, created: 0 };
  }
  const segs = segments();
  const root = new THREE.Group();
  root.name = ROOT_NAME;
  root.userData.inputXmlAutoBendGraphics = true;

  // Use InputXML node IDs first. This prevents unrelated branch geometry from
  // being joined only because coordinates are repeated or close after fitting
  // simplification. Coordinate fallback is only for segments missing node labels.
  const byNode = new Map();
  segs.forEach((seg) => {
    addEndpoint(byNode, seg.fromNode, seg, 'p0', seg.p0);
    addEndpoint(byNode, seg.toNode, seg, 'p1', seg.p1);
  });

  const trimStart = new Map();
  const trimEnd = new Map();
  let bends = 0;
  let skippedJunctions = 0;

  byNode.forEach((items) => {
    if (items.length !== 2) {
      skippedJunctions += items.length > 2 ? 1 : 0;
      return;
    }
    const [a, b] = items;
    if (a.seg === b.seg) return;
    const da = outwardDirection(a);
    const db = outwardDirection(b);
    if (Math.abs(da.dot(db)) > 0.985) return;
    // Both endpoints at the same InputXML node should have nearly the same point.
    // If not, use their midpoint as the bend corner but do not force a remote join.
    if (a.p.distanceTo(b.p) > Math.max(a.seg.diameter, b.seg.diameter) * 2.5) {
      skippedJunctions += 1;
      return;
    }
    const corner = a.p.clone().add(b.p).multiplyScalar(0.5);
    const dia = Math.min(a.seg.diameter, b.seg.diameter);
    const bendRadius = Math.max(dia * 1.5, dia * 0.75);
    const pipeR = Math.max(dia * 0.5, 1);
    const bend = makeArc(da, db, corner, bendRadius, pipeR, BEND_MAT, `INPUTXML_AUTO_BEND_${bends + 1}`);
    if (!bend) return;
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
    const mesh = cylinderBetween(a, b, Math.max(seg.radius, 1), PIPE_MAT, `INPUTXML_PIPE_${seg.fromNode}_TO_${seg.toNode}`);
    if (mesh) { root.add(mesh); pipes += 1; }
  }
  viewer.scene.add(root);
  hideOriginalInputXmlModel(viewer, true);
  viewer.inputXmlAutoBendDiagnostics = {
    enabled: true,
    pipes,
    bends,
    routeSegments: segs.length,
    skippedNonRoute: segs.skippedNonRoute || 0,
    totalInputXmlComponents: segs.totalInputXmlComponents || segs.length,
    skippedJunctions,
    labelPolicy: 'PIPE_ONLY',
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
  removeRoot(viewer.scene, AXIS_NAME);
  if (!axisVisible()) return null;
  const root = new THREE.Group(); root.name = AXIS_NAME; root.userData.canvasAxisTriad = true;
  const len = 320;
  const origin = new THREE.Vector3(0, 0, 0);
  const axes = [
    ['X', 0xff5555, new THREE.Vector3(1, 0, 0)],
    ['Y', 0x55ff77, new THREE.Vector3(0, 1, 0)],
    ['Z', 0x5599ff, new THREE.Vector3(0, 0, 1)],
  ];
  axes.forEach(([name, color, dir]) => {
    const arrow = new THREE.ArrowHelper(dir, origin, len, color, 48, 24);
    root.add(arrow);
    root.add(makeAxisLabel(name, `#${color.toString(16).padStart(6, '0')}`, dir.clone().multiplyScalar(len + 45)));
  });
  viewer.scene.add(root);
  return root;
}
export function refreshInputXmlGraphics(viewer, options = {}) {
  const bend = applyInputXmlAutoBendGraphics(viewer, options);
  const axis = applyCanvasAxisTriad(viewer);
  return { bend, axisVisible: Boolean(axis) };
}
