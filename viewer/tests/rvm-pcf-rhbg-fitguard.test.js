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
const geometryWorkspaceSource = await read('../geometry-workspace/GeometryExportWorkspaceBridge.js');
const geometrySnapshotSource = await read('../geometry-workspace/RenderedGeometrySnapshotBuilder.js');
const geometryFieldsSource = await read('../geometry-workspace/RenderedGeometryFieldDiscovery.js');
const geometryHierarchySource = await read('../geometry-workspace/GeometryImportHierarchyModel.js');
const geometryMappingSource = await read('../geometry-workspace/GeometryMappingEngine.js');
const geometryProfilesSource = await read('../geometry-workspace/GeometryMappingProfiles.js');
const geometryProfileBridgeSource = await read('../geometry-workspace/GeometryMappingProfileBridge.js');
const geometryCalcRegistrySource = await read('../geometry-workspace/GeometryCalculationModuleRegistry.js');
const geometryCalcBridgeSource = await read('../geometry-workspace/GeometryCalculationCanvasBridge.js');
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
const markerModeSource = await read('../tabs/RvmSupportAssemblyMarkerModeBridge.js');
const singlePickGuardSource = await read('../tabs/RvmCanvasSelectionSinglePickGuardBridge.js');

check(rendererSource.includes('RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1'), 'renderer loads cache-busted model health bridge');
check(rendererSource.includes('RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1'), 'renderer loads model health issues bridge');
check(rendererSource.includes('installRvmModelHealthBridge()') && rendererSource.includes('installRvmModelHealthIssuesBridge()'), 'renderer installs health bridges');
check(rendererSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'renderer loads native facet ghost panel patch');
check(rendererSource.includes('installBrowserRvmNativeFacetGhostPanelPatch()'), 'renderer installs native facet ghost panel patch');
check(rendererSource.includes('RvmReportExportBridge.js?v=20260621-rvm-report-export-1'), 'renderer keeps report export bridge');
check(rendererSource.includes('GeometryExportWorkspaceBridge.js?v=20260622-geometry-mapping-1'), 'renderer loads geometry mapping workspace bridge');
check(rendererSource.includes('GeometryMappingProfileBridge.js?v=20260622-geometry-profile-ui-1'), 'renderer loads geometry mapping profile bridge');
check(rendererSource.includes('GeometryMappingProfiles.js?v=20260622-geometry-profile-ui-1'), 'renderer exposes geometry mapping profile cache marker');
check(rendererSource.includes('GeometryCalculationCanvasBridge.js?v=20260622-geometry-calc-canvas-1'), 'renderer loads geometry calculation canvas bridge');
check(rendererSource.includes('GeometryCalculationModuleRegistry.js?v=20260622-geometry-calc-canvas-1'), 'renderer exposes geometry calculation module registry marker');
check(rendererSource.includes('installGeometryExportWorkspaceBridge()') && rendererSource.includes('installGeometryMappingProfileBridge()') && rendererSource.includes('installGeometryCalculationCanvasBridge()'), 'renderer installs geometry workspace, profile, and calculation bridges');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'renderer keeps visible-scope PCF bridge');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'renderer keeps preload zone selector');
check(rendererSource.includes('RvmDeepSourcePathRecoveryBridge.js?v=20260622-rvm-deep-source-path-recovery-1'), 'renderer loads deep source path recovery bridge');
check(rendererSource.includes('RvmZoneDensitySelectorBridgeV5.js?v=20260622-rvm-zone-density-selector-5'), 'renderer loads synthetic Navis zone density selector v5');
check(rendererSource.includes('RvmDtxrGeometryCoverageBridge.js?v=20260622-rvm-dtxr-coverage-1'), 'renderer loads DTXR geometry coverage bridge');
check(rendererSource.includes('BrowserRvmGeometricFallbackPolicyBridge.js?v=20260622-rvm-geometric-fallback-policy-1'), 'renderer loads geometric fallback policy bridge');
check(rendererSource.includes('RvmSupportAssemblyMarkerModeBridge.js?v=20260622-rvm-support-assembly-markers-off-1'), 'renderer loads support assembly marker mode bridge');
check(rendererSource.includes('RvmCanvasSelectionSinglePickGuardBridge.js?v=20260622-rvm-canvas-single-pick-guard-1'), 'renderer loads canvas single-pick guard bridge');

