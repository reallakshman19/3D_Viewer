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
const coverageBridgeSource = await read('../rvm/RvmDtxrGeometryCoverageBridge.js');
const coverageEngineSource = await read('../rvm/RvmDtxrGeometryCoverageEngine.js');
const renderedInventorySource = await read('../rvm/RvmRenderedObjectInventory.js');

check(rendererSource.includes('RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1'), 'renderer loads cache-busted model health bridge');
check(rendererSource.includes('RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1'), 'renderer loads model health issues bridge');
check(rendererSource.includes('installRvmModelHealthBridge()'), 'renderer installs model health bridge');
check(rendererSource.includes('installRvmModelHealthIssuesBridge()'), 'renderer installs health issues bridge');
check(rendererSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'renderer loads native facet ghost panel patch');
check(rendererSource.includes('installBrowserRvmNativeFacetGhostPanelPatch()'), 'renderer installs native facet ghost panel patch');
check(rendererSource.includes('RvmReportExportBridge.js?v=20260621-rvm-report-export-1'), 'renderer keeps report export bridge');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'renderer keeps visible-scope PCF bridge');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'renderer keeps preload zone selector');
check(rendererSource.includes('RvmDeepSourcePathRecoveryBridge.js?v=20260622-rvm-deep-source-path-recovery-1'), 'renderer loads deep source path recovery bridge');
check(rendererSource.includes('RvmZoneDensitySelectorBridgeV5.js?v=20260622-rvm-zone-density-selector-5'), 'renderer loads synthetic Navis zone density selector v5');
check(rendererSource.includes('RvmDtxrGeometryCoverageBridge.js?v=20260622-rvm-dtxr-coverage-1'), 'renderer loads DTXR geometry coverage bridge');
check(rendererSource.includes('installRvmDtxrGeometryCoverageBridge()'), 'renderer installs DTXR geometry coverage bridge');
check(rendererSource.includes('BrowserRvmCivilFallbackPolicyBridge.js?v=20260622-rvm-smart-civil-policy-tooltip-1'), 'renderer loads smart civil fallback policy bridge');
check(rendererSource.includes('BrowserRvmGeometricFallbackPolicyBridge.js?v=20260622-rvm-geometric-fallback-policy-1'), 'renderer loads geometric fallback policy bridge');
check(rendererSource.includes('installBrowserRvmGeometricFallbackPolicyBridge()'), 'renderer installs geometric fallback policy bridge');

check(deepPathSource.includes('recoverRvmDeepSourcePathFromInstruction') && deepPathSource.includes('isWeakRvmSourcePath'), 'deep path bridge recovers shallow /EQUIPMENT and /STRUCTURE paths');
check(zoneDensityV5Source.includes('browser-rvm-zone-selection/v6-synthetic-navis-density-tree'), 'zone density selector v5 exposes synthetic Navis tree schema');
check(zoneDensityV5Source.includes('expandPlantPart') && zoneDensityV5Source.includes('syntheticTreePartsFromPath'), 'zone density selector v5 synthesizes Review/Navis hierarchy from leaf names');
check(zoneDensityV5Source.includes('RvmZoneDensitySelectorBridgeV5.js') === false, 'zone density selector v5 is a module, not a self-loader');
check(geometricFallbackSource.includes('__PCF_GLB_RVM_GEOMETRIC_FALLBACK_POLICY__'), 'geometric fallback bridge publishes diagnostics API');
check(geometricFallbackSource.includes('huge-anonymous-box-diagnostic-hidden'), 'geometric fallback hides huge anonymous box diagnostics');

check(facetGhostSource.includes("browser-rvm-native-facet-ghost-panels/v1"), 'native facet ghost patch exposes schema marker');
check(facetGhostSource.includes('THIN_PANEL_RATIO') && facetGhostSource.includes('LARGE_PANEL_LONG_EDGE'), 'native facet ghost patch classifies large thin panels');
check(facetGhostSource.includes('facet-holes-filled-by-fan-triangulation'), 'native facet ghost patch downgrades hole-risk facet groups');
check(facetGhostSource.includes('__PCF_GLB_RVM_NATIVE_FACET_GHOST_PANELS__'), 'native facet ghost patch publishes global API');

