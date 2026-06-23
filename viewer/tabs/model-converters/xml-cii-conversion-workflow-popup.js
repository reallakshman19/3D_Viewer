/**
 * Installs the XML->CII(2019) workflow popup shown from Model Converters.
 *
 * The main Run Conversion button is intentionally left as the simple/direct
 * workflow. Only the XML->CII Rich Workflow button opens this phase-tab popup.
 */
import { WorkflowModal } from './shared/WorkflowModal.js';
import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260623-inst-length-info-simple-run-1';
import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js';

const FLAG = '__xmlCiiConversionWorkflowPopup_phaseTabs_v2';
const ROOT_ATTR = 'data-xml-cii-workflow-root';
const ACTIVE_PHASE_KEY = 'xmlCii2019.conversionWorkflow.activePhase.v4';
const LEGACY_ACTIVE_PHASE_KEY = 'xmlCii2019.conversionWorkflow.activePhase.v3';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';

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
  if (!window[FLAG]) {
    window[FLAG] = {
      stateByRoot: new WeakMap(),
    };
  }
  return window[FLAG];
}

function normalizePhase(id) {
  return normalizeWorkflowPhaseId(id || readStored(ACTIVE_PHASE_KEY, readStored(LEGACY_ACTIVE_PHASE_KEY, 'regex')));
}

function bridge() {
  return getXmlCiiPhaseBridge?.() || null;
}

function snapshot(root) {
  const activeBridge = bridge();
  return activeBridge?.getPopupSnapshot?.(root) || null;
}

function getState(root) {
  const rt = runtime();
  let state = rt.stateByRoot.get(root);
  if (!state) {
    state = {
      phaseId: normalizePhase(root?.dataset?.selectedPhase),
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
    };
    rt.stateByRoot.set(root, state);
  }
  return state;
}

function renderPhase(root, state) {
  const body = root?.querySelector('[data-xml-cii-workflow-body]');
  if (!body) return;
  const data = snapshot(root);
  if (!data) {
    body.innerHTML = '<div class="model-converters-workflow-detail-note">XML->CII workflow bridge is not ready. Reopen the Model Converter tab and try again.</div>';
    return;
  }
  state.activeMaster = root.dataset.xmlCiiActiveMaster || state.activeMaster || 'linelist';
  body.innerHTML = renderXmlCiiPopupNativePhase(state.phaseId, data, state);
  bindPhase(body, root, state);
}

function selectPhase(root, state, phaseId) {
  state.phaseId = normalizePhase(phaseId);
  root.dataset.selectedPhase = state.phaseId;
  writeStored(ACTIVE_PHASE_KEY, state.phaseId);
  const modal = state.modal;
  if (modal?.setActiveTab) modal.setActiveTab(state.phaseId);
  renderPhase(root, state);
}

async function preloadDefaultMasters(root, state) {
  try {
    await bridge()?.ensureDefaultMastersLoaded?.(root);
    renderPhase(root, state);
  } catch (error) {
    console.warn('[XML CII popup] default master preload failed', error);
  }
}

function bindRegex(body, root, state) {
  body.querySelectorAll('[data-native-regex-path]').forEach((input) => {
    input.addEventListener('change', () => {
      bridge()?.setPopupConfigValue?.(input.dataset.nativeRegexPath, input.value, input.type === 'number' ? 'number' : 'text');
      renderPhase(root, state);
    });
  });
}

function bindMasters(body, root, state) {
  body.querySelectorAll('[data-native-master-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.dataset.xmlCiiActiveMaster = button.dataset.nativeMasterTab || 'linelist';
      state.activeMaster = root.dataset.xmlCiiActiveMaster;
      renderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-import-master]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      await bridge()?.importPopupMasterFile?.(input.dataset.nativeImportMaster, file);
      renderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-load-default]').forEach((button) => {
    button.addEventListener('click', async () => {
      await bridge()?.loadPopupDefaultMaster?.(button.dataset.nativeLoadDefault);
      renderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-auto-map]').forEach((button) => {
    button.addEventListener('click', () => {
      bridge()?.autoMapPopupMaster?.(button.dataset.nativeAutoMap);
      renderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-save-master]').forEach((button) => {
    button.addEventListener('click', () => {
      bridge()?.savePopupMaster?.(button.dataset.nativeSaveMaster);
      renderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-clear-master]').forEach((button) => {
    button.addEventListener('click', () => {
      bridge()?.clearPopupMaster?.(button.dataset.nativeClearMaster);
      renderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-field-map]').forEach((select) => {
    select.addEventListener('change', () => {
      bridge()?.setPopupMasterField?.(select.dataset.nativeMasterKey, select.dataset.nativeFieldMap, select.value);
      renderPhase(root, state);
    });
  });
}

function bindPreview(body, root, state) {
  body.querySelector('[data-native-build-preview]')?.addEventListener('click', async () => {
    state.previewStatus = 'Building...';
    renderPhase(root, state);
    try {
      state.previewRows = await bridge()?.buildPopupPreviewRows?.() || [];
      state.previewStatus = `Preview ready: ${state.previewRows.length} row(s)`;
    } catch (error) {
      state.previewStatus = `Error: ${error?.message || error}`;
    }
    renderPhase(root, state);
  });
}

function bindDiagnostics(body, root, state) {
  body.querySelector('[data-native-dry-run]')?.addEventListener('click', async () => {
    state.diagnosticsStatus = 'Running...';
    renderPhase(root, state);
    try {
      state.diagnosticsRows = await bridge()?.runPopupDiagnostics?.() || [];
      state.diagnosticsStatus = `Done: ${state.diagnosticsRows.length} row(s)`;
    } catch (error) {
      state.diagnosticsStatus = `Error: ${error?.message || error}`;
    }
    renderPhase(root, state);
  });
}

function bindWeight(body, root, state) {
  body.querySelector('[data-native-compute-weights]')?.addEventListener('click', async () => {
    state.weightStatus = 'Computing...';
    renderPhase(root, state);
    try {
      state.weightRows = await bridge()?.computePopupWeightRows?.() || [];
      state.weightStatus = `Ready: ${state.weightRows.length} row(s)`;
    } catch (error) {
      state.weightStatus = `Error: ${error?.message || error}`;
    }
    renderPhase(root, state);
  });
  body.querySelector('[data-native-apply-preferred-weights]')?.addEventListener('click', () => {
    bridge()?.applyPopupPreferredWeights?.(state.weightRows || []);
    state.weightStatus = `Applied ${state.weightRows.length} preferred weight(s)`;
    renderPhase(root, state);
  });
  body.querySelector('[data-native-skip-weight-review]')?.addEventListener('click', () => selectPhase(root, state, 'run'));
}

function bindRun(body, root, state) {
  body.querySelectorAll('[data-native-run-option]').forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.type === 'checkbox' ? input.checked : input.value;
      bridge()?.setPopupRunOption?.(input.dataset.nativeRunOption, value, input.type === 'checkbox' ? 'checkbox' : 'text');
      renderPhase(root, state);
    });
  });
  body.querySelector('[data-native-review-weights]')?.addEventListener('click', () => selectPhase(root, state, 'weight-match'));
  body.querySelector('[data-native-finalise-run]')?.addEventListener('click', () => {
    bridge()?.closePopup?.();
    root.dispatchEvent(new CustomEvent('xml-cii-popup-finalise-run', { bubbles: true }));
    document.querySelector('#model-converters-run')?.click();
  });
}

