#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const popupPath = path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
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
const tab = read('viewer/tabs/model-converters-tab.js');

assert(fs.existsSync(popupPath), 'workflow popup module must exist');
assert(popup.includes("import { WorkflowModal } from './shared/WorkflowModal.js'"), 'popup must reuse existing WorkflowModal');
assert(tab.includes("import { installXmlCiiConversionWorkflowPopup }"), 'model-converters-tab must import workflow popup installer');
assert(tab.includes('installXmlCiiConversionWorkflowPopup(container)'), 'model-converters-tab must install workflow popup after sideload/matched preview UI');

for (const label of [
  'XML - Model Data',
  'Process / Piping Class / Wt. Enrichment',
  'Matched Audit',
  'Output / Run Conversion',
]) {
  assert(popup.includes(label), `popup must include top-level tab: ${label}`);
}

for (const selector of [
  '#model-converters-run',
  '#model-converters-select',
  '#model-converters-xml-cii-sideload',
  '#model-converters-xml-cii-matched-preview',
  '#model-converters-xml-cii-workflow',
]) {
  assert(popup.includes(selector), `popup must wire existing selector: ${selector}`);
}

assert(popup.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'popup must provide guarded direct-run bypass for final Run Conversion');
assert(popup.includes('event.stopImmediatePropagation'), 'run click must be intercepted before legacy conversion listener');
assert(popup.includes('data-xml-cii-open-existing-phase'), 'process enrichment tab must route to existing XML→CII workflow phases');
assert(popup.includes('mountExistingPanel'), 'popup must nest existing side-load/matched panels by DOM portal, not duplicate logic');
assert(!popup.includes('runJob({'), 'popup shell must not call converter runtime directly');

console.log('✅ XML CII conversion workflow popup static test passed', {
  tabs: 4,
  portals: 2,
  directRunnerGuard: true,
});