check(healthSource.includes("BRIDGE_VERSION = '20260621-rvm-model-health-1'"), 'health bridge keeps base version marker');
check(healthSource.includes('MAX_HEALTH_SCAN_OBJECTS') && healthSource.includes('LABEL_SOFT_LIMIT') && healthSource.includes('LABEL_HARD_LIMIT'), 'health bridge bounds scans and label risk');
check(healthSource.includes('collectRvmModelHealth') && healthSource.includes('renderHealth'), 'health bridge collects and renders summary');
check(healthSource.includes('nativeFacetObjects') && healthSource.includes('fallbackObjects') && healthSource.includes('blockedSlabPromotions'), 'health bridge reports geometry quality counters');
check(healthSource.includes('pcfReadiness') && healthSource.includes('synthetic-render-index-available'), 'health bridge reports PCF readiness');
check(healthSource.includes('__PCF_GLB_RVM_MODEL_HEALTH__'), 'health bridge publishes global API');
check(healthSource.includes("typeof document === 'undefined'"), 'health bridge is safe for static imports');

check(coverageBridgeSource.includes("BRIDGE_VERSION = '20260622-rvm-dtxr-coverage-1'"), 'DTXR coverage bridge exposes version marker');
check(coverageBridgeSource.includes('__PCF_GLB_RVM_DTXR_COVERAGE__'), 'DTXR coverage bridge publishes global API');
check(coverageBridgeSource.includes('collectRvmDtxrGeometryCoverageFromScene'), 'DTXR coverage bridge collects scene coverage');
check(coverageBridgeSource.includes('Core Geometry Coverage') && coverageBridgeSource.includes('Export JSON'), 'DTXR coverage bridge renders and exports coverage panel');
check(coverageEngineSource.includes("rvm-dtxr-geometry-coverage/v1"), 'DTXR coverage engine exposes schema marker');
check(coverageEngineSource.includes('PIPE') && coverageEngineSource.includes('ELBOW') && coverageEngineSource.includes('SUPPORT'), 'DTXR coverage engine tracks core geometry categories');
check(coverageEngineSource.includes('EXPECTED_RECORD_NOT_RENDERED') && coverageEngineSource.includes('FALLBACK_ONLY'), 'DTXR coverage engine reports missing and fallback-only geometry');
check(renderedInventorySource.includes("rvm-rendered-object-inventory/v1"), 'rendered inventory exposes schema marker');
check(renderedInventorySource.includes('buildRvmRenderedObjectInventory') && renderedInventorySource.includes('classifyRvmObjectCategory'), 'rendered inventory exports collector and classifier');
check(renderedInventorySource.includes('DTXR_POS') && renderedInventorySource.includes('DTXR_PS'), 'rendered inventory extracts DTXR component and support keys');

check(healthIssuesSource.includes("BRIDGE_VERSION = '20260621-rvm-health-issues-1'"), 'health issues bridge exposes version marker');
check(healthIssuesSource.includes('collectRvmHealthIssues') && healthIssuesSource.includes('renderIssues'), 'health issues bridge classifies and renders issues');
check(healthIssuesSource.includes('HIGH_FALLBACK_RATIO') && healthIssuesSource.includes('LABEL_RISK_HIGH') && healthIssuesSource.includes('PCF_NOT_READY'), 'health issues bridge reports actionable issue codes');
check(healthIssuesSource.includes('show-all') && healthIssuesSource.includes('labels-off') && healthIssuesSource.includes('open-health'), 'health issues bridge exposes quick fix actions');
check(healthIssuesSource.includes('__PCF_GLB_RVM_HEALTH_ISSUES__'), 'health issues bridge publishes global API');
check(healthIssuesSource.includes("typeof document === 'undefined'"), 'health issues bridge is safe for static imports');

