import * as THREE from 'three';

const GLB_SUPPORT_SYMBOLS_GROUP = '__GLB_SUPPORT_SYMBOLS_V4_VISUAL_FIDELITY__';

const SYMBOL_COLOR = {
  REST: 0x22c55e,
  GUIDE: 0x22c55e,
  LINESTOP: 0x10b981,
  LIMIT: 0xf97316,
  ANCHOR: 0xef4444,
  SPRING: 0xa855f7,
  HANGER: 0xa855f7,
  SHOE: 0x22c55e,
  HOLDDOWN: 0x22c55e,
  UNKNOWN: 0xf59e0b,
};

const AXIS_COLOR = {
  X: 0xef4444,
  Y: 0x22c55e,
  Z: 0x3b82f6,
};

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function supportMat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: options.emissiveIntensity ?? 0.16,
    roughness: 0.42,
    metalness: 0.06,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  });
}

function normalizeKind(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!raw) return '';
  if (raw.includes('LINESTOP') || raw.includes('LINE_STOP') || raw.includes('LIMIT_STOP') || raw.includes('LIMT_STOP')) return 'LINESTOP';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('ANCHOR') || raw === 'ANC') return 'ANCHOR';
  if (raw.includes('HANGER')) return 'HANGER';
  if (raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('HOLDDOWN')) return 'HOLDDOWN';
  if (raw.includes('REST') || raw.includes('SHOE') || raw.includes('SUPPORT')) return 'REST';
  if (raw.includes('TYPE0') || raw === '0' || raw.includes('UNKNOWN')) return 'UNKNOWN';
  return raw;
}

function normalizeAxisLabel(value) {
  if (Array.isArray(value)) {
    const nums = value.map(Number);
    const abs = nums.map((n) => Math.abs(Number.isFinite(n) ? n : 0));
    const max = Math.max(...abs);
    if (max <= 0) return '';
    const index = abs.indexOf(max);
    return `${nums[index] < 0 ? '-' : '+'}${['X', 'Y', 'Z'][index]}`;
  }
  if (value && typeof value === 'object') {
    return normalizeAxisLabel([value.x, value.y, value.z]);
  }
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (/^[+-]?[XYZ]$/.test(raw)) return raw;
  if (raw.includes('DX') || raw.includes('+X') || raw.includes('-X') || raw === 'X') return raw.includes('-') ? '-X' : '+X';
  if (raw.includes('DY') || raw.includes('+Y') || raw.includes('-Y') || raw === 'Y') return raw.includes('-') ? '-Y' : '+Y';
  if (raw.includes('DZ') || raw.includes('+Z') || raw.includes('-Z') || raw === 'Z') return raw.includes('-') ? '-Z' : '+Z';
  return '';
}

function axisVectorFromLabel(label) {
  const raw = String(label || '').toUpperCase();
  if (raw.includes('X')) return raw.startsWith('-') ? X_AXIS.clone().negate() : X_AXIS.clone();
  if (raw.includes('Y')) return raw.startsWith('-') ? Y_AXIS.clone().negate() : Y_AXIS.clone();
  if (raw.includes('Z')) return raw.startsWith('-') ? Z_AXIS.clone().negate() : Z_AXIS.clone();
  return null;
}

function layerIdsForSupport(source, kind, axisLabel) {
  const ids = [
    'plant.restraints',
    source === 'isonote' ? 'restraints.isonote' : 'restraints.inputxml',
    `restraints.${String(kind || 'UNKNOWN').toLowerCase()}`,
  ];
  const label = String(axisLabel || '').toUpperCase();
  if (label.includes('X')) ids.push('axis.x');
  if (label.includes('Y')) ids.push('axis.y');
  if (label.includes('Z')) ids.push('axis.z');
  return ids;
}

function setLayerMetadata(object, { source, kind, axisLabel, role = 'runtime-symbol' }) {
  const layer = {
    schema: 'bm-cii-layer/v1',
    category: 'support',
    source,
    supportKind: kind,
    axis: axisLabel,
    visibleDefault: true,
    layerIds: layerIdsForSupport(source, kind, axisLabel),
  };
  object.userData = {
    ...(object.userData || {}),
    bmCiiLayerSchema: 'bm-cii-layer/v1',
    bmCiiLayer: layer,
    bmCiiLayerIds: layer.layerIds,
    glbSupportRuntimeRole: role,
  };
}

