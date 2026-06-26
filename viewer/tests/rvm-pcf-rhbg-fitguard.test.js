import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

async function read(path) {
  return fs.readFile(new URL(path, import.meta.url), 'utf8');
}

const rendererSource = await read('../tabs/viewer3d-rvm-tab-renderer.js');
const appSource = await read('../core/app.js');
const runtimeSource = await read('../core/app-label-perf-runtime.js');
const tabClickBridgeSource = await read('../core/app-tab-click-state-bridge.js');
const entrySource = await read('../main-rhbg-fitguard.js');
const indexSource = await read('../index.html');
const tabSource = await read('../tabs/viewer3d-rvm-tab.js');
const loadSource = await read('../rvm/BrowserRvmLoadBridge.js');
const renderBuilderSource = await read('../rvm/BrowserRvmRenderSceneBuilder.js');
const workerSource = await read('../rvm/browser-rvm-worker.js');
const nativeFacetSource = await read('../rvm/BrowserRvmNativeFacetGroupPrimary.js');
const smartCivilFacetSource = await read('../rvm/BrowserRvmSmartCivilFacetPolicy.js');
const remainingPrimitiveSource = await read('../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js');
const facetGhostSource = await read('../rvm/BrowserRvmNativeFacetGhostPanelPatch.js');
const healthSource = await read('../tabs/RvmModelHealthBridge.js');
const healthIssuesSource = await read('../tabs/RvmModelHealthIssuesBridge.js');
const deferredLoaderSource = await read('../tabs/RvmDeferredBridgeLoader.js');
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
const modelConvertersSource = await read('../tabs/model-converters/ModelConvertersTab.js');
const finaliseRunSource = await read('../tabs/model-converters/xml-cii-finalise-run-button.js');

check(!rendererSource.includes('RvmModelHealthBridge.js?v='), 'renderer defers model health bridge out of startup path');
check(!rendererSource.includes('RvmModelHealthIssuesBridge.js?v='), 'renderer defers model health issues bridge out of startup path');
check(deferredLoaderSource.includes("id: 'model-health'") && deferredLoaderSource.includes('RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1'), 'postModel deferred loader owns model health bridge');
check(deferredLoaderSource.includes("id: 'model-health-issues'") && deferredLoaderSource.includes('RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1'), 'postModel deferred loader owns model health issues bridge');
check(!rendererSource.includes('RvmObjectSearchBridge.js?v='), 'renderer defers object search bridge out of startup path');
check(!rendererSource.includes('RvmVisibilitySnapshotsBridge.js?v='), 'renderer defers visibility snapshots bridge out of startup path');
check(!rendererSource.includes('RvmSelectionSetsBridge.js?v='), 'renderer defers selection sets bridge out of startup path');
check(!rendererSource.includes('RvmReportExportBridge.js?v='), 'renderer defers report export bridge out of startup path');
check(deferredLoaderSource.includes("id: 'object-search'") && deferredLoaderSource.includes('RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1'), 'postModel deferred loader owns object search bridge');
check(deferredLoaderSource.includes("id: 'visibility-snapshots'") && deferredLoaderSource.includes('RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1'), 'postModel deferred loader owns visibility snapshots bridge');
check(deferredLoaderSource.includes("id: 'selection-sets'") && deferredLoaderSource.includes('RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1'), 'postModel deferred loader owns selection sets bridge');
check(deferredLoaderSource.includes("id: 'report-export'") && deferredLoaderSource.includes('RvmReportExportBridge.js?v=20260621-rvm-report-export-1'), 'postModel deferred loader owns report export bridge');

