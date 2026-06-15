#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_CALLOUTS = Object.freeze([1, 2, 3, 4]);
const EXPECTED_NODES = Object.freeze(['35', '130', '205', '255']);
const EXPECTED_NODE_LABEL_MODE = 'key-nodes';
const DEFAULT_SIDECAR = 'artifacts/bm-cii-v11-robust/BM_CII_Enriched_benchmark_v11_robust.sidecar.json';

function usage() {
  return `Usage:
  node scripts/bm-cii/annotation-fidelity-qc.mjs [--sidecar <sidecar.json>] [--out <report.json>]

Purpose:
  Validate BM_CII annotation benchmark fidelity after v11 robust build:
  - exactly four ISONOTE callouts
  - exactly four independently enforced node labels
  - allowed nodes only: 35, 130, 205, 255
  - allowed callout numbers only: 1, 2, 3, 4
  - sidecar-only annotation source
  - unmerged traceable benchmark annotations
`;
}

function parseArgs(argv) {
  const args = { sidecarPath: DEFAULT_SIDECAR, outPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--sidecar') args.sidecarPath = argv[++i];
    else if (arg === '--out') args.outPath = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function text(value) {
  return String(value ?? '').trim();
}

function fail(failures, code, message, detail = {}) {
  failures.push({ code, message, detail });
}

function sortedNumbers(values) {
  return [...values].map(Number).sort((a, b) => a - b);
}

function sortedStrings(values) {
  return [...values].map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function sameArray(a, b) {
  const aa = JSON.stringify(a);
  const bb = JSON.stringify(b);
  return aa === bb;
}

function validateSidecar(sidecar) {
  const failures = [];
  const callouts = Array.isArray(sidecar.callouts) ? sidecar.callouts : [];
  const nodeLabels = Array.isArray(sidecar.nodeLabels) ? sidecar.nodeLabels : [];
  const allowedCallouts = sortedNumbers(sidecar.allowedCallouts || []);
  const allowedNodes = sortedStrings(sidecar.allowedNodes || []);

  if (sidecar.annotationSource !== 'sidecar.caesarAnnotationCallouts') {
    fail(failures, 'ANNOTATION_SOURCE_NOT_SIDECAR', 'Annotation source must be sidecar.caesarAnnotationCallouts.', { annotationSource: sidecar.annotationSource });
  }
  if (sidecar.nodeLabelMode !== EXPECTED_NODE_LABEL_MODE) {
    fail(failures, 'NODE_LABEL_MODE_WRONG', 'Node labels must be independently enforced from the BM_CII node whitelist.', { nodeLabelMode: sidecar.nodeLabelMode, expectedNodeLabelMode: EXPECTED_NODE_LABEL_MODE });
  }
  if (sidecar.mergeMarkers !== false) {
    fail(failures, 'ANNOTATIONS_MERGED', 'Benchmark annotations must be unmerged and traceable.', { mergeMarkers: sidecar.mergeMarkers });
  }

  if (!sameArray(allowedCallouts, EXPECTED_CALLOUTS)) {
    fail(failures, 'CALLOUT_WHITELIST_MISMATCH', 'Allowed callout whitelist must be 1,2,3,4.', { allowedCallouts });
  }
  if (!sameArray(allowedNodes, sortedStrings(EXPECTED_NODES))) {
    fail(failures, 'NODE_WHITELIST_MISMATCH', 'Allowed annotation nodes must be 35,130,205,255.', { allowedNodes });
  }

  if (callouts.length !== 4) {
    fail(failures, 'ISONOTE_CALLOUT_COUNT', 'Expected exactly 4 ISONOTE callouts.', { actual: callouts.length });
  }
  if (nodeLabels.length !== 4) {
    fail(failures, 'NODE_LABEL_COUNT', 'Expected exactly 4 node labels.', { actual: nodeLabels.length });
  }

  const actualCalloutNumbers = sortedNumbers(callouts.map((c) => c.no));
  const actualCalloutNodes = sortedStrings(callouts.map((c) => c.node));
  const actualNodeLabels = sortedStrings(nodeLabels.map((n) => n.node));

  if (!sameArray(actualCalloutNumbers, EXPECTED_CALLOUTS)) {
    fail(failures, 'ISONOTE_CALLOUT_NUMBERS', 'Actual callout numbers must be 1,2,3,4.', { actualCalloutNumbers });
  }
  if (!sameArray(actualCalloutNodes, sortedStrings(EXPECTED_NODES))) {
    fail(failures, 'ISONOTE_CALLOUT_NODES', 'Actual callout nodes must be 35,130,205,255.', { actualCalloutNodes });
  }
  if (!sameArray(actualNodeLabels, sortedStrings(EXPECTED_NODES))) {
    fail(failures, 'NODE_LABEL_NODES', 'Actual node label nodes must be 35,130,205,255.', { actualNodeLabels });
  }

  for (const callout of callouts) {
    if (!EXPECTED_CALLOUTS.includes(Number(callout.no))) fail(failures, 'EXTRA_CALLOUT_NUMBER', 'Unexpected ISONOTE callout number.', callout);
    if (!EXPECTED_NODES.includes(String(callout.node))) fail(failures, 'EXTRA_CALLOUT_NODE', 'Unexpected ISONOTE callout node.', callout);
    if (!text(callout.text || callout.caesarCalloutText)) fail(failures, 'EMPTY_CALLOUT_TEXT', 'ISONOTE callout text must not be empty.', callout);
  }
  for (const nodeLabel of nodeLabels) {
    if (!EXPECTED_NODES.includes(String(nodeLabel.node))) fail(failures, 'EXTRA_NODE_LABEL', 'Unexpected node label.', nodeLabel);
    if (text(nodeLabel.label || nodeLabel.node) !== String(nodeLabel.node)) fail(failures, 'NODE_LABEL_TEXT_MISMATCH', 'Node label text must match the node number.', nodeLabel);
  }

  for (const [index, variant] of (sidecar.variants || []).entries()) {
    if (variant.calloutCount !== 4) fail(failures, 'VARIANT_CALLOUT_COUNT', 'Each variant must report four callouts.', { index, variant });
    if (variant.nodeLabelCount !== 4) fail(failures, 'VARIANT_NODE_LABEL_COUNT', 'Each variant must report four node labels.', { index, variant });
  }

  return {
    schema: 'bm-cii-annotation-fidelity-qc/v1',
    pass: failures.length === 0,
    expected: {
      callouts: EXPECTED_CALLOUTS,
      nodes: EXPECTED_NODES,
      calloutCount: 4,
      nodeLabelCount: 4,
      annotationSource: 'sidecar.caesarAnnotationCallouts',
      nodeLabelMode: EXPECTED_NODE_LABEL_MODE,
      mergeMarkers: false,
    },
    actual: {
      calloutCount: callouts.length,
      nodeLabelCount: nodeLabels.length,
      calloutNumbers: actualCalloutNumbers,
      calloutNodes: actualCalloutNodes,
      nodeLabelNodes: actualNodeLabels,
      annotationSource: sidecar.annotationSource || '',
      nodeLabelMode: sidecar.nodeLabelMode || '',
      mergeMarkers: sidecar.mergeMarkers,
      variantCount: Array.isArray(sidecar.variants) ? sidecar.variants.length : 0,
    },
    failures,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  const sidecarPath = path.resolve(args.sidecarPath || DEFAULT_SIDECAR);
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  const report = validateSidecar(sidecar);
  report.source = sidecarPath;
  report.checkedAtUtc = new Date().toISOString();

  if (args.outPath) {
    const outPath = path.resolve(args.outPath);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error?.message || String(error)}\n\n${usage()}`);
    process.exitCode = 1;
  });
}

export { EXPECTED_CALLOUTS, EXPECTED_NODES, EXPECTED_NODE_LABEL_MODE, validateSidecar };
