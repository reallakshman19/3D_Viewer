import * as THREE from 'three';
import {
  layerIdsForRestraintSupport,
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
} from './RestraintVisualProfile.js';

export const SUPPORT_RECORD_SCHEMA = 'bm-cii-support-record/v1';

const EPS = 1e-9;
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function text(value) {
  return String(value ?? '').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const out = text(value);
    if (out) return out;
  }
  return '';
}

function firstFinite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function objectPayload(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

export function vectorFrom(value, fallback = null) {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value)) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value[2]);
    if ([x, y, z].every(Number.isFinite)) return new THREE.Vector3(x, y, z);
  }
  if (value && typeof value === 'object') {
    const x = Number(value.x ?? value.X ?? value.east ?? value.E);
    const y = Number(value.y ?? value.Y ?? value.up ?? value.U);
    const z = Number(value.z ?? value.Z ?? value.north ?? value.N);
    if ([x, y, z].every(Number.isFinite)) return new THREE.Vector3(x, y, z);
  }
  return fallback ? fallback.clone() : null;
}

function normalizeVector(value, fallback) {
  const v = vectorFrom(value, fallback) || fallback.clone();
  if (v.lengthSq() < EPS) return fallback.clone().normalize();
  return v.normalize();
}

export function normalizeSupportSource(value, fallback = 'inputxml') {
  const raw = text(value || fallback).toLowerCase().replace(/[\s_-]+/g, '');
  if (raw.includes('isonote') || raw.includes('isoannotation') || raw.includes('caesarannotation')) return 'isonote';
  if (raw.includes('inputxml') || raw.includes('xml')) return 'inputxml';
  return fallback === 'isonote' ? 'isonote' : 'inputxml';
}

function axisNameFromLabel(label) {
  const raw = text(label).toUpperCase();
  if (raw.includes('X')) return 'X';
  if (raw.includes('Y')) return 'Y';
  if (raw.includes('Z')) return 'Z';
  return '';
}

export function axisVectorFromLabel(axisLabel, fallback = Z_AXIS) {
  const raw = text(axisLabel).toUpperCase();
  const sign = raw.startsWith('-') ? -1 : 1;
  if (raw.includes('X')) return X_AXIS.clone().multiplyScalar(sign);
  if (raw.includes('Y')) return Y_AXIS.clone().multiplyScalar(sign);
  if (raw.includes('Z')) return Z_AXIS.clone().multiplyScalar(sign);
  return fallback.clone();
}

function attrsFrom(rawSupport = {}) {
  return {
    ...objectPayload(rawSupport.raw),
    ...objectPayload(rawSupport.attributes),
    ...objectPayload(rawSupport.userData),
    ...objectPayload(rawSupport.extras),
    ...objectPayload(rawSupport.bmCiiTrace),
    ...objectPayload(rawSupport.bmCiiLayer),
    ...objectPayload(rawSupport),
  };
}

function sourceKindFrom(attrs = {}) {
  return firstNonEmpty(
    attrs.sourceKind,
    attrs.rawKind,
    attrs.kind,
    attrs.type,
    attrs.restraintType,
    attrs.supportKind,
    attrs.SUPPORT_KIND,
    attrs.CAESAR_SUPPORT_KIND,
    attrs.caesarSupportKind,
    attrs.CMPSUPTYPE,
    attrs.SKEY,
    attrs.SUPPORT_TAG,
  );
}

function normalizedKindFrom(sourceKind) {
  const normalized = normalizeRestraintKind(sourceKind) || 'UNKNOWN';
  if (normalized === ('HOLD' + 'DOWN') || normalized === ('HOLD' + '_DOWN')) return 'REST';
  if (normalized === 'SHOE') return 'REST';
  if (normalized === 'TYPE0' || normalized === 'UNKNOWN_TYPE0') return 'UNKNOWN';
  return normalized;
}

function axisLabelFrom(attrs = {}) {
  return normalizeRestraintAxisLabel(firstNonEmpty(
    attrs.axis,
    attrs.Axis,
    attrs.AXIS,
    attrs.direction,
    attrs.Direction,
    attrs.DIRECTION,
    attrs.restraintAxis,
    attrs.RESTRAINT_AXIS,
    attrs['RESTRAINT-AXIS'],
    attrs.SUPPORT_DIRECTION,
    attrs['SUPPORT-DIRECTION'],
  ));
}

function nodeFrom(attrs = {}) {
  return firstNonEmpty(
    attrs.node,
    attrs.Node,
    attrs.NODE,
    attrs.nodeNumber,
    attrs.NodeNumber,
    attrs.NODE_NO,
    attrs.psNode,
    attrs.supportNode,
    attrs.fromNode,
    attrs.toNode,
    attrs.sourceNode,
  );
}

function supportIndexFrom(attrs = {}, fallbackIndex = 0) {
  const raw = firstFinite(
    attrs.supportRecordIndex,
    attrs.recordIndex,
    attrs.supportIndex,
    attrs.index,
    attrs.idx,
    fallbackIndex,
  );
  return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
}

function pointFrom(attrs = {}, fallback = new THREE.Vector3()) {
  return vectorFrom(
    attrs.pipePoint
      || attrs.anchorPoint
      || attrs.supportPoint
      || attrs.position
      || attrs.coOrds
      || attrs.coords
      || attrs.centrePoint
      || attrs.center
      || attrs.ep1
      || attrs.start
      || attrs.startGlbMm,
    fallback,
  ) || fallback.clone();
}

