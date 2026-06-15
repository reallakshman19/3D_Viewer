#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(`Usage:\n  node scripts/bm-cii/component-presence-qc.mjs --glb <file.glb> --expected <component_expected_summary.json> [--out <report.json>]`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) usage();
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) usage();
    out[arg.slice(2)] = value;
    i += 1;
  }
  if (!out.glb || !out.expected) usage();
  return out;
}

function readJsonChunk(filePath) {
  const data = fs.readFileSync(filePath);
  if (filePath.toLowerCase().endsWith('.gltf') || data.slice(0, 1).toString('utf8') === '{') return JSON.parse(data.toString('utf8'));
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error(`Invalid GLB magic: ${filePath}`);
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
function extrasOf(node = {}) { return node.extras && typeof node.extras === 'object' ? node.extras : {}; }
function traceOf(node = {}) { const extras = extrasOf(node); return extras.bmCiiTrace && typeof extras.bmCiiTrace === 'object' ? extras.bmCiiTrace : {}; }
function defaultSceneIndex(gltf) { return Number.isInteger(gltf.scene) ? gltf.scene : 0; }

function reachableNodeIndices(gltf) {
  const nodes = gltf.nodes || [];
  const scene = (gltf.scenes || [])[defaultSceneIndex(gltf)] || (gltf.scenes || [])[0];
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

function emptySummary() {
  return { total: 0, nonPipeTotal: 0, byCategory: {}, byType: {} };
}

function countComponents(gltf) {
  const nodes = gltf.nodes || [];
  const reachable = reachableNodeIndices(gltf);
  const byKey = new Map();
  for (const index of reachable) {
    const node = nodes[index];
    const trace = traceOf(node);
    if (trace.entity !== 'component') continue;
    const category = text(trace.semanticCategory || 'other') || 'other';
    // Annotation label anchors are exported as component traces so the Basic Viewer can
    // show labels. They are not plant components and must not affect plant completeness.
    if (category === 'support' || category === 'annotation') continue;
    const key = text(trace.traceKey || trace.sourceComponentId || node.name || `component:${index}`);
    if (!key || byKey.has(key)) continue;
    const type = text(trace.componentType || category).toUpperCase() || 'UNKNOWN';
    byKey.set(key, { key, name: text(node.name), category, type, fromNode: trace.fromNode || '', toNode: trace.toNode || '' });
  }
  const summary = emptySummary();
  summary.total = byKey.size;
  for (const item of byKey.values()) {
    summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
    summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
    if (item.category !== 'pipe') summary.nonPipeTotal += 1;
  }
  return { summary, components: [...byKey.values()] };
}

function compareSummary(report, expected, actual) {
  if (actual.total !== expected.total) report.failures.push(`component total ${actual.total} != expected ${expected.total}`);
  if ((actual.nonPipeTotal || 0) !== (expected.nonPipeTotal || 0)) report.failures.push(`non-pipe component total ${actual.nonPipeTotal || 0} != expected ${expected.nonPipeTotal || 0}`);
  for (const [category, count] of Object.entries(expected.byCategory || {})) {
    const actualCount = actual.byCategory?.[category] || 0;
    if (actualCount !== count) report.failures.push(`component category ${category}: ${actualCount} != expected ${count}`);
  }
  for (const required of ['pipe', 'bend', 'flange', 'teeOlet']) {
    if ((expected.byCategory?.[required] || 0) > 0 && (actual.byCategory?.[required] || 0) === 0) report.failures.push(`required component category missing from GLB: ${required}`);
  }
}

function run() {
  const args = parseArgs(process.argv);
  const expected = JSON.parse(fs.readFileSync(args.expected, 'utf8'));
  const gltf = readJsonChunk(args.glb);
  const { summary: actual, components } = countComponents(gltf);
  const report = { schema: 'bm-cii-component-presence-qc/v2', glb: path.resolve(args.glb), expected, actual, components, failures: [], pass: false };
  compareSummary(report, expected, actual);
  report.pass = report.failures.length === 0;
  if (args.out) { fs.mkdirSync(path.dirname(args.out), { recursive: true }); fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

run();
