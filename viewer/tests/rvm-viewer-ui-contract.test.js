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
assert.equal(activeImport(renderer, 'RvmToolbarCompactBridge'), './RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-compact-policy-3', 'renderer must actively import internal-toolbar compact policy v3');
assert.equal(activeImport(renderer, 'RvmCanvasSelectionSinglePickGuardBridge'), './RvmCanvasSelectionSinglePickGuardBridge.js?v=20260626-rvm-canvas-single-pick-registry-1', 'renderer must actively import routed canvas single-pick bridge');
assert.equal(activeImport(renderer, 'RvmViewerInteractionPatch'), './RvmViewerInteractionPatch.js?v=20260626-rvm-canvas-selection-registry-1', 'renderer must actively import routed canvas selection bridge');
assert.ok(renderer.includes("viewer3d-rvm-tab.js?v=20260626-rvm-object-browser-quick-filters-1"), 'renderer must dynamically import current RVM tab shell cache key');

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
]) {
  assert.ok(!renderer.includes(`import`) || !activeImport(renderer, eagerForbidden.replace('.js?v=', '')), `renderer must not eagerly import ${eagerForbidden}`);
}

assert.ok(tab.includes("const RVM_TAB_JS_VERSION = '20260626-rvm-object-browser-quick-filters-1'"), 'RVM tab shell must expose quick-filter cache key');
assert.ok(tab.includes("const PREVIOUS_RVM_TAB_JS_VERSION = '20260626-rvm-internal-toolbar-object-browser-1'"), 'RVM tab shell must preserve previous cache evidence');
assert.ok(tab.includes('data-rvm-internal-toolbar="object-browser-1"'), 'RVM internal toolbar must be explicitly scoped to this tab');
assert.ok(tab.includes("label: 'Navigate / View'"), 'RVM toolbar must combine primary navigation/view actions into one visible group');
assert.ok(tab.includes("label: 'Review'"), 'RVM toolbar must keep review actions visible inside the RVM tab');
assert.ok(tab.includes("label: 'Orient'"), 'RVM toolbar must keep Orient available for More Tools');
assert.ok(tab.indexOf('rvm-ribbon-load') < tab.indexOf('TOOL_GROUPS.map(renderToolGroup)'), 'Load must stay first inside the RVM internal toolbar');
assert.ok(!tab.includes('class="rvm-ribbon-search"'), 'RVM hierarchy/object search must not stay in the top toolbar');
assert.ok(tab.includes('data-rvm-object-browser="true"'), 'left panel must be promoted to Object Browser');
assert.ok(tab.includes('data-rvm-object-browser-search="true"'), 'Object Browser must own the hierarchy/object search row');
assert.ok(tab.includes('id="rvm-search-input"') && tab.includes('Search hierarchy / object'), 'Object Browser must retain the existing hierarchy/object search input id');
assert.ok(tab.includes('id="rvm-tree-filter"'), 'Object Browser must retain tree filter binding compatibility');
assert.ok(tab.includes('data-rvm-object-browser-quick-filters="true"'), 'Object Browser must own compact quick filters');
assert.ok(tab.includes('id="rvm-object-zone-filter"') && tab.includes('id="rvm-object-lod-filter"') && tab.includes('id="rvm-object-visible-filter"'), 'Object Browser must expose Zone / LOD / Visible controls');
assert.ok(tab.includes('OBJECT_BROWSER_LOD_STORAGE_KEY') && tab.includes("rvm_zone_lod_detail_v1"), 'Object Browser LOD selector must persist to existing zone-density storage key');
assert.ok(tab.includes('populateObjectBrowserZones(root, nodes)'), 'RVM load paths must populate zone filter from loaded hierarchy nodes');
assert.ok(tab.includes('filterObjectBrowserTree(root, viewer)'), 'RVM load paths must apply Object Browser filters after tree render');
assert.ok(tab.includes('__PCF_GLB_RVM_OBJECT_BROWSER__'), 'Object Browser must publish a scoped diagnostics/refresh API');
assert.ok(tab.includes('buildVisibilityMap(viewer)') && tab.includes('OBJECT_BROWSER_VISIBILITY_SCAN_LIMIT'), 'Visible/hidden filter must use bounded visibility lookup');
assert.ok(!tab.includes('PCF GLB VIEWER'), 'RVM internal tab source must not redefine the landing/header app chrome');

