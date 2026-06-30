import { validateRvmStageModel, normalizeRenderQuality, RVM_STAGE_SCHEMA } from '../stage/contracts/RvmStageModelContract.js';
import { createJsonViewerShell } from '../stage/ui/JsonViewerShell.js';
import { renderHierarchyTree } from '../stage/ui/JsonViewerHierarchyTree.js';
import { renderProperties } from '../stage/ui/JsonViewerPropertiesPanel.js';
import { renderDiagnostics } from '../stage/ui/JsonViewerDiagnosticsPanel.js';

const EMPTY_CANVAS_TEXT = '3D Json Viewer — load RvmStageModel.v1';

function countDiagnostics(model, validationErrors) {
  const messages = Array.isArray(model?.diagnostics?.messages) ? model.diagnostics.messages.length : 0;
  return messages + validationErrors.length;
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

function updateCanvas(handles, model) {
  handles.canvasHost.classList.toggle('has-model', Boolean(model));
  if (!model) {
    handles.canvasMessage.textContent = EMPTY_CANVAS_TEXT;
    return;
  }
  const primitives = Array.isArray(model.primitives) ? model.primitives.length : 0;
  handles.canvasMessage.textContent = `Stage loaded: ${primitives} primitive placeholder(s). Geometry renderer is Phase 2.`;
}

function updateStatus(handles, state) {
  const model = state.model;
  handles.statusText.textContent = state.statusText;
  handles.schemaText.textContent = `schema: ${model?.schema || RVM_STAGE_SCHEMA}`;
  handles.sourceText.textContent = `source: ${state.sourceFileName || model?.source?.fileName || '—'}`;
  handles.primitiveText.textContent = `primitives: ${model?.primitives?.length || 0}`;
  handles.componentText.textContent = `components: ${model?.components?.length || 0}`;
  handles.diagnosticsText.textContent = `diagnostics: ${countDiagnostics(model, state.validationErrors)}`;
}

function renderAll(handles, state) {
  renderHierarchyTree(handles.hierarchyList, state.model, state.selectedRef);
  renderProperties(handles.propertiesPanel, state.model, state.selectedRef);
  renderDiagnostics(handles.diagnosticsPanel, state.model?.diagnostics, state.validationErrors);
  updateCanvas(handles, state.model);
  updateStatus(handles, state);
  activatePanel(handles, state.activePanel);
}

async function loadStageFile(file, handles, state) {
  state.statusText = `Loading ${file.name}…`;
  updateStatus(handles, state);
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const validation = validateRvmStageModel(parsed);
    if (!validation.valid) {
      state.model = null;
      state.selectedRef = null;
      state.validationErrors = validation.errors;
      state.activePanel = 'diagnostics';
      state.sourceFileName = file.name;
      state.statusText = 'Invalid staged model';
      return;
    }
    state.model = parsed;
    state.selectedRef = defaultSelection(parsed);
    state.validationErrors = [];
    state.activePanel = 'properties';
    state.sourceFileName = file.name;
    state.statusText = `Loaded ${file.name}`;
  } catch (error) {
    state.model = null;
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
    if (action === 'fit') state.statusText = 'Fit requested — renderer pending';
    if (action === 'reset') state.statusText = 'Reset requested — renderer pending';
    if (action === 'show-diagnostics') state.activePanel = 'diagnostics';
    renderAll(handles, state);
  };
  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) loadStageFile(file, handles, state);
  };
  const onQualityChange = () => {
    state.renderQuality = normalizeRenderQuality(handles.qualitySelect.value);
    state.statusText = `Render quality: ${state.renderQuality}`;
    renderAll(handles, state);
  };
  const onTreeClick = (event) => {
    const row = event.target.closest?.('[data-ref-type][data-ref-id]');
    if (!row) return;
    state.selectedRef = { type: row.dataset.refType, id: row.dataset.refId };
    state.activePanel = 'properties';
    renderAll(handles, state);
  };
  const onRightTabClick = (event) => {
    const panel = event.target?.dataset?.panel;
    if (!panel) return;
    state.activePanel = panel;
    renderAll(handles, state);
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
  return cleanup;
}
