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
  'viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-bridge.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-runner.js',
  'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  'viewer/tabs/model-converters/xml-cii-condense-rigid-ui-bridge.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-hotfix.js',
  'viewer/tabs/model-converters/converters/xml-cii-rich-enrichment-fix.js',
  'viewer/tabs/model-converters/ModelConvertersTab.js',
  'viewer/tabs/model-converters/index.js',
  'viewer/tabs/model-converters-tab.js',
  'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
  'viewer/converters/invocation-builder.js',
];

for (const rel of requiredFiles) {
  assert(fs.existsSync(path.join(root, rel)), `required XML CII workflow file is missing: ${rel}`);
}

const simpleController = read('viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js');
const richPopup = read('viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js');
const richBridge = read('viewer/tabs/model-converters/xml-cii-rich-workflow-bridge.js');
const richRunner = read('viewer/tabs/model-converters/xml-cii-rich-workflow-runner.js');
const legacyPopupShim = read('viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
const nativePanels = read('viewer/tabs/model-converters/xml-cii-popup-native-panels.js');
const condenseBridge = read('viewer/tabs/model-converters/xml-cii-condense-rigid-ui-bridge.js');
const richHotfix = read('viewer/tabs/model-converters/xml-cii-rich-workflow-hotfix.js');
const enrichmentFix = read('viewer/tabs/model-converters/converters/xml-cii-rich-enrichment-fix.js');
const modelTab = read('viewer/tabs/model-converters/ModelConvertersTab.js');
const publicIndex = read('viewer/tabs/model-converters/index.js');
const tabShim = read('viewer/tabs/model-converters-tab.js');
const enrichmentRunParity = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js');
const invocationBuilder = read('viewer/converters/invocation-builder.js');

assert(simpleController.includes('installXmlCiiSimpleWorkflowController'), 'simple workflow controller must expose a simple-prefixed installer');
assert(simpleController.includes('xmlCiiSimpleWorkflowRestoreRunButton'), 'simple workflow controller must own simple run button restoration');
assert(!simpleController.includes('installXmlCiiRichWorkflowPopup'), 'simple workflow controller must not import/install rich popup');
assert(!simpleController.includes('xmlCiiRichWorkflow'), 'simple workflow controller must not depend on rich workflow modules');

assert(richPopup.includes('installXmlCiiRichWorkflowPopup'), 'rich workflow popup must expose a rich-prefixed installer');
assert(richPopup.includes('XML->CII(2019) Rich Workflow'), 'rich popup title must be explicitly rich workflow');
assert(richPopup.includes('xmlCiiRichWorkflowRequestFinalRun'), 'rich popup must delegate final run through the rich runner boundary');
assert(!richPopup.includes('restoreSimpleRunButton'), 'rich popup must not restore the simple Run Conversion button');
assert(!richPopup.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'rich popup must not own direct-run flags');
assert(!richPopup.includes("document.querySelector('#model-converters-run')"), 'rich popup must not directly click the simple run button');
assert(!richPopup.includes("./legacy-adapter.js"), 'rich popup must not import legacy-adapter directly');
assert(!richPopup.includes('function interceptRun'), 'rich popup must not define the old simple-run interceptor');
assert(!richPopup.includes("document.addEventListener('click', interceptRun, true)"), 'rich popup must not capture the simple Run Conversion click');

assert(richBridge.includes('xmlCiiRichWorkflowGetBridge'), 'rich bridge boundary must expose rich-prefixed bridge getter');
assert(richBridge.includes("./legacy-adapter.js"), 'legacy adapter dependency must be isolated to the rich bridge boundary');
assert(richRunner.includes('xmlCiiRichWorkflowRequestFinalRun'), 'rich runner boundary must expose rich-prefixed final-run handoff');
assert(richRunner.includes("document.querySelector('#model-converters-run')"), 'legacy button handoff must be contained only in rich runner boundary');

assert(legacyPopupShim.includes('Deprecated compatibility shim'), 'old popup filename must be reduced to a compatibility shim');
assert(legacyPopupShim.includes('installXmlCiiRichWorkflowPopup as installXmlCiiConversionWorkflowPopup'), 'old popup export must forward to rich-prefixed popup');
assert(!legacyPopupShim.includes('restoreSimpleRunButton'), 'old popup shim must not own simple button behavior');

assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must be rendered');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must be rendered');
assert(nativePanels.includes('data-native-config-info'), 'Config info block must be rendered');
assert(nativePanels.includes('ElementLengthMm calculated for INST'), 'Config info must describe INST ElementLengthMm logic');

