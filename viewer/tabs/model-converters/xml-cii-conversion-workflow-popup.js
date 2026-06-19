/**
 * Installs the XML->CII(2019) workflow popup shown from Model Converters.
 *
 * Inputs: a rendered Model Converters container with the converter select and
 * run button. Output: the required phase-tab modal (`1 Regex` through
 * `7 Config`) with popup-native phase bodies backed by XML->CII bridge data
 * and action methods. Fallback: if the bridge is unavailable, an explicit
 * backend-unavailable panel is shown; legacy inline workflow HTML is never
 * rendered inside this popup.
 */
import { WorkflowModal } from './shared/WorkflowModal.js';
import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260619-git-ss-adapt-8';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260619-git-ss-adapt-1';
import { XML_CII_WORKFLOW_PHASES, normalizeWorkflowPhaseId } from './WorkflowShell.js';

const FLAG = '__xmlCiiConversionWorkflowPopup_phaseTabs_v1';
const ROOT_ATTR = 'data-xml-cii-workflow-root';
const ACTIVE_PHASE_KEY = 'xmlCii2019.conversionWorkflow.activePhase.v4';
const LEGACY_ACTIVE_PHASE_KEY = 'xmlCii2019.conversionWorkflow.activePhase.v3';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';
const XML_CII_CONVERTER_IDS = new Set(['xml_to_cii', 'xml_to_cii2019', 'xml-cii-2019']);

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readStored(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function runtime() {
  if (!window[FLAG]) {
    window[FLAG] = {
      documentClickInstalled: false,
      stateByRoot: new WeakMap(),
    };
  }
  return window[FLAG];
}

function rootElement(root) {
  return root && root.nodeType === 1 ? root : document;
}

function markRoot(root) {
  const element = rootElement(root);
  if (element !== document) element.setAttribute(ROOT_ATTR, 'true');
  return element;
}

function rootForNode(node) {
  return node?.closest?.(`[${ROOT_ATTR}]`) || document;
}

function initialPhaseId() {
  const current = readStored(ACTIVE_PHASE_KEY, '');
  if (current) return normalizeWorkflowPhaseId(current);
  return normalizeWorkflowPhaseId(readStored(LEGACY_ACTIVE_PHASE_KEY, XML_CII_WORKFLOW_PHASES[0].id));
}

function stateForRoot(root) {
  const element = rootElement(root);
  const rt = runtime();
  let state = rt.stateByRoot.get(element);
  if (!state) {
    state = {
      modal: null,
      body: null,
      activePhase: XML_CII_WORKFLOW_PHASES[0].id,
      activeMaster: 'linelist',
      defaultMastersPromise: null,
      selectElement: null,
      refreshButton: null,
      previewRows: [],
      previewStatus: '',
      diagnosticsRows: [],
      diagnosticsStatus: '',
      weightRows: [],
      weightStatus: '',
      configText: null,
      configStatus: '',
    };
    rt.stateByRoot.set(element, state);
  }

  if (state.modal && !state.modal.overlayEl?.isConnected) {
    state.modal = null;
    state.body = null;
  }
  return state;
}

function activeConverterSelect(root) {
  return root.querySelector?.('#model-converters-select') || document.querySelector('#model-converters-select');
}

function normalizeConverterToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[>\u2192]+/g, '')
    .replace(/[-_]+/g, '_');
}

function activeConverterId(root) {
  return activeConverterSelect(root)?.value || '';
}

function isXmlCiiActive(root) {
  const select = activeConverterSelect(root);
  if (!select) return false;

  const id = activeConverterId(root);
  if (XML_CII_CONVERTER_IDS.has(id)) return true;
  if (XML_CII_CONVERTER_IDS.has(normalizeConverterToken(id))) return true;

  const optionText = select.selectedOptions?.[0]?.textContent || '';
  const normalized = normalizeConverterToken(`${id} ${optionText}`);
  if (normalized.includes('inputxml')) return false;
  return normalized.includes('xml') && normalized.includes('cii') && normalized.includes('2019');
}

function armDirectRunGuard() {
  window[DIRECT_RUN_FLAG] = true;
  setTimeout(() => {
    window[DIRECT_RUN_FLAG] = false;
  }, 0);
}

