import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const source = await readFile(new URL('../../../rvm/BrowserRvmLoadBridge.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /import\s+\{\s*buildBrowserRvmRenderSceneFromHierarchy\s*\}\s+from\s+['"]\.\/BrowserRvmRenderSceneBuilder\.js['"]/, 
    'Browser RVM direct load bridge must import the render scene builder.'
  );

  assert.match(
    source,
    /const\s+renderResult\s*=\s*buildBrowserRvmRenderSceneFromHierarchy\(parsed\.hierarchy/,
    'Browser RVM direct load must build render objects from the grouped browser hierarchy.'
  );

  assert.match(
    source,
    /const\s+shouldUseRenderScene\s*=\s*Boolean\(renderResult\?\.scene\s*&&\s*renderResult\.diagnostics\?\.renderableCount\s*>\s*0\)/,
    'Browser RVM direct load must use the render scene only when it contains renderable geometry.'
  );

  assert.match(
    source,
    /const\s+diagnostics\s*=\s*publishBrowserRvmLoadDiagnostics\(\{[\s\S]*browserRvmRenderSceneEnabled:\s*shouldUseRenderScene[\s\S]*browserRvmRenderableCount:[\s\S]*browserRvmSkippedCount:/,
    'Browser RVM direct load must publish combined parse/render diagnostics.'
  );

  assert.match(
    source,
    /globalThis\[RVM_BROWSER_PARSE_DIAGNOSTICS\]\s*=\s*payload[\s\S]*__PCF_GLB_RVM_BROWSER_PARSE_DIAGNOSTICS__\s*=\s*payload/,
    'Browser RVM direct load diagnostics must update the same global diagnostics channel used by the tab panel.'
  );

  assert.match(
    source,
    /dispatchEvent\?\.\(new\s+CustomEvent\(['"]rvm-browser-parse-diagnostics['"],\s*\{\s*detail:\s*payload\s*\}\)\)/,
    'Browser RVM direct load must notify the diagnostics panel after render-scene selection.'
  );

  assert.match(
    source,
    /payload\.browserRvmHierarchyScene\s*=\s*hierarchyScene/,
    'Browser RVM direct load must retain the hierarchy-loader scene for diagnostics/fallback.'
  );

  assert.match(
    source,
    /payload\.gltf\.scene\s*=\s*activeScene/,
    'Browser RVM direct load payload must expose the chosen active scene.'
  );

  assert.match(
    source,
    /viewer\.setModel\(activeScene,/,
    'Browser RVM direct load must commit the render-scene adapter output into the viewer when available.'
  );

  assert.match(
    source,
    /browserRvmRenderScene:\s*\{[\s\S]*enabled:\s*shouldUseRenderScene[\s\S]*renderableCount:[\s\S]*skippedCount:/,
    'Browser RVM direct load manifest must report render-scene activation and render diagnostics.'
  );

  console.log('Browser RVM load bridge render-scene contract test passed');
}

run();
