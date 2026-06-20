import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed += 1;
  } else {
    console.error(`FAIL: ${label}`);
    failed += 1;
  }
}

const patchSource = await fs.readFile(new URL('../rvm-viewer/RvmProgressiveModelRootPatch.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const bridgeSource = await fs.readFile(new URL('../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const filterSource = await fs.readFile(new URL('../rvm/BrowserRvmInstructionFilter.js', import.meta.url), 'utf8');

check(patchSource.includes('pcf-glb-rvm-progressive-model-root-patch-v2'), 'fit patch v2 present');
check(patchSource.includes('resolveRobustProgressiveFit'), 'robust progressive fit present');
check(patchSource.includes('fitBoxWithoutFullSceneTraversal'), 'final fit avoids full traversal');
check(!patchSource.includes('this._fitBox(box)'), 'final fit avoids legacy fit box');
check(rendererSource.includes('RvmProgressiveModelRootPatch.js?v=20260620-rvm-rhbg-fitguard-1'), 'renderer loads fit guard patch');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-oversize-filter-1'), 'renderer loads oversize-filter tab');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-oversize-filter-1'), 'app loads oversize-filter renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-oversize-filter-1'), 'html loads oversize-filter entry');
check(entrySource.includes('core/app.js?v=20260620-rvm-oversize-filter-1'), 'entry loads oversize-filter app');
check(bridgeSource.includes('browser-rvm-worker.js?v=20260620-rvm-oversize-filter-1'), 'bridge loads oversize-filter worker');
check(workerSource.includes('BrowserRvmInstructionFilter.js?v=20260620-rvm-oversize-filter-1'), 'worker loads oversize filter');
check(filterSource.includes('oversizedNonPipingHidden'), 'filter reports skipped chunks');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
