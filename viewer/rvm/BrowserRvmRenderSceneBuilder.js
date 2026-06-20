import * as THREE from 'three';
import { collectBrowserRvmRenderInstructions } from './BrowserRvmRenderContractAdapter.js';

export const BROWSER_RVM_RENDER_SCENE_SCHEMA = 'rvm-browser-render-scene/v1';

const DEFAULT_COLOR_BY_PRIMITIVE = Object.freeze({
  CYLINDER_BBOX: 0x3d74c5,
  PIPE_BBOX: 0x3d74c5,
  BOX_BBOX: 0x657083,
  STRUCTURE_BBOX: 0x7b8794,
  TORUS_BBOX_PLACEHOLDER: 0x444444,
  CONE_BBOX_PLACEHOLDER: 0x8f8f8f,
  VALVE_BBOX_PLACEHOLDER: 0xcc2222,
  FLANGE_BBOX_PLACEHOLDER: 0x9a9a9a,
  INSTRUMENT_BBOX_PLACEHOLDER: 0xb53f3f,
  UNKNOWN_BBOX_PLACEHOLDER: 0x657083
});

export function buildBrowserRvmRenderSceneFromHierarchy(roots = [], options = {}) {
  const instructionSet = collectBrowserRvmRenderInstructions(roots);
  return buildBrowserRvmRenderSceneFromInstructions(instructionSet.instructions, {
    ...options,
    instructionSet
  });
}

export function buildBrowserRvmRenderSceneFromInstructions(instructions = [], options = {}) {
  const group = new THREE.Group();
  group.name = options.name || 'BrowserRvmRenderScene';
  group.userData = {
    ...(group.userData || {}),
    schemaVersion: BROWSER_RVM_RENDER_SCENE_SCHEMA,
    instructionSchemaVersion: options.instructionSet?.schemaVersion || '',
    source: 'browser-rvm-render-instructions'
  };

  const diagnostics = {
    schemaVersion: BROWSER_RVM_RENDER_SCENE_SCHEMA,
    instructionCount: Array.isArray(instructions) ? instructions.length : 0,
    renderableCount: 0,
    skippedCount: 0,
    primitiveCounts: {},
    skippedReasons: {}
  };

  for (const instruction of Array.isArray(instructions) ? instructions : []) {
    const mesh = buildInstructionObject(instruction, options);
    if (!mesh) {
      diagnostics.skippedCount += 1;
      bump(diagnostics.skippedReasons, skipReason(instruction));
      continue;
    }
    diagnostics.renderableCount += 1;
    bump(diagnostics.primitiveCounts, instruction.renderPrimitive || 'UNKNOWN');
    group.add(mesh);
  }

  group.userData.diagnostics = diagnostics;
  return {
    schemaVersion: BROWSER_RVM_RENDER_SCENE_SCHEMA,
    scene: group,
    diagnostics,
    instructionSet: options.instructionSet || null
  };
}

export function buildInstructionObject(instruction = {}, options = {}) {
  const primitive = String(instruction.renderPrimitive || '').trim() || 'UNKNOWN_BBOX_PLACEHOLDER';
  const start = vec3(instruction.axisStart);
  const end = vec3(instruction.axisEnd);
  const center = vec3(instruction.center) || midPoint(start, end);
  const axis = start && end ? new THREE.Vector3().subVectors(end, start) : null;
  const length = Number.isFinite(instruction.length) && instruction.length > 0
    ? instruction.length
    : (axis ? axis.length() : 0);
  const radius = Number.isFinite(instruction.radius) && instruction.radius > 0
    ? instruction.radius
    : Math.max(length * 0.08, 1);

  if (!center) return null;

  const material = new THREE.MeshStandardMaterial({
    color: colorForPrimitive(primitive, options),
    roughness: 0.68,
    metalness: 0.12,
    transparent: primitive.includes('PLACEHOLDER'),
    opacity: primitive.includes('PLACEHOLDER') ? 0.84 : 1
  });

  let object = null;
  if ((primitive === 'BOX_BBOX' || primitive === 'STRUCTURE_BBOX') && start && end) {
    object = boxFromInstruction(instruction, center, length, radius, material);
  } else if (primitive === 'TORUS_BBOX_PLACEHOLDER') {
    object = torusPlaceholder(center, axis, length, radius, material);
  } else if (primitive === 'CONE_BBOX_PLACEHOLDER') {
    object = conePlaceholder(center, axis, length, radius, material);
  } else if (primitive === 'VALVE_BBOX_PLACEHOLDER' || primitive === 'INSTRUMENT_BBOX_PLACEHOLDER') {
    object = valveLikePlaceholder(center, axis, length, radius, material);
  } else if (start && end) {
    object = cylinderBetween(start, end, radius, material, 16);
  } else {
    object = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 16), material);
    object.position.copy(center);
  }

  if (!object) return null;
  object.name = instruction.sourcePath || instruction.sourceName || primitive;
  object.userData = {
    ...(object.userData || {}),
    schemaVersion: BROWSER_RVM_RENDER_SCENE_SCHEMA,
    sourcePath: instruction.sourcePath || '',
    sourceName: instruction.sourceName || '',
    type: instruction.type || 'UNKNOWN',
    kind: instruction.kind || 'UNKNOWN',
    renderPrimitive: primitive,
    renderSource: instruction.renderSource || '',
    contractVersion: instruction.contractVersion || ''
  };
  object.traverse?.((child) => {
    if (!child || child === object) return;
    child.userData = { ...(child.userData || {}), parentBrowserRvmRenderPrimitive: primitive, sourcePath: object.userData.sourcePath };
  });
  return object;
}

