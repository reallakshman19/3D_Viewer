import { WorkflowModal } from './shared/WorkflowModal.js';
import { OLD_XML_CII_WORKFLOW_PHASES, oldPhaseDetailHtml } from './xml-cii-conversion-workflow-direct-panels.js';
import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260619-phase-bridge-1';

const FLAG = '__xmlCiiConversionWorkflowPopup_direct_v9';
const ROOT_ATTR = 'data-xml-cii-workflow-root';
const ACTIVE_TAB_KEY = 'xmlCii2019.conversionWorkflow.activePhase.v3';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';
const XML_CII_CONVERTER_IDS = new Set(['xml_to_cii', 'inputxml_to_cii2019', 'xml_to_cii2019', 'inputxml_to_cii_2019', 'xml-cii-2019']);

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readStored(key, fallback = '') {
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

function rootElement(root = document) {
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

function stateForRoot(root = document) {
  const element = rootElement(root);
  const rt = runtime();
  let state = rt.stateByRoot.get(element);
  if (!state) {
    state = {
      modal: null,
      body: null,
      activeTab: OLD_XML_CII_WORKFLOW_PHASES[0].id,
      selectElement: null,
      refreshButton: null,
    };
    rt.stateByRoot.set(element, state);
  }
  // Auto-heal: cleanupBodyLevelWorkflowOverlays removes the overlay from the
  // DOM without calling modal.close(), leaving a stale state.modal reference.
  // Detect this by checking isConnected and reset so the next click opens fresh.
  if (state.modal && !state.modal.overlayEl?.isConnected) {
    state.modal = null;
    state.body = null;
  }
  return state;
}

function activeConverterSelect(root = document) {
  return root.querySelector?.('#model-converters-select') || document.querySelector('#model-converters-select');
}

function normalizeConverterToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s→]+/g, '').replace(/[-_]+/g, '_');
}

function activeConverterId(root = document) {
  return activeConverterSelect(root)?.value || '';
}

function isXmlCiiActive(root = document) {
  const select = activeConverterSelect(root);
  if (!select) return false;

  const id = activeConverterId(root);
  if (XML_CII_CONVERTER_IDS.has(id)) return true;
  if (XML_CII_CONVERTER_IDS.has(normalizeConverterToken(id))) return true;

  const optionText = select.selectedOptions?.[0]?.textContent || '';
  const normalized = normalizeConverterToken(`${id} ${optionText}`);
  return normalized.includes('xml') && normalized.includes('cii') && normalized.includes('2019');
}

function safeScrollTo(node) {
  try {
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  } catch {
    node?.scrollIntoView?.();
  }
}

function openExistingXmlCiiPhase(root, phaseId) {
  const workflow =
    root.querySelector?.('#model-converters-xml-cii-workflow') ||
    document.querySelector('#model-converters-xml-cii-workflow');

  if (!workflow) return false;

  workflow.dataset.selectedPhase = phaseId || 'regex';
  const details = workflow.tagName === 'DETAILS' ? workflow : workflow.closest?.('details');
  if (details) details.open = true;
  safeScrollTo(workflow);
  return true;
}

function dispatchDirectRun(root) {
  const runButton = root.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return false;

  window[DIRECT_RUN_FLAG] = true;
  try {
    runButton.click();
  } finally {
    setTimeout(() => {
      window[DIRECT_RUN_FLAG] = false;
    }, 0);
  }
  return true;
}

function bindPhaseActions(body, root, state) {
  body.querySelectorAll('[data-direct-process-phase]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openExistingXmlCiiPhase(root, btn.getAttribute('data-direct-process-phase') || 'regex');
    });
  });
  body.querySelectorAll('[data-direct-run-conversion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (dispatchDirectRun(root)) state.modal?.close();
    });
  });
}

function renderActiveTab(root, state) {
  if (!state.body) return;

  const phaseId = state.activeTab || OLD_XML_CII_WORKFLOW_PHASES[0].id;
  const bridge = getXmlCiiPhaseBridge();
  if (bridge) {
    bridge.renderPhaseInto(state.body, phaseId);
  } else {
    // Fallback: static summary (bridge not ready — model converters tab not yet mounted)
    state.body.innerHTML = oldPhaseDetailHtml(phaseId, root);
    bindPhaseActions(state.body, root, state);
  }
}

function openConversionWorkflow(root = document, state = stateForRoot(root)) {
  if (!browserReady() || !isXmlCiiActive(root)) return;

  if (state.modal) {
    renderActiveTab(root, state);
    return;
  }

  const stored = readStored(ACTIVE_TAB_KEY, OLD_XML_CII_WORKFLOW_PHASES[0].id);
  const validPhase = OLD_XML_CII_WORKFLOW_PHASES.some((p) => p.id === stored);
  state.activeTab = validPhase ? stored : OLD_XML_CII_WORKFLOW_PHASES[0].id;

  state.modal = new WorkflowModal({
    title: 'XML→CII(2019) Workflow',
    tabs: OLD_XML_CII_WORKFLOW_PHASES,
    activeTabId: state.activeTab,
    onTabChange: (tabId) => {
      state.activeTab = tabId;
      writeStored(ACTIVE_TAB_KEY, tabId);
      renderActiveTab(root, state);
    },
    onClose: () => {
      state.modal = null;
      state.body = null;
    },
  });

  state.body = state.modal.open();
  renderActiveTab(root, state);
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

function ensureWorkflowButton(root, state = stateForRoot(root)) {
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
    quickButton.textContent = 'Open XML→CII Workflow';
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