check(reportSource.includes('__PCF_GLB_RVM_REPORT_EXPORT__') && reportSource.includes('MAX_EXPORT_ROWS'), 'report export remains bounded and public');
check(pcfSource.includes('Visible → PCF') && pcfSource.includes('SYNTHETIC_INDEX_SCHEMA'), 'PCF trigger keeps visible synthetic index path');
check(visibilitySource.includes('__PCF_GLB_RVM_VISIBILITY__'), 'visibility toolbar global API remains present');
check(setsSource.includes('__PCF_GLB_RVM_SELECTION_SETS__') && setsSource.includes('MAX_SET_OBJECT_IDS'), 'selection sets remain bounded');
check(sectionSource.includes('__PCF_GLB_RVM_SECTION_BOX__') && sectionSource.includes('MAX_SECTION_SCAN_OBJECTS'), 'section box remains bounded');
check(measureSource.includes('__PCF_GLB_RVM_MEASURE__') && measureSource.includes('measureCenterDistance'), 'measure bridge remains present');
check(searchSource.includes('__PCF_GLB_RVM_OBJECT_SEARCH__') && searchSource.includes('MAX_INDEX_OBJECTS'), 'object search remains bounded');
check(labelsSource.includes('applyScopedSupportLabelVisibility'), 'labels remain scoped to selection');
check(zoneSource.includes('buildPreloadHierarchyZones'), 'zone selector remains manifest-backed');

check(tabSource.includes('beforeRenderInstructions'), 'RVM tab keeps pre-render hook');
check(loadSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge keeps native facet renderer');
check(workerSource.includes('RVM_TRANSFORM_3X4'), 'worker preserves transform matrix');
check(nativeFacetSource.includes('browser-rvm-native-facetgroup-primary/v3-smart-civil-defer'), 'native facet module uses smart civil defer schema');
check(nativeFacetSource.includes('classifySmartCivilFacetInstruction') && nativeFacetSource.includes('smartCivilPolicyUserData'), 'native facet primary defers smart civil code-11 facets before tessellation');
check(smartCivilFacetSource.includes('PROCESS_TERMS') && smartCivilFacetSource.includes('CIVIL_TERMS'), 'smart civil policy is taxonomy/geometry based, not project-name hardcoded');
check(smartCivilFacetSource.includes('deferNativeTessellation') && smartCivilFacetSource.includes('wireframe-proxy'), 'smart civil policy supports default-off and proxy modes');
check(remainingPrimitiveSource.includes("browser-rvm-remaining-primitives/v3-line-wire-diagnostics"), 'remaining primitive patch exposes code-10 line-wire schema');
check(!remainingPrimitiveSource.includes('function lineBoxGeometry'), 'RVM code-10 Line/GENSEC primitives are not converted into solid boxes');
check(remainingPrimitiveSource.includes('RVM_NATIVE_GRID_LINE_DIAGNOSTIC') && remainingPrimitiveSource.includes('code10-grid-reference-line-default-off'), 'RVM code-10 grid/reference lines default to diagnostic/off policy');
check(remainingPrimitiveSource.includes('lineBoxGeometryAvoided') && remainingPrimitiveSource.includes('LineSegments'), 'RVM code-10 diagnostics report box-geometry avoidance and use lines');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP'), 'render builder keeps native facet primary path');
check(renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'bbox placeholders remain diagnostic wireframes');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'unconditional structure slab promotion remains blocked');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260622-tab-click-state-1'), 'index uses tab click entry cache key');
check(entrySource.includes('core/app.js?v=20260622-tab-click-state-1'), 'entrypoint uses tab click app cache key');
check(entrySource.includes('await init(startupMount())'), 'entrypoint passes resolved mount root into init');
check(appSource.includes('app-tab-click-state-bridge.js?v=20260622-tab-click-state-1'), 'app side-loads tab click state bridge');
check(appSource.includes('installAppTabClickStateBridge()'), 'app installs tab click state bridge before runtime delegate');
check(tabClickBridgeSource.includes('RuntimeEvents.TAB_CHANGED'), 'tab click state bridge listens for tab changes');
check(tabClickBridgeSource.includes('state.activeTabId = tabId'), 'tab click state bridge synchronizes active tab id');
check(appSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'app side-loads native facet ghost patch');
check(appSource.includes('installBrowserRvmNativeFacetGhostPanelPatch()'), 'app installs native facet ghost patch independent of renderer cache');
check(appSource.includes('app-label-perf-runtime.js?v=20260622-tab-click-state-1'), 'app delegates through tab click runtime cache key');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260622-rvm-facet-ghost-panels-1'), 'runtime uses facet ghost renderer cache');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
