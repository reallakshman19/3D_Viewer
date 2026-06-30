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
const rightPanelPartition = read('tabs/RvmRightPanelPartitionBridge.js');
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
const dynamicChildCheckbox = read('tabs/RvmHierarchyDynamicChildCheckboxBridge.js');
const visualQualityControls = read('tabs/RvmVisualQualityControlsBridge.js');
const zoneDensitySelector = read('tabs/RvmZoneDensitySelectorBridgeV5.js');
const zoneLodContext = read('tabs/RvmZoneLodContextBridge.js');
const code4ElbowRender = read('rvm/BrowserRvmCode4ElbowRenderBridge.js');
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
assert.ok(renderer.includes('RvmZoneDensitySelectorBridgeV5.js?v=20260630-rvm-visual-quality-selector-1'), 'renderer must import Visual Quality large-load selector key');
assert.ok(renderer.includes('RvmZoneLodContextBridge.js?v=20260630-rvm-visual-quality-context-1'), 'renderer must import Visual Quality context bridge key');
assert.ok(renderer.includes('RvmVisualQualityControlsBridge.js?v=20260630-rvm-visual-quality-controls-1'), 'renderer must import Visual Quality controls bridge');
assert.ok(renderer.includes('installRvmVisualQualityControlsBridge()'), 'renderer must install Visual Quality controls bridge');
assert.ok(!renderer.includes('RvmModelHealthBridge.js?v='), 'renderer must not eagerly import model health bridge');

assert.ok(tab.includes('RvmFormatNeutralHierarchy.js?v=20260628-format-neutral-shared-kind-policy-1'), 'mounted RVM tab must import current format-neutral helper key');
assert.ok(formatNeutral.includes('RvmSourceKindPolicy.js'), 'format-neutral helper must use shared source-kind policy');
assert.ok(formatNeutral.includes('sourceKindFromFileName(fileName)'), 'format-neutral helper must delegate filename classification to shared policy');
assert.ok(providerSelectionParity.includes('computeHierarchyProviderSelectionParity'), 'provider selection parity bridge must export compute helper');
assert.ok(providerSelectionParity.includes('rvm-canvas-selection'), 'provider selection parity bridge must refresh after canvas selection');
assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-scroll-misc-1'"), 'toolbar must expose scroll/misc version');
assert.ok(toolbar.includes("{ id: 'misc', label: 'Misc'"), 'toolbar must define Misc group');
assert.ok(toolbar.includes('overflow-x:auto'), 'toolbar must scroll horizontally when expanded buttons overflow');
assert.ok(deferredLoader.includes('20260629-rvm-deferred-support-details-polish-1'), 'deferred loader must expose support details polish key');
assert.ok(deferredLoader.includes('20260628-rvm-deferred-source-tools-dashboard-1'), 'deferred loader must retain previous Source Tools dashboard key');
assert.ok(deferredLoader.includes('RvmRightPanelPartitionBridge.js?v=20260630-rvm-right-panel-partition-1'), 'deferred loader must install strict right-panel partition bridge');
assert.ok(deferredLoader.includes('RvmHierarchyDynamicChildCheckboxBridge.js?v=20260630-rvm-hierarchy-dynamic-child-checkbox-1'), 'deferred loader must install dynamic child checkbox bridge');
assert.ok(deferredLoader.includes('BrowserRvmCode4ElbowRenderBridge.js?v=20260630-rvm-code4-elbow-native-overlay-1'), 'deferred loader must install code 4 native elbow overlay bridge');
assert.ok(deferredLoader.includes('right-panel-policy-sync'), 'source-preview refresh must resync the right panel policy');
assert.ok(supportDetailsBridge.includes('rvm-non-primitive-support-overlay-details-panel/v5-polish'), 'support details bridge must expose polish schema');
assert.ok(supportDetailsPanel.includes('support-overlay-details-panel/v4-polish'), 'support details panel must expose polished schema');
assert.ok(sourceToolsUi.includes('rvm-non-primitive-source-tools-ui/v9-dashboard'), 'Source Tools UI must expose dashboard schema');
assert.ok(selectionDetails.includes('Selected Entity'), 'selection details bridge must render selected entity title');
assert.ok(selectionDetails.includes('data-rvm-selection-detail-action="fit-selection"'), 'selection details bridge must restore action row');
assert.ok(rightPanelPolicy.includes('RVM_RIGHT_PANEL_SECTIONS'), 'format policy must expose explicit right panel sections');
assert.ok(rightPanelBridge.includes('Selected Entity'), 'right panel bridge must rename RVM-only selection title to generic selected entity');
assert.ok(rightPanelBridge.includes('Copy JSON') && rightPanelBridge.includes('download-stagedjson'), 'stagedJSON right panel must expose clearer copy/download actions');
assert.ok(rightPanelPartition.includes('#rvm-tags-panel'), 'partition bridge must route tags tab by explicit panel id');
assert.ok(rightPanelPartition.includes('#rvm-browser-parse-diagnostics'), 'partition bridge must route diagnostics tab by explicit panel id');
assert.ok(rightPanelPartition.includes('#rvm-attributes-panel'), 'partition bridge must route properties tab by explicit panel id');
assert.ok(rightPanelPartition.includes('sanitizeTab(root, \'tags\''), 'partition bridge must prevent diagnostics from staying in Tags');
assert.ok(rightPanelPartition.includes('sanitizeTab(root, \'diagnostics\''), 'partition bridge must prevent Tags from staying in Diagnostics');
assert.ok(sourceInput.includes("'.stagedjson'") && sourceInput.includes("'.staged.json'") && sourceInput.includes("'.txt'"), 'source file input bridge must accept stagedJSON and txt source formats');

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
assert.ok(hierarchySmartGrid.includes('20260630-rvm-hierarchy-path-grid-compact-font-1'), 'smart grid bridge must expose compact hierarchy path UI version');
assert.ok(hierarchySmartGrid.includes('font-size:9px'), 'smart grid bridge must reduce hierarchy text size');
assert.ok(hierarchyCheckbox.includes('grid-template-columns:18px 18px minmax(0,1fr) max-content'), 'checkbox multiselect rows must reserve expander and checkbox columns');
assert.ok(hierarchyCheckbox.includes('> ul{grid-column:3 / -1;'), 'checkbox multiselect rows must align child tree branches under labels');
assert.ok(dynamicChildCheckbox.includes('ensureRowCheckbox'), 'dynamic child checkbox bridge must inject missing child checkboxes');
assert.ok(dynamicChildCheckbox.includes('onCheckboxChange'), 'dynamic child checkbox bridge must cascade parent checkbox changes');
assert.ok(dynamicChildCheckbox.includes('indeterminate'), 'dynamic child checkbox bridge must mark partial parent rows');
assert.ok(code4ElbowRender.includes('RVM_NATIVE_PRIMITIVE_PARAMS'), 'code 4 elbow render bridge must use native primitive params');
assert.ok(code4ElbowRender.includes('RVM_TRANSFORM_3X4'), 'code 4 elbow render bridge must use native transform matrix');
assert.ok(code4ElbowRender.includes('TubeGeometry'), 'code 4 elbow render bridge must render a visible tube arc');
assert.ok(code4ElbowRender.includes('normalizeAngle'), 'code 4 elbow render bridge must normalize RVM angle units');

