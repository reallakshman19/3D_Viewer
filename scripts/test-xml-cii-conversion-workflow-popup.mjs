#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const assert = (condition, message) => { if (!condition) fail(message); };

const paths = {
  wf1: 'viewer/tabs/model-converters/xml-cii-workflow-popup.js',
  wf2: 'viewer/tabs/model-converters/xml-cii-workflow2-popup.js',
  modal: 'viewer/tabs/model-converters/shared/WorkflowModal.js',
  bridge: 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js',
  runner: 'viewer/tabs/model-converters/xml-cii-workflow-runner.js',
  buttons: 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
  oldGeneric: 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  oldRich: 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
  tab: 'viewer/tabs/model-converters/ModelConvertersTab.js',
  panels: 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  parity: 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
  invoke: 'viewer/converters/invocation-builder.js',
};

for (const rel of Object.values(paths)) assert(fs.existsSync(path.join(root, rel)), `missing file: ${rel}`);
const src = Object.fromEntries(Object.entries(paths).map(([key, rel]) => [key, read(rel)]));

assert(src.buttons.includes('model-converters-xml-cii-workflow1-btn'), 'button scope must create Workflow 1 launcher');
assert(src.buttons.includes('model-converters-xml-cii-workflow2-btn'), 'button scope must create Workflow 2 launcher');
assert(src.buttons.includes('XML->CII Workflow 1'), 'Workflow 1 left label must be explicit');
assert(src.buttons.includes('XML->CII Workflow 2'), 'Workflow 2 left label must be explicit');
assert(!src.buttons.includes('XML->CII Simple Workflow'), 'left panel must not use Simple label');
assert(!src.buttons.includes('XML->CII Rich Workflow'), 'left panel must not use Rich label');
assert(src.buttons.includes('xmlCiiWorkflowButtonScopeHideAdvancedOptions'), 'button scope must hide generic XML CII advanced options');
assert(!src.buttons.includes('Simple/direct workflow options'), 'left panel must not show old options text');
assert(src.buttons.includes('cloneNode(true)'), 'launchers must be cloned to strip stale listeners');
assert(!src.buttons.includes('new MutationObserver'), 'button scope must not use broad observer');
assert(!src.buttons.includes('setTimeout('), 'button scope must not use startup repair timers');

assert(src.wf1.includes('XML->CII(2019) Workflow 1'), 'WF1 title must be explicit');
assert(!src.wf1.includes('XML->CII(2019) Workflow 2'), 'WF1 module must not own WF2 title');
assert(src.wf1.includes('WF1_RUNTIME_KEY'), 'WF1 must have its own runtime key');
assert(src.wf1.includes('WF1_LAUNCHER_SELECTOR'), 'WF1 must have its own launcher selector');
assert(src.wf1.includes('model-converters-xml-cii-workflow1-btn'), 'WF1 must bind WF1 launcher');
assert(!src.wf1.includes('model-converters-xml-cii-workflow2-btn'), 'WF1 must not bind WF2 launcher');
assert(src.wf1.includes('stopImmediatePropagation'), 'WF1 launcher must block stale click listeners');
assert(src.wf1.includes('{ capture: true }'), 'WF1 launcher must use capture phase');
assert(!src.wf1.includes('./legacy-adapter.js'), 'WF1 must not import legacy adapter directly');
assert(src.wf1.includes('renderError'), 'WF1 must render errors visibly');

