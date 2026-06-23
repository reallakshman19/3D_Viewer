const EPS = 1e-9;

export function resolveNonPrimitiveAutoBends(input = {}, options = {}) {
  const sourceKind = input.sourceKind || 'unknown';
  const segments = Array.isArray(input.segments) ? input.segments : [];
  const existingNodeKinds = normalizeNodeKindMap(input.existingNodeKinds);
  const settings = {
    enabled: options.enabled !== false,
    collinearToleranceDeg: options.collinearToleranceDeg ?? 3,
    minSegmentLengthMm: options.minSegmentLengthMm ?? 50,
    maxTurnAngleDeg: options.maxTurnAngleDeg ?? 150,
    defaultRadiusFactor: options.defaultRadiusFactor ?? 1.5,
  };

  const diagnostics = {
    autoBendEnabled: settings.enabled,
    sourceKind,
    candidateNodeCount: 0,
    emittedBendCount: 0,
    skippedCollinearCount: 0,
    skippedShortSegmentCount: 0,
    skippedAmbiguousBranchCount: 0,
    skippedExistingComponentCount: 0,
    skippedDegenerateCount: 0,
    warnings: [],
  };

  if (!settings.enabled) return { enabled: false, sourceKind, bends: [], trims: [], diagnostics };

  const pipeSegments = segments.filter(isPlainPipeSegment);
  const nodeMap = buildNodeIncidenceMap(pipeSegments);
  const bends = [];
  const trims = [];

  for (const [nodeId, incident] of nodeMap.entries()) {
    if (incident.length !== 2) continue;
    diagnostics.candidateNodeCount += 1;

    const existingKind = String(existingNodeKinds.get(nodeId) || '').toUpperCase();
    if (isExistingComponentNode(existingKind)) {
      diagnostics.skippedExistingComponentCount += 1;
      continue;
    }

    const [segA, segB] = incident;
    if (!sameBranchOrLine(segA, segB)) {
      diagnostics.skippedAmbiguousBranchCount += 1;
      diagnostics.warnings.push({ nodeId, code: 'ambiguousBranch', message: 'Pipe segments meet at node but branch/line ownership differs.' });
      continue;
    }

    const P = getSharedPoint(nodeId, segA, segB);
    const A = getOtherPoint(nodeId, segA);
    const B = getOtherPoint(nodeId, segB);
    if (!P || !A || !B) {
      diagnostics.skippedDegenerateCount += 1;
      continue;
    }

    const lenA = distance(P, A);
    const lenB = distance(P, B);
    if (lenA < settings.minSegmentLengthMm || lenB < settings.minSegmentLengthMm) {
      diagnostics.skippedShortSegmentCount += 1;
      continue;
    }

    const dA = normalize(sub(A, P));
    const dB = normalize(sub(B, P));
    if (!dA || !dB) {
      diagnostics.skippedDegenerateCount += 1;
      continue;
    }

    const turnAngleRad = Math.acos(clamp(-dot(dA, dB), -1, 1));
    const turnAngleDeg = radToDeg(turnAngleRad);
    if (turnAngleDeg <= settings.collinearToleranceDeg) {
      diagnostics.skippedCollinearCount += 1;
      continue;
    }
    if (turnAngleDeg > settings.maxTurnAngleDeg) {
      diagnostics.skippedDegenerateCount += 1;
      diagnostics.warnings.push({ nodeId, code: 'excessiveTurnAngle', message: `Turn angle ${turnAngleDeg.toFixed(1)}° is too large for auto-bend.` });
      continue;
    }

    const planeNormal = normalize(cross(dA, dB));
    if (!planeNormal) {
      diagnostics.skippedCollinearCount += 1;
      continue;
    }

    const radiusResult = resolveBendRadiusMm({ segmentA: segA, segmentB: segB, lenA, lenB, turnAngleRad, defaultRadiusFactor: settings.defaultRadiusFactor });
    const radiusMm = radiusResult.radiusMm;
    const trimMm = radiusMm * Math.tan(turnAngleRad / 2);
    if (!Number.isFinite(trimMm) || trimMm <= 0 || trimMm > lenA * 0.45 || trimMm > lenB * 0.45) {
      diagnostics.skippedShortSegmentCount += 1;
      diagnostics.warnings.push({ nodeId, code: 'trimTooLarge', message: 'Auto-bend trim exceeds safe adjacent pipe span.' });
      continue;
    }

    const tangentA = add(P, scale(dA, trimMm));
    const tangentB = add(P, scale(dB, trimMm));
    const bisector = normalize(add(dA, dB));
    if (!bisector) {
      diagnostics.skippedDegenerateCount += 1;
      continue;
    }
    const centerDistance = radiusMm / Math.sin(turnAngleRad / 2);
    const center = add(P, scale(bisector, centerDistance));

    bends.push({
      id: `auto-bend:${nodeId}`,
      nodeId,
      segmentAId: segA.id,
      segmentBId: segB.id,
      center,
      tangentA,
      tangentB,
      radiusMm,
      turnAngleDeg,
      planeNormal,
      pipeOdMm: readPositiveNumber(segA.pipeOdMm) || readPositiveNumber(segB.pipeOdMm) || null,
      boreMm: readPositiveNumber(segA.boreMm) || readPositiveNumber(segB.boreMm) || null,
      source: radiusResult.source,
      warnings: radiusResult.warnings,
    });

    trims.push({ segmentId: segA.id, nodeId, trimFromNodeMm: trimMm, reason: 'auto-bend' });
    trims.push({ segmentId: segB.id, nodeId, trimFromNodeMm: trimMm, reason: 'auto-bend' });
    for (const warning of radiusResult.warnings) diagnostics.warnings.push({ nodeId, code: warning, message: warning });
    diagnostics.emittedBendCount += 1;
  }

  return { enabled: true, sourceKind, bends, trims, diagnostics };
}

