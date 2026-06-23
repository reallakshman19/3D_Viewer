import * as THREE from 'three';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260622-rvm-leaf-picking-2';

export const RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA = 'rvm-non-primitive-support-overlay/v1';

const ROOT_NAME = '__RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__';
const GLOBAL_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__';
const PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-support-overlay-v1');
const LOADER_PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-support-overlay-loader-v1');
const VIEWER_PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-support-overlay-viewer-v1');
const MAX_SUPPORT_OVERLAYS = 500;
const NON_PRIMITIVE_SOURCE_RE = /\.(json|jscon|uxml|inputxml|txt)$/i;
const RVM_SOURCE_RE = /\.(rvm|rev)$/i;
const SUPPORT_KIND_RE = /\b(GUIDE|LINE\s*STOP|LINESTOP|LIMIT\s*STOP|LIMIT|RESTING|REST|SHOE|ANCHOR|FIXED|STOPPER|STOP|SUPPORT|ATTA|ANCI|HANGER|SPRING)\b/i;
const SUPPORT_TAG_RE = /\bPS[-_\s]?[A-Z0-9][A-Z0-9._/\-]*\b/i;
const CHILD_KEYS = Object.freeze(['children', 'items', 'branches', 'nodes', 'hierarchy']);
const COORD_KEYS = Object.freeze(['SUPPORTCOORD', 'SUPPORT_COORD', 'SCOORD', 'POS', 'POSITION', 'COORDS', 'CO_ORDS', 'CO_ORD', 'BPOS', 'BP', 'APOS', 'LPOS']);

export function installRvmNonPrimitiveSupportOverlayBridge() {
  if (globalThis[PATCH_FLAG]) return;
  globalThis[PATCH_FLAG] = true;
  globalThis[GLOBAL_KEY] = {
    schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA,
    rootName: ROOT_NAME,
    applyFromSource,
    clear,
    collect: collectNonPrimitiveSupportRecords,
    isNonPrimitiveSource,
  };
  patchAvevaJsonLoaderForNonPrimitiveSource();
  patchRvmViewerSetModelForNonPrimitiveOverlay();
}

function patchAvevaJsonLoaderForNonPrimitiveSource() {
  const proto = AvevaJsonLoader?.prototype;
  if (!proto || proto[LOADER_PATCH_FLAG] || typeof proto.load !== 'function') return;
  const originalLoad = proto.load;
  proto.load = async function loadWithNonPrimitiveOverlaySource(source, ...args) {
    const payload = await originalLoad.call(this, source, ...args);
    const scene = payload?.gltf?.scene;
    if (scene?.userData && source) {
      scene.userData.__rvmNonPrimitiveSourceHierarchy = source;
      scene.userData.__rvmNonPrimitiveSourceKind = 'source-preview';
      scene.userData.__rvmNonPrimitiveSupportOverlaySchema = RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA;
    }
    return payload;
  };
  proto[LOADER_PATCH_FLAG] = true;
}

function patchRvmViewerSetModelForNonPrimitiveOverlay() {
  const proto = RvmViewer3D?.prototype;
  if (!proto || proto[VIEWER_PATCH_FLAG] || typeof proto.setModel !== 'function') return;
  const originalSetModel = proto.setModel;
  proto.setModel = function setModelWithNonPrimitiveSupportOverlay(model, upAxis = 'Y') {
    const result = originalSetModel.call(this, model, upAxis);
    const source = model?.userData?.__rvmNonPrimitiveSourceHierarchy;
    const sourceKind = model?.userData?.__rvmNonPrimitiveSourceKind;
    if (source) applyFromSource({ viewer: this, source, sourceKind });
    else clear(this, 'primitive-rvm-or-no-source-hierarchy');
    return result;
  };
  proto[VIEWER_PATCH_FLAG] = true;
}

