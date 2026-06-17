import * as THREE from 'three';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const EPS = 1e-9;
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function vector(point) { return new THREE.Vector3(num(point?.x), num(point?.y), num(point?.z)); }

export function caesarPointToGlb(point) {
  const p = vector(point);
  return new THREE.Vector3(p.x, p.z, -p.y);
}

function material(name, color, options = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? 0.72, metalness: 0, emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? 0 });
  mat.name = name;
  return mat;
}
function makeMaterials() {
  return Object.freeze({
    pipe: material('IXB_PIPE_GREY', 0xd9dee7), bend: material('IXB_BEND_GREY', 0xf2f5f8),
    valve: material('IXB_VALVE_GREEN', 0x1f9d55, { emissive: 0x103b1c, emissiveIntensity: 0.12 }),
    flange: material('IXB_FLANGE_GREEN', 0x21c15a), tee: material('IXB_TEE_GREEN', 0x26d064),
    node: material('IXB_NODE_BLUE', 0x2979ff, { emissive: 0x0b2355, emissiveIntensity: 0.18 }),
    rest: material('IXB_SUPPORT_GREEN', 0x30d158, { emissive: 0x0b4518, emissiveIntensity: 0.2 }),
    anchor: material('IXB_SUPPORT_RED', 0xff453a, { emissive: 0x4a0905, emissiveIntensity: 0.2 }),
    hanger: material('IXB_SUPPORT_PURPLE', 0xbf5af2, { emissive: 0x360a55, emissiveIntensity: 0.2 }),
    unknown: material('IXB_SUPPORT_GREY', 0x8e8e93),
  });
}

function cylinderBetween(start, end, radius, mat, name, radialSegments = 18) {
  const dir = end.clone().sub(start);
  const length = dir.length();
  if (length < EPS) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1, false), mat);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  return mesh;
}

