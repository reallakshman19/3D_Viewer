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
const rightPanelPolicy = read('tabs/RvmFormatPolicy.js');
const rightPanelBridge = read('tabs/RvmRightPanelFormatPolicyBridge.js');
const sourceToolsUi = read('tabs/RvmNonPrimitiveSourceToolsUiBridge.js');
const selectionDetails = read('tabs/RvmSelectionDetailsInspectorBridge.js');
const formatNeutral = read('tabs/RvmFormatNeutralHierarchy.js');
const toolbar = read('tabs/RvmToolbarCompactBridge.js');
const sourceInput = read('tabs/RvmSourceFormatInputBridge.js');
const navisHierarchy = read('tabs/RvmNavisHierarchyBridge.js');
const hierarchySelection = read('tabs/RvmHierarchySelectionBridge.js');
const selectionSync = read('tabs/RvmSelectionTreeSyncBridge.js');
const drawer = read('tabs/RvmBottomDiagnosticsDrawerBridge.js');

const key = contract.match(/RVM_VIEWER3D_MODULE_CACHE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
assert.ok(key, 'module identity contract must expose RVM_VIEWER3D_MODULE_CACHE_KEY');
const rvmViewerImports = [
  ...renderer.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g),
  ...tab.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g),
].map((match) => match[1].slice(match[1].lastIndexOf('RvmViewer3D.js')));
assert.deepEqual([...new Set(rvmViewerImports)], [`RvmViewer3D.js?v=${key}`], 'renderer and mounted tab must share one RvmViewer3D ES module identity');

assert.ok(renderer.includes('viewer3d-rvm-tab.js?v=20260628-rvm-tab-startup-selection-fix-1'), 'renderer must import current mounted RVM tab key');
assert.ok(renderer.includes('RvmDeferredBridgeLoader.js?v=20260628-rvm-deferred-source-tools-dashboard-1'), 'renderer must import Source Tools dashboard deferred loader key');
assert.ok(renderer.includes('RvmSelectionDetailsInspectorBridge.js?v=20260628-rvm-selected-entity-ui-v2-1'), 'renderer must import selected entity UI v2 key');
assert.ok(!renderer.includes('RvmModelHealthBridge.js?v='), 'renderer must not eagerly import model health bridge');
assert.ok(tab.includes('RvmFormatNeutralHierarchy.js?v=20260628-format-neutral-shared-kind-policy-1'), 'mounted RVM tab must import current format-neutral helper key');
assert.ok(formatNeutral.includes('RvmSourceKindPolicy.js'), 'format-neutral helper must use shared source-kind policy');
assert.ok(formatNeutral.includes('sourceKindFromFileName(fileName)'), 'format-neutral helper must delegate filename classification to shared policy');

assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-scroll-misc-1'"), 'toolbar must expose scroll/misc version');
assert.ok(toolbar.includes("{ id: 'misc', label: 'Misc'"), 'toolbar must define Misc group');
assert.ok(toolbar.includes('overflow-x:auto'), 'toolbar must scroll horizontally when expanded buttons overflow');
assert.ok(deferredLoader.includes('20260628-rvm-deferred-source-tools-dashboard-1'), 'deferred loader must expose Source Tools dashboard key');
assert.ok(deferredLoader.includes('20260628-rvm-deferred-right-panel-ui-v2-1'), 'deferred loader must retain previous right panel UI v2 key');
assert.ok(deferredLoader.includes('RvmRightPanelFormatPolicyBridge.js?v=20260628-rvm-right-panel-ui-v2-1'), 'deferred loader must import right panel UI v2 bridge with cache key');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSourceToolsUiBridge.js?v=20260628-rvm-source-tools-dashboard-1'), 'deferred loader must import Source Tools dashboard bridge with cache key');
assert.ok(deferredLoader.includes('right-panel-policy-sync'), 'source-preview refresh must resync the right panel policy');

assert.ok(sourceToolsUi.includes('rvm-non-primitive-source-tools-ui/v9-dashboard'), 'Source Tools UI must expose dashboard schema');
assert.ok(sourceToolsUi.includes('data-source-tools-layout="dashboard-v3"'), 'Source Tools UI must render dashboard layout marker');
assert.ok(sourceToolsUi.includes('rvm-source-tools-dashboard-strip'), 'Source Tools UI must render dashboard strip');
assert.ok(sourceToolsUi.includes('rvm-source-tools-tile'), 'Source Tools UI must render status tiles');
assert.ok(sourceToolsUi.includes('data-source-tools-group="auto-bend"'), 'Source Tools UI must group Auto Bend controls');
assert.ok(sourceToolsUi.includes('data-source-tools-group="support-overlay"'), 'Source Tools UI must group Support Overlay controls');
assert.ok(sourceToolsUi.includes('data-state="${escapeHtml(autoState)}"'), 'Source Tools UI must expose active/inactive auto state');
assert.ok(sourceToolsUi.includes('data-state="${escapeHtml(supportState)}"'), 'Source Tools UI must expose support state');
assert.ok(sourceToolsUi.includes('Apply axis'), 'Source Tools UI must keep compact axis apply control');

