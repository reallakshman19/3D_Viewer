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
  const workerSource = await readFile(new URL('../../../rvm/browser-rvm-worker.js', import.meta.url), 'utf8');
  const transformParserSource = await readFile(new URL('../../../rvm/BrowserRvmTransformParser.js', import.meta.url), 'utf8');
  const rendererSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
  const fallbackBridgeSource = await readFile(new URL('../../../tabs/RvmPrimitiveFallbackBridge.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const entrypointRef = activeModuleEntrypoint(indexHtml);
  const entrypointSource = await readFile(new URL(`../../../${stripUrlSuffix(entrypointRef).replace(/^\.\//, '')}`, import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../../../core/app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(bridgeSource, /buildResponsiveBrowserRvmRenderSceneFromHierarchy/, 'RVM load must not build render instructions from a full main-thread hierarchy.');
  assert.match(bridgeSource, /new\s+Worker\(workerUrl,\s*\{\s*type:\s*['"]module['"]\s*\}\)/, 'RVM load must use a module worker.');
  assert.match(bridgeSource, /worker\.postMessage\(\{\s*id,\s*arrayBuffer,\s*options:\s*stripWorkerOptions\(options\)\s*\},\s*\[arrayBuffer\]\)/, 'RVM ArrayBuffer must be transferred to the worker.');
  assert.match(workerPatchSource, /browser-rvm-worker\.js\?v=20260620-rvm-facetgroup-1/, 'Worker patch must redirect to the facet group worker URL.');
  assert.match(workerSource, /BrowserRvmHierarchyTransformParser\.js\?v=20260620-rvm-facetgroup-1/, 'Worker must use the facet group transform hierarchy parser.');
  assert.match(workerSource, /BrowserRvmInstructionFilterV2\.js\?v=20260620-rvm-large-box-filter-1/, 'Worker must load the large-box filter module.');
  assert.match(workerSource, /browserRvmFacetGroupDecodedCount[\s\S]*browserRvmFacetGroupVertexCount/, 'Worker diagnostics must expose facet group decode counts.');
  assert.match(workerSource, /browserRvmCppMat3x4ScaledRadiusApplied/, 'Worker diagnostics must expose scaled-radius usage.');
  assert.match(transformParserSource, /browser-rvm-transform-parser\/v4-cpp-mat3x4-facetgroup/, 'Transform parser must identify the facet group C++ Mat3x4 schema.');
  assert.match(transformParserSource, /decodeFacetGroupParams[\s\S]*MAX_FACET_GROUP_VERTICES/, 'Transform parser must cap facet group payload decoding.');

  assert.match(rendererSource, /RvmPrimitiveFallbackBridge\.js\?v=20260620-rvm-primitive-fallback-review-1/, 'Renderer must load primitive fallback review bridge.');
  assert.match(rendererSource, /installRvmPrimitiveFallbackBridge\(\)/, 'Renderer must install primitive fallback review bridge.');
  assert.match(rendererSource, /viewer3d-rvm-tab\.js\?v=20260620-rvm-primitive-fallback-review-1/, 'Renderer must load primitive fallback tab cache key.');
  assert.match(fallbackBridgeSource, /rvm-primitive-fallback-review\/v1/, 'Fallback review bridge must expose schema.');
  assert.match(fallbackBridgeSource, /__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__/, 'Fallback review bridge must publish global diagnostics.');
  assert.match(fallbackBridgeSource, /primitiveDecodedKindCounts[\s\S]*primitiveNativeUpgradedKindCounts[\s\S]*primitiveFallbackKindCounts/, 'Fallback review bridge must expose decoded/native/fallback counts.');
  assert.match(fallbackBridgeSource, /fallbackReasonCounts[\s\S]*Re-scan/, 'Fallback review bridge must expose reason counts and rescan UI.');

  assert.match(appSource, /viewer3d-rvm-tab-renderer\.js\?v=20260620-rvm-primitive-fallback-review-1/, 'App must load primitive fallback renderer.');
  assert.match(entrypointSource, /core\/app\.js\?v=20260620-rvm-primitive-fallback-review-1/, 'Entry must load primitive fallback app cache key.');
  assert.match(indexHtml, /main-rvm-review\.js\?v=20260620-rvm-primitive-fallback-review-1/, 'GitHub Pages entrypoint must load primitive review entrypoint.');
  assert.match(indexHtml, /viewer3d-rvm-tab\.css\?v=20260620-rvm-direct-tab-1/, 'RVM tab CSS cache key must remain present.');

  console.log('Browser RVM primitive fallback review contract test passed');
}

run();