function orientAlongY(mesh, dir) {
  const d = dir.clone().normalize();
  if (d.lengthSq() < 1e-8) return;
  mesh.quaternion.setFromUnitVectors(UP, d);
}

function makeBox(center, size, color, basis = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), supportMat(color));
  mesh.userData.glbSupportSymbolMesh = true;
  mesh.position.copy(center);
  if (basis.x && basis.y && basis.z) {
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      basis.x.clone().normalize(),
      basis.y.clone().normalize(),
      basis.z.clone().normalize(),
    ));
  }
  return mesh;
}

function makeCylinderBetween(start, end, color, radius, segments = 14) {
  const v = new THREE.Vector3().subVectors(end, start);
  const len = v.length();
  if (len < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, segments), supportMat(color));
  mesh.userData.glbSupportSymbolMesh = true;
  mesh.position.copy(start.clone().add(v.multiplyScalar(0.5)));
  orientAlongY(mesh, new THREE.Vector3().subVectors(end, start));
  return mesh;
}

function makeArrow(start, end, color, radius, role = '') {
  const group = new THREE.Group();
  if (role) group.userData.glbSupportSymbolRole = role;
  const v = new THREE.Vector3().subVectors(end, start);
  const len = v.length();
  if (len < 1e-6) return group;
  const dir = v.clone().normalize();
  const headLen = Math.min(Math.max(radius * 5.0, len * 0.22), len * 0.42);
  const shaftLen = Math.max(len - headLen, radius * 1.5);
  const shaftEnd = start.clone().add(dir.clone().multiplyScalar(shaftLen));
  const shaft = makeCylinderBetween(start, shaftEnd, color, radius, 14);
  if (shaft) group.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.8, headLen, 18), supportMat(color));
  head.userData.glbSupportSymbolMesh = true;
  head.position.copy(shaftEnd.clone().add(dir.clone().multiplyScalar(headLen * 0.5)));
  orientAlongY(head, dir);
  group.add(head);
  return group;
}

function safeBasis(pipeAxis, lateral) {
  const x = pipeAxis.clone().normalize();
  let z = lateral.clone().normalize();
  if (z.lengthSq() < 1e-8 || Math.abs(z.dot(x)) > 0.96) {
    z = new THREE.Vector3().crossVectors(x, UP);
    if (z.lengthSq() < 1e-8) z = Z_AXIS.clone();
    z.normalize();
  }
  let y = new THREE.Vector3().crossVectors(z, x).normalize();
  if (y.dot(UP) < 0) y.negate();
  return { x, y, z };
}

function makePlate(center, pipeAxis, lateral, scale, color, width = 1.25, depth = 0.82) {
  return makeBox(
    center,
    new THREE.Vector3(scale * width, scale * 0.12, scale * depth),
    color,
    safeBasis(pipeAxis, lateral),
  );
}

function makeAxisIndicator(pos, axisVector, axisLabel, scale) {
  const label = normalizeAxisLabel(axisLabel);
  if (!label) return null;
  const baseAxis = axisVectorFromLabel(label) || axisVector || UP;
  const axis = baseAxis.clone().normalize();
  const color = AXIS_COLOR[label.replace(/[+-]/g, '')] || 0x60a5fa;
  const group = new THREE.Group();
  group.name = `axis-indicator-${label}`;
  group.userData.glbSupportSymbolRole = 'axis-indicator';
  const start = pos.clone().add(axis.clone().multiplyScalar(scale * 0.18));
  const end = pos.clone().add(axis.clone().multiplyScalar(scale * 0.72));
  group.add(makeArrow(start, end, color, scale * 0.035, `axis-${label}`));
  const badge = new THREE.Mesh(new THREE.TorusGeometry(scale * 0.18, scale * 0.018, 8, 24), supportMat(color));
  badge.userData.glbSupportSymbolMesh = true;
  badge.position.copy(end.clone().add(axis.clone().multiplyScalar(scale * 0.08)));
  orientAlongY(badge, axis);
  group.add(badge);
  return group;
}