function pipeRadiusFrom(attrs = {}, fallback = 20) {
  const explicitRadius = firstFinite(
    attrs.pipeRadius,
    attrs.supportPipeRadius,
    attrs.boreRadius,
    attrs.radius,
  );
  if (explicitRadius && explicitRadius > 0) return explicitRadius;

  const od = firstFinite(
    attrs.outsideDiameter,
    attrs.OutsideDiameter,
    attrs.OUTSIDE_DIAMETER,
    attrs['OUTSIDE-DIAMETER'],
    attrs.DIAMETER,
    attrs.diameter,
    attrs.bore,
    attrs.BORE,
    attrs.p1bore,
  );
  if (od && od > 0) return Math.max(od / 2, 1);
  return Math.max(Number(fallback) || 20, 1);
}

function supportScaleFrom(attrs = {}, pipeRadius = 20, fallbackScale = null) {
  const explicit = firstFinite(attrs.supportSymbolScale, attrs.renderScale, attrs.scale, fallbackScale);
  if (explicit && explicit > 0) return explicit;
  return Math.max(pipeRadius * 2.6, 28);
}

function horizontalProjection(vector, fallback) {
  const v = vector.clone().sub(UP.clone().multiplyScalar(vector.dot(UP)));
  if (v.lengthSq() > EPS) return v.normalize();
  return fallback.clone().normalize();
}

function lateralFrom(pipeTangent, axisVector, kind) {
  if (kind === 'GUIDE') {
    const fallback = new THREE.Vector3().crossVectors(pipeTangent, UP);
    const safeFallback = fallback.lengthSq() > EPS ? fallback.normalize() : X_AXIS.clone();
    return horizontalProjection(axisVector, safeFallback);
  }
  const side = new THREE.Vector3().crossVectors(pipeTangent, UP);
  if (side.lengthSq() > EPS) return side.normalize();
  const sideX = new THREE.Vector3().crossVectors(pipeTangent, X_AXIS);
  return sideX.lengthSq() > EPS ? sideX.normalize() : Z_AXIS.clone();
}

function gapFrom(attrs = {}) {
  return firstNonEmpty(attrs.gap, attrs.Gap, attrs.GAP, attrs.gapMm, attrs.GAP_MM, attrs.restraintGap, attrs.RESTRAINT_GAP);
}

export function normalizeSupportRecord(rawSupport = {}, source = '', index = 0, overrides = {}) {
  const attrs = attrsFrom(rawSupport);
  const supportSource = normalizeSupportSource(firstNonEmpty(
    source,
    overrides.source,
    attrs.supportSource,
    attrs.SUPPORT_SOURCE,
    attrs['SUPPORT-SOURCE'],
    attrs.source,
    attrs.renderSource,
  ), source || 'inputxml');

  const sourceKind = sourceKindFrom(attrs) || 'UNKNOWN';
  const kind = normalizedKindFrom(sourceKind);
  const axisLabel = axisLabelFrom(attrs);
  const axis = axisNameFromLabel(axisLabel);
  const node = nodeFrom(attrs) || 'NO_NODE';
  const supportRecordIndex = supportIndexFrom({ ...attrs, ...overrides }, index);
  const pipePoint = vectorFrom(overrides.pipePoint) || pointFrom(attrs, new THREE.Vector3());
  const pipeRadius = pipeRadiusFrom({ ...attrs, ...overrides }, overrides.pipeRadiusFallback || 20);
  const axisVector = normalizeVector(
    overrides.axisVector
      || attrs.axisVector
      || attrs.supportAxis
      || attrs.SUPPORT_AXIS
      || attrs.caesarSupportAxis
      || attrs.pipeAxis
      || axisVectorFromLabel(axisLabel, Z_AXIS),
    axisVectorFromLabel(axisLabel, Z_AXIS),
  );
  const pipeTangent = normalizeVector(
    overrides.pipeTangent
      || attrs.pipeTangent
      || attrs.pipeAxis
      || attrs.supportPipeAxis
      || (kind === 'LINESTOP' || kind === 'LIMIT' ? axisVector : null),
    Z_AXIS,
  );
  const lateralVector = normalizeVector(overrides.lateralVector || attrs.lateralVector || lateralFrom(pipeTangent, axisVector, kind), X_AXIS);
  const supportSymbolScale = supportScaleFrom({ ...attrs, ...overrides }, pipeRadius, overrides.scaleFallback);
  const gap = gapFrom(attrs);
  const id = `${supportSource}:${supportRecordIndex}:${node}:${kind}:${axis || 'NA'}`;
  const layerIds = layerIdsForRestraintSupport({ source: supportSource, kind, axisLabel: axis });

  return {
    schema: SUPPORT_RECORD_SCHEMA,
    id,
    source: supportSource,
    supportRecordIndex,
    node,
    sourceKind,
    kind,
    axis,
    axisLabel: axis,
    pipePoint,
    pipeTangent,
    lateralVector,
    axisVector,
    pipeRadius,
    supportSymbolScale,
    gap,
    visibleDefault: kind !== 'UNKNOWN',
    layerIds,
    raw: rawSupport,
  };
}

export function supportRecordMetadata(record = {}) {
  return {
    schema: SUPPORT_RECORD_SCHEMA,
    id: record.id,
    source: record.source,
    supportRecordIndex: record.supportRecordIndex,
    node: record.node,
    sourceKind: record.sourceKind,
    kind: record.kind,
    axis: record.axis || '',
    pipeRadius: Number(record.pipeRadius || 0),
    supportSymbolScale: Number(record.supportSymbolScale || 0),
    visibleDefault: record.visibleDefault !== false,
    layerIds: [...(record.layerIds || [])],
    gap: record.gap || '',
  };
}

export const __private__ = {
  axisNameFromLabel,
  firstNonEmpty,
  firstFinite,
  normalizedKindFrom,
  pipeRadiusFrom,
};
