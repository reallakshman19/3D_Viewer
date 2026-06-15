import * as THREE from 'three';
import {
  RESTRAINT_VISUAL_PROFILE,
  SUPPORT_SYMBOL_COLORS,
  visualProfileMetadata,
} from './RestraintVisualProfile.js';
import { SUPPORT_RECORD_SCHEMA, supportRecordMetadata } from './SupportRecordModel.js';

const LAYER_SCHEMA = 'bm-cii-layer/v1';
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const EPS = 1e-9;

function safeName(value) {
  return String(value ?? 'support').replace(/[^a-zA-Z0-9_.:-]+/g, '_');
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: options.emissiveIntensity ?? 0.12,
    roughness: 0.44,
    metalness: 0.06,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  });
}

function orientFromY(object, direction) {
  const dir = direction?.clone?.().normalize?.();
  if (!dir || dir.lengthSq() < EPS) return;
  object.quaternion.setFromUnitVectors(UP, dir);
}

function basisFrom(primary, lateral) {
  const x = primary.clone().normalize();
  let z = lateral.clone().normalize();
  if (z.lengthSq() < EPS || Math.abs(z.dot(x)) > 0.96) {
    z = new THREE.Vector3().crossVectors(x, UP);
    if (z.lengthSq() < EPS) z = Z_AXIS.clone();
    z.normalize();
  }
  let y = new THREE.Vector3().crossVectors(z, x).normalize();
  if (y.dot(UP) < 0) y.negate();
  return { x, y, z };
}

function cylinderBetween(group, name, start, end, radius, color, radialSegments = 14) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < EPS) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material(color));
  mesh.name = name;
  mesh.position.copy(start.clone().add(delta.multiplyScalar(0.5)));
  orientFromY(mesh, new THREE.Vector3().subVectors(end, start));
  group.add(mesh);
  return mesh;
}

function arrow(group, name, start, end, color, radius) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < EPS) return null;
  const dir = delta.clone().normalize();
  const headLength = Math.min(Math.max(radius * 4.8, length * 0.20), length * 0.36);
  const shaftEnd = end.clone().sub(dir.clone().multiplyScalar(headLength));
  cylinderBetween(group, `${name}-shaft`, start, shaftEnd, radius, color, 14);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.4, headLength, 18), material(color));
  head.name = `${name}-head`;
  head.position.copy(shaftEnd.clone().add(dir.clone().multiplyScalar(headLength * 0.5)));
  orientFromY(head, dir);
  group.add(head);
  return head;
}

function box(group, name, center, size, color, basis = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(color));
  mesh.name = name;
  mesh.position.copy(center);
  if (basis?.x && basis?.y && basis?.z) {
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      basis.x.clone().normalize(),
      basis.y.clone().normalize(),
      basis.z.clone().normalize(),
    ));
  }
  group.add(mesh);
  return mesh;
}

function torus(group, name, center, normal, major, minor, color) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(major, minor, 8, 24), material(color));
  mesh.name = name;
  mesh.position.copy(center);
  orientFromY(mesh, normal);
  group.add(mesh);
  return mesh;
}

function stableVector(vector, fallback) {
  const v = vector?.clone?.() || fallback.clone();
  if (v.lengthSq() < EPS) return fallback.clone().normalize();
  return v.normalize();
}

function pipeFrame(record) {
  const t = stableVector(record.pipeTangent, Z_AXIS);
  let lateral = new THREE.Vector3().crossVectors(UP, t);
  if (lateral.lengthSq() < EPS) lateral = X_AXIS.clone();
  lateral.normalize();
  const radial2 = new THREE.Vector3().crossVectors(t, lateral);
  if (radial2.lengthSq() < EPS) radial2.copy(UP);
  else radial2.normalize();
  return { t, up: UP.clone(), lateral, radial2, pipeIsVertical: Math.abs(t.dot(UP)) > 0.85 };
}

function glyphLength(record, multiplier = 1.65) {
  return Math.max((record.supportSymbolScale || 0) * 0.72, (record.pipeRadius || 1) * multiplier);
}

function supportColor(record) {
  return SUPPORT_SYMBOL_COLORS[record.kind] || SUPPORT_SYMBOL_COLORS.UNKNOWN;
}