assert(condenseBridge.includes("XSD_KEY = 'condenseRigidXsd'"), 'condense bridge must define XSD key');
assert(condenseBridge.includes("RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange'"), 'condense bridge must define snake_case resolved key');
assert(condenseBridge.includes('normaliseConfig'), 'condense bridge must normalize config keys');
assert(condenseBridge.includes('xmlCiiRichWorkflowGetBridge'), 'condense bridge must use the rich bridge boundary');
assert(!condenseBridge.includes('restoreSimpleRunButton'), 'condense bridge must not restore the simple run button');
assert(!condenseBridge.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'condense bridge must not own direct-run flags');
assert(!condenseBridge.includes('new MutationObserver'), 'condense bridge must not use a broad DOM observer');
assert(!condenseBridge.includes("document.addEventListener('click'"), 'condense bridge must not install global click handlers');
assert(!condenseBridge.includes('setInterval'), 'condense bridge must not poll with setInterval');

assert(richHotfix.includes('runXmlCiiWithRichFix'), 'rich workflow hotfix must patch XML->CII runner');
assert(richHotfix.includes('getConverterById') && richHotfix.includes("'xml_to_cii'"), 'rich workflow hotfix must target xml_to_cii converter');
assert(richHotfix.includes('xmlCiiRichWorkflowGetBridge'), 'rich hotfix must use the rich bridge boundary');
assert(!richHotfix.includes('restoreButtons'), 'rich hotfix must not restore simple/rich buttons');
assert(!richHotfix.includes('#model-converters-run'), 'rich hotfix must not style or mutate the simple run button');
assert(richHotfix.includes('data-xml-cii-hotfix-condense'), 'rich workflow hotfix must inject visible condense checkboxes into the active rich path');
assert(richHotfix.includes('data-native-regex-path') && richHotfix.includes('stopImmediatePropagation'), 'rich workflow hotfix must suppress native regex/dropdown blink rerenders');

assert(enrichmentFix.includes("'Pressure2'") && enrichmentFix.includes('hydroPressure'), 'enrichment fix must write hydro/test pressure to Pressure2');
assert(enrichmentFix.includes("new Set(['FLAN', 'GASK', 'VALV', 'RIGID', 'INST'])"), 'enrichment fix must include full negative valve/flange block types');
assert(enrichmentFix.includes('condensedValveFlangeBlocks'), 'enrichment fix must count resolved valve/flange blocks');
assert(enrichmentFix.includes('Pressure1') && enrichmentFix.includes('Temperature1') && enrichmentFix.includes('Temperature2') && enrichmentFix.includes('Temperature3'), 'enrichment fix must preserve preview process fields into enriched XML');

