import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { state } from '../core/state.js';

const ROOT_NAME = '__RVM_SUPPORT_SYMBOLS__';
const TRUE_SUPPORT_TYPES = new Set(['ATTA', 'ANCI', 'SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT']);
const KIND_COLORS = { REST: 0x5ee56a, GUIDE: 0x42d7ff, LINESTOP: 0xffb347, LIMIT: 0xffb347, ANCHOR: 0xf266ff, SPRING: 0xff6fae };

function str(v) { if (v == null) return ''; if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch { return String(v); } }
function up(v) { return str(v).trim().toUpperCase(); }
function num(v, f = null) { const n = Number.parseFloat(String(v ?? '').replace(/mm/gi, '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : f; }

function coord(v) {
  if (!v && v !== 0) return null;
  if (Array.isArray(v) && v.length >= 3) {
    const p = new THREE.Vector3(num(v[0]), num(v[1]), num(v[2]));
    return [p.x, p.y, p.z].every(Number.isFinite) ? p : null;
  }
  if (typeof v === 'object') {
    const p = new THREE.Vector3(num(v.x ?? v.X), num(v.y ?? v.Y), num(v.z ?? v.Z));
    return [p.x, p.y, p.z].every(Number.isFinite) ? p : null;
  }
  const t = String(v || '').trim().split(/\s+/g);
  const d = new THREE.Vector3(0, 0, 0);
  let ok = false;
  for (let i = 0; i < t.length - 1; i += 2) {
    const a = t[i].toUpperCase(); const n = num(t[i + 1]);
    if (!Number.isFinite(n)) continue;
    if (a === 'E') { d.x = n; ok = true; }
    else if (a === 'W') { d.x = -n; ok = true; }
    else if (a === 'N') { d.y = n; ok = true; }
    else if (a === 'S') { d.y = -n; ok = true; }
    else if (a === 'U') { d.z = n; ok = true; }
    else if (a === 'D') { d.z = -n; ok = true; }
  }
  if (ok) return d;
  const vals = String(v || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return vals.length >= 3 ? new THREE.Vector3(vals[0], vals[1], vals[2]) : null;
}

function supportPoint(a) {
  for (const k of ['SUPPORTCOORD', 'SUPPORT_COORD', 'SCOORD', 'SUPPORT_POINT', 'SUPPORT_POS', 'LBOP', 'LBOS', 'POS', 'POSITION']) {
    const p = coord(a[k]); if (p) return p;
  }
  return null;
}

function axis(v) {
  const s = up(v).replace(/[^A-Z]/g, '');
  if (s.includes('X')) return new THREE.Vector3(1, 0, 0);
  if (s.includes('Y')) return new THREE.Vector3(0, 1, 0);
  if (s.includes('Z')) return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(1, 0, 0);
}

function ortho(t) {
  const c = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0));
  return c.lengthSq() > 1e-8 ? c.normalize() : new THREE.Vector3(0, 0, 1);
}

function guideAxes(t) {
  const ax = Math.abs(t.x), ay = Math.abs(t.y), az = Math.abs(t.z);
  if (ax >= ay && ax >= az) return [new THREE.Vector3(0, 0, 1)];
  if (az >= ax && az >= ay) return [new THREE.Vector3(1, 0, 0)];
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
}

function kind(a) {
  const txt = [a.SUPPORT_KIND, a.SUPPORT_MAPPER_KIND, a.SUPPORT_TYPE, a.CMPSUPTYPE, a.MDSSUPPTYPE, a.SKEY, a.SPRE, a.DTXR, a.NAME, a.SUPPORT_TAG].map(up).join(' ');
  if (/GUIDE|\bGDE\b|\bGUI\b|\bPG[-_ ]|\bGT0[1-4]\b/.test(txt)) return 'GUIDE';
  if (/LINE\s*STOP|LINESTOP|STOPPER|\bLS[-_ ]|\bST0[6-8]\b/.test(txt)) return 'LINESTOP';
  if (/LIMIT/.test(txt)) return 'LIMIT';
  if (/ANCHOR|FIXED/.test(txt)) return 'ANCHOR';
  if (/SPRING|HANGER/.test(txt)) return 'SPRING';
  return 'REST';
}

function isInputXmlSupport(n) {
  const a = n?.attributes || {};
  const type = up(n?.type || n?.kind || a.TYPE || a.RAW_TYPE);
  if (!TRUE_SUPPORT_TYPES.has(type)) return false;
  return /INPUTXML/i.test([n?.name, n?.canonicalObjectId, a.SOURCE_FORMAT, a.SOURCE_CONVERTER, a.SOURCE_FILE, a.SOURCE_RESTRAINT_ID, a.NAME, a.SUPPORT_TAG].map(str).join(' ')) || Boolean(a.SOURCE_RESTRAINT_ID);
}

function inputXmlSupportNodes() {
  const nodes = Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
  return nodes.filter(isInputXmlSupport);
}

function hasInputXmlModel() {
  const nodes = Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
  return nodes.some((n) => /INPUTXML/i.test([n?.name, n?.canonicalObjectId, n?.attributes?.SOURCE_FORMAT, n?.attributes?.SOURCE_CONVERTER, n?.attributes?.SOURCE_FILE].map(str).join(' ')));
}

function mat(color) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.98, depthTest: true }); }
function orientY(mesh, dir) { mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); }

