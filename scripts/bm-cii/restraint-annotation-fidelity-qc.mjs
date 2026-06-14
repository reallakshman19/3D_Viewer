#!/usr/bin/env node
/**
 * BM_CII restraint + annotation fidelity QC gate.
 *
 * This is stricter than geometry/category tally QC.  It is aimed at the visual
 * acceptance failures where:
 *   - LINESTOP / LIMIT / Z-direction symbols are not readable or not traceable;
 *   - InputXML and ISONOTE restraint variants accidentally carry the same data;
 *   - annotation metadata contains random/generated text instead of the expected
 *     ISONOTE callout contract.
 *
 * The gate expects GLB nodes to carry `extras.bmCiiTrace`, produced by the
 * exporter trace metadata layer.  Name-based fallback is deliberately limited;
 * if trace metadata is absent, strict mode fails instead of guessing.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const EXPECTED_CALLOUT_NODES = ['35', '130', '205', '255'];
const VALID_SUPPORT_KINDS = new Set([
  'REST',
  'GUIDE',
  'LINESTOP',
  'LINE_STOP',
  'LIMIT',
  'ANCHOR',
  'HANGER',
  'SPRING',
  'HOLDDOWN',
  'UNKNOWN',
  'TYPE0',
]);
const AXIS_KINDS_REQUIRED = new Set(['GUIDE', 'LINESTOP', 'LINE_STOP', 'LIMIT', 'ANCHOR']);
const DIRECTIONAL_AXIS_VALUES = new Set(['X', 'Y', 'Z', '+X', '-X', '+Y', '-Y', '+Z', '-Z']);

function usage(exitCode = 0) {
  console.log(`Usage:
  node scripts/bm-cii/restraint-annotation-fidelity-qc.mjs \\
    --sidecar <BM_CII sidecar.json> \\
    --inputxml-glb <InputXML support GLB> \\
    --isonote-glb <ISONOTE support GLB> \\
    --out <qc-report.json> \\
    --strict

Checks:
  1. InputXML GLB carries only inputxml support-source traces.
  2. ISONOTE GLB carries only isonote support-source traces.
  3. InputXML and ISONOTE support signatures are not accidentally identical.
  4. LINESTOP / LIMIT / GUIDE / ANCHOR traces carry direction/axis metadata.
  5. Z-direction traces are explicit when source or trace indicates Z.
  6. Annotation traces contain only expected callouts 1..4 at nodes 35,130,205,255.
  7. No random annotation text is allowed outside the expected sidecar callout text.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    strict: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') usage(0);
    if (token === '--strict') {
      args.strict = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    i += 1;
  }
  for (const key of ['sidecar', 'inputxmlGlb', 'isonoteGlb']) {
    if (!args[key]) throw new Error(`Missing required --${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readGlbJson(glbPath) {
  const buffer = fs.readFileSync(glbPath);
  if (buffer.length < 20) throw new Error(`${glbPath}: GLB is too small.`);
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  if (magic !== GLB_MAGIC) throw new Error(`${glbPath}: invalid GLB magic.`);
  if (version !== 2) throw new Error(`${glbPath}: expected GLB v2, got ${version}.`);
  if (length !== buffer.length) throw new Error(`${glbPath}: header length ${length} != actual ${buffer.length}.`);

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === CHUNK_JSON) {
      const text = chunk.toString('utf8').replace(/[\u0000\s]+$/g, '');
      return {
        json: JSON.parse(text),
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        bytes: buffer.length,
      };
    }
  }
  throw new Error(`${glbPath}: missing JSON chunk.`);
}

function normalizeKind(kind) {
  const value = String(kind || 'UNKNOWN').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (value === 'LINE_STOP') return 'LINESTOP';
  if (value === 'TYPE_0') return 'TYPE0';
  return value;
}

function normalizeSource(source) {
  const value = String(source || '').trim().toLowerCase();
  if (value.includes('isonote')) return 'isonote';
  if (value.includes('inputxml') || value.includes('xml')) return 'inputxml';
  return value || 'unknown';
}

function nodeId(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getAxis(trace) {
  const raw = trace.axis || trace.direction || trace.dof || trace.restraintAxis || trace.axisLabel || trace.renderAxis;
  if (Array.isArray(raw)) {
    const [x, y, z] = raw.map(Number);
    const abs = [Math.abs(x || 0), Math.abs(y || 0), Math.abs(z || 0)];
    const max = Math.max(...abs);
    if (max <= 0) return '';
    const axis = abs.indexOf(max) === 0 ? 'X' : abs.indexOf(max) === 1 ? 'Y' : 'Z';
    const sign = [x, y, z][abs.indexOf(max)] < 0 ? '-' : '+';
    return `${sign}${axis}`;
  }
  return String(raw || '').trim().toUpperCase();
}

function supportRecordFromSource(record, index, source) {
  const kind = normalizeKind(record.kind || record.type || record.restraintType || record.supportType || record.display);
  const axis = getAxis(record);
  return {
    index,
    source,
    node: nodeId(record.node || record.nodeNumber || record.NodeNumber || record.supportNode),
    kind,
    axis,
    gapMm: Number.isFinite(Number(record.gapMm ?? record.gap ?? record.restraintGap))
      ? Number(record.gapMm ?? record.gap ?? record.restraintGap)
      : null,
  };
}

function expectedSupports(sidecar, source) {
  const key = source === 'isonote' ? 'supportsIsonote' : 'supportsInputXml';
  return (sidecar[key] || []).map((record, i) => supportRecordFromSource(record, i + 1, source));
}

function expectedCallouts(sidecar) {
  return (sidecar.caesarAnnotationCallouts || []).map((callout, i) => ({
    calloutNo: Number(callout.no ?? callout.calloutNo ?? i + 1),
    node: nodeId(callout.node),
    text: String(callout.text || '').trim(),
  }));
}

function extractNodeTrace(node, parentTrace = null) {
  const extras = node.extras || {};
  return extras.bmCiiTrace || extras.BM_CII_TRACE || parentTrace || null;
}

function collectTraces(gltf) {
  const nodes = gltf.nodes || [];
  const traces = [];
  const visit = (nodeIndex, inheritedTrace, chain) => {
    const node = nodes[nodeIndex];
    if (!node) return;
    const trace = extractNodeTrace(node, inheritedTrace);
    const nextChain = [...chain, node.name || `node_${nodeIndex}`];
    if (node.mesh !== undefined) {
      traces.push({
        nodeIndex,
        nodeName: node.name || `node_${nodeIndex}`,
        meshIndex: node.mesh,
        trace,
        chain: nextChain,
      });
    }
    for (const child of node.children || []) visit(child, trace, nextChain);
  };
  const childSet = new Set();
  for (const node of nodes) for (const child of node.children || []) childSet.add(child);
  nodes.forEach((_, idx) => {
    if (!childSet.has(idx)) visit(idx, null, []);
  });
  return traces;
}

function isSupportTrace(trace) {
  return trace && String(trace.entity || '').toLowerCase() === 'support';
}

function isAnnotationTrace(trace) {
  return trace && String(trace.entity || '').toLowerCase() === 'annotation';
}

function supportSignature(trace) {
  const source = normalizeSource(trace.supportSource || trace.source || trace.renderSource);
  const kind = normalizeKind(trace.supportKind || trace.kind || trace.type || trace.restraintType);
  const node = nodeId(trace.node || trace.nodeNumber || trace.supportNode);
  const axis = getAxis(trace);
  const gap = trace.gapMm ?? trace.gap ?? trace.restraintGap ?? '';
  return `${source}|${node}|${kind}|${axis}|${gap}`;
}

function supportTraceRecord(entry) {
  const trace = entry.trace || {};
  return {
    nodeName: entry.nodeName,
    nodeIndex: entry.nodeIndex,
    source: normalizeSource(trace.supportSource || trace.source || trace.renderSource),
    node: nodeId(trace.node || trace.nodeNumber || trace.supportNode),
    kind: normalizeKind(trace.supportKind || trace.kind || trace.type || trace.restraintType),
    axis: getAxis(trace),
    gapMm: trace.gapMm ?? trace.gap ?? trace.restraintGap ?? null,
    traceKey: trace.traceKey || '',
    renderGlyph: trace.renderGlyph || trace.glyph || '',
  };
}

function annotationPayloads(entries) {
  const result = [];
  for (const entry of entries) {
    if (!isAnnotationTrace(entry.trace)) continue;
    const trace = entry.trace;
    const callouts = Array.isArray(trace.callouts) ? trace.callouts : [];
    result.push({
      nodeName: entry.nodeName,
      traceKey: trace.traceKey || '',
      text: trace.text || trace.label || '',
      callouts: callouts.map((c, i) => ({
        calloutNo: Number(c.calloutNo ?? c.no ?? i + 1),
        node: nodeId(c.node),
        text: String(c.text || '').trim(),
      })),
    });
  }
  return result;
}

function mapSupportKindCounts(records) {
  const counts = {};
  for (const record of records) counts[record.kind] = (counts[record.kind] || 0) + 1;
  return counts;
}

function compareKindCounts(expected, actual) {
  const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();
  return keys.map(key => ({
    kind: key,
    expected: expected[key] || 0,
    actual: actual[key] || 0,
    ok: (expected[key] || 0) === (actual[key] || 0),
  }));
}

function supportSourceQc(source, expected, actualRecords) {
  const wrongSource = actualRecords.filter(record => record.source !== source);
  const invalidKinds = actualRecords.filter(record => !VALID_SUPPORT_KINDS.has(record.kind));
  const directionalMissingAxis = actualRecords.filter(record => AXIS_KINDS_REQUIRED.has(record.kind) && !record.axis);
  const directionalInvalidAxis = actualRecords.filter(record => record.axis && !DIRECTIONAL_AXIS_VALUES.has(record.axis) && !/^[+-]?[XYZ]$/.test(record.axis));
  const zExpected = expected.filter(record => /Z/i.test(record.axis));
  const zActual = actualRecords.filter(record => /Z/i.test(record.axis));
  const lineStopActual = actualRecords.filter(record => record.kind === 'LINESTOP');
  const limitActual = actualRecords.filter(record => record.kind === 'LIMIT');
  const kindCompare = compareKindCounts(mapSupportKindCounts(expected), mapSupportKindCounts(actualRecords));

  return {
    supportSource: source,
    expectedCount: expected.length,
    actualTraceCount: actualRecords.length,
    wrongSource,
    invalidKinds,
    directionalMissingAxis,
    directionalInvalidAxis,
    zExpectedCount: zExpected.length,
    zActualCount: zActual.length,
    lineStopActualCount: lineStopActual.length,
    limitActualCount: limitActual.length,
    kindCompare,
    gates: {
      hasExpectedSupportRecords: expected.length > 0,
      hasRenderedSupportTraces: actualRecords.length > 0,
      selectedSourceOnly: wrongSource.length === 0,
      validSupportKindsOnly: invalidKinds.length === 0,
      directionalKindsHaveAxis: directionalMissingAxis.length === 0,
      directionalAxesValid: directionalInvalidAxis.length === 0,
      zAxisPreservedWhenExpected: zExpected.length === 0 || zActual.length >= zExpected.length,
      kindCountsDoNotCollapseToUnknown: (mapSupportKindCounts(actualRecords).UNKNOWN || 0) < actualRecords.length,
    },
  };
}

function annotationQc(expected, payloads) {
  const allowedText = new Set(expected.map(c => c.text).filter(Boolean));
  const allCallouts = payloads.flatMap(payload => payload.callouts);
  const numbers = allCallouts.map(c => c.calloutNo).sort((a, b) => a - b);
  const nodes = Array.from(new Set(allCallouts.map(c => c.node))).sort((a, b) => Number(a) - Number(b));
  const randomTopLevelText = payloads
    .map(payload => String(payload.text || '').trim())
    .filter(text => text && !allowedText.has(text));
  const randomCalloutText = allCallouts
    .map(c => c.text)
    .filter(text => text && !allowedText.has(text));
  const expectedTextsMissing = expected
    .filter(c => c.text && !allCallouts.some(actual => actual.text === c.text))
    .map(c => c.text);

  return {
    expectedCount: expected.length,
    annotationTraceCount: payloads.length,
    allCallouts,
    numbers,
    nodes,
    randomTopLevelText,
    randomCalloutText,
    expectedTextsMissing,
    gates: {
      exactlyTwoMergedAnnotationMeshes: payloads.length === 2,
      expectedFourCalloutsAvailable: expected.length === 4,
      calloutNumbersStable: JSON.stringify(numbers) === JSON.stringify([1, 2, 3, 4, 1, 2, 3, 4]) || JSON.stringify(numbers) === JSON.stringify([1, 2, 3, 4]),
      calloutNodesStable: EXPECTED_CALLOUT_NODES.every(node => nodes.includes(node)),
      noRandomTopLevelAnnotationText: randomTopLevelText.length === 0,
      noRandomCalloutText: randomCalloutText.length === 0,
      expectedTextPreserved: expectedTextsMissing.length === 0,
    },
  };
}

function buildVariantReport(glbPath, source, sidecar) {
  const { json: gltf, sha256, bytes } = readGlbJson(glbPath);
  const traces = collectTraces(gltf);
  const supportRecords = traces.filter(entry => isSupportTrace(entry.trace)).map(supportTraceRecord);
  const annPayloads = annotationPayloads(traces);
  const expectedSupport = expectedSupports(sidecar, source);
  const expectedAnn = expectedCallouts(sidecar);
  const support = supportSourceQc(source, expectedSupport, supportRecords);
  const annotation = annotationQc(expectedAnn, annPayloads);
  const gates = {
    ...Object.fromEntries(Object.entries(support.gates).map(([k, v]) => [`support.${k}`, v])),
    ...Object.fromEntries(Object.entries(annotation.gates).map(([k, v]) => [`annotation.${k}`, v])),
  };
  return {
    file: path.basename(glbPath),
    sha256,
    bytes,
    supportSource: source,
    support,
    annotation,
    gates,
    ok: Object.values(gates).every(Boolean),
    failedGates: Object.entries(gates).filter(([, ok]) => !ok).map(([k]) => k),
  };
}

function crossVariantQc(inputxmlReport, isonoteReport) {
  const inputxmlSignatures = new Set(inputxmlReport.support.kindCompare ? [] : []);
  for (const record of inputxmlReport.support.actualRecords || []) inputxmlSignatures.add(supportSignature(record));
  const isonoteSignatures = new Set();
  for (const record of isonoteReport.support.actualRecords || []) isonoteSignatures.add(supportSignature(record));
  const intersection = Array.from(inputxmlSignatures).filter(sig => isonoteSignatures.has(sig)).sort();
  return {
    inputxmlSupportCount: inputxmlReport.support.actualTraceCount,
    isonoteSupportCount: isonoteReport.support.actualTraceCount,
    identicalSupportCountAndSignatures:
      inputxmlReport.support.actualTraceCount === isonoteReport.support.actualTraceCount &&
      inputxmlSignatures.size === isonoteSignatures.size &&
      intersection.length === inputxmlSignatures.size,
    overlapCount: intersection.length,
    overlap: intersection,
  };
}

function attachActualRecords(report) {
  // Preserve internal records for cross-variant QC without bloating human summary too much.
  report.support.actualRecords = report.support._actualRecords || report.support.actualRecords || [];
  return report;
}

function run() {
  const args = parseArgs(process.argv);
  const sidecar = readJson(args.sidecar);
  const inputxml = buildVariantReport(args.inputxmlGlb, 'inputxml', sidecar);
  const isonote = buildVariantReport(args.isonoteGlb, 'isonote', sidecar);

  // Re-read actual support records for cross-variant comparison.
  const inputTraces = collectTraces(readGlbJson(args.inputxmlGlb).json)
    .filter(entry => isSupportTrace(entry.trace)).map(supportTraceRecord);
  const isoTraces = collectTraces(readGlbJson(args.isonoteGlb).json)
    .filter(entry => isSupportTrace(entry.trace)).map(supportTraceRecord);
  inputxml.support.actualRecords = inputTraces;
  isonote.support.actualRecords = isoTraces;

  const inputSignatures = new Set(inputTraces.map(record => supportSignature(record)));
  const isoSignatures = new Set(isoTraces.map(record => supportSignature(record)));
  const overlap = Array.from(inputSignatures).filter(sig => isoSignatures.has(sig)).sort();
  const crossVariant = {
    inputxmlSupportCount: inputTraces.length,
    isonoteSupportCount: isoTraces.length,
    inputxmlUniqueSupportSignatures: inputSignatures.size,
    isonoteUniqueSupportSignatures: isoSignatures.size,
    overlapCount: overlap.length,
    identicalSupportSignatures:
      inputSignatures.size === isoSignatures.size && overlap.length === inputSignatures.size,
    gates: {
      supportSourcesHaveDifferentCountsOrSignatures:
        !(inputSignatures.size === isoSignatures.size && overlap.length === inputSignatures.size),
      inputxmlHasInputxmlSource: inputTraces.every(r => r.source === 'inputxml'),
      isonoteHasIsonoteSource: isoTraces.every(r => r.source === 'isonote'),
    },
  };

  const report = {
    schema: 'bm-cii-restraint-annotation-fidelity-qc/report-v1',
    createdAtUtc: new Date().toISOString(),
    sidecar: path.basename(args.sidecar),
    inputxml,
    isonote,
    crossVariant,
  };
  report.ok = inputxml.ok && isonote.ok && Object.values(crossVariant.gates).every(Boolean);
  report.failedGates = [
    ...inputxml.failedGates.map(g => `inputxml.${g}`),
    ...isonote.failedGates.map(g => `isonote.${g}`),
    ...Object.entries(crossVariant.gates).filter(([, ok]) => !ok).map(([g]) => `crossVariant.${g}`),
  ];

  const output = JSON.stringify(report, null, 2);
  if (args.out) fs.writeFileSync(args.out, `${output}\n`, 'utf8');
  else console.log(output);

  if (args.strict && !report.ok) {
    console.error(`BM_CII restraint/annotation fidelity QC failed: ${report.failedGates.join(', ')}`);
    process.exit(1);
  }
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
