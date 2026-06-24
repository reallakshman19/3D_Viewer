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

assert(/xml-cii-workflow-button-scope\.js\?v=20260624-workflow-consolidation-1/.test(source.tab), 'button scope must use consolidation cache key');
assert(/xml-cii-workflow-popup\.js\?v=20260624-workflow-consolidation-1/.test(source.tab), 'workflow popup must use consolidation cache key');
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

assert(!/new MutationObserver/.test(source.workflowPopup), 'lean workflow popup launcher must not install MutationObserver');
assert(!/function interceptRun/.test(source.workflowPopup), 'workflow popup must not define old simple-run interception');
assert(!/document\.addEventListener\('click', interceptRun, true\)/.test(source.workflowPopup), 'workflow popup must not capture the legacy Run Conversion click');
assert(/XML->CII\(2019\) Workflow 1/.test(source.workflowPopup), 'Workflow 1 popup title must be explicit');
assert(/XML->CII\(2019\) Workflow 2/.test(source.workflowPopup), 'Workflow 2 popup title must be explicit');
assert(/xmlCiiWorkflowBindLauncher\(container, 'workflow1'\)/.test(source.workflowPopup), 'popup module must bind the Workflow 1 launcher');
assert(/xmlCiiWorkflowBindLauncher\(container, 'workflow2'\)/.test(source.workflowPopup), 'popup module must bind the Workflow 2 launcher');
assert(/stopImmediatePropagation/.test(source.workflowPopup), 'workflow popup click handler must block stale cached popup listeners on the same click');
assert(/xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays/.test(source.workflowPopup), 'workflow popup must close duplicate legacy XML CII workflow overlays');
assert(/xmlCiiWorkflowScheduleRenderPhase/.test(source.workflowPopup), 'workflow popup must schedule heavy phase/master rerenders outside click/change handlers');
assert(/requestAnimationFrame\(\(\) =>/.test(source.workflowPopup), 'workflow popup scheduled rendering must use requestAnimationFrame');

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
assert(/Deprecated compatibility shim/.test(source.oldRichPopupShim), 'old rich popup filename must be a compatibility shim only');
assert(/installXmlCiiWorkflowPopup as installXmlCiiRichWorkflowPopup/.test(source.oldRichPopupShim), 'old rich popup shim must re-export the neutral workflow popup installer');

console.log('model converters tab XML CII workflow consolidation guard passed', {
  xmlCiiLeftPanel: 'popup-only: Workflow 1 + Workflow 2, no generic advanced options',
  activePatchModules: 'removed from ModelConvertersTab active import path',
  masterTabResponsiveness: 'scheduled popup rendering + cached bridge snapshot + explicit runtime override sync',
  startupNoise: 'no repeated startup repair setTimeout loops in XML CII shell/button/simple/branch services',
});
