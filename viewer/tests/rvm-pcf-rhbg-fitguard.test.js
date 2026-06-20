import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const fallbackBridgeSource = await fs.readFile(new URL('../tabs/RvmPrimitiveFallbackBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const workerPatchSource = await fs.readFile(new URL('../rvm/BrowserRvmCppMat3x4WorkerPatch.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const remainingPrimitiveSource = await fs.readFile(new URL('../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js', import.meta.url), 'utf8');
const torusParitySource = await fs.readFile(new URL('../rvm/BrowserRvmTorusParityRuntimePatch.js', import.meta.url), 'utf8');
const snoutParitySource = await fs.readFile(new URL('../rvm/BrowserRvmSnoutParityRuntimePatch.js', import.meta.url), 'utf8');
const dishTessellationSource = await fs.readFile(new URL('../rvm/BrowserRvmDishTessellationRuntimePatch.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-review-1'), 'renderer loads primitive fallback review bridge');
check(rendererSource.includes('installRvmPrimitiveFallbackBridge()'), 'renderer installs primitive fallback review bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-primitive-fallback-review-1'), 'renderer loads primitive review tab cache key');
check(fallbackBridgeSource.includes('rvm-primitive-fallback-review/v1'), 'fallback review schema present');
check(fallbackBridgeSource.includes('__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__'), 'fallback review exposes diagnostics global');
check(fallbackBridgeSource.includes('primitiveDecodedKindCounts') && fallbackBridgeSource.includes('primitiveNativeUpgradedKindCounts') && fallbackBridgeSource.includes('primitiveFallbackKindCounts'), 'fallback review exposes decoded/native/fallback counts');
check(fallbackBridgeSource.includes('fallbackReasonCounts') && fallbackBridgeSource.includes('Re-scan'), 'fallback review exposes fallback reasons and rescan UI');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-primitive-fallback-review-1'), 'app loads primitive fallback renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-primitive-fallback-review-1'), 'index loads guarded RVM entrypoint');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');
check(workerPatchSource.includes('browser-rvm-worker.js?v=20260620-rvm-facetgroup-1'), 'worker patch remains on facet group worker');
check(workerSource.includes('browserRvmFacetGroupDecodedCount') && workerSource.includes('browserRvmCppMat3x4ScaledRadiusApplied'), 'worker keeps facet and scale diagnostics');
check(remainingPrimitiveSource.includes('facetGroupTessellatedCount') && remainingPrimitiveSource.includes('native-cpp-facetgroup-tessellated'), 'facet group runtime remains installed');
check(torusParitySource.includes('browser-rvm-torus-parity/v1-cpp-capped-torus'), 'torus parity runtime remains installed');
check(snoutParitySource.includes('browser-rvm-snout-parity/v1-cpp-capped-snout'), 'snout parity runtime remains installed');
check(dishTessellationSource.includes('browser-rvm-dish-tessellation/v1-cpp-mat3x4'), 'dish runtime remains installed');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
