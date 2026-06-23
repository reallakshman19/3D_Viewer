import * as THREE from 'three';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260622-rvm-leaf-picking-2';
import { readNonPrimitiveSupportOverlaySettings } from '../overlays/support/SupportOverlaySettings.js';
import {
  classifySupportFamily,
  extractExplicitSign,
  readRecordGapMm,
  resolveSupportSymbol,
  SUPPORT_FAMILIES,
} from '../overlays/support/NonPrimitiveSupportOverlayResolver.js';
import {
  collectSourcePipeSegments,
  createSupportCoordinateMapper,
  nodeIdFromAttrs,
  resolveSupportPipeAxis,
} from '../overlays/support/SupportOverlayCoordinateMapper.js';

export const RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA = 'rvm-non-primitive-support-overlay/v3';

const ROOT_NAME = '__RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__';
const GLOBAL_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__';
const PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-support-overlay-v3');
const LOADER_PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-support-overlay-loader-v3');
const VIEWER_PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-support-overlay-viewer-v3');
const MAX_SUPPORT_OVERLAYS = 500;
const NON_PRIMITIVE_SOURCE_RE = /\.(json|jscon|uxml|inputxml|txt)$/i;
const RVM_SOURCE_RE = /\.(rvm|rev)$/i;
const SUPPORT_KIND_RE = /\b(GUIDE|LINE\s*STOP|LINESTOP|LIMIT\s*STOP|LIMIT|LIM|RESTING|REST|HOLDDOWN|HOLD\s*DOWN|DOWNSTOP|SHOE|ANCHOR|FIXED|STOPPER|STOP|SUPPORT|ATTA|ANCI|HANGER|SPRING|CAN\s*SPRING|SPRING\s*CAN)\b/i;
const SUPPORT_TAG_RE = /\bPS[-_\s]?[A-Z0-9][A-Z0-9._/\-]*\b/i;
const CHILD_KEYS = Object.freeze(['children', 'items', 'branches', 'nodes', 'hierarchy']);
const COORD_KEYS = Object.freeze(['SUPPORTCOORD', 'SUPPORT_COORD', 'SCOORD', 'POS', 'POSITION', 'COORDS', 'CO_ORDS', 'CO_ORD', 'BPOS', 'BP', 'APOS', 'LPOS']);
const OD_KEYS = Object.freeze(['PIPE_OD_MM', 'PIPEODMM', 'PIPE_OD', 'OD_MM', 'OD', 'BORE_MM', 'BORE', 'NOMINAL_BORE']);
const BRANCH_KEYS = Object.freeze(['BRANCH', 'BRANCH_ID', 'BRANCHID', 'OWNER_BRANCH', 'OWNERBRANCH']);
const LINE_KEYS = Object.freeze(['LINE', 'LINE_NO', 'LINENO', 'LINE_NUMBER', 'LINENUMBER', 'LINEREF', 'PIPELINE']);

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

  const settings = readNonPrimitiveSupportOverlaySettings();
  if (!settings.enabled) {
    clear(viewer, 'non-primitive-support-overlay-disabled');
    return { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'disabled', sourceKind: kind, sourceFile: fileName, created: 0 };
  }

  const records = collectNonPrimitiveSupportRecords(source).slice(0, MAX_SUPPORT_OVERLAYS);
  const pipeSegments = collectSourcePipeSegments(source);
  clear(viewer, 'before-non-primitive-overlay');
  if (!records.length) {
    const diagnostics = { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, status: 'empty', sourceKind: kind, sourceFile: fileName, created: 0, sourceSupports: 0, sourcePipeSegments: pipeSegments.length, warnings: [] };
    viewer.nonPrimitiveSupportOverlayDiagnostics = diagnostics;
    return diagnostics;
  }

  viewer.modelGroup.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(viewer.modelGroup);
  const size = box.isEmpty() ? 1000 : Math.max(box.getSize(new THREE.Vector3()).length(), 1);
  const glyphSize = Math.max(6, Math.min(80, size * 0.004)) * (Number(settings.scale) || 1);
  const coordinateMapper = createSupportCoordinateMapper({
    sourceUnits: 'mm',
    viewerUnits: 'scene',
    modelRootMatrix: null,
    sceneScale: 1,
  });

  const overlayRoot = new THREE.Group();
  overlayRoot.name = ROOT_NAME;
  overlayRoot.userData = { schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA, nonPrimitiveSupportOverlay: true, sourceKind: kind, sourceFile: fileName, pickable: false };

  const seen = new Set();
  const warnings = [];
  const coordinateMappings = [];
  const pipeAxisResolutions = [];
  const byFamily = {};
  for (const record of records) {
    if (familyFilteredOut(settings, record.kind)) continue;
    const key = `${record.tag}:${record.kind}:${record.local.x.toFixed(1)}:${record.local.y.toFixed(1)}:${record.local.z.toFixed(1)}`.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const object = makeSupportGlyph(record, viewer, glyphSize, kind, fileName, settings, pipeSegments, coordinateMapper);
    if (!object) continue;
    overlayRoot.add(object);
    byFamily[record.kind] = (byFamily[record.kind] || 0) + 1;
    if (object.userData?.coordinateMapping) coordinateMappings.push(object.userData.coordinateMapping);
    if (object.userData?.pipeAxisResolution) pipeAxisResolutions.push(object.userData.pipeAxisResolution);
    for (const warning of object.userData?.warnings || []) warnings.push({ supportId: record.tag, family: record.kind, code: warning });
  }

  if (overlayRoot.children.length) viewer.scene.add(overlayRoot);
  const diagnostics = {
    schema: RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA,
    status: overlayRoot.children.length ? 'applied' : 'empty',
    sourceKind: kind,
    sourceFile: fileName,
    created: overlayRoot.children.length,
    sourceSupports: records.length,
    sourcePipeSegments: pipeSegments.length,
    byFamily,
    warningCount: warnings.length,
    warnings,
    coordinateMappings,
    pipeAxisResolutions,
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
  if (kind === 'rvm' || kind === 'glb' || kind === 'gltf' || RVM_SOURCE_RE.test(name) || /\.(glb|gltf)$/i.test(name)) return false;
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
    if (supportKind && local) {
      out.push({
        source: node,
        attrs: a,
        rawText: text,
        rawType: String(a.TYPE || a.STYP || a.SUPPORT_TYPE || node.type || node.kind || ''),
        kind: supportKind,
        local,
        tag: supportTag(node, a),
        nodeId: nodeIdFromAttrs(a),
        branchId: firstTextFromKeys(a, BRANCH_KEYS),
        lineNo: firstTextFromKeys(a, LINE_KEYS),
        axis: pipeAxisFromAttributes(a),
        gapMm: readRecordGapMm(a),
        explicitSign: extractExplicitSign(text),
        pipeOdMm: pipeOdFromAttributes(a),
        singleAxis: singleAxisFromAttributes(a, text),
      });
    }
  }
  for (const key of CHILD_KEYS) {
    const children = node[key];
    if (Array.isArray(children)) for (const child of children) collectNode(child, out);
  }
}

