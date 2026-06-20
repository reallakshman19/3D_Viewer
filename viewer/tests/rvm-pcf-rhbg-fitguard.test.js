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
const patchV5Source = await fs.readFile(new URL('../rvm-viewer/RvmProgressiveModelRootPatchV5.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const selectionBridgeSource = await fs.readFile(new URL('../tabs/RvmHierarchySelectionBridge.js', import.meta.url), 'utf8');
const interactionPatchSource = await fs.readFile(new URL('../tabs/RvmViewerInteractionPatch.js', import.meta.url), 'utf8');
const nativeTessellationSource = await fs.readFile(new URL('../rvm/BrowserRvmNativeTessellationRuntimePatch.js', import.meta.url), 'utf8');
const nativeDiagnosticsBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeTessellationDiagnosticsBridge.js', import.meta.url), 'utf8');
const tabSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');
const bridgeSource = await fs.readFile(new URL('../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
const workerPatchSource = await fs.readFile(new URL('../rvm/BrowserRvmCppMat3x4WorkerPatch.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
const transformParserSource = await fs.readFile(new URL('../rvm/BrowserRvmTransformParser.js', import.meta.url), 'utf8');
const transformHierarchySource = await fs.readFile(new URL('../rvm/BrowserRvmHierarchyTransformParser.js', import.meta.url), 'utf8');
const filterSource = await fs.readFile(new URL('../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');

check(patchSource.includes('pcf-glb-rvm-progressive-model-root-patch-v3'), 'fit patch v3 present');
check(patchSource.includes('rendered-world-bounds'), 'progressive fit uses rendered world bounds');
check(patchSource.includes('renderedBoundsUsed'), 'fit diagnostics expose rendered bounds usage');
check(patchV5Source.includes('rendered-world-bounds-no-hide'), 'v5 fits rendered bounds without hiding meshes');
check(!patchV5Source.includes('visible = false'), 'v5 must not hide fit outliers');
check(rendererSource.includes('RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1'), 'renderer loads no-hide fit patch');
check(rendererSource.includes('RvmHierarchySelectionBridge.js?v=20260620-rvm-tree-select-nohide-1'), 'renderer loads hierarchy selection bridge');
check(rendererSource.includes('RvmViewerInteractionPatch.js?v=20260620-rvm-toolbar-selection-1'), 'renderer loads toolbar/canvas interaction patch');
check(rendererSource.includes('BrowserRvmCppMat3x4WorkerPatch.js?v=20260620-rvm-cpp-mat3x4-1'), 'renderer installs C++ Mat3x4 worker patch');
check(rendererSource.includes('BrowserRvmNativeTessellationRuntimePatch.js?v=20260620-rvm-native-diagnostics-1'), 'renderer installs native tessellation diagnostics patch');
check(rendererSource.includes('RvmNativeTessellationDiagnosticsBridge.js?v=20260620-rvm-native-diagnostics-1'), 'renderer installs native tessellation diagnostics bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-native-diagnostics-1'), 'renderer loads native-diagnostics tab URL');
check(interactionPatchSource.includes('dispatchAction') && interactionPatchSource.includes('VIEW_FIT_ALL'), 'toolbar interaction patch implements dispatchAction');
check(interactionPatchSource.includes('installRvmCanvasSelectionBridge') && interactionPatchSource.includes('raycaster.intersectObject'), 'canvas selection bridge raycasts model geometry');
check(nativeTessellationSource.includes('browser-rvm-native-tessellation/v2-diagnostics-toggle'), 'native tessellation diagnostics schema present');
check(nativeTessellationSource.includes('setEnabled') && nativeTessellationSource.includes('runNow') && nativeTessellationSource.includes('rvm-native-tessellation-diagnostics'), 'native tessellation exposes toggle, rerun, and diagnostics events');
check(nativeTessellationSource.includes('cylinderGeometry') && nativeTessellationSource.includes('snoutGeometry') && nativeTessellationSource.includes('circularTorusGeometry'), 'native tessellation supports cylinder, snout and torus');
check(nativeTessellationSource.includes('matrix4FromCppMat3x4') && nativeTessellationSource.includes('m[0], m[3], m[6], m[9]'), 'native tessellation applies C++ Mat3x4 transform layout');
check(nativeTessellationSource.includes('native-cpp-tessellated'), 'native tessellation marks upgraded render quality');
check(nativeDiagnosticsBridgeSource.includes('Native Tessellation') && nativeDiagnosticsBridgeSource.includes('Native On') && nativeDiagnosticsBridgeSource.includes('Native Off') && nativeDiagnosticsBridgeSource.includes('Re-run'), 'native diagnostics bridge exposes UI controls');
check(tabSource.includes("BrowserRvmLoadBridge.js?v=20260620-rvm-flat-tree-1"), 'tab keeps flat-tree direct loader while worker URL is patched');
check(tabSource.includes("RVM_TAB_JS_VERSION = '20260620-rvm-flat-tree-1'"), 'tab diagnostics expose flat-tree version');
check(tabSource.includes('buildFlatNodeTree') && tabSource.includes('flat: true'), 'RVM tree renders flat selectable rows');
check(!tabSource.includes('const bounds = payload.browserRvmRender?.bounds'), 'tab does not issue duplicate post-load raw-bounds fit');
check(selectionBridgeSource.includes('Hierarchy selection') && selectionBridgeSource.includes('Fit Selection'), 'hierarchy details and fit-selection UI are present');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-native-diagnostics-1'), 'app loads native diagnostics renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-native-diagnostics-1'), 'html loads native diagnostics entry');
check(entrySource.includes('core/app.js?v=20260620-rvm-native-diagnostics-1'), 'entry loads native diagnostics app');
check(workerPatchSource.includes('browser-rvm-worker.js?v=20260620-rvm-cpp-mat3x4-1'), 'worker patch redirects to C++ Mat3x4 worker URL');
check(bridgeSource.includes('browser-rvm-worker.js?v=20260620-rvm-scale-safe-1'), 'base bridge remains scale-safe-compatible');
check(workerSource.includes('BrowserRvmHierarchyTransformParser.js?v=20260620-rvm-cpp-mat3x4-1'), 'worker loads C++ Mat3x4 hierarchy parser');
check(workerSource.includes('browserRvmCppMat3x4LayoutApplied'), 'worker exposes C++ Mat3x4 diagnostics');
check(transformParserSource.includes('browser-rvm-transform-parser/v2-cpp-mat3x4'), 'transform parser schema identifies C++ Mat3x4 layout');
check(transformParserSource.includes('transformPointCppMat3x4') && transformParserSource.includes('m[0] * p.x + m[3] * p.y + m[6] * p.z + m[9]'), 'transform parser uses C++ column-major Mat3x4 multiplication');
check(transformParserSource.includes('decodePrimitiveParams') && transformParserSource.includes('Cylinder') && transformParserSource.includes('Snout'), 'transform parser decodes native primitive parameters');
check(transformHierarchySource.includes('BrowserRvmTransformParser.js?v=20260620-rvm-cpp-mat3x4-1'), 'transform hierarchy imports C++ Mat3x4 parser');
check(transformHierarchySource.includes('cpp-mat3x4-transform-axis-contract'), 'transform wrapper marks C++ Mat3x4 render contract');
check(filterSource.includes('browser-rvm-instruction-filter/v2'), 'filter v2 schema present');
check(filterSource.includes('maxAbsoluteDiagonal') && filterSource.includes('5000'), 'filter v2 avoids hiding valid pipe racks by small threshold');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
