import * as THREE from 'three';
import {
  SUPPORT_SYMBOL_COLORS,
  layerIdsForRestraintSupport,
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
} from './RestraintVisualProfile.js';

export const BM_CII_RESTRAINT_SYMBOL_RULES = Object.freeze({
  id: 'bm-cii-restraint-symbol-rules/final-od2-v1',
  schema: 'bm-cii-restraint-symbol-rules/v1',
  contracts: Object.freeze({
    GUIDE: 'guide-lateral-arrows-tip-at-od2',
    REST: 'rest-vertical-arrow-tip-at-od2',
    SHOE: 'rest-vertical-arrow-tip-at-od2',
    HOLDDOWN: 'rest-vertical-arrow-tip-at-od2',
    LINESTOP: 'linestop-axial-arrows-offset-od2',
    LIMIT: 'limit-axial-arrow-offset-od2',
    HANGER: 'hanger-spring-moderate-symbol',
    SPRING: 'hanger-spring-moderate-symbol',
    UNKNOWN: 'unknown-debug-default-off',
  }),
});

const EPS = 1e-8;
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function text(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function vectorFrom(value, fallback = null) {
  let candidate = null;
  if (Array.isArray(value)) candidate = new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]));
  else if (value && typeof value === 'object') candidate = new THREE.Vector3(Number(value.x), Number(value.y), Number(value.z));
  if (!candidate || ![candidate.x, candidate.y, candidate.z].every(Number.isFinite) || candidate.lengthSq() < EPS) return fallback ? fallback.clone() : null;
  return candidate;
}

function normalizeVector(value, fallback = null) {
  const v = vectorFrom(value, fallback);
  if (!v || v.lengthSq() < EPS) return fallback ? fallback.clone().normalize() : null;
  return v.normalize();
}

function axisVectorFromLabel(axisLabel) {
  const axis = normalizeRestraintAxisLabel(axisLabel);
  if (axis === 'X') return X_AXIS.clone();
  if (axis === 'Y') return UP.clone();
  if (axis === 'Z') return Z_AXIS.clone();
  return null;
}

function attrsFrom(raw = {}) {
  return { ...(raw.raw || {}), ...(raw.attributes || {}), ...raw };
}

export function supportContractForKind(kind) {
  const normalized = normalizeRestraintKind(kind) || 'UNKNOWN';
  return BM_CII_RESTRAINT_SYMBOL_RULES.contracts[normalized] || BM_CII_RESTRAINT_SYMBOL_RULES.contracts.UNKNOWN;
}

export function visibleDefaultForKind(kind) {
  return (normalizeRestraintKind(kind) || 'UNKNOWN') !== 'UNKNOWN';
}

export function normalizeSupportRecord(rawSupport = {}, source = '', index = 0, options = {}) {
  const attrs = attrsFrom(rawSupport);
  const sourceKey = text(source || attrs.source || attrs.supportSource || attrs.SUPPORT_SOURCE || 'inputxml').toLowerCase().includes('isonote') ? 'isonote' : 'inputxml';
  const rawKind = attrs.kind || attrs.supportKind || attrs.normalizedKind || attrs.sourceKind || attrs.SUPPORT_KIND || attrs.CAESAR_SUPPORT_KIND || attrs.TAG || attrs.labelText || '';
  const kind = normalizeRestraintKind(rawKind) || (String(rawKind).toUpperCase().includes('TYPE0') ? 'UNKNOWN' : 'UNKNOWN');
  const axis = normalizeRestraintAxisLabel(attrs.axis || attrs.restraintAxis || attrs.direction || attrs.SUPPORT_DIRECTION || attrs.AXIS || attrs.Axis || '');
  const node = text(attrs.node || attrs.NODE || attrs.Node || attrs.nodeId || '');
  const point = vectorFrom(attrs.pipePoint || attrs.point || attrs.displayPointGlb || attrs.displayPointGlbMm || attrs.coOrds || attrs.ep1 || attrs.centrePoint || options.pipePoint, new THREE.Vector3());
  const axisVector = axisVectorFromLabel(axis);
  const tangent = normalizeVector(attrs.pipeTangent || attrs.pipeTangentGlb || attrs.tangent || attrs.pipeAxis || options.pipeTangent, null);
  const pipeTangent = tangent || normalizeVector(axisVector, null) || Z_AXIS.clone();
  const frame = pipeFrame({ pipeTangent });
  const rawRadius = numberOrNull(attrs.pipeRadius ?? attrs.radius ?? attrs.pipeRadiusGlb ?? attrs.pipeRadiusMm ?? options.pipeRadius);
  const od = numberOrNull(attrs.outsideDiameter ?? attrs.OutsideDiameter ?? attrs.DIAMETER ?? attrs.diameter ?? attrs.bore ?? attrs.BORE);
  const pipeRadius = Math.max(rawRadius ?? ((od ?? 100) / 2), 0.5);
  const recordIndex = Number.isInteger(index) ? index : Number(attrs.index || attrs.recordIndex || 0) || 0;
  const recordId = text(attrs.recordId || attrs.id || `${sourceKey}:${recordIndex}:${node || 'NA'}:${kind}:${axis || 'NA'}`);
  const layerIds = layerIdsForRestraintSupport({ source: sourceKey, kind, axisLabel: axis }).filter(Boolean);

  return {
    id: recordId,
    recordId,
    source: sourceKey,
    index: recordIndex,
    node,
    kind,
    axis,
    point,
    pipePoint: point,
    pipeTangent,
    lateralVector: frame.lateral.clone(),
    pipeRadius,
    gap: numberOrNull(attrs.gap ?? attrs.gapMm ?? attrs.GAP),
    bidirectional: Boolean(attrs.bidirectional || attrs.twoWay || attrs.isBidirectional),
    visibleDefault: visibleDefaultForKind(kind),
    layerIds,
    supportSymbolContract: supportContractForKind(kind),
    raw: rawSupport,
  };
}

