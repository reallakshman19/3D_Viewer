import { validateRvmStageModel, normalizeRenderQuality, RVM_STAGE_SCHEMA } from '../stage/contracts/RvmStageModelContract.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { buildStageRenderPlan, STAGE_RENDER_PLAN_SCHEMA, validateStageRenderPlan } from '../stage/render/StageRenderPlan.js';
import { createRvmBinaryWorkerJob, createStageJsonWorkerJob } from '../stage/worker/StageWorkerJob.js';
import { createStageWorkerClient, disposeStageWorkerClient, runStageWorkerClientJob } from '../stage/worker/StageWorkerClient.js';
import {
  createStageThreePreviewRenderer, renderStagePreview, disposeStageThreePreviewRenderer,
  fitStagePreviewToRenderPlan, resetStagePreview, updateStagePreviewSelection, setStagePreviewSelectionCallback,
} from '../stage/render/StageThreePreviewRenderer.js';
import { createJsonViewerShell } from '../stage/ui/JsonViewerShell.js';
import { renderHierarchyTree } from '../stage/ui/JsonViewerHierarchyTree.js';
import { renderProperties } from '../stage/ui/JsonViewerPropertiesPanel.js';
import { renderDiagnostics } from '../stage/ui/JsonViewerDiagnosticsPanel.js';
import { classifyRvmWorkerResult, createRvmUiDiagnostics } from '../stage/ui/RvmUiHandoff.js';

const EMPTY_CANVAS_TEXT = '3D Json Viewer — load RvmStageModel.v1';
const SAMPLE_SOURCE_NAME = 'sample-rvm-stage-model-v1.js';
const WORKER_URL = new URL('../stage/worker/stage-worker.js', import.meta.url);

