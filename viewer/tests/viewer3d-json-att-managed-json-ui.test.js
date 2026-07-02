import assert from 'node:assert/strict';
import test from 'node:test';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { createStageJsonWorkerJob } from '../stage/worker/StageWorkerJob.js';

test('ATT-managed hierarchy JSON is rejected with user-facing StageModel guidance', async () => {
  const text = JSON.stringify([{ name: '/LINE/B1', type: 'BRANCH', children: [] }]);
  const job = createStageJsonWorkerJob({ text, fileName: 'RMSS_ATTRIBUTE_managed_stage.json', fileSize: text.length, fileHash: 'sha256-att-managed-json' });
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_JSON_ATT_MANAGED_HIERARCHY_NOT_STAGE_MODEL');
  assert.match(result.error.message, /ATT-managed hierarchy export/);
  assert.match(result.error.message, /not RvmStageModel\.v1/);
  assert.equal(result.stageModel, undefined);
});
