import * as THREE from 'three';
import { COLORS, cylinderBetween, mat } from './InputXmlBasicGeometry.js';

const anchorRectMat = mat(COLORS.guide, { emissive: 0x003322, emissiveIntensity: 0.08 });
const unknownCrossMat = mat(COLORS.warning, { emissive: 0x332200, emissiveIntensity: 0.12 });

function supportCenter(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return object.position.clone();
  return box.getCenter(new THREE.Vector3());
}

function parentLocalCenter(object) {
  const parent = object.parent || object;
  const center = supportCenter(object);
  return { parent, center: parent.worldToLocal(center.clone()) };
}

function addRectangleFrame(group, center, width, height, radius, name) {
  const halfW = width / 2;
  const halfH = height / 2;
  const corners = [
    center.clone().add(new THREE.Vector3(-halfW, 0, -halfH)),
    center.clone().add(new THREE.Vector3(halfW, 0, -halfH)),
    center.clone().add(new THREE.Vector3(halfW, 0, halfH)),
    center.clone().add(new THREE.Vector3(-halfW, 0, halfH))
  ];
  for (let i = 0; i < corners.length; i += 1) {
    const stroke = cylinderBetween(corners[i], corners[(i + 1) % corners.length], radius, anchorRectMat, 10, `${name}_stroke_${i + 1}`);
    stroke.userData = { TYPE: 'SUPPORT_RESTRAINT_SHAPE_FIX_STROKE', shape: 'ANC_RECTANGLE' };
    group.add(stroke);
  }
}

function addUnknownCross(group, center, size, radius, name) {
  const a1 = center.clone().add(new THREE.Vector3(-size, size, 0));
  const a2 = center.clone().add(new THREE.Vector3(size, -size, 0));
  const b1 = center.clone().add(new THREE.Vector3(-size, -size, 0));
  const b2 = center.clone().add(new THREE.Vector3(size, size, 0));
  for (const [index, start, end] of [[1, a1, a2], [2, b1, b2]]) {
    const stroke = cylinderBetween(start, end, radius, unknownCrossMat, 10, `${name}_stroke_${index}`);
    stroke.userData = { TYPE: 'SUPPORT_RESTRAINT_SHAPE_FIX_STROKE', shape: 'UNKNOWN_CROSS' };
    group.add(stroke);
  }
}

export function applyInputXmlRestraintShapeFixes(scene, model, options = {}) {
  if (options.restraintShapeFixes === false) return { applied: false, reason: 'disabled-by-option' };
  const stats = { applied: true, anchors: 0, unknownCrosses: 0 };
  scene.traverse((object) => {
    if (object.userData?.TYPE !== 'SUPPORT_RESTRAINT') return;
    if (object.userData.restraintShapeFixApplied) return;
    const family = String(object.userData.family || '').toUpperCase();
    if (family === 'ANCHOR') {
      const { parent, center } = parentLocalCenter(object);
      const fix = new THREE.Group();
      fix.name = `${object.name || 'ANCHOR'}_ANC_RECTANGLE`;
      fix.userData = { TYPE: 'SUPPORT_RESTRAINT_SHAPE_FIX', family, shape: 'ANC_RECTANGLE' };
      addRectangleFrame(fix, center, 1.3, 0.9, 0.035, fix.name);
      parent.add(fix);
      object.userData.restraintShapeFixApplied = 'ANC_RECTANGLE';
      stats.anchors += 1;
    } else if (family === 'AXIS_RESTRAINT_UNRESOLVED') {
      const { parent, center } = parentLocalCenter(object);
      const fix = new THREE.Group();
      fix.name = `${object.name || 'UNRESOLVED'}_UNKNOWN_CROSS`;
      fix.userData = { TYPE: 'SUPPORT_RESTRAINT_SHAPE_FIX', family, shape: 'UNKNOWN_CROSS' };
      addUnknownCross(fix, center, 0.36, 0.035, fix.name);
      parent.add(fix);
      object.userData.restraintShapeFixApplied = 'UNKNOWN_CROSS';
      stats.unknownCrosses += 1;
    }
  });
  return stats;
}
