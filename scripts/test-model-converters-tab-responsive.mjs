#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

const files = {
  legacyShim: 'viewer/tabs/model-converters-tab.js',
  tab: 'viewer/tabs/model-converters/ModelConvertersTab.js',
  buttonScope: 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js',
  workflow1Popup: 'viewer/tabs/model-converters/xml-cii-workflow-popup.js',
  workflow2Popup: 'viewer/tabs/model-converters/xml-cii-workflow2-popup.js',
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

assert(/export\s*\{\s*renderModelConvertersTab\s*\}\s*from\s*['"]\.\/model-converters\/index\.js(?:\?[^'"]*)?['"]/.test(source.legacyShim), 'legacy shim must delegate renderModelConvertersTab to canonical model-converters entrypoint');
assert(/renderLegacyModelConvertersTab\(container, ctx\)/.test(source.tab), 'canonical model converter tab must render legacy adapter first');
assert(/scheduleInstallerQueue\(container\)/.test(source.tab), 'optional installers must be scheduled through one guarded queue');
assert(/requestIdleCallback/.test(source.tab), 'installer queue should prefer requestIdleCallback when available');
assert(!/setTimeout\(/.test(source.tab), 'ModelConvertersTab must not emit repeated setTimeout startup handlers');

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
  assert(!source.tab.includes(token), `canonical tab must not actively import/install ${token}`);
}

assert(/xml-cii-workflow-button-scope\.js\?v=20260624-workflow2-standalone-1/.test(source.tab), 'button scope must use Workflow 2 standalone cache key');
assert(/xml-cii-workflow-popup\.js\?v=20260624-workflow2-standalone-1/.test(source.tab), 'Workflow 1 popup must use standalone cache key');
assert(/xml-cii-workflow2-popup\.js\?v=20260624-workflow2-standalone-1/.test(source.tab), 'Workflow 2 popup must be imported as a standalone module');
assert(/installXmlCiiWorkflow2Popup/.test(source.tab), 'canonical tab must install standalone Workflow 2 popup');
assert(/xml-cii-branch-sample-sync\.js\?v=20260624-workflow-consolidation-1/.test(source.tab), 'branch sample service must use consolidation cache key');
assert(/installXmlCiiDefaultMasterAutoloadLite/.test(source.tab), 'canonical tab must keep lightweight one-shot XML CII master autoload');
assert(!/installXmlCiiDefaultMasterAutoload[^L]/.test(source.tab), 'canonical tab must not install the legacy broad-listener master autoload');

assert(/xmlCiiWorkflowButtonScopeSync/.test(source.buttonScope), 'button scope must expose a sync function');
assert(/XML_CII_CONVERTER_ID\s*=\s*'xml_to_cii'/.test(source.buttonScope), 'button scope must key workflow visibility from xml_to_cii converter id');
assert(/model-converters-xml-cii-workflow1-btn/.test(source.buttonScope), 'button scope must create a Workflow 1 launcher button');
assert(/model-converters-xml-cii-workflow2-btn/.test(source.buttonScope), 'button scope must create a Workflow 2 launcher button');
assert(/XML->CII Workflow 1/.test(source.buttonScope), 'left panel Workflow 1 launcher must be labelled XML->CII Workflow 1');
assert(/XML->CII Workflow 2/.test(source.buttonScope), 'left panel Workflow 2 launcher must be labelled XML->CII Workflow 2');
assert(/xmlCiiWorkflowButtonScopeHideAdvancedOptions/.test(source.buttonScope), 'button scope must hide generic XML CII advanced options from the left panel');
assert(!/new MutationObserver/.test(source.buttonScope), 'button scope must not use a broad observer to chase UI mutations');
assert(!/setTimeout\(/.test(source.buttonScope), 'button scope must not schedule repeated delayed startup repairs');

assert(/xmlCiiSimpleWorkflowRestoreRunButton/.test(source.simpleController), 'simple controller must keep a named restore function for non-XML CII converters');
assert(/XML_CII_CONVERTER_ID/.test(source.simpleController), 'simple controller must know xml_to_cii is popup-only');
assert(/return null/.test(source.simpleController), 'simple controller must skip direct-run restore for XML CII');
assert(!/setTimeout\(/.test(source.simpleController), 'simple controller must not schedule repeated delayed direct-run repairs');
assert(!/document\.querySelector\('#model-converters-run'\)/.test(source.simpleController), 'simple controller must not use a global run-button fallback');

assert(!/new MutationObserver/.test(source.workflow1Popup), 'Workflow 1 popup must not install MutationObserver');
assert(!/function interceptRun/.test(source.workflow1Popup), 'Workflow 1 popup must not define old simple-run interception');
assert(!/document\.addEventListener\('click', interceptRun, true\)/.test(source.workflow1Popup), 'Workflow 1 popup must not capture the legacy Run Conversion click');
assert(/XML->CII\(2019\) Workflow 1/.test(source.workflow1Popup), 'Workflow 1 popup title must be explicit');
assert(!/XML->CII\(2019\) Workflow 2/.test(source.workflow1Popup), 'Workflow 1 popup module must not own Workflow 2 title');
assert(!/model-converters-xml-cii-workflow2-btn/.test(source.workflow1Popup), 'Workflow 1 popup module must not bind Workflow 2 launcher');
assert(/WF1_RUNTIME_KEY/.test(source.workflow1Popup), 'Workflow 1 popup must have its own runtime key');
assert(/stopImmediatePropagation/.test(source.workflow1Popup), 'Workflow 1 click handler must block stale cached popup listeners on the same click');
assert(/closeOtherXmlCiiWorkflowOverlays/.test(source.workflow1Popup), 'Workflow 1 popup must close duplicate legacy XML CII workflow overlays');
assert(/scheduleRender/.test(source.workflow1Popup), 'Workflow 1 popup must schedule heavy phase/master rerenders outside click/change handlers');
assert(/requestAnimationFrame/.test(source.workflow1Popup), 'Workflow 1 scheduled rendering must use requestAnimationFrame when available');
assert(/renderError/.test(source.workflow1Popup), 'Workflow 1 popup must surface render errors instead of making tabs look inert');

assert(!/new MutationObserver/.test(source.workflow2Popup), 'Workflow 2 popup must not install MutationObserver');
assert(/XML->CII\(2019\) Workflow 2/.test(source.workflow2Popup), 'Workflow 2 popup title must be explicit');
assert(!/XML->CII\(2019\) Workflow 1/.test(source.workflow2Popup), 'Workflow 2 popup module must not own Workflow 1 title');
assert(/WF2_RUNTIME_KEY/.test(source.workflow2Popup), 'Workflow 2 popup must have its own runtime key');
assert(/WF2_LAUNCHER_SELECTOR/.test(source.workflow2Popup), 'Workflow 2 popup must own its launcher selector');
assert(/model-converters-xml-cii-workflow2-btn/.test(source.workflow2Popup), 'Workflow 2 popup must bind the Workflow 2 launcher');
assert(!/model-converters-xml-cii-workflow1-btn/.test(source.workflow2Popup), 'Workflow 2 popup module must not bind Workflow 1 launcher');
assert(/data-xml-cii-workflow-mode', 'workflow2'/.test(source.workflow2Popup), 'Workflow 2 popup must stamp workflow2 mode on its modal body');
assert(/Enhanced workflow for process-data and weight-data customisation/.test(source.workflow2Popup), 'Workflow 2 popup subtitle must describe restored rich UI purpose');
assert(/installXmlCiiWorkflow2Popup/.test(source.workflow2Popup), 'Workflow 2 popup must export its own installer');
assert(/stopImmediatePropagation/.test(source.workflow2Popup), 'Workflow 2 click handler must block stale cached popup listeners on the same click');
assert(/closeOtherXmlCiiWorkflowOverlays/.test(source.workflow2Popup), 'Workflow 2 popup must close duplicate legacy XML CII workflow overlays');
assert(/scheduleRender/.test(source.workflow2Popup), 'Workflow 2 popup must schedule heavy phase/master rerenders outside click/change handlers');
assert(/requestAnimationFrame/.test(source.workflow2Popup), 'Workflow 2 scheduled rendering must use requestAnimationFrame when available');
assert(/renderError/.test(source.workflow2Popup), 'Workflow 2 popup must surface render errors instead of making tabs look inert');

assert(/data-modal-tabs/.test(source.workflowModal), 'workflow modal must expose a stable tab host');
assert(/tabHost\.addEventListener\('click'/.test(source.workflowModal), 'workflow modal must delegate phase tab clicks from the tab host');
assert(/data-modal-tab/.test(source.workflowModal), 'workflow modal delegated handler must target data-modal-tab buttons');

assert(/ensureDefaultMastersLoaded = async \(\) => null/.test(source.workflowBridge), 'workflow bridge must block obsolete legacy default-master preload');
assert(/masterKey === 'pipingClass'/.test(source.workflowBridge), 'workflow bridge must block obsolete aggregate piping-class default load');
assert(/sanitizeSnapshot/.test(source.workflowBridge), 'workflow bridge must sanitize stale default URLs from popup snapshots');
assert(/XML_CII_WORKFLOW_SNAPSHOT_TTL_MS/.test(source.workflowBridge), 'workflow bridge must cache popup snapshots to avoid rebuilding all master metadata on every tab click');
assert(/hydrateCondenseSnapshot/.test(source.workflowBridge), 'workflow bridge must own Condense Rigid run/config hydration');
assert(/mergeCondenseBoolKeys/.test(source.workflowBridge), 'workflow bridge must persist XSD and Resolved condense aliases together');
assert(!/xml-cii-condense-rigid-ui-bridge/.test(source.workflowBridge), 'workflow bridge must not depend on the old condense wrapper module');

assert(/master\.key === 'pipingClass'/.test(source.nativePanels), 'native panels must disable default loading for piping-class master');
assert(/data-xml-cii-workflow2-master-preview/.test(source.nativePanels), 'Workflow 2 must expose enhanced per-master preview rows');
assert(/Workflow 1 keeps master setup compact/.test(source.nativePanels), 'Workflow 1 must use the compact master sequence');
assert(/Condense Rigid \/ split condensed valve-flange nodes \(XSD\)/.test(source.nativePanels), 'Run Options must show Condense Rigid XSD in both workflows');
assert(/Condense Rigid \/ split condensed valve-flange nodes \(Resolved\)/.test(source.nativePanels), 'Run Options must show Condense Rigid Resolved in both workflows');

assert(!/new MutationObserver/.test(source.branchSample), 'branch sample service must not observe the whole document');
assert(!/setTimeout\(/.test(source.branchSample), 'branch sample service must not use delayed startup repair loops');
assert(!/supportConfigJson/.test(source.branchSample), 'branch sample service must not serialize hidden supportConfigJson');
assert(!/dispatchEvent/.test(source.branchSample), 'branch sample service must not dispatch synthetic input/change churn');
assert(/syncLoadedXmlCiiBranchSample/.test(source.branchSample), 'branch sample service must expose explicit XML file sync');

assert(!/root\.addEventListener\('change'/.test(source.runtimeOverrideSync), 'runtime override sync must not install broad capture-phase change handler');
assert(/explicit preview\/weight\/run actions/.test(source.runtimeOverrideSync), 'runtime override sync must document explicit-action-only behavior');
assert(/data-native-build-preview/.test(source.runtimeOverrideSync), 'runtime override sync must still sync before popup preview actions');
assert(/data-native-finalise-run/.test(source.runtimeOverrideSync), 'runtime override sync must still sync before final workflow run');

assert(!/document\.addEventListener\('click'/.test(source.masterAutoloadLite), 'lite master autoload must not schedule on every popup click/master tab click');
assert(!/document\.addEventListener\('input'/.test(source.masterAutoloadLite), 'lite master autoload must not schedule on hidden config input churn');
assert(!/document\.addEventListener\('change'/.test(source.masterAutoloadLite), 'lite master autoload must not schedule on every config/master change');
assert(!/Piping_class_master\.json/.test(source.masterAutoloadLite), 'lite master autoload must not probe obsolete aggregate piping class master');
assert(/DEFAULT_MASTER_PATHS/.test(source.masterAutoloadLite), 'lite master autoload must still define default material/weight master paths');

assert(/Deprecated compatibility shim/.test(source.oldPopupShim), 'old generic popup filename must be a compatibility shim only');
assert(!/restoreSimpleRunButton/.test(source.oldPopupShim), 'old generic popup shim must not restore simple Run Conversion visibility');
assert(/xml-cii-workflow-popup\.js\?v=20260624-workflow2-standalone-1/.test(source.oldPopupShim), 'old generic popup shim must re-export standalone Workflow 1 popup');
assert(/Deprecated compatibility shim/.test(source.oldRichPopupShim), 'old rich popup filename must be a compatibility shim only');
assert(/xml-cii-workflow2-popup\.js\?v=20260624-workflow2-standalone-1/.test(source.oldRichPopupShim), 'old rich popup shim must re-export standalone Workflow 2 popup');

console.log('model converters tab XML CII workflow consolidation guard passed', {
  xmlCiiLeftPanel: 'popup-only: Workflow 1 + Workflow 2, no generic advanced options',
  workflowPopupOwnership: 'Workflow 1 and Workflow 2 have separate popup controllers and runtime keys',
  activePatchModules: 'removed from ModelConvertersTab active import path',
  clickReliability: 'separate root launcher clicks + delegated modal phase tabs',
  masterTabResponsiveness: 'scheduled popup rendering + cached bridge snapshot + explicit runtime override sync',
  startupNoise: 'no repeated startup repair setTimeout loops in XML CII shell/button/simple/branch services',
});
