import * as THREE from 'three';
import {
  RESTRAINT_VISUAL_PROFILE,
  SUPPORT_SYMBOL_COLORS,
  normalizeRestraintAxisLabel,
  visualProfileMetadata,
} from './RestraintVisualProfile.js';
import {
  normalizeSupportRecord,
  supportSymbolContractFor,
  supportTraceFromRecord,
} from './SupportRecordNormalizer.js';

const EPS = 1e-8;
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LAYER_SCHEMA = 'bm-cii-layer/v1';
const RESTRAINT_SYMBOL_REVIEW_SCALE_MULTIPLIER = 3.0;

function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function attrsFrom(object, comp = {}) { return { ...(comp.raw || {}), ...(comp.attributes || {}), ...(object?.userData || {}) }; }

function vectorFrom(value) {
  if (Array.isArray(value)) {
    const v = new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
    return v.lengthSq() > EPS ? v.normalize() : null;
  }
  if (typeof value === 'string') {
    const parts = value.split(/[\s,;]+/).map(Number).filter(Number.isFinite);
    if (parts.length >= 3) {
      const v = new THREE.Vector3(parts[0], parts[1], parts[2]);
      return v.lengthSq() > EPS ? v.normalize() : null;
    }
  }
  if (value && typeof value === 'object') {
    const v = new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
    return v.lengthSq() > EPS ? v.normalize() : null;
  }
  return null;
}

/**
 * Convert source restraint axis into Basic GLB canvas axis.
 *
 * BM_CII/InputXML support axes are CAESAR-style global axes. The Basic GLB
 * canvas is Y-up:
 *
 *   source X -> canvas X  (E/W)
 *   source Y -> canvas Z  (N/S horizontal)
 *   source Z -> canvas Y  (UP)
 *
 * KIND/TYPE decides the symbol family. This function only decides arrow
 * direction on the canvas.
 */
function canvasAxisFromLabel(axisLabel = '') {
  const normalized = normalizeRestraintAxisLabel(axisLabel);
  const sign = normalized.startsWith('-') ? -1 : 1;
  if (normalized.includes('X')) return X_AXIS.clone().multiplyScalar(sign);
  if (normalized.includes('Y')) return Z_AXIS.clone().multiplyScalar(sign);
  if (normalized.includes('Z')) return Y_AXIS.clone().multiplyScalar(sign);
  return null;
}

function canvasAxisFrom(attrs = {}, comp = {}, axisLabel = '') {
  return vectorFrom(comp.canvasAxis)
    || vectorFrom(attrs.canvasAxis)
    || canvasAxisFromLabel(axisLabel)
    || X_AXIS.clone();
}

function pipeTangentFrom(attrs = {}, comp = {}, fallbackAxis = X_AXIS) {
  const tangent = vectorFrom(comp.pipeTangent)
    || vectorFrom(comp.pipeAxis)
    || vectorFrom(comp.pipeDirection)
    || vectorFrom(comp.tangent)
    || vectorFrom(comp.axisGlb)
    || vectorFrom(attrs.pipeTangent)
    || vectorFrom(attrs.pipeAxis)
    || vectorFrom(attrs.pipeDirection)
    || vectorFrom(attrs.tangent)
    || vectorFrom(attrs.PipeTangent)
    || vectorFrom(attrs.PIPE_TANGENT)
    || vectorFrom(attrs.PIPE_AXIS)
    || vectorFrom(attrs.pipeDirectionGlb)
    || vectorFrom(attrs.centerlineDirection)
    || vectorFrom(attrs.componentAxis);
  if (tangent) return tangent.normalize();
  return fallbackAxis.clone().normalize();
}

function pipeRadiusFor(comp = {}, attrs = {}) {
  const bore = number(comp.bore ?? attrs.bore ?? attrs.BORE ?? attrs.DIAMETER ?? attrs.OutsideDiameter) || 100;
  return Math.max(bore / 2, 5);
}

function supportScaleFor(comp = {}, attrs = {}, options = {}) {
  const bore = number(comp.bore ?? attrs.bore ?? attrs.BORE ?? attrs.DIAMETER ?? attrs.OutsideDiameter) || 100;
  const multiplier = number(options.supportSymbolScale) || number(options.restraintSymbolScale) || 0.95;
  const baseScale = Math.max(28, Math.min(190, bore * multiplier));
  return baseScale * RESTRAINT_SYMBOL_REVIEW_SCALE_MULTIPLIER;
}

