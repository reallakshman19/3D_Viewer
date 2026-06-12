import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { installInputXmlDxfBranchPicker } from '../tabs/model-converters/inputxml-dxf-branch-picker.js';

const pickerSource = await fs.readFile(
  new URL('../tabs/model-converters/inputxml-dxf-branch-picker.js', import.meta.url),
  'utf8',
);
const tabSource = await fs.readFile(
  new URL('../tabs/model-converters-tab.js', import.meta.url),
  'utf8',
);

assert.equal(typeof installInputXmlDxfBranchPicker, 'function', 'branch picker installer is exported');
assert.equal(typeof installInputXmlDxfBranchPicker(null), 'function', 'installer is a safe no-op without DOM root');
assert.ok(pickerSource.includes('extractInputXmlBranches'), 'branch picker reuses the UXML-backed InputXML extractor');
assert.ok(pickerSource.includes('[data-option-key="selectedBranches"]'), 'branch picker targets the selectedBranches option');
assert.ok(pickerSource.includes('input[type="file"]'), 'branch picker discovers the selected primary XML file from file input');
assert.ok(pickerSource.includes('data-inputxml-dxf-branch-id'), 'branch picker renders selectable branch ids');
assert.ok(pickerSource.includes('setSelectedBranches'), 'branch picker writes selected ids back to the option input');
assert.ok(!pickerSource.includes('three'), 'branch picker has no Three.js dependency');
assert.ok(tabSource.includes("./model-converters/inputxml-dxf-branch-picker.js"), 'Model Converters tab imports the InputXML DXF branch picker');
assert.ok(tabSource.includes('installInputXmlDxfBranchPicker(container)'), 'Model Converters tab installs the InputXML DXF branch picker');

console.log('inputxml-dxf-branch-picker tests passed');
