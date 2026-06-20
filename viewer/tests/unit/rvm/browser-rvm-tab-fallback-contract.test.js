import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm-viewer/RvmSupportIndexAttributeBridge.js', import.meta.url), 'utf8');
  const tabSource = await readFile(new URL('../../../tabs/viewer3d-rvm-tab.js', import.meta.url), 'utf8');

  assert.match(
    bridgeSource,
    /import\s+\{\s*isLikelyRvmFileName\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmParser\.js['"]/,
    'RVM tab bridge must import filename detection from the browser parser fallback.'
  );
  assert.match(
    bridgeSource,
    /import\s+\{\s*parseRvmArrayBuffer\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmHierarchyParser\.js['"]/,
    'RVM tab bridge must use the grouped browser hierarchy parser, not the older flat parser output.'
  );
  assert.match(
    bridgeSource,
    /proto\.text\s*=\s*async\s+function\s+patchedRvmFileText/,
    'RVM tab bridge must intercept .rvm/.rev file reads before JSON.parse sees raw binary.'
  );
  assert.match(
    bridgeSource,
    /isLikelyRvmFileName\(this\?\.name\)/,
    'RVM file interception must be filename-scoped to .rvm/.rev.'
  );
  assert.match(
    bridgeSource,
    /const\s+attText\s*=\s*await\s+readCachedAttSidecarText\(this\.name\)/,
    'RVM file interception must pass a same-basename ATT sidecar when the user selects one.'
  );
  assert.match(
    bridgeSource,
    /parseRvmArrayBuffer\(arrayBuffer,\s*\{\s*fileName:\s*this\.name,\s*attText\s*\}\)/,
    'RVM files must be parsed from ArrayBuffer with optional ATT sidecar text, not text-decoded binary.'
  );
  assert.match(
    bridgeSource,
    /input\.setAttribute\('accept',\s*'\.json,\.uxml,\.uxml\.json,\.rvm,\.rev,\.att'\)/,
    'RVM tab bridge must keep a defensive input accept patch for stale shells.'
  );
  assert.match(
    bridgeSource,
    /input\.setAttribute\('multiple',\s*'multiple'\)/,
    'RVM tab bridge must allow selecting RVM and ATT together even for stale shells.'
  );
  assert.match(
    bridgeSource,
    /cacheRvmAttSidecars\(input\.files\)/,
    'RVM tab change handling must cache ATT sidecars before RVM parsing reads the file.'
  );

  assert.match(
    bridgeSource,
    /const\s+RVM_BROWSER_PARSE_DIAGNOSTICS\s*=\s*Symbol\.for\('pcf-glb-rvm-browser-parse-diagnostics-v1'\)/,
    'Browser RVM parser diagnostics must be stored behind a stable symbol.'
  );
  assert.match(
    bridgeSource,
    /function\s+setLastBrowserRvmDiagnostics\(/,
    'Browser RVM parser diagnostics must be captured after parse.'
  );
  assert.match(
    bridgeSource,
    /new\s+CustomEvent\('rvm-browser-parse-diagnostics'/,
    'Browser RVM parser diagnostics must be emitted as a DOM event for UI refresh.'
  );
  assert.match(
    bridgeSource,
    /id\s*=\s*'rvm-browser-parse-diagnostics'/,
    'RVM tab must receive a Browser RVM Parse diagnostics panel.'
  );
  assert.match(
    bridgeSource,
    /Binary PRIM[\s\S]*binaryPrimitiveRecordCount/,
    'Browser RVM diagnostics panel must expose decoded binary PRIM counts.'
  );
  assert.match(
    bridgeSource,
    /Hierarchy groups[\s\S]*hierarchyGroupCount/,
    'Browser RVM diagnostics panel must expose owner hierarchy group counts.'
  );

  assert.match(
    tabSource,
    /title="Load RVM \/ REV \/ ATT \/ JSON \/ UXML"/,
    'RVM tab static source must advertise RVM / REV / ATT / JSON / UXML without relying on runtime DOM patching.'
  );
  assert.match(
    tabSource,
    /id="rvm-file-input"[^>]+accept="\.json,\.uxml,\.uxml\.json,\.rvm,\.rev,\.att"[^>]+multiple/,
    'RVM tab static file input must accept .rvm, .rev, and .att sidecars directly in the template.'
  );
  assert.match(
    tabSource,
    /data-browser-rvm-fallback="true"[^>]+data-browser-rvm-att-sidecar="true"/,
    'RVM tab static input must expose browser fallback and ATT sidecar markers.'
  );
  assert.match(
    tabSource,
    /Load RVM \/ REV \/ ATT \/ JSON \/ UXML to view hierarchy\./,
    'RVM hierarchy empty-state text must be correct in static source.'
  );
  assert.match(
    tabSource,
    /Load RVM \/ REV \/ ATT \/ JSON \/ UXML to begin\./,
    'RVM viewport placeholder text must be correct in static source.'
  );
  assert.doesNotMatch(
    tabSource,
    /Load JSON\/UXML to view hierarchy|Load RVM JSON \/ UXML to begin/,
    'RVM tab static source must not regress to old JSON/UXML-only wording.'
  );

  assert.match(
    bridgeSource,
    /installBrowserRvmTabFileFallback\(\);[\s\S]*installBrowserRvmTabDomPatch\(\);[\s\S]*installRvmSupportIndexAttributeBridge\(\);/,
    'Browser RVM fallback installers must run when the side-effect bridge is imported by the RVM tab.'
  );

  console.log('Browser RVM tab fallback contract test passed');
}

run();
