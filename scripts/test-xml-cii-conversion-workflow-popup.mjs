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

const requiredFiles = [
  'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  'viewer/tabs/model-converters/xml-cii-condense-rigid-ui-bridge.js',
  'viewer/tabs/model-converters/ModelConvertersTab.js',
  'viewer/tabs/model-converters/index.js',
  'viewer/tabs/model-converters-tab.js',
  'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
  'viewer/converters/invocation-builder.js',
];

for (const rel of requiredFiles) {
  assert(fs.existsSync(path.join(root, rel)), `required XML CII workflow file is missing: ${rel}`);
}

const popup = read('viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
const nativePanels = read('viewer/tabs/model-converters/xml-cii-popup-native-panels.js');
const condenseBridge = read('viewer/tabs/model-converters/xml-cii-condense-rigid-ui-bridge.js');
const modelTab = read('viewer/tabs/model-converters/ModelConvertersTab.js');
const publicIndex = read('viewer/tabs/model-converters/index.js');
const tabShim = read('viewer/tabs/model-converters-tab.js');
const enrichmentRunParity = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js');
const invocationBuilder = read('viewer/converters/invocation-builder.js');

assert(popup.includes('Only the XML->CII Rich Workflow button opens this phase-tab popup'), 'rich popup must be rich-button only');
assert(popup.includes('restoreSimpleRunButton'), 'simple Run Conversion visibility restore must be present');
assert(!popup.includes('function interceptRun'), 'rich popup must not define the old simple-run interceptor');
assert(!popup.includes("document.addEventListener('click', interceptRun, true)"), 'rich popup must not capture the simple Run Conversion click');

assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must be rendered');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must be rendered');
assert(nativePanels.includes('data-native-config-info'), 'Config info block must be rendered');
assert(nativePanels.includes('ElementLengthMm calculated for INST'), 'Config info must describe INST ElementLengthMm logic');

assert(condenseBridge.includes("XSD_KEY = 'condenseRigidXsd'"), 'condense bridge must define XSD key');
assert(condenseBridge.includes("RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange'"), 'condense bridge must define snake_case resolved key');
assert(condenseBridge.includes('normaliseConfig'), 'condense bridge must normalize config keys');
assert(!condenseBridge.includes('new MutationObserver'), 'condense bridge must not use a broad DOM observer');
assert(!condenseBridge.includes("document.addEventListener('click'"), 'condense bridge must not install global click handlers');
assert(!condenseBridge.includes('setInterval'), 'condense bridge must not poll with setInterval');

assert(modelTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must install rich workflow popup');
assert(modelTab.includes('installXmlCiiCondenseRigidUiBridge'), 'ModelConvertersTab must install condense bridge');
assert(modelTab.includes('20260623-inst-length-info-simple-run-1'), 'ModelConvertersTab must be cache-busted');
assert(publicIndex.includes('20260623-inst-length-info-simple-run-1'), 'model-converters index must be cache-busted');
assert(tabShim.includes('20260623-inst-length-info-simple-run-1'), 'tab shim must be cache-busted');

assert(enrichmentRunParity.includes("RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'RIGID', 'INST'])"), 'Resolved condense must include INST nodes');
assert(enrichmentRunParity.includes("INLINE_LENGTH_COMPONENT_TYPES = new Set(['INST'])"), 'INST inline length type set must exist');
assert(enrichmentRunParity.includes("RESOLVED_RIGID_MARKER_TYPES = new Set(['INST'])"), 'Resolved INST nodes must be explicitly marked as rigid');
assert(enrichmentRunParity.includes('annotateInlineElementLengths'), 'INST ElementLengthMm annotation must exist');
assert(enrichmentRunParity.includes('element-length-inst'), 'INST ElementLengthMm diagnostics must exist');
assert(enrichmentRunParity.includes('ensureChildAfter') && enrichmentRunParity.includes("setTextAfter(document, node, 'Rigid', '2', 'Endpoint')"), 'Resolved INST rigid marker must be inserted after Endpoint');
assert(enrichmentRunParity.includes('instRigid2Annotations'), 'Resolved INST Rigid=2 annotations must be counted');
assert(enrichmentRunParity.includes('split-condensed-valve-flange-resolved'), 'Resolved condense diagnostics must exist');
assert(enrichmentRunParity.includes('split_condensed_valve_flange'), 'snake_case resolved flag must be honored in rich enrichment');

assert(invocationBuilder.includes('--split-condensed-valve-flange'), 'worker invocation must forward split-condensed flag');
assert(invocationBuilder.includes('--no-split-condensed-valve-flange'), 'worker invocation must forward no-split-condensed flag');
assert(invocationBuilder.includes('supportConfig.split_condensed_valve_flange'), 'worker invocation must read snake_case supportConfig key');

console.log('✅ XML CII rich workflow smoke validation passed', {
  simpleRun: 'direct button visible/restored',
  richPopup: 'button-owned, no simple-run interception',
  condenseRigid: 'XSD + Resolved controls rendered',
  instElementLength: 'ElementLengthMm for INST annotated',
  instRigidMarker: 'Resolved INST nodes emit Rigid=2 after Endpoint',
});
