import * as THREE from 'three';

const GLB_SUPPORT_SYMBOLS_GROUP = '__GLB_SUPPORT_SYMBOLS_V3__';

const SYMBOL_COLOR = {
  REST: 0x22c55e,
  GUIDE: 0x22c55e,
  LINESTOP: 0x16a34a,
  LIMIT: 0x16a34a,
  ANCHOR: 0xef4444,
  SPRING: 0xa855f7,
  HANGER: 0xa855f7,
  SHOE: 0x22c55e,
  UNKNOWN: 0x94a3b8,
};

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function supportMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.38,
    metalness: 0.10,
  });
}

function orientAlongY(mesh, dir) {
  mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
}

function makeArrow(start, end, color, r, role = '') {
  const group = new THREE.Group();
  if (role) group.userData.glbSupportSymbolRole = role;
  const v = new THREE.Vector3().subVectors(end, start);
  const len = v.length();
  if (len < 0.5) return group;

  const dir = v.normalize();
  const headLen = Math.min(len * 0.30, r * 12);
  const shaftLen = Math.max(len - headLen, r * 0.5);
  const mat = supportMat(color);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, shaftLen, 12),
    mat,
  );
  shaft.userData.glbSupportSymbolMesh = true;
  shaft.position.copy(start.clone().add(dir.clone().multiplyScalar(shaftLen * 0.5)));
  orientAlongY(shaft, dir);
  group.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(r * 3.0, headLen, 16),
    mat,
  );
  head.userData.glbSupportSymbolMesh = true;
  head.position.copy(start.clone().add(dir.clone().multiplyScalar(shaftLen + headLen * 0.5)));
  orientAlongY(head, dir);
  group.add(head);

  return group;
}

function makePlate(center, pipeAxis, lateral, scale, color) {
  const geo = new THREE.BoxGeometry(scale * 1.1, scale * 0.12, scale * 0.65);
  const mesh = new THREE.Mesh(geo, supportMat(color));
  mesh.userData.glbSupportSymbolMesh = true;
  mesh.position.copy(center);

  const a = pipeAxis.clone().normalize();
  const v = UP.clone().sub(a.clone().multiplyScalar(a.dot(UP))).normalize();
  const l = new THREE.Vector3().crossVectors(a, v).normalize();
  if (v.lengthSq() < 0.5 || l.lengthSq() < 0.5) {
    mesh.quaternion.identity();
  } else {
    mesh.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(a, v, l),
    );
  }
  return mesh;
}

function derivePipeAxis(userData) {
  const d = userData.supportAxis;
  if (d && typeof d === 'object') {
    let x = Number(d.x) || 0;
    let y = Number(d.y) || 0;
    let z = Number(d.z) || 0;

    if (userData.supportAxisSpace === 'caesar-zup') {
      const cx = x;
      const cy = y;
      const cz = z;
      x = cx;
      y = cz;
      z = -cy;
    }

    const v = new THREE.Vector3(x, y, z);
    if (v.lengthSq() > 0.01) return v.normalize();
  }
  return new THREE.Vector3(1, 0, 0);
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

function guideLateralAxis(restraintAxis) {
  return horizontalAxisOrFallback(restraintAxis, X_AXIS);
}

function lineStopPipeAxis(restraintAxis) {
  return horizontalAxisOrFallback(restraintAxis, Z_AXIS);
}

function buildRest(group, pos, pipeAxis, lateral, scale, color) {
  const r = scale * 0.028;
  const belowY = pos.y - scale * 0.72;
  const baseCenter = new THREE.Vector3(pos.x, belowY, pos.z);
  const pipeBase = new THREE.Vector3(pos.x, pos.y - scale * 0.07, pos.z);

  group.add(makePlate(baseCenter, pipeAxis, lateral, scale, color));
  group.add(makeArrow(
    baseCenter.clone().add(UP.clone().multiplyScalar(scale * 0.08)),
    pipeBase,
    color,
    r,
    'rest-axis',
  ));
}

function buildGuide(group, pos, pipeAxis, lateral, scale, color) {
  const belowY = pos.y - scale * 0.72;
  const baseCenter = new THREE.Vector3(pos.x, belowY, pos.z);
  group.add(makePlate(baseCenter, pipeAxis, lateral, scale, color));

  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(scale * 0.10, scale * 0.72, scale * 0.10),
    supportMat(color),
  );
  leftBar.userData.glbSupportSymbolMesh = true;
  leftBar.position.copy(pos.clone().add(lateral.clone().multiplyScalar(scale * 0.18)));
  group.add(leftBar);

  const rightBar = leftBar.clone();
  rightBar.material = leftBar.material;
  rightBar.position.copy(pos.clone().add(lateral.clone().multiplyScalar(-scale * 0.18)));
  group.add(rightBar);

  const r = scale * 0.022;
  const outer = pos.clone().add(lateral.clone().multiplyScalar(scale * 0.82));
  const inner = pos.clone().add(lateral.clone().multiplyScalar(scale * 0.14));
  group.add(makeArrow(outer, inner, color, r, 'guide-axis'));
  group.add(makeArrow(
    pos.clone().add(lateral.clone().multiplyScalar(-scale * 0.82)),
    pos.clone().add(lateral.clone().multiplyScalar(-scale * 0.14)),
    color,
    r,
    'guide-axis',
  ));
}