assert.ok(deferredLoader.includes("const VERSION = '20260626-rvm-deferred-report-export-shell-slot-1'"), 'deferred loader must expose current report/export shell-slot cache key');
assert.ok(deferredLoader.includes("PREVIOUS_SOURCE_PREVIEW_LOADER_VERSION = '20260626-rvm-deferred-node-marker-events-1'"), 'deferred loader must preserve previous node-marker event cache key evidence');
assert.ok(deferredLoader.includes('RvmStagedJsonExportBridge.js?v=20260624-rvm-stagedjson-support-policy-1'), 'deferred loader must import current staged export bridge');
assert.ok(deferredLoader.includes('RvmStagedJsonValidationBridge.js?v=20260624-rvm-stagedjson-support-policy-1'), 'deferred loader must import current staged validation bridge');
assert.ok(deferredLoader.includes('RvmReportExportBridge.js?v=20260626-rvm-report-export-shell-slot-1'), 'deferred loader must import shell-slot report export bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260626-source-preview-support-events-1'), 'deferred loader must import event-routed support details bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSupportOverlayHoverBridge.js?v=20260626-source-preview-hover-events-1'), 'deferred loader must import event-routed support hover bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveNodeMarkerBridge.js?v=20260626-node-marker-events-1'), 'deferred loader must import event-routed node marker bridge');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSourceToolsUiBridge.js?v=20260626-source-tools-shell-slot-1'), 'deferred loader must import shell-slot source tools UI bridge');
assert.ok(deferredLoader.includes('SOURCE_PREVIEW_KIND_RE'), 'deferred loader must gate source-preview bridge loading by source kind');
assert.ok(deferredLoader.includes("mode === 'source-preview'"), 'deferred loader must gate source-preview bridge loading by primitive mode');
assert.ok(deferredLoader.includes('refreshSourcePreviewRuntime'), 'deferred loader must refresh source-preview runtime after lazy install');

assert.ok(uiShell.includes("const VERSION = '20260626-rvm-ui-shell-slots-2'"), 'UI shell must expose current version');
assert.ok(uiShell.includes("exports: 'exports'"), 'UI shell must define exports slot');
assert.ok(uiShell.includes("{ id: RVM_UI_SHELL_SLOTS.exports, label: 'Exports' }"), 'UI shell must expose Exports tab');
assert.ok(uiShell.includes("slots.diagnostics !== 1"), 'UI shell audit must enforce one diagnostics slot');
assert.ok(uiShell.includes("slots.exports !== 1"), 'UI shell audit must enforce one exports slot');
assert.ok(uiShell.includes('registerRvmToolPanel'), 'UI shell must expose panel registration');
assert.ok(uiShell.includes('setRvmRightPanelTab'), 'UI shell must own right-panel tab state');
assert.ok(uiShell.includes('#rvm-attributes-panel'), 'UI shell must preserve attributes panel');
assert.ok(uiShell.includes('#rvm-browser-parse-diagnostics'), 'UI shell must preserve browser diagnostics panel');

assert.ok(bottomDiagnostics.includes("DIAGNOSTICS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"diagnostics\"]'"), 'diagnostics drawer must target diagnostics shell slot');
assert.ok(bottomDiagnostics.includes('registerDiagnosticsPanel'), 'diagnostics drawer must register with UI shell');
assert.ok(bottomDiagnostics.includes('root.insertBefore(drawer, statusbar)'), 'diagnostics drawer must preserve legacy statusbar fallback');
assert.ok(bottomDiagnostics.includes('.rvm-bottom-diagnostics-drawer{position:relative'), 'diagnostics drawer must remain docked/relative, not fixed overlay');
assert.ok(!bottomDiagnostics.includes('.rvm-bottom-diagnostics-drawer{position:fixed'), 'diagnostics drawer must not use fixed viewport positioning');
assert.ok(!bottomDiagnostics.includes('left:14px;right:14px;bottom:10px'), 'diagnostics drawer must not retain old overlay offsets');

