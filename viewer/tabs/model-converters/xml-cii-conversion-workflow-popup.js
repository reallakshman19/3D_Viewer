import { WorkflowModal } from './shared/WorkflowModal.js';
import {
  renderXmlCiiWorkflowMatchedAuditPanel,
  renderXmlCiiWorkflowModelDataPanel,
  renderXmlCiiWorkflowOutputRunPanel,
  renderXmlCiiWorkflowProcessEnrichmentPanel,
} from './xml-cii-conversion-workflow-direct-panels.js';

const FLAG = '__xmlCiiConversionWorkflowPopup_direct_v2';
const ACTIVE_TAB_KEY = 'xmlCii2019.conversionWorkflow.activeTab.v1';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';
const WORKFLOW_TABS = Object.freeze([
  { id: 'xml-model-data', label: 'XML - Model Data', state: 'Model' },
  { id: 'process-enrichment', label: 'Process / Piping Class / Wt. Enrichment', state: 'Existing' },
  { id: 'matched-audit', label: 'Matched Audit', state: 'Audit' },
  { id: 'output-run', label: 'Output / Run Conversion', state: 'Run' },
]);

function browserReady() { return typeof window !== 'undefined' && typeof document !== 'undefined'; }
function text(v) { return v == null ? '' : String(v); }
function readStored(k, f = '') { try { return window.localStorage.getItem(k) ?? f; } catch { return f; } }
function writeStored(k, v) { try { window.localStorage.setItem(k, v); } catch {} }
function activeConverterId(root = document) { return root.querySelector?.('#model-converters-select')?.value || ''; }
function isXmlCiiActive(root = document) { return activeConverterId(root) === 'xml_to_cii'; }
function safeScrollTo(node) { try { node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); } catch { node?.scrollIntoView?.(); } }
function openExistingXmlCiiPhase(root, phaseId) {
  const workflow = root.querySelector?.('#model-converters-xml-cii-workflow') || document.querySelector('#model-converters-xml-cii-workflow');
  if (!workflow) return false;
  workflow.dataset.selectedPhase = phaseId;
  const details = workflow.tagName === 'DETAILS' ? workflow : workflow.closest?.('details');
  if (details) details.open = true;
  safeScrollTo(workflow);
  return true;
}
function scrollToSelector(root, selector) {
  const node = root.querySelector?.(selector) || document.querySelector(selector);
  if (!node) return false;
  const details = node.tagName === 'DETAILS' ? node : node.closest?.('details');
  if (details) details.open = true;
  safeScrollTo(node);
  return true;
}
function dispatchDirectRun(root) {
  const runButton = root.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return false;
  window[DIRECT_RUN_FLAG] = true;
  try { runButton.click(); } finally { setTimeout(() => { window[DIRECT_RUN_FLAG] = false; }, 0); }
  return true;
}
function renderActiveTab(root, state) {
  if (!state.body) return;
  const tabId = state.activeTab || WORKFLOW_TABS[0].id;
  if (tabId === 'process-enrichment') {
    renderXmlCiiWorkflowProcessEnrichmentPanel(state.body, root, {
      openPhase: (phaseId) => openExistingXmlCiiPhase(root, phaseId),
    });
  } else if (tabId === 'matched-audit') {
    renderXmlCiiWorkflowMatchedAuditPanel(state.body);
  } else if (tabId === 'output-run') {
    renderXmlCiiWorkflowOutputRunPanel(state.body, root, {
      run: () => { if (dispatchDirectRun(root)) state.modal?.close(); },
      showOutput: () => scrollToSelector(root, '#model-converters-output'),
    });
  } else {
    renderXmlCiiWorkflowModelDataPanel(state.body, root);
  }
}
function openConversionWorkflow(root = document, state) {
  if (!browserReady()) return;
  if (state.modal) { renderActiveTab(root, state); return; }
  const active = readStored(ACTIVE_TAB_KEY, 'xml-model-data');
  state.activeTab = WORKFLOW_TABS.some((t) => t.id === active) ? active : 'xml-model-data';
  state.modal = new WorkflowModal({
    title: 'XML → CII (2019) Conversion Workflow',
    subtitle: 'Integrated popup: XML model data, side-load audit, existing enrichment phases, matched audit, and final CII generation.',
    tabs: WORKFLOW_TABS,
    activeTabId: state.activeTab,
    onTabChange: (tabId) => {
      state.activeTab = tabId;
      writeStored(ACTIVE_TAB_KEY, tabId);
      renderActiveTab(root, state);
    },
    onClose: () => { state.modal = null; state.body = null; },
  });
  state.body = state.modal.open();
  renderActiveTab(root, state);
}
function ensureWorkflowButton(root, state) {
  const runButton = root.querySelector?.('#model-converters-run');
  if (!runButton) return;
  const xmlActive = isXmlCiiActive(root);
  let quickButton = root.querySelector('[data-xml-cii-open-conversion-workflow]');
  if (!quickButton) {
    quickButton = document.createElement('button');
    quickButton.type = 'button';
    quickButton.className = 'model-converters-download-btn';
    quickButton.dataset.xmlCiiOpenConversionWorkflow = 'true';
    quickButton.textContent = 'Open XML→CII Workflow';
    quickButton.style.cssText = 'width:100%;padding:10px;margin-top:6px;';
    quickButton.addEventListener('click', () => openConversionWorkflow(root, state));
    runButton.parentElement?.insertBefore(quickButton, runButton);
  }
  quickButton.hidden = !xmlActive;
  quickButton.disabled = !xmlActive;
}
export function installXmlCiiConversionWorkflowPopup(container = document) {
  if (!browserReady() || window[FLAG]) return;
  window[FLAG] = true;
  const root = container || document;
  const state = { modal: null, body: null, activeTab: 'xml-model-data' };
  const interceptRun = (event) => {
    const runButton = event.target?.closest?.('#model-converters-run');
    if (!runButton) return;
    if (window[DIRECT_RUN_FLAG]) return;
    if (!isXmlCiiActive(root)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openConversionWorkflow(root, state);
  };
  document.addEventListener('click', interceptRun, true);
  ensureWorkflowButton(root, state);
  root.querySelector?.('#model-converters-select')?.addEventListener('change', () => ensureWorkflowButton(root, state));
}
