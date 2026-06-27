import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}
async function read(path) { return fs.readFile(new URL(path, import.meta.url), 'utf8'); }

const rendererSource = await read('../tabs/viewer3d-rvm-tab-renderer.js');
const appSource = await read('../core/app.js');
const runtimeSource = await read('../core/app-label-perf-runtime.js');
const entrySource = await read('../main-rhbg-fitguard.js');
const indexSource = await read('../index.html');
const tabSource = await read('../tabs/viewer3d-rvm-tab.js');
const deferredLoaderSource = await read('../tabs/RvmDeferredBridgeLoader.js');
const hierarchySource = await read('../tabs/RvmHierarchySelectionBridge.js');
const smartGridSource = await read('../tabs/RvmHierarchySmartGridBridge.js');
const treeSyncSource = await read('../tabs/RvmSelectionTreeSyncBridge.js');
const interactionSource = await read('../tabs/RvmViewerInteractionPatch.js');
const toolbarSource = await read('../tabs/RvmToolbarCompactBridge.js');
const toolbarPointerSource = await read('../tabs/RvmGroupedToolbarPointerBridge.js');
const overflowSource = await read('../tabs/RvmToolbarOverflowController.js');
const tabClickBridgeSource = await read('../core/app-tab-click-state-bridge.js');
const modelConvertersSource = await read('../tabs/model-converters/ModelConvertersTab.js');
const finaliseRunSource = await read('../tabs/model-converters/xml-cii-finalise-run-button.js');
const loadSource = await read('../rvm/BrowserRvmLoadBridge.js');
const renderBuilderSource = await read('../rvm/BrowserRvmRenderSceneBuilder.js');
const workerSource = await read('../rvm/browser-rvm-worker.js');
const nativeFacetSource = await read('../rvm/BrowserRvmNativeFacetGroupPrimary.js');
const smartCivilFacetSource = await read('../rvm/BrowserRvmSmartCivilFacetPolicy.js');
const remainingPrimitiveSource = await read('../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js');
const facetGhostSource = await read('../rvm/BrowserRvmNativeFacetGhostPanelPatch.js');
const healthSource = await read('../tabs/RvmModelHealthBridge.js');
const healthIssuesSource = await read('../tabs/RvmModelHealthIssuesBridge.js');
const reportSource = await read('../tabs/RvmReportExportBridge.js');
const pcfSource = await read('../tabs/RvmJsonPcfTriggerBridge.js');
const visibilitySource = await read('../tabs/RvmVisibilityToolbarBridge.js');
const setsSource = await read('../tabs/RvmSelectionSetsBridge.js');
const sectionSource = await read('../tabs/RvmSectionBoxBridge.js');
const measureSource = await read('../tabs/RvmMeasureBridge.js');
const searchSource = await read('../tabs/RvmObjectSearchBridge.js');
const labelsSource = await read('../tabs/RvmLabelPerformanceBridge.js');
const zoneSource = await read('../tabs/RvmZoneLodLabelBridge.js');
const deepPathSource = await read('../tabs/RvmDeepSourcePathRecoveryBridge.js');
const zoneDensityV5Source = await read('../tabs/RvmZoneDensitySelectorBridgeV5.js');
const geometricFallbackSource = await read('../rvm/BrowserRvmGeometricFallbackPolicyBridge.js');
const singlePickGuardSource = await read('../tabs/RvmCanvasSelectionSinglePickGuardBridge.js');

for (const eagerForbidden of ['RvmModelHealthBridge.js?v=', 'RvmModelHealthIssuesBridge.js?v=', 'RvmObjectSearchBridge.js?v=', 'RvmVisibilitySnapshotsBridge.js?v=', 'RvmSelectionSetsBridge.js?v=', 'RvmReportExportBridge.js?v=', 'RvmNonPrimitiveSupportOverlayBridge.js?v=', 'RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=', 'RvmNonPrimitiveSupportOverlayHoverBridge.js?v=', 'RvmNonPrimitiveAutoBendBridge.js?v=', 'RvmNonPrimitiveSourceToolsUiBridge.js?v=']) {
  check(!rendererSource.includes(eagerForbidden), `renderer defers ${eagerForbidden} out of startup path`);
}