function sourceOf(attrs = {}, comp = {}, options = {}) {
  const raw = upper(options.supportRendering?.source || options.supportSource || comp.supportSource || comp.source || attrs.supportSource || attrs.SUPPORT_SOURCE || attrs['SUPPORT-SOURCE']);
  return raw.includes('ISONOTE') ? 'isonote' : 'inputxml';
}

function material(color) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.10, roughness: 0.42, metalness: 0.08 });
}

function orientFromY(object, direction) {
  const dir = direction?.clone?.().normalize?.();
  if (!dir || dir.lengthSq() < EPS) return;
  object.quaternion.setFromUnitVectors(UP, dir);
}

function cylinderBetween(group, name, start, end, radius, color, radialSegments = 14) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material(color));
  mesh.name = name;
  mesh.position.copy(start.clone().add(delta.multiplyScalar(0.5)));
  orientFromY(mesh, new THREE.Vector3().subVectors(end, start));
  group.add(mesh);
  return mesh;
}

function arrowFixedTip(group, name, tip, outwardAxis, length, color, radius) {
  const outward = outwardAxis?.clone?.().normalize?.() || X_AXIS.clone();
  if (outward.lengthSq() < EPS) return null;
  const start = tip.clone().add(outward.multiplyScalar(length));
  const delta = new THREE.Vector3().subVectors(tip, start);
  const arrowLength = delta.length();
  if (arrowLength < 1e-6) return null;
  const dir = delta.clone().normalize();
  const headLength = Math.min(Math.max(radius * 5.0, arrowLength * 0.20), arrowLength * 0.42);
  const shaftEnd = tip.clone().sub(dir.clone().multiplyScalar(headLength));
  cylinderBetween(group, `${name}-shaft`, start, shaftEnd, radius, color, 14);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.8, headLength, 18), material(color));
  head.name = `${name}-head-fixed-tip`;
  head.position.copy(shaftEnd.clone().add(dir.clone().multiplyScalar(headLength * 0.5)));
  orientFromY(head, dir);
  group.add(head);
  return head;
}

function torus(group, name, center, normal, major, minor, color) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(major, minor, 8, 28), material(color));
  mesh.name = name;
  mesh.position.copy(center);
  orientFromY(mesh, normal);
  group.add(mesh);
  return mesh;
}

function projectPerpendicular(vector, tangent) {
  if (!vector || !tangent) return null;
  const projected = vector.clone().sub(tangent.clone().multiplyScalar(vector.dot(tangent)));
  return projected.lengthSq() > EPS ? projected.normalize() : null;
}

function makeCircumferenceFrame(center, pipeTangent, pipeRadius) {
  const point = center.clone();
  const T = pipeTangent?.clone?.().normalize?.() || X_AXIS.clone();
  if (T.lengthSq() < EPS) T.copy(X_AXIS);

  let top = projectPerpendicular(UP, T);
  if (!top) top = projectPerpendicular(X_AXIS, T) || projectPerpendicular(Z_AXIS, T) || X_AXIS.clone();
  top.normalize();

  let side = new THREE.Vector3().crossVectors(T, top);
  if (side.lengthSq() < EPS) side = projectPerpendicular(Z_AXIS, T) || Z_AXIS.clone();
  side.normalize();

  return {
    point,
    pipeTangent: T,
    pipeRadius,
    top,
    side,
    anchors: {
      CIRCUM_TOP: point.clone().add(top.clone().multiplyScalar(pipeRadius)),
      CIRCUM_BOT: point.clone().add(top.clone().multiplyScalar(-pipeRadius)),
      CIRCUM_SIDE1: point.clone().add(side.clone().multiplyScalar(pipeRadius)),
      CIRCUM_SIDE2: point.clone().add(side.clone().multiplyScalar(-pipeRadius)),
      CIRCUM_EAST: point.clone().add(X_AXIS.clone().multiplyScalar(pipeRadius)),
      CIRCUM_WEST: point.clone().add(X_AXIS.clone().multiplyScalar(-pipeRadius)),
      CIRCUM_NORTH: point.clone().add(Z_AXIS.clone().multiplyScalar(pipeRadius)),
      CIRCUM_SOUTH: point.clone().add(Z_AXIS.clone().multiplyScalar(-pipeRadius)),
    },
  };
}