function deriveVectorFromUserData(value) {
  if (Array.isArray(value)) {
    const v = new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
    return v.lengthSq() > 0.01 ? v.normalize() : null;
  }
  if (value && typeof value === 'object') {
    const v = new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
    return v.lengthSq() > 0.01 ? v.normalize() : null;
  }
  return null;
}

function deriveAxisInfo(userData) {
  const trace = userData.bmCiiTrace || {};
  const layer = userData.bmCiiLayer || {};
  const rawAxis = trace.axis || trace.direction || trace.restraintAxis || userData.restraintAxis || layer.axis || userData.supportAxis;
  const label = normalizeAxisLabel(rawAxis);
  const fromLabel = axisVectorFromLabel(label);
  const fromVector = deriveVectorFromUserData(userData.supportAxis) || deriveVectorFromUserData(rawAxis);
  let vector = fromVector || fromLabel || X_AXIS.clone();
  if (userData.supportAxisSpace === 'caesar-zup') {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    vector = new THREE.Vector3(x, z, -y);
  }
  if (vector.lengthSq() < 1e-8) vector = X_AXIS.clone();
  return { vector: vector.normalize(), label };
}

function lateralAxis(pipeAxis) {
  const cross = new THREE.Vector3().crossVectors(pipeAxis, UP);
  if (cross.lengthSq() > 1e-8) return cross.normalize();
  const crossX = new THREE.Vector3().crossVectors(pipeAxis, X_AXIS);
  return crossX.lengthSq() > 1e-8 ? crossX.normalize() : Z_AXIS.clone();
}

function horizontalAxisOrFallback(axis, fallback) {
  const source = axis?.lengthSq?.() > 1e-8 ? axis.clone().normalize() : fallback.clone();
  const horizontal = source.sub(UP.clone().multiplyScalar(source.dot(UP)));
  if (horizontal.lengthSq() > 1e-8) return horizontal.normalize();
  return fallback.clone().normalize();
}

function buildRest(group, pos, pipeAxis, lateral, scale, color) {
  const baseCenter = pos.clone().add(UP.clone().multiplyScalar(-scale * 0.88));
  const pipeBase = pos.clone().add(UP.clone().multiplyScalar(-scale * 0.16));
  group.add(makePlate(baseCenter, pipeAxis, lateral, scale, color, 1.35, 0.95));
  group.add(makeCylinderBetween(baseCenter.clone().add(UP.clone().multiplyScalar(scale * 0.08)), pipeBase, color, scale * 0.045, 14));
  group.add(makeArrow(baseCenter.clone().add(UP.clone().multiplyScalar(scale * 0.20)), pipeBase, color, scale * 0.04, 'rest-vertical-axis'));
}

function buildGuide(group, pos, pipeAxis, lateral, scale, color) {
  const baseCenter = pos.clone().add(UP.clone().multiplyScalar(-scale * 0.88));
  group.add(makePlate(baseCenter, pipeAxis, lateral, scale, color, 1.35, 0.95));
  const basis = safeBasis(pipeAxis, lateral);
  for (const sign of [1, -1]) {
    const jawCenter = pos.clone().add(lateral.clone().multiplyScalar(sign * scale * 0.34));
    group.add(makeBox(jawCenter, new THREE.Vector3(scale * 0.12, scale * 0.86, scale * 0.15), color, basis));
    group.add(makeArrow(
      pos.clone().add(lateral.clone().multiplyScalar(sign * scale * 1.05)),
      pos.clone().add(lateral.clone().multiplyScalar(sign * scale * 0.42)),
      color,
      scale * 0.035,
      'guide-lateral-axis',
    ));
  }
}

