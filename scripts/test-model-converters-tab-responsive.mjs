#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

const shim = read('viewer/tabs/model-converters-tab.js');
const tab = read('viewer/tabs/model-converters/ModelConvertersTab.js');
const buttonScope = read('viewer/tabs/model-converters/xml-cii-workflow-button-scope.js');
const simpleController = read('viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js');
const branchSample = read('viewer/tabs/model-converters/xml-cii-branch-sample-sync.js');
const masterAutoloadLite = read('viewer/tabs/xml-cii-master-autoload-lite.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function assertNotIncludes(source, token, message) {
  assert(!source.includes(token), message);
}

assert(shim.includes("MODEL_CONVERTERS_SHIM_VERSION = '20260629-model-converters-lazy-render-guard-1'"), 'model-converters shim must expose the lazy render guard version');
assert(shim.includes('import(CANONICAL_MODULE)'), 'model-converters shim must lazy-load the canonical renderer');
assert(shim.includes('renderLegacyFallback'), 'model-converters shim must preserve a legacy fallback path');
assert(shim.includes('renderDiagnostic'), 'model-converters shim must render an in-tab diagnostic on total load failure');
assertNotIncludes(shim, 'export { renderModelConvertersTab } from', 'model-converters shim must not statically re-export the deep module chain');

assert(tab.includes('renderLegacyModelConvertersTab(container, ctx)'), 'canonical model converter tab must render legacy adapter first');
assert(tab.includes('scheduleInstallerQueue(container)'), 'optional installers must be scheduled through one guarded queue');
assert(tab.includes('requestIdleCallback'), 'installer queue should prefer requestIdleCallback when available');
assertNotIncludes(tab, 'setTimeout(', 'ModelConvertersTab must not emit repeated setTimeout startup handlers');

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
  assertNotIncludes(tab, token, `canonical tab must not actively import/install ${token}`);
}

assert(buttonScope.includes('xmlCiiWorkflowButtonScopeSync'), 'button scope must expose a sync function');
assert(buttonScope.includes('model-converters-xml-cii-workflow-btn'), 'button scope must create the unified workflow launcher button');
assert(buttonScope.includes('data-xml-cii-unified-workflow-launcher'), 'button scope must mark the unified workflow launcher');
assertNotIncludes(buttonScope, 'new MutationObserver', 'button scope must not use a broad observer to chase UI mutations');
assertNotIncludes(buttonScope, 'setTimeout(', 'button scope must not schedule repeated delayed startup repairs');

assert(simpleController.includes('xmlCiiSimpleWorkflowRestoreRunButton'), 'simple controller must keep a named restore function for non-XML CII converters');
assert(simpleController.includes('return null'), 'simple controller must skip direct-run restore for XML CII');
assertNotIncludes(simpleController, 'setTimeout(', 'simple controller must not schedule repeated delayed direct-run repairs');
assertNotIncludes(simpleController, "document.querySelector('#model-converters-run')", 'simple controller must not use a global run-button fallback');

assertNotIncludes(branchSample, 'new MutationObserver', 'branch sample service must not observe the whole document');
assertNotIncludes(branchSample, 'setTimeout(', 'branch sample service must not use delayed startup repair loops');
assertNotIncludes(branchSample, 'supportConfigJson', 'branch sample service must not serialize hidden supportConfigJson');
assert(branchSample.includes('syncLoadedXmlCiiBranchSample'), 'branch sample service must expose explicit XML file sync');

assertNotIncludes(masterAutoloadLite, "document.addEventListener('click'", 'lite master autoload must not schedule on every popup click/master tab click');
assertNotIncludes(masterAutoloadLite, "document.addEventListener('input'", 'lite master autoload must not schedule on hidden config input churn');
assertNotIncludes(masterAutoloadLite, "document.addEventListener('change'", 'lite master autoload must not schedule on every config/master change');
assertNotIncludes(masterAutoloadLite, 'Piping_class_master.json', 'lite master autoload must not probe obsolete aggregate piping class master');
assert(masterAutoloadLite.includes('DEFAULT_MASTER_PATHS'), 'lite master autoload must still define default material/weight master paths');

console.log('model converters tab responsiveness guard passed', {
  shim: 'lazy canonical import + legacy fallback + in-tab diagnostic',
  startupNoise: 'no repeated startup repair setTimeout loops in tab/button/simple/branch services',
  activePatchModules: 'removed from ModelConvertersTab active import path',
});
