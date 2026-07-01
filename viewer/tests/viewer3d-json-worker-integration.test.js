import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/tabs/viewer3d-json-tab-renderer.js',
  'viewer/stage/worker/StageWorkerJob.js',
  'viewer/stage/worker/StageWorkerClient.js',
  'viewer/stage/worker/StageWorkerRuntime.js',
  'viewer/stage/ui/JsonViewerDiagnosticsPanel.js',
  'viewer/stage/ui/JsonViewerShell.js',
  'viewer/tests/viewer3d-json-worker-integration.test.js',
];
const sourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const banned = [
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
  'parseRvm',
  'RvmParser',
  'readRvm',
  'indexedDB',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const tab = read('viewer/tabs/viewer3d-json-tab-renderer.js');
const job = read('viewer/stage/worker/StageWorkerJob.js');
const client = read('viewer/stage/worker/StageWorkerClient.js');
const runtime = read('viewer/stage/worker/StageWorkerRuntime.js');
const diagnostics = read('viewer/stage/ui/JsonViewerDiagnosticsPanel.js');
const shell = read('viewer/stage/ui/JsonViewerShell.js');
const combined = [tab, job, client, runtime, diagnostics, shell].join('\n');

assert.match(tab, /StageWorkerClient\.js/);
assert.match(tab, /StageWorkerJob\.js/);
assert.match(tab, /createStageJsonWorkerJob/);
assert.match(tab, /createStageWorkerClient/);
assert.match(tab, /activeJobId/);
assert.match(tab, /workerDiagnostics/);
assert.match(tab, /disposeWorkerClient/);
assert.match(tab, /STAGE_WORKER_PROGRESS/);
assert.match(tab, /reading-file/);
assert.match(runtime, /building-diagnostics/);
assert.match(runtime, /STAGE_WORKER_STAGE_READY/);
assert.match(runtime, /STAGE_WORKER_PACKAGE_READY/);
assert.match(diagnostics, /worker:/);
assert.match(tab, /createSampleRvmStageModelV1/);
assert.match(tab, /loadSample/);
assert.match(shell, /openRvmButton\.disabled = true/);
assert.match(client, /terminate/);
assert.match(job, /StageWorkerJob\.v1/);

for (const token of banned) {
  for (const file of sourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer worker integration source tests passed');
