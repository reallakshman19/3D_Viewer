import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
const files = {
  contract: 'tabs/rvm-viewer-module-contract.js',
  renderer: 'tabs/viewer3d-rvm-tab-renderer.js',
  tab: 'tabs/viewer3d-rvm-tab.js',
  toolbar: 'tabs/RvmToolbarCompactBridge.js',
  overflow: 'tabs/RvmToolbarOverflowController.js',
  spacing: 'tabs/RvmViewportFirstSpacingBridge.js',
  deferredLoader: 'tabs/RvmDeferredBridgeLoader.js',
  uiShell: 'tabs/RvmViewerUiShell.js',
  bottomDiagnostics: 'tabs/RvmBottomDiagnosticsDrawerBridge.js',
  reportExport: 'tabs/RvmReportExportBridge.js',
  stagedExport: 'tabs/RvmStagedJsonExportBridge.js',
  stagedValidation: 'tabs/RvmStagedJsonValidationBridge.js',
};
function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}
function activeImport(source, moduleName) {
  const match = source.match(new RegExp(`import\\s+\\{[^}]+\\}\\s+from\\s+['\"]([^'\"]*${moduleName}\\.js\\?v=[^'\"]+)['\"]`));
  return match?.[1] || '';
}
function rvmViewerImports(source) { return [...source.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g)].map((match) => match[1]); }

const contract = read(files.contract);
const renderer = read(files.renderer);
const tab = read(files.tab);
const toolbar = read(files.toolbar);
const overflow = read(files.overflow);
const spacing = read(files.spacing);
const deferredLoader = read(files.deferredLoader);
const uiShell = read(files.uiShell);
const bottomDiagnostics = read(files.bottomDiagnostics);
const reportExport = read(files.reportExport);
const stagedExport = read(files.stagedExport);
const stagedValidation = read(files.stagedValidation);