export function pipeFrame(record = {}) {
  const T = normalizeVector(record.pipeTangent || record.tangent || record.pipeAxis, Z_AXIS);
  let lateral = new THREE.Vector3().crossVectors(UP, T);
  if (lateral.lengthSq() < EPS) lateral = X_AXIS.clone();
  lateral.normalize();
  const radial2 = new THREE.Vector3().crossVectors(T, lateral).normalize();
  return { T, UP: UP.clone(), lateral, radial2 };
}

export function glyphLength(record = {}, options = {}) {
  const radius = Math.max(Number(record.pipeRadius) || 1, 0.5);
  const explicit = numberOrNull(options.glyphLength ?? record.glyphLength);
  return explicit && explicit > 0 ? explicit : Math.max(radius * 1.8, 18);
}

function material(color) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.48, metalness: 0.04 });
}

function orientFromY(object, direction) {
  const dir = direction?.clone?.().normalize?.();
  if (!dir || dir.lengthSq() < EPS) return;
  object.quaternion.setFromUnitVectors(UP, dir);
}

function midpoint(a, b) {
  return a.clone().add(b).multiplyScalar(0.5);
}

function stampPrimitive(object, record, primitive) {
  const start = primitive.start?.toArray?.() || null;
  const tip = primitive.tip?.toArray?.() || null;
  const direction = primitive.direction?.toArray?.() || null;
  object.userData = {
    ...(object.userData || {}),
    bmCiiTrace: {
      ...(object.userData?.bmCiiTrace || {}),
      entity: 'support-glyph-primitive',
      recordId: record.recordId,
      source: record.source,
      node: record.node,
      supportKind: record.kind,
      axis: record.axis || '',
      supportSymbolContract: record.supportSymbolContract,
      pipeRadius: record.pipeRadius,
      role: primitive.role,
      start,
      tip,
      direction,
    },
    bmCiiGlyphPrimitive: {
      role: primitive.role,
      start,
      tip,
      direction,
      contract: record.supportSymbolContract,
    },
  };
  return object;
}

function cylinderBetween(group, name, start, end, radius, color, record, role) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length < EPS) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material(color));
  mesh.name = name;
  mesh.position.copy(midpoint(start, end));
  orientFromY(mesh, delta);
  stampPrimitive(mesh, record, { role, start, tip: end, direction: delta.clone().normalize() });
  group.add(mesh);
  return mesh;
}

export function addArrow(group, record, role, start, tip, color, shaftRadius) {
  const delta = tip.clone().sub(start);
  const length = delta.length();
  if (length < EPS) return null;
  const dir = delta.clone().normalize();
  const headLength = Math.min(Math.max(shaftRadius * 5.0, length * 0.24), length * 0.42);
  const shaftEnd = tip.clone().sub(dir.clone().multiplyScalar(headLength));
  cylinderBetween(group, `${record.recordId}:${role}:shaft`, start, shaftEnd, shaftRadius, color, record, `${role}:shaft`);
  const head = new THREE.Mesh(new THREE.ConeGeometry(shaftRadius * 3.5, headLength, 16), material(color));
  head.name = `${record.recordId}:${role}:head`;
  head.position.copy(shaftEnd.clone().add(dir.clone().multiplyScalar(headLength * 0.5)));
  orientFromY(head, dir);
  stampPrimitive(head, record, { role: `${role}:head`, start, tip, direction: dir });
  group.add(head);
  return head;
}

