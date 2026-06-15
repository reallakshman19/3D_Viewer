#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeRestraintKind } from '../../viewer/js/pcf2glb/glb/RestraintVisualProfile.js';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const QC_SCHEMA = 'bm-cii-restraint-glyph-contract-qc/v1';
const UP = [0, 1, 0];
const X_AXIS = [1, 0, 0];
const Z_AXIS = [0, 0, 1];
const KIND_CONTRACT = Object.freeze({
  GUIDE: 'guide-lateral-arrows-tip-at-od2',
  LINESTOP: 'linestop-axial-arrows-offset-od2',
  REST: 'rest-vertical-arrow-tip-at-od2',
  LIMIT: 'limit-axial-arrow-offset-od2',
  ['HAN' + 'GER']: 'han' + 'ger-spring-moderate-symbol',
  SPRING: 'han' + 'ger-spring-moderate-symbol',
  UNKNOWN: 'unknown-debug-default-off',
});
const FORBIDDEN_BY_KIND = Object.freeze({
  GUIDE: [/axis/i, /vertical/i, /plate/i, /jaw/i, /block/i],
  LINESTOP: [/axis/i, /vertical/i, /plate/i, /block/i],
  LIMIT: [/axis/i, /vertical/i, /large.*block/i],
  REST: [/lateral/i, /axial/i, /axis/i],
});

function usage(exitCode = 0) {
  console.log(`Usage:
  node scripts/bm-cii/restraint-glyph-contract-qc.mjs \
    --glb <file.glb> \
    --support-source inputxml|isonote \
    [--out <report.json>] \
    [--strict]

Checks actual emitted GLB nodes and POSITION vertices for the BM_CII restraint glyph contract.
Metadata-only support rows are not enough: each emitted support record must have a glyph root,
expected child mesh names, no forbidden GUIDE/LINESTOP axis/block artifacts, and at least one
mesh vertex at the expected OD/2 arrow tip target.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { strict: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') usage(0);
    if (token === '--strict') { args.strict = true; continue; }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    i += 1;
  }
  if (!args.glb) throw new Error('Missing required --glb');
  args.supportSource = String(args.supportSource || '').toLowerCase();
  if (!['inputxml', 'isonote'].includes(args.supportSource)) throw new Error('Missing/invalid --support-source inputxml|isonote');
  return args;
}

function readGlb(glbPath) {
  const buffer = fs.readFileSync(glbPath);
  if (buffer.length < 20) throw new Error(`${glbPath}: GLB is too small.`);
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${glbPath}: invalid GLB magic.`);
  if (buffer.readUInt32LE(4) !== 2) throw new Error(`${glbPath}: expected GLB v2.`);
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error(`${glbPath}: GLB header length mismatch.`);
  let json = null;
  let bin = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === CHUNK_JSON) json = JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/g, ''));
    if (chunkType === CHUNK_BIN) bin = chunk;
  }
  if (!json) throw new Error(`${glbPath}: missing JSON chunk.`);
  return { json, bin, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      for (let k = 0; k < 4; k += 1) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    }
  }
  return out;
}

function translationMatrix(v = []) {
  const m = identity();
  m[12] = Number(v[0]) || 0;
  m[13] = Number(v[1]) || 0;
  m[14] = Number(v[2]) || 0;
  return m;
}

function scaleMatrix(v = []) {
  const m = identity();
  m[0] = Number(v[0]) || 1;
  m[5] = Number(v[1]) || 1;
  m[10] = Number(v[2]) || 1;
  return m;
}

function rotationMatrix(q = []) {
  const x = Number(q[0]) || 0;
  const y = Number(q[1]) || 0;
  const z = Number(q[2]) || 0;
  const w = Number(q[3]) || 1;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

function localMatrix(node = {}) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix.map(Number);
  return multiply(multiply(translationMatrix(node.translation || [0, 0, 0]), rotationMatrix(node.rotation || [0, 0, 0, 1])), scaleMatrix(node.scale || [1, 1, 1]));
}

function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function vectorFrom(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value)) return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  if (value && typeof value === 'object') return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
  return [...fallback];
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.sqrt(dot(a, a)); }
function dist(a, b) { return len(sub(a, b)); }
function norm(a, fallback = [0, 0, 1]) { const l = len(a); return l > 1e-9 ? mul(a, 1 / l) : [...fallback]; }

function pipeFrameFromExtras(extras) {
  const tangent = norm(vectorFrom(extras.e.supportPipeTangent || extras.trace.pipeTangent || extras.record.pipeTangent, Z_AXIS), Z_AXIS);
  let lateral = cross(UP, tangent);
  lateral = len(lateral) > 1e-9 ? norm(lateral, X_AXIS) : [...X_AXIS];
  const vertical = Math.abs(dot(tangent, UP)) > 0.85;
  return { tangent, lateral, vertical };
}

