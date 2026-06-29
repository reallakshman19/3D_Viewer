#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

const files = {
  legacyShim: 'viewer/tabs/model-converters-tab.js',
  tab: 'viewer/tabs/model-converters/ModelConvertersTab.js',
  buttonScope: 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
  workflowPopup: 'viewer/tabs/model-converters/xml-cii-workflow-popup.js',
  workflowModal: 'viewer/tabs/model-converters/shared/WorkflowModal.js',
  workflowBridge: 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js',
  nativePanels: 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js',
  simpleController: 'viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js',
  branchSample: 'viewer/tabs/model-converters/xml-cii-branch-sample-sync.js',
  runtimeOverrideSync: 'viewer/tabs/model-converters/xml-cii-runtime-override-sync.js',
  masterAutoloadLite: 'viewer/tabs/xml-cii-master-autoload-lite.js',
  oldPopupShim: 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js',
  oldRichPopupShim: 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js',
};

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function assertNotIncludes(haystack, needle, message) {
  assert(!haystack.includes(needle), message);
}

assert(source.legacyShim.includes("MODEL_CONVERTERS_SHIM_VERSION = '20260629-model-converters-lazy-render-guard-1'"), 'legacy shim must expose the lazy render guard version');
assert(source.legacyShim.includes('import(CANONICAL_MODULE)'), 'legacy shim must lazy-load the canonical model-converters entrypoint');
assert(source.legacyShim.includes('renderLegacyFallback'), 'legacy shim must preserve a legacy fallback path');
assertNotIncludes(source.legacyShim, 'export { renderModelConvertersTab } from', 'legacy shim must not statically re-export the deep renderer chain');
assert(source.tab.includes('renderLegacyModelConvertersTab(container, ctx)'), 'canonical model converter tab must render legacy adapter first');
assert(source.tab.includes('scheduleInstallerQueue(container)'), 'optional installers must be scheduled through one guarded queue');
assert(source.tab.includes('requestIdleCallback'), 'installer queue should prefer requestIdleCallback when available');
assertNotIncludes(source.tab, 'setTimeout(', 'ModelConvertersTab must not emit repeated setTimeout startup handlers');

for (const token of [
  'xml-cii-workflow-hotfix',
  'installXmlCiiWorkflowHotfix',
  'xml-cii-condense-rigid-ui-bridge',
  'installXmlCiiCondenseRigidUiBridge',
  'xml-cii-linekey-select-patch',
  'installXmlCiiLineKeySelectPatch',
  'xml-cii-master-autoload-patch',
  'installXmlCiiRecoveryPatch',
  'xml-cii-master-preserve-patch',
  'installXmlCiiMasterPreservePatch',
]) {
  assertNotIncludes(source.tab, token, `canonical tab must not actively import/install ${token}`);
}

assert(source.tab.includes('xml-cii-workflow-button-scope.js?v=20260624-unified-wf2-1'), 'button scope must use unified WF2 cache key');
assert(source.tab.includes('xml-cii-workflow-popup.js?v=20260625-service-1'), 'workflow popup must use service cache key');
assert(source.tab.includes('xml-cii-branch-sample-sync.js?v=20260624-workflow-consolidation-1'), 'branch sample service must use consolidation cache key');
assert(source.tab.includes('installXmlCiiDefaultMasterAutoloadLite'), 'canonical tab must keep lightweight one-shot XML CII master autoload');
assert(!/installXmlCiiDefaultMasterAutoload[^L]/.test(source.tab), 'canonical tab must not install the legacy broad-listener master autoload');

assert(source.buttonScope.includes('xmlCiiWorkflowButtonScopeSync'), 'button scope must expose a sync function');
assert(source.buttonScope.includes("XML_CII_CONVERTER_ID = 'xml_to_cii'"), 'button scope must key workflow visibility from xml_to_cii converter id');
assert(source.buttonScope.includes('model-converters-xml-cii-workflow-btn'), 'button scope must create the unified workflow launcher button');
assert(source.buttonScope.includes('data-xml-cii-unified-workflow-launcher'), 'button scope must mark the unified workflow launcher');
assert(source.buttonScope.includes('XML->CII Workflow'), 'left panel unified launcher must be labelled XML->CII Workflow');
assertNotIncludes(source.buttonScope, 'XML->CII Workflow 1', 'left panel must not show retired Workflow 1 label');
assertNotIncludes(source.buttonScope, 'XML->CII Workflow 2', 'left panel must not show retired Workflow 2 label');
assert(source.buttonScope.includes('xmlCiiWorkflowButtonScopeHideAdvancedOptions'), 'button scope must hide generic XML CII advanced options from the left panel');
assertNotIncludes(source.buttonScope, 'new MutationObserver', 'button scope must not use a broad observer to chase UI mutations');
assertNotIncludes(source.buttonScope, 'setTimeout(', 'button scope must not schedule repeated delayed startup repairs');

