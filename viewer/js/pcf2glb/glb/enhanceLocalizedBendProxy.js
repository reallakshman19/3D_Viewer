import * as THREE from 'three';
import { buildCompactElbowContractObject } from './CompactElbowContract.js';

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function pointVector(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const z = Number(point?.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function text(value) {
  return String(value ?? '').trim();
}

function hasSuppressedCaesarBend(comp = {}) {
  const attrs = comp.attributes || {};
  return comp.bendDisplayMode === 'straight-pipe-with-local-bend-metadata'
    || attrs.CAESAR_BEND_SUPPRESSED_FULL_CURVE === 'true'
    || attrs.CAESAR_BEND_DISPLAY_MODE === 'STRAIGHT_PIPE_WITH_LOCAL_BEND_METADATA';
}

function safeBasis(direction) {
  const dir = direction.clone().normalize();
  let up = new THREE.Vector3(0, 0, 1);
  if (Math.abs(dir.dot(up)) > 0.92) up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const normal = new THREE.Vector3().crossVectors(side, dir).normalize();
  return { dir, side, normal };
}

function bendLabel(comp = {}) {
  const node = text(comp.bendNode || comp.attributes?.BEND_NODE);
  const radius = numberOrNull(comp.bendRadius ?? comp.attributes?.BEND_RADIUS);
  const angle = numberOrNull(comp.bendAngleDeg ?? comp.attributes?.BEND_ANGLE_DEG);
  return [
    'BEND',
    node ? `N${node}` : '',
    radius != null ? `R${Math.round(radius)}` : '',
    angle != null ? `A${Math.round(angle)}°` : '',
  ].filter(Boolean).join(' ');
}

function makeBendLabelAnchor({ comp, center, side, bore }) {
  const anchor = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(bore * 0.08, 2.5), 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.25,
      roughness: 0.45,
    }),
  );
  anchor.position.copy(center.clone().add(side.clone().multiplyScalar(Math.max(bore * 1.65, 42))));
  anchor.name = `label:${comp.id}:localized-bend`;
  anchor.userData = {
    id: `${comp.id}:localized-bend-label`,
    sourceComponentId: comp.id,
    glbShape: 'localized-bend-label-anchor',
    labelAnchor: true,
    labelKind: 'component',
    labelText: bendLabel(comp),
    bendRadius: numberOrNull(comp.bendRadius ?? comp.attributes?.BEND_RADIUS),
    bendAngleDeg: numberOrNull(comp.bendAngleDeg ?? comp.attributes?.BEND_ANGLE_DEG),
    bendNode: text(comp.bendNode || comp.attributes?.BEND_NODE),
  };
  return anchor;
}

export function enhanceLocalizedBendProxy(object, comp = {}) {
  if (!object || !hasSuppressedCaesarBend(comp)) return object;

  const p1 = pointVector(comp.ep1);
  const p2 = pointVector(comp.ep2);
  if (!p1 || !p2) return object;
  const delta = new THREE.Vector3().subVectors(p2, p1);
  const chord = delta.length();
  if (!Number.isFinite(chord) || chord <= 0.001) return object;

  const bore = Math.max(numberOrNull(comp.bore ?? comp.ep1?.bore ?? comp.ep2?.bore) || 20, 5);
  const { dir, side } = safeBasis(delta);
  const center = p2.clone();

  const group = new THREE.Group();
  group.name = object.name || comp.id || 'localized-bend-component';
  group.userData = {
    ...(object.userData || {}),
    glbShape: 'pipe-with-compact-localized-bend',
    localizedBendProxy: true,
    bendRadius: numberOrNull(comp.bendRadius ?? comp.attributes?.BEND_RADIUS),
    bendAngleDeg: numberOrNull(comp.bendAngleDeg ?? comp.attributes?.BEND_ANGLE_DEG),
    bendNode: text(comp.bendNode || comp.attributes?.BEND_NODE),
    bmCiiBendVisualContract: 'compact-standard-elbow-1p5d',
  };

  group.add(object);

  const marker = new THREE.Group();
  marker.name = `${comp.id}-localized-bend-marker`;
  marker.userData = {
    glbShape: 'localized-compact-elbow-marker',
    localizedBendProxy: true,
    bendRadius: group.userData.bendRadius,
    bendAngleDeg: group.userData.bendAngleDeg,
    bendNode: group.userData.bendNode,
    bmCiiBendVisualContract: 'compact-standard-elbow-1p5d',
  };

  const compactArc = buildCompactElbowContractObject({
    ...comp,
    ep1: comp.ep1,
    ep2: comp.ep2,
    bendVertex: { x: center.x, y: center.y, z: center.z },
  }, { includeStraightLegs: false, color: 0xf59e0b });
  if (compactArc) {
    compactArc.name = `${comp.id}-localized-bend-arc`;
    compactArc.userData = {
      ...(compactArc.userData || {}),
      glbShape: 'localized-compact-elbow-arc',
      localizedBendProxy: true,
      bmCiiBendVisualContract: 'compact-standard-elbow-1p5d',
    };
    marker.add(compactArc);
  }
  marker.add(makeBendLabelAnchor({ comp, center: center.clone().add(dir.clone().multiplyScalar(-Math.min(chord * 0.06, bore * 2))), side, bore }));
  group.add(marker);

  return group;
}