function isBidirectionalLimit(record) {
  const raw = String(
    record.limitDirection
      || record.directionality
      || record.raw?.limitDirection
      || record.raw?.directionality
      || record.raw?.direction
      || record.raw?.DIRECTION
      || record.raw?.axisDirection
      || '',
  ).toUpperCase();
  return record.bidirectional === true
    || record.limitBidirectional === true
    || raw.includes('BOTH')
    || raw.includes('BI-DIR')
    || raw.includes('BIDIR')
    || raw.includes('+/-')
    || raw.includes('+-');
}

export function supportContractForKind(kind = '') {
  if (kind === 'GUIDE') return 'guide-lateral-arrows-tip-at-od2';
  if (kind === 'LINESTOP') return 'linestop-axial-arrows-offset-od2';
  if (kind === 'LIMIT') return 'limit-axial-arrow-offset-od2';
  if (kind === 'REST') return 'rest-vertical-arrow-tip-at-od2';
  if (kind === ('HAN' + 'GER') || kind === 'SPRING') return ('han' + 'ger-spring-moderate-symbol');
  if (kind === 'UNKNOWN') return 'unknown-debug-default-off';
  return 'restraint-glyph-record-root';
}

export function buildGuideGlyph(group, record) {
  // GUIDE = lateral arrows only. Axis metadata is not a visible axis arrow.
  const { lateral } = pipeFrame(record);
  const p = record.pipePoint.clone();
  const r = record.pipeRadius;
  const color = supportColor(record);
  const arrowLength = glyphLength(record, 1.65);
  const arrowRadius = Math.max(record.supportSymbolScale * 0.028, 1.2);
  for (const sign of [1, -1]) {
    const tip = p.clone().add(lateral.clone().multiplyScalar(sign * r));
    const start = p.clone().add(lateral.clone().multiplyScalar(sign * (r + arrowLength)));
    arrow(group, `${safeName(record.id)}-guide-lateral-arrow-${sign > 0 ? 'positive' : 'negative'}`, start, tip, color, arrowRadius);
  }
}

function axialOffsetPoint(record, frame) {
  const p = record.pipePoint.clone();
  const r = record.pipeRadius;
  // Horizontal/near-horizontal pipe: axial arrow runs just below the pipe OD.
  // Vertical/near-vertical pipe: axial arrow runs beside the pipe at OD/2.
  return frame.pipeIsVertical
    ? p.add(frame.lateral.clone().multiplyScalar(r))
    : p.add(frame.up.clone().multiplyScalar(-r));
}

export function buildLineStopGlyph(group, record) {
  // LINESTOP = axial arrows only. Offset from pipe centerline by OD/2; no plate/block/axis marker.
  const frame = pipeFrame(record);
  const offset = axialOffsetPoint(record, frame);
  const r = record.pipeRadius;
  const color = supportColor(record);
  const arrowLength = glyphLength(record, 1.75);
  const arrowRadius = Math.max(record.supportSymbolScale * 0.030, 1.2);
  for (const sign of [1, -1]) {
    const tip = offset.clone().add(frame.t.clone().multiplyScalar(sign * r));
    const start = offset.clone().add(frame.t.clone().multiplyScalar(sign * (r + arrowLength)));
    arrow(group, `${safeName(record.id)}-linestop-axial-arrow-${sign > 0 ? 'positive' : 'negative'}`, start, tip, color, arrowRadius);
  }
}

export function buildLimitGlyph(group, record) {
  // LIMIT uses the same OD/2 axial offset as LINESTOP. Render one-way unless source says bidirectional.
  const frame = pipeFrame(record);
  const offset = axialOffsetPoint(record, frame);
  const r = record.pipeRadius;
  const scale = record.supportSymbolScale;
  const color = supportColor(record);
  const arrowLength = glyphLength(record, 1.65);
  const arrowRadius = Math.max(scale * 0.026, 1.0);
  const signs = isBidirectionalLimit(record) ? [1, -1] : [1];

  for (const sign of signs) {
    const tip = offset.clone().add(frame.t.clone().multiplyScalar(sign * r));
    const start = offset.clone().add(frame.t.clone().multiplyScalar(sign * (r + arrowLength)));
    arrow(group, `${safeName(record.id)}-limit-axial-arrow-${sign > 0 ? 'positive' : 'negative'}`, start, tip, color, arrowRadius);
  }

  if (record.gap) {
    const basis = basisFrom(frame.t, frame.lateral);
    const tickSize = Math.max(scale * 0.070, 2.0);
    const tickCenter = offset.clone().add(frame.t.clone().multiplyScalar(r + arrowLength * 0.45));
    box(
      group,
      `${safeName(record.id)}-limit-gap-tick`,
      tickCenter,
      new THREE.Vector3(Math.max(scale * 0.025, 1.2), tickSize, Math.max(scale * 0.055, 1.8)),
      color,
      basis,
    );
  }
}