function diagnosticCount(state) {
  const modelMessages = Array.isArray(state.model?.diagnostics?.messages) ? state.model.diagnostics.messages.length : 0;
  const planMessages = Array.isArray(state.renderPlan?.diagnostics) ? state.renderPlan.diagnostics.length : 0;
  return modelMessages + planMessages + state.validationErrors.length + state.previewDiagnostics.length + state.workerDiagnostics.length;
}
function activatePanel(handles, panel) {
  const showDiagnostics = panel === 'diagnostics';
  handles.propertiesTab.classList.toggle('is-active', !showDiagnostics);
  handles.diagnosticsTab.classList.toggle('is-active', showDiagnostics);
  handles.propertiesPanel.hidden = showDiagnostics; handles.diagnosticsPanel.hidden = !showDiagnostics;
}
function defaultSelection(model) { return model ? { type: 'root', id: model.hierarchy?.rootId || 'node-root' } : null; }
function updateRenderPlan(state) { state.renderPlan = state.model ? buildStageRenderPlan(state.model, state.renderQuality) : null; }
function previewText(plan) {
  if (!plan) return EMPTY_CANVAS_TEXT;
  const byOutput = plan.summary?.byOutput || {};
  return [STAGE_RENDER_PLAN_SCHEMA, `Quality: ${plan.source.quality}`, `Entries: ${plan.summary.totalEntries}`, `Procedural: ${byOutput.procedural || 0}`, `BBox/diagnostic: ${byOutput.bbox || 0}`, `Hidden: ${plan.summary.hidden}`, `Diagnostic-only: ${plan.summary.diagnosticOnly}`].join('\n');
}
function ensureWorkerClient(handles, state) {
  if (!state.workerClient) state.workerClient = createStageWorkerClient({ workerUrl: WORKER_URL, onMessage: (message) => handleWorkerMessage(message, handles, state) });
  return state.workerClient;
}
function disposeWorkerClient(state) { disposeStageWorkerClient(state.workerClient); state.workerClient = null; }
function handleWorkerMessage(message, handles, state) {
  const payload = message?.payload || {};
  if (message?.type === 'STAGE_WORKER_START' && payload.jobId && payload.jobId !== state.activeJobId) return;
  state.workerDiagnostics.push(workerMessageDiagnostic(message));
  state.statusText = message?.type === 'STAGE_WORKER_PROGRESS' ? `${payload.phase || 'worker'}: ${payload.message || ''}` : (message?.type || 'STAGE_WORKER_MESSAGE').replace('STAGE_WORKER_', '');
  updateStatus(handles, state);
}
function workerMessageDiagnostic(message) {
  const payload = message?.payload || {};
  return { severity: message?.type === 'STAGE_WORKER_ERROR' ? 'error' : 'info', code: message?.type || 'STAGE_WORKER_MESSAGE', message: payload.message || payload.phase || payload.code || message?.type || 'worker message' };
}
function appendWorkerMessages(result, state) { for (const message of result?.messages || []) state.workerDiagnostics.push(workerMessageDiagnostic(message)); }
function ensurePreviewRenderer(handles, state) {
  if (!state.previewRenderer) {
    state.previewRenderer = createStageThreePreviewRenderer(handles.canvasHost);
    setStagePreviewSelectionCallback(state.previewRenderer, (ref) => applyPreviewSelection(ref, handles, state));
  }
  return state.previewRenderer;
}
function renderPreview(handles, state) {
  handles.canvasHost.classList.toggle('has-model', Boolean(state.model));
  handles.canvasMessage.textContent = previewText(state.renderPlan);
  if (!state.model || !state.renderPlan) return disposePreview(state);
  try {
    const previewRenderer = ensurePreviewRenderer(handles, state);
    previewRenderer.selectedRef = state.selectedRef; previewRenderer.forceFit = state.previewFitPending || previewRenderer.forceFit;
    renderStagePreview(previewRenderer, state.model, state.renderPlan); state.previewFitPending = false; state.previewDiagnostics = [];
  } catch (error) {
    disposePreview(state); state.previewDiagnostics = [previewDiagnostic(error)]; state.activePanel = 'diagnostics';
    handles.canvasMessage.textContent = `Preview renderer failed\n${previewText(state.renderPlan)}`;
  }
}
function disposePreview(state) { disposeStageThreePreviewRenderer(state.previewRenderer); state.previewRenderer = null; }
function previewDiagnostic(error) { return { severity: 'error', code: 'STAGE_PREVIEW_RENDER_FAILED', message: error?.message || String(error) }; }
function clearLoadedModel(state, sourceName = '') { state.model = null; state.renderPlan = null; state.selectedRef = null; state.sourceFileName = sourceName; state.validationErrors = []; state.previewDiagnostics = []; }
function updateStatus(handles, state) {
  const model = state.model, plan = state.renderPlan;
  handles.statusText.textContent = state.statusText;
  handles.schemaText.textContent = `schema: ${model?.schema || RVM_STAGE_SCHEMA}`;
  handles.sourceText.textContent = `source: ${state.sourceFileName || model?.source?.fileName || '—'}`;
  handles.nodeText.textContent = `nodes: ${model?.hierarchy?.nodes?.length || 0}`;
  handles.componentText.textContent = `components: ${model?.components?.length || 0}`;
  handles.primitiveText.textContent = `primitives: ${model?.primitives?.length || 0}`;
  handles.diagnosticsText.textContent = `diagnostics: ${diagnosticCount(state)}`;
  handles.qualityText.textContent = `quality: ${state.renderQuality}`;
  handles.planEntryText.textContent = `plan entries: ${plan?.summary?.totalEntries || 0}`;
  handles.planDiagnosticText.textContent = `render diagnostic: ${plan?.summary?.diagnosticOnly || 0}`;
}
function acceptModel(model, sourceName, state) {
  const validation = validateRvmStageModel(model);
  state.sourceFileName = sourceName; state.previewDiagnostics = []; state.previewFitPending = true;
  if (!validation.valid) return rejectModel(validation.errors, state);
  state.model = model; state.selectedRef = defaultSelection(model); state.validationErrors = [];
  state.activePanel = 'properties'; state.statusText = `Loaded ${sourceName}`; updateRenderPlan(state); return true;
}
function rejectModel(errors, state) { clearLoadedModel(state); state.validationErrors = errors; state.activePanel = 'diagnostics'; state.statusText = 'Invalid staged model'; return false; }
function renderSidePanels(handles, state) {
  renderHierarchyTree(handles.hierarchyList, state.model, state.selectedRef);
  renderProperties(handles.propertiesPanel, state.model, state.selectedRef);
  renderDiagnostics(handles.diagnosticsPanel, state.model?.diagnostics, state.validationErrors, [...(state.renderPlan?.diagnostics || []), ...state.previewDiagnostics], state.workerDiagnostics);
  updateStatus(handles, state); activatePanel(handles, state.activePanel);
}
function renderAll(handles, state) { renderPreview(handles, state); renderSidePanels(handles, state); }
function applyPreviewSelection(ref, handles, state) {
  if (!ref?.type || !ref?.id) return;
  state.selectedRef = ref; state.activePanel = 'properties'; state.statusText = `Selected ${ref.type} ${ref.id}`;
  if (state.previewRenderer) { state.previewRenderer.selectedRef = ref; updateStagePreviewSelection(state.previewRenderer, state.model); }
  renderSidePanels(handles, state);
}
function applyWorkerResult(result, sourceName, handles, state, mode = 'stage-json') {
  appendWorkerMessages(result, state);
  if (!result?.ok) return applyWorkerFailure(result, handles, state, mode);
  const handoff = mode === 'rvm-binary' ? classifyRvmWorkerResult(result) : null;
  const accepted = acceptModel(result.stageModel, sourceName, state);
  const planCheck = validateStageRenderPlan(result.renderPlan);
  if (accepted && planCheck.valid && result.renderPlan?.source?.quality === state.renderQuality) state.renderPlan = result.renderPlan;
  if (!planCheck.valid) state.workerDiagnostics.push({ severity: 'warning', code: 'STAGE_WORKER_RENDER_PLAN_FALLBACK', message: planCheck.errors.join('; ') });
  if (handoff) state.workerDiagnostics.push(...createRvmUiDiagnostics(result));
  state.statusText = handoff?.statusText || 'Worker accepted Stage JSON'; renderAll(handles, state);
}
function applyWorkerFailure(result, handles, state, mode = 'stage-json') {
  appendWorkerMessages(result, state); clearLoadedModel(state, state.sourceFileName); state.validationErrors = result?.validationErrors || [];
  state.workerDiagnostics.push({ severity: 'error', code: result?.error?.code || 'STAGE_WORKER_FAILED', message: result?.error?.message || 'Stage worker failed' });
  appendRvmDiagnostics(result, state, mode); state.activePanel = 'diagnostics';
  state.statusText = mode === 'rvm-binary' ? classifyRvmWorkerResult(result).statusText : 'Worker rejected Stage JSON'; renderAll(handles, state);
}
function appendRvmDiagnostics(result, state, mode) {
  if (mode !== 'rvm-binary') return;
  const context = result?.error?.context || {};
  const items = [...(context.preflight?.errors || []), ...(context.preflight?.warnings || []), ...(context.warnings || [])];
  for (const item of items) state.workerDiagnostics.push({ severity: 'warning', code: item.code || 'STAGE_RVM_PREFLIGHT_DETAIL', message: item.message || String(item) });
  state.workerDiagnostics.push(...createRvmUiDiagnostics(result));
}
function runPreviewCommand(action, handles, state) {
  if (!state.model || !state.renderPlan || !state.previewRenderer) { state.statusText = `${action} requested — no preview loaded`; return renderAll(handles, state); }
  if (action === 'fit') { fitStagePreviewToRenderPlan(state.previewRenderer, state.renderPlan); state.statusText = 'Fit applied to preview'; }
  if (action === 'reset') { resetStagePreview(state.previewRenderer); state.statusText = 'Preview camera reset'; }
  updateStatus(handles, state);
}
function loadSample(handles, state) {
  try { state.workerDiagnostics = []; state.activeJobId = ''; acceptModel(createSampleRvmStageModelV1(), SAMPLE_SOURCE_NAME, state); }
  catch (error) { clearLoadedModel(state, SAMPLE_SOURCE_NAME); state.validationErrors = [`Sample load failed: ${error?.message || error}`]; state.activePanel = 'diagnostics'; state.statusText = 'Sample load failed'; }
  renderAll(handles, state);
}
async function loadStageFile(file, handles, state) {
  resetForWorkerFile(state, file.name, `reading-file: ${file.name}`); renderAll(handles, state);
  const text = await file.text(); const fileHash = await hashStageJsonText(file, text);
  const job = createStageJsonWorkerJob({ text, fileName: file.name, fileSize: file.size, fileHash });
  await runWorkerJob(job, handles, state, (result) => applyWorkerResult(result, file.name, handles, state)); handles.fileInput.value = '';
}
async function loadRvmFile(file, handles, state) {
  resetForWorkerFile(state, file.name, `reading-file: ${file.name}`); renderAll(handles, state);
  const arrayBuffer = await file.arrayBuffer(); const fileHash = await hashArrayBuffer(file, arrayBuffer, 'rvm-binary');
  const job = createRvmBinaryWorkerJob({ arrayBuffer, fileName: file.name, fileSize: file.size, fileHash });
  await runWorkerJob(job, handles, state, (result) => applyWorkerResult(result, file.name, handles, state, 'rvm-binary')); handles.rvmFileInput.value = '';
}
function resetForWorkerFile(state, fileName, statusText) { disposeWorkerClient(state); clearLoadedModel(state, fileName); state.workerDiagnostics = []; state.activePanel = 'diagnostics'; state.statusText = statusText; }
async function runWorkerJob(job, handles, state, applyResult) {
  state.activeJobId = job.jobId;
  try { const result = await runStageWorkerClientJob(ensureWorkerClient(handles, state), job); if (state.activeJobId === job.jobId) applyResult(result); }
  catch (error) { if (state.activeJobId === job.jobId) applyWorkerFailure({ error: { code: 'STAGE_WORKER_CLIENT_ERROR', message: error?.message || String(error) } }, handles, state, job.kind); }
}
async function hashStageJsonText(file, text) { return hashBytes(file, new TextEncoder().encode(text), 'stage-json'); }
async function hashArrayBuffer(file, arrayBuffer, kind) { return hashBytes(file, new Uint8Array(arrayBuffer), kind); }
async function hashBytes(file, bytes, kind) {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) return `sha256-${kind}-${file.name}-${file.size}-${bytes.byteLength}`;
  const digest = await cryptoApi.digest('SHA-256', bytes);
  return `sha256-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
function wireEvents(handles, state) {
  const onToolbarClick = (event) => {
    const action = event.target?.dataset?.action;
    if (action === 'open-stage-json') handles.fileInput.click(); if (action === 'open-rvm') handles.rvmFileInput.click(); if (action === 'load-sample') loadSample(handles, state);
    if (action === 'fit' || action === 'reset') runPreviewCommand(action, handles, state); if (action === 'show-diagnostics') state.activePanel = 'diagnostics';
    if (!['load-sample', 'fit', 'reset', 'open-rvm'].includes(action)) renderAll(handles, state);
  };
  const onFileChange = (event) => { const file = event.target.files?.[0]; if (file) loadStageFile(file, handles, state); };
  const onRvmFileChange = (event) => { const file = event.target.files?.[0]; if (file) loadRvmFile(file, handles, state); };
  const onQualityChange = () => { state.renderQuality = normalizeRenderQuality(handles.qualitySelect.value); state.statusText = `Render quality: ${state.renderQuality}`; updateRenderPlan(state); renderAll(handles, state); };
  const onTreeClick = (event) => { const row = event.target.closest?.('[data-ref-type][data-ref-id]'); if (row) applyPreviewSelection({ type: row.dataset.refType, id: row.dataset.refId }, handles, state); };
  const onRightTabClick = (event) => { const panel = event.target?.dataset?.panel; if (panel) { state.activePanel = panel; renderSidePanels(handles, state); } };
  handles.toolbar.addEventListener('click', onToolbarClick); handles.fileInput.addEventListener('change', onFileChange); handles.rvmFileInput.addEventListener('change', onRvmFileChange);
  handles.qualitySelect.addEventListener('change', onQualityChange); handles.hierarchyList.addEventListener('click', onTreeClick); handles.rightPanel.addEventListener('click', onRightTabClick);
  return () => { handles.toolbar.removeEventListener('click', onToolbarClick); handles.fileInput.removeEventListener('change', onFileChange); handles.rvmFileInput.removeEventListener('change', onRvmFileChange); handles.qualitySelect.removeEventListener('change', onQualityChange); handles.hierarchyList.removeEventListener('click', onTreeClick); handles.rightPanel.removeEventListener('click', onRightTabClick); };
}
export function renderViewer3DJson(root) {
  const handles = createJsonViewerShell(root);
  const state = { model: null, renderPlan: null, previewRenderer: null, workerClient: null, previewDiagnostics: [], workerDiagnostics: [], previewFitPending: false, activeJobId: '', sourceFileName: '', selectedRef: null, validationErrors: [], renderQuality: 'full', activePanel: 'properties', statusText: 'Ready' };
  handles.qualitySelect.value = state.renderQuality; const cleanup = wireEvents(handles, state); renderAll(handles, state);
  return () => { cleanup(); disposeWorkerClient(state); disposePreview(state); };
}