assert(source.simpleController.includes('xmlCiiSimpleWorkflowRestoreRunButton'), 'simple controller must keep a named restore function for non-XML CII converters');
assert(source.simpleController.includes('XML_CII_CONVERTER_ID'), 'simple controller must know xml_to_cii is popup-only');
assert(source.simpleController.includes('return null'), 'simple controller must skip direct-run restore for XML CII');
assertNotIncludes(source.simpleController, 'setTimeout(', 'simple controller must not schedule repeated delayed direct-run repairs');
assertNotIncludes(source.simpleController, "document.querySelector('#model-converters-run')", 'simple controller must not use a global run-button fallback');

assertNotIncludes(source.workflowPopup, 'new MutationObserver', 'lean workflow popup launcher must not install MutationObserver');
assertNotIncludes(source.workflowPopup, 'function interceptRun', 'workflow popup must not define old simple-run interception');
assertNotIncludes(source.workflowPopup, "document.addEventListener('click', interceptRun, true)", 'workflow popup must not capture the legacy Run Conversion click');
assert(source.workflowPopup.includes('XML->CII(2019) Workflow'), 'unified popup title must be explicit');
assertNotIncludes(source.workflowPopup, 'XML->CII(2019) Workflow 1', 'popup must not expose retired Workflow 1 title');
assertNotIncludes(source.workflowPopup, 'XML->CII(2019) Workflow 2', 'popup must not expose retired Workflow 2 title');
assert(source.workflowPopup.includes('xmlCiiWorkflowRenderBridgePhase'), 'popup must prefer the robust bridge phase renderer');
assert(source.workflowPopup.includes('bridge.renderPhaseInto'), 'popup must use renderPhaseInto for WF2 features');
assert(source.workflowPopup.includes("state?.phaseId === 'custom-input'"), 'popup must bypass legacy bridge rendering for Custom Input');
assert(source.workflowPopup.includes('renderXmlCiiCustomInputPanel'), 'popup must render Custom Input directly');
assert(source.workflowPopup.includes('bindXmlCiiCustomInputPanel'), 'popup must bind Custom Input actions directly');
assert(source.workflowPopup.includes("state.mode = 'unified'"), 'popup open state must use unified workflow mode');
assert(source.workflowPopup.includes('xmlCiiWorkflowBindDelegatedLauncher'), 'popup module must delegate launcher clicks from the stable model-converters root');
assert(source.workflowPopup.includes('XML_CII_WORKFLOW_DELEGATED_DATASET_KEY'), 'delegated launcher binding must be installed once per root');
assert(source.workflowPopup.includes('data-xml-cii-workflow-launcher'), 'delegated launcher binding must catch future-created unified workflow buttons');
assert(source.workflowPopup.includes('data-xml-cii-unified-workflow-launcher'), 'delegated launcher binding must catch the explicit unified workflow button');
assert(source.workflowPopup.includes('WorkflowModal.js?v=20260624-workflow-tabs-fix-1'), 'workflow popup must cache-bust the modal delegated-tab implementation');
assert(source.workflowPopup.includes('xml-cii-popup-native-panels.js?v=20260625-service-1'), 'workflow popup must cache-bust the service native fallback renderer');
assert(source.workflowPopup.includes('xmlCiiWorkflowBindLauncher(container)'), 'popup module must keep direct unified launcher binding for existing buttons');
assertNotIncludes(source.workflowPopup, "xmlCiiWorkflowBindLauncher(container, 'workflow1')", 'popup module must not keep direct Workflow 1 launcher binding');
assertNotIncludes(source.workflowPopup, "xmlCiiWorkflowBindLauncher(container, 'workflow2')", 'popup module must not keep direct Workflow 2 launcher binding');
assert(source.workflowPopup.includes('stopImmediatePropagation'), 'workflow popup click handler must block stale cached popup listeners on the same click');
assert(source.workflowPopup.includes('xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays'), 'workflow popup must close duplicate legacy XML CII workflow overlays');
assert(source.workflowPopup.includes('xmlCiiWorkflowScheduleRenderPhase'), 'workflow popup must schedule heavy phase/master rerenders outside click/change handlers');
assert(source.workflowPopup.includes('requestAnimationFrame'), 'workflow popup scheduled rendering must use requestAnimationFrame when available');
assert(source.workflowPopup.includes('xmlCiiWorkflowRenderError'), 'workflow popup must surface render errors instead of making tabs look inert');

assert(source.workflowModal.includes('data-modal-tabs'), 'workflow modal must expose a stable tab host');
assert(source.workflowModal.includes("tabHost.addEventListener('click'"), 'workflow modal must delegate phase tab clicks from the tab host');
assert(source.workflowModal.includes('data-modal-tab'), 'workflow modal delegated handler must target data-modal-tab buttons');

