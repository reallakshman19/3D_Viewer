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
  const dishTessellationSource = await readFile(new URL('../../../rvm/BrowserRvmDishTessellationRuntimePatch.js', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const filterSource = await readFile(new URL('../../../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');
  const renderContractSource = await readFile(new URL('../../../rvm/BrowserRvmRenderContractAdapter.js', import.meta.url), 'utf8');
  const transformParserSource = await readFile(new URL('../../../rvm/BrowserRvmTransformParser.js', import.meta.url), 'utf8');
  const transformHierarchySource = await readFile(new URL('../../../rvm/BrowserRvmHierarchyTransformParser.js', import.meta.url), 'utf8');
  const tabSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
  const hierarchySelectionBridgeSource = await readFile(new URL('../../../tabs/RvmHierarchySelectionBridge.js', import.meta.url), 'utf8');
  const interactionPatchSource = await readFile(new URL('../../../tabs/RvmViewerInteractionPatch.js', import.meta.url), 'utf8');
  const visibilityToolbarSource = await readFile(new URL('../../../tabs/RvmVisibilityToolbarBridge.js', import.meta.url), 'utf8');
  const selectionTreeSyncSource = await readFile(new URL('../../../tabs/RvmSelectionTreeSyncBridge.js', import.meta.url), 'utf8');
  const supportSummarySource = await readFile(new URL('../../../tabs/RvmSupportSummaryBridge.js', import.meta.url), 'utf8');
  const supportAssemblySource = await readFile(new URL('../../../tabs/RvmSupportAssemblyBridge.js', import.meta.url), 'utf8');
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
  assert.match(workerPatchSource, /browser-rvm-worker\.js\?v=20260620-rvm-scale-leak-1/, 'Worker patch must redirect to the scale-leak worker URL.');
  assert.match(bridgeSource, /MAIN_THREAD_FALLBACK_MAX_BYTES\s*=\s*1024\s*\*\s*1024/, 'Main-thread parser fallback must be hard-limited.');
  assert.match(bridgeSource, /allowMainThreadParserFallback:\s*options\.allowMainThreadParserFallback\s*===\s*true/, 'Main-thread parser fallback must be opt-in.');
  assert.match(bridgeSource, /viewer\.setModel\(activeScene,\s*parsed\.upAxis\s*\|\|\s*['"]Z['"],\s*\{\s*progressive:\s*true,\s*fit:\s*false\s*\}\)/, 'An empty progressive scene must be mounted before mesh creation completes without immediate full fit.');
  assert.match(bridgeSource, /buildProgressiveBrowserRvmRenderSceneFromInstructions\(instructionSet,[\s\S]*targetScene:\s*activeScene/, 'Worker render instructions must be progressively instantiated into the mounted scene.');
  assert.match(bridgeSource, /elapsed\s*>=\s*renderOptions\.timeSliceMs[\s\S]*await\s+yieldToBrowser\(\{\s*signal:\s*options\.signal\s*\}\)/, 'Progressive scene creation must yield by time budget.');
  assert.match(bridgeSource, /createEventLoopWatchdog\(\{\s*thresholdMs:\s*100,\s*intervalMs:\s*50\s*\}\)/, 'RVM load must include a responsiveness watchdog.');
  assert.match(bridgeSource, /browserRvmScaleSafeContract/, 'Diagnostics must expose the scale-safe contract summary.');

  assert.match(workerSource, /BrowserRvmHierarchyTransformParser\.js\?v=20260620-rvm-scale-leak-1/, 'Worker must use the scaled-radius transform hierarchy parser.');
  assert.match(workerSource, /BrowserRvmInstructionFilterV2\.js\?v=20260620-rvm-large-box-filter-1/, 'Worker must load the large-box filter module.');
  assert.match(workerSource, /maxPrimitiveBoxSide[\s\S]*DEFAULT_MAX_PRIMITIVE_BOX_SIDE/, 'Worker must pass configurable max primitive box side.');
  assert.match(workerSource, /browserRvmCppMat3x4ScaledRadiusApplied/, 'Worker diagnostics must expose scaled-radius usage.');
  assert.match(workerSource, /browserRvmNativeParamDecodedCount/, 'Worker diagnostics must expose native parameter decode count.');
  assert.match(workerSource, /filterBrowserRvmRenderInstructions/, 'Worker must filter only absurd oversized non-piping instructions before transfer.');
  assert.match(workerSource, /enrichBrowserRvmHierarchyWithAtt/, 'Worker must perform ATT enrichment.');
  assert.match(workerSource, /collectBrowserRvmRenderInstructions/, 'Worker must generate render instructions.');
  assert.match(workerSource, /instructionSet:\s*compactInstructionSet[\s\S]*manifestNodes,/, 'Worker must return compact instructions and capped manifest nodes.');
  assert.match(workerSource, /browserRvmHierarchyReturnedToMainThread:\s*false/, 'Worker must not return the huge hierarchy on the normal path.');

  assert.match(filterSource, /browser-rvm-instruction-filter\/v3-large-box-side/, 'Large-box filter must expose a v3 schema.');
  assert.match(filterSource, /maxPrimitiveBoxSide[\s\S]*oversized-primitive-box-side/, 'Filter must skip primitive boxes with any side over configured threshold.');
  assert.match(filterSource, /SUPPORT_OWNER_RE[\s\S]*supportLike/, 'Filter must protect support-like geometry from large-box side skip.');
  assert.match(renderContractSource, /v3-support-hints[\s\S]*SUPPORT_HINT_RE[\s\S]*SUPPORT_BBOX_PLACEHOLDER/, 'Render contract adapter must promote support-like RVM objects.');

  assert.match(transformParserSource, /browser-rvm-transform-parser\/v3-cpp-mat3x4-scaled-radius/, 'Transform parser must identify the scaled-radius C++ Mat3x4 schema.');
  assert.match(transformParserSource, /transformPointCppMat3x4[\s\S]*m\[0\] \* p\.x \+ m\[3\] \* p\.y \+ m\[6\] \* p\.z \+ m\[9\]/, 'Transform parser must use the C++ column-major Mat3x4 point multiplication.');
  assert.match(transformParserSource, /decodePrimitiveParams[\s\S]*case 8:[\s\S]*radius[\s\S]*height/, 'Transform parser must decode native cylinder parameters.');
  assert.match(transformParserSource, /validScales\.length \? Math\.max\(\.\.\.validScales\) : 1/, 'Transform parser must not clamp downscale factors to one.');
  assert.match(transformParserSource, /RVM_RADIUS_SCALE_SOURCE[\s\S]*RVM_RADIUS_SCALED_BY_TRANSFORM/, 'Transform parser must annotate scaled radius output.');
  assert.match(transformHierarchySource, /BrowserRvmTransformParser\.js\?v=20260620-rvm-scale-leak-1/, 'Transform hierarchy wrapper must import the scaled-radius parser.');
  assert.match(transformHierarchySource, /v3-scaled-dish-contract/, 'Scale-safe contract must mark scaled dish/flange source.');
  assert.match(transformHierarchySource, /FLANGE_BBOX_PLACEHOLDER[\s\S]*DISH_BBOX_PLACEHOLDER/, 'Code 5/6 dish/flange primitives must not be routed to BOX_SOLID.');

  assert.match(tabSource, /import\s+\{\s*loadRvmFileInBrowser\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmLoadBridge\.js\?v=20260620-rvm-flat-tree-1['"]/, 'The real tab module must import the flat-tree worker-first RVM loader directly.');
  assert.match(tabSource, /buildFlatNodeTree/, 'The RVM tab must define a flat hierarchy renderer.');
  assert.match(tabSource, /flat:\s*true/, 'The RVM load path must render flat hierarchy rows.');
  assert.match(tabSource, /Showing first \$\{limit\} of \$\{list\.length\} hierarchy nodes/, 'The flat tree cap message must report shown rows and total rows.');
  assert.doesNotMatch(tabSource, /const\s+bounds\s*=\s*payload\.browserRvmRender\?\.bounds/, 'The tab must not perform a second raw-bounds fit after the worker loader completes.');

  assert.match(progressivePatchSource, /setProgressiveModelRoot/, 'RvmViewer3D must have a safe progressive mount entry point.');
  assert.match(progressivePatchSource, /originalSetModel/, 'The progressive patch must preserve the legacy JSON/UXML setModel path.');
  assert.match(progressivePatchSource, /browserRvmProgressiveRenderEnabled/, 'Progressive RVM roots must bypass full-scene setModel work.');
  assert.doesNotMatch(progressivePatchSource, /Box3\(\)\.setFromObject\(this\.modelGroup\)[\s\S]*computeBoundingSphere/, 'Progressive mount must not do full bounds and bounding-sphere work synchronously.');
  assert.match(progressivePatchV5Source, /rendered-world-bounds-no-hide/, 'Renderer must load a no-hide rendered-world-bounds fit patch.');
  assert.doesNotMatch(progressivePatchV5Source, /visible\s*=\s*false/, 'No-hide fit patch must not hide meshes during final fit.');
  assert.match(rendererSource, /RvmProgressiveModelRootPatchV5\.js\?v=20260620-rvm-tree-select-nohide-1/, 'Renderer must load the v5 no-hide fit patch.');
  assert.match(rendererSource, /RvmHierarchySelectionBridge\.js\?v=20260620-rvm-large-box-support-sync-1/, 'Renderer must load the support-sync hierarchy selection bridge.');
  assert.match(rendererSource, /RvmViewerInteractionPatch\.js\?v=20260620-rvm-esc-hide-selection-1/, 'Renderer must load the Esc/hide toolbar/canvas selection patch.');
  assert.match(rendererSource, /RvmSelectionTreeSyncBridge\.js\?v=20260620-rvm-large-box-support-sync-1/, 'Renderer must load canvas-tree sync bridge.');
  assert.match(rendererSource, /RvmVisibilityToolbarBridge\.js\?v=20260620-rvm-esc-hide-selection-1/, 'Renderer must inject Hide/Show toolbar controls.');
  assert.match(rendererSource, /BrowserRvmCppMat3x4WorkerPatch\.js\?v=20260620-rvm-scale-leak-1/, 'Renderer must install the scale-leak worker patch.');
  assert.match(rendererSource, /RvmSupportSummaryBridge\.js\?v=20260620-rvm-support-symbol-mode-1/, 'Renderer must install support symbol mode bridge.');
  assert.match(rendererSource, /RvmSupportAssemblyBridge\.js\?v=20260620-rvm-support-assembly-dish-1/, 'Renderer must load support assembly bridge.');
  assert.match(rendererSource, /BrowserRvmDishTessellationRuntimePatch\.js\?v=20260620-rvm-support-assembly-dish-1/, 'Renderer must install dish tessellation patch.');
  assert.match(rendererSource, /viewer3d-rvm-tab\.js\?v=20260620-rvm-support-assembly-dish-1/, 'Renderer must load the support assembly dish tab cache key.');
  assert.match(hierarchySelectionBridgeSource, /Fit Selection[\s\S]*hide-selection[\s\S]*show-hidden/,'Hierarchy selection bridge must expose Fit Selection, Hide, and Show Hidden.');
  assert.match(interactionPatchSource, /keydown[\s\S]*Escape[\s\S]*handleEscape/, 'Toolbar patch must implement robust Esc behavior.');
  assert.match(interactionPatchSource, /dispatchAction[\s\S]*VIEW_HIDE_SELECTION[\s\S]*VIEW_SHOW_HIDDEN/, 'Toolbar patch must implement Hide and Show Hidden actions.');
  assert.match(interactionPatchSource, /installRvmCanvasSelectionBridge[\s\S]*raycaster\.intersectObject/, 'Canvas patch must raycast rendered geometry.');
  assert.match(interactionPatchSource, /fitCurrentSelection[\s\S]*selectedMeshes/, 'Fit Selection must use actual selected meshes.');
  assert.match(visibilityToolbarSource, /VIEW_HIDE_SELECTION[\s\S]*VIEW_SHOW_HIDDEN[\s\S]*NAV_SELECT/, 'Visibility toolbar bridge must inject Hide, Show and Select controls.');
  assert.match(selectionTreeSyncSource, /installRvmSelectionTreeSyncBridge[\s\S]*is-canvas-selected[\s\S]*scrollIntoView/, 'Selection tree sync must highlight and scroll tree rows.');
  assert.match(supportSummarySource, /rvm-support-symbol-mode\/v1[\s\S]*Raw[\s\S]*Symbol[\s\S]*Both/, 'Support summary must expose Raw/Symbol/Both support modes.');
  assert.match(supportSummarySource, /SUPPORT_SYMBOL_ROOT[\s\S]*buildSupportSymbolForObject/, 'Support summary must render support glyphs.');
  assert.match(supportSummarySource, /supportByGeometryCount[\s\S]*supportSymbolRenderedCount[\s\S]*supportRawBoxSuppressedCount/, 'Support summary must expose support-symbol diagnostics.');
  assert.match(supportSummarySource, /geometry-vertical-slender[\s\S]*geometry-plate-like/, 'Support summary must detect support-like geometry by shape.');
  assert.match(supportAssemblySource, /rvm-support-assembly\/v1[\s\S]*supportAssemblyCount[\s\S]*supportContactPointResolvedCount/, 'Support assembly bridge must expose assembly/contact diagnostics.');
  assert.match(supportAssemblySource, /groupSupportCandidates[\s\S]*supportGroupedPrimitiveCount[\s\S]*supportUngroupedPrimitiveCount/, 'Support assembly bridge must group support primitives.');
  assert.match(supportAssemblySource, /SUPPORT_ASSEMBLY_ROOT[\s\S]*makeAssemblyMarker/, 'Support assembly bridge must render contact markers.');
  assert.match(supportAssemblySource, /selectAssembly[\s\S]*setSelectionFromObjects/, 'Support assembly rows must select/focus grouped primitives.');
  assert.match(nativeTessellationSource, /browser-rvm-native-tessellation\/v2-diagnostics-toggle/, 'Native tessellation patch must expose diagnostics-toggle schema.');
  assert.match(dishTessellationSource, /browser-rvm-dish-tessellation\/v1-cpp-mat3x4/, 'Dish tessellation patch must expose schema.');
  assert.match(dishTessellationSource, /ellipticalDishGeometry[\s\S]*sphericalDishGeometry/, 'Dish tessellation patch must support PRIM 5 and PRIM 6.');
  assert.match(dishTessellationSource, /matrix4FromCppMat3x4[\s\S]*native-cpp-dish-tessellated/, 'Dish tessellation patch must apply Mat3x4 and mark render quality.');
  assert.match(nativeDiagnosticsBridgeSource, /Native Tessellation[\s\S]*Native On[\s\S]*Native Off[\s\S]*Re-run/, 'Native diagnostics bridge must expose controls.');

  assert.doesNotMatch(entrypointSource, /RvmBrowserRvmWorkerFirstBridge\.js/, 'The RVM freeze fix must not depend on an optional startup side-effect bridge.');
  assert.match(entrypointSource, /core\/app\.js\?v=20260620-rvm-support-assembly-dish-1/, 'App shell cache key must include the support assembly dish version.');
  assert.match(indexHtml, /main(?:-[A-Za-z0-9_-]+)?\.js\?v=20260620-rvm-support-assembly-dish-1/, 'GitHub Pages entrypoint must bump the app shell cache key.');

  console.log('Browser RVM support assembly dish contract test passed');
}

run();
