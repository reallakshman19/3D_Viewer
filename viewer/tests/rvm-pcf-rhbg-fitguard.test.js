import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed += 1;
  } else {
    console.error(`  FAIL: ${label}`);
    failed += 1;
  }
}

const patchSource = await fs.readFile(new URL('../rvm-viewer/RvmProgressiveModelRootPatch.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

assert(patchSource.includes('pcf-glb-rvm-progressive-model-root-patch-v2'), 'FG1: progressive fit patch uses v2 guard flag');
assert(patchSource.includes('ABS_OUTLIER_DIAGONAL = 50000'), 'FG1: fit guard has hard outlier diagonal threshold');
assert(patchSource.includes('resolveRobustProgressiveFit'), 'FG1: fit guard computes robust progressive bounds');
assert(patchSource.includes('browserRvmHiddenFitOutlier'), 'FG1: browser-derived fit outlier boxes are marked/hidden');
assert(patchSource.includes('fitBoxWithoutFullSceneTraversal'), 'FG2: progressive fit avoids RvmViewer3D._fitBox full-scene traversal');
assert(!patchSource.includes('this._fitBox(box)'), 'FG2: progressive fit must not delegate to _fitBox(box)');
assert(!patchSource.includes('new THREE.Box3().setFromObject(this.modelGroup)'), 'FG2: progressive fit must not compute full modelGroup bounds during final fit');
assert(rendererSource.includes('RvmProgressiveModelRootPatch.js?v=20260620-rvm-rhbg-fitguard-1'), 'FG3: app renderer cache-busts RHBG fit guard patch');
assert(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-rhbg-fitguard-1'), 'FG3: core app cache-busts RVM renderer');
assert(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-rhbg-fitguard-1'), 'FG3: HTML entrypoint cache-busts app shell');
assert(entrySource.includes("core/app.js?v=20260620-rvm-rhbg-fitguard-1"), 'FG3: RHBG entrypoint cache-busts core app');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
