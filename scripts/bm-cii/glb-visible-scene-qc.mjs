#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const LEGACY_NODE_PATTERNS = [
  /BM_CII_RESTRAINT_OD2_V19/i,
  /SUPPORT_ARROW_V7/i,
  /AXIS_X_BLUE/i,
  /AXIS_Y_GREEN/i,
  /AXIS_Z_RED/i,
  /CAESAR_ANNOTATION_OD2_V19/i,
];

const CONTRACTS = Object.freeze({
  GUIDE: 'guide-lateral-arrows-tip-at-od2',
  REST: 'rest-vertical-arrow-tip-at-od2',
  SHOE: 'rest-vertical-arrow-tip-at-od2',
  HOLDDOWN: 'rest-vertical-arrow-tip-at-od2',
  LINESTOP: 'linestop-axial-arrows-offset-od2',
  LIMIT: 'limit-axial-arrow-offset-od2',
  UNKNOWN: 'unknown-debug-default-off',
  HANGER: 'hanger-spring-moderate-symbol',
  SPRING: 'hanger-spring-moderate-symbol',
});

const ALLOWED_ANNOTATION_NODES = new Set(['35', '130', '205', '255']);
const ALLOWED_CALLOUT_NOS = new Set(['1', '2', '3', '4']);
const EPS = 1e-6;
const MATH_TOL = 1e-3;
const UP = [0, 1, 0];

