import * as THREE from 'three';
import { COLORS, mat, vectorFrom, cylinderBetween, orthogonal } from './InputXmlBasicGeometry.js';

const SCALE = 0.01;
const VISUAL_SCALE = 1.5;
const anchorMat = mat(0xffa733, { emissive: 0x3b2100, emissiveIntensity: 0.18 });
const unknownMat = mat(0xffd84d, { emissive: 0x3b3000, emissiveIntensity: 0.2 });

export function applyInputXmlRestraintShapeFixes(scene, model) {
  const stats = {
    version: '1.0.0-anchor-rect-cross',
    anchorRects: 0,
    unknownCrosses: 0,
    guideFallbacksChanged: 0,
    visualScale: '1.5x-symbol-geometry',
    engineeringContactScale: '1x'
  };
  if (!scene || !model) return stats;

  const roots = [];
  scene.traverse((obj) => {
    if (obj?.userData?.TYPE === 'SUPPORT_RESTRAINT') roots.push(obj);
  });

  const elementByNode = buildElementIndex(model);
  for (const root of roots) {
    const family = String(root.userData?.family || '').toUpperCase();
    const nodeId = String(root.userData?.node || '').trim();
    const node = model.nodes?.get?.(String(Number(nodeId)));
    if (!node) continue;
    const p = vectorFrom(node, SCALE);
    const tangent = localTangent(elementByNode, nodeId);
    const od = localOd(elementByNode, nodeId) * SCALE;

    if (family === 'ANCHOR') {
      replaceChildren(root, anchorRect(p, tangent, od, `${root.name || 'ANCHOR'}_RECT`));
      root.name = `${root.name || `ANCHOR_${nodeId}`}_RECTANGULAR_STOP`;
      root.userData = {
        ...(root.userData || {}),
        family: 'ANCHOR',
        anchorSymbol: 'rectangular-stop',
        visualScale: '1.5x-symbol-geometry',
        engineeringContactScale: '1x'
      };
      stats.anchorRects += 1;
    } else if (family === 'AXIS_RESTRAINT' || family === 'AXIS_RESTRAINT_UNRESOLVED' || family === 'UNKNOWN_CROSS') {
      replaceChildren(root, unknownCross(p, tangent, od, `${root.name || 'UNKNOWN'}_CROSS`));
      root.name = `${root.name || `UNKNOWN_${nodeId}`}_CROSS`;
      root.userData = {
        ...(root.userData || {}),
        family: 'UNKNOWN_CROSS',
        unresolvedFallback: 'UNKNOWN_CROSS',
        visualScale: '1.5x-symbol-geometry',
        engineeringContactScale: '1x'
      };
      stats.unknownCrosses += 1;
    }
  }

  scene.userData = {
    ...(scene.userData || {}),
    restraintShapeFixVersion: stats.version,
    anchorSymbol: 'rectangular-stop',
    unknownRestraintSymbol: 'cross-marker',
    restraintVisualScale: '1.5x-symbol-geometry',
    engineeringContactScale: '1x'
  };
  return stats;
}

function replaceChildren(root, replacement) {
  while (root.children?.length) root.remove(root.children[0]);
  root.add(replacement);
}

function anchorRect(point, tangent, od, name) {
  const frame = supportFrame(tangent);
  const thickness = Math.max(0.12, od * 0.10) * VISUAL_SCALE;
  const height = Math.max(0.42, od * 0.95) * VISUAL_SCALE;
  const width = Math.max(0.52, od * 1.15) * VISUAL_SCALE;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, width), anchorMat);
  mesh.name = name;
  mesh.position.copy(point);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.axis, frame.up, frame.side));
  mesh.userData = { meshRole: 'ANCHOR_RECTANGULAR_STOP', engineeringContactScale: '1x' };
  return mesh;
}

function unknownCross(point, tangent, od, name) {
  const frame = supportFrame(tangent);
  const center = point.clone()
    .add(frame.up.clone().multiplyScalar(Math.max(0.55, od * 0.45)))
    .add(frame.side.clone().multiplyScalar(Math.max(0.12, od * 0.10)));
  const size = Math.max(0.34, od * 0.34) * VISUAL_SCALE;
  const radius = 0.055 * VISUAL_SCALE;
  const a = frame.up.clone().add(frame.side).normalize().multiplyScalar(size / 2);
  const b = frame.up.clone().sub(frame.side).normalize().multiplyScalar(size / 2);
  const group = new THREE.Group();
  group.name = name;
  const strokeA = cylinderBetween(center.clone().sub(a), center.clone().add(a), radius, unknownMat, 8, `${name}_A`);
  const strokeB = cylinderBetween(center.clone().sub(b), center.clone().add(b), radius, unknownMat, 8, `${name}_B`);
  strokeA.userData = { meshRole: 'UNKNOWN_RESTRAINT_CROSS_STROKE' };
  strokeB.userData = { meshRole: 'UNKNOWN_RESTRAINT_CROSS_STROKE' };
  group.add(strokeA, strokeB);
  return group;
}

function supportFrame(tangent) {
  const axis = tangent.clone().normalize();
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(up.dot(axis)) > 0.88) up = orthogonal(axis).normalize();
  up.sub(axis.clone().multiplyScalar(up.dot(axis)));
  if (up.lengthSq() < 1e-8) up = orthogonal(axis).normalize();
  else up.normalize();
  const side = new THREE.Vector3().crossVectors(axis, up).normalize();
  return { axis, up, side };
}

function buildElementIndex(model) {
  const index = new Map();
  for (const el of model.elements || []) {
    for (const n of [el.fromNode, el.toNode]) {
      const key = String(Number(n));
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(el);
    }
  }
  return index;
}

function localTangent(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return new THREE.Vector3(1, 0, 0);
  const e = els[0];
  const v = new THREE.Vector3(e.dx, e.dy, e.dz);
  return v.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : v.normalize();
}

function localOd(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return 100;
  return resolvedBoreMm(els[0], 100);
}

function resolvedBoreMm(element, fallback = 100) {
  const n = numeric(element?.props?.bore, element?.props?.boreMm || fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function numeric(value, fallback = 0) {
  const raw = typeof value === 'object' && value ? value.value : value;
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}