for (const bridgeName of [
  'RvmNonPrimitiveSupportOverlayBridge.js?v=',
  'RvmNonPrimitiveSupportOverlayHardDisableBridge.js?v=',
  'RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=',
  'RvmNonPrimitiveSupportOverlayHoverBridge.js?v=',
  'RvmNonPrimitiveAutoBendBridge.js?v=',
  'RvmNonPrimitiveSourceToolsUiBridge.js?v=',
]) {
  check(!rendererSource.includes(bridgeName), `renderer defers source-preview bridge ${bridgeName} out of startup path`);
}
check(deferredLoaderSource.includes("sourcePreview:") && deferredLoaderSource.includes("id: 'nonprimitive-support-overlay'"), 'deferred loader owns sourcePreview bridge group');
check(deferredLoaderSource.includes('RvmNonPrimitiveSupportOverlayBridge.js?v=20260623-nonprimitive-support-overlay-9'), 'sourcePreview group owns support overlay bridge');
check(deferredLoaderSource.includes('RvmNonPrimitiveSupportOverlayHardDisableBridge.js?v=20260623-nonprimitive-support-hard-disable-1'), 'sourcePreview group owns support hard-disable bridge');
check(deferredLoaderSource.includes('RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260626-source-preview-support-events-1'), 'sourcePreview group owns event-routed support details bridge');
check(deferredLoaderSource.includes('RvmNonPrimitiveSupportOverlayHoverBridge.js?v=20260623-nonprimitive-support-hover-2'), 'sourcePreview group owns support hover bridge');
check(deferredLoaderSource.includes('RvmNonPrimitiveAutoBendBridge.js?v=20260623-nonprimitive-auto-bend-preview-2'), 'sourcePreview group owns auto-bend bridge');
check(deferredLoaderSource.includes('RvmNonPrimitiveSourceToolsUiBridge.js?v=20260624-source-tools-grouped-1'), 'sourcePreview group owns source tools UI bridge');
check(deferredLoaderSource.includes('ensureSourcePreview') && deferredLoaderSource.includes('SOURCE_PREVIEW_KIND_RE'), 'deferred loader gates source-preview bridge loading by source kind');
check(deferredLoaderSource.includes("mode === 'source-preview'") && deferredLoaderSource.includes('refreshSourcePreviewRuntime'), 'deferred loader refreshes source-preview runtime only for source-preview mode');
check(rendererSource.includes('RvmDeferredBridgeLoader.js?v=20260626-rvm-deferred-source-preview-events-1'), 'renderer imports current deferred source-preview loader cache key');

check(rendererSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'renderer loads native facet ghost panel patch');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'renderer keeps visible-scope PCF bridge');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'renderer keeps preload zone selector');
check(rendererSource.includes('RvmDeepSourcePathRecoveryBridge.js?v=20260622-rvm-deep-source-path-recovery-1'), 'renderer loads deep source path recovery bridge');
check(rendererSource.includes('RvmZoneDensitySelectorBridgeV5.js?v=20260622-rvm-zone-density-selector-5'), 'renderer loads synthetic Navis zone density selector v5');
check(!rendererSource.includes('RvmSupportAssemblyMarkerModeBridge'), 'renderer keeps retired support assembly marker bridge removed');
check(rendererSource.includes('RvmCanvasSelectionSinglePickGuardBridge.js?v=20260626-rvm-canvas-single-pick-registry-1'), 'renderer loads routed canvas single-pick guard bridge');
check(rendererSource.includes('RvmLeafCanvasPickBridge.js?v=20260622-rvm-leaf-canvas-pick-orbit-guard-2'), 'renderer loads navigation-safe leaf canvas pick bridge');

check(deepPathSource.includes('recoverRvmDeepSourcePathFromInstruction') && deepPathSource.includes('isWeakRvmSourcePath'), 'deep path bridge recovers shallow paths');
check(zoneDensityV5Source.includes('browser-rvm-zone-selection/v6-synthetic-navis-density-tree'), 'zone density selector exposes synthetic Navis tree schema');
check(geometricFallbackSource.includes('__PCF_GLB_RVM_GEOMETRIC_FALLBACK_POLICY__'), 'geometric fallback bridge publishes diagnostics API');
check(geometricFallbackSource.includes('huge-anonymous-box-diagnostic-hidden'), 'geometric fallback hides huge anonymous box diagnostics');
check(singlePickGuardSource.includes('trimCurrentSelection') && singlePickGuardSource.includes('collectHighlighted'), 'canvas single-pick guard trims stale multi-highlight state');

check(facetGhostSource.includes('browser-rvm-native-facet-ghost-panels/v1'), 'native facet ghost patch exposes schema marker');
check(facetGhostSource.includes('THIN_PANEL_RATIO') && facetGhostSource.includes('LARGE_PANEL_LONG_EDGE'), 'native facet ghost patch classifies large thin panels');
check(facetGhostSource.includes('facet-holes-filled-by-fan-triangulation'), 'native facet ghost patch downgrades hole-risk facet groups');
check(facetGhostSource.includes('__PCF_GLB_RVM_NATIVE_FACET_GHOST_PANELS__'), 'native facet ghost patch publishes global API');

check(healthSource.includes('MAX_HEALTH_SCAN_OBJECTS') && healthSource.includes('LABEL_SOFT_LIMIT') && healthSource.includes('LABEL_HARD_LIMIT'), 'health bridge bounds scans and label risk');
check(healthSource.includes('nativeFacetObjects') && healthSource.includes('fallbackObjects') && healthSource.includes('blockedSlabPromotions'), 'health bridge reports geometry quality counters');
check(healthIssuesSource.includes('HIGH_FALLBACK_RATIO') && healthIssuesSource.includes('LABEL_RISK_HIGH') && healthIssuesSource.includes('PCF_NOT_READY'), 'health issues bridge reports issue codes');
check(reportSource.includes('__PCF_GLB_RVM_REPORT_EXPORT__') && reportSource.includes('MAX_EXPORT_ROWS'), 'report export remains bounded and public');

