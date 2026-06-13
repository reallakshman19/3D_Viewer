import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const KIND_COLORS = {
  REST: 0x22c55e,
  GUIDE: 0x16a34a,
  LINESTOP: 0xf59e0b,
  LIMIT: 0xf97316,
  ANCHOR: 0xef4444,
  SPRING: 0xa855f7,
  HANGER: 0xa855f7,
  SHOE: 0x22c55e,
  UNKNOWN: 0x94a3b8,
};

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function attrsFrom(object, comp = {}) {
  return {
    ...(comp.raw || {}),
    ...(comp.attributes || {}),
    ...(object?.userData || {}),
  };
}

function supportKind(attrs = {}, comp = {}) {
  const kind = upper(comp.supportKind || attrs.supportKind || attrs.SUPPORT_KIND || attrs.CAESAR_SUPPORT_KIND || attrs.caesarSupportKind || attrs.CMPSUPTYPE || attrs.SKEY);
  if (kind === 'LINE_STOP') return 'LINESTOP';
  if (kind === 'HANGER') return 'HANGER';
  if (KIND_COLORS[kind]) return kind;
  return 'UNKNOWN';
}

function cosineAxis(attrs = {}) {
  const x = number(attrs.caesarXCosine ?? attrs.XCOSINE ?? attrs.X_COSINE ?? attrs.XCOS ?? attrs.X);
  const y = number(attrs.caesarYCosine ?? attrs.YCOSINE ?? attrs.Y_COSINE ?? attrs.YCOS ?? attrs.Y);
  const z = number(attrs.caesarZCosine ?? attrs.ZCOSINE ?? attrs.Z_COSINE ?? attrs.ZCOS ?? attrs.Z);
  if ([x, y, z].some((value) => value == null)) return null;
  const axis = new THREE.Vector3(x, y, z);
  return axis.length() < 0.01 ? null : axis.normalize();
}

function textAxis(attrs = {}) {
  const src = upper([
    attrs.SUPPORT_DIRECTION,
    attrs['SUPPORT-DIRECTION'],
    attrs.SUPPORT_NAME,
    attrs.SUPPORT_TAG,
    attrs.labelText,
  ].join(' '));
  if (/\bX\b|\bEAST\b|\bWEST\b/.test(src)) return new THREE.Vector3(1, 0, 0);
  if (/\bY\b|\bUP\b|\bDOWN\b|\bVERTICAL\b/.test(src)) return new THREE.Vector3(0, 1, 0);
  if (/\bZ\b|\bNORTH\b|\bSOUTH\b/.test(src)) return new THREE.Vector3(0, 0, 1);
  return null;
}

function supportAxis(attrs = {}) {
  return cosineAxis(attrs) || textAxis(attrs) || Z_AXIS.clone();
}

function perpendicular(axis) {
  const basis = Math.abs(axis.dot(UP)) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP;
  const side = new THREE.Vector3().crossVectors(axis, basis);
  return side.length() < 0.01 ? new THREE.Vector3(1, 0, 0) : side.normalize();
}

function orientFromY(object, direction) {
  object.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
}

function orientFromZ(object, direction) {
  object.quaternion.setFromUnitVectors(Z_AXIS, direction.clone().normalize());
}

function addBox(group, name, size, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05 }),
  );
  mesh.name = name;
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function addCylinder(group, name, radius, length, axis, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.05 }),
  );
  mesh.name = name;
  mesh.position.copy(position);
  orientFromY(mesh, axis);
  group.add(mesh);
  return mesh;
}

function addPlate(group, name, axis, radius, color) {
  const side = perpendicular(axis);
  const vertical = new THREE.Vector3().crossVectors(axis, side).normalize();
  const plate = addBox(
    group,
    name,
    new THREE.Vector3(radius * 0.45, radius * 2.6, radius * 2.6),
    axis.clone().multiplyScalar(radius * 2.4),
    color,
  );
  plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis, vertical, side));
  return plate;
}

function addArrow(group, name, axis, radius, dist, color) {
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.55, radius * 1.8, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  arrow.name = name;
  arrow.position.copy(axis.clone().normalize().multiplyScalar(dist));
  orientFromY(arrow, axis);
  group.add(arrow);
  return arrow;
}

function addGuideBars(group, id, axis, radius, color) {
  const side = axis.clone().normalize();
  const barSize = new THREE.Vector3(radius * 0.45, radius * 3.4, radius * 0.75);
  const pos = side.clone().multiplyScalar(radius * 2.2);
  const neg = side.clone().multiplyScalar(-radius * 2.2);
  addBox(group, `${id}-guide-bar-positive`, barSize, pos, color);
  addBox(group, `${id}-guide-bar-negative`, barSize, neg, color);
  addArrow(group, `${id}-guide-axis-positive`, side, radius, radius * 3.4, color);
  addArrow(group, `${id}-guide-axis-negative`, side.clone().negate(), radius, radius * 3.4, color);
}

