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
import { applyBakedRestraintGlyph as applyLegacyBakedRestraintGlyph } from './BakedRestraintGlyphGeometry.js';

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

function canvasAxisFromLabel(axisLabel = '') {
  const normalized = normalizeRestraintAxisLabel(axisLabel);
  if (normalized.includes('X')) return normalized.startsWith('-') ? X_AXIS.clone().negate() : X_AXIS.clone();
  if (normalized.includes('Y')) return normalized.startsWith('-') ? Y_AXIS.clone().negate() : Y_AXIS.clone();
  if (normalized.includes('Z')) return normalized.startsWith('-') ? Z_AXIS.clone().negate() : Z_AXIS.clone();
  return null;
}

function canvasAxisFrom(attrs = {}, comp = {}, axisLabel = '') {
  return vectorFrom(comp.supportAxis)
    || vectorFrom(attrs.supportAxis)
    || vectorFrom(attrs.SUPPORT_AXIS)
    || vectorFrom(attrs.caesarSupportAxis)
    || vectorFrom(attrs.restraintAxisVector)
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
    supportReferenceStyleV9FixedTipScale: true,
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
        placementContract: 'kind-decides-symbol-axis-decides-canvas-direction-fixed-tip-circumference',
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
      },
  };
}

function buildCanvasAxisLineStopOrLimit(group, id, frame, canvasAxis, scale, color, kind) {
  const tip = frame.anchors.CIRCUM_BOT.clone();
  const axis = canvasAxis.clone().normalize();
  // KIND decides symbol family; X/Y/Z is only the converted canvas direction.
  // 3x review scale lengthens the tail and thickens the arrow only. The cone
  // apex/tip remains exactly fixed at the saved CIRCUM_BOT coordinate.
  arrowFixedTip(group, `${id}-${kind.toLowerCase()}-canvas-axis-positive-tip-circum-bot`, tip, axis, scale * 1.10, color, scale * 0.052);
  arrowFixedTip(group, `${id}-${kind.toLowerCase()}-canvas-axis-negative-tip-circum-bot`, tip, axis.clone().negate(), scale * 1.10, color, scale * 0.052);
}

function applyCanvasAxisLineStopLimit(object, comp = {}, options = {}) {
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
  markerGroup.name = `${sourceRecord.recordId}-restraint-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}-canvas-axis-fixed-tip`;
  const renderGlyph = `baked-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}-canvas-axis-fixed-tip`;

  buildCanvasAxisLineStopOrLimit(markerGroup, id, frame, canvasAxis, scale, color, kind);

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
    glbShape: `support-reference-v9-fixed-tip-canvas-axis-${kind.toLowerCase()}`,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiTrace: supportTraceFromRecord(sourceRecord, {
      renderGlyph,
      renderScale: scale,
      visualProfile: RESTRAINT_VISUAL_PROFILE.id,
      circumferenceAnchors: sourceRecord.circumferenceAnchors,
      canvasAxis: { x: canvasAxis.x, y: canvasAxis.y, z: canvasAxis.z },
      placementContract: 'kind-decides-symbol-axis-decides-canvas-direction-fixed-tip-circumference',
    }),
    bmCiiRestraintVisualProfile: visualProfileMetadata({ kind, source, axisLabel, scale, role: 'baked-object-root' }),
    supportSymbolContract: sourceRecord.supportSymbolContract || supportSymbolContractFor(kind),
    supportPlacementContract: 'kind-decides-symbol-axis-decides-canvas-direction-fixed-tip-circumference',
    directionalSupportEnhanced: true,
    directionalSupportSymbolCount: markerGroup.children.length,
    supportReferenceStyle: true,
    supportReferenceStyleV9FixedTipScale: true,
    fixedTipScaleApplied: true,
    hiddenOriginalProxyMeshCount: hiddenOriginalProxyMeshes.length,
  };
  return object;
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

  if (sourceRecord.kind === 'LINESTOP' || sourceRecord.kind === 'LIMIT') {
    return applyCanvasAxisLineStopLimit(object, comp, options);
  }

  return applyLegacyBakedRestraintGlyph(object, comp, options);
}