function dispatchDirectRun(root) {
  const runButton = root.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return false;

  armDirectRunGuard();
  runButton.click();
  return true;
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function configBoolsFromBody(body) {
  const out = {};
  body.querySelectorAll('[data-native-config-bool]').forEach((input) => {
    out[input.getAttribute('data-native-config-bool')] = !!input.checked;
  });
  return out;
}

function bindNativePhaseActions(root, state, bridge, phaseId) {
  const body = state.body;
  if (!body) return;
  const rerender = () => renderPhase(root, state);

  body.querySelectorAll('[data-native-regex-path]').forEach((input) => {
    const save = () => {
      bridge.setPopupConfigValue?.(input.getAttribute('data-native-regex-path') || '', input.value, input.type);
      rerender();
    };
    input.addEventListener('change', save);
  });

  body.querySelectorAll('[data-native-master-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeMaster = button.getAttribute('data-native-master-tab') || 'linelist';
      body.dataset.xmlCiiActiveMaster = state.activeMaster;
      rerender();
    });
  });

  body.querySelectorAll('[data-native-import-master]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const masterKey = input.getAttribute('data-native-import-master') || 'linelist';
      try {
        await bridge.importPopupMasterFile?.(masterKey, file);
      } catch (err) {
        console.warn('XML->CII workflow: master import failed', err);
      } finally {
        input.value = '';
        rerender();
      }
    });
  });

  body.querySelectorAll('[data-native-load-default]').forEach((button) => {
    button.addEventListener('click', async () => {
      const masterKey = button.getAttribute('data-native-load-default') || '';
      button.disabled = true;
      try {
        await bridge.loadPopupDefaultMaster?.(masterKey);
      } catch (err) {
        console.warn('XML->CII workflow: default master load failed', err);
      } finally {
        rerender();
      }
    });
  });

  body.querySelectorAll('[data-native-auto-map]').forEach((button) => {
    button.addEventListener('click', () => {
      bridge.autoMapPopupMaster?.(button.getAttribute('data-native-auto-map') || 'linelist');
      rerender();
    });
  });

  body.querySelectorAll('[data-native-field-map]').forEach((select) => {
    select.addEventListener('change', () => {
      bridge.setPopupMasterField?.(
        select.getAttribute('data-native-master-key') || state.activeMaster || 'linelist',
        select.getAttribute('data-native-field-map') || '',
        select.value,
      );
      rerender();
    });
  });

  body.querySelectorAll('[data-native-save-master]').forEach((button) => {
    button.addEventListener('click', () => {
      bridge.savePopupMaster?.(button.getAttribute('data-native-save-master') || 'linelist');
      rerender();
    });
  });

  body.querySelectorAll('[data-native-clear-master]').forEach((button) => {
    button.addEventListener('click', () => {
      bridge.clearPopupMaster?.(button.getAttribute('data-native-clear-master') || 'linelist');
      rerender();
    });
  });

  body.querySelector('[data-native-build-preview]')?.addEventListener('click', async () => {
    state.previewStatus = 'Building preview...';
    try {
      const rows = await bridge.buildPopupPreviewRows?.();
      state.previewRows = Array.isArray(rows) ? rows : [];
      state.previewStatus = `${state.previewRows.length} branch row(s)`;
    } catch (err) {
      state.previewRows = [];
      state.previewStatus = String(err?.message || err);
    } finally {
      rerender();
    }
  });

  body.querySelector('[data-native-dry-run]')?.addEventListener('click', async () => {
    state.diagnosticsStatus = 'Running...';
    try {
      const rows = await bridge.runPopupDiagnostics?.();
      state.diagnosticsRows = Array.isArray(rows) ? rows : [];
      state.diagnosticsStatus = `Done - ${state.diagnosticsRows.length} row(s)`;
    } catch (err) {
      state.diagnosticsRows = [];
      state.diagnosticsStatus = String(err?.message || err);
    } finally {
      rerender();
    }
  });

  body.querySelector('[data-native-compute-weights]')?.addEventListener('click', async () => {
    state.weightStatus = 'Computing...';
    try {
      const rows = await bridge.computePopupWeightRows?.();
      state.weightRows = Array.isArray(rows) ? rows : [];
      state.weightStatus = `${state.weightRows.length} weight candidate row(s)`;
    } catch (err) {
      state.weightRows = [];
      state.weightStatus = String(err?.message || err);
    } finally {
      rerender();
    }
  });

  body.querySelector('[data-native-apply-preferred-weights]')?.addEventListener('click', () => {
    bridge.applyPopupPreferredWeights?.(state.weightRows || []);
    state.weightStatus = 'Preferred weights applied';
    rerender();
  });

  body.querySelector('[data-native-skip-weight-review]')?.addEventListener('click', () => {
    if (dispatchDirectRun(root)) state.modal?.close();
  });

  body.querySelectorAll('[data-native-run-option]').forEach((input) => {
    input.addEventListener('change', () => {
      bridge.setPopupRunOption?.(
        input.getAttribute('data-native-run-option') || '',
        input.type === 'checkbox' ? input.checked : input.value,
        input.type,
      );
      rerender();
    });
  });

  body.querySelector('[data-native-review-weights]')?.addEventListener('click', () => openPhase(root, state, 'weight-match'));
  body.querySelector('[data-native-finalise-run]')?.addEventListener('click', () => {
    if (dispatchDirectRun(root)) state.modal?.close();
  });

  body.querySelector('[data-native-open-support-table]')?.addEventListener('click', () => {
    bridge.renderPopupSupportTable?.(body.querySelector('[data-native-support-host]'));
  });

  const configText = body.querySelector('[data-native-config-text]');
  if (configText) {
    configText.addEventListener('input', () => {
      state.configText = configText.value;
      state.configStatus = 'Unsaved changes';
    });
  }

  body.querySelector('[data-native-save-config]')?.addEventListener('click', () => {
    try {
      const nextText = bridge.savePopupConfigText?.(configText?.value || '{}', configBoolsFromBody(body));
      state.configText = nextText || null;
      state.configStatus = 'Saved';
    } catch (err) {
      state.configStatus = `JSON error: ${String(err?.message || err)}`;
    } finally {
      rerender();
    }
  });

  body.querySelector('[data-native-export-config]')?.addEventListener('click', () => {
    downloadTextFile('cii-enrichment-config.json', bridge.exportPopupConfigText?.() || '{}', 'application/json');
  });

  body.querySelector('[data-native-import-config]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      bridge.importPopupConfigText?.(await file.text());
      state.configText = null;
      state.configStatus = `Imported ${file.name}`;
    } catch (err) {
      state.configStatus = `Import failed: ${String(err?.message || err)}`;
    } finally {
      event.target.value = '';
      rerender();
    }
  });

  if (phaseId !== 'config') {
    state.configText = null;
    state.configStatus = '';
  }
}