check(indexSource.includes('main-rhbg-fitguard.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'index imports expanded View startup cache key');
check(entrySource.includes('core/app.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'entrypoint imports expanded View app delegate cache key');
check(appSource.includes('app-label-perf-runtime.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'app delegate imports expanded View runtime cache key');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'runtime imports expanded View RVM renderer cache key');
check(rendererSource.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-view-expanded-nonempty-1'), 'renderer imports expanded View toolbar owner');
check(rendererSource.includes('RvmGroupedToolbarPointerBridge.js?v=20260627-rvm-grouped-toolbar-pointer-1'), 'renderer imports deterministic grouped toolbar pointer bridge');
check(toolbarPointerSource.includes("const VERSION = '20260627-rvm-grouped-toolbar-pointer-1'"), 'toolbar pointer bridge exposes version');
check(toolbarPointerSource.includes('pointerdown-deterministic') && toolbarPointerSource.includes('suppressClickButton'), 'toolbar pointer bridge opens on pointerdown and suppresses follow-up click');
check(toolbarSource.includes("const VERSION = '20260627-rvm-toolbar-view-expanded-nonempty-1'"), 'toolbar exposes expanded View/nonempty menu version');
check(toolbarSource.includes("const PREVIOUS_VERSION = '20260627-rvm-toolbar-view-orient-split-1'"), 'toolbar retains previous View/Orient split marker');
check(toolbarSource.includes('RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1'), 'toolbar imports restored grouped overflow controller');
for (const label of ['Orient', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) check(toolbarSource.includes(`label: '${label}'`), `toolbar defines ${label} secondary menu`);
check(!toolbarSource.includes("{ id: 'view', label: 'View'"), 'toolbar does not define a View dropdown');
check(toolbarSource.includes("const CORE_LABELS = new Set(['navigate', 'view', 'navigate / view', 'review'])"), 'toolbar keeps View expanded as a top-level core section');
check(toolbarSource.includes('menuRoot.hidden = !hasSections'), 'toolbar hides empty secondary menus');
check(toolbarSource.includes('hiddenEmptyMenus') && toolbarSource.includes('visibleSecondaryMenus'), 'toolbar exposes empty/visible menu diagnostics');
check(toolbarSource.includes('clearSecondaryDataset(section)'), 'toolbar restores salvaged View sections as core');
check(toolbarSource.includes('content:attr(aria-label)'), 'Orient menu shows labels for icon-only orientation buttons when populated');
check(!toolbarSource.includes('More tools</span>'), 'generic More Tools dumping ground is not recreated');
check(overflowSource.includes("const VERSION = '20260627-rvm-toolbar-overflow-controller-grouped-restore-1'"), 'overflow controller exposes grouped restore version');
check(overflowSource.includes('getMenuEntries') && overflowSource.includes('openMenuId'), 'overflow controller supports multiple grouped menu roots');
check(overflowSource.includes('positionMenu(entry)') && overflowSource.includes("menu.style.position = 'fixed'"), 'overflow controller positions grouped menu panels as fixed overlays');

check(rendererSource.includes('RvmHierarchySelectionBridge.js?v=20260626-rvm-hierarchy-text-hit-target-sync-1'), 'renderer keeps hierarchy text hit-target bridge');
check(rendererSource.includes('RvmHierarchySmartGridBridge.js?v=20260627-rvm-hierarchy-smart-grid-1'), 'renderer imports hierarchy smart grid bridge');
check(rendererSource.includes('RvmSelectionTreeSyncBridge.js?v=20260626-rvm-hierarchy-selection-sync-2'), 'renderer keeps canvas-to-tree sync bridge');
check(rendererSource.includes('RvmViewerInteractionPatch.js?v=20260626-rvm-canvas-hierarchy-selection-sync-1'), 'renderer keeps canvas selection event bridge');
check(hierarchySource.includes("const BRIDGE_VERSION = 'rvm-hierarchy-selection-bridge/v3-text-hit-target-sync'"), 'hierarchy bridge exposes text-hit-target version');
check(smartGridSource.includes("const VERSION = '20260627-rvm-hierarchy-smart-grid-1'"), 'smart grid bridge exposes version');
check(smartGridSource.includes('grid-template-columns:22px minmax(0,1fr) 34px 34px'), 'smart grid owns expander/select/off/on column contract');
check(smartGridSource.includes('overflow-x:hidden'), 'smart grid prevents hierarchy horizontal overflow');
check(hierarchySource.includes('data-rvm-tree-label') && hierarchySource.includes('rvm-tree-label'), 'hierarchy bridge promotes readable text label hit target');
check(hierarchySource.includes('handleTreeSelection') && hierarchySource.includes('setSelectionFromObjects'), 'hierarchy bridge routes row text click to canvas selection API');
check(hierarchySource.includes('collectMatches') && hierarchySource.includes('aliasesMatch'), 'hierarchy bridge uses robust alias matching for row-to-mesh selection');
check(hierarchySource.includes('rvm-hierarchy-selection'), 'hierarchy bridge publishes hierarchy selection event');
check(treeSyncSource.includes("const BRIDGE_VERSION = '20260626-rvm-hierarchy-selection-sync-2'"), 'tree sync exposes current version');
check(treeSyncSource.includes('rowMatchScore') && treeSyncSource.includes('selectedAliases'), 'tree sync ranks selected mesh aliases against hierarchy rows');
check(treeSyncSource.includes('rvm-selection-synced-to-tree'), 'tree sync publishes canvas-to-tree sync event');
check(interactionSource.includes("const BRIDGE_VERSION = '20260626-rvm-canvas-hierarchy-selection-sync-1'"), 'interaction bridge exposes canvas hierarchy sync version');
check(interactionSource.includes('rvm-canvas-selection') && interactionSource.includes('publishCanvasSelection'), 'interaction bridge publishes canvas selection event for tree sync');

check(deferredLoaderSource.includes("id: 'model-health'") && deferredLoaderSource.includes('RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1'), 'postModel deferred loader owns model health bridge');
check(deferredLoaderSource.includes("sourcePreview:") && deferredLoaderSource.includes('ensureSourcePreview') && deferredLoaderSource.includes('SOURCE_PREVIEW_KIND_RE'), 'deferred loader owns gated sourcePreview bridge group');
check(tabSource.includes('stampSourcePreviewHierarchy(payload.gltf.scene, source, sourceKind, file.name)'), 'RVM tab stamps source-preview hierarchy before setModel');
check(loadSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge keeps native facet renderer');
check(workerSource.includes('RVM_TRANSFORM_3X4'), 'worker preserves transform matrix');
check(nativeFacetSource.includes('browser-rvm-native-facetgroup-primary/v3-smart-civil-defer'), 'native facet module uses smart civil defer schema');
check(smartCivilFacetSource.includes('PROCESS_TERMS') && smartCivilFacetSource.includes('CIVIL_TERMS'), 'smart civil policy is taxonomy/geometry based');
check(remainingPrimitiveSource.includes('support-code1-pyramid-solid-upgrade-disabled'), 'remaining primitive patch blocks support code-1 solid pyramid upgrades');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP') && renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'render builder keeps native facet path and diagnostic wireframes');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'unconditional structure slab promotion remains blocked');
check(facetGhostSource.includes('browser-rvm-native-facet-ghost-panels/v1'), 'native facet ghost patch exposes schema marker');
check(healthSource.includes('MAX_HEALTH_SCAN_OBJECTS'), 'health bridge bounds scans');
check(healthIssuesSource.includes('HIGH_FALLBACK_RATIO'), 'health issues bridge reports issue codes');
check(reportSource.includes('__PCF_GLB_RVM_REPORT_EXPORT__') && reportSource.includes('MAX_EXPORT_ROWS'), 'report export remains bounded and public');
check(pcfSource.includes('Visible → PCF') && pcfSource.includes('SYNTHETIC_INDEX_SCHEMA'), 'PCF trigger keeps visible synthetic index path');
check(visibilitySource.includes('__PCF_GLB_RVM_VISIBILITY__'), 'visibility toolbar global API remains present');
check(setsSource.includes('__PCF_GLB_RVM_SELECTION_SETS__') && setsSource.includes('MAX_SET_OBJECT_IDS'), 'selection sets remain bounded');
check(sectionSource.includes('__PCF_GLB_RVM_SECTION_BOX__') && sectionSource.includes('MAX_SECTION_SCAN_OBJECTS'), 'section box remains bounded');
check(measureSource.includes('__PCF_GLB_RVM_MEASURE__') && measureSource.includes('measureCenterDistance'), 'measure bridge remains present');
check(searchSource.includes('__PCF_GLB_RVM_OBJECT_SEARCH__') && searchSource.includes('MAX_INDEX_OBJECTS'), 'object search remains bounded');
check(labelsSource.includes('setRvmLabelLayerVisible') && !labelsSource.includes('applyScopedSupportLabelVisibility'), 'labels remain generic and retired support label scoping stays removed');
check(zoneSource.includes('buildPreloadHierarchyZones'), 'zone selector remains manifest-backed');
check(deepPathSource.includes('recoverRvmDeepSourcePathFromInstruction') && deepPathSource.includes('isWeakRvmSourcePath'), 'deep path bridge recovers shallow paths');
check(zoneDensityV5Source.includes('browser-rvm-zone-selection/v6-synthetic-navis-density-tree'), 'zone density selector exposes synthetic Navis tree schema');
check(geometricFallbackSource.includes('__PCF_GLB_RVM_GEOMETRIC_FALLBACK_POLICY__'), 'geometric fallback bridge publishes diagnostics API');
check(singlePickGuardSource.includes('trimCurrentSelection') && singlePickGuardSource.includes('collectHighlighted'), 'canvas single-pick guard trims stale multi-highlight state');

check(!entrySource.includes('STARTUP_SIDE_EFFECT_MODULES') && !entrySource.includes('loadStartupSideEffects'), 'entrypoint no longer keeps startup side-effect loader');
check(!entrySource.includes('xml-cii-finalise-run-button.js?v='), 'entrypoint does not globally side-load XML CII finalise-run wiring');
check(runtimeSource.includes('model-converters-tab.js?v=20260625-model-converters-finalise-run-owner-1'), 'app runtime imports current model converters cache key');
check(modelConvertersSource.includes('xml-cii-finalise-run-button.js?v=20260625-model-converters-finalise-run-owner-1'), 'Model Converters tab owns XML CII finalise-run module import');
check(finaliseRunSource.includes('export function installXmlCiiFinaliseRunButton') && !/^\s*install\(\);/m.test(finaliseRunSource), 'XML CII finalise-run module exposes explicit installer and does not auto-install');
check(appSource.includes('app-tab-click-state-bridge.js?v=20260622-tab-click-state-1') && appSource.includes('installAppTabClickStateBridge()'), 'app keeps tab click state bridge contract');
check(tabClickBridgeSource.includes('RuntimeEvents.TAB_CHANGED') && tabClickBridgeSource.includes('state.activeTabId = tabId'), 'tab click state bridge synchronizes active tab id');
check(appSource.includes('LEGACY_GEOMETRY_WORKFLOW_FLAG') && appSource.includes('Promise.allSettled'), 'legacy geometry workflow remains gated and safe');
check(!appSource.includes('RvmModelHealthBridge.js?v=') && !appSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v='), 'app startup does not eagerly import RVM heavy bridges');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
