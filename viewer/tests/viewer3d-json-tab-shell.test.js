import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/tabs/viewer3d-json-tab.js',
  'viewer/tabs/viewer3d-json-tab-renderer.js',
  'viewer/stage/ui/JsonViewerShell.js',
  'viewer/stage/ui/JsonViewerHierarchyTree.js',
  'viewer/stage/ui/JsonViewerPropertiesPanel.js',
  'viewer/stage/ui/JsonViewerDiagnosticsPanel.js',
  'viewer/stage/ui/RvmUiHandoff.js',
  'viewer/stage/worker/StageWorkerClient.js',
  'viewer/stage/worker/StageWorkerJob.js',
  'viewer/tests/viewer3d-json-tab-shell.test.js',
];
const guardedSourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const blacklist = [
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
  'three',
  'indexedDB',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const tabSource = read('viewer/tabs/viewer3d-json-tab.js');
const rendererSource = read('viewer/tabs/viewer3d-json-tab-renderer.js');
const shellSource = read('viewer/stage/ui/JsonViewerShell.js');
const handoffSource = read('viewer/stage/ui/RvmUiHandoff.js');
const diagnosticsSource = read('viewer/stage/ui/JsonViewerDiagnosticsPanel.js');
const propertiesSource = read('viewer/stage/ui/JsonViewerPropertiesPanel.js');
const workerClientSource = read('viewer/stage/worker/StageWorkerClient.js');
const workerJobSource = read('viewer/stage/worker/StageWorkerJob.js');
const css = read('viewer/tabs/viewer3d-json-tab.css');
const index = read('viewer/index.html');
const combined = [tabSource, rendererSource, shellSource, handoffSource, diagnosticsSource, propertiesSource, workerClientSource, workerJobSource].join('\n');

assert.match(combined, /3D Json Viewer/);
assert.match(combined, /Open Stage JSON/);
assert.match(combined, /Load Sample/);
assert.match(shellSource, /Open RVM/);
assert.doesNotMatch(shellSource, /Open RVM \(dry-run\)/);
assert.match(handoffSource, /RVM parsed into staged model/);
assert.match(handoffSource, /RVM diagnostics only/);
assert.match(handoffSource, /RVM preflight failed/);
assert.match(rendererSource, /validateRvmStageModel/);
assert.match(tabSource + rendererSource, /RvmStageModelContract\.js/);
assert.match(rendererSource, /sample-rvm-stage-model-v1\.js/);
assert.match(rendererSource, /StageWorkerClient\.js/);
assert.match(rendererSource, /StageWorkerJob\.js/);
assert.match(rendererSource, /activeJobId/);
assert.match(diagnosticsSource, /worker:/);
assert.match(shellSource, /rvmFileInput/);
assert.doesNotMatch(shellSource, /openRvmButton\.disabled = true/);
assert.doesNotMatch(shellSource, /Loaded RVM/);
assert.match(index, /3D Json Viewer/);

for (const token of blacklist) {
  for (const file of guardedSourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}
assert.ok(css.split('\n').length < 300, 'CSS line count must stay under 300');

for (const className of ['json-viewer-shell', 'json-viewer-toolbar', 'json-viewer-body', 'json-viewer-canvas-host', 'json-viewer-status-strip']) {
  assert.ok(css.includes(className), `CSS missing ${className}`);
}
for (const token of ['severityCounts', 'fallbackCounts', 'renderKindCounts', 'validation:']) {
  assert.ok(diagnosticsSource.includes(token), `Diagnostics missing ${token}`);
}
for (const token of ['confidence.geometry', 'confidence.semantic', 'primitive count', 'bboxWorld', 'renderPolicy']) {
  assert.ok(propertiesSource.includes(token), `Properties missing ${token}`);
}

console.log('3D Json Viewer tab shell certification tests passed');
