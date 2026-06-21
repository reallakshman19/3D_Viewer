import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const tabSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
const browserLoadSource = await fs.readFile(new URL('../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
const nativeFacetSource = await fs.readFile(new URL('../rvm/BrowserRvmNativeFacetGroupPrimary.js', import.meta.url), 'utf8');
const renderBuilderSource = await fs.readFile(new URL('../rvm/BrowserRvmRenderSceneBuilder.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const instructionFilterSource = await fs.readFile(new URL('../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const runtimeSource = await fs.readFile(new URL('../core/app-label-perf-runtime.js', import.meta.url), 'utf8');
const sectioningSource = await fs.readFile(new URL('../rvm-viewer/RvmSectioning.js', import.meta.url), 'utf8');
const jsonPcfTriggerSource = await fs.readFile(new URL('../tabs/RvmJsonPcfTriggerBridge.js', import.meta.url), 'utf8');
const zoneLodSource = await fs.readFile(new URL('../tabs/RvmZoneLodLabelBridge.js', import.meta.url), 'utf8');
const zoneLodContextSource = await fs.readFile(new URL('../tabs/RvmZoneLodContextBridge.js', import.meta.url), 'utf8');
const selectionDetailsSource = await fs.readFile(new URL('../tabs/RvmSelectionDetailsInspectorBridge.js', import.meta.url), 'utf8');
const visibilityToolbarSource = await fs.readFile(new URL('../tabs/RvmVisibilityToolbarBridge.js', import.meta.url), 'utf8');
const visibilitySnapshotsSource = await fs.readFile(new URL('../tabs/RvmVisibilitySnapshotsBridge.js', import.meta.url), 'utf8');
const objectSearchSource = await fs.readFile(new URL('../tabs/RvmObjectSearchBridge.js', import.meta.url), 'utf8');
const measureSource = await fs.readFile(new URL('../tabs/RvmMeasureBridge.js', import.meta.url), 'utf8');
const sectionBoxSource = await fs.readFile(new URL('../tabs/RvmSectionBoxBridge.js', import.meta.url), 'utf8');
const selectionSetsSource = await fs.readFile(new URL('../tabs/RvmSelectionSetsBridge.js', import.meta.url), 'utf8');
const reportExportSource = await fs.readFile(new URL('../tabs/RvmReportExportBridge.js', import.meta.url), 'utf8');
const navisHierarchySource = await fs.readFile(new URL('../tabs/RvmNavisHierarchyBridge.js', import.meta.url), 'utf8');
const labelPerfSource = await fs.readFile(new URL('../tabs/RvmLabelPerformanceBridge.js', import.meta.url), 'utf8');
const uiPanelSource = await fs.readFile(new URL('../tabs/RvmUiInteractionPanelPatch.js', import.meta.url), 'utf8');
const propertyCollapseSource = await fs.readFile(new URL('../tabs/RvmPropertyPanelCollapseAuditBridge.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'renderer uses preload hierarchy zone selector cache key');
check(rendererSource.includes('RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1'), 'renderer keeps Navis hierarchy bridge');
check(rendererSource.includes('RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1'), 'renderer loads hierarchy zone LOD context bridge');
check(rendererSource.includes('RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1'), 'renderer loads selection details inspector bridge');
check(rendererSource.includes('RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1'), 'renderer loads isolate visibility toolbar bridge');
check(rendererSource.includes('RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1'), 'renderer loads visibility snapshots bridge');
check(rendererSource.includes('RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1'), 'renderer loads object search bridge');
check(rendererSource.includes('RvmMeasureBridge.js?v=20260621-rvm-measure-tools-1'), 'renderer loads measure bridge');
check(rendererSource.includes('installRvmMeasureBridge()'), 'renderer installs measure bridge');
check(rendererSource.includes('RvmSectionBoxBridge.js?v=20260621-rvm-section-box-1'), 'renderer loads selected section box bridge');
check(rendererSource.includes('installRvmSectionBoxBridge()'), 'renderer installs selected section box bridge');
check(rendererSource.includes('RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1'), 'renderer loads selection sets bridge');
check(rendererSource.includes('installRvmSelectionSetsBridge()'), 'renderer installs selection sets bridge');
check(rendererSource.includes('RvmReportExportBridge.js?v=20260621-rvm-report-export-1'), 'renderer loads report export bridge');
check(rendererSource.includes('installRvmReportExportBridge()'), 'renderer installs report export bridge');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'renderer loads visible-scope PCF trigger bridge');
check(!rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer avoids eager stagedJSON bridge install');
check(!rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer avoids eager GLB bridge install');

check(reportExportSource.includes("BRIDGE_VERSION = '20260621-rvm-report-export-1'"), 'report export bridge exposes cache/version marker');
check(reportExportSource.includes('MAX_EXPORT_ROWS') && reportExportSource.includes('MAX_SCAN_OBJECTS'), 'report export bridge caps exported rows and scanned objects');
check(reportExportSource.includes('REPORT_SCOPES') && reportExportSource.includes("'selected'") && reportExportSource.includes("'visible'") && reportExportSource.includes("'hidden'") && reportExportSource.includes("'all'"), 'report export bridge supports selected/visible/hidden/full scopes');
check(reportExportSource.includes('collectReportRows') && reportExportSource.includes('rowsToCsv'), 'report export bridge builds rows and CSV output');
check(reportExportSource.includes('Export CSV') && reportExportSource.includes('Export JSON'), 'report export bridge exposes CSV and JSON actions');
check(reportExportSource.includes('Blob') && reportExportSource.includes('URL.createObjectURL'), 'report export bridge downloads browser files');
check(reportExportSource.includes('__PCF_GLB_RVM_REPORT_EXPORT__'), 'report export bridge publishes global API');
check(reportExportSource.includes("typeof document === 'undefined'"), 'report export bridge is safe for static Node-side imports');
check(reportExportSource.includes('bboxPlaceholder') && reportExportSource.includes('nativeFacetPrimary'), 'report export rows include native/fallback geometry flags');

check(selectionSetsSource.includes("BRIDGE_VERSION = '20260621-rvm-selection-sets-1'"), 'selection sets bridge exposes cache/version marker');
check(selectionSetsSource.includes('MAX_SELECTION_SETS') && selectionSetsSource.includes('MAX_SET_OBJECT_IDS'), 'selection sets bridge bounds saved sets and object IDs');
check(selectionSetsSource.includes('Save Set') && selectionSetsSource.includes('Selection sets'), 'selection sets bridge exposes toolbar and summary labels');
check(selectionSetsSource.includes('captureSelectionSet') && selectionSetsSource.includes('applySetAction'), 'selection sets bridge captures and restores set actions');
check(selectionSetsSource.includes('localStorage') && selectionSetsSource.includes('STORAGE_PREFIX'), 'selection sets bridge persists per-file state');
check(selectionSetsSource.includes('RuntimeEvents.RVM_NODE_SELECTED'), 'selection sets bridge drives details through selection event');
check(selectionSetsSource.includes('__PCF_GLB_RVM_SELECTION_SETS__'), 'selection sets bridge publishes global API');
check(selectionSetsSource.includes("typeof document === 'undefined'"), 'selection sets bridge is safe for static Node-side imports');
check(selectionSetsSource.includes('globalThis.__PCF_GLB_RVM_VISIBILITY__?.isolateSelection'), 'selection sets bridge reuses visibility isolate action');
check(selectionSetsSource.includes('globalThis.__PCF_GLB_RVM_VISIBILITY__?.hideSelection'), 'selection sets bridge reuses visibility hide action');

check(sectionBoxSource.includes("BRIDGE_VERSION = '20260621-rvm-section-box-1'"), 'section box bridge exposes cache/version marker');
check(sectionBoxSource.includes('Clip') && sectionBoxSource.includes('Sel Box') && sectionBoxSource.includes('Model'), 'section box bridge exposes toolbar actions');
check(sectionBoxSource.includes('applySelectionSectionBox') && sectionBoxSource.includes('applyModelSectionBox'), 'section box bridge exposes selected and model clip functions');
check(sectionBoxSource.includes('expandPadding') && sectionBoxSource.includes('shrinkPadding'), 'section box bridge exposes padding controls');
check(sectionBoxSource.includes('MAX_SECTION_OBJECTS') && sectionBoxSource.includes('MAX_SECTION_SCAN_OBJECTS'), 'section box bridge caps section selection scans');
check(sectionBoxSource.includes('__PCF_GLB_RVM_SECTION_BOX__'), 'section box bridge publishes global API');
check(sectionBoxSource.includes("typeof document === 'undefined'"), 'section box bridge is safe for static Node-side imports');
check(sectionBoxSource.includes('globalThis.__PCF_GLB_RVM_VISIBILITY__?.collectSelectedObjects'), 'section box bridge reuses selection/visibility scope');
check(sectionBoxSource.includes('applyBoxSection') && sectionBoxSource.includes('fallbackApplyBoxSection'), 'section box bridge uses public sectioning API with fallback');

check(sectioningSource.includes('applyBoxSection(selectionBounds'), 'RVM sectioning exposes public applyBoxSection API');
check(sectioningSource.includes("this._sectionMode = 'BOX'"), 'RVM sectioning marks box mode when API applies clip box');
check(sectioningSource.includes('box.expandByScalar(safePadding)'), 'RVM sectioning applies safe section-box padding');
check(sectioningSource.includes('return box.clone()'), 'RVM sectioning returns applied section bounds');
check(sectioningSource.includes('_applyCurrentSectionClipping'), 'RVM sectioning applies clip planes to model materials');

check(objectSearchSource.includes("BRIDGE_VERSION = '20260621-rvm-object-search-1'"), 'object search bridge exposes cache/version marker');
check(objectSearchSource.includes('buildObjectSearchIndex') && objectSearchSource.includes('MAX_INDEX_OBJECTS'), 'object search bridge builds bounded rendered-object index');
check(objectSearchSource.includes('searchEntries') && objectSearchSource.includes('MAX_RESULTS'), 'object search bridge caps search results');
check(objectSearchSource.includes('selectObjects') && objectSearchSource.includes('RuntimeEvents.RVM_NODE_SELECTED'), 'object search bridge drives selection details via runtime selection event');
check(objectSearchSource.includes('__PCF_GLB_RVM_OBJECT_SEARCH__'), 'object search bridge publishes global API');
check(measureSource.includes("BRIDGE_VERSION = '20260621-rvm-measure-tools-1'"), 'measure bridge exposes cache/version marker');
check(measureSource.includes('measureSelectionExtents') && measureSource.includes('measureCenterDistance'), 'measure bridge exposes extent and center distance functions');
check(measureSource.includes('LineBasicMaterial') && measureSource.includes('RVM measurement overlay'), 'measure bridge renders lightweight distance overlay line');
check(measureSource.includes('__PCF_GLB_RVM_MEASURE__'), 'measure bridge publishes global API');
check(visibilityToolbarSource.includes('__PCF_GLB_RVM_VISIBILITY__'), 'visibility toolbar publishes global visibility API');
check(visibilitySnapshotsSource.includes('MAX_OBJECT_STATES') && visibilitySnapshotsSource.includes('MAX_SNAPSHOTS'), 'visibility snapshots bound saved object state and snapshot count');
check(jsonPcfTriggerSource.includes('Visible → PCF'), 'PCF trigger exposes visible-geometry scope button');
check(jsonPcfTriggerSource.includes('SYNTHETIC_INDEX_SCHEMA'), 'PCF trigger can synthesize an extract index from rendered objects');
check(selectionDetailsSource.includes('RVM selection details'), 'selection details inspector renders Navis-like details title');
check(selectionDetailsSource.includes('Native facet primary') && selectionDetailsSource.includes('Blocked bbox slab promotion'), 'selection details inspector reports native/fallback geometry policy flags');

check(tabSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-native-facet-primary-1'), 'RVM tab imports native facet primary load bridge cache key');
check(tabSource.includes("RVM_TAB_JS_VERSION = '20260621-rvm-native-facet-primary-1'"), 'RVM tab diagnostics version identifies native facet primary path');
check(tabSource.includes('beforeRenderInstructions') && tabSource.includes('__PCF_GLB_RVM_ZONE_LOD_LABELS__'), 'RVM tab keeps pre-render zone/LOD hook');
check(browserLoadSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge uses native facet render builder cache key');
check(browserLoadSource.includes('browser-rvm-worker.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge uses native facet worker cache key');
check(nativeFacetSource.includes('browser-rvm-native-facetgroup-primary/v1'), 'native facet module exposes schema');
check(nativeFacetSource.includes('export function buildNativeFacetGroupObject'), 'native facet module exports object builder');
check(nativeFacetSource.includes('RVM_TRANSFORM_3X4'), 'native facet module consumes transform matrix');
check(renderBuilderSource.includes('rvm-browser-render-scene/v6-native-facetgroup-primary'), 'render builder exposes native facet primary schema');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP'), 'render builder promotes native facet groups');
check(renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'bbox placeholders remain diagnostic wireframes');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'render builder does not restore unconditional STRUCTURE slab promotion');
check(workerSource.includes('RVM_TRANSFORM_3X4'), 'worker preserves transform matrix in compact transfer');
check(workerSource.includes('DEFAULT_MAX_PRIMITIVE_BOX_SIDE = 50000'), 'worker keeps millimetre-safe primitive side guard');
check(instructionFilterSource.includes('hideOversizedPrimitiveBoxes: false'), 'instruction filter defaults primitive box hiding off');
check(instructionFilterSource.includes('maxPrimitiveBoxSide: 50000'), 'instruction filter keeps millimetre-safe guard');
check(zoneLodSource.includes('buildPreloadHierarchyZones'), 'zone bridge builds selector rows from parsed manifest nodes');
check(zoneLodContextSource.includes('contextmenu'), 'hierarchy zone LOD context bridge binds right-click context menu');
check(labelPerfSource.includes('applyScopedSupportLabelVisibility'), 'labels remain scoped to selected branch');
check(navisHierarchySource.includes('installRvmNavisHierarchyBridge'), 'Navis hierarchy bridge remains installed');
check(uiPanelSource.includes('applyUniversalMouseContract'), 'universal mouse contract remains present');
check(propertyCollapseSource.includes('rvm-property-collapse-icon'), 'property panel collapse icons remain present');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-report-export-1'), 'index uses report export entry cache key');
check(entrySource.includes('core/app.js?v=20260621-rvm-report-export-1'), 'entrypoint uses report export app cache key');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-report-export-1'), 'app uses report export renderer cache marker');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-report-export-1'), 'runtime imports report export renderer cache key');
check(appSource.includes('RvmReportExportBridge.js?v=20260621-rvm-report-export-1'), 'app keeps report export bridge marker');
check(appSource.includes('RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1'), 'app keeps selection sets bridge marker');
check(appSource.includes('RvmSectionBoxBridge.js?v=20260621-rvm-section-box-1'), 'app keeps section box bridge marker');
check(appSource.includes('RvmMeasureBridge.js?v=20260621-rvm-measure-tools-1'), 'app keeps measure bridge marker');
check(appSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet load bridge marker');
check(appSource.includes('RVM_RENDERER_PREFLIGHT_MODULES'), 'app declares RVM preflight module list');
check(appSource.includes('Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES'), 'app preflight imports are parallel');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);