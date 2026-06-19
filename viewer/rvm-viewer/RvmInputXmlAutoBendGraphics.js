import * as THREE from 'three';
import { state } from '../core/state.js';

const ROOT_NAME = '__RVM_INPUTXML_AUTO_BEND_GRAPHICS__';
const AXIS_NAME = '__RVM_CANVAS_AXIS_TRIAD__';
const PIPE_MAT = new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.62, metalness: 0.08 });
const BEND_MAT = new THREE.MeshStandardMaterial({ color: 0x9c4c9f, roughness: 0.6, metalness: 0.06 });
const TOL = 1e-3;

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
function cylinderBetween(a, b, radius, material, name) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 24), material);
  mesh.name = name || 'INPUTXML_PIPE';
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.userData = { inputXmlAutoBend: true, kind: 'PIPE', attributes: { TYPE: 'PIPE', AUTO_BEND_GRAPHICS: 'true' } };
  return mesh;
}
function makeArc(fromDir, toDir, corner, radius, pipeRadius, material, name) {
  const d1 = fromDir.clone().normalize();
  const d2 = toDir.clone().normalize();
  if (Math.abs(d1.dot(d2)) > 0.985) return null;
  const p1 = corner.clone().add(d1.clone().multiplyScalar(radius));
  const p2 = corner.clone().add(d2.clone().multiplyScalar(radius));
  const pts = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const v = d1.clone().lerp(d2, t).normalize();
    // Quadratic blend approximates elbow centreline without assuming a fixed plane basis.
    pts.push(corner.clone().add(v.multiplyScalar(radius)));
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
  return nodes()
    .filter((node) => isInputXmlNode(node) && !isSupportNode(node))
    .map((node, index) => {
      const a = node.attributes || {};
      const p0 = point(a.APOS || a.HPOS || a.POS);
      const p1 = point(a.LPOS || a.TPOS || a.POS2);
      if (!p0 || !p1 || p0.distanceTo(p1) < 1e-6) return null;
      const d = bore(a);
      return { node, attrs: a, index, p0, p1, diameter: d, radius: d * 0.5 };
    })
    .filter(Boolean);
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
  const byEnd = new Map();
  segs.forEach((seg) => {
    for (const [endName, p] of [['p0', seg.p0], ['p1', seg.p1]]) {
      const k = key(p);
      if (!byEnd.has(k)) byEnd.set(k, []);
      byEnd.get(k).push({ seg, endName, p });
    }
  });
  const trimStart = new Map();
  const trimEnd = new Map();
  let bends = 0;
  byEnd.forEach((items) => {
    if (items.length !== 2) return;
    const [a, b] = items;
    const da = (a.endName === 'p0' ? a.seg.p1.clone().sub(a.seg.p0) : a.seg.p0.clone().sub(a.seg.p1)).normalize();
    const db = (b.endName === 'p0' ? b.seg.p1.clone().sub(b.seg.p0) : b.seg.p0.clone().sub(b.seg.p1)).normalize();
    if (Math.abs(da.dot(db)) > 0.985) return;
    const dia = Math.min(a.seg.diameter, b.seg.diameter);
    const r = Math.max(dia * 1.5, dia * 0.75);
    const pipeR = Math.max(dia * 0.5, 1);
    const bend = makeArc(da, db, a.p, r, pipeR, BEND_MAT, `INPUTXML_AUTO_BEND_${bends + 1}`);
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
    const mesh = cylinderBetween(a, b, Math.max(seg.radius, 1), PIPE_MAT, `INPUTXML_PIPE_${seg.index + 1}`);
    if (mesh) { root.add(mesh); pipes += 1; }
  }
  viewer.scene.add(root);
  hideOriginalInputXmlModel(viewer, true);
  viewer.inputXmlAutoBendDiagnostics = { enabled: true, pipes, bends, segments: segs.length, labelPolicy: 'PIPE_ONLY' };
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
