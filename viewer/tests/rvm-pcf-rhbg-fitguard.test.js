import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const tabSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
const uiPanelSource = await fs.readFile(new URL('../tabs/RvmUiInteractionPanelPatch.js', import.meta.url), 'utf8');
const deferredSource = await fs.readFile(new URL('../tabs/RvmDeferredBridgeLoader.js', import.meta.url), 'utf8');
const drawerSource = await fs.readFile(new URL('../tabs/RvmBottomDiagnosticsDrawerBridge.js', import.meta.url), 'utf8');
const supportGeomSource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const stagedJsonSource = await fs.readFile(new URL('../tabs/RvmStagedJsonExportBridge.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const appHeaderCss = await fs.readFile(new URL('../styles/app-shell-header-fix.css', import.meta.url), 'utf8');

check(rendererSource.includes('RvmDeferredBridgeLoader.js?v=20260621-rvm-button-hardening-1'), 'renderer loads button-hardening deferred bridge loader');
check(rendererSource.includes('RvmVisibilityToolbarBridge.js?v=20260621-rvm-perf-lazy-bridges-1'), 'renderer uses bumped visibility toolbar bridge cache key');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260621-rvm-button-hardening-1'), 'renderer exports button-hardening RVM tab cache key');
check(rendererSource.includes('RvmUiInteractionPanelPatch.js?v=20260621-rvm-ui-interaction-panels-1'), 'renderer loads RVM UI interaction panel hardening bridge');
check(rendererSource.includes('installRvmUiInteractionPanelPatch(RvmViewer3D)'), 'renderer patches RVM viewer interactions before mount');
check(rendererSource.includes('installRvmUiPanelBridge()'), 'renderer installs RVM panel bridge');
check(rendererSource.includes('installRvmDeferredBridgeLoader()'), 'renderer installs deferred bridge loader');
check(!rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer avoids eager stagedJSON bridge install');
check(!rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer avoids eager GLB bridge install');
check(uiPanelSource.includes('applyUniversalMouseContract'), 'UI bridge restores universal mouse contract');
check(uiPanelSource.includes('MIDDLE: THREE.MOUSE.ROTATE'), 'UI bridge maps center mouse to orbit');
check(uiPanelSource.includes('RIGHT: THREE.MOUSE.PAN'), 'UI bridge maps right mouse to pan');
check(uiPanelSource.includes('meshesInNdcBox'), 'UI bridge implements box selection against projected mesh centers');
check(uiPanelSource.includes('measureMarkerRadius'), 'UI bridge clamps measurement marker size');
check(uiPanelSource.includes('buildSelectionAnchoredSectionBox'), 'UI bridge anchors section box to selected geometry');
check(uiPanelSource.includes('moveLoadFirst'), 'UI bridge moves Load control to the left-most ribbon position');
check(uiPanelSource.includes('upgradeRightPanelSections'), 'UI bridge upgrades properties sections to collapsible/resizable panels');
check(uiPanelSource.includes('Browser RVM Performance|Native Tessellation|Primitive Fallback Review'), 'diagnostic property panels default collapsed');
check(tabSource.includes('function markRvmModelLoaded'), 'RVM tab explicitly marks successful model loads');
check(tabSource.includes('rvm-model-loaded'), 'RVM tab dispatches model-loaded event');
check(tabSource.includes('ensurePostModel'), 'RVM tab wakes post-model deferred bridges');
check(tabSource.includes('function cleanupRvmTab'), 'RVM tab has centralized cleanup');
check(tabSource.includes('rvm-tab-dispose'), 'RVM tab dispatches dispose lifecycle event');
check(tabSource.includes('_rvmEscKeyCleanup'), 'RVM tab cleans Escape listener');
check(tabSource.includes('_rvmSupportGeometryCleanup'), 'RVM tab cleans support geometry interval');
check(tabSource.includes('MODE_ACTIONS'), 'RVM tab separates mode buttons from one-shot actions');
check(tabSource.includes('__PCF_GLB_RVM_REPORT_ACTION_ERROR__'), 'RVM tab routes button errors to action diagnostics');
check(deferredSource.includes('postModel'), 'deferred loader has post-model group');
check(deferredSource.includes('refreshRootInstallEpoch'), 'deferred loader resets bridge cache for new tab roots');
check(deferredSource.includes('RvmSupportGeometryBridge.js?v=20260621-rvm-button-hardening-1'), 'deferred loader imports hardened support geometry bridge');
check(deferredSource.includes('RvmSupportAttMappingBridge.js?v=20260621-rvm-button-hardening-1'), 'deferred loader imports hardened support ATT bridge');
check(deferredSource.includes('RvmStagedJsonExportBridge.js?v=20260621-rvm-button-hardening-1'), 'deferred loader imports hardened stagedJSON bridge');
check(deferredSource.includes('Promise.allSettled'), 'deferred loader uses allSettled');
check(deferredSource.includes('rvm-model-loaded'), 'deferred loader watches model loaded event');
check(deferredSource.includes('detected-model-group'), 'deferred loader polls model group readiness');
check(deferredSource.includes('rvm_support_geometry_mode_v1'), 'support geometry mode defaults to Off');
check(drawerSource.includes('action-errors'), 'drawer includes action error panel');
check(drawerSource.includes('removeEventListener'), 'drawer removes listeners on cleanup');
check(supportGeomSource.includes('_rvmSupportGeometryRebuildNow'), 'SupportGeom exposes immediate rebuild hook');
check(supportGeomSource.includes('rvm-tab-dispose'), 'SupportGeom listens for tab dispose');
check(!supportGeomSource.includes('supportSymbol: true'), 'generated SupportGeom is not tagged as unpickable supportSymbol');
check(supportAttSource.includes('SupportATT requires generated support geometry'), 'SupportATT reports generated geometry prerequisite');
check(stagedJsonSource.includes('hiddenReplaceSideEffect: false'), 'StagedJSON Support declares no hidden Replace side effect');
check(!stagedJsonSource.includes("localStorage.setItem('rvm_support_geometry_mode_v1', 'replace')"), 'StagedJSON Support no longer forces SupportGeom Replace in localStorage');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-stagedjson-validation-1'), 'legacy entry cache marker remains');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-button-hardening-1'), 'button-hardening entry cache marker remains');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-ui-interaction-panels-1'), 'index uses RVM UI interaction entry cache key');
check(indexSource.includes('styles/app-shell-header-fix.css?v=20260621-rvm-ui-interaction-panels-1'), 'index loads app shell header layout fix CSS');
check(entrySource.includes('core/app.js?v=20260621-rvm-ui-interaction-panels-1'), 'entrypoint uses RVM UI interaction app cache key');
check(entrySource.includes('scheduleDeferredStartupSideEffects'), 'entrypoint defers optional startup side effects');
check(appSource.includes('RVM_RENDERER_PREFLIGHT_MODULES'), 'app declares RVM preflight module list');
check(appSource.includes('Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES'), 'app preflight imports are parallel');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-ui-interaction-panels-1'), 'app uses RVM UI interaction renderer cache key');
check(appHeaderCss.includes('flex-direction: column'), 'app shell CSS forces header layout column');
check(appHeaderCss.includes('body .app-nav'), 'app shell CSS overrides cramped side-nav fallback');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