function renderPhase(root, state) {
  if (!state.body) return;

  const phaseId = normalizeWorkflowPhaseId(state.activePhase);
  state.activePhase = phaseId;
  const bridge = getXmlCiiPhaseBridge();

  if (!bridge || typeof bridge.getPopupSnapshot !== 'function') {
    state.body.innerHTML = `
      <div class="model-converters-workflow-detail-title">Workflow backend unavailable</div>
      <div class="model-converters-workflow-detail-note">Open the Model Converters tab once, then reopen XML-&gt;CII Workflow.</div>`;
    return;
  }

  try {
    state.body.dataset.xmlCiiActiveMaster = state.activeMaster || 'linelist';
    const snapshot = bridge.getPopupSnapshot(state.body);
    state.body.innerHTML = renderXmlCiiPopupNativePhase(phaseId, snapshot, state);
    bindNativePhaseActions(root, state, bridge, phaseId);
  } catch (err) {
    console.warn('XML->CII workflow: popup-native render failed', err);
    state.body.innerHTML = `<div class="model-converters-workflow-detail-note">Unable to render this phase: ${String(err?.message || err)}</div>`;
  }
}

function preloadDefaultMasters(root, state) {
  const bridge = getXmlCiiPhaseBridge();
  if (!bridge || typeof bridge.ensureDefaultMastersLoaded !== 'function') return;
  if (state.defaultMastersPromise) return;

  const preloadTarget = state.modal?.overlayEl || root;
  state.defaultMastersPromise = Promise.resolve(bridge.ensureDefaultMastersLoaded(preloadTarget))
    .catch((err) => {
      console.warn('XML->CII workflow: default master preload failed', err);
    })
    .finally(() => {
      state.defaultMastersPromise = null;
      if (state.modal) renderPhase(root, state);
    });
}

