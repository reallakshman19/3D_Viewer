import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');

const files = {
  contract: path.join(viewerRoot, 'tabs/rvm-viewer-module-contract.js'),
  renderer: path.join(viewerRoot, 'tabs/viewer3d-rvm-tab-renderer.js'),
  tab: path.join(viewerRoot, 'tabs/viewer3d-rvm-tab.js'),
  resizeBridge: path.join(viewerRoot, 'tabs/RvmLeftPanelResizeCollapseBridge.js'),
  stagedExport: path.join(viewerRoot, 'tabs/RvmStagedJsonExportBridge.js'),
  stagedValidation: path.join(viewerRoot, 'tabs/RvmStagedJsonValidationBridge.js'),
  deferredLoader: path.join(viewerRoot, 'tabs/RvmDeferredBridgeLoader.js'),
  toolbarCompact: path.join(viewerRoot, 'tabs/RvmToolbarCompactBridge.js'),
};

function read(file) {
  assert.ok(fs.existsSync(file), `missing source file: ${path.relative(viewerRoot, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function rvmViewerImports(source) {
  return [...source.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g)].map((match) => match[1]);
}

function verifyModuleIdentity() {
  const contract = read(files.contract);
  const renderer = read(files.renderer);
  const tab = read(files.tab);
  const key = contract.match(/RVM_VIEWER3D_MODULE_CACHE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
  assert.ok(key, 'module identity contract must expose RVM_VIEWER3D_MODULE_CACHE_KEY');
  const suffixes = [...rvmViewerImports(renderer), ...rvmViewerImports(tab)].map((specifier) => specifier.slice(specifier.lastIndexOf('RvmViewer3D.js')));
  assert.deepEqual([...new Set(suffixes)], [`RvmViewer3D.js?v=${key}`], 'renderer and mounted tab must share one RvmViewer3D ES module identity');
  assert.ok(renderer.includes('installToolbarActionCompatibility'), 'renderer must alias handleToolbarAction to dispatchAction for local toolbar binding');
}

function verifyResizablePanels() {
  const source = read(files.resizeBridge);
  assert.ok(source.includes('--rvm-left-panel-width'), 'left panel resize contract variable must be written');
  assert.ok(source.includes('--rvm-right-panel-width'), 'right panel resize contract variable must be written');
  assert.ok(source.includes('.rvm-left-panel[data-rvm-left-panel-resizable="true"]'), 'left panel CSS must consume resize variable');
  assert.ok(source.includes('.rvm-right-panel[data-rvm-right-panel-resizable="true"]'), 'right panel CSS must consume resize variable');
  assert.ok(source.includes('__3D_RVM_VIEWER__?.onWindowResize') || source.includes('__3D_RVM_VIEWER__?.resize'), 'panel resize must notify the active viewer to resize');
}

function verifySupportPolicyOptionA() {
  const stagedExport = read(files.stagedExport);
  const stagedValidation = read(files.stagedValidation);
  assert.ok(stagedExport.includes('SUPPORT_UNAVAILABLE_REASON'), 'support export must have an explicit unavailable reason');
  assert.ok(stagedExport.includes('binary-rvm-support-tools-retired'), 'support export must preserve binary RVM retirement policy');
  assert.ok(stagedExport.includes('evaluateSupportPolicy'), 'support export must evaluate source-preview prerequisites before exporting support data');
  assert.ok(stagedValidation.includes('support-mode-unavailable-for-current-source'), 'support validation must fail clearly when support mode is unavailable');
  assert.ok(stagedValidation.includes('supportModeAvailable'), 'support validation must expose a support availability gate');
}

function verifyDeferredSupportPolicyCacheKeys() {
  const deferredLoader = read(files.deferredLoader);
  const renderer = read(files.renderer);
  assert.ok(deferredLoader.includes('20260624-rvm-deferred-stagedjson-cache-1'), 'deferred bridge loader must expose refreshed cache contract');
  assert.ok(deferredLoader.includes('RvmStagedJsonExportBridge.js?v=20260624-rvm-stagedjson-support-policy-1'), 'post-model deferred loader must import current Option A staged export bridge');
  assert.ok(deferredLoader.includes('RvmStagedJsonValidationBridge.js?v=20260624-rvm-stagedjson-support-policy-1'), 'post-model deferred loader must import current Option A staged validation bridge');
  assert.ok(renderer.includes('RvmDeferredBridgeLoader.js?v=20260624-rvm-deferred-stagedjson-cache-1'), 'renderer must import the current deferred loader cache key');
  assert.ok(!deferredLoader.includes('RvmStagedJsonExportBridge.js?v=20260621-rvm-button-hardening-1'), 'deferred loader must not keep stale staged export cache key');
  assert.ok(!deferredLoader.includes('RvmStagedJsonValidationBridge.js?v=20260620-rvm-stagedjson-validation-1'), 'deferred loader must not keep stale staged validation cache key');
}

function verifyToolbarCompactPolicy() {
  const renderer = read(files.renderer);
  const toolbar = read(files.toolbarCompact);
  assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260624-rvm-toolbar-compact-policy-1'), 'renderer must import compact toolbar policy bridge');
  assert.ok(renderer.includes('installRvmToolbarCompactBridge()'), 'renderer must install compact toolbar policy bridge');
  assert.ok(toolbar.includes('rvm-toolbar-compact-policy-1'), 'toolbar policy must expose versioned source contract');
  assert.ok(toolbar.includes("CORE_LABELS = new Set(['Navigate', 'View'])"), 'toolbar policy must keep core Navigate/View top-level');
  assert.ok(toolbar.includes('rvm-toolbar-more'), 'toolbar policy must create a More tools tray');
  assert.ok(toolbar.includes('data-rvm-toolbar-more-panel'), 'toolbar policy must provide a stable More tools panel marker');
  assert.ok(toolbar.includes("section.dataset.rvmToolbarPolicy = 'advanced'"), 'toolbar policy must mark moved secondary groups as advanced');
  assert.ok(toolbar.includes("section.dataset.rvmToolbarPolicy = 'duplicate-hidden'"), 'toolbar policy must hide exact duplicate groups rather than stacking them');
}

verifyModuleIdentity();
verifyResizablePanels();
verifySupportPolicyOptionA();
verifyDeferredSupportPolicyCacheKeys();
verifyToolbarCompactPolicy();

console.log('Verified RVM viewer module identity, side-panel resize UI contract, Option A staged support policy, deferred stagedJSON cache keys, and compact toolbar policy.');
