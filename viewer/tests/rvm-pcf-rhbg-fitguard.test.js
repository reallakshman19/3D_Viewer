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
const patchV4Source = await fs.readFile(new URL('../rvm-viewer/RvmProgressiveModelRootPatchV4.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const bridgeSource = await fs.readFile(new URL('../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const transformHierarchySource = await fs.readFile(new URL('../rvm/BrowserRvmHierarchyTransformParser.js', import.meta.url), 'utf8');
const filterSource = await fs.readFile(new URL('../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');

check(patchSource.includes('pcf-glb-rvm-progressive-model-root-patch-v3'), 'fit patch v3 present');
check(patchSource.includes('rendered-world-bounds'), 'progressive fit uses rendered world bounds');
check(patchSource.includes('renderedBoundsUsed'), 'fit diagnostics expose rendered bounds usage');
check(patchSource.includes('resolveRobustProgressiveFit'), 'robust progressive fit present');
check(patchSource.includes('fitBoxWithoutFullSceneTraversal'), 'final fit avoids full traversal');
check(!patchSource.includes('this._fitBox(box)'), 'final fit avoids legacy fit box');
check(patchV4Source.includes('pcf-glb-rvm-progressive-model-root-patch-v4'), 'fit patch v4 wrapper present');
check(patchV4Source.includes('duplicate-fit-suppressed-rendered-world-bounds'), 'duplicate final fit is suppressed');
check(rendererSource.includes('RvmProgressiveModelRootPatchV4.js?v=20260620-rvm-no-duplicate-fit-1'), 'renderer loads no-duplicate-fit patch');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-no-duplicate-fit-1'), 'renderer loads no-duplicate-fit tab URL');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-no-duplicate-fit-1'), 'app loads no-duplicate-fit renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-no-duplicate-fit-1'), 'html loads no-duplicate-fit entry');
check(entrySource.includes('core/app.js?v=20260620-rvm-no-duplicate-fit-1'), 'entry loads no-duplicate-fit app');
check(bridgeSource.includes('browser-rvm-worker.js?v=20260620-rvm-scale-safe-1'), 'bridge loads scale-safe worker');
check(workerSource.includes('BrowserRvmInstructionFilterV2.js?v=20260620-rvm-scale-safe-1'), 'worker loads scale-safe filter');
check(workerSource.includes('BrowserRvmHierarchyTransformParser.js?v=20260620-rvm-scale-safe-1'), 'worker loads scale-safe hierarchy parser');
check(transformHierarchySource.includes('RVM_BROWSER_SCALE_SAFE_CONTRACT'), 'transform wrapper repairs render contracts');
check(transformHierarchySource.includes('APOS') && transformHierarchySource.includes('LPOS') && transformHierarchySource.includes('HBOR'), 'scale-safe contract uses transformed APOS/LPOS/HBOR');
check(filterSource.includes('browser-rvm-instruction-filter/v2'), 'filter v2 schema present');
check(filterSource.includes('maxAbsoluteDiagonal') && filterSource.includes('5000'), 'filter v2 avoids hiding valid pipe racks by small threshold');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
