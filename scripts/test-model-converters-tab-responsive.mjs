#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const legacyTabPath = path.join(repoRoot, 'viewer/tabs/model-converters-tab.js');
const canonicalTabPath = path.join(repoRoot, 'viewer/tabs/model-converters/ModelConvertersTab.js');
const buttonScopePath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-workflow-button-scope.js');
const richPopupPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-rich-workflow-popup.js');
const simpleControllerPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-simple-workflow-controller.js');
const oldPopupShimPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');

const legacyTabSource = fs.readFileSync(legacyTabPath, 'utf8');
const tabSource = fs.readFileSync(canonicalTabPath, 'utf8');
const buttonScopeSource = fs.readFileSync(buttonScopePath, 'utf8');
const richPopupSource = fs.readFileSync(richPopupPath, 'utf8');
const simpleControllerSource = fs.readFileSync(simpleControllerPath, 'utf8');
const oldPopupShimSource = fs.readFileSync(oldPopupShimPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(/export\s*\{\s*renderModelConvertersTab\s*\}\s*from\s*['"]\.\/model-converters\/index\.js(?:\?[^'"]*)?['"]/.test(legacyTabSource), 'legacy shim must delegate renderModelConvertersTab to canonical model-converters entrypoint');
assert(/renderLegacyModelConvertersTab\(container, ctx\)/.test(tabSource), 'canonical model converter tab must render legacy adapter first');
assert(/scheduleInstaller\(/.test(tabSource), 'optional installers must be scheduled/deferred');
assert(/installSafely\(/.test(tabSource), 'optional installers must be guarded');
assert(/catch \(error\)/.test(tabSource), 'installer failures must be caught and logged');
assert(/Optional installer failed/.test(tabSource), 'installer failure log must identify optional installer errors');
assert(!/installXmlCiiSideloadUi/.test(tabSource), 'heavy XML CII sideload observer installer must not auto-run from Model Converter tab');
assert(!/installXmlCiiMatchedPreviewUi/.test(tabSource), 'heavy XML CII matched-preview observer installer must not auto-run from Model Converter tab');
assert(!/installXmlCiiConversionWorkflowPolish/.test(tabSource), 'workflow polish observer must not auto-run from Model Converter tab');
assert(/setTimeout\(run, 0\)/.test(tabSource), 'deferred installer scheduler must use timeout to keep legacy render responsive');

assert(/installXmlCiiWorkflowButtonScope/.test(tabSource), 'canonical tab must install the scoped workflow button host');
assert(/\['xml-cii-workflow-button-scope', installXmlCiiWorkflowButtonScope\][\s\S]*\['xml-cii-simple-workflow-controller', installXmlCiiSimpleWorkflowController\][\s\S]*\['xml-cii-rich-workflow-popup', installXmlCiiRichWorkflowPopup\]/.test(tabSource), 'button scope must install before simple/rich behavior binding');
assert(/installXmlCiiSimpleWorkflowController/.test(tabSource), 'simple workflow controller must be installed explicitly');
assert(/installXmlCiiRichWorkflowPopup/.test(tabSource), 'rich workflow popup must be installed explicitly');
assert(!/installXmlCiiConversionWorkflowPopup/.test(tabSource), 'canonical tab must not install the old generic popup module');

assert(/xmlCiiWorkflowButtonScopeSync/.test(buttonScopeSource), 'button scope must expose a sync function');
assert(/XML_CII_CONVERTER_ID\s*=\s*'xml_to_cii'/.test(buttonScopeSource), 'button scope must key rich visibility from xml_to_cii converter id');
assert(/data-xml-cii-workflow-action-row/.test(buttonScopeSource), 'button scope must create a dedicated action row');
assert(/xmlCiiWorkflowButtonScopeCanonicalRichButton/.test(buttonScopeSource), 'button scope must canonicalize duplicate rich launchers');
assert(/button\.remove\(\)/.test(buttonScopeSource), 'button scope must remove duplicate rich launchers in the current root');
assert(/xmlCiiWorkflowButtonScopeRetireLegacyShell/.test(buttonScopeSource), 'button scope must retire the old dark workflow shell');
assert(/xmlCiiWorkflowButtonScopeIsXmlCiiSelected/.test(buttonScopeSource), 'button scope must toggle rich visibility from the current selected converter');
assert(/xmlCiiWorkflowButtonScopePlaceAdvancedInSimpleCard/.test(buttonScopeSource), 'button scope must move generic XML CII advanced options into the simple workflow card');
assert(/Simple\/direct workflow options/.test(buttonScopeSource), 'simple XML CII options must be visibly labelled as simple/direct workflow options');
assert(/xml-cii-rich-workflow-card > details\.model-converters-advanced/.test(buttonScopeSource), 'rich workflow card must guard against containing generic advanced options');
assert(/Rich workflow[\s\S]*inside the popup/.test(buttonScopeSource), 'rich workflow card copy must explain that rich options are configured inside the popup');
assert(/xmlCiiWorkflowButtonScopeFreshRichButton/.test(buttonScopeSource), 'button scope must freshen the rich launcher to strip stale cached listeners');
assert(/cloneNode\(true\)/.test(buttonScopeSource), 'rich launcher freshening must clone the element instead of preserving old anonymous listeners');
assert(/delete fresh\.dataset\.xmlCiiRichWorkflowPopupBound/.test(buttonScopeSource), 'fresh rich launcher must force the canonical popup to rebind');
assert(!/new MutationObserver/.test(buttonScopeSource), 'button scope must not use a broad observer to chase UI mutations');

assert(/xmlCiiSimpleWorkflowRestoreRunButton/.test(simpleControllerSource), 'simple controller must restore simple Run Conversion visibility');
assert(/window\[XML_CII_SIMPLE_DIRECT_RUN_FLAG\] = true/.test(simpleControllerSource), 'simple controller must own simple direct-run guard');
assert(!/document\.querySelector\('#model-converters-run'\)/.test(simpleControllerSource), 'simple controller must not use a global run-button fallback');
assert(!/xmlCiiRichWorkflow/.test(simpleControllerSource), 'simple controller must not depend on rich workflow modules');

assert(!/new MutationObserver/.test(richPopupSource), 'lean rich popup launcher must not install MutationObserver');
assert(!/mountExistingPanel/.test(richPopupSource), 'lean rich popup launcher must not move live panels by DOM portal');
assert(!/function interceptRun/.test(richPopupSource), 'rich popup must not define old simple-run interception');
assert(!/document\.addEventListener\('click', interceptRun, true\)/.test(richPopupSource), 'rich popup must not capture the simple Run Conversion click');
assert(/XML->CII\(2019\) Rich Workflow/.test(richPopupSource), 'rich popup title must be explicit');
assert(/Canonical rich workflow/.test(richPopupSource), 'rich popup subtitle must identify the canonical rich workflow');
assert(/stopImmediatePropagation/.test(richPopupSource), 'rich popup click handler must block stale cached popup listeners on the same click');
assert(/addEventListener\('click',[\s\S]*\{ capture: true \}\)/.test(richPopupSource), 'rich popup click handler must bind in capture phase before old bubble listeners');
assert(/xmlCiiRichWorkflowCloseForeignXmlCiiWorkflowOverlays/.test(richPopupSource), 'rich popup must close duplicate legacy XML CII workflow overlays');
assert(!/restoreSimpleRunButton/.test(richPopupSource), 'rich popup must not restore simple Run Conversion visibility');
assert(!/__xmlCiiConversionWorkflowAllowDirectRun/.test(richPopupSource), 'rich popup must not own direct-run flags');
assert(/data-xml-cii-rich-workflow-root/.test(richPopupSource), 'rich popup must scope installer state to the current model-converters root');
assert(/stateByRoot: new WeakMap\(\)/.test(richPopupSource), 'rich popup must keep independent modal state per rendered root');
assert(!/if \(!xmlCiiRichWorkflowBrowserReady\(\) \|\| window\[XML_CII_RICH_WORKFLOW_FLAG\]\) return/.test(richPopupSource), 'rich popup must not use a stale global singleton guard that blocks re-render install');

assert(/Deprecated compatibility shim/.test(oldPopupShimSource), 'old generic popup filename must be a compatibility shim only');
assert(!/restoreSimpleRunButton/.test(oldPopupShimSource), 'old generic popup shim must not restore simple Run Conversion visibility');

console.log('✅ model converters tab lean responsiveness static test passed', {
  simpleRun: 'direct/no popup interception, owned by simple-prefixed controller with simple-only options card',
  richWorkflow: 'exclusive canonical rich-prefixed popup, stale cached click listeners stripped/blocked',
  buttonScope: 'single action row, no dark-shell rich launcher, rich visible only for xml_to_cii',
});