function buildLineStop(group, pos, pipeAxis, lateral, scale, color) {
  const basis = safeBasis(pipeAxis, lateral);
  const baseCenter = pos.clone().add(UP.clone().multiplyScalar(-scale * 0.86));
  group.add(makePlate(baseCenter, pipeAxis, lateral, scale, color, 1.25, 0.80));
  for (const sign of [1, -1]) {
    const stopCenter = pos.clone().add(pipeAxis.clone().multiplyScalar(sign * scale * 0.42));
    group.add(makeBox(stopCenter, new THREE.Vector3(scale * 0.18, scale * 0.82, scale * 0.60), color, basis));
    group.add(makeArrow(
      pos.clone().add(pipeAxis.clone().multiplyScalar(sign * scale * 1.12)).add(lateral.clone().multiplyScalar(scale * 0.22)),
      pos.clone().add(pipeAxis.clone().multiplyScalar(sign * scale * 0.55)).add(lateral.clone().multiplyScalar(scale * 0.22)),
      color,
      scale * 0.04,
      'linestop-axial-axis',
    ));
  }
}

function buildLimit(group, pos, axis, lateral, scale, color) {
  const limitAxis = axis.clone().normalize();
  const side = lateral.clone().normalize();
  const vertical = UP.clone();
  const basis = safeBasis(limitAxis, side);
  const baseCenter = pos.clone().add(UP.clone().multiplyScalar(-scale * 0.76));
  group.add(makePlate(baseCenter, limitAxis, side, scale, color, 1.05, 0.70));
  const stopCenter = pos.clone().add(limitAxis.clone().multiplyScalar(scale * 0.50));
  group.add(makeBox(stopCenter, new THREE.Vector3(scale * 0.18, scale * 0.78, scale * 0.48), color, basis));
  group.add(makeArrow(
    pos.clone().add(limitAxis.clone().multiplyScalar(scale * 1.18)).add(vertical.clone().multiplyScalar(scale * 0.12)),
    pos.clone().add(limitAxis.clone().multiplyScalar(scale * 0.58)).add(vertical.clone().multiplyScalar(scale * 0.12)),
    color,
    scale * 0.042,
    'limit-direction-axis',
  ));
  // Gap bracket: orange tick clearly marks LIMIT/gap instead of line-stop.
  group.add(makeBox(
    pos.clone().add(limitAxis.clone().multiplyScalar(scale * 0.82)).add(vertical.clone().multiplyScalar(scale * 0.45)),
    new THREE.Vector3(scale * 0.42, scale * 0.045, scale * 0.22),
    0xf59e0b,
    basis,
  ));
}

function buildHanger(group, pos, pipeAxis, lateral, scale, color) {
  const topCenter = pos.clone().add(UP.clone().multiplyScalar(scale * 1.55));
  const pipeTop = pos.clone().add(UP.clone().multiplyScalar(scale * 0.15));
  group.add(makePlate(topCenter, pipeAxis, lateral, scale, color, 1.10, 0.85));
  group.add(makeCylinderBetween(topCenter.clone().add(UP.clone().multiplyScalar(-scale * 0.08)), pipeTop, color, scale * 0.028, 12));
  for (let i = 0; i < 3; i += 1) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(scale * 0.16, scale * 0.016, 8, 24), supportMat(color));
    coil.userData.glbSupportSymbolMesh = true;
    coil.position.copy(pos.clone().add(UP.clone().multiplyScalar(scale * (0.48 + i * 0.16))));
    orientAlongY(coil, UP);
    group.add(coil);
  }
  group.add(makeArrow(topCenter.clone().add(UP.clone().multiplyScalar(-scale * 0.12)), pipeTop, color, scale * 0.035, 'hanger-load-axis'));
}

function buildUnknown(group, pos, pipeAxis, lateral, scale, color) {
  const baseCenter = pos.clone().add(UP.clone().multiplyScalar(-scale * 0.72));
  group.add(makePlate(baseCenter, pipeAxis, lateral, scale, color, 1.05, 0.70));
  const warning = new THREE.Mesh(new THREE.OctahedronGeometry(scale * 0.22, 0), supportMat(0xf59e0b));
  warning.userData.glbSupportSymbolMesh = true;
  warning.position.copy(pos.clone().add(UP.clone().multiplyScalar(scale * 0.45)));
  group.add(warning);
}

