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
for (const fn of [
  'renderXmlCiiWorkflowModelDataPanel',
  'renderXmlCiiWorkflowProcessEnrichmentPanel',
  'renderXmlCiiWorkflowMatchedAuditPanel',
  'renderXmlCiiWorkflowOutputRunPanel',
]) {
  assert(popup.includes(fn), `popup must render direct panel function: ${fn}`);
  assert(directPanels.includes(`export function ${fn}`), `direct panels module must export: ${fn}`);
}
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
  'Line / Process Data',
  'Piping Class / Material / Weight',
  'Support / Preview / Run',
  'Configured extraction groups',
  'Pre-run checklist',
  'Latest output snapshot',
]) {
  assert(directPanels.includes(text), `direct popup panels must render: ${text}`);
}

for (const selector of [
  '#model-converters-run',
  '#model-converters-select',
  '#model-converters-xml-cii-workflow',
  '#model-converters-output',
]) {
  assert(popup.includes(selector) || directPanels.includes(selector), `popup must wire existing selector: ${selector}`);
}

for (const phase of [
  'Regex / Line Key Matching',
  'Process / Piping Class / Material / Wt.',
  'Weight Match',
  'Support Mapping',
  'Enrichment Preview',
  'Diagnostics Dry Run',
  'Config JSON',
  'Existing Run Step',
]) {
  assert(directPanels.includes(phase), `process enrichment subtabs must include phase: ${phase}`);
}
assert(directPanels.includes('PROCESS_SUBTABS'), 'process enrichment must be backed by a real subtab registry');
assert(directPanels.includes('data-process-subtab'), 'process enrichment must render clickable subtab buttons');
assert(directPanels.includes('role="tablist"'), 'process enrichment subtabs must expose tablist semantics');
assert(directPanels.includes('data-process-subtab-body'), 'process enrichment subtabs must render into a dedicated body');

assert(popup.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'popup must provide guarded direct-run bypass for final Run Conversion');
assert(popup.includes('event.stopImmediatePropagation'), 'run click must be intercepted before legacy conversion listener');
assert(directPanels.includes('data-direct-process-phase'), 'process tab must expose real phase table actions');
assert(directPanels.includes('data-direct-run-conversion'), 'output tab must expose direct run button');
assert(directPanels.includes('mc-preview-node-table'), 'direct panels must contain real table markup');
assert(directPanels.includes('data-direct-preview-filter'), 'matched audit must contain real filter input');
assert(directPanels.includes('data-direct-diagnostics-file'), 'matched audit must allow diagnostics JSON import');
assert(!popup.includes('mountExistingPanel'), 'popup must not move live DOM panels by portal');
assert(!directPanels.includes('mountExistingPanel'), 'direct panels must not move live DOM panels by portal');
assert(!popup.includes('new MutationObserver'), 'popup must not install MutationObserver');
assert(!directPanels.includes('new MutationObserver'), 'direct panels must not install MutationObserver');
assert(!popup.includes('runJob({'), 'popup shell must not call converter runtime directly');

console.log('✅ XML CII direct conversion workflow popup static test passed', {
  tabs: 4,
  directPanels: 4,
  processSubtabs: 4,
  processPhases: 8,
  directRunnerGuard: true,
});
