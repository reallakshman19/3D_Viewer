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
const supportDetailsBridge = read('tabs/RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js');
const supportDetailsPanel = read('overlays/support/SupportOverlayDetailsPanel.js');
const selectionDetails = read('tabs/RvmSelectionDetailsInspectorBridge.js');
const providerSelectionParity = read('tabs/RvmHierarchyProviderSelectionParityBridge.js');
const formatNeutral = read('tabs/RvmFormatNeutralHierarchy.js');
const toolbar = read('tabs/RvmToolbarCompactBridge.js');
const sourceInput = read('tabs/RvmSourceFormatInputBridge.js');
const navisHierarchy = read('tabs/RvmNavisHierarchyBridge.js');
const hierarchySelection = read('tabs/RvmHierarchySelectionBridge.js');
const exactSelection = read('tabs/RvmFormatNeutralExactSelectionBridge.js');
const hierarchySmartGrid = read('tabs/RvmHierarchySmartGridBridge.js');
const hierarchyCheckbox = read('tabs/RvmHierarchyCheckboxMultiSelectBridge.js');
const zoneLodContext = read('tabs/RvmZoneLodContextBridge.js');
const workerFirst = read('rvm-viewer/RvmBrowserRvmWorkerFirstBridge.js');
const selectionSync = read('tabs/RvmSelectionTreeSyncBridge.js');
const drawer = read('tabs/RvmBottomDiagnosticsDrawerBridge.js');