function addGapTick(group, record, role, center, color, size) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(color));
  mesh.name = `${record.recordId}:${role}`;
  mesh.position.copy(center);
  stampPrimitive(mesh, record, { role, start: center, tip: center, direction: UP.clone() });
  group.add(mesh);
  return mesh;
}

function supportColor(record) {
  return SUPPORT_SYMBOL_COLORS[record.kind] || SUPPORT_SYMBOL_COLORS.UNKNOWN || 0xf59e0b;
}

function groupFor(record, suffix) {
  const group = new THREE.Group();
  group.name = `BM_CII_RESTRAINT_${record.recordId}_${suffix}`;
  group.userData = {
    bmCiiTrace: {
      entity: 'support',
      recordId: record.recordId,
      source: record.source,
      node: record.node,
      supportKind: record.kind,
      axis: record.axis || '',
      supportSymbolContract: record.supportSymbolContract,
      pipePoint: record.pipePoint.toArray(),
      pipeTangent: record.pipeTangent.toArray(),
      pipeRadius: record.pipeRadius,
      visibleDefault: record.visibleDefault,
    },
    bmCiiLayer: {
      schema: 'bm-cii-layer/v1',
      category: 'support',
      source: record.source,
      supportKind: record.kind,
      axis: record.axis || '',
      visibleDefault: record.visibleDefault,
      layerIds: record.layerIds,
      restraintVisualProfile: BM_CII_RESTRAINT_SYMBOL_RULES.id,
    },
    bmCiiLayerIds: record.layerIds,
    supportKind: record.kind,
    supportSource: record.source,
    restraintAxis: record.axis || '',
    supportRecordId: record.recordId,
    supportSymbolContract: record.supportSymbolContract,
    glbSupportVisualProfile: BM_CII_RESTRAINT_SYMBOL_RULES.id,
  };
  return group;
}

export function buildGuideGlyph(record, options = {}) {
  const group = groupFor(record, 'GUIDE');
  const { lateral } = pipeFrame(record);
  const P = record.pipePoint;
  const R = record.pipeRadius;
  const L = glyphLength(record, options);
  const color = supportColor(record);
  const shaftRadius = Math.max(R * 0.045, 1.0);
  addArrow(group, record, 'guide-lateral-arrow-positive', P.clone().add(lateral.clone().multiplyScalar(R + L)), P.clone().add(lateral.clone().multiplyScalar(R)), color, shaftRadius);
  addArrow(group, record, 'guide-lateral-arrow-negative', P.clone().sub(lateral.clone().multiplyScalar(R + L)), P.clone().sub(lateral.clone().multiplyScalar(R)), color, shaftRadius);
  return group;
}

export function buildRestGlyph(record, options = {}) {
  const group = groupFor(record, 'REST');
  const { T, lateral } = pipeFrame(record);
  const P = record.pipePoint;
  const R = record.pipeRadius;
  const L = glyphLength(record, options);
  const color = supportColor(record);
  const shaftRadius = Math.max(R * 0.040, 1.0);
  const pipeIsVertical = Math.abs(T.dot(UP)) > 0.85;
  const base = pipeIsVertical ? P.clone().add(lateral.clone().multiplyScalar(R)) : P.clone();
  const tip = base.clone().sub(UP.clone().multiplyScalar(R));
  const tail = base.clone().sub(UP.clone().multiplyScalar(R + L));
  addArrow(group, record, 'rest-vertical-arrow', tail, tip, color, shaftRadius);
  return group;
}

export function buildLineStopGlyph(record, options = {}) {
  const group = groupFor(record, 'LINESTOP');
  const { T, lateral } = pipeFrame(record);
  const P = record.pipePoint;
  const R = record.pipeRadius;
  const L = glyphLength(record, options);
  const color = supportColor(record);
  const shaftRadius = Math.max(R * 0.045, 1.0);
  const pipeIsVertical = Math.abs(T.dot(UP)) > 0.85;
  const offset = pipeIsVertical ? P.clone().add(lateral.clone().multiplyScalar(R)) : P.clone().sub(UP.clone().multiplyScalar(R));
  addArrow(group, record, 'linestop-axial-arrow-positive', offset.clone().add(T.clone().multiplyScalar(R + L)), offset.clone().add(T.clone().multiplyScalar(R)), color, shaftRadius);
  addArrow(group, record, 'linestop-axial-arrow-negative', offset.clone().sub(T.clone().multiplyScalar(R + L)), offset.clone().sub(T.clone().multiplyScalar(R)), color, shaftRadius);
  return group;
}

