import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStageWorkerRuntime,
  runStageWorkerJob,
} from '../stage/worker/StageWorkerRuntime.js';
import {
  validateStageWorkerMessage,
  validateStageWorkerOutput,
} from '../stage/contracts/RvmStageModelContract.js';
import {
  createSampleRvmBinaryWorkerJobV1,
  createSampleStageJsonWorkerJobV1,
} from '../stage/samples/sample-stage-worker-job-v1.js';

test('sample stage-json job succeeds and passes worker acceptance', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleStageJsonWorkerJobV1());
  assert.equal(result.ok, true, result.error?.message || 'expected success');
  const acceptance = validateStageWorkerOutput(result);
  assert.equal(acceptance.valid, true, acceptance.errors.join('\n'));
});

test('runtime emits READY/START/PROGRESS/STAGE_READY/PACKAGE_READY', async () => {
  const emitted = [];
  const runtime = createStageWorkerRuntime({ onMessage: (message) => emitted.push(message) });
  const result = await runStageWorkerJob(runtime, createSampleStageJsonWorkerJobV1());
  assert.equal(result.ok, true);
  assertHasTypes(emitted, [
    'STAGE_WORKER_READY',
    'STAGE_WORKER_START',
    'STAGE_WORKER_PROGRESS',
    'STAGE_WORKER_STAGE_READY',
    'STAGE_WORKER_PACKAGE_READY',
  ]);
});

test('malformed JSON returns controlled protocol error', async () => {
  const job = { ...createSampleStageJsonWorkerJobV1(), text: '{ not valid json' };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_JSON_PARSE_FAILED');
  assertHasTypes(result.messages, ['STAGE_WORKER_ERROR']);
});

test('invalid stage model returns controlled validation error', async () => {
  const job = { ...createSampleStageJsonWorkerJobV1(), text: JSON.stringify({ schema: 'BadModel.v1' }) };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_MODEL_VALIDATION_FAILED');
  assert.ok(result.validationErrors.length > 0);
});

test('rvm-binary job with valid preflight returns explicit not-implemented failure', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmBinaryWorkerJobV1());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PARSING_NOT_IMPLEMENTED');
  assert.equal(result.stageModel, undefined);
});

test('rvm-binary job with invalid preflight returns preflight failure', async () => {
  const job = { ...createSampleRvmBinaryWorkerJobV1(), fileHash: '', arrayBuffer: new ArrayBuffer(0), fileSize: 0 };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PREFLIGHT_FAILED');
  assert.ok(result.error.context.preflight.errors.length >= 1);
});

test('rvm-binary runtime never emits STAGE_READY or PACKAGE_READY', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmBinaryWorkerJobV1());
  const types = new Set(result.messages.map((message) => message.type));
  assert.equal(types.has('STAGE_WORKER_STAGE_READY'), false);
  assert.equal(types.has('STAGE_WORKER_PACKAGE_READY'), false);
});

test('all emitted stage-json messages validate through worker protocol contract', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleStageJsonWorkerJobV1());
  assertMessagesValid(result.messages);
});

test('all emitted rvm-binary messages validate through worker protocol contract', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmBinaryWorkerJobV1());
  assertMessagesValid(result.messages);
});

function assertMessagesValid(messages) {
  for (const message of messages) {
    const validation = validateStageWorkerMessage(message);
    assert.equal(validation.valid, true, validation.errors.join('\n'));
  }
}

function assertHasTypes(messages, types) {
  const actual = new Set(messages.map((message) => message.type));
  for (const type of types) assert.ok(actual.has(type), `missing ${type}`);
}
