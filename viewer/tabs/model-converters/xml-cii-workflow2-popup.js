/**
 * XML->CII(2019) Workflow 2 popup controller.
 *
 * This is intentionally independent from Workflow 1 popup ownership. Workflow 2
 * uses the same XML->CII bridge/conversion core, but owns its own launcher,
 * runtime state, modal lifecycle, render target, and body event delegation.
 */

import { WorkflowModal } from './shared/WorkflowModal.js?v=20260624-workflow-tabs-fix-1';
import { xmlCiiWorkflowGetBridge, xmlCiiWorkflowGetSnapshot } from './xml-cii-workflow-bridge.js?v=20260624-master-tab-responsive-1';
import { xmlCiiWorkflowRequestFinalRun } from './xml-cii-workflow-runner.js?v=20260624-workflow1-workflow2-1';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260624-workflow1-workflow2-1';
import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js';

const WF2_RUNTIME_KEY = '__xmlCiiWorkflow2PopupStandalone_v1';
const WF2_CLICK_VERSION = '20260624-workflow2-standalone-1';
const WF2_ACTIVE_PHASE_KEY = 'xmlCii2019.workflow2.activePhase.v1';
const WF2_LEGACY_PHASE_KEY = 'xmlCii2019.workflow.activePhase.v1';
const WF2_BODY_ROOT_ATTR = 'data-xml-cii-workflow2-root';
const WF2_OVERLAY_ATTR = 'data-xml-cii-workflow2-overlay';
const WF2_LAUNCHER_SELECTOR = '#model-converters-xml-cii-workflow2-btn, #model-converters-xml-cii-rich-btn, [data-xml-cii-workflow2-launcher="true"], [data-xml-cii-rich-workflow-launcher="true"]';

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readStored(key, fallback) {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function runtime() {
  if (!window[WF2_RUNTIME_KEY]) window[WF2_RUNTIME_KEY] = { stateByRoot: new WeakMap() };
  return window[WF2_RUNTIME_KEY];
}

function normalizePhase(id) {
  return normalizeWorkflowPhaseId(id || readStored(WF2_ACTIVE_PHASE_KEY, readStored(WF2_LEGACY_PHASE_KEY, 'import-masters')));
}

function stateFor(appRoot) {
  const rt = runtime();
  let state = rt.stateByRoot.get(appRoot);
  if (!state) {
    state = {
      appRoot,
      renderRoot: null,
      mode: 'workflow2',
      phaseId: normalizePhase(appRoot?.dataset?.selectedPhase),
      activeMaster: 'linelist',
      previewRows: [],
      previewStatus: '',
      diagnosticsRows: [],
      diagnosticsStatus: '',
      weightRows: [],
      weightStatus: '',
      configText: null,
      configStatus: '',
      modal: null,
      renderRaf: 0,
    };
    rt.stateByRoot.set(appRoot, state);
  }
  if (!state.appRoot && appRoot) state.appRoot = appRoot;
  state.mode = 'workflow2';
  return state;
}

function isConnected(node) {
  if (!node) return false;
  if (node.isConnected === true) return true;
  try { return document.contains(node); } catch { return false; }
}

function renderTarget(state) {
  if (isConnected(state?.renderRoot)) return state.renderRoot;
  return state?.appRoot || null;
}

function setDatasets(target, state) {
  if (!target) return;
  target.dataset.selectedPhase = state.phaseId;
  target.dataset.xmlCiiWorkflowMode = 'workflow2';
  target.dataset.xmlCiiActiveMaster = state.activeMaster || target.dataset.xmlCiiActiveMaster || 'linelist';
  if (state.appRoot && state.appRoot !== target) {
    state.appRoot.dataset.selectedPhase = state.phaseId;
    state.appRoot.dataset.xmlCiiWorkflowMode = 'workflow2';
    state.appRoot.dataset.xmlCiiActiveMaster = target.dataset.xmlCiiActiveMaster;
  }
}

function workflowBody(state) {
  return renderTarget(state)?.querySelector?.('[data-xml-cii-workflow-body]') || null;
}

function snapshot(state) {
  return xmlCiiWorkflowGetSnapshot(state.appRoot);
}

function renderError(body, error) {
  console.warn('[XML CII Workflow 2] render failed', error);
  body.innerHTML = `<div class="model-converters-workflow-detail-note">Workflow 2 view failed to render: ${String(error?.message || error || 'unknown error')}</div>`;
}

function renderNow(state) {
  if (state.renderRaf) {
    cancelAnimationFrame(state.renderRaf);
    state.renderRaf = 0;
  }
  const target = renderTarget(state);
  setDatasets(target, state);
  const body = workflowBody(state);
  if (!body) return;
  try {
    const data = snapshot(state);
    if (!data) {
      body.innerHTML = '<div class="model-converters-workflow-detail-note">Workflow 2 bridge is not ready. Reopen the Model Converter tab and try again.</div>';
      return;
    }
    state.activeMaster = target.dataset.xmlCiiActiveMaster || state.activeMaster || 'linelist';
    body.innerHTML = renderXmlCiiPopupNativePhase(state.phaseId, data, state);
  } catch (error) {
    renderError(body, error);
  }
}

function scheduleRender(state, message = 'Loading Workflow 2 view...') {
  const target = renderTarget(state);
  setDatasets(target, state);
  const body = workflowBody(state);
  if (body && message) body.innerHTML = `<div class="model-converters-workflow-detail-note">${message}</div>`;
  if (state.renderRaf) cancelAnimationFrame(state.renderRaf);
  const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
  state.renderRaf = schedule(() => {
    state.renderRaf = 0;
    renderNow(state);
  });
}

function selectPhase(state, phaseId) {
  state.phaseId = normalizePhase(phaseId);
  writeStored(WF2_ACTIVE_PHASE_KEY, state.phaseId);
  state.modal?.setActiveTab?.(state.phaseId);
  scheduleRender(state, 'Loading Workflow 2 phase...');
}

function closeOtherXmlCiiWorkflowOverlays(except = null) {
  document.querySelectorAll('.model-converters-workflow-popup-overlay').forEach((overlay) => {
    if (overlay === except) return;
    const title = overlay.querySelector('.model-converters-workflow-popup-title')?.textContent || '';
    const text = overlay.textContent || '';
    if (/XML\s*[-–>]*\s*>?\s*CII\(2019\)/i.test(title) || (/XML\s*[-–>]*\s*>?\s*CII\(2019\)/i.test(text) && /Workflow/i.test(text))) {
      overlay.remove();
    }
  });
}

async function preloadDefaultMasters(state) {
  try {
    await xmlCiiWorkflowGetBridge()?.ensureDefaultMastersLoaded?.(state.appRoot);
    scheduleRender(state, 'Refreshing Workflow 2 masters...');
  } catch (error) {
    console.warn('[XML CII Workflow 2] default master preload failed', error);
  }
}

function downloadText(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function handleWorkflow2Click(event, state) {
  const target = event.target?.closest?.([
    '[data-native-master-tab]',
    '[data-native-load-default]',
    '[data-native-auto-map]',
    '[data-native-save-master]',
    '[data-native-clear-master]',
    '[data-native-build-preview]',
    '[data-native-dry-run]',
    '[data-native-compute-weights]',
    '[data-native-apply-preferred-weights]',
    '[data-native-skip-weight-review]',
    '[data-native-review-weights]',
    '[data-native-finalise-run]',
    '[data-native-open-support-table]',
    '[data-native-save-config]',
    '[data-native-export-config]',
  ].join(','));
  if (!target || !state.renderRoot?.contains(target)) return;
  event.preventDefault();
  event.stopPropagation();

  const bridge = xmlCiiWorkflowGetBridge();
  if (target.dataset.nativeMasterTab) {
    state.activeMaster = target.dataset.nativeMasterTab || 'linelist';
    renderTarget(state).dataset.xmlCiiActiveMaster = state.activeMaster;
    scheduleRender(state, 'Switching Workflow 2 master table...');
  } else if (target.dataset.nativeLoadDefault) {
    await bridge?.loadPopupDefaultMaster?.(target.dataset.nativeLoadDefault);
    scheduleRender(state, 'Loaded default master. Refreshing Workflow 2...');
  } else if (target.dataset.nativeAutoMap) {
    bridge?.autoMapPopupMaster?.(target.dataset.nativeAutoMap);
    scheduleRender(state, 'Auto-mapped columns. Refreshing Workflow 2...');
  } else if (target.dataset.nativeSaveMaster) {
    bridge?.savePopupMaster?.(target.dataset.nativeSaveMaster);
    scheduleRender(state, 'Saved master rows. Refreshing Workflow 2...');
  } else if (target.dataset.nativeClearMaster) {
    bridge?.clearPopupMaster?.(target.dataset.nativeClearMaster);
    scheduleRender(state, 'Cleared master rows. Refreshing Workflow 2...');
  } else if (target.hasAttribute('data-native-build-preview')) {
    state.previewStatus = 'Building...';
    scheduleRender(state, 'Building Workflow 2 preview...');
    try {
      state.previewRows = await bridge?.buildPopupPreviewRows?.() || [];
      state.previewStatus = `Preview ready: ${state.previewRows.length} row(s)`;
    } catch (error) {
      state.previewStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Refreshing Workflow 2 preview...');
  } else if (target.hasAttribute('data-native-dry-run')) {
    state.diagnosticsStatus = 'Running...';
    scheduleRender(state, 'Running Workflow 2 diagnostics...');
    try {
      state.diagnosticsRows = await bridge?.runPopupDiagnostics?.() || [];
      state.diagnosticsStatus = `Done: ${state.diagnosticsRows.length} row(s)`;
    } catch (error) {
      state.diagnosticsStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Refreshing Workflow 2 diagnostics...');
  } else if (target.hasAttribute('data-native-compute-weights')) {
    state.weightStatus = 'Computing...';
    scheduleRender(state, 'Computing Workflow 2 weights...');
    try {
      state.weightRows = await bridge?.computePopupWeightRows?.() || [];
      state.weightStatus = `Ready: ${state.weightRows.length} row(s)`;
    } catch (error) {
      state.weightStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Refreshing Workflow 2 weights...');
  } else if (target.hasAttribute('data-native-apply-preferred-weights')) {
    bridge?.applyPopupPreferredWeights?.(state.weightRows || []);
    state.weightStatus = `Applied ${(state.weightRows || []).length} preferred weight(s)`;
    scheduleRender(state, 'Applied Workflow 2 preferred weights...');
  } else if (target.hasAttribute('data-native-skip-weight-review')) {
    selectPhase(state, 'run');
  } else if (target.hasAttribute('data-native-review-weights')) {
    selectPhase(state, 'weight-match');
  } else if (target.hasAttribute('data-native-finalise-run')) {
    bridge?.closePopup?.();
    xmlCiiWorkflowRequestFinalRun(state.appRoot, 'workflow2');
  } else if (target.hasAttribute('data-native-open-support-table')) {
    bridge?.renderPopupSupportTable?.(workflowBody(state)?.querySelector('[data-native-support-host]'));
  } else if (target.hasAttribute('data-native-save-config')) {
    try {
      const body = workflowBody(state);
      const textarea = body?.querySelector('[data-native-config-text]');
      const bools = {};
      body?.querySelectorAll('[data-native-config-bool]').forEach((input) => { bools[input.dataset.nativeConfigBool] = input.checked; });
      state.configText = bridge?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
    } catch (error) {
      state.configStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Saved Workflow 2 config. Refreshing...');
  } else if (target.hasAttribute('data-native-export-config')) {
    downloadText('cii-enrichment-workflow2-config.json', bridge?.exportPopupConfigText?.() || '{}');
  }
}

async function handleWorkflow2Change(event, state) {
  const target = event.target;
  if (!target || !state.renderRoot?.contains(target)) return;
  const bridge = xmlCiiWorkflowGetBridge();
  if (target.matches('[data-native-regex-path]')) {
    bridge?.setPopupConfigValue?.(target.dataset.nativeRegexPath, target.value, target.type === 'number' ? 'number' : 'text');
    scheduleRender(state, 'Updating Workflow 2 regex configuration...');
  } else if (target.matches('[data-native-import-master]')) {
    const file = target.files?.[0];
    if (!file) return;
    await bridge?.importPopupMasterFile?.(target.dataset.nativeImportMaster, file);
    scheduleRender(state, 'Imported master. Refreshing Workflow 2...');
  } else if (target.matches('[data-native-field-map]')) {
    bridge?.setPopupMasterField?.(target.dataset.nativeMasterKey, target.dataset.nativeFieldMap, target.value);
    scheduleRender(state, 'Updated Workflow 2 field mapping...');
  } else if (target.matches('[data-native-run-option]')) {
    const value = target.type === 'checkbox' ? target.checked : target.value;
    bridge?.setPopupRunOption?.(target.dataset.nativeRunOption, value, target.type === 'checkbox' ? 'checkbox' : 'text');
    scheduleRender(state, 'Updated Workflow 2 run options...');
  } else if (target.matches('[data-native-config-bool]')) {
    const body = workflowBody(state);
    const textarea = body?.querySelector('[data-native-config-text]');
    state.configText = bridge?.savePopupConfigText?.(textarea?.value || '{}', { [target.dataset.nativeConfigBool]: target.checked }) || state.configText;
    state.configStatus = 'Saved';
    scheduleRender(state, 'Saved Workflow 2 config. Refreshing...');
  } else if (target.matches('[data-native-import-config]')) {
    const file = target.files?.[0];
    if (!file) return;
    try {
      bridge?.importPopupConfigText?.(await file.text());
      state.configText = null;
      state.configStatus = `Imported ${file.name}`;
    } catch (error) {
      state.configStatus = `Import failed: ${error?.message || error}`;
    }
    scheduleRender(state, 'Imported Workflow 2 config. Refreshing...');
  }
}

function handleWorkflow2Input(event, state) {
  const target = event.target;
  if (target?.matches?.('[data-native-config-text]') && state.renderRoot?.contains(target)) {
    state.configText = target.value;
    state.configStatus = 'Unsaved changes';
  }
}

function bindWorkflow2Body(body, state) {
  if (!body || body.dataset.xmlCiiWorkflow2BodyBound === WF2_CLICK_VERSION) return;
  body.addEventListener('click', (event) => { handleWorkflow2Click(event, state); }, { capture: true });
  body.addEventListener('change', (event) => { handleWorkflow2Change(event, state); }, { capture: true });
  body.addEventListener('input', (event) => { handleWorkflow2Input(event, state); }, { capture: true });
  body.dataset.xmlCiiWorkflow2BodyBound = WF2_CLICK_VERSION;
}

function openWorkflow2Popup(container) {
  const bridge = xmlCiiWorkflowGetBridge();
  if (!bridge) return;
  const appRoot = container?.querySelector?.('.model-converters-root') || container;
  const state = stateFor(appRoot);
  state.modal?.close?.();
  closeOtherXmlCiiWorkflowOverlays();
  const modal = new WorkflowModal({
    title: 'XML->CII(2019) Workflow 2',
    subtitle: 'Enhanced workflow for process-data and weight-data customisation with per-master preview tables.',
    tabs: XML_CII_WORKFLOW_PHASES,
    activeTabId: state.phaseId,
    onTabChange: (phaseId) => selectPhase(state, phaseId),
    onClose: () => {
      state.modal = null;
      state.renderRoot = null;
      bridge.closePopup = null;
    },
  });
  const body = modal.open();
  state.modal = modal;
  state.renderRoot = body;
  modal.overlayEl?.setAttribute(WF2_OVERLAY_ATTR, 'true');
  modal.overlayEl?.setAttribute('data-xml-cii-workflow-mode', 'workflow2');
  body.setAttribute(WF2_BODY_ROOT_ATTR, 'true');
  body.setAttribute('data-xml-cii-workflow-mode', 'workflow2');
  body.innerHTML = '<div data-xml-cii-workflow-body></div>';
  bindWorkflow2Body(body, state);
  setDatasets(body, state);
  bridge.closePopup = () => state.modal?.close?.();
  renderNow(state);
  preloadDefaultMasters(state);
  setTimeout(() => closeOtherXmlCiiWorkflowOverlays(modal.overlayEl), 0);
}

function bindWorkflow2Launcher(container) {
  const root = container?.querySelector?.('.model-converters-root') || container;
  if (!root || root.dataset.xmlCiiWorkflow2StandaloneBound === WF2_CLICK_VERSION) return;
  root.addEventListener('click', (event) => {
    const target = event.target?.closest?.(WF2_LAUNCHER_SELECTOR);
    if (!target || !root.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openWorkflow2Popup(root);
  }, { capture: true });
  root.dataset.xmlCiiWorkflow2StandaloneBound = WF2_CLICK_VERSION;
}

export function installXmlCiiWorkflow2Popup(container = document) {
  if (!browserReady()) return;
  runtime();
  bindWorkflow2Launcher(container);
}
