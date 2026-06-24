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
    console.error(`FAIL: ${message}`);
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
assert(/installXmlCiiRichWorkflowPopup/.test(tabSource), 'workflow popup module must be installed explicitly');
assert(!/installXmlCiiConversionWorkflowPopup/.test(tabSource), 'canonical tab must not install the old generic popup module');

assert(/xmlCiiWorkflowButtonScopeSync/.test(buttonScopeSource), 'button scope must expose a sync function');
assert(/XML_CII_CONVERTER_ID\s*=\s*'xml_to_cii'/.test(buttonScopeSource), 'button scope must key workflow visibility from xml_to_cii converter id');
assert(/data-xml-cii-workflow-action-row/.test(buttonScopeSource), 'button scope must create a dedicated action row');
assert(/xmlCiiWorkflowButtonScopeCanonicalLauncher/.test(buttonScopeSource), 'button scope must canonicalize duplicate workflow launchers');
assert(/button\.remove\(\)/.test(buttonScopeSource), 'button scope must remove duplicate workflow launchers in the current root');
assert(/xmlCiiWorkflowButtonScopeRetireLegacyShell/.test(buttonScopeSource), 'button scope must retire the old dark workflow shell');
assert(/xmlCiiWorkflowButtonScopeIsXmlCiiSelected/.test(buttonScopeSource), 'button scope must toggle workflow visibility from the current selected converter');
assert(/model-converters-xml-cii-simple-btn/.test(buttonScopeSource), 'button scope must create a Simple Workflow launcher button');
assert(/model-converters-xml-cii-rich-btn/.test(buttonScopeSource), 'button scope must create a Rich Workflow launcher button');
assert(/XML->CII Simple Workflow/.test(buttonScopeSource), 'left panel simple launcher must be labelled XML->CII Simple Workflow');
assert(/XML->CII Rich Workflow/.test(buttonScopeSource), 'left panel rich launcher must be labelled XML->CII Rich Workflow');
assert(/xmlCiiWorkflowButtonScopeHideAdvancedOptions/.test(buttonScopeSource), 'button scope must hide generic XML CII advanced options from the left panel');
assert(/data-xml-cii-left-panel-options-hidden/.test(buttonScopeSource), 'advanced options must receive an explicit hidden marker for XML CII');
assert(!/xmlCiiWorkflowButtonScopePlaceAdvancedInSimpleCard/.test(buttonScopeSource), 'generic advanced options must not be moved into a Simple/direct workflow card');
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
assert(!/import .*xml-cii-rich/.test(simpleControllerSource), 'simple controller must not import rich workflow modules');

assert(!/new MutationObserver/.test(richPopupSource), 'lean workflow popup launcher must not install MutationObserver');
assert(!/mountExistingPanel/.test(richPopupSource), 'lean workflow popup launcher must not move live panels by DOM portal');
assert(!/function interceptRun/.test(richPopupSource), 'workflow popup must not define old simple-run interception');
assert(!/document\.addEventListener\('click', interceptRun, true\)/.test(richPopupSource), 'workflow popup must not capture the legacy Run Conversion click');
assert(/XML->CII\(2019\) Simple Workflow/.test(richPopupSource), 'simple popup title must be explicit');
assert(/Import masters, map fields, inspect diagnostics, and run enriched CII conversion\./.test(richPopupSource), 'simple popup subtitle must match the requested workflow identity');
assert(/XML->CII\(2019\) Rich Workflow/.test(richPopupSource), 'rich popup title must be explicit');
assert(/Import masters, map fields, and maintain manual overrides in a standalone-ready config\./.test(richPopupSource), 'rich popup subtitle must match the requested workflow identity');
assert(/xmlCiiRichWorkflowBindLauncher\(container, 'simple'\)/.test(richPopupSource), 'popup module must bind the simple workflow launcher');
assert(/xmlCiiRichWorkflowBindLauncher\(container, 'rich'\)/.test(richPopupSource), 'popup module must bind the rich workflow launcher');
assert(/stopImmediatePropagation/.test(richPopupSource), 'workflow popup click handler must block stale cached popup listeners on the same click');
assert(/addEventListener\('click',[\s\S]*\{ capture: true \}\)/.test(richPopupSource), 'workflow popup click handler must bind in capture phase before old bubble listeners');
assert(/xmlCiiRichWorkflowCloseForeignXmlCiiWorkflowOverlays/.test(richPopupSource), 'workflow popup must close duplicate legacy XML CII workflow overlays');
assert(!/restoreSimpleRunButton/.test(richPopupSource), 'workflow popup must not restore legacy direct Run Conversion visibility');
assert(!/__xmlCiiConversionWorkflowAllowDirectRun/.test(richPopupSource), 'workflow popup must not own direct-run flags');
assert(/data-xml-cii-rich-workflow-root/.test(richPopupSource), 'workflow popup must scope installer state to the current model-converters root');
assert(/stateByRoot: new WeakMap\(\)/.test(richPopupSource), 'workflow popup must keep independent modal state per rendered root');
assert(!/if \(!xmlCiiRichWorkflowBrowserReady\(\) \|\| window\[XML_CII_RICH_WORKFLOW_FLAG\]\) return/.test(richPopupSource), 'workflow popup must not use a stale global singleton guard that blocks re-render install');

assert(/Deprecated compatibility shim/.test(oldPopupShimSource), 'old generic popup filename must be a compatibility shim only');
assert(!/restoreSimpleRunButton/.test(oldPopupShimSource), 'old generic popup shim must not restore simple Run Conversion visibility');

console.log('model converters tab lean responsiveness static test passed', {
  xmlCiiLeftPanel: 'popup-only: simple workflow button + rich workflow button, no generic advanced options',
  simpleWorkflow: 'explicit simple popup heading/subtitle',
  richWorkflow: 'explicit rich popup heading/subtitle',
  buttonScope: 'single action row, no dark-shell launcher, visible only for xml_to_cii',
});
