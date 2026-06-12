import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { run } from '../converters/inputxml-dxf/inputxml-to-dxf-runner.js';

const fixturePath = new URL('../../Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY_INPUT.XML', import.meta.url);
const xmlText = await fs.readFile(fixturePath, 'utf8');

// showSymbols=true (default) — runner must succeed and emit DXF
const withSymbols = await run({
  inputFiles: [{ role: 'primary', name: '1001.xml', text: xmlText }],
  options: { selectedBranches: '', showSymbols: true, includeSidecarJson: false },
  setStatus: () => {},
});
assert.equal(withSymbols.ok, true, 'showSymbols=true run returns ok=true');
assert.ok(withSymbols.outputs.some((o) => o.name === '1001.dxf'), 'showSymbols=true emits .dxf');

// showSymbols=false — runner must also succeed and emit DXF
const withoutSymbols = await run({
  inputFiles: [{ role: 'primary', name: '1001.xml', text: xmlText }],
  options: { selectedBranches: '', showSymbols: false, includeSidecarJson: false },
  setStatus: () => {},
});
assert.equal(withoutSymbols.ok, true, 'showSymbols=false run returns ok=true');
assert.ok(withoutSymbols.outputs.some((o) => o.name === '1001.dxf'), 'showSymbols=false emits .dxf');

// Verify legacy-adapter.js registers showSymbols in its inputxml_to_dxf definition
const adapterPath = new URL('../tabs/model-converters/legacy-adapter.js', import.meta.url);
const adapterSource = await fs.readFile(adapterPath, 'utf8');
assert.ok(adapterSource.includes('showSymbols'), 'legacy-adapter contains showSymbols field');
assert.ok(adapterSource.includes('Show valve/flange/support symbols'), 'legacy-adapter has showSymbols label');

// Verify converter-registry.js also acknowledges inputxml_to_dxf
const registryPath = new URL('../tabs/model-converters/converter-registry.js', import.meta.url);
const registrySource = await fs.readFile(registryPath, 'utf8');
assert.ok(registrySource.includes("'inputxml_to_dxf'"), 'registry CONVERTER_ORDER includes inputxml_to_dxf');

console.log('inputxml-dxf-symbol-option tests passed');
