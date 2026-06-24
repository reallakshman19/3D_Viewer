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
  workflowPopup: 'viewer/tabs/model-converters/xml-cii-workflow-popup.js',
  bridge: 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js',
  runner: 'viewer/tabs/model-converters/xml-cii-workflow-runner.js',
  buttonScope: 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
  legacyShim: 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  oldRichShim: 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
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
const oldRichShim = read(files.oldRichShim);
const modelTab = read(files.modelTab);
const nativePanels = read(files.nativePanels);
const enrichmentRunParity = read(files.enrichmentRunParity);
const invocationBuilder = read(files.invocationBuilder);

assert(buttonScope.includes('model-converters-xml-cii-workflow1-btn'), 'button scope must create XML CII Workflow 1 launcher');
assert(buttonScope.includes('model-converters-xml-cii-workflow2-btn'), 'button scope must create XML CII Workflow 2 launcher');
assert(buttonScope.includes('XML->CII Workflow 1'), 'left panel Workflow 1 launcher label must be explicit');
assert(buttonScope.includes('XML->CII Workflow 2'), 'left panel Workflow 2 launcher label must be explicit');
assert(!buttonScope.includes('XML->CII Simple Workflow'), 'left panel must not use Simple naming');
assert(!buttonScope.includes('XML->CII Rich Workflow'), 'left panel must not use Rich naming');
assert(buttonScope.includes('xmlCiiWorkflowButtonScopeHideAdvancedOptions'), 'button scope must hide generic XML CII advanced options');
assert(buttonScope.includes('data-xml-cii-left-panel-options-hidden'), 'hidden generic options must have a source-level marker');
assert(!buttonScope.includes('Simple/direct workflow options'), 'left panel must not show Simple/direct workflow options');
assert(buttonScope.includes('cloneNode(true)'), 'workflow launchers must be cloned to strip stale anonymous listeners');
assert(!buttonScope.includes('new MutationObserver'), 'button scope must not use a broad observer');

assert(workflowPopup.includes('XML->CII(2019) Workflow 1'), 'Workflow 1 popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, inspect diagnostics, and run enriched CII conversion.'), 'Workflow 1 popup subtitle must match requested copy');
assert(workflowPopup.includes('XML->CII(2019) Workflow 2'), 'Workflow 2 popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, and maintain manual overrides in a standalone-ready config.'), 'Workflow 2 popup subtitle must match requested copy');
assert(workflowPopup.includes("xmlCiiWorkflowBindLauncher(container, 'workflow1')"), 'popup module must bind Workflow 1 launcher');
assert(workflowPopup.includes("xmlCiiWorkflowBindLauncher(container, 'workflow2')"), 'popup module must bind Workflow 2 launcher');
assert(workflowPopup.includes('stopImmediatePropagation'), 'popup click handler must block stale duplicate popup listeners');
assert(workflowPopup.includes('{ capture: true }'), 'popup click handler must bind in capture phase');
assert(workflowPopup.includes('xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays'), 'popup must close duplicate XML CII workflow overlays');
assert(!workflowPopup.includes("document.querySelector('#model-converters-run')"), 'popup module must not directly click legacy Run Conversion');
assert(!workflowPopup.includes('./legacy-adapter.js'), 'popup module must not import legacy adapter directly');

assert(simpleController.includes('xmlCiiSimpleWorkflowSelectedConverter'), 'legacy direct-run controller must check selected converter');
assert(simpleController.includes('XML_CII_CONVERTER_ID'), 'legacy direct-run controller must know XML CII is popup-only');
assert(!simpleController.includes('installXmlCiiWorkflowPopup'), 'legacy direct-run controller must not install popup module');

assert(bridge.includes('./legacy-adapter.js'), 'legacy adapter dependency must remain isolated to bridge boundary');
assert(bridge.includes('ensureDefaultMastersLoaded = async () => null'), 'bridge must block obsolete default-master preload');
assert(bridge.includes("masterKey === 'pipingClass'"), 'bridge must block obsolete aggregate piping-class default load');
assert(runner.includes('xmlCiiWorkflowRequestFinalRun'), 'final run handoff must remain in runner boundary');
assert(runner.includes("document.querySelector('#model-converters-run')"), 'legacy run click handoff must remain contained in runner boundary only');

assert(legacyShim.includes('Deprecated compatibility shim'), 'old popup filename must remain a compatibility shim');
assert(oldRichShim.includes('Deprecated compatibility shim'), 'old rich popup filename must remain a compatibility shim');
assert(oldRichShim.includes('installXmlCiiWorkflowPopup as installXmlCiiRichWorkflowPopup'), 'old rich popup shim must forward to neutral popup boundary');

assert(modelTab.includes('installXmlCiiWorkflowButtonScope'), 'ModelConvertersTab must install button scope');
assert(modelTab.includes('installXmlCiiWorkflowPopup'), 'ModelConvertersTab must install workflow popup binding');
assert(modelTab.includes('20260624-workflow1-workflow2-1'), 'ModelConvertersTab must be cache-busted for Workflow 1/2 identity');
assert(!modelTab.includes('installXmlCiiRichWorkflowPopup'), 'ModelConvertersTab must not install old rich-prefixed popup module');
assert(!modelTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must not install old generic popup module');

assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must remain rendered in popup');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must remain rendered in popup');
assert(nativePanels.includes('data-xml-cii-workflow2-master-preview'), 'Workflow 2 must show per-master preview rows');
assert(nativePanels.includes('Workflow 1 keeps master setup compact'), 'Workflow 1 must keep the compact master sequence');
assert(!nativePanels.includes('Piping_class_master.json'), 'native panels must not expose obsolete aggregate piping-class master');
assert(enrichmentRunParity.includes('process-provenance') && enrichmentRunParity.includes('Pressure2 / Hydro/Test Pressure'), 'process provenance diagnostics must still include Hydro/Test Pressure');
assert(enrichmentRunParity.includes('split-condensed-valve-flange-resolved'), 'resolved condense diagnostics must still exist');
assert(invocationBuilder.includes('--split-condensed-valve-flange'), 'worker invocation must still forward split-condensed flag');

console.log('XML CII workflow popup identity smoke validation passed', {
  leftPanel: 'popup-only: Workflow 1 + Workflow 2, no generic advanced options',
  workflow1: 'baseline enriched conversion workflow popup',
  workflow2: 'enhanced customization workflow popup with per-master preview rows',
  duplicateGuard: 'capture-phase stopImmediatePropagation and foreign overlay cleanup',
});