function buildAnchor(group, pos, pipeAxis, lateral, scale, color) {
  buildRest(group, pos, pipeAxis, lateral, scale, color);
  for (const dir of [UP, UP.clone().negate(), pipeAxis, pipeAxis.clone().negate(), lateral, lateral.clone().negate()]) {
    group.add(makeArrow(pos.clone(), pos.clone().add(dir.clone().normalize().multiplyScalar(scale * 0.72)), color, scale * 0.032, 'anchor-axis'));
  }
}

function disposeGroup(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    mats.forEach((m) => m?.dispose?.());
  });
}

function isBakedSupportReference(object) {
  const data = object?.userData || {};
  const layer = data.bmCiiLayer || {};
  const name = `${object?.name || ''} ${data.glbShape || ''}`.toUpperCase();
  return String(data.glbShape || '').startsWith('support-reference-v2-')
    || layer.category === 'support'
    || layer.layerIds?.includes?.('plant.restraints')
    || name.includes('BM_CII_RESTRAINT_VISUAL')
    || name.includes('SUPPORT_ARROW_V7');
}

function supportLayerSource(data = {}) {
  const layerSource = String(data.bmCiiLayer?.source || '').toLowerCase();
  const traceSource = String(data.bmCiiTrace?.supportSource || data.bmCiiTrace?.source || '').toLowerCase();
  const direct = String(data.supportSource || data.renderSource || '').toLowerCase();
  if (layerSource.includes('isonote') || traceSource.includes('isonote') || direct.includes('isonote')) return 'isonote';
  if (layerSource.includes('inputxml') || traceSource.includes('inputxml') || direct.includes('inputxml') || direct.includes('xml')) return 'inputxml';
  return 'inputxml';
}

function supportKindFromData(data = {}) {
  return normalizeKind(
    data.supportKind
      || data.bmCiiTrace?.supportKind
      || data.bmCiiTrace?.kind
      || data.bmCiiLayer?.supportKind
      || data.pcfType,
  );
}

function supportAxisLabelFromData(data = {}) {
  return normalizeAxisLabel(
    data.bmCiiTrace?.axis
      || data.bmCiiTrace?.direction
      || data.restraintAxis
      || data.bmCiiLayer?.axis
      || data.supportAxis,
  );
}

function hideBakedSupportMarkers(root) {
  root.traverse((obj) => {
    if (!isBakedSupportReference(obj)) return;
    obj.visible = false;
    obj.userData.glbSupportBakedFallback = false;
  });
}

function isCandidateSupportObject(object) {
  if (!object?.isMesh && object?.type !== 'Group') return false;
  const data = object.userData || {};
  if (data.glbSupportSymbolMesh || data.glbSupportSymbol) return false;
  const layer = data.bmCiiLayer || {};
  const kind = supportKindFromData(data);
  return Boolean(kind && kind !== 'UNKNOWN') || layer.category === 'support' || layer.layerIds?.includes?.('plant.restraints') || isBakedSupportReference(object);
}

function supportKey(kind, source, pos, axisLabel) {
  return `${source}:${kind}:${axisLabel}:${pos.x.toFixed(3)}:${pos.y.toFixed(3)}:${pos.z.toFixed(3)}`;
}

function computeSymbolScale(root, options = {}) {
  const box = new THREE.Box3().setFromObject(root);
  const diagRaw = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length();
  const scaleMultiplier = Number(options.scaleMultiplier) > 0 ? Number(options.scaleMultiplier) : 1.0;
  if (diagRaw < 50) {
    return Math.max(0.22, Math.min(0.85, diagRaw * 0.075)) * scaleMultiplier;
  }
  return Math.max(22, Math.min(190, diagRaw * 0.045)) * scaleMultiplier;
}

