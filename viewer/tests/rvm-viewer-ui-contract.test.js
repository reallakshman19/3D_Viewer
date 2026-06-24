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

verifyModuleIdentity();
verifyResizablePanels();
verifySupportPolicyOptionA();

console.log('Verified RVM viewer module identity, side-panel resize UI contract, and Option A staged support policy.');