function makeSupportGlyph(record, viewer, glyphSize, sourceKind, sourceFile, settings, pipeSegments, coordinateMapper) {
  const mapping = coordinateMapper.mapPoint({ x: record.local.x, y: record.local.y, z: record.local.z }, { supportId: record.tag });
  if (!mapping.mappedPoint) return null;

  const local = vec3(mapping.mappedPoint);
  const world = viewer.modelGroup.localToWorld(local.clone());

  const axisResolution = resolveSupportPipeAxis(record, pipeSegments, { toleranceMm: Math.max(100, glyphSize * 10) });
  const axis = vec3(axisResolution.axis || record.axis || { x: 1, y: 0, z: 0 });
  axis.transformDirection?.(viewer.modelGroup.matrixWorld);
  if (axis.lengthSq() <= 1e-9) axis.set(1, 0, 0);
  axis.normalize();

  const symbol = resolveSupportSymbol({
    family: record.kind,
    rawType: record.rawType,
    rawText: record.rawText,
    pipeAxis: { x: axis.x, y: axis.y, z: axis.z },
    gapMm: record.gapMm,
    explicitSign: record.explicitSign,
    pipeOdMm: record.pipeOdMm,
    singleAxis: record.singleAxis,
    warnings: [...(axisResolution.warnings || []), ...(mapping.warnings || [])],
  }, { baseSizeMm: glyphSize });

  if (settings.warningsOnly && !symbol.popupRequired && !symbol.warnings.length) return null;

  const points = [];
  const addLine = (a, b) => { points.push(a.x, a.y, a.z, b.x, b.y, b.z); };

  for (const arrow of symbol.arrows) {
    const direction = vec3(arrow.direction);
    if (direction.lengthSq() <= 1e-9) continue;
    direction.normalize();
    const gap = arrow.axial ? symbol.gapVisualSeparationMm : Math.max(0, Number(symbol.gapMm) || 0);
    const length = resolveRenderedArrowLength(glyphSize, symbol, arrow);
    const tip = world.clone().add(direction.clone().multiplyScalar(gap));
    const tail = tip.clone().add(direction.clone().multiplyScalar(-length));
    addLine(tail, tip);
    const head = Math.min(length * 0.25, glyphSize * 0.35);
    const side = stablePerpendicular(direction);
    addLine(tip, tip.clone().add(direction.clone().multiplyScalar(-head)).add(side.clone().multiplyScalar(head * 0.45)));
    addLine(tip, tip.clone().add(direction.clone().multiplyScalar(-head)).add(side.clone().multiplyScalar(-head * 0.45)));
  }

  if (symbol.coil) addSpringCanCoil(points, world, glyphSize);
  if (symbol.marker) addWarningMarker(points, world, glyphSize);
  if (!points.length) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color: symbol.marker ? 0xffcc33 : 0x60c864, depthTest: true, transparent: true, opacity: 0.95 });
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
    resolvedSymbol: symbol,
    warnings: symbol.warnings,
    gapMm: symbol.gapMm,
    gapVisualSeparationMm: symbol.gapVisualSeparationMm,
    coordinateMapping: mapping,
    pipeAxisResolution: axisResolution,
    attributes: { ...record.attrs },
  };
  return line;
}

