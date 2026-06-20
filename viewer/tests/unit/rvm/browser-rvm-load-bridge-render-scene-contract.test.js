import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function stripUrlSuffix(value) {
  return String(value || '').split('?')[0].split('#')[0];
}

function activeModuleEntrypoint(indexHtml) {
  const match = String(indexHtml).match(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || '';
}

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const filterSource = await readFile(new URL('../../../rvm/BrowserRvmInstructionFilterV2.js', import.meta.url), 'utf8');
  const transformParserSource = await readFile(new URL('../../../rvm/BrowserRvmTransformParser.js', import.meta.url), 'utf8');
  const transformHierarchySource = await readFile(new URL('../../../rvm/BrowserRvmHierarchyTransformParser.js', import.meta.url), 'utf8');
  const tabSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
  const hierarchySelectionBridgeSource = await readFile(new URL('../../../tabs/RvmHierarchySelectionBridge.js', import.meta.url), 'utf8');
  const progressivePatchSource = await readFile(new URL('../../../rvm-viewer/RvmProgressiveModelRootPatch.js', import.meta.url), 'utf8');
  const progressivePatchV5Source = await readFile(new URL('../../../rvm-viewer/RvmProgressiveModelRootPatchV5.js', import.meta.url), 'utf8');
  const rendererSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const entrypointRef = activeModuleEntrypoint(indexHtml);
  const entrypointSource = await readFile(new URL(`../../../${stripUrlSuffix(entrypointRef).replace(/^\.\//, '')}`, import.meta.url), 'utf8');

  assert.doesNotMatch(bridgeSource, /buildResponsiveBrowserRvmRenderSceneFromHierarchy/, 'RVM load must not build render instructions from a full main-thread hierarchy.');
  assert.match(bridgeSource, /new\s+Worker\(workerUrl,\s*\{\s*type:\s*['"]module['"]\s*\}\)/, 'RVM load must use a module worker.');
  assert.match(bridgeSource, /browser-rvm-worker\.js\?v=20260620-rvm-scale-safe-1/, 'RVM worker URL must be cache-busted for the scale-safe contract.');
  assert.match(bridgeSource, /worker\.postMessage\(\{\s*id,\s*arrayBuffer,\s*options:\s*stripWorkerOptions\(options\)\s*\},\s*\[arrayBuffer\]\)/, 'RVM ArrayBuffer must be transferred to the worker.');
  assert.match(bridgeSource, /MAIN_THREAD_FALLBACK_MAX_BYTES\s*=\s*1024\s*\*\s*1024/, 'Main-thread parser fallback must be hard-limited.');
  assert.match(bridgeSource, /allowMainThreadParserFallback:\s*options\.allowMainThreadParserFallback\s*===\s*true/, 'Main-thread parser fallback must be opt-in.');
  assert.match(bridgeSource, /viewer\.setModel\(activeScene,\s*parsed\.upAxis\s*\|\|\s*['"]Z['"],\s*\{\s*progressive:\s*true,\s*fit:\s*false\s*\}\)/, 'An empty progressive scene must be mounted before mesh creation completes without immediate full fit.');
  assert.match(bridgeSource, /buildProgressiveBrowserRvmRenderSceneFromInstructions\(instructionSet,[\s\S]*targetScene:\s*activeScene/, 'Worker render instructions must be progressively instantiated into the mounted scene.');
  assert.match(bridgeSource, /elapsed\s*>=\s*renderOptions\.timeSliceMs[\s\S]*await\s+yieldToBrowser\(\{\s*signal:\s*options\.signal\s*\}\)/, 'Progressive scene creation must yield by time budget.');
  assert.match(bridgeSource, /createEventLoopWatchdog\(\{\s*thresholdMs:\s*100,\s*intervalMs:\s*50\s*\}\)/, 'RVM load must include a responsiveness watchdog.');
  assert.match(bridgeSource, /browserRvmStageTimingsMs:\s*perf\.measures[\s\S]*browserRvmMaxEventLoopStallMs:/, 'Diagnostics must expose timings and max event-loop stall.');
  assert.match(bridgeSource, /browserRvmWorkerEnabled:[\s\S]*browserRvmCompactInstructionTransfer:[\s\S]*browserRvmProgressiveRenderEnabled:/, 'Diagnostics must expose worker, compact transfer, and progressive flags.');
  assert.match(bridgeSource, /browserRvmScaleSafeContract/, 'Diagnostics must expose the scale-safe contract summary.');

  assert.match(workerSource, /BrowserRvmHierarchyTransformParser\.js\?v=20260620-rvm-scale-safe-1/, 'Worker must use the scale-safe transform hierarchy parser with a cache-busted import.');
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
  assert.match(filterSource, /oversizedNonPipingHidden/, 'Filter diagnostics must expose hidden oversized chunks.');

  assert.match(transformParserSource, /transformPoint\(matrix,\s*origin/, 'Transform parser must apply PRIM matrix to local coordinates.');
  assert.match(transformParserSource, /RVM_LEGACY_UNTRANSFORMED_BBOX/, 'Transform parser must preserve old raw bbox diagnostics for comparison.');
  assert.match(transformParserSource, /PARTIAL_BINARY_PRIM_RECORDS_WORLD_TRANSFORMED/, 'Transform parser must identify world-transformed binary PRIM fidelity.');
  assert.match(transformHierarchySource, /RVM_BROWSER_SCALE_SAFE_CONTRACT/, 'Hierarchy wrapper must repair render contracts after grouping.');
  assert.match(transformHierarchySource, /APOS[\s\S]*LPOS[\s\S]*HBOR/, 'Scale-safe contract must use transformed APOS/LPOS/HBOR instead of bbox-only endpoints.');
  assert.match(transformHierarchySource, /RVM_BROWSER_RENDER_SOURCE:\s*'transform-axis-scale-safe-contract'|transform-axis-scale-safe-contract/, 'Scale-safe contract must mark its render source.');

  assert.match(tabSource, /import\s+\{\s*loadRvmFileInBrowser\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmLoadBridge\.js\?v=20260620-rvm-flat-tree-1['"]/, 'The real tab module must import the flat-tree worker-first RVM loader directly.');
  assert.match(tabSource, /RVM_TAB_JS_VERSION\s*=\s*['"]20260620-rvm-flat-tree-1['"]/, 'The diagnostics version must identify the active flat-tree path.');
  assert.match(tabSource, /buildFlatNodeTree/, 'The RVM tab must define a flat hierarchy renderer.');
  assert.match(tabSource, /flat:\s*true/, 'The RVM load path must render flat hierarchy rows.');
  assert.match(tabSource, /Showing first \$\{limit\} of \$\{list\.length\} hierarchy nodes/, 'The flat tree cap message must report shown rows and total rows.');
  assert.match(tabSource, /import\s+\{\s*isLikelyRvmFileName\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmParser\.js['"]/, 'The real tab must branch selected files by RVM/REV extension.');
  assert.match(tabSource, /data-rvm-direct-worker-load="true"/, 'The static file input must identify the direct RVM worker path.');
  assert.match(tabSource, /const\s+rvmFile\s*=\s*files\.find\(\(file\)\s*=>\s*isLikelyRvmFileName\(file\?\.name\)\)/, 'The change handler must pick real RVM/REV files explicitly.');
  assert.match(tabSource, /await\s+loadDirectBrowserRvm\(\{\s*root,\s*viewer,\s*files,\s*rvmFile,\s*stateBag\s*\}\)/, 'The RVM branch must call the direct worker loader path.');
  assert.match(tabSource, /allowMainThreadParserFallback:\s*false/, 'Large RVM must not fall back to main-thread parsing.');
  assert.match(tabSource, /buildHierarchyFallback:\s*false/, 'Normal RVM load must not build the old hierarchy scene fallback.');
  assert.match(tabSource, /RVM_TREE_RENDER_LIMIT\s*=\s*320/, 'Initial RVM hierarchy tree rendering must be capped.');
  assert.match(tabSource, /readBestAttSidecarText\(files,\s*rvmFile\.name\)/, 'The direct loader must pass same-basename ATT sidecars.');
  assert.doesNotMatch(tabSource, /const\s+bounds\s*=\s*payload\.browserRvmRender\?\.bounds/, 'The tab must not perform a second raw-bounds fit after the worker loader completes.');

  const rvmSelectorIndex = tabSource.indexOf('const rvmFile = files.find');
  const rvmBranchStart = tabSource.indexOf('if (rvmFile)', rvmSelectorIndex);
  const jsonBranchStart = tabSource.indexOf('const jsonFile', rvmBranchStart);
  assert.ok(rvmSelectorIndex > 0 && rvmBranchStart > rvmSelectorIndex && jsonBranchStart > rvmBranchStart, 'The RVM branch must precede the JSON/UXML branch.');
  const rvmBranch = tabSource.slice(rvmBranchStart, jsonBranchStart);
  assert.doesNotMatch(rvmBranch, /loadJsonOrUxmlFile|JSON\.parse|\.text\(\)/, 'The .rvm/.rev branch must not call the JSON/UXML text loader.');

  assert.match(progressivePatchSource, /setProgressiveModelRoot/, 'RvmViewer3D must have a safe progressive mount entry point.');
  assert.match(progressivePatchSource, /originalSetModel/, 'The progressive patch must preserve the legacy JSON/UXML setModel path.');
  assert.match(progressivePatchSource, /browserRvmProgressiveRenderEnabled/, 'Progressive RVM roots must bypass full-scene setModel work.');
  assert.doesNotMatch(progressivePatchSource, /Box3\(\)\.setFromObject\(this\.modelGroup\)[\s\S]*computeBoundingSphere/, 'Progressive mount must not do full bounds and bounding-sphere work synchronously.');
  assert.match(progressivePatchV5Source, /rendered-world-bounds-no-hide/, 'Renderer must load a no-hide rendered-world-bounds fit patch.');
  assert.doesNotMatch(progressivePatchV5Source, /visible\s*=\s*false/, 'No-hide fit patch must not hide meshes during final fit.');
  assert.match(rendererSource, /RvmProgressiveModelRootPatchV5\.js\?v=20260620-rvm-tree-select-nohide-1/, 'Renderer must load the v5 no-hide fit patch.');
  assert.match(rendererSource, /RvmHierarchySelectionBridge\.js\?v=20260620-rvm-tree-select-nohide-1/, 'Renderer must load the hierarchy selection bridge.');
  assert.match(rendererSource, /viewer3d-rvm-tab\.js\?v=20260620-rvm-flat-tree-1/, 'Renderer must load the flat-tree tab cache key.');
  assert.match(hierarchySelectionBridgeSource, /Fit Selection/,'Hierarchy selection bridge must expose Fit Selection.');
  assert.match(hierarchySelectionBridgeSource, /stopImmediatePropagation/, 'Hierarchy selection bridge must bypass the legacy tree click fit path.');

  assert.doesNotMatch(entrypointSource, /RvmBrowserRvmWorkerFirstBridge\.js/, 'The RVM freeze fix must not depend on an optional startup side-effect bridge.');
  assert.match(entrypointSource, /core\/app\.js\?v=20260620-rvm-flat-tree-1/, 'App shell cache key must include the flat-tree version.');
  assert.match(indexHtml, /main(?:-[A-Za-z0-9_-]+)?\.js\?v=20260620-rvm-flat-tree-1/, 'GitHub Pages entrypoint must bump the app shell cache key.');
  assert.match(indexHtml, /viewer3d-rvm-tab\.css\?v=20260620-rvm-direct-tab-1/, 'RVM tab CSS cache key must be bumped.');

  console.log('Browser RVM direct tab flat hierarchy responsiveness contract test passed');
}

run();