function cylinderBetween(start, end, radius, material, radialSegments = 16) {
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (!Number.isFinite(length) || length <= 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material);
  mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  return mesh;
}

function boxFromInstruction(instruction, center, length, radius, material) {
  const bbox = parseBbox(instruction.bbox || instruction.rawBbox);
  let width = Math.max(length, radius * 2);
  let height = Math.max(radius * 2, 1);
  let depth = Math.max(radius * 2, 1);
  if (bbox) {
    width = Math.max(Math.abs(bbox[3] - bbox[0]), 0.001);
    height = Math.max(Math.abs(bbox[4] - bbox[1]), 0.001);
    depth = Math.max(Math.abs(bbox[5] - bbox[2]), 0.001);
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.copy(center);
  return mesh;
}

function torusPlaceholder(center, axis, length, radius, material) {
  const ringRadius = Math.max((Number.isFinite(length) && length > 0 ? length : radius * 4) * 0.33, radius * 1.2, 1);
  const tubeRadius = Math.max(radius * 0.35, 0.5);
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, tubeRadius, 18, 36), material);
  mesh.position.copy(center);
  if (axis && axis.length() > 1e-6) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  return mesh;
}

function conePlaceholder(center, axis, length, radius, material) {
  const safeLength = Math.max(length || radius * 4, radius * 2, 1);
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.35, safeLength, 18), material);
  mesh.position.copy(center);
  if (axis && axis.length() > 1e-6) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  return mesh;
}

function valveLikePlaceholder(center, axis, length, radius, material) {
  const group = new THREE.Group();
  group.position.copy(center);
  const body = new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius * 1.4, 1), 16, 16), material);
  group.add(body);
  if (axis && axis.length() > 1e-6) {
    const dir = axis.clone().normalize();
    const half = Math.max((length || radius * 4) * 0.35, radius * 1.5);
    const start = dir.clone().multiplyScalar(-half);
    const end = dir.clone().multiplyScalar(half);
    const barrel = cylinderBetween(start, end, Math.max(radius * 0.62, 0.5), material, 14);
    if (barrel) group.add(barrel);
  }
  return group;
}

function colorForPrimitive(primitive, options = {}) {
  const colors = options.colorByPrimitive || DEFAULT_COLOR_BY_PRIMITIVE;
  return colors[primitive] ?? colors.UNKNOWN_BBOX_PLACEHOLDER ?? 0x657083;
}

function vec3(value) {
  if (!value) return null;
  if (value.isVector3) return value.clone();
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function midPoint(a, b) {
  if (!a || !b) return null;
  return new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
}

function parseBbox(value) {
  if (Array.isArray(value) && value.length >= 6) {
    const nums = value.slice(0, 6).map(Number);
    return nums.every(Number.isFinite) ? nums : null;
  }
  if (typeof value === 'string') {
    const nums = value.split(/[\s,]+/g).map(Number).filter(Number.isFinite);
    return nums.length >= 6 ? nums.slice(0, 6) : null;
  }
  return null;
}

function bump(target, key) {
  const name = String(key || '').trim() || 'UNKNOWN';
  target[name] = (target[name] || 0) + 1;
}

function skipReason(instruction) {
  if (!instruction || typeof instruction !== 'object') return 'invalid-instruction';
  if (!instruction.center && !instruction.axisStart && !instruction.axisEnd) return 'missing-position';
  return 'unsupported-geometry';
}
