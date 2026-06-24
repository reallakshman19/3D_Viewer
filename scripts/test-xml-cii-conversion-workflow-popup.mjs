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
  workflowPopup: 'viewer/tabs/model-converters/xml-cii-workflow-popup.js',
  workflowModal: 'viewer/tabs/model-converters/shared/WorkflowModal.js',
  bridge: 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js',
  runner: 'viewer/tabs/model-converters/xml-cii-workflow-runner.js',
  buttonScope: 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
  oldGenericShim: 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  oldRichShim: 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
  modelTab: 'viewer/tabs/model-converters/ModelConvertersTab.js',
  nativePanels: 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  enrichmentRunParity: 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
  invocationBuilder: 'viewer/converters/invocation-builder.js',
};

for (const rel of Object.values(files)) {
  assert(fs.existsSync(path.join(root, rel)), `required XML CII workflow file is missing: ${rel}`);
}

const workflowPopup = read(files.workflowPopup);
const workflowModal = read(files.workflowModal);
const bridge = read(files.bridge);
const runner = read(files.runner);
const buttonScope = read(files.buttonScope);
const oldGenericShim = read(files.oldGenericShim);
const oldRichShim = read(files.oldRichShim);
const modelTab = read(files.modelTab);
const nativePanels = read(files.nativePanels);
const enrichmentRunParity = read(files.enrichmentRunParity);
const invocationBuilder = read(files.invocationBuilder);

assert(buttonScope.includes('model-converters-xml-cii-workflow1-btn'), 'button scope must create XML CII Workflow 1 launcher');
assert(buttonScope.includes('model-converters-xml-cii-workflow2-btn'), 'button scope must create XML CII Workflow 2 launcher');
assert(buttonScope.includes('XML->CII Workflow 1'), 'left panel Workflow 1 launcher label must be explicit');
assert(buttonScope.includes('XML->CII Workflow 2'), 'left panel Workflow 2 launcher label must be explicit');
assert(!buttonScope.includes('XML->CII Simple Workflow'), 'left panel must not use Simple workflow labels');
assert(!buttonScope.includes('XML->CII Rich Workflow'), 'left panel must not use Rich workflow labels');
assert(buttonScope.includes('xmlCiiWorkflowButtonScopeHideAdvancedOptions'), 'button scope must hide generic XML CII advanced options');
assert(!buttonScope.includes('Simple/direct workflow options'), 'left panel must not show Simple/direct workflow options');
assert(buttonScope.includes('cloneNode(true)'), 'workflow launchers must be cloned to strip stale anonymous listeners');
assert(!buttonScope.includes('new MutationObserver'), 'button scope must not use a broad observer');
assert(!buttonScope.includes('setTimeout('), 'button scope must not use delayed startup repair timers');

assert(workflowPopup.includes('XML->CII(2019) Workflow 1'), 'Workflow 1 popup title must be explicit');
assert(workflowPopup.includes('XML->CII(2019) Workflow 2'), 'Workflow 2 popup title must be explicit');
assert(workflowPopup.includes('Import masters, map fields, inspect diagnostics, and run enriched CII conversion.'), 'Workflow 1 popup subtitle must match requested copy');
assert(workflowPopup.includes('Import masters, map fields, and maintain manual overrides in a standalone-ready config.'), 'Workflow 2 popup subtitle must match requested copy');
assert(workflowPopup.includes("xmlCiiWorkflowBindLauncher(container, 'workflow1')"), 'popup module must keep direct Workflow 1 launcher binding');
assert(workflowPopup.includes("xmlCiiWorkflowBindLauncher(container, 'workflow2')"), 'popup module must keep direct Workflow 2 launcher binding');
assert(workflowPopup.includes('xmlCiiWorkflowBindDelegatedLauncher'), 'popup module must delegate launcher clicks from the stable root so future-created buttons respond');
assert(workflowPopup.includes('data-xml-cii-workflow-launcher'), 'delegated popup launcher binding must catch current and future Workflow 1/2 buttons');
assert(workflowPopup.includes('XML_CII_WORKFLOW_DELEGATED_DATASET_KEY'), 'delegated popup launcher binding must be guarded once per model-converters root');
assert(workflowPopup.includes('WorkflowModal.js?v=20260624-workflow-tabs-fix-1'), 'popup module must cache-bust the modal delegated-tab binding');
assert(workflowPopup.includes('stopImmediatePropagation'), 'popup click handler must block stale duplicate popup listeners');
assert(workflowPopup.includes('{ capture: true }'), 'popup click handler must bind in capture phase');
assert(!workflowPopup.includes("document.querySelector('#model-converters-run')"), 'popup module must not directly click legacy Run Conversion');
assert(!workflowPopup.includes('./legacy-adapter.js'), 'popup module must not import legacy adapter directly');
assert(workflowPopup.includes('xmlCiiWorkflowRenderError'), 'popup phase rendering must fail visibly instead of making tabs look inert');