assert(src.wf2.includes('XML->CII(2019) Workflow 2'), 'WF2 title must be explicit');
assert(!src.wf2.includes('XML->CII(2019) Workflow 1'), 'WF2 module must not own WF1 title');
assert(src.wf2.includes('Enhanced workflow for process-data and weight-data customisation'), 'WF2 subtitle must describe restored rich purpose');
assert(src.wf2.includes('WF2_RUNTIME_KEY'), 'WF2 must have its own runtime key');
assert(src.wf2.includes('WF2_LAUNCHER_SELECTOR'), 'WF2 must have its own launcher selector');
assert(src.wf2.includes('model-converters-xml-cii-workflow2-btn'), 'WF2 must bind WF2 launcher');
assert(!src.wf2.includes('model-converters-xml-cii-workflow1-btn'), 'WF2 must not bind WF1 launcher');
assert(src.wf2.includes("data-xml-cii-workflow-mode', 'workflow2'"), 'WF2 must stamp workflow2 mode');
assert(src.wf2.includes('installXmlCiiWorkflow2Popup'), 'WF2 must export standalone installer');
assert(src.wf2.includes('stopImmediatePropagation'), 'WF2 launcher must block stale click listeners');
assert(src.wf2.includes('{ capture: true }'), 'WF2 launcher must use capture phase');
assert(!src.wf2.includes('./legacy-adapter.js'), 'WF2 must not import legacy adapter directly');
assert(src.wf2.includes('renderError'), 'WF2 must render errors visibly');

assert(src.modal.includes('data-modal-tabs'), 'modal must expose stable tab host');
assert(src.modal.includes("tabHost.addEventListener('click'"), 'modal must delegate phase tab clicks');
assert(src.modal.includes('data-modal-tab'), 'modal delegated handler must target phase tab buttons');
assert(src.bridge.includes('./legacy-adapter.js'), 'legacy adapter dependency must stay isolated to bridge');
assert(src.bridge.includes('ensureDefaultMastersLoaded = async () => null'), 'bridge must block obsolete default preload');
assert(src.bridge.includes("masterKey === 'pipingClass'"), 'bridge must block obsolete piping class aggregate load');
assert(src.bridge.includes('hydrateCondenseSnapshot'), 'bridge must own condense option hydration');
assert(src.runner.includes('xmlCiiWorkflowRequestFinalRun'), 'final run handoff must remain in runner boundary');

assert(src.tab.includes('installXmlCiiWorkflowButtonScope'), 'ModelConvertersTab must install button scope');
assert(src.tab.includes('installXmlCiiWorkflowPopup'), 'ModelConvertersTab must install WF1 popup');
assert(src.tab.includes('installXmlCiiWorkflow2Popup'), 'ModelConvertersTab must install WF2 popup');
assert(!src.tab.includes('installXmlCiiWorkflowHotfix'), 'ModelConvertersTab must not install retired hotfix');
assert(src.tab.includes('20260624-workflow2-standalone-1'), 'ModelConvertersTab must use WF2 standalone cache key');
assert(src.oldGeneric.includes('xml-cii-workflow-popup.js?v=20260624-workflow2-standalone-1'), 'old generic shim must forward to WF1');
assert(src.oldRich.includes('xml-cii-workflow2-popup.js?v=20260624-workflow2-standalone-1'), 'old rich shim must forward to WF2');

assert(src.panels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'XSD condense option must remain rendered');
assert(src.panels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'Resolved condense option must remain rendered');
assert(src.panels.includes('data-xml-cii-workflow2-master-preview'), 'WF2 must show per-master preview rows');
assert(src.panels.includes('Workflow 1 keeps master setup compact'), 'WF1 must keep compact master sequence');
assert(src.panels.includes("master.key === 'pipingClass'"), 'native panels must disable piping class default load');
assert(src.parity.includes('process-provenance') && src.parity.includes('Pressure2 / Hydro/Test Pressure'), 'process provenance diagnostics must include hydro/test pressure');
assert(src.parity.includes('split-condensed-valve-flange-resolved'), 'resolved condense diagnostics must still exist');
assert(src.invoke.includes('--split-condensed-valve-flange'), 'worker invocation must forward split-condensed flag');

console.log('XML CII workflow popup identity smoke validation passed', {
  workflow1: 'standalone baseline popup',
  workflow2: 'standalone enhanced customisation popup',
  leftPanel: 'Workflow 1 + Workflow 2 only',
});
