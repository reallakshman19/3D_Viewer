import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function stripUrlSuffix(value) { return String(value || '').split('?')[0].split('#')[0]; }
function activeModuleEntrypoint(indexHtml) {
  const match = String(indexHtml).match(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || '';
}

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
  const workerPatchSource = await readFile(new URL('../../../rvm/BrowserRvmCppMat3x4WorkerPatch.js', import.meta.url), 'utf8');
  const nativeTessellationSource = await readFile(new URL('../../../rvm/BrowserRvmNativeTessellationRuntimePatch.js', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const filterSource = await readFile(new URL('../../../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');
  const transformParserSource = await readFile(new URL('../../../rvm/BrowserRvmTransformParser.js', import.meta.url), 'utf8');
  const transformHierarchySource = await readFile(new URL('../../../rvm/BrowserRvmHierarchyTransformParser.js', import.meta.url), 'utf8');
  const tabSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
  const hierarchySelectionBridgeSource = await readFile(new URL('../../../tabs/RvmHierarchySelectionBridge.js', import.meta.url), 'utf8');
  const interactionPatchSource = await readFile(new URL('../../../tabs/RvmViewerInteractionPatch.js', import.meta.url), 'utf8');
  const nativeDiagnosticsBridgeSource = await readFile(new URL('../../../tabs/RvmNativeTessellationDiagnosticsBridge.js', import.meta.url), 'utf8');
  const progressivePatchSource = await readFile(new URL('../../../rvm-viewer/RvmProgressiveModelRootPatch.js', import.meta.url), 'utf8');
  const progressivePatchV5Source = await readFile(new URL('../../../rvm-viewer/RvmProgressiveModelRootPatchV5.js', import.meta.url), 'utf8');
  const rendererSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const entrypointRef = activeModuleEntrypoint(indexHtml);
  const entrypointSource = await readFile(new URL(`../../../${stripUrlSuffix(entrypointRef).replace(/^\.\//, '')}`, import.meta.url), 'utf8');

  assert.doesNotMatch(bridgeSource, /buildResponsiveBrowserRvmRenderSceneFromHierarchy/, 'RVM load must not build render instructions from a full main-thread hierarchy.');
  assert.match(bridgeSource, /new\s+Worker\(workerUrl,\s*\{\s*type:\s*['"]module['"]\s*\}\)/, 'RVM load must use a module worker.');
  assert.match(bridgeSource, /worker\.postMessage\(\{\s*id,\s*arrayBuffer,\s*options:\s*stripWorkerOptions\(options\)\s*\},\s*\[arrayBuffer\]\)/, 'RVM ArrayBuffer must be transferred to the worker.');
  assert.match(workerPatchSource, /browser-rvm-worker\.js\?v=20260620-rvm-cpp-mat3x4-1/, 'C++ Mat3x4 worker patch must redirect the worker URL to the current parser.');
  assert.match(bridgeSource, /MAIN_THREAD_FALLBACK_MAX_BYTES\s*=\s*1024\s*\*\s*1024/, 'Main-thread parser fallback must be hard-limited.');
  assert.match(bridgeSource, /allowMainThreadParserFallback:\s*options\.allowMainThreadParserFallback\s*===\s*true/, 'Main-thread parser fallback must be opt-in.');
  assert.match(bridgeSource, /viewer\.setModel\(activeScene,\s*parsed\.upAxis\s*\|\|\s*['"]Z['"],\s*\{\s*progressive:\s*true,\s*fit:\s*false\s*\}\)/, 'An empty progressive scene must be mounted before mesh creation completes without immediate full fit.');
  assert.match(bridgeSource, /buildProgressiveBrowserRvmRenderSceneFromInstructions\(instructionSet,[\s\S]*targetScene:\s*activeScene/, 'Worker render instructions must be progressively instantiated into the mounted scene.');
  assert.match(bridgeSource, /elapsed\s*>=\s*renderOptions\.timeSliceMs[\s\S]*await\s+yieldToBrowser\(\{\s*signal:\s*options\.signal\s*\}\)/, 'Progressive scene creation must yield by time budget.');
  assert.match(bridgeSource, /createEventLoopWatchdog\(\{\s*thresholdMs:\s*100,\s*intervalMs:\s*50\s*\}\)/, 'RVM load must include a responsiveness watchdog.');
  assert.match(bridgeSource, /browserRvmStageTimingsMs:\s*perf\.measures[\s\S]*browserRvmMaxEventLoopStallMs:/, 'Diagnostics must expose timings and max event-loop stall.');
  assert.match(bridgeSource, /browserRvmWorkerEnabled:[\s\S]*browserRvmCompactInstructionTransfer:[\s\S]*browserRvmProgressiveRenderEnabled:/, 'Diagnostics must expose worker, compact transfer, and progressive flags.');
  assert.match(bridgeSource, /browserRvmScaleSafeContract/, 'Diagnostics must expose the scale-safe contract summary.');

  assert.match(workerSource, /BrowserRvmHierarchyTransformParser\.js\?v=20260620-rvm-cpp-mat3x4-1/, 'Worker must use the C++ Mat3x4 transform hierarchy parser with a cache-busted import.');
  assert.match(workerSource, /browserRvmCppMat3x4LayoutApplied/, 'Worker diagnostics must expose C++ Mat3x4 layout usage.');
  assert.match(workerSource, /browserRvmNativeParamDecodedCount/, 'Worker diagnostics must expose native parameter decode count.');
  assert.match(workerSource, /filterBrowserRvmRenderInstructions/, 'Worker must filter only absurd oversized non-piping instructions before transfer.');
  assert.match(workerSource, /BrowserRvmInstructionFilterV2\.js\?v=20260620-rvm-scale-safe-1/, 'Worker must cache-bust the scale-safe filter.');
  assert.match(workerSource, /enrichBrowserRvmHierarchyWithAtt/, 'Worker must perform ATT enrichment.');
  assert.match(workerSource, /collectBrowserRvmRenderInstructions/, 'Worker must generate render instructions.');
  assert.match(workerSource, /instructionSet:\s*compactInstructionSet[\s\S]*manifestNodes,/, 'Worker must return compact instructions and capped manifest nodes.');
  assert.match(workerSource, /browserRvmHierarchyReturnedToMainThread:\s*false/, 'Worker must not return the huge hierarchy on the normal path.');
  assert.doesNotMatch(workerSource, /hierarchy:\s*attEnrichment\.hierarchy/, 'Worker complete message must not transfer enriched hierarchy.');

  assert.match(filterSource, /BROWSER_RVM_INSTRUCTION_FILTER_SCHEMA/, 'Scale-safe filter must expose a schema.');
  assert.match(filterSource, /maxAbsoluteDiagonal/, 'Filter must use an absolute absurd-size threshold after transform.');
  assert.match(filterSource, /PROTECTED_OWNER_RE/, 'Filter must protect pipe-rack and structure-like owners from small-threshold hiding.');

  assert.match(transformParserSource, /browser-rvm-transform-parser\/v2-cpp-mat3x4/, 'Transform parser must identify the C++ Mat3x4 schema.');
  assert.match(transformParserSource, /transformPointCppMat3x4[\s\S]*m\[0\] \* p\.x \+ m\[3\] \* p\.y \+ m\[6\] \* p\.z \+ m\[9\]/, 'Transform parser must use the C++ column-major Mat3x4 point multiplication.');
  assert.match(transformParserSource, /decodePrimitiveParams[\s\S]*case 8:[\s\S]*radius[\s\S]*height/, 'Transform parser must decode native cylinder parameters.');
  assert.match(transformParserSource, /RVM_NATIVE_PRIMITIVE_PARAMS/, 'Transform parser must publish native primitive parameters.');
  assert.match(transformParserSource, /PARTIAL_BINARY_PRIM_RECORDS_CPP_MAT3X4_WORLD_TRANSFORMED/, 'Transform parser must identify C++ Mat3x4 world-transformed fidelity.');
  assert.match(transformHierarchySource, /BrowserRvmTransformParser\.js\?v=20260620-rvm-cpp-mat3x4-1/, 'Transform hierarchy wrapper must import the C++ Mat3x4 parser.');
  assert.match(transformHierarchySource, /RVM_BROWSER_SCALE_SAFE_CONTRACT/, 'Hierarchy wrapper must repair render contracts after grouping.');
  assert.match(transformHierarchySource, /cpp-mat3x4-transform-axis-contract/, 'Scale-safe contract must mark the C++ Mat3x4 render source.');

  assert.match(tabSource, /import\s+\{\s*loadRvmFileInBrowser\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmLoadBridge\.js\?v=20260620-rvm-flat-tree-1['"]/, 'The real tab module must import the flat-tree worker-first RVM loader directly.');
  assert.match(tabSource, /RVM_TAB_JS_VERSION\s*=\s*['"]20260620-rvm-flat-tree-1['"]/, 'The diagnostics version must identify the active flat-tree path.');
  assert.match(tabSource, /buildFlatNodeTree/, 'The RVM tab must define a flat hierarchy renderer.');
  assert.match(tabSource, /flat:\s*true/, 'The RVM load path must render flat hierarchy rows.');
  assert.match(tabSource, /Showing first \$\{limit\} of \$\{list\.length\} hierarchy nodes/, 'The flat tree cap message must report shown rows and total rows.');
  assert.match(tabSource, /data-rvm-direct-worker-load="true"/, 'The static file input must identify the direct RVM worker path.');
  assert.doesNotMatch(tabSource, /const\s+bounds\s*=\s*payload\.browserRvmRender\?\.bounds/, 'The tab must not perform a second raw-bounds fit after the worker loader completes.');

  assert.match(progressivePatchSource, /setProgressiveModelRoot/, 'RvmViewer3D must have a safe progressive mount entry point.');
  assert.match(progressivePatchSource, /originalSetModel/, 'The progressive patch must preserve the legacy JSON/UXML setModel path.');
  assert.match(progressivePatchSource, /browserRvmProgressiveRenderEnabled/, 'Progressive RVM roots must bypass full-scene setModel work.');
  assert.doesNotMatch(progressivePatchSource, /Box3\(\)\.setFromObject\(this\.modelGroup\)[\s\S]*computeBoundingSphere/, 'Progressive mount must not do full bounds and bounding-sphere work synchronously.');
  assert.match(progressivePatchV5Source, /rendered-world-bounds-no-hide/, 'Renderer must load a no-hide rendered-world-bounds fit patch.');
  assert.doesNotMatch(progressivePatchV5Source, /visible\s*=\s*false/, 'No-hide fit patch must not hide meshes during final fit.');
  assert.match(rendererSource, /RvmProgressiveModelRootPatchV5\.js\?v=20260620-rvm-tree-select-nohide-1/, 'Renderer must load the v5 no-hide fit patch.');
  assert.match(rendererSource, /RvmHierarchySelectionBridge\.js\?v=20260620-rvm-tree-select-nohide-1/, 'Renderer must load the hierarchy selection bridge.');
  assert.match(rendererSource, /RvmViewerInteractionPatch\.js\?v=20260620-rvm-toolbar-selection-1/, 'Renderer must load the toolbar/canvas selection patch.');
  assert.match(rendererSource, /BrowserRvmCppMat3x4WorkerPatch\.js\?v=20260620-rvm-cpp-mat3x4-1/, 'Renderer must install the C++ Mat3x4 worker patch.');
  assert.match(rendererSource, /BrowserRvmNativeTessellationRuntimePatch\.js\?v=20260620-rvm-native-diagnostics-1/, 'Renderer must install the native tessellation diagnostics runtime patch.');
  assert.match(rendererSource, /RvmNativeTessellationDiagnosticsBridge\.js\?v=20260620-rvm-native-diagnostics-1/, 'Renderer must load the native tessellation diagnostics UI bridge.');
  assert.match(rendererSource, /viewer3d-rvm-tab\.js\?v=20260620-rvm-native-diagnostics-1/, 'Renderer must load the native diagnostics tab cache key.');
  assert.match(hierarchySelectionBridgeSource, /Fit Selection/,'Hierarchy selection bridge must expose Fit Selection.');
  assert.match(interactionPatchSource, /dispatchAction[\s\S]*VIEW_FIT_ALL/, 'Toolbar patch must implement RVM actions.');
  assert.match(interactionPatchSource, /installRvmCanvasSelectionBridge[\s\S]*raycaster\.intersectObject/, 'Canvas patch must raycast rendered geometry.');
  assert.match(nativeTessellationSource, /browser-rvm-native-tessellation\/v2-diagnostics-toggle/, 'Native tessellation patch must expose diagnostics-toggle schema.');
  assert.match(nativeTessellationSource, /setEnabled/, 'Native tessellation must expose a setEnabled control.');
  assert.match(nativeTessellationSource, /runNow/, 'Native tessellation must expose a rerun control.');
  assert.match(nativeTessellationSource, /localStorage/, 'Native tessellation must persist enablement.');
  assert.match(nativeTessellationSource, /rvm-native-tessellation-diagnostics/, 'Native tessellation must dispatch diagnostics events.');
  assert.match(nativeTessellationSource, /cylinderGeometry[\s\S]*snoutGeometry[\s\S]*circularTorusGeometry/, 'Native tessellation patch must include C++ primitive geometry builders.');
  assert.match(nativeTessellationSource, /matrix4FromCppMat3x4[\s\S]*m\[0\],\s*m\[3\],\s*m\[6\],\s*m\[9\]/, 'Native tessellation must use C++ Mat3x4 row mapping.');
  assert.match(nativeTessellationSource, /native-cpp-tessellated/, 'Native tessellation must mark upgraded render quality.');
  assert.match(nativeDiagnosticsBridgeSource, /Native Tessellation[\s\S]*Native On[\s\S]*Native Off[\s\S]*Re-run/, 'Native diagnostics bridge must expose controls.');
  assert.match(nativeDiagnosticsBridgeSource, /__PCF_GLB_RVM_NATIVE_TESSELLATION_DIAGNOSTICS__/, 'Native diagnostics bridge must read global diagnostics.');

  assert.doesNotMatch(entrypointSource, /RvmBrowserRvmWorkerFirstBridge\.js/, 'The RVM freeze fix must not depend on an optional startup side-effect bridge.');
  assert.match(entrypointSource, /core\/app\.js\?v=20260620-rvm-native-diagnostics-1/, 'App shell cache key must include the native diagnostics version.');
  assert.match(indexHtml, /main(?:-[A-Za-z0-9_-]+)?\.js\?v=20260620-rvm-native-diagnostics-1/, 'GitHub Pages entrypoint must bump the app shell cache key.');
  assert.match(indexHtml, /viewer3d-rvm-tab\.css\?v=20260620-rvm-direct-tab-1/, 'RVM tab CSS cache key must be bumped.');

  console.log('Browser RVM direct tab native tessellation diagnostics contract test passed');
}

run();