function arrow(tip, away, len, r, color, name) {
  const dir = away.clone().normalize();
  const g = new THREE.Group(); g.name = name;
  const m = mat(color);
  const shaftLen = len * 0.72; const headLen = len * 0.28;
  const start = tip.clone().add(dir.clone().multiplyScalar(len));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, shaftLen, 12), m);
  shaft.position.copy(start.clone().add(dir.clone().multiplyScalar(-shaftLen * 0.5)));
  orientY(shaft, dir.clone().multiplyScalar(-1));
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 3, headLen, 16), m);
  head.position.copy(tip.clone().add(dir.clone().multiplyScalar(headLen * 0.5)));
  orientY(head, dir.clone().multiplyScalar(-1));
  g.add(shaft, head);
  return g;
}

function addLabel(g, label, p, len, visible) {
  if (!visible || typeof document === 'undefined') return;
  const div = document.createElement('div');
  div.className = 'rvm-support-symbol-label rvm-inputxml-support-label';
  div.textContent = label;
  div.style.cssText = 'font:600 10px/1.2 system-ui,sans-serif;padding:2px 6px;border-radius:10px;background:rgba(8,16,28,.82);color:#e8f3ff;border:1px solid rgba(128,190,255,.45);white-space:nowrap;';
  const css = new CSS2DObject(div);
  css.userData.supportSymbolLabel = true;
  css.userData.supportSymbolLabelEligible = true;
  css.position.copy(p.clone().add(new THREE.Vector3(0, len * 0.55, 0)));
  g.add(css);
}

function removeOld(viewer) {
  const old = viewer?.scene?.getObjectByName(ROOT_NAME);
  if (!old) return;
  viewer.scene.remove(old);
  old.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.());
    if (o.element?.parentNode) o.element.parentNode.removeChild(o.element);
  });
}

function makeSymbol(node, index, viewer, options) {
  const a = node.attributes || {};
  const local = supportPoint(a); if (!local) return null;
  const p = viewer?.modelGroup ? viewer.modelGroup.localToWorld(local.clone()) : local;
  const k = kind(a);
  const tag = str(a.SUPPORT_TAG || a.CMPSUPREFN || a.NAME || a.REF || `SUPPORT-${index + 1}`);
  const t = axis(a.PIPE_AXIS || a.ROUTE_AXIS || a.SUPPORT_DIRECTION).normalize();
  const od = Math.max(num(a.ATTACHED_PIPE_OD || a.ATTACHED_PIPE_BORE || a.BORE, 100), 1);
  const gap = Math.max(num(a.SUPPORT_GAP_MM ?? a.GAP_MM ?? a.GAP, 0), 0);
  const mul = Math.max(0.25, Math.min(2, Number(options?.scaleMultiplier || 1)));
  const cr = od * 0.5;
  const len = Math.max(od * 0.55, 28) * mul;
  const rad = Math.max(od * 0.035, 1.2) * mul;
  const lane = Math.max(od * 2 / 3, 20) * mul;
  const color = KIND_COLORS[k] || KIND_COLORS.REST;
  const g = new THREE.Group();
  g.name = `SUPPORT_SYMBOL_${tag}`;
  g.userData = { supportSymbol: true, supportKind: k, supportTag: tag, inputXmlSupportGraphics: true, attributes: { ...a } };
  if (k === 'ANCHOR') {
    for (const ax of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
      g.add(arrow(p.clone().add(ax.clone().multiplyScalar(cr + gap)), ax, len, rad, color, `${tag}_ANCHOR_PLUS`));
      g.add(arrow(p.clone().add(ax.clone().multiplyScalar(-cr - gap)), ax.clone().multiplyScalar(-1), len, rad, color, `${tag}_ANCHOR_MINUS`));
    }
  } else if (k === 'GUIDE') {
    for (const ax of guideAxes(t)) {
      g.add(arrow(p.clone().add(ax.clone().multiplyScalar(cr + gap)), ax, len, rad, color, `${tag}_GUIDE_PLUS`));
      g.add(arrow(p.clone().add(ax.clone().multiplyScalar(-cr - gap)), ax.clone().multiplyScalar(-1), len, rad, color, `${tag}_GUIDE_MINUS`));
    }
  } else if (k === 'LINESTOP' || k === 'LIMIT') {
    const c = p.clone().add(ortho(t).multiplyScalar(lane));
    g.add(arrow(c.clone().add(t.clone().multiplyScalar(gap * 0.5)), t, len, rad, color, `${tag}_${k}_A`));
    g.add(arrow(c.clone().add(t.clone().multiplyScalar(-gap * 0.5)), t.clone().multiplyScalar(-1), len, rad, color, `${tag}_${k}_B`));
  } else {
    g.add(arrow(p.clone().add(new THREE.Vector3(0, -cr - gap, 0)), new THREE.Vector3(0, -1, 0), len, rad, color, `${tag}_REST_PLUS_Y`));
  }
  addLabel(g, k === 'REST' ? tag : `${tag} ${k}`, p, len, Boolean(options?.labelsVisible));
  return g;
}

export function applyInputXmlSupportGraphicsOverlay(viewer, options = {}) {
  if (!viewer?.scene || !viewer?.modelGroup || !hasInputXmlModel()) return null;
  const supports = inputXmlSupportNodes();
  removeOld(viewer);
  const root = new THREE.Group();
  root.name = ROOT_NAME;
  root.userData.supportSymbolRoot = true;
  root.userData.inputXmlSupportGraphics = true;
  supports.forEach((n, i) => { const s = makeSymbol(n, i, viewer, options); if (s) root.add(s); });
  viewer.scene.add(root);
  const counts = {};
  root.children.forEach((c) => { const k = c.userData?.supportKind || 'SUPPORT'; counts[k] = (counts[k] || 0) + 1; });
  viewer.supportSymbolDiagnostics = { created: root.children.length, scanned: supports.length, inputXmlSupportGraphics: true, kindCounts: counts, labelsVisible: Boolean(options.labelsVisible), scaleMultiplier: options.scaleMultiplier };
  return viewer.supportSymbolDiagnostics;
}
