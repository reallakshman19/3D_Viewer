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
import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-rating-runtime-1';
import { renderXmlCiiPopupNativePhase } from './xml-cii-popup-native-panels.js?v=20260620-rating-runtime-1';
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
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
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

function resolveRoot(container) {
  return container?.querySelector?.('[data-model-converters-root]')
    || container?.querySelector?.('.model-converters-panel')
    || container;
}

function activeConverterId(root) {
  return root?.querySelector?.('#model-converters-select')?.value || '';
}

function isXmlCiiActive(root) {
  return XML_CII_CONVERTER_IDS.has(activeConverterId(root));
}

function getOrCreateState(root) {
  const rt = runtime();
  let state = rt.stateByRoot.get(root);
  if (!state) {
    state = { modal: null, activePhase: readStored(ACTIVE_PHASE_KEY, 'regex') };
    rt.stateByRoot.set(root, state);
  }
  return state;
}

function renderModalBody(root, state) {
  const bridge = getXmlCiiPhaseBridge?.();
  const phaseId = normalizeWorkflowPhaseId(state.activePhase || 'regex');
  state.activePhase = phaseId;
  writeStored(ACTIVE_PHASE_KEY, phaseId);

  if (!state.detailEl) return;
  if (!bridge) {
    state.detailEl.innerHTML = '<div class="model-converters-workflow-detail-title">Workflow unavailable</div><div class="model-converters-workflow-detail-note">XML->CII workflow bridge is not ready.</div>';
    return;
  }

  state.detailEl.innerHTML = renderXmlCiiPopupNativePhase(phaseId, bridge);
  try {
    bridge.bindPhaseActions?.(phaseId, state.detailEl, root);
  } catch (error) {
    console.warn('[XML_CII_WORKFLOW_POPUP] bind failed', error);
  }
}

function openWorkflow(root) {
  if (!browserReady() || !root) return;
  const state = getOrCreateState(root);
  if (state.modal) {
    state.modal.overlayEl?.remove?.();
    state.modal = null;
    state.detailEl = null;
  }

  const modal = new WorkflowModal({
    title: 'XML->CII(2019) Workflow',
    subtitle: 'Import masters, map fields, and maintain manual overrides in a standalone-ready config.',
    tabs: XML_CII_WORKFLOW_PHASES,
    activeTabId: state.activePhase,
    onTabChange: (phaseId) => {
      state.activePhase = normalizeWorkflowPhaseId(phaseId);
      renderModalBody(root, state);
    },
    onClose: () => {
      state.modal = null;
      state.detailEl = null;
    },
  });

  state.modal = modal;
  state.detailEl = modal.open();
  state.modal.overlayEl?.setAttribute(ROOT_ATTR, 'true');
  renderModalBody(root, state);
}

function installDocumentClick(container) {
  const rt = runtime();
  if (rt.documentClickInstalled) return;
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('#model-converters-xml-cii-rich-btn, [data-xml-cii-open-workflow], [data-open-xml-cii-workflow]');
    if (!button) return;
    const root = resolveRoot(container) || resolveRoot(button.closest?.('[data-model-converters-root]')) || button.closest?.('.model-converters-panel');
    if (!root || !isXmlCiiActive(root)) return;
    event.preventDefault();
    event.stopPropagation();
    openWorkflow(root);
  }, true);
  rt.documentClickInstalled = true;
}

function installSelectWatcher(root) {
  const select = root?.querySelector?.('#model-converters-select');
  if (!select || select.dataset.xmlCiiWorkflowSelectWatcher === 'true') return;
  select.addEventListener('change', () => {
    if (!isXmlCiiActive(root)) {
      const state = getOrCreateState(root);
      state.modal?.close?.();
    }
  });
  select.dataset.xmlCiiWorkflowSelectWatcher = 'true';
}

export function installXmlCiiConversionWorkflowPopup(container) {
  if (!browserReady()) return;
  const root = resolveRoot(container);
  if (!root) return;
  installDocumentClick(container);
  installSelectWatcher(root);

  // Migrate the older stored active phase once. This keeps user position stable
  // after the native popup replaced the legacy inline workflow.
  try {
    const oldValue = window.localStorage.getItem(LEGACY_ACTIVE_PHASE_KEY);
    if (oldValue && !window.localStorage.getItem(ACTIVE_PHASE_KEY)) {
      window.localStorage.setItem(ACTIVE_PHASE_KEY, normalizeWorkflowPhaseId(oldValue));
    }
  } catch {}

  // Some legacy handlers still guard direct run clicks. The popup owns the
  // workflow, so keep this flag explicit for the run-button path.
  window[DIRECT_RUN_FLAG] = true;
}