const viewerKey = contract.match(/RVM_VIEWER3D_MODULE_CACHE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
assert.ok(viewerKey, 'module identity contract must expose RVM_VIEWER3D_MODULE_CACHE_KEY');
const viewerSuffixes = [...rvmViewerImports(renderer), ...rvmViewerImports(tab)].map((specifier) => specifier.slice(specifier.lastIndexOf('RvmViewer3D.js')));
assert.deepEqual([...new Set(viewerSuffixes)], [`RvmViewer3D.js?v=${viewerKey}`], 'renderer and mounted tab must share one RvmViewer3D ES module identity');

assert.equal(activeImport(renderer, 'RvmToolbarCompactBridge'), './RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-2', 'renderer must actively import grouped toolbar click fix');
assert.equal(activeImport(renderer, 'RvmViewportFirstSpacingBridge'), './RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-3', 'renderer must actively import grouped secondary viewport spacing bridge');
assert.equal(activeImport(renderer, 'RvmViewerUiShell'), './RvmViewerUiShell.js?v=20260626-rvm-ui-shell-slots-2', 'renderer must actively import current UI shell cache key');
assert.equal(activeImport(renderer, 'RvmDeferredBridgeLoader'), './RvmDeferredBridgeLoader.js?v=20260626-rvm-deferred-report-export-shell-slot-1', 'renderer must actively import current deferred-loader cache key');
assert.ok(renderer.includes('Previous RVM compact toolbar cache key: RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-1'), 'renderer must preserve previous grouped toolbar cache key evidence');
assert.ok(renderer.includes('Previous RVM viewport spacing cache key: RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-3'), 'renderer must preserve previous spacing cache key evidence');
assert.ok(renderer.indexOf('installRvmToolbarCompactBridge();') < renderer.indexOf('installRvmViewportFirstSpacingBridge();'), 'spacing must apply after grouped toolbar policy');
assert.ok(renderer.indexOf('installRvmViewportFirstSpacingBridge();') < renderer.indexOf('installRvmViewerUiShell();'), 'spacing must apply before shell slot moves');

assert.ok(toolbar.includes("const VERSION = '20260626-rvm-toolbar-secondary-groups-2'"), 'toolbar policy must expose grouped click-fix version');
assert.ok(toolbar.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-secondary-groups-1'"), 'toolbar policy must preserve previous grouped version');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260626-rvm-toolbar-overflow-controller-4'), 'toolbar policy must import click-fix overflow controller');
assert.ok(toolbar.includes('position:fixed'), 'toolbar menu panel CSS must avoid clipping by toolbar containers');
assert.ok(toolbar.includes('overflow:visible'), 'toolbar ribbon CSS must not clip grouped menus');
for (const label of ['View', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} secondary menu`);
assert.ok(toolbar.includes('classifySecondaryMenu') && toolbar.includes('secondary-grouped'), 'toolbar must classify advanced sections into named groups');
assert.ok(!toolbar.includes('More tools</span>'), 'generic More Tools dumping-ground label must be removed');
assert.ok(!toolbar.includes('<details'), 'grouped menus must not depend on native details toggling');

assert.ok(overflow.includes("const VERSION = '20260626-rvm-toolbar-overflow-controller-4'"), 'overflow controller must expose click/display fix version');
assert.ok(overflow.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-overflow-controller-3'"), 'overflow controller must preserve previous grouped version');
assert.ok(overflow.includes('positionMenu(entry)') && overflow.includes("menu.style.position = 'fixed'"), 'overflow controller must position opened menu as fixed overlay');
assert.ok(overflow.includes('updateButtonCaret(entry.button, open)'), 'overflow controller must visibly update caret state');
assert.ok(overflow.includes('stopImmediatePropagation'), 'overflow controller click path must not be swallowed by later root owners');
assert.ok(overflow.includes('getMenuEntries') && overflow.includes('openMenuId'), 'overflow controller must support multiple grouped menu roots');
assert.ok(overflow.includes('buttonCount >= 1 && buttonCount === menuCount && overflowRootCount === buttonCount'), 'overflow DOM audit must allow grouped dropdown roots');
assert.ok(!overflow.includes('MutationObserver'), 'overflow controller must not use MutationObserver as the behavior fix');

assert.ok(spacing.includes("const VERSION = '20260626-rvm-viewport-first-spacing-3'"), 'viewport spacing bridge must expose grouped secondary spacing version');
assert.ok(spacing.includes("secondaryToolbarGroups: ['view', 'visibility', 'inspect', 'export', 'source', 'diag']"), 'viewport spacing diagnostics must list secondary groups');
assert.ok(spacing.includes('[data-rvm-viewer] .geo-top-ribbon{display:flex;justify-content:flex-start!important;'), 'RVM toolbar must override inherited generic space-between layout');
assert.ok(!spacing.includes('.app-shell') && !spacing.includes('.app-nav') && !spacing.includes('#tab-bar') && !spacing.includes('#tab-content'), 'viewport spacing bridge must not style landing/app shell selectors');

for (const eagerForbidden of ['RvmModelHealthBridge.js?v=', 'RvmModelHealthIssuesBridge.js?v=', 'RvmObjectSearchBridge.js?v=', 'RvmVisibilitySnapshotsBridge.js?v=', 'RvmSelectionSetsBridge.js?v=', 'RvmReportExportBridge.js?v=', 'RvmNonPrimitiveSupportOverlayBridge.js?v=', 'RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=', 'RvmNonPrimitiveSupportOverlayHoverBridge.js?v=', 'RvmNonPrimitiveAutoBendBridge.js?v=', 'RvmNonPrimitiveNodeMarkerBridge.js?v=', 'RvmNonPrimitiveSourceToolsUiBridge.js?v=']) {
  assert.ok(!renderer.includes(`import`) || !activeImport(renderer, eagerForbidden.replace('.js?v=', '')), `renderer must not eagerly import ${eagerForbidden}`);
}
assert.ok(tab.includes('data-rvm-internal-toolbar="object-browser-1"'), 'RVM internal toolbar must be explicitly scoped to this tab');
assert.ok(tab.includes("label: 'Navigate / View'") && tab.includes("label: 'Review'") && tab.includes("label: 'Orient'"), 'RVM tab must keep primary toolbar groups and orient source');
assert.ok(tab.includes('data-rvm-object-browser="true"') && tab.includes('data-rvm-status-structured="true"'), 'Object Browser and structured statusbar must remain present');
assert.ok(!tab.includes('PCF GLB VIEWER'), 'RVM internal tab source must not redefine landing/header app chrome');
assert.ok(deferredLoader.includes('RvmReportExportBridge.js?v=20260626-rvm-report-export-shell-slot-1'), 'deferred loader must import shell-slot report export bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSourceToolsUiBridge.js?v=20260626-source-tools-shell-slot-1'), 'deferred loader must import shell-slot source tools UI bridge');
assert.ok(uiShell.includes("exports: 'exports'") && uiShell.includes("slots.exports !== 1"), 'UI shell must own exports slot');
assert.ok(bottomDiagnostics.includes("DIAGNOSTICS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"diagnostics\"]'"), 'diagnostics drawer must target diagnostics shell slot');
assert.ok(reportExport.includes("EXPORTS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"exports\"]'"), 'report export must target exports shell slot');
assert.ok(stagedExport.includes('binary-rvm-support-tools-retired'), 'support export must preserve binary RVM retirement policy');
assert.ok(stagedValidation.includes('support-mode-unavailable-for-current-source'), 'support validation must fail clearly when support mode is unavailable');
assert.ok(!uiShell.includes('convertXmlToCii') && !uiShell.includes('xml-cii2019'), 'UI shell must not include XML->CII conversion logic');

console.log('Verified RVM grouped toolbar click/display fix, runtime cache ownership, scoped spacing, shell slots, deferred bridge ownership, diagnostics/export ownership, and XML-CII isolation.');