function usage() {
  console.error(`Usage:
  node scripts/bm-cii/glb-visible-scene-qc.mjs --glb <file.glb> [options]

Options:
  --expected-support <json>       Expected support mapping JSON. Array or object accepted.
  --expected-source <inputxml|isonote>
  --expected-support-count <n>    Required support root count when no mapping file is supplied.
  --expected-callout-count <n>    Defaults to 4.
  --expected-node-label-count <n> Defaults to 4.
  --out <json>                    Write report JSON.
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
  if (data.readUInt32LE(4) !== 2) throw new Error(`Unsupported GLB version; expected 2`);
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
function vec(value) {
  if (Array.isArray(value) && value.length >= 3) {
    const out = [Number(value[0]), Number(value[1]), Number(value[2])];
    return out.every(Number.isFinite) ? out : null;
  }
  if (value && typeof value === 'object') {
    const out = [Number(value.x), Number(value.y), Number(value.z)];
    return out.every(Number.isFinite) ? out : null;
  }
  return null;
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.sqrt(dot(a, a)); }
function normalize(a) { const l = a ? len(a) : 0; return l < EPS ? null : [a[0] / l, a[1] / l, a[2] / l]; }
function distancePointToLine(point, linePoint, lineDir) { const T = normalize(lineDir); return T ? len(cross(sub(point, linePoint), T)) : Infinity; }

function extrasOf(node = {}) { return node.extras && typeof node.extras === 'object' ? node.extras : {}; }
function traceOf(node = {}) { const extras = extrasOf(node); return extras.bmCiiTrace && typeof extras.bmCiiTrace === 'object' ? extras.bmCiiTrace : {}; }
function layerIdsOf(extras = {}) { const ids = extras.bmCiiLayer?.layerIds || extras.bmCiiLayerIds || []; return Array.isArray(ids) ? ids.filter(Boolean).map(String) : []; }
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

function hasAuthoritativeFlag(gltf, reachable) {
  for (const scene of gltf.scenes || []) if (scene?.extras?.bmCiiSupportGlyphsAuthoritative === true || scene?.extras?.bmCiiSupportGlyphOnly === true) return true;
  for (const idx of reachable) {
    const extras = extrasOf((gltf.nodes || [])[idx]);
    if (extras.bmCiiSupportGlyphsAuthoritative === true || extras.bmCiiSupportGlyphAuthoritative === true || extras.bmCiiGlyphOnlySupport === true) return true;
  }
  return false;
}

function normalizeSupportExpected(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.records)) return raw.records;
  if (Array.isArray(raw.supportRecords)) return raw.supportRecords;
  if (Array.isArray(raw.expected)) return raw.expected;
  if (Array.isArray(raw.supports)) return raw.supports;
  const merged = [];
  for (const key of ['inputxml', 'InputXML', 'supportsInputXml', 'isonote', 'ISONOTE', 'supportsIsonote']) if (Array.isArray(raw[key])) merged.push(...raw[key]);
  return merged;
}

function isSupportRoot(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  const layer = extras.bmCiiLayer || {};
  if (trace.entity === 'support-glyph-primitive' || extras.bmCiiGlyphPrimitive) return false;
  return trace.entity === 'support' || extras.bmCiiGlyphOnlySupport === true || extras.bmCiiSupportGlyphAuthoritative === true || Boolean(extras.supportRecordId) || layer.category === 'support';
}
function isSupportPrimitive(node = {}) { const extras = extrasOf(node); const trace = traceOf(node); return trace.entity === 'support-glyph-primitive' || Boolean(extras.bmCiiGlyphPrimitive); }

function supportRootInfo(gltf, index) {
  const node = gltf.nodes[index];
  const extras = extrasOf(node);
  const trace = traceOf(node);
  const layer = extras.bmCiiLayer || {};
  const pipeTangent = normalize(vec(trace.pipeTangent || extras.pipeTangent || extras.supportPipeTangent || [0, 0, 1]));
  return {
    index,
    name: text(node.name),
    recordId: text(trace.recordId || extras.supportRecordId || extras.recordId),
    kind: upper(trace.supportKind || extras.supportKind || layer.supportKind),
    source: text(trace.source || extras.supportSource || layer.source).toLowerCase(),
    node: text(trace.node || extras.sourceNode || layer.node),
    axis: upper(trace.axis || extras.restraintAxis || layer.axis),
    contract: text(trace.supportSymbolContract || extras.supportSymbolContract),
    pipePoint: vec(trace.pipePoint || extras.pipePoint || extras.supportPipePoint),
    pipeTangent,
    pipeRadius: num(trace.pipeRadius ?? extras.supportPipeRadius ?? extras.pipeRadius),
    visibleDefault: trace.visibleDefault ?? layer.visibleDefault ?? extras.visibleDefault,
    layerIds: layerIdsOf(extras),
  };
}

function primitiveInfo(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  const primitive = extras.bmCiiGlyphPrimitive || {};
  return { name: text(node.name), recordId: text(trace.recordId || extras.supportRecordId), role: text(primitive.role || trace.role), contract: text(primitive.contract || trace.supportSymbolContract), start: vec(primitive.start || trace.start), tip: vec(primitive.tip || trace.tip), direction: normalize(vec(primitive.direction || trace.direction || null)) };
}

function requireLayer(report, support, id) { if (!support.layerIds.includes(id)) report.failures.push(`${support.recordId || support.name}: missing layer '${id}'`); }
function checkSupportRoot(report, support) {
  if (!support.recordId) report.failures.push(`${support.name}: missing support recordId`);
  if (!support.source) report.failures.push(`${support.recordId || support.name}: missing source`);
  if (!support.node) report.failures.push(`${support.recordId || support.name}: missing node`);
  if (!support.kind) report.failures.push(`${support.recordId || support.name}: missing supportKind`);
  if (!support.contract) report.failures.push(`${support.recordId || support.name}: missing supportSymbolContract`);
  const expectedContract = CONTRACTS[support.kind] || CONTRACTS.UNKNOWN;
  if (support.contract && support.contract !== expectedContract) report.failures.push(`${support.recordId}: contract ${support.contract} != ${expectedContract}`);
  if (!support.pipePoint) report.failures.push(`${support.recordId}: missing finite pipePoint`);
  if (!support.pipeTangent) report.failures.push(`${support.recordId}: missing normalized pipeTangent`);
  if (!(support.pipeRadius > 0)) report.failures.push(`${support.recordId}: missing positive pipeRadius`);
  requireLayer(report, support, 'plant.restraints');
  if (support.source) requireLayer(report, support, `restraints.${support.source}`);
  if (support.kind) requireLayer(report, support, `restraints.${support.kind.toLowerCase()}`);
  if (support.axis) requireLayer(report, support, `axis.${support.axis.toLowerCase()}`);
  if (support.kind === 'UNKNOWN' && support.visibleDefault !== false) report.failures.push(`${support.recordId}: UNKNOWN visibleDefault must be false`);
}

function checkSupportPrimitives(report, support, primitives) {
  const recordPrimitives = primitives.filter((primitive) => primitive.recordId === support.recordId);
  const headPrimitives = recordPrimitives.filter((primitive) => /:head$/i.test(primitive.role));
  if (support.kind === 'UNKNOWN') {
    if (recordPrimitives.length > 0) report.failures.push(`${support.recordId}: UNKNOWN must not have visible support primitives`);
    return;
  }
  if (!recordPrimitives.length) report.failures.push(`${support.recordId}: no support glyph primitives found`);
  const roles = recordPrimitives.map((p) => p.role.toLowerCase());
  if (support.kind === 'GUIDE' && roles.some((role) => role.includes('vertical') || role.includes('axis') || role.includes('plate') || role.includes('block') || role.includes('linestop') || role.includes('limit') || role.includes('rest'))) report.failures.push(`${support.recordId}: GUIDE has forbidden primitive role(s): ${roles.join(', ')}`);
  if ((support.kind === 'REST' || support.kind === 'SHOE' || support.kind === 'HOLDDOWN') && roles.some((role) => !role.startsWith('rest-vertical-arrow'))) report.failures.push(`${support.recordId}: REST/HOLDDOWN has non-vertical-rest primitive role(s): ${roles.join(', ')}`);
  if (support.kind === 'LINESTOP' && roles.some((role) => !role.startsWith('linestop-axial-arrow'))) report.failures.push(`${support.recordId}: LINESTOP has non-axial primitive role(s): ${roles.join(', ')}`);
  if (support.kind === 'LIMIT' && roles.some((role) => !(role.startsWith('limit-axial-arrow') || role.startsWith('limit-gap-tick')))) report.failures.push(`${support.recordId}: LIMIT has forbidden primitive role(s): ${roles.join(', ')}`);
  if (!support.pipePoint || !support.pipeTangent || !(support.pipeRadius > 0)) return;
  const P = support.pipePoint;
  const T = support.pipeTangent;
  const R = support.pipeRadius;
  for (const primitive of headPrimitives) {
    if (!primitive.tip || !primitive.direction) { report.failures.push(`${support.recordId}/${primitive.role}: missing primitive tip/direction`); continue; }
    if (support.kind === 'GUIDE') {
      const distanceToP = len(sub(primitive.tip, P));
      const dotT = Math.abs(dot(primitive.direction, T));
      if (Math.abs(distanceToP - R) > Math.max(MATH_TOL, R * 0.01)) report.failures.push(`${support.recordId}/${primitive.role}: GUIDE tip distance ${distanceToP} != R ${R}`);
      if (dotT > 0.05) report.failures.push(`${support.recordId}/${primitive.role}: GUIDE arrow not lateral; |dot(dir,T)|=${dotT}`);
    } else if (support.kind === 'REST' || support.kind === 'SHOE' || support.kind === 'HOLDDOWN') {
      const dotUp = Math.abs(dot(primitive.direction, UP));
      const surfaceDistance = distancePointToLine(primitive.tip, P, T);
      if (dotUp < 0.95) report.failures.push(`${support.recordId}/${primitive.role}: REST arrow not vertical; |dot(dir,UP)|=${dotUp}`);
      if (Math.abs(surfaceDistance - R) > Math.max(MATH_TOL, R * 0.01)) report.failures.push(`${support.recordId}/${primitive.role}: REST tip not at OD surface; distanceToPipeAxis=${surfaceDistance}, R=${R}`);
    } else if (support.kind === 'LINESTOP' || support.kind === 'LIMIT') {
      const dotT = Math.abs(dot(primitive.direction, T));
      const surfaceDistance = distancePointToLine(primitive.tip, P, T);
      if (dotT < 0.95) report.failures.push(`${support.recordId}/${primitive.role}: ${support.kind} arrow not axial; |dot(dir,T)|=${dotT}`);
      if (Math.abs(surfaceDistance - R) > Math.max(MATH_TOL, R * 0.01)) report.failures.push(`${support.recordId}/${primitive.role}: ${support.kind} arrow line not offset OD/2; distanceToPipeAxis=${surfaceDistance}, R=${R}`);
    }
  }
}

function annotationInfo(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  const kind = upper(trace.annotationKind || extras.caesarAnnotationKind || extras.annotationKind);
  const nodeNo = text(trace.node || extras.caesarAnnotationNode || extras.node || extras.sourceNode);
  const no = text(trace.no || extras.caesarAnnotationNo || extras.no || extras.calloutNo || extras.labelText);
  return { name: text(node.name), kind, node: nodeNo, no, source: text(trace.source || extras.caesarAnnotationSource || extras.source), layerIds: layerIdsOf(extras), text: text(trace.text || extras.caesarAnnotationText || extras.labelText) };
}
function isAnnotationNode(node = {}) {
  const extras = extrasOf(node);
  const trace = traceOf(node);
  return trace.entity === 'annotation' || upper(trace.annotationKind).includes('ISONOTE') || upper(trace.annotationKind) === 'NODE_LABEL' || upper(extras.caesarAnnotationKind).includes('ISONOTE') || upper(extras.caesarAnnotationKind) === 'NODE_LABEL';
}
function dedupeAnnotations(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = item.kind.includes('ISONOTE') ? `callout:${item.no}:${item.node}` : `node:${item.node}`;
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, { ...item, primitiveCount: 1, layerIds: [...new Set(item.layerIds)] });
    else {
      existing.primitiveCount += 1;
      existing.text = existing.text || item.text;
      existing.layerIds = [...new Set([...existing.layerIds, ...item.layerIds])];
    }
  }
  return [...byKey.values()];
}

function run() {
  const args = parseArgs(process.argv);
  const gltf = readJsonChunk(args.glb);
  const nodes = gltf.nodes || [];
  const reachable = reachableNodeIndices(gltf);
  const report = { schema: 'bm-cii-glb-visible-scene-qc/v2', glb: path.resolve(args.glb), generatedAt: new Date().toISOString(), pass: false, counts: {}, supportRoots: [], annotations: {}, failures: [], warnings: [] };

  const allLegacyNodes = nodes.map((node, index) => ({ index, name: text(node.name) })).filter((entry) => LEGACY_NODE_PATTERNS.some((pattern) => pattern.test(entry.name)));
  for (const entry of allLegacyNodes) report.failures.push(`legacy/orphan node physically present: [${entry.index}] ${entry.name}`);

  if (!hasAuthoritativeFlag(gltf, reachable)) report.failures.push('GLB does not declare bmCiiSupportGlyphsAuthoritative / glyph-only support authority');

  const supportRoots = [];
  const supportPrimitives = [];
  const annotationPrimitiveNodes = [];
  for (const index of reachable) {
    const node = nodes[index];
    if (isSupportRoot(node)) supportRoots.push(supportRootInfo(gltf, index));
    if (isSupportPrimitive(node)) supportPrimitives.push(primitiveInfo(node));
    if (isAnnotationNode(node)) annotationPrimitiveNodes.push(annotationInfo(node));
  }

  const duplicateRecordIds = new Map();
  for (const support of supportRoots) {
    if (support.recordId) duplicateRecordIds.set(support.recordId, (duplicateRecordIds.get(support.recordId) || 0) + 1);
    checkSupportRoot(report, support);
  }
  for (const [recordId, count] of duplicateRecordIds.entries()) if (count !== 1) report.failures.push(`duplicate support recordId ${recordId}: ${count} reachable roots`);
  for (const support of supportRoots) checkSupportPrimitives(report, support, supportPrimitives);

  if (args['expected-support']) {
    const expected = normalizeSupportExpected(JSON.parse(fs.readFileSync(args['expected-support'], 'utf8')));
    const sourceFilter = text(args['expected-source']).toLowerCase();
    const filtered = sourceFilter ? expected.filter((row) => text(row.source || row.supportSource).toLowerCase() === sourceFilter) : expected;
    const expectedIds = new Set(filtered.map((row, index) => text(row.recordId || row.id || `${text(row.source || sourceFilter || 'inputxml').toLowerCase()}:${index}:${row.node || row.NODE || 'NA'}:${upper(row.kind || row.supportKind || 'UNKNOWN')}:${upper(row.axis || 'NA')}`)));
    const actualIds = new Set(supportRoots.map((row) => row.recordId).filter(Boolean));
    for (const id of expectedIds) if (!actualIds.has(id)) report.failures.push(`expected support record missing in GLB: ${id}`);
    for (const id of actualIds) if (!expectedIds.has(id)) report.failures.push(`unexpected support record in GLB: ${id}`);
  }

  if (args['expected-support-count'] !== undefined) {
    const expectedCount = Number(args['expected-support-count']);
    if (Number.isFinite(expectedCount) && supportRoots.length !== expectedCount) report.failures.push(`support root count ${supportRoots.length} != expected ${expectedCount}`);
  }

  const uniqueAnnotations = dedupeAnnotations(annotationPrimitiveNodes);
  const callouts = uniqueAnnotations.filter((item) => item.kind === 'ISONOTE_CALLOUT' || item.kind === 'CAESAR_ISONOTE_CALLOUT' || item.kind.includes('ISONOTE'));
  const nodeLabels = uniqueAnnotations.filter((item) => item.kind === 'NODE_LABEL');
  const expectedCalloutCount = Number(args['expected-callout-count'] ?? 4);
  const expectedNodeLabelCount = Number(args['expected-node-label-count'] ?? 4);
  if (callouts.length !== expectedCalloutCount) report.failures.push(`ISONOTE callout count ${callouts.length} != expected ${expectedCalloutCount}`);
  if (nodeLabels.length !== expectedNodeLabelCount) report.failures.push(`node label count ${nodeLabels.length} != expected ${expectedNodeLabelCount}`);
  for (const callout of callouts) {
    if (!ALLOWED_ANNOTATION_NODES.has(callout.node)) report.failures.push(`${callout.name}: callout node '${callout.node}' not in whitelist`);
    if (!ALLOWED_CALLOUT_NOS.has(callout.no)) report.failures.push(`${callout.name}: callout number '${callout.no}' not in whitelist`);
    if (!callout.text) report.failures.push(`${callout.name}: callout text is missing`);
    for (const id of ['annotation.all', 'annotation.callout', 'annotation.isonote']) if (!callout.layerIds.includes(id)) report.failures.push(`${callout.name}: missing ${id} layer`);
  }
  for (const label of nodeLabels) {
    if (!ALLOWED_ANNOTATION_NODES.has(label.node)) report.failures.push(`${label.name}: node label '${label.node}' not in whitelist`);
    for (const id of ['annotation.all', 'annotation.node']) if (!label.layerIds.includes(id)) report.failures.push(`${label.name}: missing ${id} layer`);
  }
  for (const annotation of uniqueAnnotations) if (annotation.kind === 'MERGED' || /MERGED/i.test(annotation.name)) report.failures.push(`${annotation.name}: merged annotation marker is not allowed for BM_CII benchmark QC`);

  report.counts = { nodes: nodes.length, reachableNodes: reachable.size, supportRoots: supportRoots.length, supportPrimitives: supportPrimitives.length, legacyOrphanNodes: allLegacyNodes.length, annotationPrimitiveNodes: annotationPrimitiveNodes.length, uniqueAnnotations: uniqueAnnotations.length, isonoteCallouts: callouts.length, nodeLabels: nodeLabels.length };
  report.supportRoots = supportRoots;
  report.annotations = { callouts, nodeLabels, primitiveNodes: annotationPrimitiveNodes.length };
  report.pass = report.failures.length === 0;
  if (args.out) { fs.mkdirSync(path.dirname(args.out), { recursive: true }); fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

run();