function buildLineStop(group, pos, pipeAxis, lateral, scale, color) {
  const sideOffset = lateral.clone().multiplyScalar(scale * 0.20);
  const center = pos.clone().add(sideOffset);
  const belowY = pos.y - scale * 0.72;
  group.add(makePlate(new THREE.Vector3(pos.x, belowY, pos.z).add(sideOffset), pipeAxis, lateral, scale, color));

  const r = scale * 0.028;
  group.add(makeArrow(
    center.clone().add(pipeAxis.clone().multiplyScalar(scale * 0.82)),
    center.clone().add(pipeAxis.clone().multiplyScalar(scale * 0.14)),
    color,
    r,
    'linestop-axis',
  ));
  group.add(makeArrow(
    center.clone().add(pipeAxis.clone().multiplyScalar(-scale * 0.82)),
    center.clone().add(pipeAxis.clone().multiplyScalar(-scale * 0.14)),
    color,
    r,
    'linestop-axis',
  ));
}

function buildHanger(group, pos, pipeAxis, lateral, scale, color) {
  const r = scale * 0.020;
  const topY = pos.y + scale * 2.8;
  const topCenter = new THREE.Vector3(pos.x, topY, pos.z);
  const pipeTop = new THREE.Vector3(pos.x, pos.y + scale * 0.07, pos.z);

  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(scale * 1.0, scale * 0.12, scale * 1.0),
    supportMat(color),
  );
  topPlate.userData.glbSupportSymbolMesh = true;
  topPlate.position.copy(topCenter);
  group.add(topPlate);

  const rodLen = topY - pipeTop.y;
  if (rodLen > 0.5) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(r * 0.55, 0.5), Math.max(r * 0.55, 0.5), rodLen, 12),
      supportMat(color),
    );
    rod.userData.glbSupportSymbolMesh = true;
    rod.position.set(pos.x, (topY + pipeTop.y) / 2, pos.z);
    group.add(rod);
  }

  group.add(makeArrow(
    topCenter.clone().add(UP.clone().multiplyScalar(-scale * 0.15)),
    pipeTop,
    color,
    r * 1.6,
  ));
}

function buildSpring(group, pos, pipeAxis, lateral, scale, color) {
  buildRest(group, pos, pipeAxis, lateral, scale, color);
  const r = scale * 0.018;
  const coilCenter = new THREE.Vector3(pos.x, pos.y - scale * 0.40, pos.z);
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(scale * 0.22, Math.max(r * 0.7, 0.5), 8, 20),
    supportMat(color),
  );
  coil.userData.glbSupportSymbolMesh = true;
  coil.position.copy(coilCenter);
  group.add(coil);
}

function buildAnchor(group, pos, pipeAxis, lateral, scale, color) {
  buildRest(group, pos, pipeAxis, lateral, scale, color);
  const r = scale * 0.022;
  [UP, UP.clone().negate(), pipeAxis, pipeAxis.clone().negate(), lateral, lateral.clone().negate()]
    .forEach((dir) => {
      group.add(makeArrow(
        pos.clone(),
        pos.clone().add(dir.clone().normalize().multiplyScalar(scale * 0.6)),
        color,
        r,
      ));
    });
}

