import assert from 'node:assert/strict';
import { createSampleRvmDiagnosticsBinaryV1 } from '../stage/samples/sample-rvm-diagnostics-binary-v1.js';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';

function rvmJob(arrayBuffer, overrides = {}) {
  return {
    schema: 'StageWorkerJob.v1',
    jobId: overrides.jobId || 'job-rvm-diagnostics',
    kind: 'rvm-binary',
    fileName: overrides.fileName || 'sample-diagnostics.rvm',
    fileSize: overrides.fileSize ?? arrayBuffer.byteLength,
    fileHash: overrides.fileHash || 'sha256-rvm-diagnostics-test',
    arrayBuffer,
    byteLength: arrayBuffer.byteLength,
    createdAt: '2026-07-01T00:00:00.000Z',
  };
}

const messages = [];
const runtime = createStageWorkerRuntime({ onMessage: (message) => messages.push(message) });
const result = await runStageWorkerJob(runtime, rvmJob(createSampleRvmDiagnosticsBinaryV1()));
const context = result.error.context;
assert.equal(result.ok, false);
assert.equal(result.error.code, 'STAGE_RVM_PARSING_NOT_IMPLEMENTED');
assert.ok(context.preflightSummary);
assert.ok(context.rvmDiagnosticsReport);
assert.ok(context.rvmDiagnosticsSummary);
assert.equal(context.rvmDiagnosticsReport.schema, 'RvmDiagnosticsReport.v1');
assert.equal(context.rvmDiagnosticsReport.evidence.candidateOnly, true);
assert.equal(context.rvmDiagnosticsReport.evidence.confirmedRecords, 0);
assert.equal(context.rvmDiagnosticsSummary.candidateOnly, true);
assert.equal(context.rvmDiagnosticsSummary.confirmedRecords, 0);
assert.equal(context.diagnosticsAcceptanceSummary.valid, true);
assert.equal(context.rvmDiagnosticsReport.counts.cntb, 1);
assert.equal(context.rvmDiagnosticsReport.counts.prim, 3);
assert.equal(context.rvmDiagnosticsReport.nativeCodeCounts['4'], 1);
assert.ok(result.messages.some((message) => message?.payload?.phase === 'parsing-records'));
assert.ok(result.messages.some((message) => message?.payload?.phase === 'building-diagnostics'));
assert.equal(result.messages.some((message) => message?.type === 'STAGE_WORKER_STAGE_READY'), false);
assert.equal(result.messages.some((message) => message?.type === 'STAGE_WORKER_PACKAGE_READY'), false);
for (const key of ['stageModel', 'renderPlan', 'manifest', 'geometryChunks']) assert.equal(Object.hasOwn(result, key), false);
assert.deepEqual(messages.map((message) => message.type), result.messages.map((message) => message.type));

const invalid = await runStageWorkerJob(createStageWorkerRuntime(), rvmJob(new ArrayBuffer(0), { fileSize: 0, fileHash: 'sha256-empty-rvm' }));
assert.equal(invalid.ok, false);
assert.equal(invalid.error.code, 'STAGE_RVM_PREFLIGHT_FAILED');
assert.ok(invalid.error.context.preflight);
assert.equal(Object.hasOwn(invalid.error.context, 'rvmDiagnosticsReport'), false);
assert.equal(Object.hasOwn(invalid.error.context, 'rvmDiagnosticsSummary'), false);
assert.equal(invalid.messages.some((message) => message?.type === 'STAGE_WORKER_STAGE_READY'), false);
assert.equal(invalid.messages.some((message) => message?.type === 'STAGE_WORKER_PACKAGE_READY'), false);

console.log('RVM worker diagnostics-only failure tests passed');
