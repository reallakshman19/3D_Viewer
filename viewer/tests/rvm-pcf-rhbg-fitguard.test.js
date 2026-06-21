import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const deferredSource = await fs.readFile(new URL('../tabs/RvmDeferredBridgeLoader.js', import.meta.url), 'utf8');
const drawerSource = await fs.readFile(new URL('../tabs/RvmBottomDiagnosticsDrawerBridge.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmDeferredBridgeLoader.js?v=20260621-rvm-perf-lazy-bridges-1'), 'renderer loads deferred bridge loader');
check(rendererSource.includes('installRvmDeferredBridgeLoader()'), 'renderer installs deferred bridge loader');
check(!rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer avoids eager stagedJSON bridge install');
check(!rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer avoids eager GLB bridge install');
check(deferredSource.includes('postModel'), 'deferred loader has post-model group');
check(deferredSource.includes('Promise.allSettled'), 'deferred loader uses allSettled');
check(deferredSource.includes('rvm-model-loaded'), 'deferred loader watches model loaded event');
check(deferredSource.includes('detected-model-group'), 'deferred loader polls model group readiness');
check(deferredSource.includes('RvmStagedJsonExportBridge.js'), 'deferred loader imports stagedJSON bridge');
check(deferredSource.includes('RvmNativeSceneGlbExportBridge.js'), 'deferred loader imports native GLB bridge');
check(deferredSource.includes('RvmSupportGeometryBridge.js'), 'deferred loader imports support geometry bridge');
check(deferredSource.includes('rvm_support_geometry_mode_v1'), 'support geometry mode defaults to Off');
check(drawerSource.includes('action-errors'), 'drawer includes action error panel');
check(drawerSource.includes('removeEventListener'), 'drawer removes listeners on cleanup');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-stagedjson-validation-1'), 'legacy entry cache marker remains');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260621-rvm-perf-lazy-bridges-1'), 'index uses lazy bridge entry cache key');
check(entrySource.includes('core/app.js?v=20260621-rvm-perf-lazy-bridges-1'), 'entrypoint uses lazy bridge app cache key');
check(entrySource.includes('scheduleDeferredStartupSideEffects'), 'entrypoint defers optional startup side effects');
check(appSource.includes('RVM_RENDERER_PREFLIGHT_MODULES'), 'app declares RVM preflight module list');
check(appSource.includes('Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES'), 'app preflight imports are parallel');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260621-rvm-perf-lazy-bridges-1'), 'app uses lazy bridge renderer cache key');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
