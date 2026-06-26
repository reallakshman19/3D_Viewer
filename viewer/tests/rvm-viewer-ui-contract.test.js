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
  viewportSpacing: path.join(viewerRoot, 'tabs/RvmViewportFirstSpacingBridge.js'),
  deferredLoader: path.join(viewerRoot, 'tabs/RvmDeferredBridgeLoader.js'),
  toolbarCompact: path.join(viewerRoot, 'tabs/RvmToolbarCompactBridge.js'),
  toolbarOverflow: path.join(viewerRoot, 'tabs/RvmToolbarOverflowController.js'),
  uiShell: path.join(viewerRoot, 'tabs/RvmViewerUiShell.js'),
  bottomDiagnostics: path.join(viewerRoot, 'tabs/RvmBottomDiagnosticsDrawerBridge.js'),
  reportExport: path.join(viewerRoot, 'tabs/RvmReportExportBridge.js'),
  stagedExport: path.join(viewerRoot, 'tabs/RvmStagedJsonExportBridge.js'),
  stagedValidation: path.join(viewerRoot, 'tabs/RvmStagedJsonValidationBridge.js'),
};

function read(file) {
  assert.ok(fs.existsSync(file), `missing source file: ${path.relative(viewerRoot, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function activeImport(source, moduleName) {
  const match = source.match(new RegExp(`import\\s+\\{[^}]+\\}\\s+from\\s+['\"]([^'\"]*${moduleName}\\.js\\?v=[^'\"]+)['\"]`));
  return match?.[1] || '';
}

function rvmViewerImports(source) {
  return [...source.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g)].map((match) => match[1]);
}

const contract = read(files.contract);
const renderer = read(files.renderer);
const tab = read(files.tab);
const viewportSpacing = read(files.viewportSpacing);
const deferredLoader = read(files.deferredLoader);
const toolbar = read(files.toolbarCompact);
const overflow = read(files.toolbarOverflow);
const uiShell = read(files.uiShell);
const bottomDiagnostics = read(files.bottomDiagnostics);
const reportExport = read(files.reportExport);
const stagedExport = read(files.stagedExport);
const stagedValidation = read(files.stagedValidation);

