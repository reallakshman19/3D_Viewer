import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/stage/ui/RvmUiHandoff.js',
  'viewer/stage/ui/JsonViewerShell.js',
  'viewer/tabs/viewer3d-json-tab-renderer.js',
  'viewer/tests/viewer3d-json-rvm-ui-handoff.test.js',
  'viewer/tests/viewer3d-json-rvm-ui-source-guards.test.js',
];
const guarded = [
  'viewer/stage/ui/RvmUiHandoff.js',
  'viewer/stage/ui/JsonViewerShell.js',
  'viewer/tabs/viewer3d-json-tab-renderer.js',
];
const banned = [
  'viewer/stage/parser/',
  'indexedDB',
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
  'Native RVM support complete',
  'Loaded RVM',
  'Navis parity',
  'Review parity',
  'code 11 complete',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const handoff = read('viewer/stage/ui/RvmUiHandoff.js');
const shell = read('viewer/stage/ui/JsonViewerShell.js');
const renderer = read('viewer/tabs/viewer3d-json-tab-renderer.js');

assert.ok(handoff.includes('RVM parsed into staged model'));
assert.ok(handoff.includes('RVM diagnostics only'));
assert.ok(handoff.includes('RVM preflight failed'));
assert.ok(handoff.includes('MVP parser slice'));
assert.ok(shell.includes("'Open RVM'"));
assert.equal(shell.includes('Open RVM (dry-run)'), false);
assert.ok(renderer.includes('classifyRvmWorkerResult'));
assert.ok(renderer.includes("'rvm-binary'"));
assert.equal(handoff.includes("from '../parser"), false);
assert.equal(handoff.includes("from '../render"), false);
assert.equal(handoff.includes("from 'three'"), false);

for (const token of banned) {
  for (const file of guarded) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer RVM UI source guards passed');
