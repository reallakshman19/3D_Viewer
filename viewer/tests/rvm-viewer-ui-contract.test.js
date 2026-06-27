import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

const contract = read('tabs/rvm-viewer-module-contract.js');
const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');
const tab = read('tabs/viewer3d-rvm-tab.js');
const resizeBridge = read('tabs/RvmLeftPanelResizeCollapseBridge.js');
const deferredLoader = read('tabs/RvmDeferredBridgeLoader.js');
const toolbar = read('tabs/RvmToolbarCompactBridge.js');
const pointer = read('tabs/RvmGroupedToolbarPointerBridge.js');
const overflow = read('tabs/RvmToolbarOverflowController.js');
const smartGrid = read('tabs/RvmHierarchySmartGridBridge.js');
const drawer = read('tabs/RvmBottomDiagnosticsDrawerBridge.js');
const stagedExport = read('tabs/RvmStagedJsonExportBridge.js');
const stagedValidation = read('tabs/RvmStagedJsonValidationBridge.js');

const key = contract.match(/RVM_VIEWER3D_MODULE_CACHE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
assert.ok(key, 'module identity contract must expose RVM_VIEWER3D_MODULE_CACHE_KEY');
const rvmViewerImports = [...renderer.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g), ...tab.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g)].map((match) => match[1].slice(match[1].lastIndexOf('RvmViewer3D.js')));
assert.deepEqual([...new Set(rvmViewerImports)], [`RvmViewer3D.js?v=${key}`], 'renderer and mounted tab must share one RvmViewer3D ES module identity');
assert.ok(renderer.includes('installToolbarActionCompatibility'), 'renderer must alias handleToolbarAction to dispatchAction');

assert.ok(resizeBridge.includes('--rvm-left-panel-width'), 'left panel resize variable must be written');
assert.ok(resizeBridge.includes('--rvm-right-panel-width'), 'right panel resize variable must be written');
assert.ok(resizeBridge.includes('.rvm-left-panel[data-rvm-left-panel-resizable="true"]'), 'left panel CSS must consume resize variable');
assert.ok(resizeBridge.includes('.rvm-right-panel[data-rvm-right-panel-resizable="true"]'), 'right panel CSS must consume resize variable');

assert.ok(stagedExport.includes('SUPPORT_UNAVAILABLE_REASON'), 'staged export must have an unavailable reason');
assert.ok(stagedExport.includes('binary-rvm-support-tools-retired'), 'binary RVM support export policy must remain retired');
assert.ok(stagedValidation.includes('support-mode-unavailable-for-current-source'), 'staged validation must fail clearly when unavailable');

assert.ok(deferredLoader.includes('20260625-rvm-deferred-source-preview-tools-1'), 'deferred loader must expose source-preview deferral key');
assert.ok(renderer.includes('RvmDeferredBridgeLoader.js?v=20260625-rvm-deferred-source-preview-tools-1'), 'renderer must import current deferred loader key');
assert.ok(!renderer.includes('RvmModelHealthBridge.js?v='), 'renderer must not eagerly import model health bridge');
assert.ok(deferredLoader.includes("id: 'model-health'"), 'deferred post-model group must include model health bridge');
assert.ok(deferredLoader.includes('SOURCE_PREVIEW_KIND_RE'), 'deferred loader must gate source-preview loading');
assert.ok(tab.includes('stampSourcePreviewHierarchy(payload.gltf.scene, source, sourceKind, file.name)'), 'mounted RVM tab must stamp source hierarchy');

assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-view-orient-split-1'), 'renderer must import split View/Orient toolbar policy');
assert.ok(renderer.includes('RvmGroupedToolbarPointerBridge.js?v=20260627-rvm-grouped-toolbar-pointer-1'), 'renderer must import deterministic pointer bridge');
assert.ok(renderer.includes('installRvmGroupedToolbarPointerBridge()'), 'renderer must install deterministic pointer bridge');
assert.ok(pointer.includes("const VERSION = '20260627-rvm-grouped-toolbar-pointer-1'"), 'pointer bridge must expose current version');
assert.ok(pointer.includes('pointerdown-deterministic') && pointer.includes('suppressClickButton'), 'pointer bridge must open on pointerdown and suppress follow-up click');
assert.ok(pointer.includes('[data-rvm-toolbar-more] *{pointer-events:none;}'), 'pointer bridge must make nested span/caret target deterministic');
assert.ok(renderer.includes('installRvmToolbarCompactBridge()'), 'renderer must install toolbar policy bridge');
assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-view-orient-split-1'"), 'toolbar must expose split view/orient version');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1'), 'toolbar must import restored grouped overflow controller');
assert.ok(toolbar.includes("{ id: 'orient', label: 'Orient'"), 'toolbar must define Orient as a dedicated menu');
assert.ok(toolbar.includes("{ id: 'view', label: 'View', title: 'View Controls'"), 'toolbar must define View as a dedicated view-controls menu');
for (const label of ['View', 'Orient', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} grouped menu`);
assert.ok(toolbar.includes('classifySecondaryMenu'), 'toolbar must classify sections into named groups');
assert.ok(toolbar.includes('return \'orient\'') && toolbar.includes('return \'view\''), 'toolbar must route Orient and View separately');
assert.ok(toolbar.indexOf('return \'orient\'') < toolbar.indexOf('return \'view\''), 'toolbar must classify Orient before generic View terms');
assert.ok(toolbar.includes("CORE_LABELS = new Set(['Navigate', 'Navigate / View', 'Review'])"), 'toolbar must move View section into the View menu instead of leaving it top-level');
assert.ok(toolbar.includes('content:attr(aria-label)'), 'Orient menu must show text labels for icon-only orientation buttons');
assert.ok(toolbar.includes("section.dataset.rvmToolbarPolicy = 'secondary-grouped'"), 'toolbar must mark moved sections as secondary-grouped');
assert.ok(!toolbar.includes('More tools</span>'), 'single generic More tools label must not return');
assert.ok(!toolbar.includes('<details'), 'grouped menus must not depend on native details toggling');
assert.ok(overflow.includes('installRvmToolbarOverflow'), 'overflow controller must expose install lifecycle');
assert.ok(overflow.includes('disposeRvmToolbarOverflow'), 'overflow controller must expose dispose lifecycle');
assert.ok(overflow.includes('syncRvmToolbarOverflow'), 'overflow controller must expose sync lifecycle');
assert.ok(overflow.includes('getMenuEntries') && overflow.includes('openMenuId'), 'overflow controller must own multiple grouped menu roots');
assert.ok(overflow.includes('positionMenu(entry)') && overflow.includes("menu.style.position = 'fixed'"), 'overflow controller must position grouped panels as fixed overlays');
assert.ok(overflow.includes('aria-expanded'), 'overflow controller must own aria-expanded state');
assert.ok(overflow.includes('outside-pointerdown'), 'overflow controller must close on outside pointerdown');
assert.ok(overflow.includes("event?.key !== 'Escape'"), 'overflow controller must close on Escape');
assert.ok(!overflow.includes('MutationObserver'), 'overflow controller must not use MutationObserver as the behavior fix');

assert.ok(renderer.includes('RvmHierarchySelectionBridge.js?v=20260626-rvm-hierarchy-text-hit-target-sync-1'), 'renderer must preserve hierarchy text-hit-target bridge');
assert.ok(renderer.includes('RvmHierarchySmartGridBridge.js?v=20260627-rvm-hierarchy-smart-grid-1'), 'renderer must import hierarchy smart grid bridge');
assert.ok(renderer.includes('installRvmHierarchySmartGridBridge()'), 'renderer must install hierarchy smart grid bridge');
assert.ok(smartGrid.includes("const VERSION = '20260627-rvm-hierarchy-smart-grid-1'"), 'smart grid bridge must expose current version');
assert.ok(smartGrid.includes('grid-template-columns:22px minmax(0,1fr) 34px 34px'), 'smart grid must define row columns for expander/select/off/on');
assert.ok(smartGrid.includes('rvm-navis-label{min-width:0;overflow:hidden;text-overflow:ellipsis'), 'smart grid must protect hierarchy label width');
assert.ok(smartGrid.includes('overflow-x:hidden'), 'smart grid must prevent horizontal row overflow');
assert.ok(renderer.includes('RvmSelectionTreeSyncBridge.js?v=20260626-rvm-hierarchy-selection-sync-2'), 'renderer must preserve hierarchy sync bridge');
assert.ok(renderer.includes('RvmViewerInteractionPatch.js?v=20260626-rvm-canvas-hierarchy-selection-sync-1'), 'renderer must preserve canvas selection event bridge');

assert.ok(renderer.includes('RvmBottomDiagnosticsDrawerBridge.js?v=20260624-rvm-diagnostics-docked-drawer-1'), 'renderer must import docked diagnostics drawer key');
assert.ok(drawer.includes('20260624-rvm-diagnostics-docked-drawer-1'), 'drawer must expose docked key');
assert.ok(drawer.includes('root.insertBefore(drawer, statusbar)'), 'drawer must dock before status bar');
assert.ok(!drawer.includes('.rvm-bottom-diagnostics-drawer{position:fixed'), 'drawer must not use fixed viewport positioning');

console.log('Verified RVM viewer UI contract: dedicated View and Orient menus, deterministic grouped toolbar pointer handling, smart hierarchy grid, hierarchy sync, deferred tools, and docked diagnostics intact.');