export function buildLimitGlyph(record, options = {}) {
  const group = groupFor(record, 'LIMIT');
  const { T, lateral } = pipeFrame(record);
  const P = record.pipePoint;
  const R = record.pipeRadius;
  const L = glyphLength(record, options);
  const color = supportColor(record);
  const shaftRadius = Math.max(R * 0.045, 1.0);
  const pipeIsVertical = Math.abs(T.dot(UP)) > 0.85;
  const offset = pipeIsVertical ? P.clone().add(lateral.clone().multiplyScalar(R)) : P.clone().sub(UP.clone().multiplyScalar(R));
  addArrow(group, record, 'limit-axial-arrow-positive', offset.clone().add(T.clone().multiplyScalar(R + L)), offset.clone().add(T.clone().multiplyScalar(R)), color, shaftRadius);
  if (record.bidirectional) {
    addArrow(group, record, 'limit-axial-arrow-negative', offset.clone().sub(T.clone().multiplyScalar(R + L)), offset.clone().sub(T.clone().multiplyScalar(R)), color, shaftRadius);
  }
  if (record.gap !== null && record.gap !== undefined) {
    addGapTick(group, record, 'limit-gap-tick', offset.clone().add(T.clone().multiplyScalar(R + L * 0.45)), color, new THREE.Vector3(Math.max(R * 0.08, 1), Math.max(R * 0.34, 4), Math.max(R * 0.08, 1)));
  }
  return group;
}

export function buildHangerSpringGlyph(record, options = {}) {
  const group = groupFor(record, record.kind === 'SPRING' ? 'SPRING' : 'HANGER');
  const P = record.pipePoint;
  const R = record.pipeRadius;
  const L = glyphLength(record, options);
  const color = supportColor(record);
  const top = P.clone().add(UP.clone().multiplyScalar(R + L));
  const pipeTop = P.clone().add(UP.clone().multiplyScalar(R));
  cylinderBetween(group, `${record.recordId}:hanger-rod`, top, pipeTop, Math.max(R * 0.025, 0.8), color, record, 'hanger-rod');
  const turns = 3;
  const points = [];
  const coilRadius = Math.max(R * 0.20, 2);
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    const angle = t * Math.PI * 2 * turns;
    points.push(new THREE.Vector3(Math.cos(angle) * coilRadius, R + L * (0.25 + t * 0.45), Math.sin(angle) * coilRadius).add(P));
  }
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, Math.max(R * 0.012, 0.5), 8), material(color));
  mesh.name = `${record.recordId}:hanger-spring-coil`;
  stampPrimitive(mesh, record, { role: 'hanger-spring-coil', start: points[0], tip: points.at(-1), direction: UP.clone() });
  group.add(mesh);
  return group;
}

export function buildUnknownGlyph(record) {
  const group = groupFor(record, 'UNKNOWN');
  const color = supportColor(record);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(Math.max(record.pipeRadius * 0.12, 1.5), 0), material(color));
  marker.name = `${record.recordId}:unknown-debug-marker`;
  marker.position.copy(record.pipePoint.clone().add(UP.clone().multiplyScalar(Math.max(record.pipeRadius * 0.35, 4))));
  stampPrimitive(marker, record, { role: 'unknown-debug-marker', start: marker.position.clone(), tip: marker.position.clone(), direction: UP.clone() });
  group.add(marker);
  return group;
}

export function buildSupportGlyphGroup(rawRecord, options = {}) {
  const record = rawRecord?.pipePoint?.isVector3 ? rawRecord : normalizeSupportRecord(rawRecord, rawRecord?.source, rawRecord?.index, options);
  if (record.kind === 'GUIDE') return buildGuideGlyph(record, options);
  if (record.kind === 'LINESTOP') return buildLineStopGlyph(record, options);
  if (record.kind === 'LIMIT') return buildLimitGlyph(record, options);
  if (record.kind === 'REST' || record.kind === 'SHOE' || record.kind === 'HOLDDOWN') return buildRestGlyph(record, options);
  if (record.kind === 'HANGER' || record.kind === 'SPRING') return buildHangerSpringGlyph(record, options);
  return buildUnknownGlyph(record, options);
}
