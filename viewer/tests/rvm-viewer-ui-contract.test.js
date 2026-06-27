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
const rightPanelPolicy = read('tabs/RvmFormatPolicy.js');
const rightPanelBridge = read('tabs/RvmRightPanelFormatPolicyBridge.js');

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
assert.ok(deferredLoader.includes("id: 'right-panel-format-policy'"), 'deferred post-model group must include right panel format policy bridge');
assert.ok(deferredLoader.includes('RvmRightPanelFormatPolicyBridge.js?v=20260627-rvm-right-panel-multiformat-1'), 'right panel bridge must be deferred-loaded with cache key');
assert.ok(rightPanelPolicy.includes('showStagedJsonReview: true'), 'format policy must treat stagedJSON as a first-class right panel format');
assert.ok(rightPanelPolicy.includes("rvm: Object.freeze({ ...BASE_SELECTION_POLICY, showNativeDiagnostics: true })"), 'format policy must preserve native diagnostics for binary RVM');
assert.ok(rightPanelPolicy.includes('sourceKindFromFileName') && rightPanelPolicy.includes(".stagedjson"), 'format policy must classify .stagedjson files');
assert.ok(rightPanelBridge.includes('StagedJSON Review'), 'right panel bridge must render stagedJSON review section');
assert.ok(rightPanelBridge.includes('hideObsoleteSourcePreviewPanels'), 'right panel bridge must hide source-preview panels for primitive formats');
assert.ok(rightPanelBridge.includes('Selected Entity'), 'right panel bridge must rename RVM-only selection title to generic selected entity');
assert.ok(rightPanelBridge.includes('copy-stagedjson') && rightPanelBridge.includes('download-stagedjson'), 'stagedJSON right panel must expose copy/download actions');

assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-view-expanded-nonempty-1'), 'renderer must import expanded View toolbar policy');
assert.ok(renderer.includes('RvmGroupedToolbarPointerBridge.js?v=20260627-rvm-grouped-toolbar-pointer-1'), 'renderer must import deterministic pointer bridge');
assert.ok(renderer.includes('installRvmGroupedToolbarPointerBridge()'), 'renderer must install deterministic pointer bridge');
assert.ok(pointer.includes("const VERSION = '20260627-rvm-grouped-toolbar-pointer-1'"), 'pointer bridge must expose current version');
assert.ok(pointer.includes('pointerdown-deterministic') && pointer.includes('suppressClickButton'), 'pointer bridge must open on pointerdown and suppress follow-up click');
assert.ok(pointer.includes('[data-rvm-toolbar-more] *{pointer-events:none;}'), 'pointer bridge must make nested span/caret target deterministic');
assert.ok(renderer.includes('installRvmToolbarCompactBridge()'), 'renderer must install toolbar policy bridge');
assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-view-expanded-nonempty-1'"), 'toolbar must expose expanded View/nonempty menu version');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1'), 'toolbar must import restored grouped overflow controller');
assert.ok(toolbar.includes("const CORE_LABELS = new Set(['navigate', 'view', 'navigate / view', 'review'])"), 'toolbar must keep View expanded as a top-level/core section');
assert.ok(!toolbar.includes("{ id: 'view', label: 'View'"), 'toolbar must not define a View dropdown');
assert.ok(toolbar.includes("{ id: 'orient', label: 'Orient'"), 'toolbar may keep Orient as populated-only grouped menu');
for (const label of ['Orient', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} grouped menu`);
assert.ok(toolbar.includes('classifySecondaryMenu'), 'toolbar must classify sections into named groups');
assert.ok(toolbar.includes("section.dataset.rvmToolbarPolicy = 'secondary-grouped'"), 'toolbar must mark moved sections as secondary-grouped');
assert.ok(toolbar.includes('menuRoot.hidden = !hasSections'), 'toolbar must hide empty grouped menus');
assert.ok(toolbar.includes('hiddenEmptyMenus'), 'toolbar diagnostics must expose hidden empty menus');
assert.ok(toolbar.includes('visibleSecondaryMenus'), 'toolbar diagnostics must expose visible nonempty menus');
assert.ok(toolbar.includes('clearSecondaryDataset(section)'), 'salvaged View sections must be restored as core toolbar sections');
assert.ok(toolbar.includes('content:attr(aria-label)'), 'Orient menu must show text labels for icon-only orientation buttons when populated');
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

console.log('Verified RVM viewer UI contract: expanded top-level View toolbar, hidden empty grouped menus, deterministic pointer handling, smart hierarchy grid, hierarchy sync, deferred tools, multiformat right panel policy, and docked diagnostics intact.');
