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
const zoneLodSource = await fs.readFile(new URL('../tabs/RvmZoneLodLabelBridge.js', import.meta.url), 'utf8');
const navisHierarchySource = await fs.readFile(new URL('../tabs/RvmNavisHierarchyBridge.js', import.meta.url), 'utf8');
const labelPerfSource = await fs.readFile(new URL('../tabs/RvmLabelPerformanceBridge.js', import.meta.url), 'utf8');
const uiPanelSource = await fs.readFile(new URL('../tabs/RvmUiInteractionPanelPatch.js', import.meta.url), 'utf8');
const propertyCollapseSource = await fs.readFile(new URL('../tabs/RvmPropertyPanelCollapseAuditBridge.js', import.meta.url), 'utf8');

check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260621-rvm-native-facet-primary-1'), 'renderer exports native facet primary RVM tab cache key');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-zone-lod-labels-1'), 'renderer keeps zone/LOD bridge');
check(rendererSource.includes('RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1'), 'renderer keeps Navis hierarchy bridge');
check(rendererSource.includes('installRvmZoneLodLabelBridge()'), 'renderer installs zone/LOD bridge');
check(rendererSource.includes('installRvmNavisHierarchyBridge()'), 'renderer installs Navis hierarchy bridge');
check(!rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer avoids eager stagedJSON bridge install');
check(!rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer avoids eager GLB bridge install');

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
check(navisHierarchySource.includes('installRvmNavisHierarchyBridge'), 'Navis hierarchy bridge remains installed');
check(labelPerfSource.includes('applyScopedSupportLabelVisibility'), 'labels remain scoped to selected branch');
check(uiPanelSource.includes('applyUniversalMouseContract'), 'universal mouse contract remains present');
check(propertyCollapseSource.includes('rvm-property-collapse-icon'), 'property panel collapse icons remain present');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-native-facet-primary-1'), 'index uses native facet primary entry cache key');
check(entrySource.includes('core/app.js?v=20260621-rvm-native-facet-primary-1'), 'entrypoint uses native facet primary app cache key');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-native-facet-primary-1'), 'app uses native facet primary renderer cache key');
check(appSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet load bridge marker');
check(appSource.includes('BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet render builder marker');
check(appSource.includes('browser-rvm-worker.js?v=20260621-rvm-native-facet-primary-1'), 'app keeps native facet worker marker');
check(appSource.includes('BrowserRvmNativeFacetGroupPrimary.js'), 'app keeps native facet module marker');
check(appSource.includes('RVM_RENDERER_PREFLIGHT_MODULES'), 'app declares RVM preflight module list');
check(appSource.includes('Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES'), 'app preflight imports are parallel');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
