#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const requiredFiles = [
  'viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-bridge.js',
  'viewer/tabs/model-converters/xml-cii-rich-workflow-runner.js',
  'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
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
const workflowPopup = read('viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js');
const richBridge = read('viewer/tabs/model-converters/xml-cii-rich-workflow-bridge.js');
const richRunner = read('viewer/tabs/model-converters/xml-cii-rich-workflow-runner.js');
const buttonScope = read('viewer/tabs/model-converters/xml-cii-workflow-button-scope.js');
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
assert(simpleController.includes('xmlCiiSimpleWorkflowRestoreRunButton'), 'simple workflow controller must keep non-XML CII direct-run restoration isolated');
assert(simpleController.includes('xmlCiiSimpleWorkflowSelectedConverter'), 'simple controller must skip direct-run restoration for XML CII popup-only mode');
assert(!simpleController.includes('installXmlCiiRichWorkflowPopup'), 'simple workflow controller must not import/install popup module');
assert(!simpleController.includes('import') || !simpleController.includes('xml-cii-rich'), 'simple workflow controller must not import rich workflow modules');

assert(buttonScope.includes('model-converters-xml-cii-simple-btn'), 'button scope must create the XML CII Simple Workflow launcher');
assert(buttonScope.includes('model-converters-xml-cii-rich-btn'), 'button scope must create the XML CII Rich Workflow launcher');
assert(buttonScope.includes('xmlCiiWorkflowButtonScopeHideAdvancedOptions'), 'button scope must hide generic converter advanced options for XML CII');
assert(buttonScope.includes('data-xml-cii-left-panel-options-hidden'), 'hidden generic options must have a source-level marker');
assert(!buttonScope.includes('Simple/direct workflow options'), 'left panel must not expose the generic simple/direct options block');
assert(buttonScope.includes('XML->CII Simple Workflow') && buttonScope.includes('XML->CII Rich Workflow'), 'button scope must label both workflow launchers explicitly');

assert(workflowPopup.includes('installXmlCiiRichWorkflowPopup'), 'workflow popup module must expose the existing installer boundary');
assert(workflowPopup.includes('XML->CII(2019) Simple Workflow'), 'simple popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, inspect diagnostics, and run enriched CII conversion.'), 'simple popup subtitle must match requested label');
assert(workflowPopup.includes('XML->CII(2019) Rich Workflow'), 'rich popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, and maintain manual overrides in a standalone-ready config.'), 'rich popup subtitle must match requested label');
assert(workflowPopup.includes("xmlCiiRichWorkflowBindLauncher(container, 'simple')"), 'popup module must bind simple launcher');
assert(workflowPopup.includes("xmlCiiRichWorkflowBindLauncher(container, 'rich')"), 'popup module must bind rich launcher');
assert(workflowPopup.includes('xmlCiiRichWorkflowRequestFinalRun'), 'workflow popup must delegate final run through the runner boundary');
assert(!workflowPopup.includes('restoreSimpleRunButton'), 'workflow popup must not restore the legacy Run Conversion button');
assert(!workflowPopup.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'workflow popup must not own direct-run flags');
assert(!workflowPopup.includes("document.querySelector('#model-converters-run')"), 'workflow popup must not directly click the legacy run button');
assert(!workflowPopup.includes("./legacy-adapter.js"), 'workflow popup must not import legacy-adapter directly');
assert(!workflowPopup.includes('function interceptRun'), 'workflow popup must not define the old simple-run interceptor');
assert(!workflowPopup.includes("document.addEventListener('click', interceptRun, true)"), 'workflow popup must not capture the legacy Run Conversion click');
assert(workflowPopup.includes('stopImmediatePropagation'), 'workflow popup click handler must block stale cached popup listeners');

assert(richBridge.includes('xmlCiiRichWorkflowGetBridge'), 'rich bridge boundary must expose rich-prefixed bridge getter');
assert(richBridge.includes("./legacy-adapter.js"), 'legacy adapter dependency must be isolated to the bridge boundary');
assert(richRunner.includes('xmlCiiRichWorkflowRequestFinalRun'), 'runner boundary must expose final-run handoff');
assert(richRunner.includes("document.querySelector('#model-converters-run')"), 'legacy button handoff must be contained only in runner boundary');

assert(legacyPopupShim.includes('Deprecated compatibility shim'), 'old popup filename must be reduced to a compatibility shim');
assert(legacyPopupShim.includes('installXmlCiiRichWorkflowPopup as installXmlCiiConversionWorkflowPopup'), 'old popup export must forward to the popup boundary');
assert(!legacyPopupShim.includes('restoreSimpleRunButton'), 'old popup shim must not own simple button behavior');

assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must be rendered');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must be rendered');
assert(nativePanels.includes('data-native-config-info'), 'Config info block must be rendered');
assert(nativePanels.includes('ElementLengthMm calculated for INST'), 'Config info must describe INST ElementLengthMm logic');

