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

const popupPath = 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js';
const nativePanelsPath = 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js';
const workflowShellPath = 'viewer/tabs/model-converters/WorkflowShell.js';
const legacyAdapterPath = 'viewer/tabs/model-converters/legacy-adapter.js';
const canonicalTabPath = 'viewer/tabs/model-converters/ModelConvertersTab.js';
const branchSyncPath = 'viewer/tabs/model-converters/xml-cii-branch-sample-sync.js';
const tabPath = 'viewer/tabs/model-converters-tab.js';
const tabCssPath = 'viewer/tabs/model-converters-tab.css';
const popup = read(popupPath);
const nativePanels = read(nativePanelsPath);
const workflowShell = read(workflowShellPath);
const legacyAdapter = read(legacyAdapterPath);
const canonicalTab = read(canonicalTabPath);
const branchSync = read(branchSyncPath);
const tab = read(tabPath);
const tabCss = read(tabCssPath);

assert(fs.existsSync(path.join(root, popupPath)), 'workflow popup module must exist');
assert(fs.existsSync(path.join(root, nativePanelsPath)), 'popup-native panel module must exist');
assert(fs.existsSync(path.join(root, workflowShellPath)), 'canonical WorkflowShell module must exist');
assert(fs.existsSync(path.join(root, branchSyncPath)), 'branch sample sync module must exist');
assert(popup.includes("import { WorkflowModal } from './shared/WorkflowModal.js'"), 'popup must reuse existing WorkflowModal');
assert(popup.includes("import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js'"), 'popup must render popup-native phase bodies');
assert(popup.includes("import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js'"), 'popup must use canonical XML CII phase registry');
assert(tab.includes('installXmlCiiConversionWorkflowPopup'), 'model-converters-tab must expose workflow popup installer');

assert(popup.includes("tabs: XML_CII_WORKFLOW_PHASES"), 'popup must render XML->CII phases as top-level tabs');
assert(popup.includes("title: 'XML->CII(2019) Workflow'"), 'popup title must match required workflow popup');
assert(popup.includes('Import masters, map fields, and maintain manual overrides'), 'popup subtitle must describe master/config workflow');

for (const phase of [
  "'1 Regex'",
  "'2 Import Masters'",
  "'3 Preview'",
  "'4 Diagnostics'",
  "'4A Weight Match'",
  "'5 Run'",
  "'6 Support Types'",
  "'7 Config'",
]) {
  assert(workflowShell.includes(phase), `canonical workflow phase missing: ${phase}`);
}

assert(workflowShell.indexOf("id: 'weight-match'") < workflowShell.indexOf("id: 'run'"), 'Weight Match must appear before Run');
assert(workflowShell.indexOf("id: 'run'") < workflowShell.indexOf("id: 'support-mapper'"), 'Run must appear before Support Types');
assert(workflowShell.indexOf("id: 'support-mapper'") < workflowShell.indexOf("id: 'config'"), 'Support Types must appear before Config');

assert(!popup.includes("{ id: 'matched-audit'"), 'Matched Audit must not be a top-level workflow tab');
assert(!popup.includes("{ id: 'output-run'"), 'Output / Run Conversion must not be a top-level workflow tab');
assert(!popup.includes('XML - Model Data'), 'XML - Model Data must not replace the required phase tabs');
assert(!popup.includes('Process / Piping Class / Wt. Enrichment'), 'Process enrichment must not replace the required phase tabs');
assert(!popup.includes('oldPhaseDetailHtml'), 'popup must not render old direct-panel phase HTML');
assert(!popup.includes('bridge.renderPhaseInto'), 'popup must not render legacy-adapter phase HTML into the modal');
assert(popup.includes('bridge.getPopupSnapshot'), 'popup must use bridge data snapshots for native bodies');
assert(nativePanels.includes('renderXmlCiiPopupNativePhase'), 'native panel module must expose the popup-native renderer');
assert(nativePanels.includes('data-native-finalise-run'), 'native Run phase must own Finalise and Run action');
assert(nativePanels.includes('data-native-build-preview'), 'native Preview phase must own Build Preview action');
assert(nativePanels.includes('data-native-dry-run'), 'native Diagnostics phase must own Dry Run action');
assert(nativePanels.includes('data-native-regex-path="linelist.sampleBranchName"'), 'native Regex tab must edit canonical linelist.sampleBranchName');