assert.ok(visualQualityControls.includes("['full', 'Full']"), 'Visual Quality controls must expose Full option');
assert.ok(visualQualityControls.includes("['medium', 'Medium']"), 'Visual Quality controls must expose Medium option');
assert.ok(visualQualityControls.includes("['light', 'Light']"), 'Visual Quality controls must expose Light option');
assert.ok(visualQualityControls.includes("['skeleton', 'Skeleton']"), 'Visual Quality controls must expose Skeleton option');
assert.ok(visualQualityControls.includes("['hidden', 'Hidden']"), 'Visual Quality controls must expose Hidden option');
assert.ok(visualQualityControls.includes('Apply Quality'), 'Visual Quality controls must rename Apply Render to Apply Quality');
assert.ok(zoneDensitySelector.includes('Large RVM load: choose hierarchy zones and Visual Quality'), 'large-load popup must explain Visual Quality');
assert.ok(zoneDensitySelector.includes('Light/Skeleton reduce visual effort instead of hiding 50% of objects'), 'large-load popup must reject percent-as-hidden semantics');
assert.ok(zoneDensitySelector.includes('RVM_BROWSER_VISUAL_QUALITY'), 'large-load selector must stamp Visual Quality on instructions');
assert.ok(zoneLodContext.includes("new Set(['full', 'medium', 'light', 'skeleton', 'hidden'"), 'context menu must support Visual Quality values');
assert.ok(zoneLodContext.includes('applyObjectVisualQuality'), 'context menu must apply visual quality to existing canvas objects');
assert.ok(zoneLodContext.includes('MeshBasicMaterial'), 'Visual Quality should use lower-cost material classes');
assert.ok(zoneLodContext.includes('rvm-hierarchy-lod-action'), 'zone context menu must support checked hierarchy render-detail actions');
assert.ok(zoneLodContext.includes('formatNeutralModelForRoot'), 'zone context menu must support format-neutral tree rows');
assert.ok(zoneLodContext.includes('selectedContextNodes'), 'zone context menu must apply to checked hierarchy rows when right-clicking a selected zone');
assert.ok(zoneLodContext.includes('objectMatchesIds'), 'zone context menu must match hierarchy rows through object aliases');
assert.ok(zoneLodContext.includes('.rvm-tree-node.has-zone-lod-override'), 'zone context menu must mark format-neutral tree rows with Visual Quality overrides');
assert.ok(selectionSync.includes('rvm-tab-dispose'), 'hierarchy sync bridge must clean up on tab disposal');
assert.ok(selectionSync.includes('selectedAliasGroups'), 'hierarchy sync bridge must map canvas multi-selection to tree rows');
assert.ok(selectionSync.includes('is-canvas-selected'), 'hierarchy sync bridge must visually mark canvas-selected tree rows');
assert.ok(selectionSync.includes('RVM_NATIVE_CONTAINER_PARENT'), 'hierarchy sync bridge must match native owner aliases');
assert.ok(drawer.includes('root.insertBefore(drawer, statusbar)'), 'drawer must dock before status bar');

console.log('Verified RVM viewer UI contract: code 4 elbow overlay, dynamic child checkboxes, right-panel partition, Visual Quality controls, Source Tools dashboard, Selected Entity UI, and provider selection parity.');
