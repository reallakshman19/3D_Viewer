import { validateRvmStageModel, normalizeRenderQuality, RVM_STAGE_SCHEMA } from '../stage/contracts/RvmStageModelContract.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { buildStageRenderPlan, STAGE_RENDER_PLAN_SCHEMA } from '../stage/render/StageRenderPlan.js';
import {
  createStageThreePreviewRenderer,
  renderStagePreview,
  disposeStageThreePreviewRenderer,
  fitStagePreviewToRenderPlan,
  resetStagePreview,
  updateStagePreviewSelection,
  setStagePreviewSelectionCallback,
} from '../stage/render/StageThreePreviewRenderer.js';
import { createJsonViewerShell } from '../stage/ui/JsonViewerShell.js';
import { renderHierarchyTree } from '../stage/ui/JsonViewerHierarchyTree.js';
import { renderProperties } from '../stage/ui/JsonViewerPropertiesPanel.js';
import { renderDiagnostics } from '../stage/ui/JsonViewerDiagnosticsPanel.js';

const EMPTY_CANVAS_TEXT = '3D Json Viewer — load RvmStageModel.v1';
const SAMPLE_SOURCE_NAME = 'sample-rvm-stage-model-v1.js';

function diagnosticCount(state) {
  const modelMessages = Array.isArray(state.model?.diagnostics?.messages) ? state.model.diagnostics.messages.length : 0;
  const planMessages = Array.isArray(state.renderPlan?.diagnostics) ? state.renderPlan.diagnostics.length : 0;
  return modelMessages + planMessages + state.validationErrors.length + state.previewDiagnostics.length;
}

function activatePanel(handles, panel) {
  const showDiagnostics = panel === 'diagnostics';
  handles.propertiesTab.classList.toggle('is-active', !showDiagnostics);
  handles.diagnosticsTab.classList.toggle('is-active', showDiagnostics);
  handles.propertiesPanel.hidden = showDiagnostics;
  handles.diagnosticsPanel.hidden = !showDiagnostics;
}

function defaultSelection(model) {
  if (!model) return null;
  return { type: 'root', id: model.hierarchy?.rootId || 'node-root' };
}

function updateRenderPlan(state) {
  state.renderPlan = state.model ? buildStageRenderPlan(state.model, state.renderQuality) : null;
}

function previewText(plan) {
  if (!plan) return EMPTY_CANVAS_TEXT;
  const byOutput = plan.summary?.byOutput || {};
  return [
    STAGE_RENDER_PLAN_SCHEMA,
    `Quality: ${plan.source.quality}`,
    `Entries: ${plan.summary.totalEntries}`,
    `Procedural: ${byOutput.procedural || 0}`,
    `BBox/diagnostic: ${byOutput.bbox || 0}`,
    `Hidden: ${plan.summary.hidden}`,
    `Diagnostic-only: ${plan.summary.diagnosticOnly}`,
  ].join('\n');
}

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
    previewRenderer.selectedRef = state.selectedRef;
    previewRenderer.forceFit = state.previewFitPending || previewRenderer.forceFit;
    renderStagePreview(previewRenderer, state.model, state.renderPlan);
    state.previewFitPending = false;
    state.previewDiagnostics = [];
  } catch (error) {
    disposePreview(state);
    state.previewDiagnostics = [previewDiagnostic(error)];
    state.activePanel = 'diagnostics';
    handles.canvasMessage.textContent = `Preview renderer failed\n${previewText(state.renderPlan)}`;
  }
}

function disposePreview(state) {
  disposeStageThreePreviewRenderer(state.previewRenderer);
  state.previewRenderer = null;
}

function previewDiagnostic(error) {
  return { severity: 'error', code: 'STAGE_PREVIEW_RENDER_FAILED', message: error?.message || String(error) };
}

function updateStatus(handles, state) {
  const model = state.model;
  const plan = state.renderPlan;
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
  state.sourceFileName = sourceName;
  state.previewDiagnostics = [];
  state.previewFitPending = true;
  if (!validation.valid) {
    state.model = null;
    state.renderPlan = null;
    state.selectedRef = null;
    state.validationErrors = validation.errors;
    state.activePanel = 'diagnostics';
    state.statusText = 'Invalid staged model';
    return false;
  }
  state.model = model;
  state.selectedRef = defaultSelection(model);
  state.validationErrors = [];
  state.activePanel = 'properties';
  state.statusText = `Loaded ${sourceName}`;
  updateRenderPlan(state);
  return true;
}

function renderSidePanels(handles, state) {
  renderHierarchyTree(handles.hierarchyList, state.model, state.selectedRef);
  renderProperties(handles.propertiesPanel, state.model, state.selectedRef);
  renderDiagnostics(handles.diagnosticsPanel, state.model?.diagnostics, state.validationErrors, [...(state.renderPlan?.diagnostics || []), ...state.previewDiagnostics]);
  updateStatus(handles, state);
  activatePanel(handles, state.activePanel);
}

