import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const tabBridgeSource = await readFile(new URL('../../../rvm-viewer/RvmBrowserRvmWorkerFirstBridge.js', import.meta.url), 'utf8');
  const mainSource = await readFile(new URL('../../../main.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(
    bridgeSource,
    /buildResponsiveBrowserRvmRenderSceneFromHierarchy/,
    'Normal browser RVM load must not collect render instructions from a full hierarchy on the main thread.'
  );

  assert.match(
    bridgeSource,
    /new\s+Worker\(workerUrl,\s*\{\s*type:\s*['"]module['"]\s*\}\)/,
    'Browser RVM load must use a module Web Worker before parse/render-instruction work.'
  );

  assert.match(
    bridgeSource,
    /browser-rvm-worker\.js\?v=20260620-rvm-worker-first-1/,
    'Browser RVM worker URL must be cache-busted for GitHub Pages deployment.'
  );

  assert.match(
    bridgeSource,
    /worker\.postMessage\(\{\s*id,\s*arrayBuffer,\s*options:\s*stripWorkerOptions\(options\)\s*\},\s*\[arrayBuffer\]\)/,
    'Browser RVM load must transfer the ArrayBuffer to the worker instead of scanning it on the main thread.'
  );

  assert.match(
    bridgeSource,
    /const\s+MAIN_THREAD_FALLBACK_MAX_BYTES\s*=\s*1024\s*\*\s*1024/,
    'Main-thread parser fallback must be hard-limited to small files only.'
  );

  assert.match(
    bridgeSource,
    /allowMainThreadParserFallback:\s*options\.allowMainThreadParserFallback\s*===\s*true/,
    'Main-thread parser fallback must be opt-in, not automatic for real RVM files.'
  );

  assert.match(
    bridgeSource,
    /viewer\.setModel\(activeScene,\s*parsed\.upAxis\s*\|\|\s*['"]Z['"]\)/,
    'Browser RVM load must commit an empty progressive scene before creating all meshes.'
  );

  assert.match(
    bridgeSource,
    /buildProgressiveBrowserRvmRenderSceneFromInstructions\(instructionSet,[\s\S]*targetScene:\s*activeScene/,
    'Browser RVM load must progressively instantiate worker render instructions into the mounted scene.'
  );

  assert.match(
    bridgeSource,
    /elapsed\s*>=\s*renderOptions\.timeSliceMs[\s\S]*await\s+yieldToBrowser\(\{\s*signal:\s*options\.signal\s*\}\)/,
    'Progressive scene creation must be governed by a time budget and yield between batches.'
  );

  assert.match(
    bridgeSource,
    /createEventLoopWatchdog\(\{\s*thresholdMs:\s*100,\s*intervalMs:\s*50\s*\}\)/,
    'Browser RVM load must install a main-thread responsiveness watchdog.'
  );

  assert.match(
    bridgeSource,
    /browserRvmStageTimingsMs:\s*perf\.measures[\s\S]*browserRvmMaxEventLoopStallMs:/,
    'Browser RVM diagnostics must expose stage timings and max event-loop stall.'
  );

  assert.match(
    bridgeSource,
    /browserRvmWorkerEnabled:[\s\S]*browserRvmCompactInstructionTransfer:[\s\S]*browserRvmProgressiveRenderEnabled:/,
    'Browser RVM diagnostics must expose worker, compact transfer, and progressive render flags.'
  );

  assert.match(
    workerSource,
    /import\s+\{\s*enrichBrowserRvmHierarchyWithAtt\s*\}/,
    'RVM worker must perform ATT enrichment off the main thread.'
  );

  assert.match(
    workerSource,
    /import\s+\{\s*collectBrowserRvmRenderInstructions\s*\}/,
    'RVM worker must generate render instructions off the main thread.'
  );

  assert.match(
    workerSource,
    /instructionSet:\s*compactInstructionSet[\s\S]*manifestNodes,/,
    'RVM worker must return compact render instructions and capped manifest nodes.'
  );

  assert.match(
    workerSource,
    /browserRvmHierarchyReturnedToMainThread:\s*false/,
    'RVM worker must not return the huge nested hierarchy object on the normal path.'
  );

  assert.doesNotMatch(
    workerSource,
    /hierarchy:\s*attEnrichment\.hierarchy/,
    'RVM worker complete message must not transfer the enriched hierarchy back to the main thread.'
  );

  assert.match(
    tabBridgeSource,
    /RvmBrowserRvmWorkerFirstBridge/,
    'Worker-first tab bridge source must be present.'
  );

  assert.match(
    tabBridgeSource,
    /event\?\.stopImmediatePropagation\?\.\(\)/,
    'Worker-first bridge must stop the stale JSON\/text change handler for .rvm and .rev files.'
  );

  assert.match(
    tabBridgeSource,
    /new\s+AbortController\(\)/,
    'Worker-first bridge must cancel previous RVM load jobs when a new file is selected.'
  );

  assert.match(
    tabBridgeSource,
    /sidecarKey\(file\.name\)\s*===\s*rvmKey/,
    'Worker-first bridge must pair ATT sidecars by same basename.'
  );

  assert.match(
    tabBridgeSource,
    /const\s+MAX_TREE_ROWS\s*=\s*320/,
    'Worker-first bridge must cap/virtualize initial tree rendering instead of emitting the full hierarchy DOM.'
  );

  assert.match(
    tabBridgeSource,
    /Max event-loop stall[\s\S]*browserRvmMaxEventLoopStallMs/,
    'Diagnostics panel must display max event-loop stall.'
  );

  assert.match(
    tabBridgeSource,
    /Worker enabled[\s\S]*browserRvmWorkerEnabled[\s\S]*Progressive render[\s\S]*browserRvmProgressiveRenderEnabled/,
    'Diagnostics panel must display worker and progressive-render status.'
  );

  assert.match(
    mainSource,
    /RvmBrowserRvmWorkerFirstBridge\.js\?v=20260620-rvm-worker-first-1/,
    'Worker-first RVM bridge must be installed as an early guarded startup side effect.'
  );

  assert.match(
    indexHtml,
    /main\.js\?v=20260620-rvm-worker-first-1/,
    'GitHub Pages entrypoint must bump the main.js cache key for the worker-first fix.'
  );

  console.log('Browser RVM worker-first responsiveness contract test passed');
}

run();
