#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readIfExists(rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const popupPath = 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js';
const nativePanelsPath = 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js';
const condenseRigidBridgePath = 'viewer/tabs/model-converters/xml-cii-condense-rigid-ui-bridge.js';
const workflowShellPath = 'viewer/tabs/model-converters/WorkflowShell.js';
const legacyAdapterPath = 'viewer/tabs/model-converters/legacy-adapter.js';
const canonicalTabPath = 'viewer/tabs/model-converters/ModelConvertersTab.js';
const branchSyncPath = 'viewer/tabs/model-converters/xml-cii-branch-sample-sync.js';
const previewRendererPath = 'viewer/tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js';
const enrichmentRunParityPath = 'viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js';
const weightMatchModelPath = 'viewer/converters/xml-cii2019-core/weight-match-model.js';
const invocationBuilderPath = 'viewer/converters/invocation-builder.js';
const publicIndexPath = 'viewer/tabs/model-converters/index.js';
const tabPath = 'viewer/tabs/model-converters-tab.js';
const tabCssPath = 'viewer/tabs/model-converters-tab.css';
const supplementalTabCssPath = 'viewer/tabs/model-converters-css-fix.css';
const popup = read(popupPath);
const nativePanels = read(nativePanelsPath);
const condenseRigidBridge = read(condenseRigidBridgePath);
const workflowShell = read(workflowShellPath);
const legacyAdapter = read(legacyAdapterPath);
const canonicalTab = read(canonicalTabPath);
const branchSync = read(branchSyncPath);
const previewRenderer = read(previewRendererPath);
const enrichmentRunParity = read(enrichmentRunParityPath);
const weightMatchModel = read(weightMatchModelPath);
const invocationBuilder = read(invocationBuilderPath);
const publicIndex = read(publicIndexPath);
const tab = read(tabPath);
const tabCss = `${read(tabCssPath)}\n${readIfExists(supplementalTabCssPath)}`;