function plainVector(v) { return [Number(v.x.toFixed(6)), Number(v.y.toFixed(6)), Number(v.z.toFixed(6))]; }
function plainCircumferenceFrame(frame) {
  return Object.fromEntries([
    ['supportPoint', plainVector(frame.point)],
    ['pipeTangent', plainVector(frame.pipeTangent)],
    ['pipeRadius', Number(frame.pipeRadius.toFixed(6))],
    ...Object.entries(frame.anchors).map(([key, value]) => [key, plainVector(value)]),
  ]);
}

function axialOffsetTip(frame, canvasAxis) {
  const axis = canvasAxis?.clone?.().normalize?.() || frame.pipeTangent.clone();
  // For vertical/near-vertical axial arrows, offset beside the pipe instead of
  // passing through the centerline. Otherwise use the bottom OD point.
  if (Math.abs(axis.dot(UP)) > 0.85) return frame.anchors.CIRCUM_SIDE1.clone();
  return frame.anchors.CIRCUM_BOT.clone();
}

function hideExistingProxyMeshes(object, markerGroupName) {
  const hidden = [];
  for (const child of object.children || []) {
    if (child.name === markerGroupName) continue;
    child.traverse?.((node) => {
      if (node.isMesh) {
        node.visible = false;
        hidden.push(node.name || node.uuid);
      }
    });
  }
  return hidden;
}

function stampLayerMetadata(target, record, { scale, role }) {
  const profile = visualProfileMetadata({ kind: record.kind, source: record.source, axisLabel: record.axis, scale, role });
  target.userData = {
    ...(target.userData || {}),
    ...(record.details || {}),
    AXIS: record.axis || 'N/A',
    NODE: record.node || 'N/A',
    SOURCE: record.source || 'N/A',
    bmCiiLayerSchema: LAYER_SCHEMA,
    bmCiiLayer: {
      schema: LAYER_SCHEMA,
      category: 'support',
      source: record.source,
      supportKind: record.kind,
      axis: record.axis,
      visibleDefault: record.visibleDefault,
      layerIds: record.layerIds,
      restraintVisualProfile: profile.profile,
      supportGlyphRole: role,
    },
    bmCiiLayerIds: record.layerIds,
    supportKind: record.kind,
    supportSource: record.source,
    restraintAxis: record.axis,
    supportSymbolScale: scale,
    renderScale: scale,
    visualProfile: RESTRAINT_VISUAL_PROFILE.id,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiRestraintVisualProfile: profile,
    supportReferenceStyle: true,
    supportReferenceStyleV10KindCanvasAxis: true,
    supportGlyphRole: role,
    supportSymbolContract: record.supportSymbolContract,
    supportRecordId: record.recordId,
    circumferenceAnchors: record.circumferenceAnchors || null,
  };
}

function stampGlyphMetadata(target, record, { scale, role, renderGlyph, canvasAxis }) {
  stampLayerMetadata(target, record, { scale, role });
  const isRenderableRecordRoot = role === 'baked-symbol-root';
  target.userData = {
    ...(target.userData || {}),
    canvasAxis: canvasAxis ? { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z } : null,
    renderGlyph,
    bmCiiTrace: isRenderableRecordRoot
      ? supportTraceFromRecord(record, {
        renderGlyph,
        renderScale: scale,
        visualProfile: RESTRAINT_VISUAL_PROFILE.id,
        circumferenceAnchors: record.circumferenceAnchors || null,
        canvasAxis: canvasAxis ? { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z } : null,
        placementContract: 'kind-decides-symbol-axis-only-canvas-direction-fixed-tip-circumference',
      })
      : {
        entity: 'supportPart',
        parentRecordId: record.recordId,
        supportRecordId: record.recordId,
        supportKind: record.kind,
        supportSource: record.source,
        supportSymbolContract: record.supportSymbolContract,
        circumferenceAnchors: record.circumferenceAnchors || null,
        canvasAxis: canvasAxis ? { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z } : null,
        ...(record.details || {}),
        AXIS: record.axis || 'N/A',
        NODE: record.node || 'N/A',
        SOURCE: record.source || 'N/A',
      },
  };
}