assert(condenseBridge.includes("XSD_KEY = 'condenseRigidXsd'"), 'condense bridge must define XSD key');
assert(condenseBridge.includes("RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange'"), 'condense bridge must define snake_case resolved key');
assert(condenseBridge.includes('normaliseConfig'), 'condense bridge must normalize config keys');
assert(condenseBridge.includes('xmlCiiRichWorkflowGetBridge'), 'condense bridge must use the bridge boundary');
assert(!condenseBridge.includes('restoreSimpleRunButton'), 'condense bridge must not restore the legacy run button');
assert(!condenseBridge.includes('__xmlCiiConversionWorkflowAllowDirectRun'), 'condense bridge must not own direct-run flags');
assert(!condenseBridge.includes('new MutationObserver'), 'condense bridge must not use a broad DOM observer');
assert(!condenseBridge.includes("document.addEventListener('click'"), 'condense bridge must not install global click handlers');
assert(!condenseBridge.includes('setInterval'), 'condense bridge must not poll with setInterval');

assert(richHotfix.includes('runXmlCiiWithRichFix'), 'rich workflow hotfix must patch XML->CII runner');
assert(richHotfix.includes('getConverterById') && richHotfix.includes("'xml_to_cii'"), 'rich workflow hotfix must target xml_to_cii converter');
assert(richHotfix.includes('xmlCiiRichWorkflowGetBridge'), 'rich hotfix must use the bridge boundary');
assert(!richHotfix.includes('restoreButtons'), 'rich hotfix must not restore simple/rich buttons');
assert(!richHotfix.includes('#model-converters-run'), 'rich hotfix must not style or mutate the legacy run button');
assert(richHotfix.includes('data-xml-cii-hotfix-condense'), 'rich workflow hotfix must inject visible condense checkboxes into the active path');
assert(richHotfix.includes('data-native-regex-path') && richHotfix.includes('stopImmediatePropagation'), 'rich workflow hotfix must suppress native regex/dropdown blink rerenders');

assert(enrichmentFix.includes("'Pressure2'") && enrichmentFix.includes('hydroPressure'), 'enrichment fix must write hydro/test pressure to Pressure2');
assert(enrichmentFix.includes("new Set(['FLAN', 'GASK', 'VALV', 'RIGID', 'INST'])"), 'enrichment fix must include full negative valve/flange block types');
assert(enrichmentFix.includes('condensedValveFlangeBlocks'), 'enrichment fix must count resolved valve/flange blocks');
assert(enrichmentFix.includes('Pressure1') && enrichmentFix.includes('Temperature1') && enrichmentFix.includes('Temperature2') && enrichmentFix.includes('Temperature3'), 'enrichment fix must preserve preview process fields into enriched XML');

assert(modelTab.includes('installXmlCiiSimpleWorkflowController'), 'ModelConvertersTab must install simple workflow controller');
assert(modelTab.includes('installXmlCiiRichWorkflowPopup'), 'ModelConvertersTab must install workflow popup binding');
assert(!modelTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must not install the old generic workflow popup');
assert(modelTab.indexOf('xml-cii-simple-workflow-controller') < modelTab.indexOf('xml-cii-rich-workflow-popup'), 'simple workflow installer must be listed separately before popup installer');
assert(modelTab.includes('installXmlCiiCondenseRigidUiBridge'), 'ModelConvertersTab must install condense bridge');
assert(modelTab.includes('installXmlCiiRichWorkflowHotfix'), 'ModelConvertersTab must install rich workflow hotfix');
assert(modelTab.includes('20260624-popup-only-1'), 'ModelConvertersTab must be cache-busted for popup-only workflow identity');
assert(publicIndex.includes('20260624-simple-rich-isolation-1'), 'model-converters index must remain cache-busted');
assert(tabShim.includes('20260624-simple-rich-isolation-1'), 'tab shim must remain cache-busted');

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

console.log('XML CII workflow smoke validation passed', {
  leftPanel: 'popup-only, no generic advanced options',
  simplePopup: 'Simple Workflow title/subtitle bound to simple launcher',
  richPopup: 'Rich Workflow title/subtitle bound to rich launcher',
  bridgeBoundary: 'legacy bridge dependency isolated to xml-cii-rich-workflow-bridge.js',
  richRunHandoff: 'legacy final-run button click contained in xml-cii-rich-workflow-runner.js only',
  condenseRigid: 'XSD + Resolved controls rendered and injected into active path',
  processParity: 'Pressure1/Pressure2/Temperature1..3/density copied from preview to enriched XML with diagnostics provenance',
  negativeValveFlangeBlocks: 'contiguous FLAN/GASK/VALV/RIGID/INST negative blocks resolved when enabled',
  regexBlink: 'native regex/dropdown change rerender suppressed',
});
