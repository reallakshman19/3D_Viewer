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
const deferredLoader = read('tabs/RvmDeferredBridgeLoader.js');
const toolbar = read('tabs/RvmToolbarCompactBridge.js');
const report = read('tabs/RvmReportExportBridge.js');
const health = read('tabs/RvmModelHealthBridge.js');
const issues = read('tabs/RvmModelHealthIssuesBridge.js');
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

assert.ok(stagedExport.includes('SUPPORT_UNAVAILABLE_REASON'), 'staged export must have an unavailable reason');
assert.ok(stagedValidation.includes('support-mode-unavailable-for-current-source'), 'staged validation must fail clearly when unavailable');
assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-scroll-misc-1'), 'renderer must import toolbar scroll/misc policy');
assert.ok(renderer.includes('RvmDeferredBridgeLoader.js?v=20260627-rvm-deferred-toolbar-misc-1'), 'renderer must import current deferred loader key');
assert.ok(renderer.includes('RvmGroupedToolbarPointerBridge.js?v=20260627-rvm-grouped-toolbar-pointer-1'), 'renderer must import deterministic pointer bridge');
assert.ok(renderer.includes('RvmHierarchySmartGridBridge.js?v=20260627-rvm-hierarchy-smart-grid-1'), 'renderer must import hierarchy smart grid bridge');
assert.ok(!renderer.includes('RvmModelHealthBridge.js?v='), 'renderer must not eagerly import model health bridge');
assert.ok(tab.includes('stampSourcePreviewHierarchy(payload.gltf.scene, source, sourceKind, file.name)'), 'mounted RVM tab must stamp source hierarchy');

assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-scroll-misc-1'"), 'toolbar must expose scroll/misc version');
assert.ok(toolbar.includes("const PREVIOUS_VERSION = '20260627-rvm-toolbar-view-expanded-nonempty-1'"), 'toolbar must retain previous expanded View marker');
assert.ok(toolbar.includes("{ id: 'misc', label: 'Misc'"), 'toolbar must define Misc group');
assert.ok(toolbar.includes("const CORE_LABELS = new Set(['navigate', 'view', 'navigate / view', 'review'])"), 'toolbar must keep View expanded as a top-level/core section');
assert.ok(!toolbar.includes("{ id: 'view', label: 'View'"), 'toolbar must not define a View dropdown');
for (const label of ['Orient', 'Visibility', 'Misc', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} grouped menu`);
assert.ok(toolbar.includes('overflow-x:auto'), 'toolbar must scroll horizontally when expanded buttons overflow');
assert.ok(toolbar.includes('flex-wrap:nowrap'), 'toolbar must keep expanded buttons on one scrollable row');
assert.ok(toolbar.includes("return 'misc'"), 'toolbar must route Report and Health tools into Misc');
assert.ok(toolbar.indexOf("return 'misc'") < toolbar.indexOf("return 'export'"), 'Misc routing must precede Export');
assert.ok(toolbar.indexOf("return 'misc'") < toolbar.indexOf("return 'inspect'"), 'Misc routing must precede Inspect');
assert.ok(toolbar.includes('menuRoot.hidden = !hasSections'), 'toolbar must hide empty grouped menus');
assert.ok(toolbar.includes('hiddenEmptyMenus') && toolbar.includes('visibleSecondaryMenus'), 'toolbar diagnostics must expose hidden and visible grouped menus');
assert.ok(!toolbar.includes('More tools</span>'), 'single generic More tools label must not return');
assert.ok(!toolbar.includes('<details'), 'grouped menus must not depend on native details toggling');

assert.ok(deferredLoader.includes('20260627-rvm-deferred-toolbar-misc-1'), 'deferred loader must expose toolbar misc key');
assert.ok(deferredLoader.includes('20260625-rvm-deferred-source-preview-tools-1'), 'deferred loader must retain previous source-preview key');
assert.ok(deferredLoader.includes('RvmReportExportBridge.js?v=20260627-rvm-report-misc-compact-1'), 'deferred loader must import compact Report bridge');
assert.ok(deferredLoader.includes('RvmModelHealthBridge.js?v=20260627-rvm-health-misc-compact-1'), 'deferred loader must import compact Health bridge');
assert.ok(deferredLoader.includes('RvmModelHealthIssuesBridge.js?v=20260627-rvm-health-issues-misc-compact-1'), 'deferred loader must import compact Health issues bridge');
assert.ok(deferredLoader.includes("id: 'model-health'"), 'deferred post-model group must include model health bridge');
assert.ok(deferredLoader.includes('SOURCE_PREVIEW_KIND_RE'), 'deferred loader must gate source-preview loading');
assert.ok(deferredLoader.includes("id: 'right-panel-format-policy'"), 'deferred post-model group must include right panel format policy bridge');
assert.ok(deferredLoader.includes('RvmRightPanelFormatPolicyBridge.js?v=20260627-rvm-right-panel-multiformat-1'), 'deferred loader must import right panel policy bridge with cache key');
assert.ok(deferredLoader.includes('right-panel-policy-sync'), 'source-preview refresh must resync the right panel policy');

assert.ok(rightPanelPolicy.includes('showStagedJsonReview: true'), 'format policy must treat stagedJSON as a first-class right panel format');
assert.ok(rightPanelPolicy.includes("rvm: Object.freeze({ ...BASE_SELECTION_POLICY, showNativeDiagnostics: true })"), 'format policy must preserve native diagnostics for binary RVM');
assert.ok(rightPanelPolicy.includes('sourceKindFromFileName') && rightPanelPolicy.includes(".stagedjson"), 'format policy must classify .stagedjson files');
assert.ok(rightPanelBridge.includes('StagedJSON Review'), 'right panel bridge must render stagedJSON review section');
assert.ok(rightPanelBridge.includes('hideObsoleteSourcePreviewPanels'), 'right panel bridge must hide source-preview panels for primitive formats');
assert.ok(rightPanelBridge.includes('Selected Entity'), 'right panel bridge must rename RVM-only selection title to generic selected entity');
assert.ok(rightPanelBridge.includes('copy-stagedjson') && rightPanelBridge.includes('download-stagedjson'), 'stagedJSON right panel must expose copy/download actions');

assert.ok(!report.includes('data-rvm-report-toolbar-summary') && !report.includes('ready for selected / visible / hidden / full'), 'Report toolbar status label must be removed');
assert.ok(!health.includes('data-rvm-health-toolbar-summary') && !health.includes('Health: load model to inspect'), 'Health toolbar status label must be removed');
assert.ok(!issues.includes('data-rvm-health-issues-summary') && !issues.includes('Issues: load model to inspect'), 'Health issues toolbar status label must be removed');
for (const selector of ['data-rvm-report-open', 'data-rvm-report-quick-csv']) assert.ok(report.includes(selector), `Report button selector ${selector} must remain wired`);
for (const selector of ['data-rvm-health-open', 'data-rvm-health-refresh-toolbar']) assert.ok(health.includes(selector), `Health button selector ${selector} must remain wired`);
for (const selector of ['data-rvm-health-issues-open', 'data-rvm-health-issues-refresh-toolbar']) assert.ok(issues.includes(selector), `Health issues button selector ${selector} must remain wired`);

assert.ok(pointer.includes('pointerdown-deterministic') && pointer.includes('suppressClickButton'), 'pointer bridge must open on pointerdown and suppress follow-up click');
assert.ok(pointer.includes('[data-rvm-toolbar-more] *{pointer-events:none;}'), 'pointer bridge must make nested targets deterministic');
assert.ok(overflow.includes('getMenuEntries') && overflow.includes('openMenuId'), 'overflow controller must own multiple grouped menu roots');
assert.ok(overflow.includes('positionMenu(entry)') && overflow.includes("menu.style.position = 'fixed'"), 'overflow controller must position grouped panels as fixed overlays');
assert.ok(!overflow.includes('MutationObserver'), 'overflow controller must not use MutationObserver as the behavior fix');
assert.ok(smartGrid.includes("const VERSION = '20260627-rvm-hierarchy-smart-grid-1'"), 'smart grid bridge must expose current version');
assert.ok(smartGrid.includes('grid-template-columns:22px minmax(0,1fr) 34px 34px'), 'smart grid must define row columns for expander/select/off/on');
assert.ok(drawer.includes('root.insertBefore(drawer, statusbar)'), 'drawer must dock before status bar');

console.log('Verified RVM viewer UI contract: scrollable toolbar, Misc grouping, compact Report/Health tools, current cache chain, multiformat right panel policy, and button wiring.');
