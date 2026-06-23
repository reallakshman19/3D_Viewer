#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const files = {
  popup: 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  nativePanels: 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  condenseBridge: 'viewer/tabs/model-converters/xml-cii-condense-rigid-ui-bridge.js',
  workflowShell: 'viewer/tabs/model-converters/WorkflowShell.js',
  legacyAdapter: 'viewer/tabs/model-converters/legacy-adapter.js',
  modelTab: 'viewer/tabs/model-converters/ModelConvertersTab.js',
  publicIndex: 'viewer/tabs/model-converters/index.js',
  tabShim: 'viewer/tabs/model-converters-tab.js',
  previewRenderer: 'viewer/tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js',
  enrichmentRunParity: 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
  weightMatchModel: 'viewer/converters/xml-cii2019-core/weight-match-model.js',
  invocationBuilder: 'viewer/converters/invocation-builder.js',
};

for (const [label, rel] of Object.entries(files)) {
  assert(fs.existsSync(path.join(root, rel)), `${label} file must exist: ${rel}`);
}

const popup = read(files.popup);
const nativePanels = read(files.nativePanels);
const condenseBridge = read(files.condenseBridge);
const workflowShell = read(files.workflowShell);
const legacyAdapter = read(files.legacyAdapter);
const modelTab = read(files.modelTab);
const publicIndex = read(files.publicIndex);
const tabShim = read(files.tabShim);
const previewRenderer = read(files.previewRenderer);
const enrichmentRunParity = read(files.enrichmentRunParity);
const weightMatchModel = read(files.weightMatchModel);
const invocationBuilder = read(files.invocationBuilder);

assert(popup.includes("import { WorkflowModal } from './shared/WorkflowModal.js'"), 'rich popup must use WorkflowModal');
assert(popup.includes('Only the XML->CII Rich Workflow button opens this phase-tab popup'), 'popup must document rich-only entry');
assert(popup.includes('restoreSimpleRunButton'), 'popup must restore the simple Run Conversion button');
assert(popup.includes('window[DIRECT_RUN_FLAG] = true'), 'popup must bypass stale simple-run interceptors');
assert(!popup.includes('function interceptRun'), 'popup must not define simple-run click interception');
assert(!popup.includes("document.addEventListener('click', interceptRun, true)"), 'popup must not capture the simple Run Conversion click');
assert(popup.includes('xml-cii-popup-native-panels.js?v=20260623-inst-length-info-simple-run-1'), 'popup must cache-bust native panels');

for (const phase of ["'1 Regex'", "'2 Import Masters'", "'3 Preview'", "'4 Diagnostics'", "'4A Weight Match'", "'5 Run'", "'6 Support Types'", "'7 Config'"]) {
  assert(workflowShell.includes(phase), `workflow phase missing: ${phase}`);
}
assert(workflowShell.indexOf("id: 'weight-match'") < workflowShell.indexOf("id: 'run'"), 'Weight Match must remain before Run');

for (const token of [
  'Condense Rigid / split condensed valve-flange nodes (XSD)',
  'Condense Rigid / split condensed valve-flange nodes (Resolved)',
  'data-native-run-option="condenseRigidXsd"',
  'data-native-run-option="splitCondensedValveFlange"',
  'data-native-config-bool="condenseRigidXsd"',
  'data-native-config-bool="splitCondensedValveFlange"',
  'data-native-config-info',
  'ElementLengthMm calculated for INST',
  'previous positive node to the INST position',
]) {
  assert(nativePanels.includes(token), `native rich panel must contain: ${token}`);
}

for (const token of [
  "XSD_KEY = 'condenseRigidXsd'",
  "RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange'",
  'normaliseConfig',
  'setPopupRunOption',
  'savePopupConfigText',
  'window[DIRECT_RUN_FLAG] = true',
]) {
  assert(condenseBridge.includes(token), `condense bridge must contain: ${token}`);
}
assert(!condenseBridge.includes('new MutationObserver'), 'condense bridge must not install a broad DOM observer');
assert(!condenseBridge.includes("document.addEventListener('click'"), 'condense bridge must not install global click listeners');
assert(!condenseBridge.includes('setInterval'), 'condense bridge must not poll the DOM with setInterval');

assert(modelTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must install rich workflow popup');
assert(modelTab.includes('installXmlCiiCondenseRigidUiBridge'), 'ModelConvertersTab must install condense bridge');
assert(modelTab.includes('xml-cii-conversion-workflow-popup.js?v=20260623-inst-length-info-simple-run-1'), 'ModelConvertersTab must cache-bust rich popup');
assert(modelTab.includes('xml-cii-condense-rigid-ui-bridge.js?v=20260623-inst-length-info-simple-run-1'), 'ModelConvertersTab must cache-bust condense bridge');
assert(publicIndex.includes('20260623-inst-length-info-simple-run-1'), 'public model-converters index must be cache-busted');
assert(tabShim.includes('20260623-inst-length-info-simple-run-1'), 'legacy tab shim must be cache-busted');

for (const token of [
  "RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'RIGID', 'INST'])",
  "INLINE_LENGTH_COMPONENT_TYPES = new Set(['INST'])",
  'annotateInlineElementLengths',
  'element-length-inst',
  'previous positive-node CII coordinate distance',
  'split-condensed-valve-flange-resolved',
  'split_condensed_valve_flange',
]) {
  assert(enrichmentRunParity.includes(token), `enriched XML parity must contain: ${token}`);
}

assert(invocationBuilder.includes('--split-condensed-valve-flange'), 'worker invocation must forward split-condensed flag');
assert(invocationBuilder.includes('--no-split-condensed-valve-flange'), 'worker invocation must forward no-split-condensed flag');
assert(invocationBuilder.includes('supportConfig.split_condensed_valve_flange'), 'worker invocation must honor snake_case supportConfig key');

assert(previewRenderer.includes('computeLineNoKey'), 'Preview must use configured line-list field maps');
assert(weightMatchModel.includes('computeLineNoKey'), 'Weight Match must use configured line-list field maps');
assert(legacyAdapter.includes('getPopupSnapshot(target)'), 'legacy bridge must expose popup snapshots');
assert(legacyAdapter.includes('xmlCiiConfigWithLoadedMasterRows'), 'rich preview must hydrate config from loaded masters');

console.log('✅ XML CII rich workflow static test passed', {
  workflowMode: 'rich-popup-button-plus-simple-run-direct',
  condenseRigid: 'XSD + Resolved split_condensed_valve_flange wired',
  instElementLength: 'ElementLengthMm for INST annotated',
  simpleRun: 'visible and direct',
});