assert(fs.existsSync(path.join(root, popupPath)), 'workflow popup module must exist for rich workflow');
assert(fs.existsSync(path.join(root, nativePanelsPath)), 'popup-native panel module must exist');
assert(fs.existsSync(path.join(root, condenseRigidBridgePath)), 'condense rigid bridge module must exist');
assert(fs.existsSync(path.join(root, workflowShellPath)), 'canonical WorkflowShell module must exist');
assert(fs.existsSync(path.join(root, branchSyncPath)), 'branch sample sync module must exist');
assert(popup.includes("import { WorkflowModal } from './shared/WorkflowModal.js'"), 'popup must reuse existing WorkflowModal');
assert(/import \{ renderXmlCiiPopupNativePhase \} from '\.\/xml-cii-popup-native-panels\.js(?:\?v=[^']+)?'/.test(popup), 'popup must render popup-native phase bodies when explicitly used');
assert(popup.includes('xml-cii-popup-native-panels.js?v=20260623-inst-length-info-simple-run-1'), 'popup must cache-bust native panel import containing INST length info');
assert(popup.includes("import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js'"), 'popup must use canonical XML CII phase registry');
assert(canonicalTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must install the rich workflow popup path');
assert(tab.includes('model-converters/index.js?v=20260623-inst-length-info-simple-run-1'), 'legacy tab shim must point to cache-busted model-converters index');
assert(popup.includes('Only the XML->CII Rich Workflow button opens this phase-tab popup'), 'popup must document rich-only opening');
assert(!popup.includes("document.addEventListener('click', interceptRun, true)"), 'popup must not intercept the simple Run Conversion button');
assert(!popup.includes('function interceptRun'), 'popup must not define simple-run interception');
assert(popup.includes('window[DIRECT_RUN_FLAG] = true'), 'popup must permanently bypass stale run interceptors');
assert(popup.includes('#model-converters-run') && popup.includes('Run Conversion'), 'popup must restore simple Run Conversion button visibility');

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

assert(!popup.includes('oldPhaseDetailHtml'), 'popup must not render old direct-panel phase HTML');
assert(nativePanels.includes('renderXmlCiiPopupNativePhase'), 'native panel module must expose the popup-native renderer');
assert(nativePanels.includes('data-native-finalise-run'), 'native Run phase must own Finalise and Run action');
assert(nativePanels.includes('data-native-build-preview'), 'native Preview phase must own Build Preview action');
assert(nativePanels.includes('data-native-dry-run'), 'native Diagnostics phase must own Dry Run action');
assert(nativePanels.includes('data-native-regex-path="linelist.sampleBranchName"'), 'native Regex tab must edit canonical linelist.sampleBranchName');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (XSD)'), 'native Run/Config phase must expose XSD Condense Rigid option');
assert(nativePanels.includes('Condense Rigid / split condensed valve-flange nodes (Resolved)'), 'native Run/Config phase must expose Resolved Condense Rigid option');
assert(nativePanels.includes('data-native-run-option="condenseRigidXsd"'), 'native Run phase must expose XSD Condense Rigid key');
assert(nativePanels.includes('data-native-run-option="splitCondensedValveFlange"'), 'native Run phase must expose Resolved Condense Rigid key');
assert(nativePanels.includes('data-native-config-bool="condenseRigidXsd"'), 'native Config phase must expose XSD Condense Rigid config key');
assert(nativePanels.includes('data-native-config-bool="splitCondensedValveFlange"'), 'native Config phase must expose Resolved Condense Rigid config key');
assert(nativePanels.includes('data-native-config-info'), 'Config tab must expose the logic info icon/details block');
assert(nativePanels.includes('ElementLengthMm calculated for INST'), 'Config info must explain INST ElementLengthMm logic');
assert(nativePanels.includes('previous positive node to the INST position'), 'Config info must state the INST length basis');

assert(condenseRigidBridge.includes('XSD_KEY = \'condenseRigidXsd\''), 'condense rigid bridge must define XSD option key');
assert(condenseRigidBridge.includes('RESOLVED_SNAKE_KEY = \'split_condensed_valve_flange\''), 'condense rigid bridge must write snake_case resolved key');
assert(condenseRigidBridge.includes('normaliseConfig'), 'condense rigid bridge must normalize camelCase and snake_case keys');
assert(condenseRigidBridge.includes('setPopupRunOption') && condenseRigidBridge.includes('savePopupConfigText'), 'condense rigid bridge must sync run and config values');
assert(condenseRigidBridge.includes('window[DIRECT_RUN_FLAG] = true'), 'condense rigid bridge must bypass stale simple-run interceptors');
assert(!condenseRigidBridge.includes('new MutationObserver'), 'condense rigid bridge must not use broad DOM observer side effects');
assert(!condenseRigidBridge.includes("document.addEventListener('click'"), 'condense rigid bridge must not install global click injection');
assert(!condenseRigidBridge.includes('setInterval'), 'condense rigid bridge must not poll the DOM');
assert(canonicalTab.includes('installXmlCiiCondenseRigidUiBridge'), 'ModelConvertersTab must install condense rigid bridge');
assert(canonicalTab.includes('installXmlCiiConversionWorkflowPopup'), 'ModelConvertersTab must install rich workflow popup');
assert(canonicalTab.includes('xml-cii-condense-rigid-ui-bridge.js?v=20260623-inst-length-info-simple-run-1'), 'ModelConvertersTab must cache-bust condense rigid bridge');
assert(canonicalTab.includes('xml-cii-conversion-workflow-popup.js?v=20260623-inst-length-info-simple-run-1'), 'ModelConvertersTab must cache-bust rich workflow popup');
assert(publicIndex.includes('20260623-inst-length-info-simple-run-1'), 'public model-converters entry must cache-bust INST/simple-run fix');

assert(branchSync.includes("const BRANCH_SAMPLE_KEY = 'xmlCii2019.regex.branchNameSampleFromXml.v1'"), 'Branchname sync must persist last extracted XML Branchname');
assert(branchSync.includes('/<\\s*[^>]*Branchname'), 'Branchname sync must extract <Branchname> tag values');
assert(branchSync.includes('cfg.linelist.sampleBranchName = sample'), 'Branchname sync must write canonical linelist.sampleBranchName used by the Regex tab');
assert(branchSync.includes('cfg.regex.branchNameSample = sample'), 'Branchname sync must retain backward-compatible regex.branchNameSample mirror');
assert(branchSync.includes('data-native-regex-path="linelist.sampleBranchName"'), 'Branchname sync must update native Regex popup sample input');

assert(previewRenderer.includes('computeLineNoKey'), 'Preview must match line-list rows using configured field maps');
assert(previewRenderer.includes('_looksLikeNpsToken(shifted.fourth)'), 'Preview must recognize shifted Branchname size token at position 4');
assert(previewRenderer.includes('_isLikelyMaterialToken(value)'), 'Preview must not treat material token CS as piping class fallback');
assert(previewRenderer.includes('^S\\d+'), 'Preview shifted-branch guard must recognize S-prefixed line keys');
assert(enrichmentRunParity.includes("RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'RIGID', 'INST'])"), 'Condense resolved must include INST as length-bearing negative node');
assert(enrichmentRunParity.includes("INLINE_LENGTH_COMPONENT_TYPES = new Set(['INST'])"), 'enriched XML parity must define INST inline length annotation');
assert(enrichmentRunParity.includes('annotateInlineElementLengths'), 'enriched XML parity must calculate inline ElementLengthMm values');
assert(enrichmentRunParity.includes('element-length-inst'), 'enriched XML diagnostics must record INST ElementLengthMm annotations');
assert(enrichmentRunParity.includes('previous positive-node CII coordinate distance'), 'INST ElementLengthMm basis must be documented in diagnostics');
assert(enrichmentRunParity.includes('split-condensed-valve-flange-resolved'), 'enriched XML diagnostics must record Resolved Condense Rigid application');
assert(enrichmentRunParity.includes('split_condensed_valve_flange'), 'enriched XML parity must understand snake_case split_condensed_valve_flange');
assert(invocationBuilder.includes('--split-condensed-valve-flange') && invocationBuilder.includes('--no-split-condensed-valve-flange'), 'worker invocation must forward Condense Rigid CLI option');
assert(invocationBuilder.includes('supportConfig.split_condensed_valve_flange'), 'worker invocation must honor supportConfigJson.split_condensed_valve_flange');

assert(weightMatchModel.includes('computeLineNoKey'), 'Weight Match must match line-list rows using configured field maps');
assert(weightMatchModel.includes('ratingOverrideForBranch'), 'Weight Match must explicitly read manual rating overrides');
assert(weightMatchModel.includes("config?.overrides?.processData?.[key]?.rating"), 'Weight Match must accept rating saved under processData overrides');
assert(weightMatchModel.includes('lineKey: branchContext.lineKey'), 'Weight Match rows must carry the resolved line key for diagnostics/debugging');

assert(legacyAdapter.includes('ensureDefaultMastersLoaded(target)'), 'legacy phase bridge must expose default-master preload');
assert(legacyAdapter.includes('getPopupSnapshot(target)'), 'legacy phase bridge must expose popup snapshot data');
assert(legacyAdapter.includes('buildPopupPreviewRows()'), 'legacy phase bridge must expose popup preview data action');
assert(legacyAdapter.includes('runPopupDiagnostics()'), 'legacy phase bridge must expose popup diagnostics action');
assert(legacyAdapter.includes('computePopupWeightRows()'), 'legacy phase bridge must expose popup weight action');
assert(legacyAdapter.includes('xmlCiiConfigWithLoadedMasterRows'), 'Preview must hydrate config from loaded local master rows');
assert(legacyAdapter.includes("const config = xmlCiiConfigWithLoadedMasterRows('XML->CII preview');"), 'Preview render/build must use hydrated master config');
assert(tabCss.includes('model-converters-workflow-run-actions'), 'Run phase must use popup-native action layout instead of inline legacy button styles');
assert(tabCss.includes('.model-converters-workflow-regex-field select'), 'Run phase select controls must use workflow field styling');
assert(tabCss.includes('span:not(.model-converters-workflow-run-status-icon)'), 'Run status row layout must not flex the icon column as the label');
assert(canonicalTab.includes('model-converters-css-fix.css'), 'ModelConvertersTab must defensively load supplemental layout CSS');

const tabBridgeImport = canonicalTab.match(/legacy-adapter\.js\?v=([^'"]+)/)?.[1] || '';
const publicTabImport = publicIndex.match(/ModelConvertersTab\.js\?v=([^'"]+)/)?.[1] || '';
assert(tabBridgeImport, 'ModelConvertersTab must import legacy adapter with a cache key');
assert(publicTabImport && publicTabImport.includes('20260623-inst-length-info-simple-run-1'), 'public index must use latest ModelConvertersTab cache key');

console.log('✅ XML CII phase-tab workflow popup static test passed', {
  topLevelTabs: 8,
  workflowMode: 'rich-popup-button-plus-simple-run-direct',
  branchNameSync: 'linelist.sampleBranchName',
  shiftedBranchPreview: 'lineKey/size/class guarded',
  weightMatchRating: 'manual override propagated',
  condenseRigid: 'XSD + Resolved split_condensed_valve_flange wired',
  instElementLength: 'ElementLengthMm for INST annotated',
  simpleRun: 'visible and direct',
  supplementalCss: 'model-converters-css-fix.css',
});
