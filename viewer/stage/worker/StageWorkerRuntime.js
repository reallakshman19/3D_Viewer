import {
  createStagePackageManifest,
  createStageWorkerError,
  createStageWorkerMessage,
  createStageWorkerProgress,
  getStageRenderRecipeForPrimitive,
  normalizeRenderQuality,
  validateRvmStageModel,
  validateStageWorkerOutput,
} from '../contracts/RvmStageModelContract.js';
import { scanRvmBinaryDiagnostics } from '../parser/RvmDiagnosticsScanner.js';
import { createRvmBinaryPreflightReport } from './StageRvmBinaryPreflight.js';

export function createStageWorkerRuntime(options = {}) {
  return {
    initialized: options.initialized !== false,
    onMessage: typeof options.onMessage === 'function' ? options.onMessage : null,
  };
}

export async function runStageWorkerJob(runtime, job) {
  const messages = [];
  if (runtime?.initialized) emit(runtime, messages, createStageWorkerMessage('STAGE_WORKER_READY', { phase: 'idle' }));
  emit(runtime, messages, createStageWorkerMessage('STAGE_WORKER_START', startPayload(job)));
  if (job?.kind === 'stage-json') return runStageJsonJob(runtime, messages, job);
  if (job?.kind === 'rvm-binary') return runRvmBinaryJob(runtime, messages, job);
  return fail(runtime, messages, `Unsupported stage worker job kind: ${job?.kind}`, 'STAGE_WORKER_UNSUPPORTED_JOB_KIND', { jobId: job?.jobId || '', kind: job?.kind || '' });
}

export function createStageWorkerResult(payload) {
  return { ok: true, ...payload };
}

export function createStageWorkerFailure(error, context = {}) {
  return {
    ok: false,
    error: {
      message: error?.message || String(error || 'Stage worker job failed'),
      code: error?.code || 'STAGE_WORKER_JOB_FAILED',
      context,
    },
  };
}

async function runStageJsonJob(runtime, messages, job) {
  emit(runtime, messages, createStageWorkerProgress('reading-file', { loaded: 1, total: 3, percent: 33, message: 'Reading stage JSON job text' }));
  const parsed = parseStageJson(job);
  if (!parsed.ok) return fail(runtime, messages, parsed.error.message, parsed.error.code, parsed.error.context);

  const modelResult = validateRvmStageModel(parsed.stageModel);
  if (!modelResult.valid) return invalidModel(runtime, messages, modelResult.errors, job);

  emit(runtime, messages, createStageWorkerProgress('building-diagnostics', { loaded: 2, total: 3, percent: 67, message: 'Collecting staged diagnostics' }));
  const manifest = createManifestForJob(job, parsed.stageModel);
  const renderPlan = buildDryRunRenderPlan(parsed.stageModel, 'full');
  emit(runtime, messages, createStageWorkerMessage('STAGE_WORKER_STAGE_READY', { schema: parsed.stageModel.schema, primitiveCount: parsed.stageModel.primitives.length }));
  emit(runtime, messages, createStageWorkerMessage('STAGE_WORKER_PACKAGE_READY', { schema: manifest.schema, artifactCount: manifest.artifacts.length }));
  return acceptedOutput(runtime, messages, parsed.stageModel, manifest, renderPlan, job);
}

function runRvmBinaryJob(runtime, messages, job) {
  emit(runtime, messages, createStageWorkerProgress('reading-file', { loaded: 1, total: 4, percent: 25, message: 'Reading RVM binary job envelope' }));
  emit(runtime, messages, createStageWorkerProgress('hashing-source', { loaded: 2, total: 4, percent: 50, message: 'Validating RVM binary source identity' }));
  const preflight = createRvmBinaryPreflightReport(job);
  if (!preflight.valid) return fail(runtime, messages, 'RVM binary preflight failed.', 'STAGE_RVM_PREFLIGHT_FAILED', { preflight });
  emit(runtime, messages, createStageWorkerProgress('parsing-records', { loaded: 3, total: 4, percent: 75, message: 'Scanning conservative RVM record diagnostics' }));
  const rvmDiagnosticsReport = scanRvmBinaryDiagnostics({ ...job, preflightSummary: preflight.summary });
  emit(runtime, messages, createStageWorkerProgress('building-diagnostics', { loaded: 4, total: 4, percent: 100, message: 'Building diagnostics-only RVM report' }));
  return fail(runtime, messages, 'RVM binary parsing is not implemented in the staged worker shell.', 'STAGE_RVM_PARSING_NOT_IMPLEMENTED', {
    preflight: preflight.summary,
    preflightSummary: preflight.summary,
    rvmDiagnosticsReport,
    warnings: [...preflight.warnings, ...rvmDiagnosticsReport.warnings],
  });
}