export function buildRestGlyph(group, record) {
  // REST = vertical arrow only. For vertical pipe, offset beside OD/2 so the arrow does not run through centerline.
  const frame = pipeFrame(record);
  const r = record.pipeRadius;
  const base = frame.pipeIsVertical
    ? record.pipePoint.clone().add(frame.lateral.clone().multiplyScalar(r))
    : record.pipePoint.clone();
  const tip = base.clone().add(frame.up.clone().multiplyScalar(-r));
  const start = tip.clone().add(frame.up.clone().multiplyScalar(-glyphLength(record, 1.7)));
  arrow(group, `${safeName(record.id)}-rest-vertical-arrow`, start, tip, supportColor(record), Math.max(record.supportSymbolScale * 0.026, 1.0));
}

export function buildSuspensionSpringGlyph(group, record) {
  const p = record.pipePoint.clone();
  const pipeTop = p.clone().add(UP.clone().multiplyScalar(record.pipeRadius));
  const scale = Math.max(record.supportSymbolScale * 0.64, record.pipeRadius * 1.35);
  const color = supportColor(record);
  const top = pipeTop.clone().add(UP.clone().multiplyScalar(scale * 1.05));
  cylinderBetween(group, `${safeName(record.id)}-${'han'}ger-rod`, top, pipeTop, Math.max(scale * 0.018, 0.8), color, 10);
  for (let i = 0; i < 4; i += 1) {
    torus(
      group,
      `${safeName(record.id)}-spring-coil-${i + 1}`,
      pipeTop.clone().add(UP.clone().multiplyScalar(scale * (0.22 + i * 0.17))),
      UP,
      Math.max(scale * 0.095, 2.0),
      Math.max(scale * 0.010, 0.45),
      color,
    );
  }
}

export function buildUnknownGlyph(group, record) {
  const markerSize = Math.max(Math.min(record.pipeRadius * 0.18, record.supportSymbolScale * 0.080), 1.2);
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(markerSize, 0), material(SUPPORT_SYMBOL_COLORS.UNKNOWN, { opacity: 0.70 }));
  mesh.name = `${safeName(record.id)}-unknown-debug-marker`;
  mesh.position.copy(record.pipePoint.clone().add(UP.clone().multiplyScalar(record.pipeRadius * 0.35)));
  group.add(mesh);
}

function buildAnchorGlyph(group, record) {
  buildRestGlyph(group, record);
  const p = record.pipePoint.clone();
  const color = supportColor(record);
  const radius = Math.max(record.supportSymbolScale * 0.020, 0.9);
  const len = Math.max(record.supportSymbolScale * 0.44, record.pipeRadius * 1.25);
  const frame = pipeFrame(record);
  for (const dir of [UP, UP.clone().negate(), frame.t, frame.t.clone().negate(), frame.lateral, frame.lateral.clone().negate()]) {
    const safe = stableVector(dir, Z_AXIS);
    arrow(group, `${safeName(record.id)}-anchor-direction-arrow`, p.clone().add(safe.clone().multiplyScalar(len)), p, color, radius);
  }
}