check(pcfSource.includes('Visible → PCF') && pcfSource.includes('SYNTHETIC_INDEX_SCHEMA'), 'PCF trigger keeps visible synthetic index path');
check(visibilitySource.includes('__PCF_GLB_RVM_VISIBILITY__'), 'visibility toolbar global API remains present');
check(setsSource.includes('__PCF_GLB_RVM_SELECTION_SETS__') && setsSource.includes('MAX_SET_OBJECT_IDS'), 'selection sets remain bounded');
check(sectionSource.includes('__PCF_GLB_RVM_SECTION_BOX__') && sectionSource.includes('MAX_SECTION_SCAN_OBJECTS'), 'section box remains bounded');
check(measureSource.includes('__PCF_GLB_RVM_MEASURE__') && measureSource.includes('measureCenterDistance'), 'measure bridge remains present');
check(searchSource.includes('__PCF_GLB_RVM_OBJECT_SEARCH__') && searchSource.includes('MAX_INDEX_OBJECTS'), 'object search remains bounded');
check(labelsSource.includes('setRvmLabelLayerVisible') && labelsSource.includes('pcf-glb-rvm-label-performance-bridge-v2-no-support-runtime') && !labelsSource.includes('applyScopedSupportLabelVisibility'), 'labels remain generic and retired support label scoping stays removed');
check(zoneSource.includes('buildPreloadHierarchyZones'), 'zone selector remains manifest-backed');