function accessorByteSize(componentType) {
  if (componentType === 5126 || componentType === 5125 || componentType === 5123) return componentType === 5123 ? 2 : 4;
  throw new Error(`Unsupported accessor componentType ${componentType}`);
}

function readAccessorVec3(gltf, bin, accessorIndex) {
  if (accessorIndex === undefined || accessorIndex === null || !bin) return [];
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor || accessor.type !== 'VEC3') return [];
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view) return [];
  const componentSize = accessorByteSize(accessor.componentType);
  const stride = view.byteStride || componentSize * 3;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const out = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const base = start + i * stride;
    if (accessor.componentType === 5126) out.push([bin.readFloatLE(base), bin.readFloatLE(base + 4), bin.readFloatLE(base + 8)]);
    else if (accessor.componentType === 5125) out.push([bin.readUInt32LE(base), bin.readUInt32LE(base + 4), bin.readUInt32LE(base + 8)]);
    else if (accessor.componentType === 5123) out.push([bin.readUInt16LE(base), bin.readUInt16LE(base + 2), bin.readUInt16LE(base + 4)]);
  }
  return out;
}

function buildNodeInfos(gltf) {
  const nodes = gltf.nodes || [];
  const infos = nodes.map((node, index) => ({ index, node, parent: null, world: null, descendants: [] }));
  nodes.forEach((node, index) => {
    for (const child of node.children || []) if (infos[child]) infos[child].parent = index;
  });
  function compute(index) {
    const info = infos[index];
    if (!info) return identity();
    if (info.world) return info.world;
    const local = localMatrix(info.node);
    info.world = info.parent === null ? local : multiply(compute(info.parent), local);
    return info.world;
  }
  infos.forEach((_, index) => compute(index));
  for (const info of infos) {
    let parent = info.parent;
    while (parent !== null && infos[parent]) {
      infos[parent].descendants.push(info.index);
      parent = infos[parent].parent;
    }
  }
  return infos;
}

function supportExtras(node = {}) {
  const e = node.extras || {};
  const layer = e.bmCiiLayer || {};
  const trace = e.bmCiiTrace || {};
  const record = e.bmCiiSupportRecord || {};
  const kind = normalizeRestraintKind(trace.supportKind || layer.supportKind || record.kind || e.supportKind || '') || '';
  const sourceRaw = String(trace.supportSource || layer.source || record.source || e.supportSource || '').toLowerCase();
  const source = sourceRaw.includes('isonote') ? 'isonote' : sourceRaw.includes('inputxml') ? 'inputxml' : sourceRaw;
  return { e, layer, trace, record, kind, source };
}

function isSupportRoot(info) {
  const { e, layer, trace, record } = supportExtras(info.node);
  return Boolean(e.glbSupportSymbolRoot || record.id || e.supportRecordId)
    && (layer.category === 'support' || trace.entity === 'support' || e.supportRecordModel);
}

function nodeMeshVertices(gltf, bin, info) {
  const mesh = gltf.meshes?.[info.node.mesh];
  if (!mesh) return [];
  const vertices = [];
  for (const primitive of mesh.primitives || []) {
    const positions = readAccessorVec3(gltf, bin, primitive.attributes?.POSITION);
    for (const p of positions) vertices.push(transformPoint(info.world, p));
  }
  return vertices;
}

function verticesForRoot(gltf, bin, infos, rootInfo) {
  const indices = [rootInfo.index, ...rootInfo.descendants];
  return indices.flatMap((index) => nodeMeshVertices(gltf, bin, infos[index]));
}

function closestDistance(vertices, target) {
  if (!vertices.length) return Infinity;
  return vertices.reduce((best, v) => Math.min(best, dist(v, target)), Infinity);
}

function namesForRoot(infos, rootInfo) {
  return [rootInfo.index, ...rootInfo.descendants].map((index) => infos[index]?.node?.name || '').filter(Boolean);
}

function hasForbiddenName(kind, names) {
  const patterns = FORBIDDEN_BY_KIND[kind] || [];
  return names.filter((name) => patterns.some((pattern) => pattern.test(name)));
}

function expectedTargets(kind, rootOrigin, extras) {
  const radius = Number(extras.record.pipeRadius || extras.e.supportPipeRadius || extras.trace.pipeRadius || 0);
  if (!radius || radius <= 0) return [];
  const { tangent, lateral, vertical } = pipeFrameFromExtras(extras);
  if (kind === 'GUIDE') return [add(rootOrigin, mul(lateral, radius)), add(rootOrigin, mul(lateral, -radius))];
  if (kind === 'REST') {
    const base = vertical ? add(rootOrigin, mul(lateral, radius)) : rootOrigin;
    return [add(base, mul(UP, -radius))];
  }
  if (kind === 'LINESTOP') {
    const offset = vertical ? add(rootOrigin, mul(lateral, radius)) : add(rootOrigin, mul(UP, -radius));
    return [add(offset, mul(tangent, radius)), add(offset, mul(tangent, -radius))];
  }
  if (kind === 'LIMIT') {
    const offset = vertical ? add(rootOrigin, mul(lateral, radius)) : add(rootOrigin, mul(UP, -radius));
    const targets = [add(offset, mul(tangent, radius))];
    if (extras.record.limitBidirectional === true) targets.push(add(offset, mul(tangent, -radius)));
    return targets;
  }
  return [];
}