export function applyFromSource({ viewer, root, source, sourceKind = '', fileName = '' } = {}) {
  const kind = normalizeSourceKind(sourceKind, fileName, root);
  if (!viewer?.scene || !viewer?.modelGroup) return { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'blocked', reason: 'viewer-missing', created: 0 };
  if (!isNonPrimitiveSource({ sourceKind: kind, fileName })) {
    clear(viewer, 'rvm-or-unsupported-source');
    return { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'skipped', reason: 'rvm-or-unsupported-source', sourceKind: kind, created: 0 };
  }

  const records = collectNonPrimitiveSupportRecords(source).slice(0, MAX_SUPPORT_OVERLAYS);
  clear(viewer, 'before-non-primitive-overlay');
  if (!records.length) {
    const diagnostics = { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'empty', sourceKind: kind, sourceFile: fileName, created: 0, sourceSupports: 0 };
    viewer.nonPrimitiveSupportOverlayDiagnostics = diagnostics;
    return diagnostics;
  }

  viewer.modelGroup.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(viewer.modelGroup);
  const size = box.isEmpty() ? 1000 : Math.max(box.getSize(new THREE.Vector3()).length(), 1);
  const glyphSize = Math.max(6, Math.min(80, size * 0.004));
  const overlayRoot = new THREE.Group();
  overlayRoot.name = ROOT_NAME;
  overlayRoot.userData = {
    schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA,
    nonPrimitiveSupportOverlay: true,
    sourceKind: kind,
    sourceFile: fileName,
    pickable: false,
  };

  const seen = new Set();
  for (const record of records) {
    const key = `${record.tag}:${record.kind}:${record.local.x.toFixed(1)}:${record.local.y.toFixed(1)}:${record.local.z.toFixed(1)}`.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const object = makeSupportGlyph(record, viewer, glyphSize, kind, fileName);
    if (object) overlayRoot.add(object);
  }

  if (overlayRoot.children.length) viewer.scene.add(overlayRoot);
  const diagnostics = {
    schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA,
    status: overlayRoot.children.length ? 'applied' : 'empty',
    sourceKind: kind,
    sourceFile: fileName,
    created: overlayRoot.children.length,
    sourceSupports: records.length,
    maxSupportOverlays: MAX_SUPPORT_OVERLAYS,
    rvmExcluded: true,
  };
  viewer.nonPrimitiveSupportOverlayDiagnostics = diagnostics;
  return diagnostics;
}

export function clear(viewer, reason = 'clear') {
  let removed = 0;
  const removeFrom = (parent) => {
    const nodes = [];
    parent?.traverse?.((obj) => { if (obj?.name === ROOT_NAME || obj?.userData?.nonPrimitiveSupportOverlay) nodes.push(obj); });
    for (const node of nodes) {
      if (node.parent) node.parent.remove(node);
      disposeObjectTree(node);
      removed += 1;
    }
  };
  removeFrom(viewer?.scene);
  removeFrom(viewer?.modelGroup);
  if (viewer) viewer.nonPrimitiveSupportOverlayDiagnostics = { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'cleared', reason, removed };
  return { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'cleared', reason, removed };
}

export function isNonPrimitiveSource({ sourceKind = '', fileName = '' } = {}) {
  const kind = String(sourceKind || '').toLowerCase();
  const name = String(fileName || '');
  if (kind === 'rvm' || RVM_SOURCE_RE.test(name)) return false;
  if (kind === 'json' || kind === 'jscon' || kind === 'uxml' || kind === 'inputxml' || kind === 'txt' || kind === 'source-preview') return true;
  return NON_PRIMITIVE_SOURCE_RE.test(name);
}

export function collectNonPrimitiveSupportRecords(source, out = []) {
  const roots = Array.isArray(source) ? source : [source];
  for (const node of roots) collectNode(node, out);
  return out;
}

