/**
 * XML->CII(2019) Workflow 1 / Workflow 2 popups.
 *
 * This module owns only the popup launchers for the two explicit XML->CII
 * workflow buttons in the Model Converters left panel:
 * - Workflow 1: baseline enriched conversion inspection/run sequence.
 * - Workflow 2: enhanced customisation sequence for process data and weight data.
 *
 * Both workflows use the same conversion/enrichment core. UI mode only controls
 * the popup presentation and master-preview detail level.
 */

import { WorkflowModal } from './shared/WorkflowModal.js';
import { xmlCiiWorkflowGetBridge, xmlCiiWorkflowGetSnapshot } from './xml-cii-workflow-bridge.js?v=20260624-workflow1-workflow2-1';
import { xmlCiiWorkflowRequestFinalRun } from './xml-cii-workflow-runner.js?v=20260624-workflow1-workflow2-1';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260624-workflow1-workflow2-1';
import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js';

const XML_CII_WORKFLOW_POPUP_FLAG = '__xmlCiiWorkflowPopups_phaseTabs_v6';
const XML_CII_WORKFLOW_ROOT_ATTR = 'data-xml-cii-workflow-root';
const XML_CII_WORKFLOW_OVERLAY_ATTR = 'data-xml-cii-workflow-overlay';
const XML_CII_WORKFLOW_ACTIVE_PHASE_KEY = 'xmlCii2019.workflow.activePhase.v1';
const XML_CII_WORKFLOW_LEGACY_ACTIVE_PHASE_KEY = 'xmlCii2019.richWorkflow.activePhase.v1';
const XML_CII_WORKFLOW_CLICK_VERSION = '20260624-workflow1-workflow2-1';

const XML_CII_WORKFLOW_POPUP_META = Object.freeze({
  workflow1: Object.freeze({
    title: 'XML->CII(2019) Workflow 1',
    subtitle: 'Import masters, map fields, inspect diagnostics, and run enriched CII conversion.',
    buttonSelector: '#model-converters-xml-cii-workflow1-btn',
    legacyButtonSelector: '#model-converters-xml-cii-simple-btn',
    boundDatasetKey: 'xmlCiiWorkflow1PopupBound',
  }),
  workflow2: Object.freeze({
    title: 'XML->CII(2019) Workflow 2',
    subtitle: 'Import masters, map fields, and maintain manual overrides in a standalone-ready config.',
    buttonSelector: '#model-converters-xml-cii-workflow2-btn',
    legacyButtonSelector: '#model-converters-xml-cii-rich-btn',
    boundDatasetKey: 'xmlCiiWorkflow2PopupBound',
  }),
});

function xmlCiiWorkflowBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function xmlCiiWorkflowReadStored(key, fallback) {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function xmlCiiWorkflowWriteStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function xmlCiiWorkflowRuntime() {
  if (!window[XML_CII_WORKFLOW_POPUP_FLAG]) {
    window[XML_CII_WORKFLOW_POPUP_FLAG] = { stateByRoot: new WeakMap() };
  }
  return window[XML_CII_WORKFLOW_POPUP_FLAG];
}

function xmlCiiWorkflowNormalizePhase(id) {
  return normalizeWorkflowPhaseId(id || xmlCiiWorkflowReadStored(
    XML_CII_WORKFLOW_ACTIVE_PHASE_KEY,
    xmlCiiWorkflowReadStored(XML_CII_WORKFLOW_LEGACY_ACTIVE_PHASE_KEY, 'regex'),
  ));
}

function xmlCiiWorkflowState(root) {
  const runtime = xmlCiiWorkflowRuntime();
  let state = runtime.stateByRoot.get(root);
  if (!state) {
    state = {
      phaseId: xmlCiiWorkflowNormalizePhase(root?.dataset?.selectedPhase),
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
      mode: 'workflow2',
    };
    runtime.stateByRoot.set(root, state);
  }
  return state;
}

function xmlCiiWorkflowSnapshot(root) {
  return xmlCiiWorkflowGetSnapshot(root);
}

function xmlCiiWorkflowRenderPhase(root, state) {
  const body = root?.querySelector('[data-xml-cii-workflow-body]');
  if (!body) return;
  const data = xmlCiiWorkflowSnapshot(root);
  if (!data) {
    body.innerHTML = '<div class="model-converters-workflow-detail-note">XML->CII workflow bridge is not ready. Reopen the Model Converter tab and try again.</div>';
    return;
  }
  state.activeMaster = root.dataset.xmlCiiActiveMaster || state.activeMaster || 'linelist';
  body.innerHTML = renderXmlCiiPopupNativePhase(state.phaseId, data, state);
  xmlCiiWorkflowBindPhase(body, root, state);
}

function xmlCiiWorkflowSelectPhase(root, state, phaseId) {
  state.phaseId = xmlCiiWorkflowNormalizePhase(phaseId);
  root.dataset.selectedPhase = state.phaseId;
  xmlCiiWorkflowWriteStored(XML_CII_WORKFLOW_ACTIVE_PHASE_KEY, state.phaseId);
  const modal = state.modal;
  if (modal?.setActiveTab) modal.setActiveTab(state.phaseId);
  xmlCiiWorkflowRenderPhase(root, state);
}

async function xmlCiiWorkflowPreloadDefaultMasters(root, state) {
  try {
    await xmlCiiWorkflowGetBridge()?.ensureDefaultMastersLoaded?.(root);
    xmlCiiWorkflowRenderPhase(root, state);
  } catch (error) {
    console.warn('[XML CII Workflow] default master preload failed', error);
  }
}

function xmlCiiWorkflowBindRegex(body, root, state) {
  body.querySelectorAll('[data-native-regex-path]').forEach((input) => {
    input.addEventListener('change', () => {
      xmlCiiWorkflowGetBridge()?.setPopupConfigValue?.(input.dataset.nativeRegexPath, input.value, input.type === 'number' ? 'number' : 'text');
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
}

function xmlCiiWorkflowBindMasters(body, root, state) {
  body.querySelectorAll('[data-native-master-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.dataset.xmlCiiActiveMaster = button.dataset.nativeMasterTab || 'linelist';
      state.activeMaster = root.dataset.xmlCiiActiveMaster;
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-import-master]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      await xmlCiiWorkflowGetBridge()?.importPopupMasterFile?.(input.dataset.nativeImportMaster, file);
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-load-default]').forEach((button) => {
    button.addEventListener('click', async () => {
      await xmlCiiWorkflowGetBridge()?.loadPopupDefaultMaster?.(button.dataset.nativeLoadDefault);
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-auto-map]').forEach((button) => {
    button.addEventListener('click', () => {
      xmlCiiWorkflowGetBridge()?.autoMapPopupMaster?.(button.dataset.nativeAutoMap);
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-save-master]').forEach((button) => {
    button.addEventListener('click', () => {
      xmlCiiWorkflowGetBridge()?.savePopupMaster?.(button.dataset.nativeSaveMaster);
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-clear-master]').forEach((button) => {
    button.addEventListener('click', () => {
      xmlCiiWorkflowGetBridge()?.clearPopupMaster?.(button.dataset.nativeClearMaster);
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-field-map]').forEach((select) => {
    select.addEventListener('change', () => {
      xmlCiiWorkflowGetBridge()?.setPopupMasterField?.(select.dataset.nativeMasterKey, select.dataset.nativeFieldMap, select.value);
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
}

function xmlCiiWorkflowBindPreview(body, root, state) {
  body.querySelector('[data-native-build-preview]')?.addEventListener('click', async () => {
    state.previewStatus = 'Building...';
    xmlCiiWorkflowRenderPhase(root, state);
    try {
      state.previewRows = await xmlCiiWorkflowGetBridge()?.buildPopupPreviewRows?.() || [];
      state.previewStatus = `Preview ready: ${state.previewRows.length} row(s)`;
    } catch (error) {
      state.previewStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiWorkflowRenderPhase(root, state);
  });
}

function xmlCiiWorkflowBindDiagnostics(body, root, state) {
  body.querySelector('[data-native-dry-run]')?.addEventListener('click', async () => {
    state.diagnosticsStatus = 'Running...';
    xmlCiiWorkflowRenderPhase(root, state);
    try {
      state.diagnosticsRows = await xmlCiiWorkflowGetBridge()?.runPopupDiagnostics?.() || [];
      state.diagnosticsStatus = `Done: ${state.diagnosticsRows.length} row(s)`;
    } catch (error) {
      state.diagnosticsStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiWorkflowRenderPhase(root, state);
  });
}

function xmlCiiWorkflowBindWeight(body, root, state) {
  body.querySelector('[data-native-compute-weights]')?.addEventListener('click', async () => {
    state.weightStatus = 'Computing...';
    xmlCiiWorkflowRenderPhase(root, state);
    try {
      state.weightRows = await xmlCiiWorkflowGetBridge()?.computePopupWeightRows?.() || [];
      state.weightStatus = `Ready: ${state.weightRows.length} row(s)`;
    } catch (error) {
      state.weightStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiWorkflowRenderPhase(root, state);
  });
  body.querySelector('[data-native-apply-preferred-weights]')?.addEventListener('click', () => {
    xmlCiiWorkflowGetBridge()?.applyPopupPreferredWeights?.(state.weightRows || []);
    state.weightStatus = `Applied ${state.weightRows.length} preferred weight(s)`;
    xmlCiiWorkflowRenderPhase(root, state);
  });
  body.querySelector('[data-native-skip-weight-review]')?.addEventListener('click', () => xmlCiiWorkflowSelectPhase(root, state, 'run'));
}

function xmlCiiWorkflowBindRun(body, root, state) {
  body.querySelectorAll('[data-native-run-option]').forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.type === 'checkbox' ? input.checked : input.value;
      xmlCiiWorkflowGetBridge()?.setPopupRunOption?.(input.dataset.nativeRunOption, value, input.type === 'checkbox' ? 'checkbox' : 'text');
      xmlCiiWorkflowRenderPhase(root, state);
    });
  });
  body.querySelector('[data-native-review-weights]')?.addEventListener('click', () => xmlCiiWorkflowSelectPhase(root, state, 'weight-match'));
  body.querySelector('[data-native-finalise-run]')?.addEventListener('click', () => {
    xmlCiiWorkflowGetBridge()?.closePopup?.();
    xmlCiiWorkflowRequestFinalRun(root, state.mode);
  });
}

function xmlCiiWorkflowBindSupport(body) {
  body.querySelector('[data-native-open-support-table]')?.addEventListener('click', () => {
    xmlCiiWorkflowGetBridge()?.renderPopupSupportTable?.(body.querySelector('[data-native-support-host]'));
  });
}

function xmlCiiWorkflowBindConfig(body, root, state) {
  const textarea = body.querySelector('[data-native-config-text]');
  body.querySelectorAll('[data-native-config-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      const bools = { [input.dataset.nativeConfigBool]: input.checked };
      state.configText = xmlCiiWorkflowGetBridge()?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
      xmlCiiWorkflowRenderPhase(root, state);
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
      state.configText = xmlCiiWorkflowGetBridge()?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
    } catch (error) {
      state.configStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiWorkflowRenderPhase(root, state);
  });
  body.querySelector('[data-native-export-config]')?.addEventListener('click', () => {
    const configText = xmlCiiWorkflowGetBridge()?.exportPopupConfigText?.() || '{}';
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
      xmlCiiWorkflowGetBridge()?.importPopupConfigText?.(await file.text());
      state.configText = null;
      state.configStatus = `Imported ${file.name}`;
    } catch (error) {
      state.configStatus = `Import failed: ${error?.message || error}`;
    }
    xmlCiiWorkflowRenderPhase(root, state);
  });
}

function xmlCiiWorkflowBindPhase(body, root, state) {
  xmlCiiWorkflowBindRegex(body, root, state);
  xmlCiiWorkflowBindMasters(body, root, state);
  if (state.phaseId === 'preview') xmlCiiWorkflowBindPreview(body, root, state);
  if (state.phaseId === 'diagnostics') xmlCiiWorkflowBindDiagnostics(body, root, state);
  if (state.phaseId === 'weight-match') xmlCiiWorkflowBindWeight(body, root, state);
  if (state.phaseId === 'run') xmlCiiWorkflowBindRun(body, root, state);
  if (state.phaseId === 'support-mapper') xmlCiiWorkflowBindSupport(body);
  if (state.phaseId === 'config') xmlCiiWorkflowBindConfig(body, root, state);
}

function xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays(exceptOverlay = null) {
  document.querySelectorAll('.model-converters-workflow-popup-overlay').forEach((overlay) => {
    if (overlay === exceptOverlay) return;
    const title = overlay.querySelector('.model-converters-workflow-popup-title')?.textContent || '';
    const body = overlay.textContent || '';
    const isXmlCiiWorkflow = /XML\s*[-–>]*\s*>?\s*CII\(2019\)/i.test(title) || (/XML\s*[-–>]*\s*>?\s*CII\(2019\)/i.test(body) && /Workflow/i.test(body));
    if (isXmlCiiWorkflow) overlay.remove();
  });
}

function xmlCiiWorkflowPopupMeta(mode) {
  return XML_CII_WORKFLOW_POPUP_META[mode] || XML_CII_WORKFLOW_POPUP_META.workflow2;
}

function xmlCiiWorkflowOpenPopup(container, mode = 'workflow2') {
  const activeBridge = xmlCiiWorkflowGetBridge();
  if (!activeBridge) return;
  const state = xmlCiiWorkflowState(container);
  state.mode = mode === 'workflow1' ? 'workflow1' : 'workflow2';
  state.modal?.close?.();
  xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays();
  const meta = xmlCiiWorkflowPopupMeta(state.mode);

  const modal = new WorkflowModal({
    title: meta.title,
    subtitle: meta.subtitle,
    tabs: XML_CII_WORKFLOW_PHASES,
    activeTabId: state.phaseId,
    onTabChange: (phaseId) => xmlCiiWorkflowSelectPhase(container, state, phaseId),
    onClose: () => {
      state.modal = null;
      activeBridge.closePopup = null;
    },
  });
  const body = modal.open();
  state.modal = modal;
  modal.overlayEl?.setAttribute(XML_CII_WORKFLOW_OVERLAY_ATTR, 'true');
  modal.overlayEl?.setAttribute('data-xml-cii-workflow-mode', state.mode);
  body.setAttribute(XML_CII_WORKFLOW_ROOT_ATTR, 'true');
  body.setAttribute('data-xml-cii-workflow-mode', state.mode);
  body.innerHTML = '<div data-xml-cii-workflow-body></div>';
  activeBridge.closePopup = () => {
    state.modal?.close();
  };
  xmlCiiWorkflowRenderPhase(body, state);
  xmlCiiWorkflowPreloadDefaultMasters(body, state);
  setTimeout(() => xmlCiiWorkflowCloseForeignXmlCiiWorkflowOverlays(modal.overlayEl), 0);
}

function xmlCiiWorkflowOpenFromButtonClick(event, container, mode) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  xmlCiiWorkflowOpenPopup(container.querySelector?.('.model-converters-root') || container, mode);
}

function xmlCiiWorkflowBindLauncher(container, mode) {
  const meta = xmlCiiWorkflowPopupMeta(mode);
  const button = container.querySelector?.(meta.buttonSelector) || container.querySelector?.(meta.legacyButtonSelector);
  if (!button || button.dataset[meta.boundDatasetKey] === XML_CII_WORKFLOW_CLICK_VERSION) return;
  button.addEventListener('click', (event) => xmlCiiWorkflowOpenFromButtonClick(event, container, mode), { capture: true });
  button.dataset[meta.boundDatasetKey] = XML_CII_WORKFLOW_CLICK_VERSION;
}

export function installXmlCiiWorkflowPopup(container = document) {
  if (!xmlCiiWorkflowBrowserReady()) return;
  xmlCiiWorkflowRuntime();
  xmlCiiWorkflowBindLauncher(container, 'workflow1');
  xmlCiiWorkflowBindLauncher(container, 'workflow2');
}