assert(source.workflowBridge.includes('ensureDefaultMastersLoaded = async () => null'), 'workflow bridge must block obsolete legacy default-master preload');
assert(source.workflowBridge.includes('legacy-adapter.js?v=20260625-service-1'), 'workflow bridge must cache-bust the service legacy adapter');
assert(source.workflowBridge.includes("masterKey === 'pipingClass'"), 'workflow bridge must block obsolete aggregate piping-class default load');
assert(source.workflowBridge.includes('sanitizeSnapshot'), 'workflow bridge must sanitize stale default URLs from popup snapshots');
assert(source.workflowBridge.includes('XML_CII_WORKFLOW_SNAPSHOT_TTL_MS'), 'workflow bridge must cache popup snapshots to avoid rebuilding all master metadata on every tab click');
assert(source.workflowBridge.includes('hydrateCondenseSnapshot'), 'workflow bridge must own Condense Rigid run/config hydration');
assert(source.workflowBridge.includes('mergeCondenseBoolKeys'), 'workflow bridge must persist XSD and Resolved condense aliases together');
assertNotIncludes(source.workflowBridge, 'xml-cii-condense-rigid-ui-bridge', 'workflow bridge must not depend on the old condense wrapper module');

assert(source.nativePanels.includes("master.key === 'pipingClass'"), 'native panels must disable default loading for piping-class master');
assert(source.nativePanels.includes('data-xml-cii-unified-master-preview'), 'fallback popup must expose enhanced per-master preview rows');
assertNotIncludes(source.nativePanels, 'Workflow 1 keeps master setup compact', 'fallback popup must not show retired Workflow 1 compact wording');
assertNotIncludes(source.nativePanels, 'Workflow 1 / Workflow 2', 'fallback popup config notes must not expose retired dual-workflow wording');
assert(source.nativePanels.includes('Record source/XSD condensed rigid intent'), 'Run Options must show source/XSD condensed rigid intent in both workflows');
assert(source.nativePanels.includes('Apply resolved split for condensed valve/flange/rigid nodes'), 'Run Options must show resolved condensed split action in both workflows');
assert(source.nativePanels.includes('Suppress CII support tag/name labels'), 'Config must clarify support tag and support-kind NODENAME suppression');
assert(source.nativePanels.includes('Use JSON Trace staged source'), 'native Preview panel must expose JSON Trace staged-source toggle');

assertNotIncludes(source.branchSample, 'new MutationObserver', 'branch sample service must not observe the whole document');
assertNotIncludes(source.branchSample, 'setTimeout(', 'branch sample service must not use delayed startup repair loops');
assertNotIncludes(source.branchSample, 'supportConfigJson', 'branch sample service must not serialize hidden supportConfigJson');
assertNotIncludes(source.branchSample, 'dispatchEvent', 'branch sample service must not dispatch synthetic input/change churn');
assert(source.branchSample.includes('syncLoadedXmlCiiBranchSample'), 'branch sample service must expose explicit XML file sync');

assertNotIncludes(source.runtimeOverrideSync, "root.addEventListener('change'", 'runtime override sync must not install broad capture-phase change handler');
assert(source.runtimeOverrideSync.includes('explicit preview/weight/run actions'), 'runtime override sync must document explicit-action-only behavior');
assert(source.runtimeOverrideSync.includes('data-native-build-preview'), 'runtime override sync must still sync before popup preview actions');
assert(source.runtimeOverrideSync.includes('data-native-finalise-run'), 'runtime override sync must still sync before final workflow run');

assertNotIncludes(source.masterAutoloadLite, "document.addEventListener('click'", 'lite master autoload must not schedule on every popup click/master tab click');
assertNotIncludes(source.masterAutoloadLite, "document.addEventListener('input'", 'lite master autoload must not schedule on hidden config input churn');
assertNotIncludes(source.masterAutoloadLite, "document.addEventListener('change'", 'lite master autoload must not schedule on every config/master change');
assertNotIncludes(source.masterAutoloadLite, 'Piping_class_master.json', 'lite master autoload must not probe obsolete aggregate piping class master');
assert(source.masterAutoloadLite.includes('DEFAULT_MASTER_PATHS'), 'lite master autoload must still define default material/weight master paths');

assert(source.oldPopupShim.includes('Deprecated compatibility shim'), 'old generic popup filename must be a compatibility shim only');
assertNotIncludes(source.oldPopupShim, 'restoreSimpleRunButton', 'old generic popup shim must not restore simple Run Conversion visibility');
assert(source.oldRichPopupShim.includes('Deprecated compatibility shim'), 'old rich popup filename must be a compatibility shim only');
assert(source.oldRichPopupShim.includes('installXmlCiiWorkflowPopup as installXmlCiiRichWorkflowPopup'), 'old rich popup shim must re-export the neutral workflow popup installer');

console.log('model converters tab XML CII workflow consolidation guard passed', {
  xmlCiiLeftPanel: 'popup-only unified workflow, no generic advanced options',
  activePatchModules: 'removed from ModelConvertersTab active import path',
  clickReliability: 'delegated root launcher clicks + delegated modal phase tabs',
  masterTabResponsiveness: 'scheduled popup rendering + cached bridge snapshot + explicit runtime override sync',
  startupNoise: 'no repeated startup repair setTimeout loops in XML CII shell/button/simple/branch services',
});