function buildRest(group, id, frame, scale, color) {
  // REST = one vertical arrow only. Axis is metadata only for this symbol family.
  const tip = frame.anchors.CIRCUM_BOT.clone();
  arrowFixedTip(group, `${id}-rest-one-vertical-arrow-tip-circum-bot`, tip, UP.clone().negate(), scale * 0.92, color, scale * 0.040);
}

function buildGuide(group, id, frame, canvasAxis, scale, color) {
  // GUIDE = guide symbol only. Canvas axis controls direction; no symbol-family
  // reclassification occurs here.
  let axis = projectPerpendicular(canvasAxis, frame.pipeTangent) || projectPerpendicular(canvasAxis, UP) || frame.side.clone();
  if (axis.lengthSq() < EPS || Math.abs(axis.dot(UP)) > 0.90) axis = frame.side.clone();
  axis.normalize();
  const positiveTip = frame.point.clone().add(axis.clone().multiplyScalar(frame.pipeRadius));
  const negativeTip = frame.point.clone().add(axis.clone().multiplyScalar(-frame.pipeRadius));
  arrowFixedTip(group, `${id}-guide-positive-fixed-tip-circum`, positiveTip, axis, scale * 1.05, color, scale * 0.048);
  arrowFixedTip(group, `${id}-guide-negative-fixed-tip-circum`, negativeTip, axis.clone().negate(), scale * 1.05, color, scale * 0.048);
}

function buildLineStopOrLimit(group, id, frame, canvasAxis, scale, color, kind) {
  // LINESTOP/LIMIT = axial symbol family. Axis is only the converted canvas
  // direction. Both arrow tips are fixed to the selected OD point.
  const axis = canvasAxis.clone().normalize();
  const tip = axialOffsetTip(frame, axis);
  arrowFixedTip(group, `${id}-${kind.toLowerCase()}-canvas-axis-positive-fixed-tip`, tip, axis, scale * 1.10, color, scale * 0.052);
  arrowFixedTip(group, `${id}-${kind.toLowerCase()}-canvas-axis-negative-fixed-tip`, tip, axis.clone().negate(), scale * 1.10, color, scale * 0.052);
}

function buildSpring(group, id, frame, scale, color) {
  const tip = frame.anchors.CIRCUM_TOP.clone();
  const top = tip.clone().add(UP.clone().multiplyScalar(scale * 1.15));
  const coilStart = tip.clone().add(UP.clone().multiplyScalar(scale * 0.18));
  const coilEnd = top.clone().add(UP.clone().multiplyScalar(-scale * 0.18));
  cylinderBetween(group, `${id}-spring-center-rod`, coilStart, coilEnd, scale * 0.018, color, 12);

  const ringCount = 6;
  for (let i = 0; i < ringCount; i += 1) {
    const f = ringCount === 1 ? 0.5 : i / (ringCount - 1);
    const c = coilStart.clone().lerp(coilEnd, f);
    torus(group, `${id}-spring-visible-coil-${i + 1}`, c, UP, scale * 0.16, scale * 0.018, color);
  }

  arrowFixedTip(group, `${id}-spring-hanger-arrow-tip-circum-top`, tip, UP, scale * 0.62, color, scale * 0.036);
}

function buildUnknown(group, id, frame, scale) {
  const warning = new THREE.Mesh(new THREE.OctahedronGeometry(scale * 0.06, 0), material(0x64748b));
  warning.name = `${id}-unknown-debug-hidden-marker`;
  warning.position.copy(frame.point);
  warning.visible = false;
  group.add(warning);
}

function buildSymbolForKind(group, id, record, frame, canvasAxis, scale, color) {
  const kind = record.kind;
  if (kind === 'REST' || kind === 'SHOE' || kind === 'HOLDDOWN') buildRest(group, id, frame, scale, color);
  else if (kind === 'GUIDE') buildGuide(group, id, frame, canvasAxis, scale, color);
  else if (kind === 'LINESTOP' || kind === 'LIMIT') buildLineStopOrLimit(group, id, frame, canvasAxis, scale, color, kind);
  else if (kind === 'HANGER' || kind === 'SPRING') buildSpring(group, id, frame, scale, color);
  else if (kind === 'ANCHOR') {
    buildRest(group, id, frame, scale, color);
    buildLineStopOrLimit(group, id, frame, X_AXIS, scale, color, 'LINESTOP');
    buildGuide(group, id, frame, Z_AXIS, scale, color);
  } else buildUnknown(group, id, frame, scale);
}

