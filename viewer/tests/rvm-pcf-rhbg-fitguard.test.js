import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const fallbackBridgeSource = await fs.readFile(new URL('../tabs/RvmPrimitiveFallbackBridge.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1'), 'renderer loads clickable primitive fallback bridge');
check(rendererSource.includes('installRvmPrimitiveFallbackBridge()'), 'renderer installs primitive fallback bridge');
check(rendererSource.includes('RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-native-scene-glb-export-1'), 'renderer loads native scene GLB export bridge');
check(rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer installs native scene GLB export bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-native-scene-glb-export-1'), 'renderer loads native GLB export tab cache key');
check(fallbackBridgeSource.includes('rvm-primitive-fallback-review/v2-clickable-rows'), 'clickable fallback schema present');
check(fallbackBridgeSource.includes('__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__'), 'fallback diagnostics global present');
check(fallbackBridgeSource.includes('selectFallback') && fallbackBridgeSource.includes('data-rvm-fallback-id'), 'fallback rows are selectable');
check(fallbackBridgeSource.includes('setSelectionFromObjects') && fallbackBridgeSource.includes('fitSelection'), 'fallback row selection fits selected object');
check(fallbackBridgeSource.includes('fallbackObjects') && fallbackBridgeSource.includes('fallbackReasonCounts'), 'fallback object list and reasons are exposed');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v1-att-extras'), 'native GLB export schema present');
check(exportBridgeSource.includes('exportSceneToGLB') && exportBridgeSource.includes('Visible GLB'), 'native export uses GLB exporter and visible action');
check(exportBridgeSource.includes('Selected GLB') && exportBridgeSource.includes('viewer._rvmCanvasSelectedMeshes'), 'selected native GLB export uses canvas selection');
check(exportBridgeSource.includes('browserRvmAttributes') && exportBridgeSource.includes('glbExportSchema'), 'ATT/userData metadata is preserved as GLB node extras');
check(exportBridgeSource.includes('__PCF_GLB_RVM_NATIVE_GLB_EXPORT_DIAGNOSTICS__'), 'native GLB export diagnostics global present');
check(exportBridgeSource.includes('fallbackDiagnostics') && exportBridgeSource.includes('fallbackReasonCounts'), 'export audit includes primitive fallback diagnostics');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-native-scene-glb-export-1'), 'app loads native GLB export renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-native-scene-glb-export-1'), 'index loads native GLB export entrypoint');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