function familyFilteredOut(settings, family) {
  const filters = settings?.filters || {};
  const key = family === SUPPORT_FAMILIES.SPRING_CAN ? 'SPRING' : family;
  return filters[family] === false || filters[key] === false;
}

function resolveRenderedArrowLength(glyphSize, symbol, arrow) {
  if (!arrow.axial || !symbol.size?.axialOdTwoThirdsApplied) return glyphSize;
  return Math.max(glyphSize * 0.7, Math.min(glyphSize * 2.5, symbol.size.arrowLengthMm));
}

function addSpringCanCoil(points, origin, glyphSize) {
  const turns = 6;
  const height = glyphSize * 1.2;
  const radius = glyphSize * 0.22;
  let previous = origin.clone().add(new THREE.Vector3(radius, -glyphSize * 0.2, 0));
  for (let i = 1; i <= turns * 4; i += 1) {
    const t = i / (turns * 4);
    const angle = t * Math.PI * 2 * turns;
    const next = origin.clone().add(new THREE.Vector3(Math.cos(angle) * radius, -glyphSize * 0.2 - height * t, Math.sin(angle) * radius));
    points.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
    previous = next;
  }
}

function addWarningMarker(points, origin, glyphSize) {
  const half = glyphSize * 0.35;
  const a = origin.clone().add(new THREE.Vector3(-half, 0, 0));
  const b = origin.clone().add(new THREE.Vector3(half, 0, 0));
  const c = origin.clone().add(new THREE.Vector3(0, -half, 0));
  const d = origin.clone().add(new THREE.Vector3(0, half, 0));
  const e = origin.clone().add(new THREE.Vector3(0, 0, -half));
  const f = origin.clone().add(new THREE.Vector3(0, 0, half));
  points.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z, e.x, e.y, e.z, f.x, f.y, f.z);
}

function stablePerpendicular(direction) {
  const up = Math.abs(direction.dot(new THREE.Vector3(0, 1, 0))) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(direction, up);
  if (side.lengthSq() <= 1e-9) return new THREE.Vector3(0, 0, 1);
  return side.normalize();
}

function vec3(value) { return new THREE.Vector3(Number(value?.x) || 0, Number(value?.y) || 0, Number(value?.z) || 0); }
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
  const explicit = parseVec3(a.PIPE_AXIS || a.PIPEAXIS || a.AXIS || a.DIRECTION || a.DIR);
  if (explicit && explicit.lengthSq() > 1e-9) return explicit.normalize();
  const ap = parseVec3(a.APOS);
  const lp = parseVec3(a.LPOS);
  if (ap && lp) {
    const delta = new THREE.Vector3().subVectors(lp, ap);
    if (delta.lengthSq() > 1e-9) return delta.normalize();
  }
  return null;
}
function pipeOdFromAttributes(a) {
  for (const key of OD_KEYS) {
    const n = numberValue(a[key]);
    if (n && n > 0) return n;
  }
  return null;
}
function singleAxisFromAttributes(a, text) {
  const upper = String(text || '').toUpperCase();
  if (/\bSINGLE\s*AXIS\b|\bONE\s*WAY\b|\bUNI[-\s]?DIRECTION/.test(upper)) return true;
  return Boolean(a.SINGLE_AXIS || a.SINGLEAXIS || a.ONE_WAY || a.UNIDIRECTIONAL);
}
function supportKindFromText(text = '') {
  const family = classifySupportFamily(text);
  if (family !== SUPPORT_FAMILIES.UNKNOWN) return family;
  return SUPPORT_KIND_RE.test(String(text || '')) ? SUPPORT_FAMILIES.UNKNOWN : '';
}
function supportTag(node, a) {
  for (const value of [a.SUPPORT_TAG, a.CMPSUPREFN, a.NAME, a.TAG, a.TAGNO, a.REF, a.REFNO, a.DBREF, a.SKEY, a.SPRE, a.DESCRIPTION, a.DESC, node?.name, node?.id]) {
    const match = SUPPORT_TAG_RE.exec(textValue(value));
    if (match) return match[0].replace(/\s+/g, '-');
  }
  return textValue(a.CMPSUPREFN || a.SUPPORT_TAG || a.NAME || node?.name || node?.id || 'SUPPORT').slice(0, 64);
}
function firstTextFromKeys(a, keys) {
  for (const key of keys) {
    const text = textValue(a[key]).trim();
    if (text) return text;
  }
  return '';
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
  if (/\.(glb|gltf)$/i.test(name)) return 'glb';
  return '';
}
function disposeObjectTree(root) {
  root?.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material].filter(Boolean);
    for (const material of materials) material?.dispose?.();
  });
}
