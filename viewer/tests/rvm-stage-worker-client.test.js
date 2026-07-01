import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStageWorkerClient,
  disposeStageWorkerClient,
  runStageWorkerClientJob,
} from '../stage/worker/StageWorkerClient.js';
import { createRvmBinaryWorkerJob, createStageJsonWorkerJob } from '../stage/worker/StageWorkerJob.js';
import { validateStageWorkerOutput } from '../stage/contracts/RvmStageModelContract.js';
import {
  createSampleStageWorkerClientJobV1,
  createSampleStageWorkerClientRuntime,
} from '../stage/samples/sample-stage-worker-client-v1.js';

test('direct runtime mode accepts sample stage-json job', async () => {
  const client = createStageWorkerClient({ runtime: createSampleStageWorkerClientRuntime() });
  const result = await runStageWorkerClientJob(client, createSampleStageWorkerClientJobV1());
  assert.equal(result.ok, true, result.error?.message || 'expected success');
});

test('direct runtime result passes worker acceptance', async () => {
  const client = createStageWorkerClient({ runtime: createSampleStageWorkerClientRuntime() });
  const result = await runStageWorkerClientJob(client, createSampleStageWorkerClientJobV1());
  const acceptance = validateStageWorkerOutput(result);
  assert.equal(acceptance.valid, true, acceptance.errors.join('\n'));
});

test('client collects READY/START/PROGRESS/STAGE_READY/PACKAGE_READY messages', async () => {
  const client = createStageWorkerClient({ runtime: createSampleStageWorkerClientRuntime() });
  await runStageWorkerClientJob(client, createSampleStageWorkerClientJobV1());
  assertHasTypes(client.messages, [
    'STAGE_WORKER_READY',
    'STAGE_WORKER_START',
    'STAGE_WORKER_PROGRESS',
    'STAGE_WORKER_STAGE_READY',
    'STAGE_WORKER_PACKAGE_READY',
  ]);
});

test('rvm-binary job returns explicit not-implemented failure', async () => {
  const client = createStageWorkerClient({ runtime: createSampleStageWorkerClientRuntime() });
  const job = createRvmBinaryWorkerJob({ fileName: 'sample.rvm', fileHash: 'sha256-rvm-client', arrayBuffer: new ArrayBuffer(8) });
  const result = await runStageWorkerClientJob(client, job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PARSING_NOT_IMPLEMENTED');
});

test('invalid job fails before runtime', async () => {
  const client = createStageWorkerClient({ runtime: createSampleStageWorkerClientRuntime() });
  const job = createStageJsonWorkerJob({ text: '{}' });
  const result = await runStageWorkerClientJob(client, job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_WORKER_JOB_INVALID');
  assert.equal(client.messages.length, 0);
});

test('dispose is idempotent', () => {
  const client = createStageWorkerClient({ runtime: createSampleStageWorkerClientRuntime() });
  disposeStageWorkerClient(client);
  disposeStageWorkerClient(client);
  assert.equal(client.disposed, true);
});

test('timeout returns controlled failure in direct runtime mode', async () => {
  const client = createStageWorkerClient({
    runtime: createSampleStageWorkerClientRuntime(),
    runJob: () => new Promise(() => {}),
    timeoutMs: 1,
  });
  const result = await runStageWorkerClientJob(client, createSampleStageWorkerClientJobV1());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_WORKER_CLIENT_TIMEOUT');
});

function assertHasTypes(messages, types) {
  const actual = new Set(messages.map((message) => message.type));
  for (const type of types) assert.ok(actual.has(type), `missing ${type}`);
}