function renderAll(handles, state) {
  renderPreview(handles, state);
  renderSidePanels(handles, state);
}

function applyPreviewSelection(ref, handles, state) {
  if (!ref?.type || !ref?.id) return;
  state.selectedRef = ref;
  state.activePanel = 'properties';
  state.statusText = `Selected ${ref.type} ${ref.id}`;
  if (state.previewRenderer) {
    state.previewRenderer.selectedRef = ref;
    updateStagePreviewSelection(state.previewRenderer, state.model);
  }
  renderSidePanels(handles, state);
}

function runPreviewCommand(action, handles, state) {
  if (!state.model || !state.renderPlan || !state.previewRenderer) {
    state.statusText = `${action} requested — no preview loaded`;
    renderAll(handles, state);
    return;
  }
  if (action === 'fit') {
    fitStagePreviewToRenderPlan(state.previewRenderer, state.renderPlan);
    state.statusText = 'Fit applied to preview';
  }
  if (action === 'reset') {
    resetStagePreview(state.previewRenderer);
    state.statusText = 'Preview camera reset';
  }
  updateStatus(handles, state);
}

function loadSample(handles, state) {
  try {
    acceptModel(createSampleRvmStageModelV1(), SAMPLE_SOURCE_NAME, state);
  } catch (error) {
    state.model = null;
    state.renderPlan = null;
    state.selectedRef = null;
    state.validationErrors = [`Sample load failed: ${error?.message || error}`];
    state.activePanel = 'diagnostics';
    state.sourceFileName = SAMPLE_SOURCE_NAME;
    state.statusText = 'Sample load failed';
  }
  renderAll(handles, state);
}

async function loadStageFile(file, handles, state) {
  state.statusText = `Loading ${file.name}…`;
  updateStatus(handles, state);
  try {
    acceptModel(JSON.parse(await file.text()), file.name, state);
  } catch (error) {
    state.model = null;
    state.renderPlan = null;
    state.selectedRef = null;
    state.validationErrors = [`Malformed JSON: ${error?.message || error}`];
    state.activePanel = 'diagnostics';
    state.sourceFileName = file.name;
    state.statusText = 'JSON load failed';
  } finally {
    handles.fileInput.value = '';
    renderAll(handles, state);
  }
}

function wireEvents(handles, state) {
  const onToolbarClick = (event) => {
    const action = event.target?.dataset?.action;
    if (action === 'open-stage-json') handles.fileInput.click();
    if (action === 'load-sample') loadSample(handles, state);
    if (action === 'fit' || action === 'reset') runPreviewCommand(action, handles, state);
    if (action === 'show-diagnostics') state.activePanel = 'diagnostics';
    if (!['load-sample', 'fit', 'reset'].includes(action)) renderAll(handles, state);
  };
  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) loadStageFile(file, handles, state);
  };
  const onQualityChange = () => {
    state.renderQuality = normalizeRenderQuality(handles.qualitySelect.value);
    state.statusText = `Render quality: ${state.renderQuality}`;
    updateRenderPlan(state);
    renderAll(handles, state);
  };
  const onTreeClick = (event) => {
    const row = event.target.closest?.('[data-ref-type][data-ref-id]');
    if (!row) return;
    applyPreviewSelection({ type: row.dataset.refType, id: row.dataset.refId }, handles, state);
  };
  const onRightTabClick = (event) => {
    const panel = event.target?.dataset?.panel;
    if (!panel) return;
    state.activePanel = panel;
    renderSidePanels(handles, state);
  };
  handles.toolbar.addEventListener('click', onToolbarClick);
  handles.fileInput.addEventListener('change', onFileChange);
  handles.qualitySelect.addEventListener('change', onQualityChange);
  handles.hierarchyList.addEventListener('click', onTreeClick);
  handles.rightPanel.addEventListener('click', onRightTabClick);
  return () => {
    handles.toolbar.removeEventListener('click', onToolbarClick);
    handles.fileInput.removeEventListener('change', onFileChange);
    handles.qualitySelect.removeEventListener('change', onQualityChange);
    handles.hierarchyList.removeEventListener('click', onTreeClick);
    handles.rightPanel.removeEventListener('click', onRightTabClick);
  };
}

export function renderViewer3DJson(root) {
  const handles = createJsonViewerShell(root);
  const state = {
    model: null,
    renderPlan: null,
    previewRenderer: null,
    previewDiagnostics: [],
    previewFitPending: false,
    sourceFileName: '',
    selectedRef: null,
    validationErrors: [],
    renderQuality: 'full',
    activePanel: 'properties',
    statusText: 'Ready',
  };
  handles.qualitySelect.value = state.renderQuality;
  const cleanup = wireEvents(handles, state);
  renderAll(handles, state);
  return () => {
    cleanup();
    disposePreview(state);
  };
}