assert(branchSync.includes("const BRANCH_SAMPLE_KEY = 'xmlCii2019.regex.branchNameSampleFromXml.v1'"), 'Branchname sync must persist last extracted XML Branchname');
assert(branchSync.includes('/<\\s*[^>]*Branchname'), 'Branchname sync must extract <Branchname> tag values');
assert(branchSync.includes('cfg.linelist.sampleBranchName = sample'), 'Branchname sync must write canonical linelist.sampleBranchName used by the Regex tab');
assert(branchSync.includes('cfg.regex.branchNameSample = sample'), 'Branchname sync must retain backward-compatible regex.branchNameSample mirror');
assert(branchSync.includes("input.dispatchEvent(new Event('change', { bubbles: true }))"), 'Branchname sync must dispatch config change so last-session defaults persist');

assert(!popup.includes('mountExistingPanel'), 'popup must not move live DOM panels by portal');
assert(!popup.includes('new MutationObserver'), 'popup must not install MutationObserver');
assert(popup.includes("document.addEventListener('click', interceptRun, true)"), 'popup must intercept XML->CII run click through one capture listener');
assert(popup.includes('stateByRoot: new WeakMap()'), 'popup must keep independent modal state per rendered root');
assert(popup.includes('renderPhase(root, state)'), 'popup must render the active phase through the live bridge/fallback path');
assert(popup.includes('preloadDefaultMasters(root, state)'), 'popup must preload default masters after opening');
assert(popup.includes('bridge.ensureDefaultMastersLoaded'), 'popup must use the legacy default-master preload bridge');
assert(popup.includes('function armDirectRunGuard()'), 'popup must expose a one-tick direct-run guard');
assert(popup.includes('armDirectRunGuard();\n      state.modal?.close();'), 'bridge close handoff must arm direct-run before closing');
assert(legacyAdapter.includes('ensureDefaultMastersLoaded(target)'), 'legacy phase bridge must expose default-master preload');
assert(legacyAdapter.includes('getPopupSnapshot(target)'), 'legacy phase bridge must expose popup snapshot data');
assert(legacyAdapter.includes('buildPopupPreviewRows()'), 'legacy phase bridge must expose popup preview data action');
assert(legacyAdapter.includes('runPopupDiagnostics()'), 'legacy phase bridge must expose popup diagnostics action');
assert(legacyAdapter.includes('computePopupWeightRows()'), 'legacy phase bridge must expose popup weight action');
assert(legacyAdapter.includes('xmlCiiConfigWithLoadedMasterRows'), 'Preview must hydrate config from loaded local master rows');
assert(legacyAdapter.includes("const config = xmlCiiConfigWithLoadedMasterRows('XML->CII preview');"), 'Preview render/build must use hydrated master config');
assert(legacyAdapter.includes('model-converters-workflow-run-actions'), 'Run phase must use popup-native action layout instead of inline legacy button styles');
assert(tabCss.includes('.model-converters-workflow-regex-field select'), 'Run phase select controls must use workflow field styling');
assert(tabCss.includes('span:not(.model-converters-workflow-run-status-icon)'), 'Run status row layout must not flex the icon column as the label');

const popupBridgeImport = popup.match(/legacy-adapter\.js\?v=([^'"]+)/)?.[1] || '';
const tabBridgeImport = canonicalTab.match(/legacy-adapter\.js\?v=([^'"]+)/)?.[1] || '';
assert(popupBridgeImport && popupBridgeImport === tabBridgeImport, 'popup and ModelConvertersTab must import the same legacy-adapter module URL');

console.log('✅ XML CII phase-tab workflow popup static test passed', {
  topLevelTabs: 8,
  workflowMode: 'phase-tabs',
  branchNameSync: 'linelist.sampleBranchName',
});