function acceptedOutput(runtime, messages, stageModel, manifest, renderPlan, job) {
  const output = {
    source: sourceFromJobAndModel(job, stageModel),
    messages,
    manifest,
    stageModel,
    diagnostics: stageModel.diagnostics,
    renderPlan,
  };
  const acceptance = validateStageWorkerOutput(output);
  if (!acceptance.valid) return fail(runtime, messages, 'Stage worker acceptance failed.', 'STAGE_WORKER_ACCEPTANCE_FAILED', { errors: acceptance.errors });
  return createStageWorkerResult({ messages, stageModel, manifest, renderPlan, diagnostics: stageModel.diagnostics, acceptance });
}

function parseStageJson(job) {
  try {
    return { ok: true, stageModel: JSON.parse(String(job?.text || '')) };
  } catch (error) {
    return {
      ok: false,
      error: { message: error?.message || 'Malformed stage JSON.', code: 'STAGE_JSON_PARSE_FAILED', context: { jobId: job?.jobId || '', fileName: job?.fileName || '' } },
    };
  }
}

function invalidModel(runtime, messages, validationErrors, job) {
  return fail(runtime, messages, 'Stage JSON does not validate as RvmStageModel.v1.', 'STAGE_MODEL_VALIDATION_FAILED', { jobId: job?.jobId || '', validationErrors });
}

function fail(runtime, messages, message, code, context) {
  const protocolError = createStageWorkerError({ message, code }, context);
  emit(runtime, messages, protocolError);
  const failure = createStageWorkerFailure({ message, code }, context);
  return { ...failure, messages, validationErrors: context?.validationErrors || context?.errors || [] };
}

function createManifestForJob(job, stageModel) {
  return createStagePackageManifest({
    source: sourceFromJobAndModel(job, stageModel),
    converterVersion: 'stage-worker-shell-dry-run-v1',
    artifacts: [stageModelArtifact()],
    chunks: [],
    diagnostics: { href: 'diagnostics.json', schema: 'RvmStageDiagnostics.v1', required: true },
  });
}

function buildDryRunRenderPlan(model, quality) {
  const normalizedQuality = normalizeRenderQuality(quality);
  const entries = (model.primitives || []).map((primitive, index) => buildRenderEntry(model, primitive, normalizedQuality, index));
  return {
    schema: 'StageRenderPlan.v1',
    source: { schema: model.schema, fileName: model.source?.fileName || '', fileHash: model.source?.fileHash || '', quality: normalizedQuality },
    entries,
    summary: summarizeRenderEntries(entries),
    diagnostics: [],
  };
}

function buildRenderEntry(model, primitive, quality, index) {
  const component = (model.components || []).find((item) => item.id === primitive.componentId);
  const recipe = getStageRenderRecipeForPrimitive(primitive, quality);
  return {
    id: `render-${String(index + 1).padStart(6, '0')}`,
    nodeId: primitive.nodeId || '',
    componentId: primitive.componentId || '',
    primitiveId: primitive.id || '',
    recipeId: recipe?.id || 'render-plan-diagnostic-missing-recipe',
    renderKind: primitive.renderKind || 'UNKNOWN_DIAGNOSTIC',
    semanticType: component?.semanticType || 'UNKNOWN',
    output: recipe?.output || 'bbox',
    diagnosticOnly: Boolean(recipe?.diagnosticOnly || !recipe),
    bboxWorld: primitive.transform?.bboxWorld || primitive.bboxWorld || component?.bboxWorld || null,
  };
}

function summarizeRenderEntries(entries) {
  const summary = { totalEntries: entries.length, byRecipe: {}, byOutput: {}, diagnosticOnly: 0, hidden: 0 };
  for (const entry of entries) summarizeEntry(summary, entry);
  return summary;
}

function summarizeEntry(summary, entry) {
  increment(summary.byRecipe, entry.recipeId || 'unknown');
  increment(summary.byOutput, entry.output || 'unknown');
  if (entry.diagnosticOnly) summary.diagnosticOnly += 1;
  if (entry.output === 'hidden') summary.hidden += 1;
}

function emit(runtime, messages, message) {
  messages.push(message);
  runtime?.onMessage?.(message);
}

function sourceFromJobAndModel(job, stageModel) {
  return {
    fileName: job?.fileName || stageModel.source?.fileName || '',
    fileSize: Number(job?.fileSize ?? stageModel.source?.fileSize) || 0,
    fileHash: stageModel.source?.fileHash || job?.fileHash || '',
    units: stageModel.source?.units || 'm',
    coordinateBasis: stageModel.source?.coordinateBasis || 'rvm-native',
  };
}

function stageModelArtifact() {
  return { id: 'artifact-stage-model', kind: 'stage-model-json', href: 'stage-model.json', schema: 'RvmStageModel.v1', byteLength: 0, required: true };
}

function startPayload(job) {
  return { jobId: job?.jobId || '', kind: job?.kind || '', fileName: job?.fileName || '', fileSize: Number(job?.fileSize) || 0, fileHash: job?.fileHash || '' };
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}
