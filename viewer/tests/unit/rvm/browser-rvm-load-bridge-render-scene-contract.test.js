import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const tabBridgeSource = await readFile(new URL('../../../rvm-viewer/RvmBrowserRvmWorkerFirstBridge.js', import.meta.url), 'utf8');
  const mainSource = await readFile(new URL('../../../main.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(bridgeSource, /buildResponsiveBrowserRvmRenderSceneFromHierarchy/, 'RVM load must not build render instructions from a full main-thread hierarchy.');
  assert.match(bridgeSource, /new\s+Worker\(workerUrl,\s*\{\s*type:\s*['"]module['"]\s*\}\)/, 'RVM load must use a module worker.');
  assert.match(bridgeSource, /browser-rvm-worker\.js\?v=20260620-rvm-worker-first-1/, 'Worker URL must be cache-busted.');
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

  assert.match(tabBridgeSource, /installBrowserRvmWorkerFirstBridge/, 'Worker-first tab bridge must be installed.');
  assert.match(tabBridgeSource, /event\?\.stopImmediatePropagation\?\.\(\)/, 'Worker-first bridge must stop the stale tab change handler for real RVM files.');
  assert.match(tabBridgeSource, /new\s+AbortController\(\)/, 'Worker-first bridge must cancel previous RVM load jobs.');
  assert.match(tabBridgeSource, /sidecarKey\(file\.name\)\s*===\s*rvmKey/, 'ATT sidecars must be matched by same basename.');
  assert.match(tabBridgeSource, /MAX_TREE_ROWS\s*=\s*320/, 'Initial tree rendering must be capped.');
  assert.match(tabBridgeSource, /Max event-loop stall[\s\S]*browserRvmMaxEventLoopStallMs/, 'Diagnostics panel must show max event-loop stall.');
  assert.match(tabBridgeSource, /Worker enabled[\s\S]*browserRvmWorkerEnabled[\s\S]*Progressive render[\s\S]*browserRvmProgressiveRenderEnabled/, 'Diagnostics panel must show worker and progressive-render status.');

  assert.match(mainSource, /RvmBrowserRvmWorkerFirstBridge\.js\?v=20260620-rvm-worker-first-1/, 'Worker-first bridge must load as an early startup side effect.');
  assert.match(indexHtml, /main\.js\?v=20260620-rvm-worker-first-1/, 'GitHub Pages entrypoint must bump the main.js cache key.');

  console.log('Browser RVM worker-first responsiveness contract test passed');
}

run();