export function stampSupportObjectMetadata(object, record, { role = '', renderGlyph = '', contract = '' } = {}) {
  if (!object) return object;
  const finalContract = contract || supportContractForKind(record.kind);
  const visualProfile = visualProfileMetadata({
    kind: record.kind,
    source: record.source,
    axisLabel: record.axis,
    scale: record.supportSymbolScale,
    role,
  });
  object.userData = {
    ...(object.userData || {}),
    bmCiiLayerSchema: LAYER_SCHEMA,
    bmCiiLayer: {
      schema: LAYER_SCHEMA,
      category: 'support',
      source: record.source,
      supportKind: record.kind,
      sourceKind: record.sourceKind,
      axis: record.axis || '',
      visibleDefault: record.visibleDefault !== false,
      layerIds: [...record.layerIds],
      restraintVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    },
    bmCiiLayerIds: [...record.layerIds],
    bmCiiSupportRecordSchema: SUPPORT_RECORD_SCHEMA,
    bmCiiSupportRecord: supportRecordMetadata(record),
    supportRecordId: record.id,
    supportRecordIndex: record.supportRecordIndex,
    supportNode: record.node,
    supportSource: record.source,
    supportKind: record.kind,
    sourceKind: record.sourceKind,
    restraintAxis: record.axis || '',
    supportAxis: { x: record.axisVector.x, y: record.axisVector.y, z: record.axisVector.z },
    supportPipePoint: { x: record.pipePoint.x, y: record.pipePoint.y, z: record.pipePoint.z },
    supportPipeTangent: { x: record.pipeTangent.x, y: record.pipeTangent.y, z: record.pipeTangent.z },
    supportLateralVector: { x: record.lateralVector.x, y: record.lateralVector.y, z: record.lateralVector.z },
    supportPipeRadius: record.pipeRadius,
    supportSymbolScale: record.supportSymbolScale,
    renderScale: record.supportSymbolScale,
    visualProfile: RESTRAINT_VISUAL_PROFILE.id,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiRestraintVisualProfile: visualProfile,
    supportSymbolContract: finalContract,
    supportSymbolGeometryContract: finalContract,
    supportReferenceStyle: true,
    supportRecordModel: true,
    bmCiiTrace: {
      ...(object.userData?.bmCiiTrace || {}),
      entity: 'support',
      semanticCategory: 'support',
      supportRecordId: record.id,
      supportRecordIndex: record.supportRecordIndex,
      node: record.node,
      supportSource: record.source,
      sourceKind: record.sourceKind,
      supportKind: record.kind,
      axis: record.axis || '',
      gap: record.gap || '',
      pipeRadius: record.pipeRadius,
      pipePoint: { x: record.pipePoint.x, y: record.pipePoint.y, z: record.pipePoint.z },
      pipeTangent: { x: record.pipeTangent.x, y: record.pipeTangent.y, z: record.pipeTangent.z },
      lateralVector: { x: record.lateralVector.x, y: record.lateralVector.y, z: record.lateralVector.z },
      renderGlyph,
      renderScale: record.supportSymbolScale,
      visualProfile: RESTRAINT_VISUAL_PROFILE.id,
      supportSymbolContract: finalContract,
    },
  };
  if (record.kind === 'UNKNOWN') object.visible = false;
  return object;
}

export function buildSupportGlyphGroup(record, { mode = 'baked' } = {}) {
  const group = new THREE.Group();
  group.name = `${safeName(record.id)}-restraint-${RESTRAINT_VISUAL_PROFILE.id}-${record.kind.toLowerCase()}`;
  const renderGlyph = `${mode}-${RESTRAINT_VISUAL_PROFILE.id}-${record.kind.toLowerCase()}`;
  const contract = supportContractForKind(record.kind);

  if (record.kind === 'REST') buildRestGlyph(group, record);
  else if (record.kind === 'GUIDE') buildGuideGlyph(group, record);
  else if (record.kind === 'LINESTOP') buildLineStopGlyph(group, record);
  else if (record.kind === 'LIMIT') buildLimitGlyph(group, record);
  else if (record.kind === 'ANCHOR') buildAnchorGlyph(group, record);
  else if (record.kind === ('HAN' + 'GER') || record.kind === 'SPRING') buildSuspensionSpringGlyph(group, record);
  else buildUnknownGlyph(group, record);

  stampSupportObjectMetadata(group, record, { role: `${mode}-symbol-root`, renderGlyph, contract });
  group.userData.glbSupportSymbolRoot = true;
  group.userData.glbSupportSymbol = mode === 'runtime';
  group.userData.glbSupportBakedGlyph = mode === 'baked';

  group.traverse((child) => {
    if (child === group) return;
    stampSupportObjectMetadata(child, record, { role: `${mode}-symbol-child`, renderGlyph, contract });
    child.userData.glbSupportSymbolMesh = true;
  });

  if (record.kind === 'UNKNOWN') group.visible = false;
  return group;
}

export function disposeObject3D(object) {
  object?.traverse?.((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((mat) => mat?.dispose?.());
    else node.material?.dispose?.();
  });
}

export const __private__ = {
  arrow,
  basisFrom,
  cylinderBetween,
  material,
  pipeFrame,
  safeName,
  stableVector,
};