function addRestBase(group, id, axis, radius, color) {
  const supportAxis = axis.length() > 0.01 ? axis.clone().normalize() : UP.clone();
  addBox(group, `${id}-rest-base`, new THREE.Vector3(radius * 3.2, radius * 0.45, radius * 2.4), supportAxis.clone().multiplyScalar(-radius * 2.25), color);
  addArrow(group, `${id}-rest-axis`, supportAxis.clone().negate(), radius, radius * 3.2, color);
}

function addLineStop(group, id, axis, radius, color) {
  const a = axis.clone().normalize();
  addPlate(group, `${id}-linestop-plate-positive`, a, radius, color);
  addPlate(group, `${id}-linestop-plate-negative`, a.clone().negate(), radius, color);
  addArrow(group, `${id}-linestop-axis-positive`, a, radius, radius * 3.5, color);
  addArrow(group, `${id}-linestop-axis-negative`, a.clone().negate(), radius, radius * 3.5, color);
}

function addLimit(group, id, axis, radius, color) {
  const a = axis.clone().normalize();
  addPlate(group, `${id}-limit-stop-plate`, a, radius, color);
  addArrow(group, `${id}-limit-axis`, a, radius, radius * 3.4, color);
}

function addAnchor(group, id, radius, color) {
  addBox(group, `${id}-anchor-block`, new THREE.Vector3(radius * 2.3, radius * 2.3, radius * 2.3), new THREE.Vector3(), color);
  [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  ].forEach((axis, index) => addArrow(group, `${id}-anchor-axis-${index + 1}`, axis, radius * 0.8, radius * 3.4, color));
}

function addHanger(group, id, radius, color) {
  const rodAxis = UP.clone();
  addCylinder(group, `${id}-hanger-rod`, Math.max(radius * 0.14, 0.8), radius * 5.5, rodAxis, new THREE.Vector3(0, radius * 3.2, 0), color);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.9, Math.max(radius * 0.08, 0.5), 8, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
  );
  ring.name = `${id}-hanger-ring`;
  ring.position.set(0, radius * 6.0, 0);
  orientFromZ(ring, UP);
  group.add(ring);
}

function addShoe(group, id, radius, color) {
  addBox(group, `${id}-shoe-base`, new THREE.Vector3(radius * 3.2, radius * 0.5, radius * 2.2), new THREE.Vector3(0, -radius * 2.2, 0), color);
  addCylinder(group, `${id}-shoe-post`, radius * 0.22, radius * 2.2, UP, new THREE.Vector3(0, -radius * 1.1, 0), color);
}

export function enhanceSupportDirectionProxy(object, comp = {}) {
  if (!object || comp.type !== 'SUPPORT') return object;
  const attrs = attrsFrom(object, comp);
  const kind = supportKind(attrs, comp);
  const axis = supportAxis(attrs);
  const radius = Math.max((Number(comp.bore) || Number(attrs.bore) || 20) / 2, 5);
  const color = KIND_COLORS[kind] || KIND_COLORS.UNKNOWN;
  const id = text(comp.id || object.name || 'support');

  const markerGroup = new THREE.Group();
  markerGroup.name = `${id}-directional-symbols`;
  markerGroup.userData = {
    labelText: object.userData?.labelText || `${id} ${kind}`,
    labelAnchor: false,
    supportKind: kind,
    supportAxis: { x: axis.x, y: axis.y, z: axis.z },
    glbShape: `support-directional-${kind.toLowerCase()}`,
  };

  if (kind === 'GUIDE') addGuideBars(markerGroup, id, axis, radius, color);
  else if (kind === 'LINESTOP') addLineStop(markerGroup, id, axis, radius, color);
  else if (kind === 'LIMIT') addLimit(markerGroup, id, axis, radius, color);
  else if (kind === 'ANCHOR') addAnchor(markerGroup, id, radius, color);
  else if (kind === 'SPRING' || kind === 'HANGER') addHanger(markerGroup, id, radius, color);
  else if (kind === 'SHOE') addShoe(markerGroup, id, radius, color);
  else addRestBase(markerGroup, id, axis.y > 0.5 ? axis : UP, radius, color);

  object.add(markerGroup);
  object.userData = {
    ...(object.userData || {}),
    supportKind: kind,
    supportAxis: { x: axis.x, y: axis.y, z: axis.z },
    directionalSupportEnhanced: true,
    directionalSupportSymbolCount: markerGroup.children.length,
  };
  return object;
}