function collectNode(node, out) {
  if (!node || typeof node !== 'object' || out.length >= MAX_SUPPORT_OVERLAYS) return;
  const a = attrs(node);
  const text = supportText(node, a);
  const sourceType = String(node.type || node.kind || a.TYPE || a.RAW_TYPE || '').toUpperCase();
  const isPipeLike = /^(PIPE|BRAN|BRANCH|PIPING)$/i.test(sourceType);
  const matched = !isPipeLike && (/\b(SUPPORT|ATTA|ANCI|PIPE_SUPPORT|PIPESUPPORT)\b/i.test(text) || SUPPORT_KIND_RE.test(text));
  if (matched) {
    const supportKind = supportKindFromText(text);
    const local = coordinateFromAttributes(a);
    if (supportKind && local) out.push({ source: node, attrs: a, kind: supportKind, local, tag: supportTag(node, a), axis: pipeAxisFromAttributes(a) });
  }
  for (const key of CHILD_KEYS) {
    const children = node[key];
    if (Array.isArray(children)) for (const child of children) collectNode(child, out);
  }
}

function makeSupportGlyph(record, viewer, glyphSize, sourceKind, sourceFile) {
  const local = record.local.clone();
  const world = viewer.modelGroup.localToWorld(local);
  const axis = record.axis?.clone?.() || new THREE.Vector3(1, 0, 0);
  axis.transformDirection?.(viewer.modelGroup.matrixWorld);
  if (axis.lengthSq() <= 1e-9) axis.set(1, 0, 0);
  axis.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  let side = new THREE.Vector3().crossVectors(axis, up);
  if (side.lengthSq() <= 1e-9) side.set(0, 0, 1);
  side.normalize();

  const points = [];
  const addLine = (a, b) => { points.push(a.x, a.y, a.z, b.x, b.y, b.z); };
  const addCentered = (direction, half) => addLine(world.clone().add(direction.clone().multiplyScalar(-half)), world.clone().add(direction.clone().multiplyScalar(half)));
  addCentered(up, glyphSize * 0.35);
  if (record.kind === 'GUIDE') addCentered(side, glyphSize * 0.9);
  else if (record.kind === 'LINESTOP' || record.kind === 'LIMIT') addCentered(axis, glyphSize * 0.9);
  else if (record.kind === 'ANCHOR') { addCentered(axis, glyphSize * 0.75); addCentered(side, glyphSize * 0.75); }
  else if (record.kind === 'SPRING' || record.kind === 'HANGER') addLine(world, world.clone().add(up.clone().multiplyScalar(glyphSize * 1.1)));
  else addCentered(side, glyphSize * 0.35);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x60c864, depthTest: true, transparent: true, opacity: 0.95 });
  const line = new THREE.LineSegments(geometry, material);
  line.name = `NON_PRIMITIVE_SUPPORT_OVERLAY_${record.tag}_${record.kind}`;
  line.userData = {
    schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA,
    nonPrimitiveSupportOverlay: true,
    supportOverlayOnly: true,
    supportKind: record.kind,
    supportTag: record.tag,
    sourceKind,
    sourceFile,
    pickable: false,
    selectable: false,
    attributes: { ...record.attrs },
  };
  return line;
}

