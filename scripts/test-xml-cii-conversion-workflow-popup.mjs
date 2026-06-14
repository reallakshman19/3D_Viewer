#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const popupPath = path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
const directPanelPath = path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-direct-panels.js');
const tabPath = path.join(root, 'viewer/tabs/model-converters-tab.js');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const popup = read('viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
const directPanels = read('viewer/tabs/model-converters/xml-cii-conversion-workflow-direct-panels.js');
const tab = read('viewer/tabs/model-converters-tab.js');

assert(fs.existsSync(popupPath), 'workflow popup module must exist');
assert(fs.existsSync(directPanelPath), 'workflow direct panels module must exist');
assert(popup.includes("import { WorkflowModal } from './shared/WorkflowModal.js'"), 'popup must reuse existing WorkflowModal');
assert(popup.includes('renderXmlCiiWorkflowModelDataPanel'), 'popup must render direct XML model-data panel');
assert(popup.includes('renderXmlCiiWorkflowMatchedAuditPanel'), 'popup must render direct matched-audit panel');
assert(tab.includes("import { installXmlCiiConversionWorkflowPopup }"), 'model-converters-tab must import workflow popup installer');
assert(tab.includes('installXmlCiiConversionWorkflowPopup'), 'model-converters-tab must install workflow popup');

for (const label of [
  'XML - Model Data',
  'Process / Piping Class / Wt. Enrichment',
  'Matched Audit',
  'Output / Run Conversion',
]) {
  assert(popup.includes(label) || directPanels.includes(label), `popup must include top-level tab/content: ${label}`);
}

for (const text of [
  'Input XML / JSON Import',
  'Resolver Index',
  'JSON Config',
  'JSON Resolved Data',
  'Manual Restraints',
  'Diagnostics',
]) {
  assert(directPanels.includes(text), `direct model-data panel must render: ${text}`);
}

for (const selector of [
  '#model-converters-run',
  '#model-converters-select',
  '#model-converters-xml-cii-workflow',
]) {
  assert(popup.includes(selector), `popup must wire existing selector: ${selector}`);
}

assert(popup.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'popup must provide guarded direct-run bypass for final Run Conversion');
assert(popup.includes('event.stopImmediatePropagation'), 'run click must be intercepted before legacy conversion listener');
assert(popup.includes('data-xml-cii-popup-shortcut'), 'popup must expose existing phase handoff buttons for process/output only');
assert(directPanels.includes('mc-preview-node-table'), 'direct panels must contain real table markup');
assert(directPanels.includes('data-direct-preview-filter'), 'matched audit must contain real filter input');
assert(directPanels.includes('data-direct-diagnostics-file'), 'matched audit must allow diagnostics JSON import');
assert(!popup.includes('mountExistingPanel'), 'popup must not move live DOM panels by portal');
assert(!popup.includes('new MutationObserver'), 'popup must not install MutationObserver');
assert(!popup.includes('runJob({'), 'popup shell must not call converter runtime directly');

console.log('✅ XML CII direct conversion workflow popup static test passed', {
  tabs: 4,
  directPanels: true,
  directRunnerGuard: true,
});
