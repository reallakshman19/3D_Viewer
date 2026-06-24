#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const legacyTabPath = path.join(repoRoot, 'viewer/tabs/model-converters-tab.js');
const canonicalTabPath = path.join(repoRoot, 'viewer/tabs/model-converters/ModelConvertersTab.js');
const buttonScopePath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js');
const workflowPopupPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-workflow-popup.js');
const workflowBridgePath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js');
const nativePanelsPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-popup-native-panels.js');
const simpleControllerPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js');
const runtimeOverrideSyncPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-runtime-override-sync.js');
const masterAutoloadLitePath = path.join(repoRoot, 'viewer/tabs/xml-cii-master-autoload-lite.js');
const oldPopupShimPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
const oldRichPopupShimPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js');

const legacyTabSource = fs.readFileSync(legacyTabPath, 'utf8');
const tabSource = fs.readFileSync(canonicalTabPath, 'utf8');
const buttonScopeSource = fs.readFileSync(buttonScopePath, 'utf8');
const workflowPopupSource = fs.readFileSync(workflowPopupPath, 'utf8');
const workflowBridgeSource = fs.readFileSync(workflowBridgePath, 'utf8');
const nativePanelsSource = fs.readFileSync(nativePanelsPath, 'utf8');
const simpleControllerSource = fs.readFileSync(simpleControllerPath, 'utf8');
const runtimeOverrideSyncSource = fs.readFileSync(runtimeOverrideSyncPath, 'utf8');
const masterAutoloadLiteSource = fs.readFileSync(masterAutoloadLitePath, 'utf8');
const oldPopupShimSource = fs.readFileSync(oldPopupShimPath, 'utf8');
const oldRichPopupShimSource = fs.readFileSync(oldRichPopupShimPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(/export\s*\{\s*renderModelConvertersTab\s*\}\s*from\s*['"]\.\/model-converters\/index\.js(?:\?[^'"]*)?['"]/.test(legacyTabSource), 'legacy shim must delegate renderModelConvertersTab to canonical model-converters entrypoint');
assert(/renderLegacyModelConvertersTab\(container, ctx\)/.test(tabSource), 'canonical model converter tab must render legacy adapter first');
assert(/scheduleInstallerQueue\(container\)/.test(tabSource), 'optional installers must be scheduled through a queue');
assert(/scheduleModelConverterTask/.test(tabSource), 'installer queue must use the non-timeout task scheduler');
assert(!/setTimeout\(run, 0\)/.test(tabSource), 'installer queue must not create one setTimeout per installer');
assert(!/setTimeout\(/.test(tabSource), 'ModelConvertersTab must not emit repeated setTimeout startup handlers');
assert(/requestIdleCallback/.test(tabSource), 'installer queue should prefer requestIdleCallback when available');
assert(/installSafely\(/.test(tabSource), 'optional installers must be guarded');
assert(/catch \(error\)/.test(tabSource), 'installer failures must be caught and logged');
assert(/Optional installer failed/.test(tabSource), 'installer failure log must identify optional installer errors');
assert(!/installXmlCiiSideloadUi/.test(tabSource), 'heavy XML CII sideload observer installer must not auto-run from Model Converter tab');
assert(!/installXmlCiiMatchedPreviewUi/.test(tabSource), 'heavy XML CII matched-preview observer installer must not auto-run from Model Converter tab');
assert(!/installXmlCiiConversionWorkflowPolish/.test(tabSource), 'workflow polish observer must not auto-run from Model Converter tab');

assert(/installXmlCiiDefaultMasterAutoloadLite/.test(tabSource), 'canonical tab must use the lightweight one-shot XML CII master autoload');
assert(!/installXmlCiiDefaultMasterAutoload[^L]/.test(tabSource), 'canonical tab must not install the legacy broad-listener master autoload');
assert(/xml-cii-master-autoload-lite\.js\?v=20260624-startup-autoload-noise-1/.test(tabSource), 'canonical tab must use the startup-noise cache key for lite master autoload');
assert(!/document\.addEventListener\('click'/.test(masterAutoloadLiteSource), 'lite master autoload must not schedule on every popup click/master tab click');
assert(!/document\.addEventListener\('input'/.test(masterAutoloadLiteSource), 'lite master autoload must not schedule on hidden config input churn');
assert(!/document\.addEventListener\('change'/.test(masterAutoloadLiteSource), 'lite master autoload must not schedule on every config/master change');
assert(!/Piping_class_master\.json/.test(masterAutoloadLiteSource), 'lite master autoload must not probe obsolete aggregate piping class master');
assert(/DEFAULT_MASTER_PATHS/.test(masterAutoloadLiteSource), 'lite master autoload must still define default material/weight master paths');

assert(/installXmlCiiWorkflowButtonScope/.test(tabSource), 'canonical tab must install the scoped workflow button host');
assert(/installXmlCiiWorkflowPopup/.test(tabSource), 'canonical tab must install the neutral Workflow 1/2 popup module');
assert(/installXmlCiiWorkflowHotfix/.test(tabSource), 'canonical tab must install the neutral workflow hotfix module');
assert(!/installXmlCiiRichWorkflowPopup/.test(tabSource), 'canonical tab must not install the old rich-prefixed popup module');
assert(!/installXmlCiiRichWorkflowHotfix/.test(tabSource), 'canonical tab must not install the old rich-prefixed hotfix module');
assert(!/installXmlCiiConversionWorkflowPopup/.test(tabSource), 'canonical tab must not install the old generic popup module');
assert(/xml-cii-workflow-popup\.js\?v=20260624-startup-autoload-noise-1/.test(tabSource), 'canonical tab must bump workflow popup import key for startup/autoload fix');
assert(/legacy-adapter\.js\?v=20260624-startup-autoload-noise-1/.test(tabSource), 'canonical tab must bump legacy adapter import key to flush stale default-master URL code');
assert(/xml-cii-runtime-override-sync\.js\?v=20260624-master-tab-responsive-1/.test(tabSource), 'canonical tab must keep runtime override sync responsiveness import key');

assert(/xmlCiiWorkflowButtonScopeSync/.test(buttonScopeSource), 'button scope must expose a sync function');
assert(/XML_CII_CONVERTER_ID\s*=\s*'xml_to_cii'/.test(buttonScopeSource), 'button scope must key workflow visibility from xml_to_cii converter id');
assert(/data-xml-cii-workflow-action-row/.test(buttonScopeSource), 'button scope must create a dedicated action row');
assert(/xmlCiiWorkflowButtonScopeCanonicalLauncher/.test(buttonScopeSource), 'button scope must canonicalize duplicate workflow launchers');
assert(/button\.remove\(\)/.test(buttonScopeSource), 'button scope must remove duplicate workflow launchers in the current root');
assert(/xmlCiiWorkflowButtonScopeRetireLegacyShell/.test(buttonScopeSource), 'button scope must retire the old dark workflow shell');
assert(/xmlCiiWorkflowButtonScopeIsXmlCiiSelected/.test(buttonScopeSource), 'button scope must toggle workflow visibility from the current selected converter');
assert(/model-converters-xml-cii-workflow1-btn/.test(buttonScopeSource), 'button scope must create a Workflow 1 launcher button');
assert(/model-converters-xml-cii-workflow2-btn/.test(buttonScopeSource), 'button scope must create a Workflow 2 launcher button');
assert(/XML->CII Workflow 1/.test(buttonScopeSource), 'left panel Workflow 1 launcher must be labelled XML->CII Workflow 1');
assert(/XML->CII Workflow 2/.test(buttonScopeSource), 'left panel Workflow 2 launcher must be labelled XML->CII Workflow 2');
assert(!/XML->CII Simple Workflow/.test(buttonScopeSource), 'left panel must not use Simple workflow naming');
assert(!/XML->CII Rich Workflow/.test(buttonScopeSource), 'left panel must not use Rich workflow naming');
assert(/xmlCiiWorkflowButtonScopeHideAdvancedOptions/.test(buttonScopeSource), 'button scope must hide generic XML CII advanced options from the left panel');
assert(/data-xml-cii-left-panel-options-hidden/.test(buttonScopeSource), 'advanced options must receive an explicit hidden marker for XML CII');
assert(!/xmlCiiWorkflowButtonScopePlaceAdvancedInSimpleCard/.test(buttonScopeSource), 'generic advanced options must not be moved into a workflow card');
assert(!/Simple\/direct workflow options/.test(buttonScopeSource), 'left panel must not show Simple/direct workflow options for XML CII');
assert(/xmlCiiWorkflowButtonScopeFreshLauncher/.test(buttonScopeSource), 'button scope must freshen workflow launchers to strip stale cached listeners');
assert(/cloneNode\(true\)/.test(buttonScopeSource), 'workflow launcher freshening must clone the element instead of preserving old anonymous listeners');
assert(/delete fresh\.dataset\.xmlCiiWorkflowPopupBound/.test(buttonScopeSource), 'fresh workflow launcher must force popup rebinding');
assert(!/new MutationObserver/.test(buttonScopeSource), 'button scope must not use a broad observer to chase UI mutations');

assert(/xmlCiiSimpleWorkflowRestoreRunButton/.test(simpleControllerSource), 'simple controller must keep a named restore function for non-XML CII converters');
assert(/xmlCiiSimpleWorkflowSelectedConverter/.test(simpleControllerSource), 'simple controller must inspect the selected converter before restoring direct run');
assert(/XML_CII_CONVERTER_ID/.test(simpleControllerSource), 'simple controller must know xml_to_cii is popup-only');
assert(/return null/.test(simpleControllerSource), 'simple controller must skip direct-run restore for XML CII');
assert(!/document\.querySelector\('#model-converters-run'\)/.test(simpleControllerSource), 'simple controller must not use a global run-button fallback');

assert(!/new MutationObserver/.test(workflowPopupSource), 'lean workflow popup launcher must not install MutationObserver');
assert(!/mountExistingPanel/.test(workflowPopupSource), 'lean workflow popup launcher must not move live panels by DOM portal');
assert(!/function interceptRun/.test(workflowPopupSource), 'workflow popup must not define old simple-run interception');
assert(!/document\.addEventListener\('click', interceptRun, true\)/.test(workflowPopupSource), 'workflow popup must not capture the legacy Run Conversion click');
assert(/XML->CII\(2019\) Workflow 1/.test(workflowPopupSource), 'Workflow 1 popup title must be explicit');
assert(/Import masters, map fields, inspect diagnostics, and run enriched CII conversion\./.test(workflowPopupSource), 'Workflow 1 popup subtitle must match the requested workflow identity');
assert(/XML->CII\(2019\) Workflow 2/.test(workflowPopupSource), 'Workflow 2 popup title must be explicit');
assert(/Import masters, map fields, and maintain manual overrides in a standalone-ready config\./.test(workflowPopupSource), 'Workflow 2 popup subtitle must match the requested workflow identity');
assert(/xmlCiiWorkflowBindLauncher\(container, 'workflow1'\)/.test(workflowPopupSource), 'popup module must bind the Workflow 1 launcher');
assert(/xmlCiiWorkflowBindLauncher\(container, 'workflow2'\)/.test(workflowPopupSource), 'popup module must bind the Workflow 2 launcher');
assert(/stopImmediatePropagation/.test(workflowPopupSource), 'workflow popup click handler must block stale cached popup listeners on the same click');
assert(/addEventListener\('click',[\s\S]*\{ capture: true \}\)/.test(workflowPopupSource), 'workflow popup click handler must bind in capture phase before old bubble listeners');
assert(/xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays/.test(workflowPopupSource), 'workflow popup must close duplicate legacy XML CII workflow overlays');
assert(!/restoreSimpleRunButton/.test(workflowPopupSource), 'workflow popup must not restore legacy direct Run Conversion visibility');
assert(!/__xmlCiiConversionWorkflowAllowDirectRun/.test(workflowPopupSource), 'workflow popup must not own direct-run flags');
assert(/data-xml-cii-workflow-root/.test(workflowPopupSource), 'workflow popup must scope installer state to the current model-converters root');
assert(/stateByRoot: new WeakMap\(\)/.test(workflowPopupSource), 'workflow popup must keep independent modal state per rendered root');
assert(!/if \(!xmlCiiWorkflowBrowserReady\(\) \|\| window\[XML_CII_WORKFLOW_POPUP_FLAG\]\) return/.test(workflowPopupSource), 'workflow popup must not use a stale global singleton guard that blocks re-render install');
assert(/xmlCiiWorkflowScheduleRenderPhase/.test(workflowPopupSource), 'workflow popup must schedule heavy phase/master rerenders outside click/change handlers');
assert(/requestAnimationFrame\(\(\) =>/.test(workflowPopupSource), 'workflow popup scheduled rendering must use requestAnimationFrame');
assert(/Switching master table/.test(workflowPopupSource), 'master-tab clicks must use the scheduled lightweight switching path');

assert(/ensureDefaultMastersLoaded = async \(\) => null/.test(workflowBridgeSource), 'workflow bridge must block obsolete legacy default-master preload');
assert(/masterKey === 'pipingClass'/.test(workflowBridgeSource), 'workflow bridge must block obsolete aggregate piping-class default load');
assert(/sanitizeSnapshot/.test(workflowBridgeSource), 'workflow bridge must sanitize stale default URLs from popup snapshots');
assert(/legacy-adapter\.js\?v=20260624-startup-autoload-noise-1/.test(workflowBridgeSource), 'workflow bridge must bump legacy adapter cache key');
assert(/XML_CII_WORKFLOW_SNAPSHOT_TTL_MS/.test(workflowBridgeSource), 'workflow bridge must cache popup snapshots to avoid rebuilding all master metadata on every tab click');
assert(/safe\.getPopupSnapshot = \(root\) => cachedSnapshot/.test(workflowBridgeSource), 'workflow bridge must wrap getPopupSnapshot with cache');
assert(/clearSnapshotCache/.test(workflowBridgeSource), 'workflow bridge must invalidate cached snapshots after master/config mutations');
assert(/master\.key === 'pipingClass'/.test(nativePanelsSource), 'native panels must disable default loading for piping-class master');
assert(/data-xml-cii-workflow2-master-preview/.test(nativePanelsSource), 'Workflow 2 must expose enhanced per-master preview rows');
assert(/Workflow 1 keeps master setup compact/.test(nativePanelsSource), 'Workflow 1 must use the compact master sequence');
assert(/Condense Rigid \/ split condensed valve-flange nodes \(XSD\)/.test(nativePanelsSource), 'Run Options must show Condense Rigid XSD in both workflows');
assert(/Condense Rigid \/ split condensed valve-flange nodes \(Resolved\)/.test(nativePanelsSource), 'Run Options must show Condense Rigid Resolved in both workflows');

assert(!/root\.addEventListener\('change'/.test(runtimeOverrideSyncSource), 'runtime override sync must not install broad capture-phase change handler');
assert(!/document\?\.querySelector\?\.\('\[data-option-key="supportConfigJson"\]'\)/.test(runtimeOverrideSyncSource), 'runtime override sync must not use global hidden supportConfigJson fallback');
assert(/explicit preview\/weight\/run actions/.test(runtimeOverrideSyncSource), 'runtime override sync must document explicit-action-only behavior');
assert(/data-native-build-preview/.test(runtimeOverrideSyncSource), 'runtime override sync must still sync before popup preview actions');
assert(/data-native-finalise-run/.test(runtimeOverrideSyncSource), 'runtime override sync must still sync before final workflow run');

assert(/Deprecated compatibility shim/.test(oldPopupShimSource), 'old generic popup filename must be a compatibility shim only');
assert(!/restoreSimpleRunButton/.test(oldPopupShimSource), 'old generic popup shim must not restore simple Run Conversion visibility');
assert(/Deprecated compatibility shim/.test(oldRichPopupShimSource), 'old rich popup filename must be a compatibility shim only');
assert(/installXmlCiiWorkflowPopup as installXmlCiiRichWorkflowPopup/.test(oldRichPopupShimSource), 'old rich popup shim must re-export the neutral workflow popup installer');

console.log('model converters tab lean responsiveness static test passed', {
  xmlCiiLeftPanel: 'popup-only: Workflow 1 + Workflow 2, no generic advanced options',
  workflow1: 'baseline enriched conversion workflow popup',
  workflow2: 'enhanced customization workflow popup with per-master preview rows',
  masterTabResponsiveness: 'scheduled popup rendering + cached bridge snapshot + explicit runtime override sync',
  startupNoise: 'no per-installer setTimeout loop + one-shot lite master autoload',
});