function bindSupport(body) {
  body.querySelector('[data-native-open-support-table]')?.addEventListener('click', () => {
    bridge()?.renderPopupSupportTable?.(body.querySelector('[data-native-support-host]'));
  });
}

function bindConfig(body, root, state) {
  const textarea = body.querySelector('[data-native-config-text]');
  body.querySelectorAll('[data-native-config-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      const bools = { [input.dataset.nativeConfigBool]: input.checked };
      state.configText = bridge()?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
      renderPhase(root, state);
    });
  });
  textarea?.addEventListener('input', () => {
    state.configText = textarea.value;
    state.configStatus = 'Unsaved changes';
  });
  body.querySelector('[data-native-save-config]')?.addEventListener('click', () => {
    try {
      const bools = {};
      body.querySelectorAll('[data-native-config-bool]').forEach((input) => { bools[input.dataset.nativeConfigBool] = input.checked; });
      state.configText = bridge()?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
    } catch (error) {
      state.configStatus = `Error: ${error?.message || error}`;
    }
    renderPhase(root, state);
  });
  body.querySelector('[data-native-export-config]')?.addEventListener('click', () => {
    const configText = bridge()?.exportPopupConfigText?.() || '{}';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([configText], { type: 'application/json' }));
    a.download = 'cii-enrichment-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  body.querySelector('[data-native-import-config]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      bridge()?.importPopupConfigText?.(await file.text());
      state.configText = null;
      state.configStatus = `Imported ${file.name}`;
    } catch (error) {
      state.configStatus = `Import failed: ${error?.message || error}`;
    }
    renderPhase(root, state);
  });
}

function bindPhase(body, root, state) {
  bindRegex(body, root, state);
  bindMasters(body, root, state);
  if (state.phaseId === 'preview') bindPreview(body, root, state);
  if (state.phaseId === 'diagnostics') bindDiagnostics(body, root, state);
  if (state.phaseId === 'weight-match') bindWeight(body, root, state);
  if (state.phaseId === 'run') bindRun(body, root, state);
  if (state.phaseId === 'support-mapper') bindSupport(body, root, state);
  if (state.phaseId === 'config') bindConfig(body, root, state);
}

function openPopup(container) {
  const activeBridge = bridge();
  if (!activeBridge) return;
  const state = getState(container);
  const modal = new WorkflowModal({
    title: 'XML->CII(2019) Workflow',
    subtitle: 'Import masters, map fields, and maintain manual overrides in a standalone-ready config.',
    tabs: XML_CII_WORKFLOW_PHASES,
    activeTabId: state.phaseId,
    onTabChange: (phaseId) => selectPhase(container, state, phaseId),
    onClose: () => {
      state.modal = null;
      activeBridge.closePopup = null;
    },
  });
  const body = modal.open();
  state.modal = modal;
  body.setAttribute(ROOT_ATTR, 'true');
  body.innerHTML = '<div data-xml-cii-workflow-body></div>';
  activeBridge.closePopup = () => {
    state.modal?.close();
  };
  renderPhase(body, state);
  preloadDefaultMasters(body, state);
}

function restoreSimpleRunButton(container = document) {
  if (!browserReady()) return;
  // Permanent guard for stale cached popup modules that used to intercept the
  // main Run Conversion button. Rich Workflow remains bound to its own button.
  window[DIRECT_RUN_FLAG] = true;
  const runButton = container.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return;
  runButton.hidden = false;
  runButton.style.display = '';
  if (!String(runButton.textContent || '').trim()) runButton.textContent = 'Run Conversion';
}

export function installXmlCiiConversionWorkflowPopup(container = document) {
  if (!browserReady()) return;
  runtime();
  restoreSimpleRunButton(container);
  const richButton = container.querySelector?.('#model-converters-xml-cii-rich-btn');
  if (richButton && richButton.dataset.popupBound !== 'true') {
    richButton.addEventListener('click', () => openPopup(container.querySelector('.model-converters-root') || container));
    richButton.dataset.popupBound = 'true';
  }
}
