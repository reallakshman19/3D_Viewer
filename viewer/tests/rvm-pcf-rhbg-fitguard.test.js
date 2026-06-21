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
const jsonPcfTriggerSource = await fs.readFile(new URL('../tabs/RvmJsonPcfTriggerBridge.js', import.meta.url), 'utf8');
const zoneLodSource = await fs.readFile(new URL('../tabs/RvmZoneLodLabelBridge.js', import.meta.url), 'utf8');
const zoneLodContextSource = await fs.readFile(new URL('../tabs/RvmZoneLodContextBridge.js', import.meta.url), 'utf8');
const selectionDetailsSource = await fs.readFile(new URL('../tabs/RvmSelectionDetailsInspectorBridge.js', import.meta.url), 'utf8');
const visibilityToolbarSource = await fs.readFile(new URL('../tabs/RvmVisibilityToolbarBridge.js', import.meta.url), 'utf8');
const visibilitySnapshotsSource = await fs.readFile(new URL('../tabs/RvmVisibilitySnapshotsBridge.js', import.meta.url), 'utf8');
const navisHierarchySource = await fs.readFile(new URL('../tabs/RvmNavisHierarchyBridge.js', import.meta.url), 'utf8');
const labelPerfSource = await fs.readFile(new URL('../tabs/RvmLabelPerformanceBridge.js', import.meta.url), 'utf8');
const uiPanelSource = await fs.readFile(new URL('../tabs/RvmUiInteractionPanelPatch.js', import.meta.url), 'utf8');
const propertyCollapseSource = await fs.readFile(new URL('../tabs/RvmPropertyPanelCollapseAuditBridge.js', import.meta.url), 'utf8');