check(tabSource.includes('beforeRenderInstructions'), 'RVM tab keeps pre-render hook');
check(tabSource.includes('stampSourcePreviewHierarchy(payload.gltf.scene, source, sourceKind, file.name)'), 'RVM tab stamps source-preview hierarchy before setModel');
check(tabSource.includes('__rvmNonPrimitiveSourceHierarchy') && tabSource.includes('__rvmNonPrimitiveAutoBendSourceHierarchy'), 'RVM tab owns source-preview hierarchy transfer for deferred bridges');
check(tabSource.includes('ensureSourcePreview') && tabSource.includes("root?.dataset?.rvmModelPrimitiveMode === 'source-preview'"), 'RVM tab asks deferred loader for source-preview group only after source-preview load');
check(loadSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge keeps native facet renderer');
check(workerSource.includes('RVM_TRANSFORM_3X4'), 'worker preserves transform matrix');
check(nativeFacetSource.includes('browser-rvm-native-facetgroup-primary/v3-smart-civil-defer'), 'native facet module uses smart civil defer schema');
check(nativeFacetSource.includes('classifySmartCivilFacetInstruction') && nativeFacetSource.includes('smartCivilPolicyUserData'), 'native facet primary defers smart civil code-11 facets before tessellation');
check(smartCivilFacetSource.includes('PROCESS_TERMS') && smartCivilFacetSource.includes('CIVIL_TERMS'), 'smart civil policy is taxonomy/geometry based');
check(remainingPrimitiveSource.includes('browser-rvm-remaining-primitives/v4-support-raw-safe'), 'remaining primitive patch exposes support raw-safe schema');
check(remainingPrimitiveSource.includes('support-code1-pyramid-solid-upgrade-disabled'), 'remaining primitive patch blocks support code-1 solid pyramid upgrades');
check(!remainingPrimitiveSource.includes('function lineBoxGeometry'), 'RVM code-10 primitives are not converted into solid boxes');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP'), 'render builder keeps native facet primary path');
check(renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'bbox placeholders remain diagnostic wireframes');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'unconditional structure slab promotion remains blocked');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260625-empty-startup-side-effects-removed-1'), 'index uses current empty-startup-side-effects main cache key');
check(entrySource.includes('core/app.js?v=20260625-empty-startup-side-effects-removed-1'), 'entrypoint uses current empty-startup-side-effects app cache key');
check(!entrySource.includes('STARTUP_SIDE_EFFECT_MODULES'), 'entrypoint no longer keeps a global startup side-effect module list');
check(!entrySource.includes('loadStartupSideEffects'), 'entrypoint no longer keeps startup side-effect loader');
check(!entrySource.includes('scheduleDeferredStartupSideEffects'), 'entrypoint no longer schedules empty startup side effects');
check(!entrySource.includes('optional startup module failed'), 'entrypoint no longer keeps dead optional-startup logging');
check(entrySource.includes('await init(startupMount())'), 'entrypoint passes resolved mount root into init');
check(!entrySource.includes('RvmInputXmlSupportGraphicsSetModelBridge.js?v='), 'entrypoint does not side-load legacy InputXML support setModel bridge');
check(!entrySource.includes('RvmInputXmlSupportGraphicsUiBridge.js?v='), 'entrypoint does not side-load legacy InputXML support UI bridge');
check(!entrySource.includes('AvevaJsonAutoConnectOverride.js?v='), 'entrypoint does not globally side-load InputXML route-preserve loader override');
check(runtimeSource.includes('AvevaJsonAutoConnectOverride.js?v=20260618-inputxml-auto-connect-1'), 'RVM renderer preflight owns InputXML route-preserve loader override');
check(!entrySource.includes('xml-cii-finalise-run-button.js?v='), 'entrypoint does not globally side-load XML CII finalise-run wiring');
check(runtimeSource.includes('model-converters-tab.js?v=20260625-model-converters-finalise-run-owner-1'), 'app runtime imports current model converters cache key');
check(modelConvertersSource.includes('xml-cii-finalise-run-button.js?v=20260625-model-converters-finalise-run-owner-1'), 'Model Converters tab owns XML CII finalise-run module import');
check(modelConvertersSource.includes("['xml-cii-finalise-run-button', installXmlCiiFinaliseRunButton]"), 'Model Converters installer queue owns XML CII finalise-run installer');
check(finaliseRunSource.includes('export function installXmlCiiFinaliseRunButton'), 'XML CII finalise-run module exposes explicit installer');
check(!/^\s*install\(\);/m.test(finaliseRunSource), 'XML CII finalise-run module must not auto-install on import');
check(!finaliseRunSource.includes('document.addEventListener'), 'XML CII finalise-run module must not register document-level listeners');
check(appSource.includes('app-tab-click-state-bridge.js?v=20260622-tab-click-state-1'), 'app side-loads tab click state bridge');
check(appSource.includes('installAppTabClickStateBridge()'), 'app installs tab click state bridge before runtime delegate');
check(tabClickBridgeSource.includes('RuntimeEvents.TAB_CHANGED'), 'tab click state bridge listens for tab changes');
check(tabClickBridgeSource.includes('state.activeTabId = tabId'), 'tab click state bridge synchronizes active tab id');
check(appSource.includes('LEGACY_GEOMETRY_WORKFLOW_FLAG'), 'legacy geometry workflow button installers are now flag-gated');
check(appSource.includes('shouldInstallLegacyGeometryWorkflowButtons'), 'app has explicit legacy geometry workflow gate');
check(appSource.includes('installLegacyGeometryWorkflowBridges'), 'legacy geometry workflow installers remain available for transition');
check(appSource.includes('Promise.allSettled'), 'legacy workflow bridge failures do not blank the app');
check(!appSource.includes('RvmModelHealthBridge.js?v='), 'app startup does not eagerly import model health bridge');
check(!appSource.includes('RvmModelHealthIssuesBridge.js?v='), 'app startup does not eagerly import model health issues bridge');
check(!appSource.includes('\ninstallRvmModelHealthBridge();'), 'app startup does not eagerly install model health bridge');
check(!appSource.includes('\ninstallRvmModelHealthIssuesBridge();'), 'app startup does not eagerly install model health issues bridge');
check(!appSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v='), 'app startup does not eagerly import native facet ghost patch');
check(!appSource.includes('\ninstallBrowserRvmNativeFacetGhostPanelPatch();'), 'app startup does not eagerly install native facet ghost patch');
check(!appSource.includes('\ninstallGeometrySupportLoadFormulaBridge();'), 'support-load formula button is not installed by default');
check(!appSource.includes('\ninstallGeometrySupportLoadReportBridge();'), 'support-load report button is not installed by default');
check(!appSource.includes('\ninstallGeometrySupportLoadBulkPackageBridge();'), 'support-load package button is not installed by default');
check(!appSource.includes('\ninstallGeometrySupportLoadCanvasOverlayBridge();'), 'support-load overlay button is not installed by default');
check(appSource.includes('app-label-perf-runtime.js?v=20260625-empty-startup-side-effects-removed-1'), 'app exports current empty-startup-side-effects runtime cache marker');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260625-rvm-renderer-cache-chain-1'), 'runtime imports current RVM renderer cache key');
check(!runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260624-selected-geometry-floating-workflow-3'), 'runtime does not keep stale selected-geometry renderer cache key');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
