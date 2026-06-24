/**
 * XML->CII(2019) Workflow 1 popup controller.
 *
 * Workflow 1 owns only the baseline enriched conversion popup. Workflow 2 is
 * restored in xml-cii-workflow2-popup.js with its own runtime and launcher.
 */

import { WorkflowModal } from './shared/WorkflowModal.js?v=20260624-workflow-tabs-fix-1';
import { xmlCiiWorkflowGetBridge, xmlCiiWorkflowGetSnapshot } from './xml-cii-workflow-bridge.js?v=20260624-master-tab-responsive-1';
import { xmlCiiWorkflowRequestFinalRun } from './xml-cii-workflow-runner.js?v=20260624-workflow1-workflow2-1';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260624-workflow1-workflow2-1';
import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js';

const WF1_RUNTIME_KEY = '__xmlCiiWorkflow1PopupStandalone_v1';
const WF1_CLICK_VERSION = '20260624-workflow1-standalone-1';
const WF1_ACTIVE_PHASE_KEY = 'xmlCii2019.workflow1.activePhase.v1';
const WF1_LEGACY_PHASE_KEY = 'xmlCii2019.workflow.activePhase.v1';
const WF1_BODY_ROOT_ATTR = 'data-xml-cii-workflow1-root';
const WF1_OVERLAY_ATTR = 'data-xml-cii-workflow1-overlay';
const WF1_LAUNCHER_SELECTOR = '#model-converters-xml-cii-workflow1-btn, #model-converters-xml-cii-simple-btn, [data-xml-cii-workflow1-launcher="true"], [data-xml-cii-simple-workflow-launcher="true"]';

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
  if (!window[WF1_RUNTIME_KEY]) window[WF1_RUNTIME_KEY] = { stateByRoot: new WeakMap() };
  return window[WF1_RUNTIME_KEY];
}

function normalizePhase(id) {
  return normalizeWorkflowPhaseId(id || readStored(WF1_ACTIVE_PHASE_KEY, readStored(WF1_LEGACY_PHASE_KEY, 'regex')));
}

function stateFor(appRoot) {
  const rt = runtime();
  let state = rt.stateByRoot.get(appRoot);
  if (!state) {
    state = {
      appRoot,
      renderRoot: null,
      mode: 'workflow1',
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
  state.mode = 'workflow1';
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
  target.dataset.xmlCiiWorkflowMode = 'workflow1';
  target.dataset.xmlCiiActiveMaster = state.activeMaster || target.dataset.xmlCiiActiveMaster || 'linelist';
  if (state.appRoot && state.appRoot !== target) {
    state.appRoot.dataset.selectedPhase = state.phaseId;
    state.appRoot.dataset.xmlCiiWorkflowMode = 'workflow1';
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
  console.warn('[XML CII Workflow 1] render failed', error);
  body.innerHTML = `<div class="model-converters-workflow-detail-note">Workflow 1 view failed to render: ${String(error?.message || error || 'unknown error')}</div>`;
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
      body.innerHTML = '<div class="model-converters-workflow-detail-note">Workflow 1 bridge is not ready. Reopen the Model Converter tab and try again.</div>';
      return;
    }
    state.activeMaster = target.dataset.xmlCiiActiveMaster || state.activeMaster || 'linelist';
    body.innerHTML = renderXmlCiiPopupNativePhase(state.phaseId, data, state);
  } catch (error) {
    renderError(body, error);
  }
}

function scheduleRender(state, message = 'Loading Workflow 1 view...') {
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
  writeStored(WF1_ACTIVE_PHASE_KEY, state.phaseId);
  state.modal?.setActiveTab?.(state.phaseId);
  scheduleRender(state, 'Loading Workflow 1 phase...');
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
    scheduleRender(state, 'Refreshing Workflow 1 masters...');
  } catch (error) {
    console.warn('[XML CII Workflow 1] default master preload failed', error);
  }
}

