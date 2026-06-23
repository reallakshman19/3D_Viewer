#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runnerPath = 'viewer/tabs/model-converters/converters/xmltocii2019_runner.js';
const parityPath = 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-preview-parity.js';
const runner = fs.readFileSync(path.join(root, runnerPath), 'utf8');
const parity = fs.readFileSync(path.join(root, parityPath), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(
  runner.includes("./xmltocii2019_helper/enrichment-preview-parity.js?v=20260623-process-parity-1"),
  'XML→CII runner must import the preview parity enrichment wrapper'
);
assert(
  parity.includes('computeLineNoKey(row, fieldMap)'),
  'Parity enrichment must use canonical computeLineNoKey() line-list matching'
);
assert(
  parity.includes('resolveLineListDensity(row, pdOverride)'),
  'Parity enrichment must use the shared density resolver with process overrides'
);
assert(
  parity.includes('xmlCiiFindPreviewParityLineListRow'),
  'Parity enrichment must expose a preview-equivalent line-list matcher'
);
assert(
  parity.includes('pipingClass: derivedClassRaw'),
  'Parity enrichment must pass derived piping class into branch process resolution'
);
assert(
  parity.includes("xmlSetText(document, pressure, 'Pressure1', p1)"),
  'Parity enrichment must write branch Pressure1 from preview-resolved P1'
);
assert(
  parity.includes("xmlSetText(document, temperature, 'Temperature3', t3)"),
  'Parity enrichment must write Temperature3 from preview-resolved T3'
);
assert(
  parity.includes("xmlSetText(document, branch, 'FluidDensity', density)"),
  'Parity enrichment must write branch FluidDensity'
);
assert(
  parity.includes("xmlSetText(document, branch, 'MaterialNumber', resolved.materialCode)"),
  'Parity enrichment must write branch MaterialNumber from resolved material code'
);
assert(
  parity.includes("xmlSetText(document, node, 'WallThickness'") && parity.includes("xmlSetText(document, node, 'CorrosionAllowance'"),
  'Parity enrichment must write node WallThickness and CorrosionAllowance'
);

console.log('✅ XML CII enrichment preview parity static test passed');
