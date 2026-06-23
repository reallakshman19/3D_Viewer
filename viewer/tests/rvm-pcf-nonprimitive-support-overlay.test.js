import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}
async function read(path) { return fs.readFile(new URL(path, import.meta.url), 'utf8'); }

const bridgeSource = await read('../tabs/RvmNonPrimitiveSupportOverlayBridge.js');
const rendererSource = await read('../tabs/viewer3d-rvm-tab-renderer.js');
const tabSource = await read('../tabs/viewer3d-rvm-tab.js');
const labelSource = await read('../tabs/RvmLabelPerformanceBridge.js');
const contractSource = await read('../rvm/BrowserRvmRenderContractAdapter.js');

check(bridgeSource.includes("RVM_NON_PRIMITIVE_SUPPORT_OVERLAY_SCHEMA = 'rvm-non-primitive-support-overlay/v1'"), 'non-primitive overlay exposes schema marker');
check(bridgeSource.includes('__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__') && bridgeSource.includes('__RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__'), 'non-primitive overlay publishes global API and isolated root');
check(bridgeSource.includes('AvevaJsonLoader') && bridgeSource.includes('__rvmNonPrimitiveSourceHierarchy'), 'non-primitive overlay annotates source-loader models only');
check(bridgeSource.includes('setModelWithNonPrimitiveSupportOverlay') && bridgeSource.includes("clear(this, 'primitive-rvm-or-no-source-hierarchy')"), 'non-primitive overlay clears on primitive RVM/no-source model loads');
check(bridgeSource.includes("kind === 'rvm'") && bridgeSource.includes('RVM_SOURCE_RE.test(name)'), 'non-primitive overlay explicitly excludes RVM/REV');
check(bridgeSource.includes('json') && bridgeSource.includes('jscon') && bridgeSource.includes('inputxml') && bridgeSource.includes('txt'), 'non-primitive overlay allows intended source file families');
check(bridgeSource.includes('THREE.LineSegments') && bridgeSource.includes('LineBasicMaterial'), 'non-primitive overlay renders line glyphs only');
check(!bridgeSource.includes('RvmSupportSymbols') && !bridgeSource.includes('RvmSupportIndexAttributeBridge') && !bridgeSource.includes('RvmSupportMapper'), 'non-primitive overlay does not depend on retired support engines');
check(!bridgeSource.includes('ConeGeometry') && !bridgeSource.includes('CylinderGeometry') && !bridgeSource.includes('ArrowHelper') && !bridgeSource.includes('CSS2DObject'), 'non-primitive overlay avoids solid cones/cylinders and CSS labels');
check(bridgeSource.includes('supportOverlayOnly: true') && bridgeSource.includes('pickable: false') && bridgeSource.includes('selectable: false'), 'non-primitive overlay marks glyphs non-pickable overlay-only');

check(rendererSource.includes('RvmNonPrimitiveSupportOverlayBridge.js?v=20260623-nonprimitive-support-overlay-1'), 'renderer loads non-primitive support overlay bridge with cache key');
check(rendererSource.includes('installRvmNonPrimitiveSupportOverlayBridge()'), 'renderer installs non-primitive support overlay bridge');
check(tabSource.includes('RVM_TAB_JS_VERSION = \'20260622-rvm-support-runtime-retired-2\''), 'RVM tab remains support-runtime-retired base shell');
check(!tabSource.includes('RvmSupportSymbols') && !tabSource.includes('RvmSupportIndexAttributeBridge') && !tabSource.includes('rvm-support-labels'), 'RVM tab does not reintroduce retired support runtime/UI');
check(labelSource.includes('pcf-glb-rvm-label-performance-bridge-v2-no-support-runtime') && !labelSource.includes('applyScopedSupportLabelVisibility'), 'label bridge remains generic and no support label scoping returns');
check(contractSource.includes('supportRuntimeRetired: true') && !contractSource.includes('RVM_BROWSER_SUPPORT_HINT'), 'browser RVM render contract remains support-runtime retired');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