check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260621-rvm-native-facet-primary-1'), 'renderer exports native facet primary RVM tab cache key');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'renderer uses preload hierarchy zone selector cache key');
check(rendererSource.includes('RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1'), 'renderer keeps Navis hierarchy bridge');
check(rendererSource.includes('RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1'), 'renderer loads hierarchy zone LOD context bridge');
check(rendererSource.includes('RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1'), 'renderer loads selection details inspector bridge');
check(rendererSource.includes('RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1'), 'renderer loads isolate visibility toolbar bridge');
check(rendererSource.includes('RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1'), 'renderer loads visibility snapshots bridge');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'renderer loads visible-scope PCF trigger bridge');
check(rendererSource.includes('installRvmZoneLodLabelBridge()'), 'renderer installs zone/LOD bridge');
check(rendererSource.includes('installRvmNavisHierarchyBridge()'), 'renderer installs Navis hierarchy bridge');
check(rendererSource.includes('installRvmZoneLodContextBridge()'), 'renderer installs hierarchy zone LOD context bridge');
check(rendererSource.includes('installRvmSelectionDetailsInspectorBridge()'), 'renderer installs selection details inspector bridge');
check(rendererSource.includes('installRvmVisibilityToolbarBridge()'), 'renderer installs isolate visibility toolbar bridge');
check(rendererSource.includes('installRvmVisibilitySnapshotsBridge()'), 'renderer installs visibility snapshots bridge');
check(rendererSource.includes('installRvmJsonPcfTriggerBridge()'), 'renderer installs visible-scope PCF trigger bridge');
check(!rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer avoids eager stagedJSON bridge install');
check(!rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer avoids eager GLB bridge install');

check(visibilityToolbarSource.includes("BRIDGE_VERSION = '20260621-rvm-isolate-visibility-toolbar-1'"), 'visibility toolbar exposes isolate bridge version');
check(visibilityToolbarSource.includes('Isolate') && visibilityToolbarSource.includes('Show All'), 'visibility toolbar exposes isolate and show-all actions');
check(visibilityToolbarSource.includes('__PCF_GLB_RVM_VISIBILITY__'), 'visibility toolbar publishes global visibility API');
check(visibilityToolbarSource.includes('isolateSelection') && visibilityToolbarSource.includes('hideSelection') && visibilityToolbarSource.includes('showAll'), 'visibility toolbar implements isolate/hide/show-all operations');
check(visibilityToolbarSource.includes('rvmVisibilityBaseVisible') && visibilityToolbarSource.includes('rvmIsolatedHiddenByVisibilityToolbar'), 'visibility toolbar preserves base visibility while isolating branches');
check(visibilityToolbarSource.includes('data-rvm-visibility-summary'), 'visibility toolbar renders visibility counters');
check(visibilityToolbarSource.includes("typeof document === 'undefined'"), 'visibility toolbar is safe for static Node-side imports');

check(visibilitySnapshotsSource.includes("BRIDGE_VERSION = '20260621-rvm-visibility-snapshots-1'"), 'visibility snapshots bridge exposes cache/version marker');
check(visibilitySnapshotsSource.includes("STORAGE_PREFIX = 'rvm_visibility_snapshots_v1:'"), 'visibility snapshots persist per-file view states');
check(visibilitySnapshotsSource.includes('Save View') && visibilitySnapshotsSource.includes('Restore') && visibilitySnapshotsSource.includes('Manage'), 'visibility snapshots expose save/restore/manage toolbar actions');
check(visibilitySnapshotsSource.includes('captureSnapshot') && visibilitySnapshotsSource.includes('restoreSnapshot'), 'visibility snapshots implement capture and restore operations');
check(visibilitySnapshotsSource.includes('MAX_OBJECT_STATES') && visibilitySnapshotsSource.includes('MAX_SNAPSHOTS'), 'visibility snapshots bound saved object state and snapshot count');
check(visibilitySnapshotsSource.includes('cameraState') && visibilitySnapshotsSource.includes('restoreCamera'), 'visibility snapshots persist and restore camera state');
check(visibilitySnapshotsSource.includes('__PCF_GLB_RVM_VIEW_SNAPSHOTS__'), 'visibility snapshots publish global API');
check(visibilitySnapshotsSource.includes('rvmHiddenByVisibilitySnapshot'), 'visibility snapshots mark restored hidden objects');
check(visibilitySnapshotsSource.includes("typeof document === 'undefined'"), 'visibility snapshots bridge is safe for static Node-side imports');

check(jsonPcfTriggerSource.includes('Visible → PCF'), 'PCF trigger exposes visible-geometry scope button');
check(jsonPcfTriggerSource.includes('SYNTHETIC_INDEX_SCHEMA'), 'PCF trigger can synthesize an extract index from rendered objects');
check(jsonPcfTriggerSource.includes('visibleCanonicalIdsFromViewer'), 'PCF trigger collects only currently visible objects for visible scope');
check(jsonPcfTriggerSource.includes('selectedVisibleOnly'), 'PCF trigger records visible-scope extraction state');
check(jsonPcfTriggerSource.includes("version: '20260621-rvm-pcf-visible-scope-1'"), 'PCF trigger exposes visible-scope bridge version');

check(selectionDetailsSource.includes('installRvmSelectionDetailsInspectorBridge'), 'selection details inspector exports installer');
check(selectionDetailsSource.includes('RuntimeEvents.RVM_NODE_SELECTED'), 'selection details inspector listens to RVM selection events');
check(selectionDetailsSource.includes('rvm-selection-details-inspector-1'), 'selection details inspector exposes cache/version marker');
check(selectionDetailsSource.includes('RVM selection details'), 'selection details inspector renders Navis-like details title');
check(selectionDetailsSource.includes('PCF extraction scope'), 'selection details inspector reports PCF extraction readiness');
check(selectionDetailsSource.includes('Native facet primary') && selectionDetailsSource.includes('Blocked bbox slab promotion'), 'selection details inspector reports native/fallback geometry policy flags');
check(selectionDetailsSource.includes('Bbox min') && selectionDetailsSource.includes('Bbox max') && selectionDetailsSource.includes('Size XYZ'), 'selection details inspector reports bbox and size details');
check(selectionDetailsSource.includes('data-rvm-selection-detail-action="copy-path"'), 'selection details inspector exposes copy path action');
check(selectionDetailsSource.includes("typeof document === 'undefined'"), 'selection details inspector is safe for static Node-side imports');

check(tabSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-native-facet-primary-1'), 'RVM tab imports native facet primary load bridge cache key');
check(tabSource.includes("RVM_TAB_JS_VERSION = '20260621-rvm-native-facet-primary-1'"), 'RVM tab diagnostics version identifies native facet primary path');
check(tabSource.includes('beforeRenderInstructions') && tabSource.includes('__PCF_GLB_RVM_ZONE_LOD_LABELS__'), 'RVM tab keeps pre-render zone/LOD hook');
check(tabSource.includes('Native facet groups'), 'RVM diagnostics expose native facet row');
check(tabSource.includes('function markRvmModelLoaded'), 'RVM tab marks successful model loads');
check(tabSource.includes('rvm-model-loaded'), 'RVM tab dispatches model-loaded event');
check(tabSource.includes('function cleanupRvmTab'), 'RVM tab has cleanup lifecycle');
check(tabSource.includes('MODE_ACTIONS'), 'RVM tab separates mode actions');

check(browserLoadSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge uses native facet render builder cache key');
check(browserLoadSource.includes('browser-rvm-worker.js?v=20260621-rvm-native-facet-primary-1'), 'load bridge uses native facet worker cache key');
check(browserLoadSource.includes('browserRvmNativeFacetGroupPrimaryRenderer'), 'load bridge exposes native facet renderer diagnostic');
check(browserLoadSource.includes('browserRvmNativeFacetGroupPrimaryCount'), 'load bridge exposes native facet count diagnostic');
check(browserLoadSource.includes('browserRvmRenderEffectivePrimitiveCounts'), 'load bridge exposes effective primitive diagnostics');
check(browserLoadSource.includes('worker-instructions-zone-select-lod-native-facet-primary-progressive-render-scene-first'), 'load path identifies native facet primary renderer');

check(nativeFacetSource.includes('browser-rvm-native-facetgroup-primary/v1'), 'native facet module exposes schema');
check(nativeFacetSource.includes('export function buildNativeFacetGroupObject'), 'native facet module exports object builder');
check(nativeFacetSource.includes('export function hasDecodedNativeFacetGroup'), 'native facet module exports decoded facet detector');
check(nativeFacetSource.includes('RVM_NATIVE_PRIMITIVE_PARAMS'), 'native facet module consumes decoded native params');
check(nativeFacetSource.includes('RVM_TRANSFORM_3X4'), 'native facet module consumes transform matrix');
check(nativeFacetSource.includes('matrix4FromCppMat3x4'), 'native facet module applies C++ transform layout');
check(nativeFacetSource.includes('BufferGeometry') && nativeFacetSource.includes('setIndex'), 'native facet module builds indexed BufferGeometry');
check(nativeFacetSource.includes('browserRvmNativeFacetGroupPrimary'), 'native facet module marks native facet primary objects');

check(renderBuilderSource.includes('rvm-browser-render-scene/v6-native-facetgroup-primary'), 'render builder exposes native facet primary schema');
check(renderBuilderSource.includes('BrowserRvmNativeFacetGroupPrimary.js'), 'render builder imports native facet helper');
check(renderBuilderSource.includes('RVM_NATIVE_FACET_GROUP'), 'render builder promotes native facet groups');
check(renderBuilderSource.includes('nativeFacetGroupPrimaryCount'), 'render builder tracks native facet group count');
check(renderBuilderSource.includes('native-facetgroup-primary'), 'render builder records native facet quality');
check(renderBuilderSource.includes('wireframe-diagnostic-not-solid-geometry'), 'bbox placeholders remain diagnostic wireframes');
check(renderBuilderSource.includes('bboxPromotedSolidBlocked'), 'render builder keeps blocked bbox promotion diagnostics');
check(!renderBuilderSource.includes("primitive === 'STRUCTURE_BBOX' || type === 'STRUCTURE'"), 'render builder does not restore unconditional STRUCTURE slab promotion');

check(workerSource.includes('RVM_TRANSFORM_3X4'), 'worker preserves transform matrix in compact transfer');
check(workerSource.includes('browserRvmNativeFacetGroupPrimaryTransformPreserved'), 'worker reports native facet transform preservation');
check(workerSource.includes('BrowserRvmInstructionFilterV2.js?v=20260621-rvm-zero-geometry-1'), 'worker uses zero-geometry-safe filter cache key');
check(workerSource.includes('DEFAULT_MAX_PRIMITIVE_BOX_SIDE = 50000'), 'worker keeps millimetre-safe primitive side guard');
check(workerSource.includes('hideOversizedPrimitiveBoxes: options.hideOversizedPrimitiveBoxes === true'), 'worker keeps primitive box hiding opt-in');
check(instructionFilterSource.includes('hideOversizedPrimitiveBoxes: false'), 'instruction filter defaults primitive box hiding off');
check(instructionFilterSource.includes('maxPrimitiveBoxSide: 50000'), 'instruction filter keeps millimetre-safe guard');

check(zoneLodSource.includes('filterInstructionSet'), 'zone bridge still filters instructions before WebGL mesh creation');
check(zoneLodSource.includes('PRELOAD_MANIFEST_SCHEMA'), 'zone bridge declares preload hierarchy manifest schema');
check(zoneLodSource.includes('buildPreloadHierarchyZones'), 'zone bridge builds selector rows from parsed manifest nodes');
check(zoneLodSource.includes('instructionMatchesZone'), 'zone bridge supports branch-prefix filtering');
check(zoneLodSource.includes('browser-rvm-zone-selection/v2-preload-hierarchy-checkboxes'), 'zone diagnostics identify preload hierarchy selector v2');
check(zoneLodSource.includes("version: '20260621-rvm-preload-hierarchy-selector-1'"), 'zone bridge exposes preload selector version');
check(navisHierarchySource.includes('installRvmNavisHierarchyBridge'), 'Navis hierarchy bridge remains installed');
check(zoneLodContextSource.includes('installRvmZoneLodContextBridge'), 'hierarchy zone LOD context bridge exports installer');
check(zoneLodContextSource.includes('contextmenu'), 'hierarchy zone LOD context bridge binds right-click context menu');
check(zoneLodContextSource.includes('rvm_zone_lod_context_v1:'), 'hierarchy zone LOD context bridge persists per-file overrides');
check(zoneLodContextSource.includes('Render branch at 50%') && zoneLodContextSource.includes('Render branch at 25%'), 'hierarchy context menu exposes 50% and 25% branch detail actions');
check(zoneLodContextSource.includes('Hide branch') && zoneLodContextSource.includes('Reset all saved overrides'), 'hierarchy context menu exposes hide and reset actions');
check(zoneLodContextSource.includes('applyPersistedOverrides'), 'hierarchy zone LOD context bridge reapplies saved overrides after model load');
check(zoneLodContextSource.includes('rvmZoneLodOriginalVisible'), 'hierarchy zone LOD context bridge preserves original object visibility');
check(zoneLodContextSource.includes("typeof document === 'undefined'"), 'hierarchy zone LOD context bridge is safe for static Node-side imports');
check(labelPerfSource.includes('applyScopedSupportLabelVisibility'), 'labels remain scoped to selected branch');
check(uiPanelSource.includes('applyUniversalMouseContract'), 'universal mouse contract remains present');
check(propertyCollapseSource.includes('rvm-property-collapse-icon'), 'property panel collapse icons remain present');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-native-facet-primary-1'), 'index keeps native facet primary entry cache marker');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-zone-lod-context-1'), 'index keeps zone LOD context entry cache marker');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-pcf-visible-scope-1'), 'index keeps visible-scope PCF entry cache marker');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'index keeps preload hierarchy selector entry marker');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-selection-details-inspector-1'), 'index keeps selection details inspector entry marker');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-isolate-visibility-toolbar-1'), 'index keeps isolate visibility toolbar entry marker');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-visibility-snapshots-1'), 'index uses visibility snapshots entry cache key');
check(entrySource.includes('core/app.js?v=20260621-rvm-native-facet-primary-1'), 'entrypoint keeps native facet primary app cache marker');
check(entrySource.includes('core/app.js?v=20260621-rvm-zone-lod-context-1'), 'entrypoint keeps zone LOD context app cache marker');
check(entrySource.includes('core/app.js?v=20260621-rvm-pcf-visible-scope-1'), 'entrypoint keeps visible-scope PCF app cache marker');
check(entrySource.includes('core/app.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'entrypoint keeps preload hierarchy selector app marker');
check(entrySource.includes('core/app.js?v=20260621-rvm-selection-details-inspector-1'), 'entrypoint keeps selection details inspector app marker');
check(entrySource.includes('core/app.js?v=20260621-rvm-isolate-visibility-toolbar-1'), 'entrypoint keeps isolate visibility toolbar app marker');
check(entrySource.includes('core/app.js?v=20260621-rvm-visibility-snapshots-1'), 'entrypoint uses visibility snapshots app cache key');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet primary renderer cache marker');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-zone-lod-context-1'), 'app keeps zone LOD context renderer cache marker');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-pcf-visible-scope-1'), 'app keeps visible-scope PCF renderer cache marker');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'app keeps preload hierarchy selector renderer marker');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-selection-details-inspector-1'), 'app keeps selection details inspector renderer marker');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-isolate-visibility-toolbar-1'), 'app keeps isolate visibility toolbar renderer marker');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-visibility-snapshots-1'), 'app uses visibility snapshots renderer cache marker');
check(runtimeSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-visibility-snapshots-1'), 'runtime imports visibility snapshots renderer cache key');
check(appSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1'), 'app keeps preload hierarchy zone bridge marker');
check(appSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1'), 'app keeps visible-scope PCF bridge cache marker');
check(appSource.includes('RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1'), 'app keeps selection details inspector bridge marker');
check(appSource.includes('RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1'), 'app keeps isolate visibility toolbar bridge marker');
check(appSource.includes('RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1'), 'app keeps visibility snapshots bridge marker');
check(appSource.includes('RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1'), 'app keeps zone LOD context bridge marker');
check(appSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet load bridge marker');
check(appSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet render builder marker');
check(appSource.includes('browser-rvm-worker.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet worker marker');
check(appSource.includes('BrowserRvmNativeFacetGroupPrimary.js'), 'app keeps native facet module marker');
check(appSource.includes('RVM_RENDERER_PREFLIGHT_MODULES'), 'app declares RVM preflight module list');
check(appSource.includes('Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES'), 'app preflight imports are parallel');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