assert(workflowModal.includes('data-modal-tabs'), 'modal must expose a stable tab host');
assert(workflowModal.includes("tabHost.addEventListener('click'"), 'modal phase tabs must use delegated host click handling');
assert(workflowModal.includes('data-modal-tab'), 'modal delegated handler must target phase tab buttons');

assert(bridge.includes('./legacy-adapter.js'), 'legacy adapter dependency must remain isolated to bridge boundary');
assert(bridge.includes('ensureDefaultMastersLoaded = async () => null'), 'bridge must block obsolete default-master preload');
assert(bridge.includes("masterKey === 'pipingClass'"), 'bridge must block obsolete aggregate piping-class default load');
assert(bridge.includes('hydrateCondenseSnapshot'), 'bridge must own Condense Rigid option hydration without the old bridge patch');
assert(runner.includes('xmlCiiWorkflowRequestFinalRun'), 'final run handoff must remain in workflow runner boundary');
assert(runner.includes("document.querySelector('#model-converters-run')"), 'legacy run click handoff must remain contained in runner boundary only');

assert(modelTab.includes('installXmlCiiWorkflowButtonScope'), 'ModelConvertersTab must install button scope');
assert(modelTab.includes('installXmlCiiWorkflowPopup'), 'ModelConvertersTab must install workflow popup binding');
assert(!modelTab.includes('installXmlCiiWorkflowHotfix'), 'ModelConvertersTab must not install the retired workflow hotfix module');
assert(modelTab.includes('20260624-workflow-tabs-fix-1'), 'ModelConvertersTab must be cache-busted for delegated workflow tab click fix');

assert(oldGenericShim.includes('Deprecated compatibility shim'), 'old generic popup filename must remain a compatibility shim');
assert(oldRichShim.includes('Deprecated compatibility shim'), 'old rich popup filename must remain a compatibility shim');
assert(oldRichShim.includes('installXmlCiiWorkflowPopup as installXmlCiiRichWorkflowPopup'), 'old rich popup shim must forward to neutral popup boundary');

assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must remain rendered in popup');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must remain rendered in popup');
assert(nativePanels.includes('data-xml-cii-workflow2-master-preview'), 'Workflow 2 must show per-master preview rows');
assert(nativePanels.includes('Workflow 1 keeps master setup compact'), 'Workflow 1 must keep the compact master sequence');
assert(nativePanels.includes("master.key === 'pipingClass'"), 'native panels must disable default loading for piping-class master');
assert(enrichmentRunParity.includes('process-provenance') && enrichmentRunParity.includes('Pressure2 / Hydro/Test Pressure'), 'process provenance diagnostics must still include Hydro/Test Pressure');
assert(enrichmentRunParity.includes('split-condensed-valve-flange-resolved'), 'resolved condense diagnostics must still exist');
assert(invocationBuilder.includes('--split-condensed-valve-flange'), 'worker invocation must still forward split-condensed flag');

console.log('XML CII workflow popup identity smoke validation passed', {
  leftPanel: 'popup-only: Workflow 1 + Workflow 2, no generic advanced options',
  workflow1: 'baseline enriched conversion workflow popup',
  workflow2: 'enhanced customization workflow popup with per-master preview rows',
  duplicateGuard: 'capture-phase stopImmediatePropagation and foreign overlay cleanup',
  clickReliability: 'delegated root launcher clicks + delegated modal phase tabs',
  consolidation: 'workflow hotfix removed from active importer; bridge owns condense state',
});