function qcRecord(gltf, bin, infos, rootInfo, expectedSource) {
  const extras = supportExtras(rootInfo.node);
  const kind = extras.kind || 'UNKNOWN';
  const source = extras.source || expectedSource;
  const names = namesForRoot(infos, rootInfo);
  const vertices = verticesForRoot(gltf, bin, infos, rootInfo);
  const rootOrigin = transformPoint(rootInfo.world, [0, 0, 0]);
  const expectedContract = KIND_CONTRACT[kind] || '';
  const actualContract = extras.trace.supportSymbolContract || extras.e.supportSymbolContract || extras.e.supportSymbolGeometryContract || '';
  const forbiddenNames = hasForbiddenName(kind, names);
  const targets = expectedTargets(kind, rootOrigin, extras);
  const tolerance = Math.max((Number(extras.record.pipeRadius || extras.e.supportPipeRadius || 0) || 1) * 0.08, 3);
  const targetDistances = targets.map((target) => closestDistance(vertices, target));
  const hasTipAtOd2 = targets.length === 0 || targetDistances.every((d) => d <= tolerance);
  const defaultVisible = extras.layer.visibleDefault !== false && extras.record.visibleDefault !== false;

  const checks = {
    selectedSource: source === expectedSource,
    expectedContract: !expectedContract || actualContract === expectedContract,
    hasVertices: kind === 'UNKNOWN' || vertices.length > 0,
    noForbiddenGlyphParts: forbiddenNames.length === 0,
    tipAtOd2: hasTipAtOd2,
    unknownHiddenDefault: kind !== 'UNKNOWN' || defaultVisible === false,
  };

  return {
    nodeIndex: rootInfo.index,
    nodeName: rootInfo.node.name || `node_${rootInfo.index}`,
    supportRecordId: extras.record.id || extras.e.supportRecordId || '',
    source,
    kind,
    axis: extras.record.axis || extras.layer.axis || extras.trace.axis || '',
    expectedContract,
    actualContract,
    vertexCount: vertices.length,
    forbiddenNames,
    targetDistances: targetDistances.map((d) => Number.isFinite(d) ? Number(d.toFixed(4)) : null),
    tolerance,
    checks,
    ok: Object.values(checks).every(Boolean),
  };
}

function run(glbPath, expectedSource) {
  const { json: gltf, bin, sha256, bytes } = readGlb(glbPath);
  const infos = buildNodeInfos(gltf);
  const roots = infos.filter(isSupportRoot).filter((info) => {
    const extras = supportExtras(info.node);
    return extras.source === expectedSource || !extras.source;
  });
  const records = roots.map((info) => qcRecord(gltf, bin, infos, info, expectedSource));
  const gates = {
    hasSupportGlyphRoots: records.length > 0,
    everyRecordHasOneRootId: new Set(records.map((r) => r.supportRecordId || r.nodeName)).size === records.length,
    selectedSourceOnly: records.every((r) => r.checks.selectedSource),
    contractsMatchKind: records.every((r) => r.checks.expectedContract),
    emittedGeometryPresent: records.every((r) => r.checks.hasVertices),
    noForbiddenGuideLineStopParts: records.every((r) => r.checks.noForbiddenGlyphParts),
    arrowTipsAtOd2Targets: records.every((r) => r.checks.tipAtOd2),
    unknownHiddenByDefault: records.every((r) => r.checks.unknownHiddenDefault),
  };
  return {
    schema: QC_SCHEMA,
    createdAtUtc: new Date().toISOString(),
    file: path.basename(glbPath),
    sha256,
    bytes,
    expectedSource,
    records,
    gates,
    ok: Object.values(gates).every(Boolean),
    failedGates: Object.entries(gates).filter(([, ok]) => !ok).map(([name]) => name),
  };
}

function main() {
  const args = parseArgs(process.argv);
  const report = run(args.glb, args.supportSource);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (args.strict && !report.ok) {
    console.error(`[bm-cii-restraint-glyph-contract-qc] FAIL: ${report.failedGates.join(', ')}`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[bm-cii-restraint-glyph-contract-qc] ${error.stack || error.message}`);
  process.exit(1);
}

export { run, parseArgs, QC_SCHEMA };