function downloadText(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function handleWorkflow1Click(event, state) {
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
    scheduleRender(state, 'Switching Workflow 1 master table...');
  } else if (target.dataset.nativeLoadDefault) {
    await bridge?.loadPopupDefaultMaster?.(target.dataset.nativeLoadDefault);
    scheduleRender(state, 'Loaded default master. Refreshing Workflow 1...');
  } else if (target.dataset.nativeAutoMap) {
    bridge?.autoMapPopupMaster?.(target.dataset.nativeAutoMap);
    scheduleRender(state, 'Auto-mapped columns. Refreshing Workflow 1...');
  } else if (target.dataset.nativeSaveMaster) {
    bridge?.savePopupMaster?.(target.dataset.nativeSaveMaster);
    scheduleRender(state, 'Saved master rows. Refreshing Workflow 1...');
  } else if (target.dataset.nativeClearMaster) {
    bridge?.clearPopupMaster?.(target.dataset.nativeClearMaster);
    scheduleRender(state, 'Cleared master rows. Refreshing Workflow 1...');
  } else if (target.hasAttribute('data-native-build-preview')) {
    state.previewStatus = 'Building...';
    scheduleRender(state, 'Building Workflow 1 preview...');
    try {
      state.previewRows = await bridge?.buildPopupPreviewRows?.() || [];
      state.previewStatus = `Preview ready: ${state.previewRows.length} row(s)`;
    } catch (error) {
      state.previewStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Refreshing Workflow 1 preview...');
  } else if (target.hasAttribute('data-native-dry-run')) {
    state.diagnosticsStatus = 'Running...';
    scheduleRender(state, 'Running Workflow 1 diagnostics...');
    try {
      state.diagnosticsRows = await bridge?.runPopupDiagnostics?.() || [];
      state.diagnosticsStatus = `Done: ${state.diagnosticsRows.length} row(s)`;
    } catch (error) {
      state.diagnosticsStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Refreshing Workflow 1 diagnostics...');
  } else if (target.hasAttribute('data-native-compute-weights')) {
    state.weightStatus = 'Computing...';
    scheduleRender(state, 'Computing Workflow 1 weights...');
    try {
      state.weightRows = await bridge?.computePopupWeightRows?.() || [];
      state.weightStatus = `Ready: ${state.weightRows.length} row(s)`;
    } catch (error) {
      state.weightStatus = `Error: ${error?.message || error}`;
    }
    scheduleRender(state, 'Refreshing Workflow 1 weights...');
  } else if (target.hasAttribute('data-native-apply-preferred-weights')) {
    bridge?.applyPopupPreferredWeights?.(state.weightRows || []);
    state.weightStatus = `Applied ${(state.weightRows || []).length} preferred weight(s)`;
    scheduleRender(state, 'Applied Workflow 1 preferred weights...');
  } else if (target.hasAttribute('data-native-skip-weight-review')) {
    selectPhase(state, 'run');
  } else if (target.hasAttribute('data-native-review-weights')) {
    selectPhase(state, 'weight-match');
  } else if (target.hasAttribute('data-native-finalise-run')) {
    bridge?.closePopup?.();
    xmlCiiWorkflowRequestFinalRun(state.appRoot, 'workflow1');
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
    scheduleRender(state, 'Saved Workflow 1 config. Refreshing...');
  } else if (target.hasAttribute('data-native-export-config')) {
    downloadText('cii-enrichment-workflow1-config.json', bridge?.exportPopupConfigText?.() || '{}');
  }
}

async function handleWorkflow1Change(event, state) {
  const target = event.target;
  if (!target || !state.renderRoot?.contains(target)) return;
  const bridge = xmlCiiWorkflowGetBridge();
  if (target.matches('[data-native-regex-path]')) {
    bridge?.setPopupConfigValue?.(target.dataset.nativeRegexPath, target.value, target.type === 'number' ? 'number' : 'text');
    scheduleRender(state, 'Updating Workflow 1 regex configuration...');
  } else if (target.matches('[data-native-import-master]')) {
    const file = target.files?.[0];
    if (!file) return;
    await bridge?.importPopupMasterFile?.(target.dataset.nativeImportMaster, file);
    scheduleRender(state, 'Imported master. Refreshing Workflow 1...');
  } else if (target.matches('[data-native-field-map]')) {
    bridge?.setPopupMasterField?.(target.dataset.nativeMasterKey, target.dataset.nativeFieldMap, target.value);
    scheduleRender(state, 'Updated Workflow 1 field mapping...');
  } else if (target.matches('[data-native-run-option]')) {
    const value = target.type === 'checkbox' ? target.checked : target.value;
    bridge?.setPopupRunOption?.(target.dataset.nativeRunOption, value, target.type === 'checkbox' ? 'checkbox' : 'text');
    scheduleRender(state, 'Updated Workflow 1 run options...');
  } else if (target.matches('[data-native-config-bool]')) {
    const body = workflowBody(state);
    const textarea = body?.querySelector('[data-native-config-text]');
    state.configText = bridge?.savePopupConfigText?.(textarea?.value || '{}', { [target.dataset.nativeConfigBool]: target.checked }) || state.configText;
    state.configStatus = 'Saved';
    scheduleRender(state, 'Saved Workflow 1 config. Refreshing...');
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
    scheduleRender(state, 'Imported Workflow 1 config. Refreshing...');
  }
}

function handleWorkflow1Input(event, state) {
  const target = event.target;
  if (target?.matches?.('[data-native-config-text]') && state.renderRoot?.contains(target)) {
    state.configText = target.value;
    state.configStatus = 'Unsaved changes';
  }
}

function bindWorkflow1Body(body, state) {
  if (!body || body.dataset.xmlCiiWorkflow1BodyBound === WF1_CLICK_VERSION) return;
  body.addEventListener('click', (event) => { handleWorkflow1Click(event, state); }, { capture: true });
  body.addEventListener('change', (event) => { handleWorkflow1Change(event, state); }, { capture: true });
  body.addEventListener('input', (event) => { handleWorkflow1Input(event, state); }, { capture: true });
  body.dataset.xmlCiiWorkflow1BodyBound = WF1_CLICK_VERSION;
}

function openWorkflow1Popup(container) {
  const bridge = xmlCiiWorkflowGetBridge();
  if (!bridge) return;
  const appRoot = container?.querySelector?.('.model-converters-root') || container;
  const state = stateFor(appRoot);
  state.modal?.close?.();
  closeOtherXmlCiiWorkflowOverlays();
  const modal = new WorkflowModal({
    title: 'XML->CII(2019) Workflow 1',
    subtitle: 'Baseline workflow to import masters, map fields, inspect diagnostics, and run enriched CII conversion.',
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
  modal.overlayEl?.setAttribute(WF1_OVERLAY_ATTR, 'true');
  modal.overlayEl?.setAttribute('data-xml-cii-workflow-mode', 'workflow1');
  body.setAttribute(WF1_BODY_ROOT_ATTR, 'true');
  body.setAttribute('data-xml-cii-workflow-mode', 'workflow1');
  body.innerHTML = '<div data-xml-cii-workflow-body></div>';
  bindWorkflow1Body(body, state);
  setDatasets(body, state);
  bridge.closePopup = () => state.modal?.close?.();
  renderNow(state);
  preloadDefaultMasters(state);
  setTimeout(() => closeOtherXmlCiiWorkflowOverlays(modal.overlayEl), 0);
}

function bindWorkflow1Launcher(container) {
  const root = container?.querySelector?.('.model-converters-root') || container;
  if (!root || root.dataset.xmlCiiWorkflow1StandaloneBound === WF1_CLICK_VERSION) return;
  root.addEventListener('click', (event) => {
    const target = event.target?.closest?.(WF1_LAUNCHER_SELECTOR);
    if (!target || !root.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openWorkflow1Popup(root);
  }, { capture: true });
  root.dataset.xmlCiiWorkflow1StandaloneBound = WF1_CLICK_VERSION;
}

export function installXmlCiiWorkflowPopup(container = document) {
  if (!browserReady()) return;
  runtime();
  bindWorkflow1Launcher(container);
}
