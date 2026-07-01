import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRvmParserCode4BinaryV1 } from '../stage/samples/sample-rvm-parser-code4-binary-v1.js';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

const NOT_IMPLEMENTED = 'STAGE_RVM_PARSING_NOT_IMPLEMENTED';
const PREFLIGHT_FAILED = 'STAGE_RVM_PREFLIGHT_FAILED';

test('code 4 synthetic fixture through worker returns ok true', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserCode4BinaryV1());
  assert.equal(result.ok, true, result.error?.message || '');
  assert.ok(result.stageModel);
  assert.ok(result.renderPlan);
  assert.ok(result.manifest);
  assert.ok(result.rvmDiagnosticsReport);
  assert.ok(result.rvmParserReport);
});

test('worker emits stage and package ready for code 4 fixture', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserCode4BinaryV1());
  const types = result.messages.map((message) => message.type);
  assert.ok(types.includes('STAGE_WORKER_STAGE_READY'));
  assert.ok(types.includes('STAGE_WORKER_PACKAGE_READY'));
});

test('worker stage model and render plan contain supported ELBOW handoff', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserCode4BinaryV1());
  const modelValidation = validateRvmStageModel(result.stageModel);
  assert.equal(modelValidation.valid, true, modelValidation.errors.join('\n'));
  const elbow = result.stageModel.primitives.find((primitive) => primitive.renderKind === 'ELBOW');
  assert.ok(elbow);
  const entry = result.renderPlan.entries.find((item) => item.renderKind === 'ELBOW');
  assert.ok(entry);
  assert.equal(entry.supportLevel, 'supported');
  assert.equal(entry.recipeSource, 'native');
  assert.ok(entry.nativeGeometryRef);
});

test('unsupported malformed binary still returns not implemented', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), nonmatchingJob());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, NOT_IMPLEMENTED);
  assertNoReady(result);
});

test('invalid preflight still returns preflight failed', async () => {
  const job = { ...createSampleRvmParserCode4BinaryV1(), fileHash: '', fileSize: 0, arrayBuffer: new ArrayBuffer(0) };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PREFLIGHT_FAILED);
});

function nonmatchingJob() {
  return { jobId: 'job-nonmatching-rvm-parser-code4', kind: 'rvm-binary', fileName: 'nonmatching-rvm-parser-code4.rvm', fileHash: 'sha256-nonmatching-rvm-parser-code4', fileSize: 8, arrayBuffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer };
}

function assertNoReady(result) {
  const types = result.messages.map((message) => message.type);
  assert.equal(types.includes('STAGE_WORKER_STAGE_READY'), false);
  assert.equal(types.includes('STAGE_WORKER_PACKAGE_READY'), false);
}
