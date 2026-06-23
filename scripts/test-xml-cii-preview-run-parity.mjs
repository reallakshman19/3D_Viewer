import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const runner = readFileSync(path.join(root, 'viewer/tabs/model-converters/converters/xmltocii2019_runner.js'), 'utf8');
const parity = readFileSync(path.join(root, 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js'), 'utf8');
const base = readFileSync(path.join(root, 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js'), 'utf8');

assert.ok(
  runner.includes("./xmltocii2019_helper/enrichment-run-parity.js?v=20260623-preview-run-parity-1"),
  'XML->CII run must use the preview/run parity enrichment helper.',
);
assert.ok(
  parity.includes("import { xmlCiiDryRunPreview }"),
  'Parity helper must reuse the same dry-run preview resolver used by phase 3.',
);
assert.ok(
  parity.includes("setText(document, pressure, 'Pressure1', row.p1)"),
  'Parity helper must write preview P1 into enriched XML Pressure1.',
);
assert.ok(
  parity.includes("setText(document, temperature, 'Temperature1', row.t1)"),
  'Parity helper must write preview T1 into enriched XML Temperature1.',
);
assert.ok(
  parity.includes("setText(document, node, 'Rating', row.rating)"),
  'Parity helper must write preview rating into node Rating.',
);
assert.ok(
  parity.includes("setText(document, node, 'WallThickness', row.wallThickness)"),
  'Parity helper must write preview wall thickness into enriched node WallThickness.',
);
assert.ok(
  parity.includes("setText(document, node, 'CorrosionAllowance', row.corrosion)"),
  'Parity helper must write preview corrosion into enriched node CorrosionAllowance.',
);
assert.ok(
  base.includes('deriveRatingFromPipingClass') && base.includes('pc.includes(xcNorm(pattern))'),
  'Regression context: base enrichment still has the broad rating derivation that preview/run parity overrides.',
);

console.log('✓ XML->CII preview/run process data and rating parity guard passed.');
