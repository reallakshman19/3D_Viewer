import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { installInputXmlDxfProjectionOption } from '../tabs/model-converters/inputxml-dxf-projection-option.js';

const optionSource = await fs.readFile(
  new URL('../tabs/model-converters/inputxml-dxf-projection-option.js', import.meta.url),
  'utf8',
);
const tabSource = await fs.readFile(
  new URL('../tabs/model-converters-tab.js', import.meta.url),
  'utf8',
);
const writerSource = await fs.readFile(
  new URL('../converters/inputxml-dxf/InputXmlToDxfWriter.js', import.meta.url),
  'utf8',
);

assert.equal(typeof installInputXmlDxfProjectionOption, 'function', 'projection option installer is exported');
assert.equal(typeof installInputXmlDxfProjectionOption(null), 'function', 'installer is a safe no-op without DOM root');
assert.ok(optionSource.includes('[data-option-key="selectedBranches"]'), 'projection option only activates for InputXML DXF options');
assert.ok(optionSource.includes('data-option-key="projectionMode"'), 'projection option injects projectionMode option key');
assert.ok(optionSource.includes('3D model coordinates'), 'projection option exposes 3D default');
assert.ok(optionSource.includes('Top / plan (X-Y)'), 'projection option exposes top projection');
assert.ok(optionSource.includes('Elevation X-Z'), 'projection option exposes X/Z elevation');
assert.ok(optionSource.includes('Elevation Y-Z'), 'projection option exposes Y/Z elevation');
assert.ok(optionSource.includes('Isometric 2.5D'), 'projection option exposes iso projection');
assert.ok(!optionSource.toLowerCase().includes('three'), 'projection option has no Three.js dependency');
assert.ok(tabSource.includes("./model-converters/inputxml-dxf-projection-option.js"), 'Model Converters tab imports the projection option');
assert.ok(tabSource.includes('installInputXmlDxfProjectionOption(container)'), 'Model Converters tab installs the projection option');
assert.ok(writerSource.includes('projectionMode'), 'writer supports projectionMode option');
assert.ok(writerSource.includes('iso-2.5d'), 'writer supports iso-2.5d projection');

console.log('inputxml-dxf-projection-option tests passed');