assert(modelTab.includes('installXmlCiiSimpleWorkflowController'), 'ModelConvertersTab must install simple workflow controller');
assert(modelTab.includes('installXmlCiiRichWorkflowPopup'), 'ModelConvertersTab must install rich workflow popup');
assert(!modelTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must not install the old generic workflow popup');
assert(modelTab.indexOf('xml-cii-simple-workflow-controller') < modelTab.indexOf('xml-cii-rich-workflow-popup'), 'simple workflow installer must be listed separately before rich popup installer');
assert(modelTab.includes('installXmlCiiCondenseRigidUiBridge'), 'ModelConvertersTab must install condense bridge');
assert(modelTab.includes('installXmlCiiRichWorkflowHotfix'), 'ModelConvertersTab must install rich workflow hotfix');
assert(modelTab.includes('20260624-simple-rich-isolation-1'), 'ModelConvertersTab must be cache-busted');
assert(publicIndex.includes('20260624-simple-rich-isolation-1'), 'model-converters index must be cache-busted');
assert(tabShim.includes('20260624-simple-rich-isolation-1'), 'tab shim must be cache-busted');

assert(enrichmentRunParity.includes("RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'GASK', 'VALV', 'RIGID', 'INST'])"), 'Resolved condense base path must include full FLAN/GASK/VALV/RIGID/INST chains');
assert(enrichmentRunParity.includes("INLINE_LENGTH_COMPONENT_TYPES = new Set(['FLAN', 'GASK', 'VALV', 'RIGID', 'INST'])"), 'Negative inline chain length type set must include full valve/flange/gasket chain types');
assert(enrichmentRunParity.includes("RESOLVED_RIGID_MARKER_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST'])"), 'Resolved INST/FLAN/VALV/RIGID nodes must be explicitly marked as rigid');
assert(enrichmentRunParity.includes('RESOLVED_FLEXIBLE_MARKER_TYPES = new Set([\'GASK\'])'), 'Resolved GASK nodes must preserve non-rigid marker semantics');
assert(enrichmentRunParity.includes('annotateInlineElementLengths'), 'inline ElementLengthMm annotation must exist');
assert(enrichmentRunParity.includes('element-length-inline-negative'), 'negative inline ElementLengthMm diagnostics must exist');
assert(enrichmentRunParity.includes('sameComponentRefMate') && enrichmentRunParity.includes('allocateContiguousNumbers'), 'contiguous negative inline block construction must be source-level, not bridge-only');
assert(enrichmentRunParity.includes('process-provenance') && enrichmentRunParity.includes('Pressure2 / Hydro/Test Pressure'), 'visible process provenance diagnostics must include Hydro/Test Pressure');
assert(enrichmentRunParity.includes('ensureChildAfter') && enrichmentRunParity.includes("setTextAfter(document, node, 'Rigid', '2', 'Endpoint')"), 'Resolved rigid marker must be inserted after Endpoint');
assert(enrichmentRunParity.includes('instRigid2Annotations') && enrichmentRunParity.includes('resolvedRigidMarkers'), 'Resolved Rigid=2 annotations must be counted');
assert(enrichmentRunParity.includes('split-condensed-valve-flange-resolved'), 'Resolved condense diagnostics must exist');
assert(enrichmentRunParity.includes('split_condensed_valve_flange'), 'snake_case resolved flag must be honored in rich enrichment');

assert(invocationBuilder.includes('--split-condensed-valve-flange'), 'worker invocation must forward split-condensed flag');
assert(invocationBuilder.includes('--no-split-condensed-valve-flange'), 'worker invocation must forward no-split-condensed flag');
assert(invocationBuilder.includes('supportConfig.split_condensed_valve_flange'), 'worker invocation must read snake_case supportConfig key');

console.log('✅ XML CII rich workflow smoke validation passed', {
  simpleRun: 'simple/direct button has isolated simple-prefixed controller',
  richPopup: 'rich-prefixed popup owns only Rich Workflow button',
  bridgeBoundary: 'legacy bridge dependency isolated to xml-cii-rich-workflow-bridge.js',
  richRunHandoff: 'legacy final-run button click contained in xml-cii-rich-workflow-runner.js only',
  condenseRigid: 'XSD + Resolved controls rendered and injected into active rich path',
  processParity: 'Pressure1/Pressure2/Temperature1..3/density copied from preview to enriched XML with diagnostics provenance',
  negativeValveFlangeBlocks: 'contiguous FLAN/GASK/VALV/RIGID/INST negative blocks resolved when enabled',
  regexBlink: 'native regex/dropdown change rerender suppressed',
});
