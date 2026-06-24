/**
 * XML->CII(2019) Rich Workflow popup.
 *
 * This module owns only the rich phase-tab popup. It does not restore or bind
 * the simple/direct Run Conversion button; that belongs to
 * xml-cii-simple-workflow-controller.js.
 */

import { WorkflowModal } from './shared/WorkflowModal.js';
import { xmlCiiRichWorkflowGetBridge, xmlCiiRichWorkflowGetSnapshot } from './xml-cii-rich-workflow-bridge.js?v=20260624-simple-rich-isolation-1';
import { xmlCiiRichWorkflowRequestFinalRun } from './xml-cii-rich-workflow-runner.js?v=20260624-simple-rich-isolation-1';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260623-inst-length-info-simple-run-1';
import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js';

const XML_CII_RICH_WORKFLOW_FLAG = '__xmlCiiRichWorkflowPopup_phaseTabs_v4';
const XML_CII_RICH_WORKFLOW_ROOT_ATTR = 'data-xml-cii-rich-workflow-root';
const XML_CII_RICH_WORKFLOW_OVERLAY_ATTR = 'data-xml-cii-rich-workflow-overlay';
const XML_CII_RICH_WORKFLOW_ACTIVE_PHASE_KEY = 'xmlCii2019.richWorkflow.activePhase.v1';
const XML_CII_RICH_WORKFLOW_LEGACY_ACTIVE_PHASE_KEY = 'xmlCii2019.conversionWorkflow.activePhase.v4';
const XML_CII_RICH_WORKFLOW_CLICK_VERSION = '20260624-popup-identity-1';

function xmlCiiRichWorkflowBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function xmlCiiRichWorkflowReadStored(key, fallback) {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function xmlCiiRichWorkflowWriteStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function xmlCiiRichWorkflowRuntime() {
  if (!window[XML_CII_RICH_WORKFLOW_FLAG]) {
    window[XML_CII_RICH_WORKFLOW_FLAG] = { stateByRoot: new WeakMap() };
  }
  return window[XML_CII_RICH_WORKFLOW_FLAG];
}

function xmlCiiRichWorkflowNormalizePhase(id) {
  return normalizeWorkflowPhaseId(id || xmlCiiRichWorkflowReadStored(
    XML_CII_RICH_WORKFLOW_ACTIVE_PHASE_KEY,
    xmlCiiRichWorkflowReadStored(XML_CII_RICH_WORKFLOW_LEGACY_ACTIVE_PHASE_KEY, 'regex'),
  ));
}

function xmlCiiRichWorkflowState(root) {
  const runtime = xmlCiiRichWorkflowRuntime();
  let state = runtime.stateByRoot.get(root);
  if (!state) {
    state = {
      phaseId: xmlCiiRichWorkflowNormalizePhase(root?.dataset?.selectedPhase),
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
    runtime.stateByRoot.set(root, state);
  }
  return state;
}

function xmlCiiRichWorkflowSnapshot(root) {
  return xmlCiiRichWorkflowGetSnapshot(root);
}

function xmlCiiRichWorkflowRenderPhase(root, state) {
  const body = root?.querySelector('[data-xml-cii-rich-workflow-body]');
  if (!body) return;
  const data = xmlCiiRichWorkflowSnapshot(root);
  if (!data) {
    body.innerHTML = '<div class="model-converters-workflow-detail-note">XML->CII Rich Workflow bridge is not ready. Reopen the Model Converter tab and try again.</div>';
    return;
  }
  state.activeMaster = root.dataset.xmlCiiRichActiveMaster || state.activeMaster || 'linelist';
  body.innerHTML = renderXmlCiiPopupNativePhase(state.phaseId, data, state);
  xmlCiiRichWorkflowBindPhase(body, root, state);
}

function xmlCiiRichWorkflowSelectPhase(root, state, phaseId) {
  state.phaseId = xmlCiiRichWorkflowNormalizePhase(phaseId);
  root.dataset.selectedPhase = state.phaseId;
  xmlCiiRichWorkflowWriteStored(XML_CII_RICH_WORKFLOW_ACTIVE_PHASE_KEY, state.phaseId);
  const modal = state.modal;
  if (modal?.setActiveTab) modal.setActiveTab(state.phaseId);
  xmlCiiRichWorkflowRenderPhase(root, state);
}

async function xmlCiiRichWorkflowPreloadDefaultMasters(root, state) {
  try {
    await xmlCiiRichWorkflowGetBridge()?.ensureDefaultMastersLoaded?.(root);
    xmlCiiRichWorkflowRenderPhase(root, state);
  } catch (error) {
    console.warn('[XML CII Rich Workflow] default master preload failed', error);
  }
}

function xmlCiiRichWorkflowBindRegex(body, root, state) {
  body.querySelectorAll('[data-native-regex-path]').forEach((input) => {
    input.addEventListener('change', () => {
      xmlCiiRichWorkflowGetBridge()?.setPopupConfigValue?.(input.dataset.nativeRegexPath, input.value, input.type === 'number' ? 'number' : 'text');
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
}

function xmlCiiRichWorkflowBindMasters(body, root, state) {
  body.querySelectorAll('[data-native-master-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.dataset.xmlCiiRichActiveMaster = button.dataset.nativeMasterTab || 'linelist';
      state.activeMaster = root.dataset.xmlCiiRichActiveMaster;
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-import-master]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      await xmlCiiRichWorkflowGetBridge()?.importPopupMasterFile?.(input.dataset.nativeImportMaster, file);
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-load-default]').forEach((button) => {
    button.addEventListener('click', async () => {
      await xmlCiiRichWorkflowGetBridge()?.loadPopupDefaultMaster?.(button.dataset.nativeLoadDefault);
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-auto-map]').forEach((button) => {
    button.addEventListener('click', () => {
      xmlCiiRichWorkflowGetBridge()?.autoMapPopupMaster?.(button.dataset.nativeAutoMap);
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-save-master]').forEach((button) => {
    button.addEventListener('click', () => {
      xmlCiiRichWorkflowGetBridge()?.savePopupMaster?.(button.dataset.nativeSaveMaster);
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-clear-master]').forEach((button) => {
    button.addEventListener('click', () => {
      xmlCiiRichWorkflowGetBridge()?.clearPopupMaster?.(button.dataset.nativeClearMaster);
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelectorAll('[data-native-field-map]').forEach((select) => {
    select.addEventListener('change', () => {
      xmlCiiRichWorkflowGetBridge()?.setPopupMasterField?.(select.dataset.nativeMasterKey, select.dataset.nativeFieldMap, select.value);
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
}

function xmlCiiRichWorkflowBindPreview(body, root, state) {
  body.querySelector('[data-native-build-preview]')?.addEventListener('click', async () => {
    state.previewStatus = 'Building...';
    xmlCiiRichWorkflowRenderPhase(root, state);
    try {
      state.previewRows = await xmlCiiRichWorkflowGetBridge()?.buildPopupPreviewRows?.() || [];
      state.previewStatus = `Preview ready: ${state.previewRows.length} row(s)`;
    } catch (error) {
      state.previewStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiRichWorkflowRenderPhase(root, state);
  });
}

function xmlCiiRichWorkflowBindDiagnostics(body, root, state) {
  body.querySelector('[data-native-dry-run]')?.addEventListener('click', async () => {
    state.diagnosticsStatus = 'Running...';
    xmlCiiRichWorkflowRenderPhase(root, state);
    try {
      state.diagnosticsRows = await xmlCiiRichWorkflowGetBridge()?.runPopupDiagnostics?.() || [];
      state.diagnosticsStatus = `Done: ${state.diagnosticsRows.length} row(s)`;
    } catch (error) {
      state.diagnosticsStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiRichWorkflowRenderPhase(root, state);
  });
}

function xmlCiiRichWorkflowBindWeight(body, root, state) {
  body.querySelector('[data-native-compute-weights]')?.addEventListener('click', async () => {
    state.weightStatus = 'Computing...';
    xmlCiiRichWorkflowRenderPhase(root, state);
    try {
      state.weightRows = await xmlCiiRichWorkflowGetBridge()?.computePopupWeightRows?.() || [];
      state.weightStatus = `Ready: ${state.weightRows.length} row(s)`;
    } catch (error) {
      state.weightStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiRichWorkflowRenderPhase(root, state);
  });
  body.querySelector('[data-native-apply-preferred-weights]')?.addEventListener('click', () => {
    xmlCiiRichWorkflowGetBridge()?.applyPopupPreferredWeights?.(state.weightRows || []);
    state.weightStatus = `Applied ${state.weightRows.length} preferred weight(s)`;
    xmlCiiRichWorkflowRenderPhase(root, state);
  });
  body.querySelector('[data-native-skip-weight-review]')?.addEventListener('click', () => xmlCiiRichWorkflowSelectPhase(root, state, 'run'));
}

function xmlCiiRichWorkflowBindRun(body, root, state) {
  body.querySelectorAll('[data-native-run-option]').forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.type === 'checkbox' ? input.checked : input.value;
      xmlCiiRichWorkflowGetBridge()?.setPopupRunOption?.(input.dataset.nativeRunOption, value, input.type === 'checkbox' ? 'checkbox' : 'text');
      xmlCiiRichWorkflowRenderPhase(root, state);
    });
  });
  body.querySelector('[data-native-review-weights]')?.addEventListener('click', () => xmlCiiRichWorkflowSelectPhase(root, state, 'weight-match'));
  body.querySelector('[data-native-finalise-run]')?.addEventListener('click', () => {
    xmlCiiRichWorkflowGetBridge()?.closePopup?.();
    xmlCiiRichWorkflowRequestFinalRun(root);
  });
}

function xmlCiiRichWorkflowBindSupport(body) {
  body.querySelector('[data-native-open-support-table]')?.addEventListener('click', () => {
    xmlCiiRichWorkflowGetBridge()?.renderPopupSupportTable?.(body.querySelector('[data-native-support-host]'));
  });
}

function xmlCiiRichWorkflowBindConfig(body, root, state) {
  const textarea = body.querySelector('[data-native-config-text]');
  body.querySelectorAll('[data-native-config-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      const bools = { [input.dataset.nativeConfigBool]: input.checked };
      state.configText = xmlCiiRichWorkflowGetBridge()?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
      xmlCiiRichWorkflowRenderPhase(root, state);
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
      state.configText = xmlCiiRichWorkflowGetBridge()?.savePopupConfigText?.(textarea?.value || '{}', bools) || state.configText;
      state.configStatus = 'Saved';
    } catch (error) {
      state.configStatus = `Error: ${error?.message || error}`;
    }
    xmlCiiRichWorkflowRenderPhase(root, state);
  });
  body.querySelector('[data-native-export-config]')?.addEventListener('click', () => {
    const configText = xmlCiiRichWorkflowGetBridge()?.exportPopupConfigText?.() || '{}';
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
      xmlCiiRichWorkflowGetBridge()?.importPopupConfigText?.(await file.text());
      state.configText = null;
      state.configStatus = `Imported ${file.name}`;
    } catch (error) {
      state.configStatus = `Import failed: ${error?.message || error}`;
    }
    xmlCiiRichWorkflowRenderPhase(root, state);
  });
}

function xmlCiiRichWorkflowBindPhase(body, root, state) {
  xmlCiiRichWorkflowBindRegex(body, root, state);
  xmlCiiRichWorkflowBindMasters(body, root, state);
  if (state.phaseId === 'preview') xmlCiiRichWorkflowBindPreview(body, root, state);
  if (state.phaseId === 'diagnostics') xmlCiiRichWorkflowBindDiagnostics(body, root, state);
  if (state.phaseId === 'weight-match') xmlCiiRichWorkflowBindWeight(body, root, state);
  if (state.phaseId === 'run') xmlCiiRichWorkflowBindRun(body, root, state);
  if (state.phaseId === 'support-mapper') xmlCiiRichWorkflowBindSupport(body);
  if (state.phaseId === 'config') xmlCiiRichWorkflowBindConfig(body, root, state);
}

function xmlCiiRichWorkflowCloseForeignXmlCiiWorkflowOverlays(exceptOverlay = null) {
  document.querySelectorAll('.model-converters-workflow-popup-overlay').forEach((overlay) => {
    if (overlay === exceptOverlay) return;
    const title = overlay.querySelector('.model-converters-workflow-popup-title')?.textContent || '';
    const body = overlay.textContent || '';
    const isXmlCiiWorkflow = /XML\s*[-–>]*\s*>?\s*CII\(2019\)/i.test(title) || (/XML\s*[-–>]*\s*>?\s*CII\(2019\)/i.test(body) && /Workflow/i.test(body));
    if (isXmlCiiWorkflow) overlay.remove();
  });
}

function xmlCiiRichWorkflowOpenPopup(container) {
  const activeBridge = xmlCiiRichWorkflowGetBridge();
  if (!activeBridge) return;
  const state = xmlCiiRichWorkflowState(container);
  state.modal?.close?.();
  xmlCiiRichWorkflowCloseForeignXmlCiiWorkflowOverlays();

  const modal = new WorkflowModal({
    title: 'XML->CII(2019) Rich Workflow',
    subtitle: 'Canonical rich workflow: import masters, map fields, inspect diagnostics, review weights/supports, and run enriched CII conversion.',
    tabs: XML_CII_WORKFLOW_PHASES,
    activeTabId: state.phaseId,
    onTabChange: (phaseId) => xmlCiiRichWorkflowSelectPhase(container, state, phaseId),
    onClose: () => {
      state.modal = null;
      activeBridge.closePopup = null;
    },
  });
  const body = modal.open();
  state.modal = modal;
  modal.overlayEl?.setAttribute(XML_CII_RICH_WORKFLOW_OVERLAY_ATTR, 'true');
  body.setAttribute(XML_CII_RICH_WORKFLOW_ROOT_ATTR, 'true');
  body.innerHTML = '<div data-xml-cii-rich-workflow-body></div>';
  activeBridge.closePopup = () => {
    state.modal?.close();
  };
  xmlCiiRichWorkflowRenderPhase(body, state);
  xmlCiiRichWorkflowPreloadDefaultMasters(body, state);
  setTimeout(() => xmlCiiRichWorkflowCloseForeignXmlCiiWorkflowOverlays(modal.overlayEl), 0);
}

function xmlCiiRichWorkflowOpenFromButtonClick(event, container) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  xmlCiiRichWorkflowOpenPopup(container.querySelector?.('.model-converters-root') || container);
}

export function installXmlCiiRichWorkflowPopup(container = document) {
  if (!xmlCiiRichWorkflowBrowserReady()) return;
  xmlCiiRichWorkflowRuntime();
  const richButton = container.querySelector?.('#model-converters-xml-cii-rich-btn');
  if (richButton && richButton.dataset.xmlCiiRichWorkflowPopupBound !== XML_CII_RICH_WORKFLOW_CLICK_VERSION) {
    richButton.addEventListener('click', (event) => xmlCiiRichWorkflowOpenFromButtonClick(event, container), { capture: true });
    richButton.dataset.xmlCiiRichWorkflowPopupBound = XML_CII_RICH_WORKFLOW_CLICK_VERSION;
  }
}
