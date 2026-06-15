import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const DEFAULT_RADIUS_RATIO_D = 1.5;
const DEFAULT_BEND_ANGLE_DEG = 90;
const EPS = 1e-6;

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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

function safeNormalize(vector, fallback = Z_AXIS) {
  if (!vector || vector.length() < EPS) return fallback.clone().normalize();
  return vector.clone().normalize();
}

function safeBendNormal(incoming, preferred = null) {
  const fallbackBasis = Math.abs(incoming.dot(UP)) > 0.92 ? new THREE.Vector3(1, 0, 0) : UP;
  let normal = preferred && preferred.length() > EPS ? preferred.clone() : new THREE.Vector3().crossVectors(incoming, fallbackBasis);
  if (normal.length() < EPS) normal = new THREE.Vector3().crossVectors(incoming, new THREE.Vector3(1, 0, 0));
  if (normal.length() < EPS) normal = new THREE.Vector3(0, 0, 1);
  return normal.normalize();
}

function rotateAroundAxis(vector, axis, angleRad) {
  return vector.clone().applyAxisAngle(axis, angleRad).normalize();
}

class CircularArcCurve3 extends THREE.Curve {
  constructor(center, radiusVectorStart, normal, angleRad) {
    super();
    this.center = center.clone();
    this.radiusVectorStart = radiusVectorStart.clone();
    this.normal = normal.clone().normalize();
    this.angleRad = angleRad;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return target.copy(this.radiusVectorStart)
      .applyAxisAngle(this.normal, this.angleRad * t)
      .add(this.center);
  }
}

function bendRadiusFromComponent(comp = {}, nominalDiameter) {
  const explicit = numberOrNull(comp.bendRadius)
    ?? numberOrNull(comp.attributes?.BEND_RADIUS)
    ?? numberOrNull(comp.raw?.inputXmlBendRadius)
    ?? numberOrNull(comp.raw?.BEND_RADIUS)
    ?? numberOrNull(comp.raw?.RADIUS)
    ?? numberOrNull(comp.raw?.CURVE_RADIUS);

  // BM_CII visual contract is standard long-radius elbow. If the source radius is
  // absent or implausibly short/long for visual benchmark geometry, use 1.5D.
  const defaultRadius = nominalDiameter * DEFAULT_RADIUS_RATIO_D;
  if (!explicit) return defaultRadius;
  const ratio = explicit / nominalDiameter;
  if (ratio < 1.25 || ratio > 1.75) return defaultRadius;
  return explicit;
}

function bendAngleDegFromComponent(comp = {}) {
  return numberOrNull(comp.bendAngleDeg)
    ?? numberOrNull(comp.attributes?.BEND_ANGLE_DEG)
    ?? numberOrNull(comp.raw?.inputXmlBendAngleDeg)
    ?? numberOrNull(comp.raw?.BEND_ANGLE)
    ?? numberOrNull(comp.raw?.ANGLE)
    ?? DEFAULT_BEND_ANGLE_DEG;
}

function endpointPair(comp = {}) {
  const p1 = pointVector(comp.ep1 || comp.centrePoint || comp.coOrds);
  const p2 = pointVector(comp.ep2 || comp.branch1Point || comp.centrePoint || comp.coOrds);
  return { p1, p2 };
}

function makeCylinderBetween(start, end, radius, color, name) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.01) return null;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05 }),
  );
  mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
  mesh.name = name;
  return mesh;
}

function resolveBendVertex({ comp, p1, p2, incoming, outgoing, cutback }) {
  const explicit = pointVector(comp.bendVertex || comp.bendPoint || comp.vertexPoint || comp.attributes?.BEND_VERTEX);
  if (explicit) return explicit;

  const bendNode = text(comp.bendNode || comp.attributes?.BEND_NODE || comp.raw?.inputXmlBendNode);
  const toNode = text(comp.toNode || comp.attributes?.TO_NODE || comp.raw?.TO_NODE);
  const fromNode = text(comp.fromNode || comp.attributes?.FROM_NODE || comp.raw?.FROM_NODE);
  if (bendNode && toNode && bendNode === toNode) return p2.clone();
  if (bendNode && fromNode && bendNode === fromNode) return p1.clone();

  const span = p1.distanceTo(p2);
  if (span > cutback * 2.4) return new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  return new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
}