check(deepPathSource.includes('recoverRvmDeepSourcePathFromInstruction') && deepPathSource.includes('isWeakRvmSourcePath'), 'deep path bridge recovers shallow paths');
check(zoneDensityV5Source.includes('browser-rvm-zone-selection/v6-synthetic-navis-density-tree'), 'zone density selector exposes synthetic Navis tree schema');
check(zoneDensityV5Source.includes('expandPlantPart') && zoneDensityV5Source.includes('syntheticTreePartsFromPath'), 'zone density selector synthesizes hierarchy from leaf names');
check(geometricFallbackSource.includes('__PCF_GLB_RVM_GEOMETRIC_FALLBACK_POLICY__'), 'geometric fallback bridge publishes diagnostics API');
check(geometricFallbackSource.includes('huge-anonymous-box-diagnostic-hidden'), 'geometric fallback hides huge anonymous box diagnostics');
check(markerModeSource.includes("return 'off'") && markerModeSource.includes('support-assembly-markers-default-off'), 'support assembly contact rings default off');
check(singlePickGuardSource.includes('trimCurrentSelection') && singlePickGuardSource.includes('collectHighlighted'), 'canvas single-pick guard trims stale multi-highlight state');

check(facetGhostSource.includes('browser-rvm-native-facet-ghost-panels/v1'), 'native facet ghost patch exposes schema marker');
check(facetGhostSource.includes('THIN_PANEL_RATIO') && facetGhostSource.includes('LARGE_PANEL_LONG_EDGE'), 'native facet ghost patch classifies large thin panels');
check(facetGhostSource.includes('facet-holes-filled-by-fan-triangulation'), 'native facet ghost patch downgrades hole-risk facet groups');
check(facetGhostSource.includes('__PCF_GLB_RVM_NATIVE_FACET_GHOST_PANELS__'), 'native facet ghost patch publishes global API');

check(healthSource.includes("BRIDGE_VERSION = '20260621-rvm-model-health-1'"), 'health bridge keeps base version marker');
check(healthSource.includes('MAX_HEALTH_SCAN_OBJECTS') && healthSource.includes('LABEL_SOFT_LIMIT') && healthSource.includes('LABEL_HARD_LIMIT'), 'health bridge bounds scans and label risk');
check(healthSource.includes('nativeFacetObjects') && healthSource.includes('fallbackObjects') && healthSource.includes('blockedSlabPromotions'), 'health bridge reports geometry quality counters');
check(healthSource.includes('pcfReadiness') && healthSource.includes('synthetic-render-index-available'), 'health bridge reports PCF readiness');
check(healthIssuesSource.includes('HIGH_FALLBACK_RATIO') && healthIssuesSource.includes('LABEL_RISK_HIGH') && healthIssuesSource.includes('PCF_NOT_READY'), 'health issues bridge reports issue codes');
check(healthIssuesSource.includes('show-all') && healthIssuesSource.includes('labels-off') && healthIssuesSource.includes('open-health'), 'health issues bridge exposes quick fix actions');

