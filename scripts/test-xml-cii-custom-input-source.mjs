#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const files = [
  'viewer/converters/xml-cii2019-core/custom-input-table-parser.js',
  'viewer/converters/xml-cii2019-core/custom-input-model.js',
  'viewer/converters/xml-cii2019-core/custom-input-xml-builder.js',
  'viewer/converters/xml-cii2019-core/custom-input-auto-bend.js',
  'viewer/converters/xml-cii2019-core/custom-input-auto-tee.js',
  'viewer/converters/xml-cii2019-core/custom-input-auto-reducer.js',
  'viewer/converters/xml-cii2019-core/custom-input-staged-json-source.js',
  'viewer/converters/xml-cii2019-core/custom-input-api.js',
  'viewer/tabs/model-converters/custom-input/custom-input-panel.js',
  'viewer/tabs/model-converters/json-trace/json-trace-panel.js',
  'viewer/tabs/model-converters/workflow/services/xml-cii-staged-source-service.js',
  'viewer/tabs/model-converters/workflow/services/xml-cii-workflow-state-service.js',
  'viewer/tabs/model-converters/custom-input/xml-cii-custom-input-workflow-tab.js',
];
const maxLinesByFile = new Map([
  ['viewer/tabs/model-converters/json-trace/json-trace-panel.js', 320],
]);

for (const file of files) {
  const abs = path.join(root, file);
  assert.ok(fs.existsSync(abs), `${file} must exist`);
  const lines = read(file).split(/\r?\n/).length;
  const maxLines = maxLinesByFile.get(file) || 260;
  assert.ok(lines < maxLines, `${file} must stay modular, got ${lines} lines; max ${maxLines}`);
}

const shell = read('viewer/tabs/model-converters/WorkflowShell.js');
const modelTab = read('viewer/tabs/model-converters/ModelConvertersTab.js');
const customPanel = read('viewer/tabs/model-converters/custom-input/custom-input-panel.js');
const jsonTracePanel = read('viewer/tabs/model-converters/json-trace/json-trace-panel.js');
const sourceService = read('viewer/tabs/model-converters/workflow/services/xml-cii-staged-source-service.js');
const popup = read('viewer/tabs/model-converters/xml-cii-workflow-popup.js');
const api = read('viewer/converters/xml-cii2019-core/custom-input-api.js');
const stagedParser = read('viewer/converters/xml-cii2019-core/custom-input-staged-json-source.js');
const xmlBuilder = read('viewer/converters/xml-cii2019-core/custom-input-xml-builder.js');

assert.ok(shell.includes("id: 'custom-input'") && shell.includes("id: 'json-trace'"), 'Workflow must expose separate Custom Input and JSON Trace phases');
assert.ok(shell.indexOf("id: 'custom-input'") < shell.indexOf("id: 'json-trace'"), 'JSON Trace must be a separate phase after Custom Input');
assert.ok(modelTab.includes('installXmlCiiCustomInputWorkflowTab'), 'ModelConvertersTab must install Custom Input workflow UI');
assert.ok(customPanel.includes('Custom Input') && customPanel.includes('Generate XML'), 'Custom Input UI must remain an XML generator');
assert.ok(customPanel.includes('Branches') && customPanel.includes('Nodes/components') && customPanel.includes('Build XML'), 'Custom Input tabs must keep synthetic XML source tables');
assert.ok(!customPanel.includes('Parse staged JSON') && !customPanel.includes('Node Trace'), 'Custom Input must not own staged JSON import or trace UI');
assert.ok(jsonTracePanel.includes('JsonNode Trace') && jsonTracePanel.includes('XML Node Wise Trace'), 'JSON Trace UI must expose trace subtabs');
assert.ok(jsonTracePanel.includes('PREVIEW_LINES = 300') && jsonTracePanel.includes('Use JSON Trace staged source'), 'JSON Trace import must expose 300-line preview and source toggle');
assert.ok(jsonTracePanel.includes('retained in memory only'), 'JSON Trace import must expose storage-quota fallback copy');
assert.ok(sourceService.includes('xmlCiiWorkflowParsedStagedSource') && sourceService.includes('XML_CII_JSON_TRACE_STORE_KEY'), 'Staged-source resolver must live outside legacy adapter');
assert.ok(sourceService.includes('JSON Trace staged source'), 'Staged-source resolver must identify JSON Trace source labels');
assert.ok(popup.includes('createXmlCiiMasterService') && popup.includes('createXmlCiiPreviewService') && popup.includes('createXmlCiiRunService'), 'Popup must call modular XML CII services');
assert.ok(popup.includes('xmlCiiWorkflowPhaseTabs'), 'Popup must use state service to disable Custom Input when XML is loaded');
assert.ok(api.includes('buildXmlCiiCustomInputXml') && api.includes('parseXmlCiiStagedJsonInputSource'), 'Custom input API must expose XML builder and staged JSON parser');
assert.ok(xmlBuilder.includes('<Branchname>') && xmlBuilder.includes('<DTXR_POS>') && xmlBuilder.includes('<Position>'), 'Custom input XML builder must emit Branchname, DTXR_POS and Position fields');
assert.ok(stagedParser.includes('component-refno-exact') && stagedParser.includes('stagedTraceToCsv'), 'Staged JSON parser must preserve exact ref trace and CSV export');

console.log('XML CII Custom Input / JSON Trace source guard passed');