const viewerKey = contract.match(/RVM_VIEWER3D_MODULE_CACHE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
assert.ok(viewerKey, 'module identity contract must expose RVM_VIEWER3D_MODULE_CACHE_KEY');
const viewerSuffixes = [...rvmViewerImports(renderer), ...rvmViewerImports(tab)].map((specifier) => specifier.slice(specifier.lastIndexOf('RvmViewer3D.js')));
assert.deepEqual([...new Set(viewerSuffixes)], [`RvmViewer3D.js?v=${viewerKey}`], 'renderer and mounted tab must share one RvmViewer3D ES module identity');
assert.ok(renderer.includes('installToolbarActionCompatibility'), 'renderer must alias handleToolbarAction to dispatchAction for local toolbar binding');

assert.equal(activeImport(renderer, 'RvmViewerUiShell'), './RvmViewerUiShell.js?v=20260626-rvm-ui-shell-slots-2', 'renderer must actively import current UI shell cache key');
assert.equal(activeImport(renderer, 'RvmBottomDiagnosticsDrawerBridge'), './RvmBottomDiagnosticsDrawerBridge.js?v=20260626-rvm-diagnostics-shell-slot-1', 'renderer must actively import shell-slot diagnostics drawer cache key');
assert.equal(activeImport(renderer, 'RvmDeferredBridgeLoader'), './RvmDeferredBridgeLoader.js?v=20260626-rvm-deferred-report-export-shell-slot-1', 'renderer must actively import current deferred-loader cache key');
assert.equal(activeImport(renderer, 'RvmToolbarCompactBridge'), './RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-1', 'renderer must actively import grouped secondary toolbar policy');
assert.equal(activeImport(renderer, 'RvmViewportFirstSpacingBridge'), './RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-3', 'renderer must actively import grouped secondary viewport spacing bridge');
assert.equal(activeImport(renderer, 'RvmCanvasSelectionSinglePickGuardBridge'), './RvmCanvasSelectionSinglePickGuardBridge.js?v=20260626-rvm-canvas-single-pick-registry-1', 'renderer must actively import routed canvas single-pick bridge');
assert.equal(activeImport(renderer, 'RvmViewerInteractionPatch'), './RvmViewerInteractionPatch.js?v=20260626-rvm-canvas-selection-registry-1', 'renderer must actively import routed canvas selection bridge');
assert.ok(renderer.includes('Previous RVM compact toolbar cache key: RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-compact-policy-3'), 'renderer must preserve previous compact toolbar cache key evidence');
assert.ok(renderer.includes('Previous RVM viewport spacing cache key: RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-2'), 'renderer must preserve previous viewport spacing cache key evidence');
assert.ok(renderer.includes('installRvmToolbarCompactBridge();') && renderer.includes('installRvmViewportFirstSpacingBridge();'), 'renderer must install grouped toolbar and spacing bridges');
assert.ok(renderer.indexOf('installRvmToolbarCompactBridge();') < renderer.indexOf('installRvmViewportFirstSpacingBridge();'), 'spacing must apply after grouped toolbar policy');
assert.ok(renderer.indexOf('installRvmViewportFirstSpacingBridge();') < renderer.indexOf('installRvmViewerUiShell();'), 'spacing must apply before shell slot moves');
assert.ok(renderer.includes("viewer3d-rvm-tab.js?v=20260626-rvm-statusbar-structured-summary-1"), 'renderer must dynamically import current RVM tab shell cache key');

assert.ok(toolbar.includes("const VERSION = '20260626-rvm-toolbar-secondary-groups-1'"), 'toolbar policy must expose grouped secondary version');
assert.ok(toolbar.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-compact-policy-3'"), 'toolbar policy must preserve previous version');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260626-rvm-toolbar-overflow-controller-3'), 'toolbar policy must import grouped overflow controller');
for (const label of ['View', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} secondary menu`);
for (const group of ['view', 'visibility', 'inspect', 'export', 'source', 'diag']) assert.ok(toolbar.includes(`id: '${group}'`), `toolbar must define ${group} group id`);
assert.ok(toolbar.includes('classifySecondaryMenu') && toolbar.includes('secondary-grouped'), 'toolbar must classify advanced sections into named groups');
assert.ok(toolbar.includes("'Navigate / View'") && toolbar.includes("'Review'"), 'toolbar policy must keep primary and review groups top-level');
assert.ok(!toolbar.includes('More tools</span>'), 'generic More Tools dumping-ground label must be removed');
assert.ok(!toolbar.includes('<details'), 'grouped menus must not depend on native details toggling');

assert.ok(overflow.includes("const VERSION = '20260626-rvm-toolbar-overflow-controller-3'"), 'overflow controller must expose grouped controller version');
assert.ok(overflow.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-overflow-controller-2'"), 'overflow controller must preserve previous version');
assert.ok(overflow.includes('getMenuEntries') && overflow.includes('openMenuId'), 'overflow controller must support multiple grouped menu roots');
assert.ok(overflow.includes('buttonCount >= 1 && buttonCount === menuCount && overflowRootCount === buttonCount'), 'overflow DOM audit must allow grouped dropdown roots');
assert.ok(!overflow.includes('MutationObserver'), 'overflow controller must not use MutationObserver as the behavior fix');

assert.ok(viewportSpacing.includes("const VERSION = '20260626-rvm-viewport-first-spacing-3'"), 'viewport spacing bridge must expose grouped secondary spacing version');
assert.ok(viewportSpacing.includes("const PREVIOUS_VERSION = '20260626-rvm-viewport-first-spacing-2'"), 'viewport spacing bridge must preserve previous version');
assert.ok(viewportSpacing.includes("secondaryToolbarGroups: ['view', 'visibility', 'inspect', 'export', 'source', 'diag']"), 'viewport spacing diagnostics must list secondary groups');
assert.ok(viewportSpacing.includes('[data-rvm-viewer] .geo-top-ribbon{display:flex;justify-content:flex-start!important;'), 'RVM toolbar must override inherited generic space-between layout');
for (const marker of ['.rvm-toolbar-secondary-view{order:41', '.rvm-toolbar-secondary-visibility{order:42', '.rvm-toolbar-secondary-inspect{order:43', '.rvm-toolbar-secondary-export{order:44', '.rvm-toolbar-secondary-source{order:45', '.rvm-toolbar-secondary-diag{order:46']) assert.ok(viewportSpacing.includes(marker), `viewport spacing must order ${marker}`);
assert.ok(!viewportSpacing.includes('.app-shell') && !viewportSpacing.includes('.app-nav') && !viewportSpacing.includes('#tab-bar') && !viewportSpacing.includes('#tab-content'), 'viewport spacing bridge must not style landing/app shell selectors');

for (const eagerForbidden of [
  'RvmModelHealthBridge.js?v=',
  'RvmModelHealthIssuesBridge.js?v=',
  'RvmObjectSearchBridge.js?v=',
  'RvmVisibilitySnapshotsBridge.js?v=',
  'RvmSelectionSetsBridge.js?v=',
  'RvmReportExportBridge.js?v=',
  'RvmNonPrimitiveSupportOverlayBridge.js?v=',
  'RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=',
  'RvmNonPrimitiveSupportOverlayHoverBridge.js?v=',
  'RvmNonPrimitiveAutoBendBridge.js?v=',
  'RvmNonPrimitiveNodeMarkerBridge.js?v=',
  'RvmNonPrimitiveSourceToolsUiBridge.js?v=',
]) assert.ok(!renderer.includes(`import`) || !activeImport(renderer, eagerForbidden.replace('.js?v=', '')), `renderer must not eagerly import ${eagerForbidden}`);

assert.ok(tab.includes("const RVM_TAB_JS_VERSION = '20260626-rvm-statusbar-structured-summary-1'"), 'RVM tab shell must expose structured status cache key');
assert.ok(tab.includes('data-rvm-internal-toolbar="object-browser-1"'), 'RVM internal toolbar must be explicitly scoped to this tab');
assert.ok(tab.includes("label: 'Navigate / View'") && tab.includes("label: 'Review'"), 'RVM tab must keep primary toolbar groups');
assert.ok(tab.includes("label: 'Orient'"), 'Orient actions must remain available for grouped View menu relocation');
assert.ok(!tab.includes('class="rvm-ribbon-search"'), 'RVM hierarchy/object search must not stay in the top toolbar');
assert.ok(tab.includes('data-rvm-object-browser="true"') && tab.includes('data-rvm-object-browser-quick-filters="true"'), 'Object Browser must remain scoped and filtered');
assert.ok(tab.includes('data-rvm-status-structured="true"') && tab.includes('data-rvm-statusbar-structured="true"'), 'RVM structured statusbar must remain present');
assert.ok(!tab.includes('PCF GLB VIEWER'), 'RVM internal tab source must not redefine landing/header app chrome');

assert.ok(deferredLoader.includes("const VERSION = '20260626-rvm-deferred-report-export-shell-slot-1'"), 'deferred loader must expose current report/export shell-slot cache key');
assert.ok(deferredLoader.includes('RvmReportExportBridge.js?v=20260626-rvm-report-export-shell-slot-1'), 'deferred loader must import shell-slot report export bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260626-source-preview-support-events-1'), 'deferred loader must import event-routed support details bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSourceToolsUiBridge.js?v=20260626-source-tools-shell-slot-1'), 'deferred loader must import shell-slot source tools UI bridge');
assert.ok(deferredLoader.includes('SOURCE_PREVIEW_KIND_RE') && deferredLoader.includes("mode === 'source-preview'"), 'deferred loader must gate source-preview bridge loading');

assert.ok(uiShell.includes("const VERSION = '20260626-rvm-ui-shell-slots-2'"), 'UI shell must expose current version');
assert.ok(uiShell.includes("exports: 'exports'") && uiShell.includes("slots.exports !== 1"), 'UI shell must own exports slot');
assert.ok(bottomDiagnostics.includes("DIAGNOSTICS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"diagnostics\"]'"), 'diagnostics drawer must target diagnostics shell slot');
assert.ok(reportExport.includes("EXPORTS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"exports\"]'"), 'report export must target exports shell slot');
assert.ok(stagedExport.includes('binary-rvm-support-tools-retired'), 'support export must preserve binary RVM retirement policy');
assert.ok(stagedValidation.includes('support-mode-unavailable-for-current-source'), 'support validation must fail clearly when support mode is unavailable');
assert.ok(!uiShell.includes('convertXmlToCii') && !uiShell.includes('xml-cii2019'), 'UI shell must not include XML->CII conversion logic');

console.log('Verified RVM grouped secondary toolbar menus, runtime cache ownership, scoped spacing, shell slots, deferred bridge ownership, diagnostics/export ownership, and XML-CII isolation.');