function disposeGroup(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    mats.forEach((m) => m?.dispose?.());
  });
}

function isBakedSupportReference(object) {
  return String(object?.userData?.glbShape || '').startsWith('support-reference-v2-');
}

function isInsideBakedSupportReference(object) {
  let current = object;
  while (current) {
    if (isBakedSupportReference(current)) return true;
    current = current.parent;
  }
  return false;
}

function hasSupportKindAncestor(object) {
  let current = object?.parent || null;
  while (current) {
    const kind = String(current.userData?.supportKind || '').toUpperCase();
    if (kind && kind !== 'UNKNOWN') return true;
    current = current.parent;
  }
  return false;
}

function hideBakedSupportMarkers(root) {
  root.traverse((obj) => {
    if (isBakedSupportReference(obj)) {
      obj.visible = false;
      obj.userData.glbSupportBakedFallback = false;
    }
  });
}

export function applyGlbSupportSymbols(root, scene, options = {}) {
  const existing = scene.getObjectByName(GLB_SUPPORT_SYMBOLS_GROUP);
  if (existing) {
    scene.remove(existing);
    disposeGroup(existing);
  }

  const box = new THREE.Box3().setFromObject(root);
  const diagRaw = box.isEmpty() ? 1000 : box.getSize(new THREE.Vector3()).length();
  const symbolScaleFactor = 0.035;
  const scaleMultiplier = Number(options.scaleMultiplier) > 0 ? Number(options.scaleMultiplier) : 1.0;
  const scale = Math.max(18, Math.min(160, diagRaw * symbolScaleFactor)) * scaleMultiplier;

  hideBakedSupportMarkers(root);

  const symbolRoot = new THREE.Group();
  symbolRoot.name = GLB_SUPPORT_SYMBOLS_GROUP;
  symbolRoot.userData.glbSupportSymbolRoot = true;

  root.updateMatrixWorld(true);

  const worldPos = new THREE.Vector3();
  const seen = new Set();
  let scanned = 0;

  root.traverse((object) => {
    if (isInsideBakedSupportReference(object)) return;
    if (hasSupportKindAncestor(object)) return;

    const data = object?.userData || {};
    const kind = String(data.supportKind || '').toUpperCase();
    if (!kind || kind === 'UNKNOWN') return;
    if (data.glbSupportSymbolMesh) return;

    scanned += 1;
    object.getWorldPosition(worldPos);

    const key = `${kind}:${(worldPos.x / 10).toFixed(0)}:${(worldPos.y / 10).toFixed(0)}:${(worldPos.z / 10).toFixed(0)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const restraintAxis = derivePipeAxis(data);
    const pipeAxis = (kind === 'LINESTOP' || kind === 'LIMIT')
      ? lineStopPipeAxis(restraintAxis)
      : restraintAxis;
    const lat = kind === 'GUIDE'
      ? guideLateralAxis(restraintAxis)
      : lateralAxis(pipeAxis);
    const color = SYMBOL_COLOR[kind] || SYMBOL_COLOR.UNKNOWN;
    const wPos = worldPos.clone();

    const group = new THREE.Group();
    group.name = `glb-support-${kind.toLowerCase()}-${object.name || object.uuid}`;
    group.userData = { glbSupportSymbolKind: kind, glbSupportSymbol: true };

    if (kind === 'REST' || kind === 'SHOE') buildRest(group, wPos, pipeAxis, lat, scale, color);
    else if (kind === 'GUIDE') buildGuide(group, wPos, pipeAxis, lat, scale, color);
    else if (kind === 'LINESTOP' || kind === 'LIMIT') buildLineStop(group, wPos, pipeAxis, lat, scale, color);
    else if (kind === 'HANGER') buildHanger(group, wPos, pipeAxis, lat, scale, color);
    else if (kind === 'SPRING') buildSpring(group, wPos, pipeAxis, lat, scale, color);
    else if (kind === 'ANCHOR') buildAnchor(group, wPos, pipeAxis, lat, scale, color);
    else buildRest(group, wPos, pipeAxis, lat, scale, color);

    if (group.children.length > 0) symbolRoot.add(group);
  });

  const created = symbolRoot.children.length;
  if (created > 0) scene.add(symbolRoot);

  console.info('[glb-support-symbols]', { created, scanned, scale });
  return { created, scanned, scale };
}
