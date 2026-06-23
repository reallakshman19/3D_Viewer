#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const legacyTabPath = path.join(repoRoot, 'viewer/tabs/model-converters-tab.js');
const canonicalTabPath = path.join(repoRoot, 'viewer/tabs/model-converters/ModelConvertersTab.js');
const popupPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');

const legacyTabSource = fs.readFileSync(legacyTabPath, 'utf8');
const tabSource = fs.readFileSync(canonicalTabPath, 'utf8');
const popupSource = fs.readFileSync(popupPath, 'utf8');

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

assert(!/new MutationObserver/.test(popupSource), 'lean popup launcher must not install MutationObserver');
assert(!/mountExistingPanel/.test(popupSource), 'lean popup launcher must not move live panels by DOM portal');
assert(!/function interceptRun/.test(popupSource), 'lean popup must not define old simple-run interception');
assert(!/document\.addEventListener\('click', interceptRun, true\)/.test(popupSource), 'lean popup must not capture the simple Run Conversion click');
assert(/Only the XML->CII Rich Workflow button opens this phase-tab popup/.test(popupSource), 'rich popup must be opened only by XML->CII Rich Workflow button');
assert(/restoreSimpleRunButton/.test(popupSource), 'lean popup must restore simple Run Conversion visibility');
assert(/window\[DIRECT_RUN_FLAG\] = true/.test(popupSource), 'lean popup must bypass stale cached simple-run interceptors');
assert(/data-xml-cii-workflow-root/.test(popupSource), 'lean popup must scope installer state to the current model-converters root');
assert(/stateByRoot: new WeakMap\(\)/.test(popupSource), 'lean popup must keep independent modal state per rendered root');
assert(!/if \(!browserReady\(\) \|\| window\[FLAG\]\) return/.test(popupSource), 'lean popup must not use a stale global singleton guard that blocks re-render install');

console.log('✅ model converters tab lean responsiveness static test passed', {
  simpleRun: 'direct/no popup interception',
  richWorkflow: 'explicit rich button popup only',
});