export function compactElbowMetrics(comp = {}) {
  const { p1, p2 } = endpointPair(comp);
  if (!p1 || !p2 || p1.distanceTo(p2) < 0.01) return null;

  const nominalDiameter = Math.max(numberOrNull(comp.bore ?? comp.ep1?.bore ?? comp.ep2?.bore) || 20, 1);
  const pipeRadius = nominalDiameter / 2;
  const radius = bendRadiusFromComponent(comp, nominalDiameter);
  const rawAngleDeg = bendAngleDegFromComponent(comp);
  const angleDeg = Math.min(135, Math.max(15, Math.abs(rawAngleDeg || DEFAULT_BEND_ANGLE_DEG)));
  const angleRad = THREE.MathUtils.degToRad(angleDeg);
  const incoming = safeNormalize(new THREE.Vector3().subVectors(p2, p1));
  const normal = safeBendNormal(incoming);
  const outgoing = rotateAroundAxis(incoming, normal, angleRad);
  const cutback = Math.max(pipeRadius, radius * Math.tan(angleRad / 2));
  const vertex = resolveBendVertex({ comp, p1, p2, incoming, outgoing, cutback });
  const tangent1 = vertex.clone().add(incoming.clone().multiplyScalar(-cutback));
  const tangent2 = vertex.clone().add(outgoing.clone().multiplyScalar(cutback));
  const radial1 = new THREE.Vector3().crossVectors(normal, incoming).normalize();
  const center = tangent1.clone().add(radial1.multiplyScalar(radius));
  const radiusVectorStart = tangent1.clone().sub(center);
  const radiusVectorEnd = tangent2.clone().sub(center);
  const arcChord = tangent1.distanceTo(tangent2);
  const expectedArcChord = 2 * radius * Math.sin(angleRad / 2);
  const arcLength = radius * angleRad;
  const sourceSpanLength = p1.distanceTo(p2);

  return {
    p1,
    p2,
    vertex,
    tangent1,
    tangent2,
    center,
    incoming,
    outgoing,
    normal,
    radiusVectorStart,
    radiusVectorEnd,
    nominalDiameter,
    pipeRadius,
    radius,
    radiusRatioD: radius / nominalDiameter,
    angleDeg,
    angleRad,
    cutback,
    arcChord,
    expectedArcChord,
    arcLength,
    sourceSpanLength,
  };
}

export function buildCompactElbowContractObject(comp = {}, options = {}) {
  const metrics = compactElbowMetrics(comp);
  if (!metrics) return null;

  const color = options.color ?? 0xaa55aa;
  const includeStraightLegs = options.includeStraightLegs !== false;
  const group = new THREE.Group();
  group.name = comp.id || 'compact-elbow';

  const arcCurve = new CircularArcCurve3(metrics.center, metrics.radiusVectorStart, metrics.normal, metrics.angleRad);
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(arcCurve, 32, metrics.pipeRadius, 18, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05 }),
  );
  arc.name = `${group.name}-compact-elbow-arc`;
  arc.userData = { bmCiiBendPrimitiveRole: 'compact-elbow-arc' };
  group.add(arc);

  if (includeStraightLegs) {
    const legA = makeCylinderBetween(metrics.p1, metrics.tangent1, metrics.pipeRadius, color, `${group.name}-straight-leg-in`);
    const legB = makeCylinderBetween(metrics.tangent2, metrics.p2, metrics.pipeRadius, color, `${group.name}-straight-leg-out`);
    if (legA) group.add(legA);
    if (legB) group.add(legB);
  }

  group.userData = {
    ...(comp.attributes || {}),
    ...(comp.raw || {}),
    pcfType: comp.type,
    pcfId: comp.id,
    bore: metrics.nominalDiameter,
    labelText: comp.label || comp.name || comp.refNo || comp.id,
    glbShape: 'compact-standard-elbow-1p5d',
    bmCiiBendVisualContract: 'compact-standard-elbow-1p5d',
    bmCiiCompactElbowContract: true,
    bendCurveType: 'CircularArcCurve3',
    bendRadius: metrics.radius,
    bendAngleDeg: metrics.angleDeg,
    bendRadiusRatioD: metrics.radiusRatioD,
    bendTangentCutback: metrics.cutback,
    bendArcChord: metrics.arcChord,
    bendExpectedArcChord: metrics.expectedArcChord,
    bendArcLength: metrics.arcLength,
    bendSourceSpanLength: metrics.sourceSpanLength,
    bendVertex: metrics.vertex.toArray(),
    bendTangentPoint1: metrics.tangent1.toArray(),
    bendTangentPoint2: metrics.tangent2.toArray(),
    bendMetadataSource: comp.bendMetadataSource || comp.attributes?.BEND_METADATA_SOURCE || 'BM_CII_TOPOLOGY_COMPACT_ELBOW',
  };

  return group;
}

export function enforceCompactElbowContract(object, comp = {}, options = {}) {
  const type = text(comp.type).toUpperCase();
  if (!['BEND', 'ELBOW'].includes(type)) return object;
  return buildCompactElbowContractObject(comp, { ...options, includeStraightLegs: true }) || object;
}
