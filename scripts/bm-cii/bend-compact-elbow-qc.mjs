#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const EPS = 1e-6;
const RATIO_TARGET = 1.5;
const RATIO_TOL = 0.18;
const GEOMETRY_TOL = 0.12;

function usage() {
  console.error(`Usage:
  node scripts/bm-cii/bend-compact-elbow-qc.mjs --glb <file.glb> [--out <report.json>]

Gate J: validates compact standard elbow contract for BM_CII BEND/ELBOW geometry.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) usage();
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) usage();
    out[key] = value;
    i += 1;
  }
  if (!out.glb) usage();
  return out;
}

function readJsonChunk(filePath) {
  const data = fs.readFileSync(filePath);
  if (filePath.toLowerCase().endsWith('.gltf') || data.slice(0, 1).toString('utf8') === '{') return JSON.parse(data.toString('utf8'));
  if (data.length < 20) throw new Error(`Invalid GLB: file too short: ${filePath}`);
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`Invalid GLB magic: ${filePath}`);
  if (data.readUInt32LE(4) !== 2) throw new Error('Unsupported GLB version; expected 2');
  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkLength = data.readUInt32LE(offset);
    const chunkType = data.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4e4f534a) return JSON.parse(data.slice(offset, offset + chunkLength).toString('utf8').replace(/\0+$/g, '').trim());
    offset += chunkLength;
  }
  throw new Error(`No JSON chunk found in ${filePath}`);
}

function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function extrasOf(node = {}) { return node.extras && typeof node.extras === 'object' ? node.extras : {}; }
function traceOf(node = {}) { const extras = extrasOf(node); return extras.bmCiiTrace && typeof extras.bmCiiTrace === 'object' ? extras.bmCiiTrace : {}; }

function reachableNodeIndices(gltf) {
  const nodes = gltf.nodes || [];
  const scene = (gltf.scenes || [])[Number.isInteger(gltf.scene) ? gltf.scene : 0] || (gltf.scenes || [])[0];
  const roots = Array.isArray(scene?.nodes) ? scene.nodes : nodes.map((_, index) => index);
  const seen = new Set();
  const visit = (idx) => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= nodes.length || seen.has(idx)) return;
    seen.add(idx);
    for (const child of nodes[idx].children || []) visit(child);
  };
  roots.forEach(visit);
  return seen;
}

function isBendRelated(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  const haystack = upper([
    node.name,
    extras.glbShape,
    extras.bmCiiBendVisualContract,
    extras.bendCurveType,
    trace.componentType,
    trace.semanticCategory,
    trace.glbShape,
  ].join(' '));
  return haystack.includes('BEND') || haystack.includes('ELBOW');
}

function isCompactContractNode(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  return extras.bmCiiCompactElbowContract === true
    || text(extras.bmCiiBendVisualContract) === 'compact-standard-elbow-1p5d'
    || text(trace.bmCiiBendVisualContract) === 'compact-standard-elbow-1p5d'
    || /compact.*elbow/i.test(`${node.name} ${extras.glbShape}`);
}

function componentType(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  return upper(trace.componentType || extras.pcfType || extras.componentType || extras.type || '');
}

function approxEqual(actual, expected, toleranceRatio) {
  if (![actual, expected].every(Number.isFinite) || expected <= EPS) return false;
  return Math.abs(actual - expected) <= Math.max(EPS, Math.abs(expected) * toleranceRatio);
}

function checkCompactNode(report, node, index) {
  const extras = extrasOf(node);
  const name = text(node.name) || `node-${index}`;
  const radiusRatio = num(extras.bendRadiusRatioD);
  const radius = num(extras.bendRadius);
  const angleDeg = num(extras.bendAngleDeg);
  const arcLength = num(extras.bendArcLength);
  const arcChord = num(extras.bendArcChord);
  const expectedArcChord = num(extras.bendExpectedArcChord);
  const sourceSpan = num(extras.bendSourceSpanLength);
  const curveType = text(extras.bendCurveType);

  const item = {
    index,
    name,
    type: componentType(node),
    glbShape: text(extras.glbShape),
    radiusRatio,
    radius,
    angleDeg,
    arcLength,
    arcChord,
    expectedArcChord,
    sourceSpan,
    curveType,
  };
  report.bends.push(item);

  if (!isCompactContractNode(node)) report.failures.push(`${name}: missing compact-standard-elbow-1p5d contract`);
  if (curveType && /catmull/i.test(curveType)) report.failures.push(`${name}: Catmull-Rom bend curve is forbidden for Gate J`);
  if (!Number.isFinite(radiusRatio) || Math.abs(radiusRatio - RATIO_TARGET) > RATIO_TOL) report.failures.push(`${name}: bend radius ratio ${radiusRatio} is not approximately 1.5D`);
  if (!(radius > 0)) report.failures.push(`${name}: missing positive bend radius`);
  if (!(angleDeg > 0)) report.failures.push(`${name}: missing positive bend angle`);
  if (!(arcLength > 0)) report.failures.push(`${name}: missing positive arc length`);
  if (!(arcChord > 0)) report.failures.push(`${name}: missing positive arc chord`);
  if (radius > 0 && angleDeg > 0) {
    const expectedLength = radius * (Math.abs(angleDeg) * Math.PI / 180);
    if (!approxEqual(arcLength, expectedLength, GEOMETRY_TOL)) report.failures.push(`${name}: arc length ${arcLength} != R*theta ${expectedLength}`);
  }
  if (expectedArcChord > 0 && !approxEqual(arcChord, expectedArcChord, GEOMETRY_TOL)) report.failures.push(`${name}: arc chord ${arcChord} != compact elbow chord ${expectedArcChord}`);
  if (sourceSpan > 0 && arcChord > 0 && sourceSpan > arcChord * 2.5 && arcChord / sourceSpan > 0.75) report.failures.push(`${name}: arc chord is too close to full source span; likely full-span bend`);
}

function run() {
  const args = parseArgs(process.argv);
  const gltf = readJsonChunk(args.glb);
  const nodes = gltf.nodes || [];
  const reachable = reachableNodeIndices(gltf);
  const report = {
    schema: 'bm-cii-bend-compact-elbow-qc/v1',
    gate: 'J',
    glb: path.resolve(args.glb),
    generatedAt: new Date().toISOString(),
    pass: false,
    bends: [],
    failures: [],
    warnings: [],
  };

  const candidates = [];
  for (const index of reachable) {
    const node = nodes[index];
    if (!isBendRelated(node)) continue;
    const type = componentType(node);
    const compact = isCompactContractNode(node);
    if (compact || ['BEND', 'ELBOW'].includes(type) || /localized.*bend|compact.*elbow/i.test(text(node.name))) candidates.push({ index, node });
  }

  const compactRoots = new Map();
  for (const { index, node } of candidates) {
    if (!isCompactContractNode(node)) {
      const name = text(node.name) || `node-${index}`;
      const shape = text(extrasOf(node).glbShape);
      if (['BEND', 'ELBOW'].includes(componentType(node)) || /catmull|spline|full/i.test(`${name} ${shape}`)) report.failures.push(`${name}: bend-related node lacks compact elbow contract`);
      continue;
    }
    const key = text(traceOf(node).sourceComponentId || extrasOf(node).pcfId || node.name || index);
    if (!compactRoots.has(key)) compactRoots.set(key, { index, node });
  }

  for (const { index, node } of compactRoots.values()) checkCompactNode(report, node, index);
  if (!compactRoots.size) report.failures.push('No compact elbow contract nodes found in GLB');

  report.counts = {
    reachableNodes: reachable.size,
    bendCandidates: candidates.length,
    compactBends: compactRoots.size,
  };
  report.pass = report.failures.length === 0;
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

run();