assert.ok(reportExport.includes("EXPORTS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"exports\"]'"), 'report export must target exports shell slot');
assert.ok(reportExport.includes('registerExportsPanel'), 'report export must register with UI shell');
assert.ok(reportExport.includes("setRightPanelTab?.(root, 'exports'"), 'report export must activate Exports tab when opened');
assert.ok(reportExport.includes('MAX_EXPORT_ROWS') && reportExport.includes('MAX_SCAN_OBJECTS'), 'report export must remain bounded');

assert.ok(toolbar.includes('rvm-toolbar-compact-policy-3'), 'toolbar policy must expose internal-toolbar v3 source contract');
assert.ok(toolbar.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-compact-policy-2'"), 'toolbar policy must preserve previous cache evidence');
assert.ok(toolbar.includes("'Navigate / View'") && toolbar.includes("'Review'"), 'toolbar policy must keep primary and review groups top-level');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260626-rvm-toolbar-overflow-controller-1'), 'toolbar policy must use the single overflow owner module');
assert.ok(toolbar.includes('data-rvm-toolbar-more'), 'toolbar policy must create stable More button');
assert.ok(toolbar.includes('data-rvm-tools-menu'), 'toolbar policy must create stable More menu');
assert.ok(!toolbar.includes('<details'), 'More Tools must not depend on native details toggling');
assert.ok(overflow.includes('installRvmToolbarOverflow'), 'overflow controller must expose install lifecycle');
assert.ok(overflow.includes('disposeRvmToolbarOverflow'), 'overflow controller must expose dispose lifecycle');
assert.ok(overflow.includes('syncRvmToolbarOverflow'), 'overflow controller must expose sync lifecycle');
assert.ok(overflow.includes('aria-expanded'), 'overflow controller must own aria-expanded state');
assert.ok(!overflow.includes('MutationObserver'), 'overflow controller must not use MutationObserver as the behavior fix');

assert.ok(stagedExport.includes('SUPPORT_UNAVAILABLE_REASON'), 'support export must have an explicit unavailable reason');
assert.ok(stagedExport.includes('binary-rvm-support-tools-retired'), 'support export must preserve binary RVM retirement policy');
assert.ok(stagedValidation.includes('support-mode-unavailable-for-current-source'), 'support validation must fail clearly when support mode is unavailable');
assert.ok(stagedValidation.includes('supportModeAvailable'), 'support validation must expose a support availability gate');

assert.ok(tab.includes('stampSourcePreviewHierarchy(payload.gltf.scene, source, sourceKind, file.name)'), 'mounted RVM tab must stamp source hierarchy before setModel');
assert.ok(tab.includes('__rvmNonPrimitiveSourceHierarchy') && tab.includes('__rvmNonPrimitiveAutoBendSourceHierarchy'), 'mounted RVM tab must preserve source hierarchy for lazy preview tools');
assert.ok(tab.includes('ensureSourcePreview') && tab.includes("rvmModelPrimitiveMode === 'source-preview'"), 'mounted RVM tab must request source-preview bridges only for source-preview loads');
assert.ok(!uiShell.includes('convertXmlToCii'), 'UI shell must not include XML->CII conversion logic');
assert.ok(!uiShell.includes('xml-cii2019'), 'UI shell must not import XML CII worker logic');
assert.ok(!renderer.includes('installRvmViewerUiShell(RvmViewer3D'), 'UI shell install must not patch RvmViewer3D prototype');

console.log('Verified active RVM viewer runtime cache ownership, Object Browser quick filters, internal toolbar layout, shell slots, deferred bridge ownership, toolbar overflow, diagnostics/export ownership, and XML-CII isolation.');