const key = contract.match(/RVM_VIEWER3D_MODULE_CACHE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
assert.ok(key, 'module identity contract must expose RVM_VIEWER3D_MODULE_CACHE_KEY');
const rvmViewerImports = [
  ...renderer.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g),
  ...tab.matchAll(/from\s+["']([^"']*RvmViewer3D\.js\?v=[^"']+)["']/g),
].map((match) => match[1].slice(match[1].lastIndexOf('RvmViewer3D.js')));
assert.deepEqual([...new Set(rvmViewerImports)], [`RvmViewer3D.js?v=${key}`], 'renderer and mounted tab must share one RvmViewer3D ES module identity');

assert.ok(renderer.includes('viewer3d-rvm-tab.js?v=20260630-rvm-hierarchy-path-context-1'), 'renderer must import current mounted RVM tab key');
assert.ok(renderer.includes('RvmDeferredBridgeLoader.js?v=20260628-rvm-deferred-source-tools-dashboard-1'), 'renderer must import Source Tools dashboard deferred loader key');
assert.ok(renderer.includes('RvmSelectionDetailsInspectorBridge.js?v=20260628-rvm-selected-entity-ui-v2-1'), 'renderer must import selected entity UI v2 key');
assert.ok(renderer.includes('RvmHierarchyProviderSelectionParityBridge.js?v=20260629-rvm-provider-selection-parity-1'), 'renderer must import provider selection parity bridge');
assert.ok(renderer.includes('installRvmHierarchyProviderSelectionParityBridge()'), 'renderer must install provider selection parity bridge');

assert.ok(!renderer.includes('RvmModelHealthBridge.js?v='), 'renderer must not eagerly import model health bridge');
assert.ok(tab.includes('RvmFormatNeutralHierarchy.js?v=20260628-format-neutral-shared-kind-policy-1'), 'mounted RVM tab must import current format-neutral helper key');
assert.ok(formatNeutral.includes('RvmSourceKindPolicy.js'), 'format-neutral helper must use shared source-kind policy');
assert.ok(formatNeutral.includes('sourceKindFromFileName(fileName)'), 'format-neutral helper must delegate filename classification to shared policy');

assert.ok(providerSelectionParity.includes("RVM_HIERARCHY_PROVIDER_SELECTION_PARITY_VERSION = '20260629-rvm-provider-selection-parity-1'"), 'provider selection parity bridge must expose version');
assert.ok(providerSelectionParity.includes('computeHierarchyProviderSelectionParity'), 'provider selection parity bridge must export compute helper');
assert.ok(providerSelectionParity.includes('rvm-hierarchy-provider-selection-parity'), 'provider selection parity bridge must emit parity diagnostics event');
assert.ok(providerSelectionParity.includes('rvmHierarchyProviderSelectionMismatchCount'), 'provider selection parity bridge must stamp mismatch count');
assert.ok(providerSelectionParity.includes('selectedMissingInProvider'), 'provider selection parity bridge must report selected IDs missing in provider nodes');
assert.ok(providerSelectionParity.includes('selectedMissingInRender'), 'provider selection parity bridge must report selected IDs missing in render aliases');
assert.ok(providerSelectionParity.includes('matchedRenderCount'), 'provider selection parity bridge must report render match count');
assert.ok(providerSelectionParity.includes('providerDuplicateCount'), 'provider selection parity bridge must report provider duplicate IDs');
assert.ok(providerSelectionParity.includes('Provider Selection Parity'), 'provider selection parity bridge must render debug panel title');
assert.ok(providerSelectionParity.includes('rvm-selection-synced-to-tree'), 'provider selection parity bridge must refresh after tree sync');
assert.ok(providerSelectionParity.includes('rvm-canvas-selection'), 'provider selection parity bridge must refresh after canvas selection');

assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-scroll-misc-1'"), 'toolbar must expose scroll/misc version');
assert.ok(toolbar.includes("{ id: 'misc', label: 'Misc'"), 'toolbar must define Misc group');
assert.ok(toolbar.includes('overflow-x:auto'), 'toolbar must scroll horizontally when expanded buttons overflow');
assert.ok(deferredLoader.includes('20260629-rvm-deferred-support-details-polish-1'), 'deferred loader must expose support details polish key');
assert.ok(deferredLoader.includes('20260628-rvm-deferred-source-tools-dashboard-1'), 'deferred loader must retain previous Source Tools dashboard key');
assert.ok(deferredLoader.includes('RvmRightPanelFormatPolicyBridge.js?v=20260628-rvm-right-panel-ui-v2-1'), 'deferred loader must import right panel UI v2 bridge with cache key');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSourceToolsUiBridge.js?v=20260628-rvm-source-tools-dashboard-1'), 'deferred loader must import Source Tools dashboard bridge with cache key');
assert.ok(deferredLoader.includes('RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260629-rvm-support-details-polish-1'), 'deferred loader must import support details polish bridge with cache key');
assert.ok(deferredLoader.includes('right-panel-policy-sync'), 'source-preview refresh must resync the right panel policy');

assert.ok(supportDetailsBridge.includes('rvm-non-primitive-support-overlay-details-panel/v5-polish'), 'support details bridge must expose polish schema');
assert.ok(supportDetailsBridge.includes('SupportOverlayDetailsPanel.js?v=20260629-support-details-polish-1'), 'support details bridge must cache-bust polished renderer dependency');
assert.ok(supportDetailsBridge.includes('rvm-support-details-kpi-row'), 'support details bridge must style compact KPI row');
assert.ok(supportDetailsBridge.includes('rvm-support-kind-badge'), 'support details bridge must style support kind badges');
assert.ok(supportDetailsBridge.includes('rvm-support-details-raw'), 'support details bridge must style collapsible raw details');
assert.ok(supportDetailsBridge.includes('dataset.supportDetailsUi'), 'support details bridge must stamp UI schema');
assert.ok(supportDetailsPanel.includes('support-overlay-details-panel/v4-polish'), 'support details panel must expose polished schema');
assert.ok(supportDetailsPanel.includes('rvm-support-details-card--compact'), 'support details panel must render compact card');
assert.ok(supportDetailsPanel.includes('data-support-details-kpis'), 'support details panel must expose KPI marker');
assert.ok(supportDetailsPanel.includes('rvm-support-kind-badge'), 'support details panel must render kind badge');
assert.ok(supportDetailsPanel.includes('Raw source attributes'), 'support details panel must hide raw attrs under details');

assert.ok(sourceToolsUi.includes('rvm-non-primitive-source-tools-ui/v9-dashboard'), 'Source Tools UI must expose dashboard schema');
assert.ok(sourceToolsUi.includes('data-source-tools-layout="dashboard-v3"'), 'Source Tools UI must render dashboard layout marker');
assert.ok(sourceToolsUi.includes('rvm-source-tools-dashboard-strip'), 'Source Tools UI must render dashboard strip');
assert.ok(sourceToolsUi.includes('rvm-source-tools-tile'), 'Source Tools UI must render status tiles');
assert.ok(sourceToolsUi.includes('data-source-tools-group="auto-bend"'), 'Source Tools UI must group Auto Bend controls');
assert.ok(sourceToolsUi.includes('data-source-tools-group="support-overlay"'), 'Source Tools UI must group Support Overlay controls');
assert.ok(sourceToolsUi.includes('data-state="${escapeHtml(autoState)}"'), 'Source Tools UI must expose active/inactive auto state');
assert.ok(sourceToolsUi.includes('data-state="${escapeHtml(supportState)}"'), 'Source Tools UI must expose support state');
assert.ok(sourceToolsUi.includes('Apply axis'), 'Source Tools UI must keep compact axis apply control');

assert.ok(selectionDetails.includes('20260629-rvm-selected-entity-restore-1'), 'selection details bridge must expose restored selected entity UI version');
assert.ok(selectionDetails.includes('20260629-rvm-selection-details-syntax-fix-1'), 'selection details bridge must preserve syntax-fix predecessor version');
assert.ok(selectionDetails.includes('Selected Entity'), 'selection details bridge must render selected entity title');
assert.ok(selectionDetails.includes('data-rvm-selection-details-ui'), 'selection details bridge must stamp UI version');
assert.ok(selectionDetails.includes('data-rvm-selection-source'), 'selection details bridge must expose canvas/hierarchy source marker');
assert.ok(selectionDetails.includes('selectionSource(objects)'), 'selection details bridge must compute selection source');
assert.ok(selectionDetails.includes('rvm-selection-kpi-strip'), 'selection details bridge must render KPI strip');
assert.ok(selectionDetails.includes('data-rvm-selection-kpis'), 'selection details bridge must expose KPI marker');
assert.ok(selectionDetails.includes('rvm-selection-empty-state'), 'selection details bridge must render improved empty state');
assert.ok(selectionDetails.includes('data-rvm-selection-detail-action="fit-selection"'), 'selection details bridge must restore action row');
assert.ok(selectionDetails.includes('normalizePath(value)'), 'selection details bridge must safely normalize paths');
assert.ok(selectionDetails.includes("split('\\\\').join('/')"), 'selection details bridge must avoid malformed backslash regex');
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
assert.ok(renderer.includes('RvmHierarchySelectionBridge.js?v=20260630-rvm-hierarchy-exact-rvm-1'), 'renderer must import native-RVM exact hierarchy pass-through bridge');
assert.ok(renderer.includes('RvmFormatNeutralExactSelectionBridge.js?v=20260630-rvm-format-neutral-exact-rvm-1'), 'renderer must import native-RVM exact selection bridge');
assert.ok(renderer.includes('RvmZoneLodContextBridge.js?v=20260630-rvm-zone-lod-context-3'), 'renderer must import current hierarchy context menu bridge');
assert.ok(renderer.includes('RvmHierarchySmartGridBridge.js?v=20260630-rvm-hierarchy-path-grid-2'), 'renderer must import current hierarchy path smart grid bridge');
assert.ok(renderer.includes('RvmHierarchyCheckboxMultiSelectBridge.js?v=20260630-rvm-hierarchy-checkbox-tree-controls-1'), 'renderer must import current checkbox tree controls bridge');
assert.ok(hierarchySelection.includes('NAVIS_CONTROL_SELECTOR'), 'legacy hierarchy selection must not intercept Navis controls');
assert.ok(hierarchySelection.includes('isFormatNeutralRvmTree'), 'legacy hierarchy selection must pass native RVM rows to exact source selection');
assert.ok(exactSelection.includes("'rvm'"), 'exact source selection must handle native RVM hierarchy rows');
assert.ok(exactSelection.includes('isNativeRvmSource(root)'), 'exact source selection must identify native RVM mode');
assert.ok(exactSelection.includes('!nativeRvm'), 'native RVM exact selection must not use label fallback matching');
assert.ok(exactSelection.includes('RVM_BYTE_OFFSET'), 'native RVM exact selection must include stable byte offset aliases when available');
assert.ok(navisHierarchy.includes('shouldPreserveFormatNeutralTree'), 'Navis bridge must not overwrite source-owned format-neutral tree');
assert.ok(tab.includes("recursive: true, sourceKind: 'rvm'"), 'direct RVM load must render parent/child hierarchy instead of forcing flat rows');
assert.ok(tab.includes('data-rvm-tree-path'), 'mounted RVM tree rows must expose readable parent path text');
assert.ok(workerFirst.includes('data-rvm-tree-path'), 'worker-first RVM tree rows must expose readable parent path text');
assert.ok(workerFirst.includes('function pathLabel'), 'worker-first RVM tree must derive parent > child path labels');
assert.ok(hierarchySmartGrid.includes('20260630-rvm-hierarchy-path-grid-2'), 'smart grid bridge must expose hierarchy path UI version');
assert.ok(hierarchySmartGrid.includes('ensurePathLabel'), 'smart grid bridge must add path labels for rows missing rendered path spans');
assert.ok(hierarchySmartGrid.includes('.rvm-tree-path'), 'smart grid bridge must style hierarchy breadcrumb paths');
assert.ok(hierarchyCheckbox.includes('grid-template-columns:18px 18px minmax(0,1fr) max-content'), 'checkbox multiselect rows must reserve expander and checkbox columns');
assert.ok(hierarchyCheckbox.includes('> ul{grid-column:3 / -1;'), 'checkbox multiselect rows must align child tree branches under labels');
assert.ok(zoneLodContext.includes("new Set(['hidden', '25', '50', '100', '250'])"), 'zone context menu must support render percentage choices including 250');
assert.ok(zoneLodContext.includes('rvm-hierarchy-lod-action'), 'zone context menu must support checked hierarchy render-detail actions');
assert.ok(zoneLodContext.includes('formatNeutralModelForRoot'), 'zone context menu must support format-neutral tree rows');
assert.ok(zoneLodContext.includes('selectedContextNodes'), 'zone context menu must apply to checked hierarchy rows when right-clicking a selected zone');
assert.ok(zoneLodContext.includes('objectMatchesIds'), 'zone context menu must match hierarchy rows through object aliases');
assert.ok(zoneLodContext.includes('.rvm-tree-node.has-zone-lod-override'), 'zone context menu must mark format-neutral tree rows with render percentage overrides');
assert.ok(selectionSync.includes('rvm-tab-dispose'), 'hierarchy sync bridge must clean up on tab disposal');
assert.ok(drawer.includes('root.insertBefore(drawer, statusbar)'), 'drawer must dock before status bar');

console.log('Verified RVM viewer UI contract: support details polish, Source Tools dashboard, Selected Entity UI, and provider selection parity.');
