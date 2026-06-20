import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const tabSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');
  const progressivePatchSource = await readFile(new URL('../../../rvm-viewer/RvmProgressiveModelRootPatch.js', import.meta.url), 'utf8');
  const mainSource = await readFile(new URL('../../../main.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(bridgeSource, /buildResponsiveBrowserRvmRenderSceneFromHierarchy/, 'RVM load must not build render instructions from a full main-thread hierarchy.');
  assert.match(bridgeSource, /new\s+Worker\(workerUrl,\s*\{\s*type:\s*['"]module['"]\s*\}\)/, 'RVM load must use a module worker.');
  assert.match(bridgeSource, /worker\.postMessage\(\{\s*id,\s*arrayBuffer,\s*options:\s*stripWorkerOptions\(options\)\s*\},\s*\[arrayBuffer\]\)/, 'RVM ArrayBuffer must be transferred to the worker.');
  assert.match(bridgeSource, /MAIN_THREAD_FALLBACK_MAX_BYTES\s*=\s*1024\s*\*\s*1024/, 'Main-thread parser fallback must be hard-limited.');
  assert.match(bridgeSource, /allowMainThreadParserFallback:\s*options\.allowMainThreadParserFallback\s*===\s*true/, 'Main-thread parser fallback must be opt-in.');
  assert.match(bridgeSource, /viewer\.setModel\(activeScene,\s*parsed\.upAxis\s*\|\|\s*['"]Z['"]\)/, 'An empty progressive scene must be mounted before mesh creation completes.');
  assert.match(bridgeSource, /buildProgressiveBrowserRvmRenderSceneFromInstructions\(instructionSet,[\s\S]*targetScene:\s*activeScene/, 'Worker render instructions must be progressively instantiated into the mounted scene.');
  assert.match(bridgeSource, /elapsed\s*>=\s*renderOptions\.timeSliceMs[\s\S]*await\s+yieldToBrowser\(\{\s*signal:\s*options\.signal\s*\}\)/, 'Progressive scene creation must yield by time budget.');
  assert.match(bridgeSource, /createEventLoopWatchdog\(\{\s*thresholdMs:\s*100,\s*intervalMs:\s*50\s*\}\)/, 'RVM load must include a responsiveness watchdog.');
  assert.match(bridgeSource, /browserRvmStageTimingsMs:\s*perf\.measures[\s\S]*browserRvmMaxEventLoopStallMs:/, 'Diagnostics must expose timings and max event-loop stall.');
  assert.match(bridgeSource, /browserRvmWorkerEnabled:[\s\S]*browserRvmCompactInstructionTransfer:[\s\S]*browserRvmProgressiveRenderEnabled:/, 'Diagnostics must expose worker, compact transfer, and progressive flags.');

  assert.match(workerSource, /enrichBrowserRvmHierarchyWithAtt/, 'Worker must perform ATT enrichment.');
  assert.match(workerSource, /collectBrowserRvmRenderInstructions/, 'Worker must generate render instructions.');
  assert.match(workerSource, /instructionSet:\s*compactInstructionSet[\s\S]*manifestNodes,/, 'Worker must return compact instructions and capped manifest nodes.');
  assert.match(workerSource, /browserRvmHierarchyReturnedToMainThread:\s*false/, 'Worker must not return the huge hierarchy on the normal path.');
  assert.doesNotMatch(workerSource, /hierarchy:\s*attEnrichment\.hierarchy/, 'Worker complete message must not transfer enriched hierarchy.');

  assert.match(tabSource, /import\s+\{\s*loadRvmFileInBrowser\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmLoadBridge\.js\?v=20260620-rvm-direct-tab-1['"]/, 'The real tab module must import the worker-first RVM loader directly.');
  assert.match(tabSource, /import\s+\{\s*isLikelyRvmFileName\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmParser\.js['"]/, 'The real tab must branch selected files by RVM/REV extension.');
  assert.match(tabSource, /data-rvm-direct-worker-load="true"/, 'The static file input must identify the direct RVM worker path.');
  assert.match(tabSource, /const\s+rvmFile\s*=\s*files\.find\(\(file\)\s*=>\s*isLikelyRvmFileName\(file\?\.name\)\)/, 'The change handler must pick real RVM/REV files explicitly.');
  assert.match(tabSource, /await\s+loadDirectBrowserRvm\(\{\s*root,\s*viewer,\s*files,\s*rvmFile,\s*stateBag\s*\}\)/, 'The RVM branch must call the direct worker loader path.');
  assert.match(tabSource, /allowMainThreadParserFallback:\s*false/, 'Large RVM must not fall back to main-thread parsing.');
  assert.match(tabSource, /buildHierarchyFallback:\s*false/, 'Normal RVM load must not build the old hierarchy scene fallback.');
  assert.match(tabSource, /RVM_TREE_RENDER_LIMIT\s*=\s*320/, 'Initial RVM hierarchy tree rendering must be capped.');
  assert.match(tabSource, /readBestAttSidecarText\(files,\s*rvmFile\.name\)/, 'The direct loader must pass same-basename ATT sidecars.');
  assert.match(tabSource, /Loaded JS version\/hash[\s\S]*Worker loaded[\s\S]*Worker message received[\s\S]*Legacy handler bypassed/, 'Diagnostics panel must prove the live direct worker path.');
  assert.match(tabSource, /First geometry[\s\S]*Scene creation[\s\S]*Objects rendered[\s\S]*Skipped objects[\s\S]*Long tasks >100 ms/, 'Diagnostics panel must expose render progress and responsiveness fields.');

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

  assert.doesNotMatch(mainSource, /RvmBrowserRvmWorkerFirstBridge\.js/, 'The RVM freeze fix must not depend on an optional startup side-effect bridge.');
  assert.match(mainSource, /core\/app\.js\?v=20260620-rvm-direct-tab-1/, 'App shell cache key must be bumped.');
  assert.match(indexHtml, /main\.js\?v=20260620-rvm-direct-tab-1/, 'GitHub Pages entrypoint must bump the main.js cache key.');
  assert.match(indexHtml, /viewer3d-rvm-tab\.css\?v=20260620-rvm-direct-tab-1/, 'RVM tab CSS cache key must be bumped.');

  console.log('Browser RVM direct tab responsiveness contract test passed');
}

run();
