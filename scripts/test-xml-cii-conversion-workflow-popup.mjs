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

const files = {
  simpleController: 'viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js',
  workflowPopup: 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
  bridge: 'viewer/tabs/model-converters/xml-cii-rich-workflow-bridge.js',
  runner: 'viewer/tabs/model-converters/xml-cii-rich-workflow-runner.js',
  buttonScope: 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
  legacyShim: 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  modelTab: 'viewer/tabs/model-converters/ModelConvertersTab.js',
  nativePanels: 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  enrichmentRunParity: 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
  invocationBuilder: 'viewer/converters/invocation-builder.js',
};

for (const rel of Object.values(files)) {
  assert(fs.existsSync(path.join(root, rel)), `required XML CII workflow file is missing: ${rel}`);
}

const simpleController = read(files.simpleController);
const workflowPopup = read(files.workflowPopup);
const bridge = read(files.bridge);
const runner = read(files.runner);
const buttonScope = read(files.buttonScope);
const legacyShim = read(files.legacyShim);
const modelTab = read(files.modelTab);
const nativePanels = read(files.nativePanels);
const enrichmentRunParity = read(files.enrichmentRunParity);
const invocationBuilder = read(files.invocationBuilder);

assert(buttonScope.includes('model-converters-xml-cii-simple-btn'), 'button scope must create XML CII Simple Workflow launcher');
assert(buttonScope.includes('model-converters-xml-cii-rich-btn'), 'button scope must create XML CII Rich Workflow launcher');
assert(buttonScope.includes('XML->CII Simple Workflow'), 'left panel simple launcher label must be explicit');
assert(buttonScope.includes('XML->CII Rich Workflow'), 'left panel rich launcher label must be explicit');
assert(buttonScope.includes('xmlCiiWorkflowButtonScopeHideAdvancedOptions'), 'button scope must hide generic XML CII advanced options');
assert(buttonScope.includes('data-xml-cii-left-panel-options-hidden'), 'hidden generic options must have a source-level marker');
assert(!buttonScope.includes('Simple/direct workflow options'), 'left panel must not show Simple/direct workflow options');
assert(buttonScope.includes('cloneNode(true)'), 'workflow launchers must be cloned to strip stale anonymous listeners');
assert(!buttonScope.includes('new MutationObserver'), 'button scope must not use a broad observer');

assert(workflowPopup.includes('XML->CII(2019) Simple Workflow'), 'simple popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, inspect diagnostics, and run enriched CII conversion.'), 'simple popup subtitle must match requested copy');
assert(workflowPopup.includes('XML->CII(2019) Rich Workflow'), 'rich popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, and maintain manual overrides in a standalone-ready config.'), 'rich popup subtitle must match requested copy');
assert(workflowPopup.includes("xmlCiiRichWorkflowBindLauncher(container, 'simple')"), 'popup module must bind simple launcher');
assert(workflowPopup.includes("xmlCiiRichWorkflowBindLauncher(container, 'rich')"), 'popup module must bind rich launcher');
assert(workflowPopup.includes('stopImmediatePropagation'), 'popup click handler must block stale duplicate popup listeners');
assert(workflowPopup.includes('{ capture: true }'), 'popup click handler must bind in capture phase');
assert(workflowPopup.includes('xmlCiiRichWorkflowCloseForeignXmlCiiWorkflowOverlays'), 'popup must close duplicate XML CII workflow overlays');
assert(!workflowPopup.includes("document.querySelector('#model-converters-run')"), 'popup module must not directly click legacy Run Conversion');
assert(!workflowPopup.includes('./legacy-adapter.js'), 'popup module must not import legacy adapter directly');

assert(simpleController.includes('xmlCiiSimpleWorkflowSelectedConverter'), 'simple controller must check selected converter');
assert(simpleController.includes('XML_CII_CONVERTER_ID'), 'simple controller must know XML CII is popup-only');
assert(!simpleController.includes('installXmlCiiRichWorkflowPopup'), 'simple controller must not install popup module');

assert(bridge.includes('./legacy-adapter.js'), 'legacy adapter dependency must remain isolated to bridge boundary');
assert(runner.includes('xmlCiiRichWorkflowRequestFinalRun'), 'final run handoff must remain in runner boundary');
assert(runner.includes("document.querySelector('#model-converters-run')"), 'legacy run click handoff must remain contained in runner boundary only');

assert(legacyShim.includes('Deprecated compatibility shim'), 'old popup filename must remain a compatibility shim');
assert(legacyShim.includes('installXmlCiiRichWorkflowPopup as installXmlCiiConversionWorkflowPopup'), 'old popup shim must forward to popup boundary');

assert(modelTab.includes('installXmlCiiWorkflowButtonScope'), 'ModelConvertersTab must install button scope');
assert(modelTab.includes('installXmlCiiSimpleWorkflowController'), 'ModelConvertersTab must install simple controller');
assert(modelTab.includes('installXmlCiiRichWorkflowPopup'), 'ModelConvertersTab must install workflow popup binding');
assert(modelTab.includes('20260624-popup-only-1'), 'ModelConvertersTab must be cache-busted for popup-only workflow identity');
assert(!modelTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must not install old generic popup module');

assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must remain rendered in popup');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must remain rendered in popup');
assert(enrichmentRunParity.includes('process-provenance') && enrichmentRunParity.includes('Pressure2 / Hydro/Test Pressure'), 'process provenance diagnostics must still include Hydro/Test Pressure');
assert(enrichmentRunParity.includes('split-condensed-valve-flange-resolved'), 'resolved condense diagnostics must still exist');
assert(invocationBuilder.includes('--split-condensed-valve-flange'), 'worker invocation must still forward split-condensed flag');

console.log('XML CII workflow popup identity smoke validation passed', {
  leftPanel: 'popup-only: Simple Workflow + Rich Workflow, no generic advanced options',
  simplePopup: 'Simple title/subtitle bound to simple launcher',
  richPopup: 'Rich title/subtitle bound to rich launcher',
  duplicateGuard: 'capture-phase stopImmediatePropagation and foreign overlay cleanup',
});