function openPhase(root, state, phaseId) {
  state.activePhase = normalizeWorkflowPhaseId(phaseId);
  writeStored(ACTIVE_PHASE_KEY, state.activePhase);
  state.modal?.setActiveTab(state.activePhase);
  renderPhase(root, state);
}

function openConversionWorkflow(root = document, state = stateForRoot(root)) {
  if (!browserReady() || !isXmlCiiActive(root)) return;

  if (state.modal) {
    renderPhase(root, state);
    return;
  }

  state.activePhase = initialPhaseId();

  state.modal = new WorkflowModal({
    title: 'XML->CII(2019) Workflow',
    subtitle: 'Import masters, map fields, and maintain manual overrides in a standalone-ready config.',
    tabs: XML_CII_WORKFLOW_PHASES,
    activeTabId: state.activePhase,
    onTabChange: (tabId) => openPhase(root, state, tabId),
    onClose: () => {
      const bridge = getXmlCiiPhaseBridge();
      if (bridge) {
        bridge.switchPhase = null;
        bridge.closePopup = null;
      }
      state.modal = null;
      state.body = null;
    },
  });

  state.body = state.modal.open();
  renderPhase(root, state);
  preloadDefaultMasters(root, state);

  const bridge = getXmlCiiPhaseBridge();
  if (bridge) {
    bridge.switchPhase = (phaseId) => {
      if (!state.modal) return;
      openPhase(root, state, phaseId);
    };
    bridge.closePopup = () => {
      // The bridge closes the popup immediately before re-clicking Run.
      armDirectRunGuard();
      state.modal?.close();
    };
  }
}

function removeWorkflowButton(root) {
  root.querySelectorAll?.('[data-xml-cii-open-conversion-workflow]').forEach((button) => button.remove());
}

function applyWorkflowButtonVisibility(quickButton, xmlActive) {
  quickButton.hidden = !xmlActive;
  quickButton.disabled = !xmlActive;
  quickButton.style.display = xmlActive ? '' : 'none';
  quickButton.setAttribute('aria-hidden', xmlActive ? 'false' : 'true');
}

function ensureWorkflowButton(root, state) {
  const runButton = root.querySelector?.('#model-converters-run');
  if (!runButton) return;

  const xmlActive = isXmlCiiActive(root);
  let quickButton = root.querySelector('[data-xml-cii-open-conversion-workflow]');

  if (!xmlActive) {
    removeWorkflowButton(root);
    state.modal?.close?.();
    return;
  }

  if (!quickButton) {
    quickButton = document.createElement('button');
    quickButton.type = 'button';
    quickButton.className = 'model-converters-download-btn';
    quickButton.dataset.xmlCiiOpenConversionWorkflow = 'true';
    quickButton.textContent = 'XML->CII Simple Workflow';
    quickButton.style.cssText = 'width:100%;padding:10px;margin-top:6px;';
    quickButton.addEventListener('click', () => {
      if (isXmlCiiActive(root)) openConversionWorkflow(root, state);
    });
    runButton.parentElement?.insertBefore(quickButton, runButton);
  }

  applyWorkflowButtonVisibility(quickButton, xmlActive);
}

function installDocumentRunIntercept() {
  const rt = runtime();
  if (rt.documentClickInstalled) return;

  const interceptRun = (event) => {
    const runButton = event.target?.closest?.('#model-converters-run');
    if (!runButton) return;
    if (window[DIRECT_RUN_FLAG]) return;

    const root = rootForNode(runButton);
    if (!isXmlCiiActive(root)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openConversionWorkflow(root, stateForRoot(root));
  };

  document.addEventListener('click', interceptRun, true);
  rt.documentClickInstalled = true;
}

export function installXmlCiiConversionWorkflowPopup(container = document) {
  if (!browserReady()) return;

  const root = markRoot(container || document);
  const state = stateForRoot(root);
  installDocumentRunIntercept();

  const refreshButton = () => setTimeout(() => ensureWorkflowButton(root, state), 0);
  const select = activeConverterSelect(root);
  if (state.selectElement !== select) {
    state.selectElement?.removeEventListener?.('change', state.refreshButton);
    state.selectElement = select || null;
    state.refreshButton = refreshButton;
    select?.addEventListener('change', refreshButton);
  }

  ensureWorkflowButton(root, state);
  setTimeout(() => ensureWorkflowButton(root, state), 0);
  setTimeout(() => ensureWorkflowButton(root, state), 150);
}