function attrs(node) { return { ...(node.attributes || {}), ...(node.attrs || {}), ...(node.rawAttributes || {}) }; }
function textValue(value) { return value === undefined || value === null ? '' : String(value); }
function supportText(node, a) {
  return [node.type, node.kind, node.name, node.path, node.id, a.TYPE, a.STYP, a.DTXR, a.SUPPORT_TYPE, a.CMPSUPTYPE, a.MDSSUPPTYPE, a.CMPSUPREFN, a.SUPPORT_TAG, a.NAME, a.TAG, a.TAGNO, a.SKEY, a.SPRE, a.DESCRIPTION, a.DESC].map(textValue).join(' ');
}
function numberValue(value) {
  const n = Number.parseFloat(textValue(value).replace(/mm/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}
function parseVec3(value) {
  if (!value && value !== 0) return null;
  if (Array.isArray(value) && value.length >= 3) {
    const x = numberValue(value[0]), y = numberValue(value[1]), z = numberValue(value[2]);
    return x === null || y === null || z === null ? null : new THREE.Vector3(x, y, z);
  }
  if (typeof value === 'object') {
    const x = numberValue(value.x ?? value.X), y = numberValue(value.y ?? value.Y), z = numberValue(value.z ?? value.Z);
    return x === null || y === null || z === null ? null : new THREE.Vector3(x, y, z);
  }
  const text = textValue(value).trim();
  const directional = text.match(/\b([EWNSUD])\s*(-?\d+(?:\.\d+)?)/gi);
  if (directional?.length >= 3) {
    const out = new THREE.Vector3();
    for (const entry of directional) {
      const [, dir, raw] = /([EWNSUD])\s*(-?\d+(?:\.\d+)?)/i.exec(entry) || [];
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      if (/E/i.test(dir)) out.x = n;
      else if (/W/i.test(dir)) out.x = -n;
      else if (/N/i.test(dir)) out.y = n;
      else if (/S/i.test(dir)) out.y = -n;
      else if (/U/i.test(dir)) out.z = n;
      else if (/D/i.test(dir)) out.z = -n;
    }
    return out;
  }
  const values = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return values.length >= 3 ? new THREE.Vector3(values[0], values[1], values[2]) : null;
}
function coordinateFromAttributes(a) {
  for (const key of COORD_KEYS) {
    const pt = parseVec3(a[key]);
    if (pt) return pt;
  }
  return null;
}
function pipeAxisFromAttributes(a) {
  const ap = parseVec3(a.APOS);
  const lp = parseVec3(a.LPOS);
  if (ap && lp) {
    const delta = new THREE.Vector3().subVectors(lp, ap);
    if (delta.lengthSq() > 1e-9) return delta.normalize();
  }
  return new THREE.Vector3(1, 0, 0);
}
function supportKindFromText(text = '') {
  const upper = String(text || '').toUpperCase();
  if (/LINE\s*STOP|LINESTOP|STOPPER|\bSTOP\b/.test(upper)) return 'LINESTOP';
  if (/LIMIT\s*STOP|\bLIMIT\b|\bLIM\b/.test(upper)) return 'LIMIT';
  if (/\bGUIDE\b|\bGDE\b|\bGUI\b|\bPG[-_]|\bGT\d/.test(upper)) return 'GUIDE';
  if (/\bANCHOR\b|\bFIXED\b|\bAN\d|\bANC\b/.test(upper)) return 'ANCHOR';
  if (/\bSPRING\b|\bHANGER\b/.test(upper)) return 'SPRING';
  if (/\bREST\b|\bRESTING\b|\bSHOE\b|\bBASE\s*PLATE\b|\bBP[-_]|\bBT\d/.test(upper)) return 'REST';
  return SUPPORT_KIND_RE.test(upper) ? 'SUPPORT' : '';
}
function supportTag(node, a) {
  for (const value of [a.SUPPORT_TAG, a.CMPSUPREFN, a.NAME, a.TAG, a.TAGNO, a.REF, a.REFNO, a.DBREF, a.SKEY, a.SPRE, a.DESCRIPTION, a.DESC, node?.name, node?.id]) {
    const match = SUPPORT_TAG_RE.exec(textValue(value));
    if (match) return match[0].replace(/\s+/g, '-');
  }
  return textValue(a.CMPSUPREFN || a.SUPPORT_TAG || a.NAME || node?.name || node?.id || 'SUPPORT').slice(0, 64);
}
function normalizeSourceKind(sourceKind, fileName, root) {
  const kind = String(sourceKind || root?.dataset?.rvmLoadedSourceKind || '').toLowerCase();
  if (kind) return kind;
  const name = String(fileName || '').toLowerCase();
  if (/\.jscon$/i.test(name)) return 'jscon';
  if (/\.uxml(\.json)?$/i.test(name) || /\.inputxml$/i.test(name)) return 'inputxml';
  if (/\.txt$/i.test(name)) return 'txt';
  if (/\.json$/i.test(name)) return 'json';
  if (RVM_SOURCE_RE.test(name)) return 'rvm';
  return '';
}
function disposeObjectTree(root) {
  root?.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material].filter(Boolean);
    for (const material of materials) material?.dispose?.();
  });
}
