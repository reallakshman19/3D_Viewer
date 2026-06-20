import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed += 1;
  } else {
    console.error(`FAIL: ${label}`);
    failed += 1;
  }
}

const patchSource = await fs.readFile(new URL('../rvm-viewer/RvmProgressiveModelRootPatch.js', import.meta.url), 'utf8');
const patchV5Source = await fs.readFile(new URL('../rvm-viewer/RvmProgressiveModelRootPatchV5.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const selectionBridgeSource = await fs.readFile(new URL('../tabs/RvmHierarchySelectionBridge.js', import.meta.url), 'utf8');
const selectionTreeSyncSource = await fs.readFile(new URL('../tabs/RvmSelectionTreeSyncBridge.js', import.meta.url), 'utf8');
const supportSummarySource = await fs.readFile(new URL('../tabs/RvmSupportSummaryBridge.js', import.meta.url), 'utf8');
const supportAssemblySource = await fs.readFile(new URL('../tabs/RvmSupportAssemblyBridge.js', import.meta.url), 'utf8');
const materialModeSource = await fs.readFile(new URL('../tabs/RvmMaterialModeBridge.js', import.meta.url), 'utf8');
const remainingPrimitiveSource = await fs.readFile(new URL('../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js', import.meta.url), 'utf8');
const interactionPatchSource = await fs.readFile(new URL('../tabs/RvmViewerInteractionPatch.js', import.meta.url), 'utf8');
const visibilityToolbarSource = await fs.readFile(new URL('../tabs/RvmVisibilityToolbarBridge.js', import.meta.url), 'utf8');
const nativeTessellationSource = await fs.readFile(new URL('../rvm/BrowserRvmNativeTessellationRuntimePatch.js', import.meta.url), 'utf8');
const dishTessellationSource = await fs.readFile(new URL('../rvm/BrowserRvmDishTessellationRuntimePatch.js', import.meta.url), 'utf8');
const nativeDiagnosticsBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeTessellationDiagnosticsBridge.js', import.meta.url), 'utf8');
const renderContractSource = await fs.readFile(new URL('../rvm/BrowserRvmRenderContractAdapter.js', import.meta.url), 'utf8');
const tabSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const bridgeSource = await fs.readFile(new URL('../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
const workerPatchSource = await fs.readFile(new URL('../rvm/BrowserRvmCppMat3x4WorkerPatch.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const transformParserSource = await fs.readFile(new URL('../rvm/BrowserRvmTransformParser.js', import.meta.url), 'utf8');
const transformHierarchySource = await fs.readFile(new URL('../rvm/BrowserRvmHierarchyTransformParser.js', import.meta.url), 'utf8');
const filterSource = await fs.readFile(new URL('../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');

check(patchSource.includes('pcf-glb-rvm-progressive-model-root-patch-v3'), 'fit patch v3 present');
check(patchSource.includes('rendered-world-bounds'), 'progressive fit uses rendered world bounds');
check(patchSource.includes('renderedBoundsUsed'), 'fit diagnostics expose rendered bounds usage');
check(patchV5Source.includes('rendered-world-bounds-no-hide'), 'v5 fits rendered bounds without hiding meshes');
check(!patchV5Source.includes('visible = false'), 'v5 must not hide fit outliers');
check(rendererSource.includes('RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1'), 'renderer loads no-hide fit patch');
check(rendererSource.includes('RvmHierarchySelectionBridge.js?v=20260620-rvm-large-box-support-sync-1'), 'renderer loads support-sync hierarchy bridge key');
check(rendererSource.includes('RvmViewerInteractionPatch.js?v=20260620-rvm-esc-hide-selection-1'), 'renderer loads Esc/hide/canvas interaction patch');
check(rendererSource.includes('RvmVisibilityToolbarBridge.js?v=20260620-rvm-esc-hide-selection-1'), 'renderer loads injected hide/show toolbar bridge');
check(rendererSource.includes('RvmSelectionTreeSyncBridge.js?v=20260620-rvm-large-box-support-sync-1'), 'renderer loads canvas-tree selection sync bridge');
check(rendererSource.includes('RvmSupportSummaryBridge.js?v=20260620-rvm-support-symbol-mode-1'), 'renderer loads support symbol mode bridge');
check(rendererSource.includes('RvmSupportAssemblyBridge.js?v=20260620-rvm-support-assembly-dish-1'), 'renderer loads support assembly diagnostics bridge');
check(rendererSource.includes('BrowserRvmDishTessellationRuntimePatch.js?v=20260620-rvm-support-assembly-dish-1'), 'renderer loads dish tessellation patch');
check(rendererSource.includes('BrowserRvmRemainingPrimitiveRuntimePatch.js?v=20260620-rvm-remaining-material-modes-1'), 'renderer loads remaining primitive tessellation patch');
check(rendererSource.includes('RvmMaterialModeBridge.js?v=20260620-rvm-remaining-material-modes-1'), 'renderer loads material mode bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-remaining-material-modes-1'), 'renderer loads remaining material modes tab URL');
check(rendererSource.includes('BrowserRvmCppMat3x4WorkerPatch.js?v=20260620-rvm-scale-leak-1'), 'renderer installs scale-leak worker patch');
check(interactionPatchSource.includes('keydown') && interactionPatchSource.includes('Escape') && interactionPatchSource.includes('handleEscape'), 'interaction patch implements robust Esc behavior');
check(interactionPatchSource.includes('VIEW_HIDE_SELECTION') && interactionPatchSource.includes('VIEW_SHOW_HIDDEN'), 'interaction patch handles Hide and Show Hidden actions');
check(interactionPatchSource.includes('installRvmCanvasSelectionBridge') && interactionPatchSource.includes('raycaster.intersectObject'), 'canvas selection bridge raycasts model geometry');
check(interactionPatchSource.includes('fitCurrentSelection') && interactionPatchSource.includes('selectedMeshes'), 'fit selection uses real selected meshes');
check(interactionPatchSource.includes('rvmHiddenByUser') && interactionPatchSource.includes('showHiddenObjects'), 'hide/show tracks user-hidden meshes');
check(selectionTreeSyncSource.includes('installRvmSelectionTreeSyncBridge') && selectionTreeSyncSource.includes('is-canvas-selected') && selectionTreeSyncSource.includes('scrollIntoView'), 'selection tree sync highlights tree row from canvas selection');
check(visibilityToolbarSource.includes('VIEW_HIDE_SELECTION') && visibilityToolbarSource.includes('VIEW_SHOW_HIDDEN') && visibilityToolbarSource.includes('NAV_SELECT'), 'visibility toolbar injects Hide, Show, and Select controls');
check(supportSummarySource.includes('rvm-support-symbol-mode/v1') && supportSummarySource.includes('Raw') && supportSummarySource.includes('Symbol') && supportSummarySource.includes('Both'), 'support summary exposes raw/symbol/both support modes');
check(supportSummarySource.includes('SUPPORT_SYMBOL_ROOT') && supportSummarySource.includes('buildSupportSymbolForObject'), 'support summary renders support glyphs from geometry candidates');
check(supportAssemblySource.includes('rvm-support-assembly/v1') && supportAssemblySource.includes('supportAssemblyCount') && supportAssemblySource.includes('supportContactPointResolvedCount'), 'support assembly bridge exposes grouping/contact diagnostics');
check(supportAssemblySource.includes('groupSupportCandidates') && supportAssemblySource.includes('supportGroupedPrimitiveCount') && supportAssemblySource.includes('supportUngroupedPrimitiveCount'), 'support assembly bridge groups nearby support primitives');
check(supportAssemblySource.includes('SUPPORT_ASSEMBLY_ROOT') && supportAssemblySource.includes('makeAssemblyMarker'), 'support assembly bridge renders contact markers');
check(supportAssemblySource.includes('selectAssembly') && supportAssemblySource.includes('setSelectionFromObjects'), 'support assembly rows select and fit grouped primitives');
check(renderContractSource.includes('v3-support-hints') && renderContractSource.includes('SUPPORT_HINT_RE') && renderContractSource.includes('SUPPORT_BBOX_PLACEHOLDER'), 'render contracts promote support-like RVM objects');
check(remainingPrimitiveSource.includes('browser-rvm-remaining-primitives/v1-pyramid-line-facet-diagnostics'), 'remaining primitive patch exposes schema');
check(remainingPrimitiveSource.includes('pyramidGeometry') && remainingPrimitiveSource.includes('lineBoxGeometry'), 'remaining primitive patch supports PRIM 1 and 10 geometry');
check(remainingPrimitiveSource.includes('facetGroupUnsupportedCount') && remainingPrimitiveSource.includes('facet-group-native-stream-not-decoded'), 'remaining primitive patch reports PRIM 11 facet groups explicitly');
check(remainingPrimitiveSource.includes('matrix4FromCppMat3x4') && remainingPrimitiveSource.includes('native-cpp-remaining-primitive'), 'remaining primitive patch applies Mat3x4 and marks render quality');
check(materialModeSource.includes('Color') && materialModeSource.includes('Type') && materialModeSource.includes('Source') && materialModeSource.includes('Mono'), 'material mode bridge exposes color modes');
check(materialModeSource.includes('browser-rvm-material-mode/v1') && materialModeSource.includes('__PCF_GLB_RVM_MATERIAL_MODE_DIAGNOSTICS__'), 'material mode bridge exposes diagnostics');
check(materialModeSource.includes('TYPE_COLORS') && materialModeSource.includes('classifyObjectType') && materialModeSource.includes('restoreOriginalMaterial'), 'material mode bridge colors by type and restores source materials');
check(nativeTessellationSource.includes('browser-rvm-native-tessellation/v2-diagnostics-toggle'), 'native tessellation diagnostics schema present');
check(dishTessellationSource.includes('browser-rvm-dish-tessellation/v1-cpp-mat3x4'), 'dish tessellation schema present');
check(dishTessellationSource.includes('ellipticalDishGeometry') && dishTessellationSource.includes('sphericalDishGeometry'), 'dish tessellation supports PRIM 5 and 6 geometry');
check(dishTessellationSource.includes('code !== 5 && code !== 6') && dishTessellationSource.includes('matrix4FromCppMat3x4'), 'dish tessellation targets code 5/6 and applies C++ Mat3x4');
check(dishTessellationSource.includes('native-cpp-dish-tessellated'), 'dish tessellation marks render quality');
check(nativeTessellationSource.includes('cylinderGeometry') && nativeTessellationSource.includes('snoutGeometry') && nativeTessellationSource.includes('circularTorusGeometry'), 'native tessellation supports cylinder, snout and torus');
check(nativeTessellationSource.includes('matrix4FromCppMat3x4') && nativeTessellationSource.includes('m[0], m[3], m[6], m[9]'), 'native tessellation applies C++ Mat3x4 transform layout');
check(nativeDiagnosticsBridgeSource.includes('Native Tessellation') && nativeDiagnosticsBridgeSource.includes('Native On') && nativeDiagnosticsBridgeSource.includes('Native Off') && nativeDiagnosticsBridgeSource.includes('Re-run'), 'native diagnostics bridge exposes UI controls');
check(tabSource.includes("BrowserRvmLoadBridge.js?v=20260620-rvm-flat-tree-1"), 'tab keeps flat-tree direct loader while worker URL is patched');
check(tabSource.includes('buildFlatNodeTree') && tabSource.includes('flat: true'), 'RVM tree renders flat selectable rows');
check(!tabSource.includes('const bounds = payload.browserRvmRender?.bounds'), 'tab does not issue duplicate post-load raw-bounds fit');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-remaining-material-modes-1'), 'app loads remaining material modes renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-remaining-material-modes-1'), 'html loads remaining material modes entry');
check(entrySource.includes('core/app.js?v=20260620-rvm-remaining-material-modes-1'), 'entry loads remaining material modes app');
check(workerPatchSource.includes('browser-rvm-worker.js?v=20260620-rvm-scale-leak-1'), 'worker patch redirects to scale-leak worker URL');
check(bridgeSource.includes('browser-rvm-worker.js?v=20260620-rvm-scale-safe-1'), 'base bridge remains scale-safe-compatible');
check(workerSource.includes('BrowserRvmInstructionFilterV2.js?v=20260620-rvm-large-box-filter-1'), 'worker loads large-box side filter');
check(workerSource.includes('BrowserRvmHierarchyTransformParser.js?v=20260620-rvm-scale-leak-1'), 'worker loads scaled-radius hierarchy parser');
check(workerSource.includes('browserRvmCppMat3x4ScaledRadiusApplied'), 'worker exposes scaled-radius diagnostics');
check(transformParserSource.includes('browser-rvm-transform-parser/v3-cpp-mat3x4-scaled-radius'), 'transform parser schema identifies scaled-radius C++ Mat3x4 layout');
check(transformParserSource.includes('validScales.length ? Math.max(...validScales) : 1'), 'transform parser does not clamp downscale factors to 1');
check(transformHierarchySource.includes('BrowserRvmTransformParser.js?v=20260620-rvm-scale-leak-1'), 'transform hierarchy imports scaled-radius parser');
check(transformHierarchySource.includes('v3-scaled-dish-contract'), 'transform wrapper marks scaled dish/flange contract');
check(transformHierarchySource.includes('FLANGE_BBOX_PLACEHOLDER') && transformHierarchySource.includes('DISH_BBOX_PLACEHOLDER'), 'transform wrapper routes code 5/6 away from box fallback');
check(filterSource.includes('browser-rvm-instruction-filter/v3-large-box-side'), 'filter v3 schema present');
check(filterSource.includes('maxPrimitiveBoxSide') && filterSource.includes('oversized-primitive-box-side'), 'filter skips primitive boxes with any side over configured threshold');
check(filterSource.includes('SUPPORT_OWNER_RE') && filterSource.includes('supportLike'), 'filter protects support-like geometry from large-box side skip');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
