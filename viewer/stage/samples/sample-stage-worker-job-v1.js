import { createSampleRvmStageModelV1 } from './sample-rvm-stage-model-v1.js';

export function createSampleStageJsonWorkerJobV1() {
  const model = createSampleRvmStageModelV1();
  return {
    jobId: 'job-000001',
    kind: 'stage-json',
    fileName: 'sample-rvm-stage-model-v1.json',
    fileSize: JSON.stringify(model).length,
    fileHash: model.source.fileHash,
    text: JSON.stringify(model),
  };
}

export function createSampleRvmBinaryWorkerJobV1() {
  return {
    jobId: 'job-000002',
    kind: 'rvm-binary',
    fileName: 'sample-unparsed.rvm',
    fileSize: 8,
    fileHash: 'sha256-sample-unparsed-rvm',
    arrayBuffer: new ArrayBuffer(8),
  };
}
