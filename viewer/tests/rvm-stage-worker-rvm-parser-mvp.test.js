import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRvmParserMvpBinaryV1 } from '../stage/samples/sample-rvm-parser-mvp-binary-v1.js';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

test('valid synthetic parser fixture through worker returns ok true', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserMvpBinaryV1());
  assert.equal(result.ok, true, result.error?.message || '');
  assert.ok(result.stageModel);
  assert.ok(result.renderPlan);
  assert.ok(result.manifest);
  assert.ok(result.rvmDiagnosticsReport);
  assert.ok(result.rvmParserReport);
});

test('worker emits stage and package ready for valid parser fixture', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserMvpBinaryV1());
  const types = result.messages.map((message) => message.type);
  assert.ok(types.includes('STAGE_WORKER_STAGE_READY'));
  assert.ok(types.includes('STAGE_WORKER_PACKAGE_READY'));
});

test('worker stageModel validates for valid parser fixture', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserMvpBinaryV1());
  const validation = validateRvmStageModel(result.stageModel);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('invalid preflight still returns STAGE_RVM_PREFLIGHT_FAILED', async () => {
  const job = { ...createSampleRvmParserMvpBinaryV1(), fileHash: '', arrayBuffer: new ArrayBuffer(0), fileSize: 0 };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PREFLIGHT_FAILED');
});

test('nonmatching binary returns not implemented without ready messages', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), nonmatchingJob());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PARSING_NOT_IMPLEMENTED');
  assertNoReady(result);
});

test('nonmatching binary error context includes diagnostics and parser reports', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), nonmatchingJob());
  assert.ok(result.error.context.rvmDiagnosticsReport);
  assert.ok(result.error.context.rvmParserReport);
});

function nonmatchingJob() {
  return {
    jobId: 'job-nonmatching-rvm-parser-mvp',
    kind: 'rvm-binary',
    fileName: 'nonmatching-rvm-parser-mvp.rvm',
    fileHash: 'sha256-nonmatching-rvm-parser-mvp',
    fileSize: 8,
    arrayBuffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
  };
}

function assertNoReady(result) {
  const types = result.messages.map((message) => message.type);
  assert.equal(types.includes('STAGE_WORKER_STAGE_READY'), false);
  assert.equal(types.includes('STAGE_WORKER_PACKAGE_READY'), false);
}
