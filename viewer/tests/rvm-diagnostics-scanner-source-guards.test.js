import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/stage/parser/RvmDiagnosticsScanner.js',
  'viewer/stage/worker/StageWorkerRuntime.js',
  'viewer/stage/samples/sample-rvm-diagnostics-binary-v1.js',
  'viewer/tests/rvm-diagnostics-scanner.test.js',
  'viewer/tests/rvm-diagnostics-scanner-evidence.test.js',
  'viewer/tests/rvm-stage-worker-rvm-diagnostics.test.js',
  'viewer/tests/rvm-diagnostics-scanner-source-guards.test.js',
];
const guarded = [
  'viewer/stage/parser/RvmDiagnosticsScanner.js',
  'viewer/stage/worker/StageWorkerRuntime.js',
  'viewer/stage/samples/sample-rvm-diagnostics-binary-v1.js',
];
const banned = [
  'viewer/tabs/',
  'viewer/stage/render/',
  'viewer/stage/ui/',
  'three',
  'indexedDB',
  'createEmptyRvmStageModel',
  'buildStageRenderPlan',
  'createGeometryChunk',
  'geometryChunks',
  'parseRvm',
  'readRvm',
  'RvmParser',
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const scanner = read('viewer/stage/parser/RvmDiagnosticsScanner.js');
const runtime = read('viewer/stage/worker/StageWorkerRuntime.js');

assert.match(scanner, /DataView/);
assert.match(scanner, /scanRvmBinaryDiagnostics/);
assert.match(scanner, /RvmDiagnosticsReport\.v1/);
assert.match(scanner, /candidateOnly/);
assert.match(scanner, /confirmedRecords/);
assert.match(scanner, /unmatchedCntb/);
assert.match(scanner, /suspiciousNativeCodes/);
assert.match(runtime, /scanRvmBinaryDiagnostics/);
assert.match(runtime, /rvmDiagnosticsReport/);
assert.match(runtime, /rvmDiagnosticsSummary/);
assert.match(runtime, /STAGE_RVM_PARSING_NOT_IMPLEMENTED/);
assert.doesNotMatch(scanner, /RvmStageModel\.v1/);
assert.doesNotMatch(scanner, /renderPlan/);
assert.doesNotMatch(scanner, /stageModel/);

for (const token of banned) {
  for (const file of guarded) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('RVM diagnostics scanner source guards passed');
