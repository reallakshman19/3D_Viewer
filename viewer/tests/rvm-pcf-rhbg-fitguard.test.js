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
const entrySource = await read('../main-rhbg-fitguard.js');
const indexSource = await read('../index.html');
const tabSource = await read('../tabs/viewer3d-rvm-tab.js');
const loadSource = await read('../rvm/BrowserRvmLoadBridge.js');
const renderBuilderSource = await read('../rvm/BrowserRvmRenderSceneBuilder.js');
const workerSource = await read('../rvm/browser-rvm-worker.js');
const nativeFacetSource = await read('../rvm/BrowserRvmNativeFacetGroupPrimary.js');
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

check(rendererSource.includes('RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1'), 'renderer loads cache-busted model health bridge');
check(rendererSource.includes('RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1'), 'renderer loads model health issues bridge');
check(rendererSource.includes('installRvmModelHealthBridge()'), 'renderer installs model health bridge');
check(rendererSource.includes('installRvmModelHealthIssuesBridge()'), 'renderer installs health issues bridge');
check(rendererSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'renderer loads native facet ghost panel patch');
check(rendererSource.includes('installBrowserRvmNativeFacetGhostPanelPatch()'), 'renderer installs native facet ghost panel patch');
check(rendererSource.includes('RvmReportExportBridge.js?v=20260621-rvm-report-export-1'), 'renderer keeps report export bridge');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'renderer keeps visible-scope PCF bridge');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'renderer keeps preload zone selector');

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
check(nativeFacetSource.includes('browser-rvm-native-facetgroup-primary/v2-ghost-panels'), 'native facet module uses ghost-panel schema');
check(nativeFacetSource.includes('native-facetgroup-ghost-panel') && nativeFacetSource.includes('wireframe-only-hole-contour-risk'), 'native facet primary ghosts risky panels');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP'), 'render builder keeps native facet primary path');
check(renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'bbox placeholders remain diagnostic wireframes');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'unconditional structure slab promotion remains blocked');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260622-app-root-startup-1'), 'index uses app root startup entry cache key');
check(entrySource.includes('core/app.js?v=20260622-rvm-facet-ghost-panels-1'), 'entrypoint uses facet ghost app cache key');
check(entrySource.includes('await init(startupMount())'), 'entrypoint passes resolved mount root into init');
check(appSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'app side-loads native facet ghost patch');
check(appSource.includes('installBrowserRvmNativeFacetGhostPanelPatch()'), 'app installs native facet ghost patch independent of renderer cache');
check(appSource.includes('app-label-perf-runtime.js?v=20260622-rvm-facet-ghost-panels-1'), 'app delegates through facet ghost runtime cache key');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260622-rvm-facet-ghost-panels-1'), 'runtime uses facet ghost renderer cache');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