check(reportSource.includes('__PCF_GLB_RVM_REPORT_EXPORT__') && reportSource.includes('MAX_EXPORT_ROWS'), 'report export remains bounded and public');
check(geometrySnapshotSource.includes("RENDERED_GEOMETRY_SNAPSHOT_SCHEMA = 'rendered-geometry-snapshot/v1'"), 'geometry snapshot builder exposes schema marker');
check(geometrySnapshotSource.includes('buildRenderedGeometrySnapshot') && geometrySnapshotSource.includes('modelGroup?.traverse'), 'geometry snapshot builder imports from rendered scene objects');
check(geometrySnapshotSource.includes("sourceViewer: '3D_RVM_VIEWER'") && geometrySnapshotSource.includes('rawFields') && geometrySnapshotSource.includes('derivedFields'), 'geometry snapshot records include raw and derived fields');
check(geometryFieldsSource.includes("RENDERED_GEOMETRY_FIELD_DISCOVERY_SCHEMA = 'geometry-field-discovery/v1'"), 'field discovery exposes schema marker');
check(geometryFieldsSource.includes('discoverRenderedGeometryFields') && geometryFieldsSource.includes('selectDefaultTableFields'), 'field discovery supports dynamic table columns');
check(geometryFieldsSource.includes('dimension-mm') && geometryFieldsSource.includes('identifier'), 'field discovery infers dimensions and identifiers');
check(geometryHierarchySource.includes("GEOMETRY_IMPORT_HIERARCHY_SCHEMA = 'geometry-import-hierarchy/v1'"), 'geometry import hierarchy exposes schema marker');
check(geometryHierarchySource.includes('buildGeometryImportHierarchy') && geometryHierarchySource.includes('collectObjectIdsForHierarchyPaths'), 'geometry import hierarchy supports top-level selection');
check(geometryMappingSource.includes("GEOMETRY_MAPPING_SCHEMA = 'geometry-mapping-engine/v1'"), 'geometry mapping engine exposes schema marker');
check(geometryMappingSource.includes('DEFAULT_GEOMETRY_MAPPING_PROFILE') && geometryMappingSource.includes('AUTO_RVM_GEOMETRY_MAPPING_V1'), 'geometry mapping engine has default profile');
check(geometryMappingSource.includes('support-guide') && geometryMappingSource.includes('support-line-stop') && geometryMappingSource.includes('support-rest'), 'geometry mapping engine classifies support types');
check(geometryMappingSource.includes('parseDimensionToMm') && geometryMappingSource.includes('dimensionToMm'), 'geometry mapping engine parses dimensions to mm');
check(geometryMappingSource.includes('mappingAudit') && geometryMappingSource.includes('mappingConfidence'), 'geometry mapping engine emits audit and confidence');
check(geometryProfilesSource.includes("GEOMETRY_MAPPING_PROFILE_SCHEMA = 'geometry-mapping-user-profile/v1'"), 'geometry mapping profiles expose schema marker');
check(geometryProfilesSource.includes('applyGeometryMappingDecisions') && geometryProfilesSource.includes('CONFIRMED') && geometryProfilesSource.includes('REJECTED') && geometryProfilesSource.includes('USER_OVERRIDDEN'), 'geometry mapping profiles apply confirm/reject/override decisions');
check(geometryProfilesSource.includes('saveGeometryMappingProfile') && geometryProfilesSource.includes('listGeometryMappingProfiles'), 'geometry mapping profiles save and list profiles');
check(geometryProfileBridgeSource.includes('__PCF_GLB_GEOMETRY_MAPPING_PROFILE__'), 'geometry mapping profile bridge publishes global API');
check(geometryProfileBridgeSource.includes('data-gmp-confirm') && geometryProfileBridgeSource.includes('data-gmp-reject') && geometryProfileBridgeSource.includes('data-gmp-support-type'), 'geometry mapping profile bridge supports confirm/reject/override UI');
check(geometryProfileBridgeSource.includes('Save Profile') && geometryProfileBridgeSource.includes('Saved profiles'), 'geometry mapping profile bridge supports save/load UI');
check(geometryCalcRegistrySource.includes("GEOMETRY_CALCULATION_CANVAS_SCHEMA = 'geometry-calculation-canvas/v1'"), 'geometry calculation canvas exposes schema marker');
check(geometryCalcRegistrySource.includes('GEOMETRY_CALCULATION_MODULES') && geometryCalcRegistrySource.includes('support-load-readiness/v1'), 'geometry calculation registry declares support-load readiness module');
check(geometryCalcRegistrySource.includes('process.fluidDensityKgM3') && geometryCalcRegistrySource.includes('pipe.wallThicknessMm') && geometryCalcRegistrySource.includes('pipe.material'), 'support-load readiness requires process, wall, and material fields');
check(geometryCalcRegistrySource.includes('evaluateSupportLoadReadiness') && geometryCalcRegistrySource.includes('Missing required calculation field'), 'support-load readiness reports missing required fields');
check(geometryCalcRegistrySource.includes('does not calculate support loads') && !geometryCalcRegistrySource.includes('verticalLoadN ='), 'calculation registry validates readiness without fabricated load formulas');
check(geometryCalcBridgeSource.includes('__PCF_GLB_GEOMETRY_CALCULATION_CANVAS__'), 'geometry calculation canvas bridge publishes global API');
check(geometryCalcBridgeSource.includes('data-geometry-calculation-canvas-open') && geometryCalcBridgeSource.includes('CALC</span><span>Modules'), 'geometry calculation canvas bridge adds CALC Modules toolbar icon');
check(geometryCalcBridgeSource.includes('Run Validation') && geometryCalcBridgeSource.includes('Export Validation JSON'), 'geometry calculation canvas bridge supports validation and export actions');
check(geometryWorkspaceSource.includes("BRIDGE_VERSION = '20260622-geometry-mapping-1'"), 'geometry workspace bridge keeps mapping cache key');
check(geometryWorkspaceSource.includes("schemaVersion: 'geometry-export-workspace/v1'"), 'geometry workspace state uses independent schema');
check(geometryWorkspaceSource.includes('Top 5 hierarchy import tree') && geometryWorkspaceSource.includes('Mapped Objects') && geometryWorkspaceSource.includes('Calculation Canvas'), 'geometry workspace includes import, mapped objects, and calculation shells');
check(geometryWorkspaceSource.includes('mapRenderedGeometryRecords') && geometryWorkspaceSource.includes('runMapping'), 'geometry workspace runs automatic mapping');
check(geometryWorkspaceSource.includes('__PCF_GLB_GEOMETRY_EXPORT_WORKSPACE__'), 'geometry workspace publishes global API');
check(geometryWorkspaceSource.includes('data-geometry-export-workspace-open') && geometryWorkspaceSource.includes('Export</span>'), 'geometry workspace adds toolbar export geometry icon');

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
check(smartCivilFacetSource.includes('PROCESS_TERMS') && smartCivilFacetSource.includes('CIVIL_TERMS'), 'smart civil policy is taxonomy/geometry based');
check(remainingPrimitiveSource.includes("browser-rvm-remaining-primitives/v3-line-wire-diagnostics"), 'remaining primitive patch exposes code-10 line-wire schema');
check(!remainingPrimitiveSource.includes('function lineBoxGeometry'), 'RVM code-10 primitives are not converted into solid boxes');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP'), 'render builder keeps native facet primary path');
check(renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'bbox placeholders remain diagnostic wireframes');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'unconditional structure slab promotion remains blocked');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260622-geometry-calc-canvas-1'), 'index uses geometry calculation entry cache key');
check(entrySource.includes('core/app.js?v=20260622-geometry-calc-canvas-1'), 'entrypoint uses geometry calculation app cache key');
check(entrySource.includes('await init(startupMount())'), 'entrypoint passes resolved mount root into init');
check(appSource.includes('app-tab-click-state-bridge.js?v=20260622-tab-click-state-1'), 'app side-loads tab click state bridge');
check(appSource.includes('installAppTabClickStateBridge()'), 'app installs tab click state bridge before runtime delegate');
check(tabClickBridgeSource.includes('RuntimeEvents.TAB_CHANGED'), 'tab click state bridge listens for tab changes');
check(tabClickBridgeSource.includes('state.activeTabId = tabId'), 'tab click state bridge synchronizes active tab id');
check(appSource.includes('GeometryExportWorkspaceBridge.js?v=20260622-geometry-mapping-1'), 'app side-loads geometry mapping workspace bridge');
check(appSource.includes('GeometryMappingProfileBridge.js?v=20260622-geometry-profile-ui-1'), 'app side-loads geometry mapping profile bridge');
check(appSource.includes('GeometryCalculationCanvasBridge.js?v=20260622-geometry-calc-canvas-1'), 'app side-loads geometry calculation canvas bridge');
check(appSource.includes('installGeometryMappingProfileBridge()') && appSource.includes('installGeometryCalculationCanvasBridge()'), 'app installs geometry profile and calculation bridges');
check(appSource.includes('BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1'), 'app side-loads native facet ghost patch');
check(appSource.includes('app-label-perf-runtime.js?v=20260622-geometry-calc-canvas-1'), 'app delegates through geometry calculation runtime cache key');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260622-geometry-workspace-1') || runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260622-geometry-mapping-1') || runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260622-geometry-profile-ui-1') || runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260622-geometry-calc-canvas-1'), 'runtime keeps RVM renderer cache chain');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
