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

check(rendererSource.includes('RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1'), 'renderer loads clickable primitive fallback bridge');
check(rendererSource.includes('installRvmPrimitiveFallbackBridge()'), 'renderer installs primitive fallback bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-primitive-fallback-clickable-1'), 'renderer loads clickable primitive tab cache key');
check(fallbackBridgeSource.includes('rvm-primitive-fallback-review/v2-clickable-rows'), 'clickable fallback schema present');
check(fallbackBridgeSource.includes('__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__'), 'fallback diagnostics global present');
check(fallbackBridgeSource.includes('selectFallback') && fallbackBridgeSource.includes('data-rvm-fallback-id'), 'fallback rows are selectable');
check(fallbackBridgeSource.includes('setSelectionFromObjects') && fallbackBridgeSource.includes('fitSelection'), 'fallback row selection fits selected object');
check(fallbackBridgeSource.includes('fallbackObjects') && fallbackBridgeSource.includes('fallbackReasonCounts'), 'fallback object list and reasons are exposed');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-primitive-fallback-clickable-1'), 'app loads clickable fallback renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-primitive-fallback-clickable-1'), 'index loads clickable fallback entrypoint');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