assert.ok(selectionDetails.includes('20260628-rvm-selected-entity-ui-v2-1'), 'selection details bridge must expose selected entity UI v2 version');
assert.ok(selectionDetails.includes('Selected Entity'), 'selection details bridge must render selected entity title');
assert.ok(selectionDetails.includes('data-rvm-selection-details-ui'), 'selection details bridge must stamp UI version');
assert.ok(selectionDetails.includes('data-rvm-selection-source'), 'selection details bridge must expose canvas/hierarchy source marker');
assert.ok(selectionDetails.includes('selectionSource(objects)'), 'selection details bridge must compute selection source');
assert.ok(selectionDetails.includes('rvm-selection-kpi-strip'), 'selection details bridge must render KPI strip');
assert.ok(selectionDetails.includes('data-rvm-selection-kpis'), 'selection details bridge must expose KPI marker');
assert.ok(selectionDetails.includes('rvm-selection-empty-state'), 'selection details bridge must render improved empty state');
assert.ok(selectionDetails.includes('previousVersion: PREVIOUS_VERSION'), 'selection details API must expose previous version');

assert.ok(rightPanelPolicy.includes('RVM_RIGHT_PANEL_SECTIONS'), 'format policy must expose explicit right panel sections');
assert.ok(rightPanelPolicy.includes('STAGEDJSON_REVIEW'), 'format policy must expose stagedJSON review section');
assert.ok(rightPanelPolicy.includes('NATIVE_DIAGNOSTICS'), 'format policy must expose native diagnostics section');
assert.ok(rightPanelPolicy.includes("mode === 'source-preview'"), 'format policy must only allow source-preview policy in source-preview mode');
assert.ok(rightPanelPolicy.includes('getRvmRightPanelSections'), 'format policy must expose section helpers');
assert.ok(rightPanelPolicy.includes('fileKind === \'stagedjson\''), 'format policy must prefer stagedJSON filename when loader stamped generic json');

assert.ok(rightPanelBridge.includes("rvm-right-panel-format-policy/v4-ui"), 'right panel bridge must expose UI v2 schema');
assert.ok(rightPanelBridge.includes("20260628-rvm-right-panel-ui-v2-1"), 'right panel bridge must expose UI v2 version');
assert.ok(rightPanelBridge.includes('PANEL_META'), 'right panel bridge must define section metadata');
assert.ok(rightPanelBridge.includes('rvm-right-panel-v2'), 'right panel bridge must install right panel v2 class');
assert.ok(rightPanelBridge.includes('rvm-right-section-card'), 'right panel bridge must render card-style sections');
assert.ok(rightPanelBridge.includes('rvm-right-section-badge'), 'right panel bridge must render section badges');
assert.ok(rightPanelBridge.includes('decorateRightPanelUi'), 'right panel bridge must decorate existing sections after ordering');
assert.ok(rightPanelBridge.includes('rvmRightPanelUiDecorated'), 'right panel bridge must stamp UI decoration count');
assert.ok(rightPanelBridge.includes('Right Panel'), 'right panel bridge must render section policy panel');
assert.ok(rightPanelBridge.includes('applyRightPanelSectionPolicy'), 'right panel bridge must apply section policy');
assert.ok(rightPanelBridge.includes('orderRightPanelSections'), 'right panel bridge must order panel sections');
assert.ok(rightPanelBridge.includes('hideEmptyRightPanelHeaders'), 'right panel bridge must hide empty headers');
assert.ok(rightPanelBridge.includes('rvmRightPanelOrdered'), 'right panel bridge must stamp ordering diagnostics');
assert.ok(rightPanelBridge.includes('rvmRightPanelEmptyHeadersHidden'), 'right panel bridge must stamp empty-header diagnostics');
assert.ok(rightPanelBridge.includes('data-rvm-stagedjson-kpis'), 'stagedJSON review must expose KPI row');
assert.ok(rightPanelBridge.includes('rvm-stagedjson-card--clear'), 'stagedJSON review must use clearer card style');
assert.ok(rightPanelBridge.includes('rvm-source-tools-grid--grouped') || rightPanelBridge.includes('rvm-source-tools-grid--dashboard'), 'right panel layout must keep compact Source Tools styling hook');
assert.ok(rightPanelBridge.includes('Selected Entity'), 'right panel bridge must rename RVM-only selection title to generic selected entity');
assert.ok(rightPanelBridge.includes('Copy JSON') && rightPanelBridge.includes('download-stagedjson'), 'stagedJSON right panel must expose clearer copy/download actions');

assert.ok(sourceInput.includes("'.stagedjson'") && sourceInput.includes("'.staged.json'") && sourceInput.includes("'.txt'"), 'source file input bridge must accept stagedJSON and txt source formats');
assert.ok(renderer.includes('RvmHierarchySelectionBridge.js?v=20260627-rvm-hierarchy-navis-safe-1'), 'renderer must import Navis-safe hierarchy selection bridge');
assert.ok(hierarchySelection.includes('NAVIS_CONTROL_SELECTOR'), 'legacy hierarchy selection must not intercept Navis controls');
assert.ok(navisHierarchy.includes('shouldPreserveFormatNeutralTree'), 'Navis bridge must not overwrite source-owned format-neutral tree');
assert.ok(selectionSync.includes('rvm-tab-dispose'), 'hierarchy sync bridge must clean up on tab disposal');
assert.ok(drawer.includes('root.insertBefore(drawer, statusbar)'), 'drawer must dock before status bar');

console.log('Verified RVM viewer UI contract: Source Tools dashboard and Selected Entity UI.');