export function buildVisualTrimLookup(trims = []) {
  const lookup = new Map();
  for (const trim of trims) lookup.set(`${trim.segmentId}:${trim.nodeId}`, trim.trimFromNodeMm);
  return lookup;
}

export function resolveBendRadiusMm({ segmentA, segmentB, lenA, lenB, turnAngleRad, defaultRadiusFactor = 1.5 }) {
  const explicit = readPositiveNumber(segmentA.bendRadiusMm)
    || readPositiveNumber(segmentB.bendRadiusMm)
    || readPositiveNumber(segmentA.attrs?.bendRadiusMm)
    || readPositiveNumber(segmentB.attrs?.bendRadiusMm)
    || readPositiveNumber(segmentA.attrs?.radius)
    || readPositiveNumber(segmentB.attrs?.radius);
  const pipeOdMm = readPositiveNumber(segmentA.pipeOdMm)
    || readPositiveNumber(segmentB.pipeOdMm)
    || readPositiveNumber(segmentA.boreMm)
    || readPositiveNumber(segmentB.boreMm)
    || 100;

  let radiusMm = explicit || pipeOdMm * defaultRadiusFactor;
  let source = explicit ? 'explicit-radius' : 'od-derived-radius';
  const warnings = [];
  const trimMm = radiusMm * Math.tan(turnAngleRad / 2);
  const maxTrimMm = Math.min(lenA, lenB) * 0.45;
  if (trimMm > maxTrimMm) {
    radiusMm = maxTrimMm / Math.tan(turnAngleRad / 2);
    source = 'segment-capped-radius';
    warnings.push('radiusCappedByShortSegment');
  }
  return { radiusMm, source, warnings };
}

function isPlainPipeSegment(segment) {
  const type = String(segment.componentType || segment.type || 'PIPE').toUpperCase();
  return type === 'PIPE';
}

function isExistingComponentNode(kind) {
  return ['ELBOW', 'BEND', 'TEE', 'VALVE', 'FLANGE', 'SUPPORT', 'OLET', 'BRANCH'].includes(kind);
}

function sameBranchOrLine(a, b) {
  if (a.branchId && b.branchId && a.branchId !== b.branchId) return false;
  if (a.lineNo && b.lineNo && a.lineNo !== b.lineNo) return false;
  return true;
}

function buildNodeIncidenceMap(segments) {
  const map = new Map();
  for (const segment of segments) {
    addNodeSegment(map, segment.fromNode, segment);
    addNodeSegment(map, segment.toNode, segment);
  }
  return map;
}

function addNodeSegment(map, nodeId, segment) {
  if (!nodeId) return;
  if (!map.has(nodeId)) map.set(nodeId, []);
  map.get(nodeId).push(segment);
}

function getSharedPoint(nodeId, a, b) {
  const pa = a.fromNode === nodeId ? a.from : a.toNode === nodeId ? a.to : null;
  const pb = b.fromNode === nodeId ? b.from : b.toNode === nodeId ? b.to : null;
  if (!pa || !pb) return null;
  return distance(pa, pb) > 1e-4 ? midpoint(pa, pb) : toVec3(pa);
}

function getOtherPoint(nodeId, segment) {
  if (segment.fromNode === nodeId) return toVec3(segment.to);
  if (segment.toNode === nodeId) return toVec3(segment.from);
  return null;
}

function normalizeNodeKindMap(value) {
  if (value instanceof Map) return value;
  return new Map(Object.entries(value || {}));
}

function readPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function toVec3(value = {}) {
  if (Array.isArray(value)) return { x: Number(value[0]) || 0, y: Number(value[1]) || 0, z: Number(value[2]) || 0 };
  return { x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 };
}

function sub(a, b) {
  const av = toVec3(a);
  const bv = toVec3(b);
  return { x: av.x - bv.x, y: av.y - bv.y, z: av.z - bv.z };
}

function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function length(a) { return Math.sqrt(dot(a, a)); }
function normalize(a) { const len = length(a); return len > EPS ? scale(a, 1 / len) : null; }
function distance(a, b) { return length(sub(a, b)); }
function midpoint(a, b) { return scale(add(toVec3(a), toVec3(b)), 0.5); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function radToDeg(rad) { return rad * 180 / Math.PI; }