export function applyGlbSupportSymbols(root, scene, options = {}) {
  const existing = scene.getObjectByName(GLB_SUPPORT_SYMBOLS_GROUP) || root.getObjectByName?.(GLB_SUPPORT_SYMBOLS_GROUP);
  if (existing) {
    existing.parent?.remove?.(existing);
    disposeGroup(existing);
  }

  root.updateMatrixWorld(true);
  const scale = computeSymbolScale(root, options);
  const symbolRoot = new THREE.Group();
  symbolRoot.name = GLB_SUPPORT_SYMBOLS_GROUP;
  symbolRoot.userData.glbSupportSymbolRoot = true;

  const worldPos = new THREE.Vector3();
  const seen = new Set();
  let scanned = 0;
  let hidden = 0;

  root.traverse((object) => {
    if (!isCandidateSupportObject(object)) return;
    const data = object.userData || {};
    const kind = supportKindFromData(data);
    if (!kind || kind === 'UNKNOWN') return;
    object.getWorldPosition(worldPos);
    const source = supportLayerSource(data);
    const axisInfo = deriveAxisInfo(data);
    const axisLabel = supportAxisLabelFromData(data) || axisInfo.label;
    const restraintAxis = axisInfo.vector;
    const pipeAxis = (kind === 'LINESTOP' || kind === 'LIMIT')
      ? horizontalAxisOrFallback(restraintAxis, Z_AXIS)
      : restraintAxis.clone().normalize();
    const lat = kind === 'GUIDE'
      ? horizontalAxisOrFallback(restraintAxis, X_AXIS)
      : lateralAxis(pipeAxis);
    const key = supportKey(kind, source, worldPos, axisLabel);
    if (seen.has(key)) return;
    seen.add(key);
    scanned += 1;

    const group = new THREE.Group();
    group.name = `glb-support-${kind.toLowerCase()}-${source}-${object.name || object.uuid}`;
    group.userData = {
      glbSupportSymbolKind: kind,
      glbSupportSymbol: true,
      glbSupportVisualProfile: 'v4-engineering-readable',
      pcfId: data.pcfId || data.componentId || object.name || object.uuid,
      pcfType: data.pcfType || 'SUPPORT',
      refNo: data.refNo || data.REF_NO || '',
      lineNo: data.lineNo || '',
      supportKind: kind,
      supportSource: source,
      restraintAxis: axisLabel,
      supportAxis: { x: restraintAxis.x, y: restraintAxis.y, z: restraintAxis.z },
      bmCiiTrace: {
        ...(data.bmCiiTrace || {}),
        entity: 'support',
        supportKind: kind,
        supportSource: source,
        axis: axisLabel,
        renderGlyph: `runtime-v4-${kind.toLowerCase()}`,
        renderScale: scale,
      },
    };
    setLayerMetadata(group, { source, kind, axisLabel, role: 'runtime-symbol-root' });

    const color = SYMBOL_COLOR[kind] || SYMBOL_COLOR.UNKNOWN;
    const pos = worldPos.clone();
    if (kind === 'REST' || kind === 'SHOE' || kind === 'HOLDDOWN') buildRest(group, pos, pipeAxis, lat, scale, color);
    else if (kind === 'GUIDE') buildGuide(group, pos, pipeAxis, lat, scale, color);
    else if (kind === 'LINESTOP') buildLineStop(group, pos, pipeAxis, lat, scale, color);
    else if (kind === 'LIMIT') buildLimit(group, pos, restraintAxis, lat, scale, color);
    else if (kind === 'HANGER') buildHanger(group, pos, pipeAxis, lat, scale, color);
    else if (kind === 'SPRING') buildHanger(group, pos, pipeAxis, lat, scale, color);
    else if (kind === 'ANCHOR') buildAnchor(group, pos, pipeAxis, lat, scale, color);
    else buildUnknown(group, pos, pipeAxis, lat, scale, color);

    const axisMarker = makeAxisIndicator(pos, restraintAxis, axisLabel, scale);
    if (axisMarker) group.add(axisMarker);
    group.traverse((child) => setLayerMetadata(child, { source, kind, axisLabel, role: child.userData.glbSupportSymbolRole || 'runtime-symbol-child' }));
    if (group.children.length > 0) symbolRoot.add(group);
  });

  hideBakedSupportMarkers(root);
  root.traverse((obj) => { if (isBakedSupportReference(obj)) hidden += 1; });

  const created = symbolRoot.children.length;
  if (created > 0) {
    // Add to scene so world-space positions are preserved. The layer panel now targets the full scene.
    scene.add(symbolRoot);
  }

  console.info('[glb-support-symbols]', { created, scanned, hidden, scale, profile: 'v4-engineering-readable' });
  return { created, scanned, hidden, scale, profile: 'v4-engineering-readable' };
}