export function applyBakedRestraintGlyph(object, comp = {}, options = {}) {
  if (!object || comp.type !== 'SUPPORT') return object;

  const attrs = attrsFrom(object, comp);
  const source = sourceOf(attrs, comp, options);
  const sourceRecord = normalizeSupportRecord({ ...attrs, ...comp }, {
    source,
    supportSource: source,
    index: comp.supportRecordIndex ?? comp.recordIndex ?? comp.index ?? comp.supportIndex,
  });

  const kind = sourceRecord.kind;
  const axisLabel = sourceRecord.axis;
  const canvasAxis = canvasAxisFrom(attrs, comp, axisLabel).normalize();
  const pipeAxis = pipeTangentFrom(attrs, comp, canvasAxis);
  const scale = supportScaleFor(comp, attrs, options);
  const pipeRadius = pipeRadiusFor(comp, attrs);
  const color = SUPPORT_SYMBOL_COLORS[kind] || SUPPORT_SYMBOL_COLORS.UNKNOWN;
  const id = text(comp.id || sourceRecord.recordId || object.name || 'support');

  const frame = makeCircumferenceFrame(new THREE.Vector3(0, 0, 0), pipeAxis, pipeRadius);
  sourceRecord.circumferenceAnchors = plainCircumferenceFrame(frame);

  const markerGroup = new THREE.Group();
  markerGroup.name = `${sourceRecord.recordId}-restraint-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}-v10-kind-canvas-axis`;
  const renderGlyph = `baked-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}-v10-kind-canvas-axis`;

  buildSymbolForKind(markerGroup, id, sourceRecord, frame, canvasAxis, scale, color);

  const glyphMeshes = [];
  markerGroup.traverse((child) => { if (child.isMesh) glyphMeshes.push(child); });
  glyphMeshes.forEach((child, index) => stampGlyphMetadata(child, sourceRecord, {
    scale,
    role: index === 0 ? 'baked-symbol-root' : 'baked-symbol-child',
    renderGlyph,
    canvasAxis,
  }));
  stampLayerMetadata(markerGroup, sourceRecord, { scale, role: 'baked-group' });

  const hiddenOriginalProxyMeshes = hideExistingProxyMeshes(object, markerGroup.name);
  object.add(markerGroup);
  object.userData = {
    ...(object.userData || {}),
    ...(sourceRecord.details || {}),
    AXIS: axisLabel || 'N/A',
    NODE: sourceRecord.node || 'N/A',
    SOURCE: source,
    labelText: object.userData?.labelText || `${id} ${kind}`,
    supportKind: kind,
    supportAxis: { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z },
    canvasAxis: { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z },
    pipeTangent: { x: pipeAxis.x, y: pipeAxis.y, z: pipeAxis.z },
    restraintAxis: axisLabel,
    supportSource: source,
    supportRecordId: sourceRecord.recordId,
    supportSymbolScale: scale,
    supportPipeRadius: pipeRadius,
    circumferenceAnchors: sourceRecord.circumferenceAnchors,
    renderGlyph,
    renderScale: scale,
    visualProfile: RESTRAINT_VISUAL_PROFILE.id,
    glbShape: `support-reference-v10-kind-canvas-axis-${kind.toLowerCase()}`,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiTrace: supportTraceFromRecord(sourceRecord, {
      renderGlyph,
      renderScale: scale,
      visualProfile: RESTRAINT_VISUAL_PROFILE.id,
      circumferenceAnchors: sourceRecord.circumferenceAnchors,
      canvasAxis: { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z },
      placementContract: 'kind-decides-symbol-axis-only-canvas-direction-fixed-tip-circumference',
    }),
    bmCiiRestraintVisualProfile: visualProfileMetadata({ kind, source, axisLabel, scale, role: 'baked-object-root' }),
    supportSymbolContract: sourceRecord.supportSymbolContract || supportSymbolContractFor(kind),
    supportPlacementContract: 'kind-decides-symbol-axis-only-canvas-direction-fixed-tip-circumference',
    directionalSupportEnhanced: true,
    directionalSupportSymbolCount: markerGroup.children.length,
    supportReferenceStyle: true,
    supportReferenceStyleV10KindCanvasAxis: true,
    fixedTipScaleApplied: true,
    hiddenOriginalProxyMeshCount: hiddenOriginalProxyMeshes.length,
  };
  return object;
}