function coneArrow(start, direction, length, radius, mat, name) {
  const group = new THREE.Group();
  group.name = name;
  const dir = direction.clone().length() < EPS ? Y_AXIS.clone() : direction.clone().normalize();
  const shaftEnd = start.clone().addScaledVector(dir, length * 0.72);
  const tip = start.clone().addScaledVector(dir, length);
  const shaft = cylinderBetween(start, shaftEnd, radius, mat, `${name}-shaft`, 8);
  if (shaft) group.add(shaft);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, length * 0.28, 12), mat);
  cone.name = `${name}-head`;
  cone.position.copy(shaftEnd).add(tip).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(Y_AXIS, dir);
  group.add(cone);
  return group;
}
function componentAxis(element) {
  const a = caesarPointToGlb(element.start), b = caesarPointToGlb(element.end);
  const dir = b.clone().sub(a);
  return dir.length() < EPS ? new THREE.Vector3(1, 0, 0) : dir.normalize();
}
function addPipeLike(root, element, mats) {
  const a = caesarPointToGlb(element.start), b = caesarPointToGlb(element.end);
  const mesh = cylinderBetween(a, b, Math.max(element.diameter * 0.5, 2), element.type === 'BEND' ? mats.bend : mats.pipe, element.id, 20);
  if (!mesh) return null;
  mesh.userData = { glbShape: element.type === 'BEND' ? 'basic-bend-as-cylinder' : 'basic-pipe-cylinder', inputXmlBasic: true, elementType: element.type, fromNode: element.fromNode, toNode: element.toNode, diameter: element.diameter, sourceElementIndex: element.index };
  root.add(mesh);
  return mesh;
}
function addValve(root, element, mats) {
  addPipeLike(root, element, mats);
  const a = caesarPointToGlb(element.start), b = caesarPointToGlb(element.end), mid = a.clone().add(b).multiplyScalar(0.5), axis = componentAxis(element);
  const radius = Math.max(element.diameter * 0.62, 4);
  const box = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.3, radius * 1.45, radius * 1.45), mats.valve);
  box.name = `${element.id}-valve-body`; box.position.copy(mid); box.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis);
  box.userData = { inputXmlBasic: true, glbShape: 'basic-valve-box', elementType: 'VALVE', sourceElementIndex: element.index };
  root.add(box); return box;
}
function addFlange(root, element, mats) {
  addPipeLike(root, element, mats);
  const a = caesarPointToGlb(element.start), b = caesarPointToGlb(element.end), mid = a.clone().add(b).multiplyScalar(0.5), axis = componentAxis(element);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(Math.max(element.diameter * 0.7, 4), Math.max(element.diameter * 0.08, 1.4), 10, 32), mats.flange);
  torus.name = `${element.id}-flange-ring`; torus.position.copy(mid); torus.quaternion.setFromUnitVectors(Z_AXIS, axis);
  torus.userData = { inputXmlBasic: true, glbShape: 'basic-flange-ring', elementType: 'FLANGE', sourceElementIndex: element.index };
  root.add(torus); return torus;
}
function addTeeOrOlet(root, element, mats) {
  addPipeLike(root, element, mats);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(element.diameter * 0.62, 4), 16, 12), element.type === 'TEE' ? mats.tee : mats.flange);
  marker.name = `${element.id}-${element.type.toLowerCase()}-marker`; marker.position.copy(caesarPointToGlb(element.start));
  marker.userData = { inputXmlBasic: true, glbShape: `basic-${element.type.toLowerCase()}-sphere`, elementType: element.type, sourceElementIndex: element.index };
  root.add(marker); return marker;
}
function supportMaterial(kind, mats) { return kind === 'ANCHOR' ? mats.anchor : kind === 'HANGER' ? mats.hanger : kind === 'UNKNOWN' ? mats.unknown : mats.rest; }
function supportDirection(support) {
  const x = Number(support.xcosine), y = Number(support.ycosine), z = Number(support.zcosine);
  if (Number.isFinite(x) || Number.isFinite(y) || Number.isFinite(z)) {
    const d = caesarPointToGlb({ x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, z: Number.isFinite(z) ? z : 0 });
    if (d.length() > EPS) return d.normalize();
  }
  if (support.kind === 'GUIDE') return new THREE.Vector3(0, 0, 1);
  if (support.kind === 'LINESTOP') return new THREE.Vector3(1, 0, 0);
  if (support.kind === 'HOLDDOWN') return new THREE.Vector3(0, -1, 0);
  return new THREE.Vector3(0, 1, 0);
}
function addSupport(root, support, nodePoint, mats, index) {
  if (!nodePoint) return null;
  const base = caesarPointToGlb(nodePoint), dir = supportDirection(support), mat = supportMaterial(support.kind, mats);
  const group = new THREE.Group(); group.name = `IXB-SUPPORT-${String(index).padStart(3, '0')}-${support.kind}-${support.node}`; group.position.copy(base);
  group.userData = { inputXmlBasic: true, glbShape: 'basic-support-arrow', supportKind: support.kind, node: support.node, rawTag: support.rawTag };
  if (support.kind === 'ANCHOR') {
    group.add(coneArrow(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 70, 4, mats.anchor, `${group.name}-x`));
    group.add(coneArrow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 70, 4, mats.anchor, `${group.name}-y`));
    group.add(coneArrow(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 70, 4, mats.anchor, `${group.name}-z`));
  } else if (support.kind === 'GUIDE' || support.kind === 'LINESTOP') {
    group.add(coneArrow(new THREE.Vector3(), dir, 55, 4, mat, `${group.name}-plus`));
    group.add(coneArrow(new THREE.Vector3(), dir.clone().negate(), 55, 4, mat, `${group.name}-minus`));
  } else group.add(coneArrow(new THREE.Vector3(), dir, 65, 4, mat, `${group.name}-arrow`));
  root.add(group); return group;
}
function addNodeMarkers(root, nodes, mats) {
  for (const [node, rawPoint] of Object.entries(nodes || {})) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), mats.node);
    marker.name = `IXB-NODE-${node}`; marker.position.copy(caesarPointToGlb(rawPoint)); marker.userData = { inputXmlBasic: true, glbShape: 'basic-node-dot', node };
    root.add(marker);
  }
}
export function buildInputXmlBasicScene(model, options = {}) {
  const scene = new THREE.Scene(); scene.name = 'InputXML Basic GLB';
  const root = new THREE.Group(); root.name = 'INPUTXML_BASIC_GLB_ROOT';
  root.userData = { schema: 'inputxml-basic-glb-scene/v1', source: model.source, stats: model.stats, converter: 'Model converter > InputXML -> Basic GLB', independentPath: true };
  scene.add(root);
  const mats = makeMaterials();
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const directional = new THREE.DirectionalLight(0xffffff, 1.15); directional.name = 'IXB-DIRECTIONAL-LIGHT'; directional.position.set(1200, 2200, 1700); scene.add(directional);
  for (const element of model.elements || []) {
    if (!element.start || !element.end) continue;
    if (element.type === 'VALVE') addValve(root, element, mats);
    else if (element.type === 'FLANGE') addFlange(root, element, mats);
    else if (element.type === 'TEE' || element.type === 'OLET') addTeeOrOlet(root, element, mats);
    else addPipeLike(root, element, mats);
  }
  if (options.includeNodeMarkers !== false) addNodeMarkers(root, model.nodes, mats);
  if (options.includeSupports !== false) (model.supports || []).forEach((s, i) => addSupport(root, s, model.nodes?.[s.node], mats, i + 1));
  return scene;
}
