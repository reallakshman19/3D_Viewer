export const STAGE_WORKER_JOB_SCHEMA = 'StageWorkerJob.v1';

export function createStageJsonWorkerJob({ text, fileName = '', fileSize = 0, fileHash = '', jobId = '' } = {}) {
  return {
    schema: STAGE_WORKER_JOB_SCHEMA,
    jobId: jobId || createStageWorkerJobId(),
    kind: 'stage-json',
    text: String(text || ''),
    fileName,
    fileSize: Number(fileSize) || 0,
    fileHash,
    createdAt: new Date().toISOString(),
  };
}

export function createStageWorkerJobId(prefix = 'stage-job') {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}-${random}`;
}
