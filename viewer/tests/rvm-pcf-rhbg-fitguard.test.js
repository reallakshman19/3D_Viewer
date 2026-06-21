import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const tabSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
const labelPerfSource = await fs.readFile(new URL('../tabs/RvmLabelPerformanceBridge.js', import.meta.url), 'utf8');
const zoneLodSource = await fs.readFile(new URL('../tabs/RvmZoneLodLabelBridge.js', import.meta.url), 'utf8');
const jsonPcfTriggerSource = await fs.readFile(new URL('../tabs/RvmJsonPcfTriggerBridge.js', import.meta.url), 'utf8');
const uiPanelSource = await fs.readFile(new URL('../tabs/RvmUiInteractionPanelPatch.js', import.meta.url), 'utf8');
const propertyCollapseSource = await fs.readFile(new URL('../tabs/RvmPropertyPanelCollapseAuditBridge.js', import.meta.url), 'utf8');
const deferredSource = await fs.readFile(new URL('../tabs/RvmDeferredBridgeLoader.js', import.meta.url), 'utf8');
const drawerSource = await fs.readFile(new URL('../tabs/RvmBottomDiagnosticsDrawerBridge.js', import.meta.url), 'utf8');
const supportGeomSource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const stagedJsonSource = await fs.readFile(new URL('../tabs/RvmStagedJsonExportBridge.js', import.meta.url), 'utf8');
const browserLoadSource = await fs.readFile(new URL('../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const instructionFilterSource = await fs.readFile(new URL('../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const appHeaderCss = await fs.readFile(new URL('../styles/app-shell-header-fix.css', import.meta.url), 'utf8');
const appIconSource = await fs.readFile(new URL('../assets/app-icon.svg', import.meta.url), 'utf8');
const manifestSource = await fs.readFile(new URL('../site.webmanifest', import.meta.url), 'utf8');

check(rendererSource.includes('RvmDeferredBridgeLoader.js?v=20260621-rvm-button-hardening-1'), 'renderer loads hardened deferred bridge loader');
check(rendererSource.includes('RvmVisibilityToolbarBridge.js?v=20260621-rvm-perf-lazy-bridges-1'), 'renderer uses bumped visibility toolbar bridge cache key');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260621-rvm-zone-lod-labels-1'), 'renderer exports zone/LOD RVM tab cache key');
check(rendererSource.includes('RvmUiInteractionPanelPatch.js?v=20260621-rvm-ui-interaction-panels-1'), 'renderer loads RVM UI interaction bridge');
check(rendererSource.includes('RvmPropertyPanelCollapseAuditBridge.js?v=20260621-rvm-property-collapse-1'), 'renderer loads property collapse bridge');
check(rendererSource.includes('RvmLabelPerformanceBridge.js?v=20260621-rvm-zone-lod-labels-1'), 'renderer loads scoped label performance bridge');
check(rendererSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-zone-lod-labels-1'), 'renderer loads zone/LOD label bridge');
check(rendererSource.includes('RvmJsonPcfTriggerBridge.js?v=20260621-rvm-json-pcf-trigger-1'), 'renderer loads JSON/RVM PCF trigger bridge');
check(rendererSource.includes('RvmPolicyInfoBridge.js?v=20260621-rvm-policy-info-1'), 'renderer loads policy info bridge');
check(rendererSource.includes('RvmDiagnosticPanelCollapseBridge.js?v=20260621-rvm-diagnostic-collapse-1'), 'renderer loads diagnostic collapse bridge');
check(rendererSource.includes('installRvmZoneLodLabelBridge()'), 'renderer installs zone/LOD bridge');
check(rendererSource.includes('installRvmLabelButtonBridge()'), 'renderer installs label button bridge');
check(rendererSource.includes('installRvmJsonPcfTriggerBridge()'), 'renderer installs JSON/RVM PCF trigger bridge');
check(!rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer avoids eager stagedJSON bridge install');
check(!rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer avoids eager GLB bridge install');

check(browserLoadSource.includes('beforeRenderInstructions'), 'browser RVM load bridge exposes pre-render instruction selection hook');
check(browserLoadSource.includes('selectInstructionSetBeforeRender'), 'browser RVM load bridge pauses after worker parse and before mesh creation');
check(browserLoadSource.includes('browserRvmZoneSelection'), 'browser RVM diagnostics include zone selection');
check(browserLoadSource.includes('browserRvmLodSelection'), 'browser RVM diagnostics include LOD selection');
check(browserLoadSource.includes('worker-instructions-zone-select-lod-progressive-render-scene-first'), 'browser RVM responsive load path identifies zone/LOD render path');

check(zoneLodSource.includes('LARGE_FILE_THRESHOLD_BYTES = 8 * 1024 * 1024'), 'zone selector defaults to large-file threshold');
check(zoneLodSource.includes('showZoneSelector'), 'zone bridge opens searchable multi-zone selector');
check(zoneLodSource.includes('data-zone-search'), 'zone selector provides search input');
check(zoneLodSource.includes('data-zone-key'), 'zone selector provides checkbox rows');
check(zoneLodSource.includes('Detail') && zoneLodSource.includes('100%') && zoneLodSource.includes('50%') && zoneLodSource.includes('25%'), 'zone selector provides detail/LOD choices');
check(zoneLodSource.includes('filterInstructionSet'), 'zone bridge filters render instructions before WebGL mesh creation');
check(zoneLodSource.includes('lodSelection'), 'zone bridge records LOD diagnostics');
check(zoneLodSource.includes('zoneSelection'), 'zone bridge records zone diagnostics');

check(labelPerfSource.includes('LABEL_CONFIRM_THRESHOLD = 28'), 'label bridge warns before high label count');
check(labelPerfSource.includes('select a hierarchy/canvas item first'), 'label bridge requires selected hierarchy/canvas scope');
check(labelPerfSource.includes('applyScopedSupportLabelVisibility'), 'label bridge scopes visible labels to selected branch');
check(labelPerfSource.includes('estimateScopedLabelCount'), 'label bridge estimates scoped label count before enabling labels');
check(labelPerfSource.includes('window.confirm'), 'label bridge confirms high scoped label count');
check(labelPerfSource.includes('this.labelRenderer?.render') && labelPerfSource.includes('labelLayerVisible'), 'label bridge renders CSS2D labels only when label layer is visible');
check(labelPerfSource.includes('LARGE_MODEL_FRAME_MS = 66'), 'label bridge throttles large model frames');
check(labelPerfSource.includes('event.stopImmediatePropagation()'), 'label bridge owns label button click before legacy rebuild handler');

check(tabSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-zone-lod-labels-1'), 'RVM tab imports zone/LOD load bridge cache key');
check(tabSource.includes("RVM_TAB_JS_VERSION = '20260621-rvm-zone-lod-labels-1'"), 'RVM tab diagnostics version identifies zone/LOD path');
check(tabSource.includes('beforeRenderInstructions') && tabSource.includes('__PCF_GLB_RVM_ZONE_LOD_LABELS__'), 'RVM tab passes zone/LOD pre-render hook');
check(tabSource.includes('Zone mode') && tabSource.includes('LOD'), 'RVM diagnostics render zone and LOD rows');
check(tabSource.includes('function markRvmModelLoaded'), 'RVM tab explicitly marks successful model loads');
check(tabSource.includes('rvm-model-loaded'), 'RVM tab dispatches model-loaded event');
check(tabSource.includes('ensurePostModel'), 'RVM tab wakes post-model deferred bridges');
check(tabSource.includes('function cleanupRvmTab'), 'RVM tab has centralized cleanup');
check(tabSource.includes('rvm-tab-dispose'), 'RVM tab dispatches dispose lifecycle event');
check(tabSource.includes('MODE_ACTIONS'), 'RVM tab separates mode buttons from one-shot actions');

check(jsonPcfTriggerSource.includes('Sel → PCF') && jsonPcfTriggerSource.includes('Full → PCF'), 'JSON/RVM PCF bridge restores selected and full model buttons');
check(jsonPcfTriggerSource.includes('RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED'), 'JSON/RVM PCF bridge emits extract request event');
check(jsonPcfTriggerSource.includes("setActiveTab('rvm-json-pcf')"), 'JSON/RVM PCF bridge opens the receiver tab');
check(jsonPcfTriggerSource.includes("typeof document === 'undefined'"), 'JSON/RVM PCF bridge is safe for static Node imports');

check(uiPanelSource.includes('applyUniversalMouseContract'), 'UI bridge restores universal mouse contract');
check(uiPanelSource.includes('MIDDLE: THREE.MOUSE.ROTATE'), 'UI bridge maps center mouse to orbit');
check(uiPanelSource.includes('RIGHT: THREE.MOUSE.PAN'), 'UI bridge maps right mouse to pan');
check(uiPanelSource.includes('meshesInNdcBox'), 'UI bridge implements box selection against projected mesh centers');
check(uiPanelSource.includes('measureMarkerRadius'), 'UI bridge clamps measurement marker size');
check(uiPanelSource.includes('buildSelectionAnchoredSectionBox'), 'UI bridge anchors section box to selected geometry');
check(uiPanelSource.includes('moveLoadFirst'), 'UI bridge moves Load control to the left-most ribbon position');
check(uiPanelSource.includes('upgradeRightPanelSections'), 'UI bridge upgrades properties sections to collapsible/resizable panels');

check(propertyCollapseSource.includes('rvm-property-collapse-icon'), 'property collapse bridge gives every subpanel a visible collapse icon');
check(propertyCollapseSource.includes('font-size: 9px !important'), 'hierarchy listed components are reduced by 2px from 11px to 9px');
check(deferredSource.includes('refreshRootInstallEpoch'), 'deferred loader resets bridge cache for new tab roots');
check(deferredSource.includes('Promise.allSettled'), 'deferred loader uses allSettled');
check(deferredSource.includes('rvm-model-loaded'), 'deferred loader watches model loaded event');
check(drawerSource.includes('action-errors'), 'drawer includes action error panel');
check(drawerSource.includes('removeEventListener'), 'drawer removes listeners on cleanup');
check(supportGeomSource.includes('_rvmSupportGeometryRebuildNow'), 'SupportGeom exposes immediate rebuild hook');
check(!supportGeomSource.includes('supportSymbol: true'), 'generated SupportGeom is not tagged as unpickable supportSymbol');
check(supportAttSource.includes('SupportATT requires generated support geometry'), 'SupportATT reports generated geometry prerequisite');
check(stagedJsonSource.includes('hiddenReplaceSideEffect: false'), 'StagedJSON Support declares no hidden Replace side effect');
check(!stagedJsonSource.includes("localStorage.setItem('rvm_support_geometry_mode_v1', 'replace')"), 'StagedJSON Support no longer forces SupportGeom Replace in localStorage');

check(workerSource.includes('BrowserRvmInstructionFilterV2.js?v=20260621-rvm-zero-geometry-1'), 'RVM worker uses zero-geometry-safe instruction filter cache key');
check(workerSource.includes('DEFAULT_MAX_PRIMITIVE_BOX_SIDE = 50000'), 'RVM worker no longer treats 10 model units as oversized primitive side');
check(workerSource.includes('hideOversizedPrimitiveBoxes: options.hideOversizedPrimitiveBoxes === true'), 'RVM worker keeps primitive boxes visible unless explicitly hidden');
check(instructionFilterSource.includes("browser-rvm-instruction-filter/v4-plant-primitive-visible"), 'instruction filter exposes plant-primitive-visible schema');
check(instructionFilterSource.includes('hideOversizedPrimitiveBoxes: false'), 'instruction filter defaults primitive box hiding off');
check(instructionFilterSource.includes('maxPrimitiveBoxSide: 50000'), 'instruction filter uses millimetre-safe primitive side guard');

check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-zone-lod-labels-1'), 'index uses RVM zone/LOD labels entry cache key');
check(entrySource.includes('core/app.js?v=20260621-rvm-zone-lod-labels-1'), 'entrypoint uses RVM zone/LOD labels app cache key');
check(entrySource.includes('scheduleDeferredStartupSideEffects'), 'entrypoint defers optional startup side effects');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-zone-lod-labels-1'), 'app uses RVM zone/LOD labels renderer cache key');
check(appSource.includes('RvmZoneLodLabelBridge.js?v=20260621-rvm-zone-lod-labels-1'), 'app keeps RVM zone/LOD bridge marker');
check(appSource.includes('BrowserRvmLoadBridge.js?v=20260621-rvm-zone-lod-labels-1'), 'app keeps RVM zone/LOD load bridge marker');
check(appSource.includes('RVM_RENDERER_PREFLIGHT_MODULES'), 'app declares RVM preflight module list');
check(appSource.includes('Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES'), 'app preflight imports are parallel');
check(appSource.includes('function createBrandRail'), 'app shell renders a dedicated brand rail');
check(appSource.includes('function createTabIcon'), 'app shell renders professional tab icons');
check(appHeaderCss.includes('flex-direction: column'), 'app shell CSS forces header layout column');
check(appIconSource.includes('#2EE6C8') && appIconSource.includes('#FFB84D') && appIconSource.includes('RVM'), 'SVG icon contains pipe, section plane, and RVM mark');
check(manifestSource.includes('"name": "PCF GLB RVM Viewer"'), 'manifest names the professional viewer app');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
