import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function run() {
  const bridgeSource = await readFile(new URL('../../../rvm-viewer/RvmSupportIndexAttributeBridge.js', import.meta.url), 'utf8');

  assert.match(
    bridgeSource,
    /import\s+\{\s*isLikelyRvmFileName,\s*parseRvmArrayBuffer\s*\}\s+from\s+['"]\.\.\/rvm\/BrowserRvmParser\.js['"]/,
    'RVM tab bridge must import the browser parser fallback.'
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
    'RVM tab file input must accept .rvm, .rev, and .att sidecar files.'
  );
  assert.match(
    bridgeSource,
    /input\.setAttribute\('multiple',\s*'multiple'\)/,
    'RVM tab file input must allow selecting RVM and ATT together.'
  );
  assert.match(
    bridgeSource,
    /cacheRvmAttSidecars\(input\.files\)/,
    'RVM tab change handling must cache ATT sidecars before RVM parsing reads the file.'
  );
  assert.match(
    bridgeSource,
    /installBrowserRvmTabFileFallback\(\);[\s\S]*installBrowserRvmTabDomPatch\(\);[\s\S]*installRvmSupportIndexAttributeBridge\(\);/,
    'Browser RVM fallback installers must run when the side-effect bridge is imported by the RVM tab.'
  );

  console.log('Browser RVM tab fallback contract test passed');
}

run();
