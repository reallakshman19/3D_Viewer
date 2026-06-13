import { WorkflowModal } from './shared/WorkflowModal.js';

const FLAG = '__xmlCiiConversionWorkflowPopup_v1';
const ACTIVE_TAB_KEY = 'xmlCii2019.conversionWorkflow.activeTab.v1';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';

const WORKFLOW_TABS = Object.freeze([
  { id: 'xml-model-data', label: 'XML - Model Data', state: 'Model' },
  { id: 'process-enrichment', label: 'Process / Piping Class / Wt. Enrichment', state: 'Existing' },
  { id: 'matched-audit', label: 'Matched Audit', state: 'Audit' },
  { id: 'output-run', label: 'Output / Run Conversion', state: 'Run' },
]);

const PROCESS_PHASES = Object.freeze([
  ['regex', 'Regex / Line Key', 'Branchname regex, line key, piping class, rating, and bore extraction.'],
  ['import-masters', 'Process / Piping Class / Material / Wt.', 'Existing master import and mapping workflow.'],
  ['preview', 'Enrichment Preview', 'Dry preview of branch enrichment and mapping quality.'],
  ['diagnostics', 'Diagnostics Dry Run', 'Existing XML→CII diagnostic run and issue table.'],
  ['weight-match', 'Weight Match', 'Review approximate rigid/valve weight matches before final run.'],
  ['support-mapper', 'Support Mapping', 'Existing support mapper rules and support-type classification.'],
  ['config', 'Config JSON', 'Full existing XML→CII enrichment configuration.'],
  ['run', 'Existing Run Step', 'Existing finalize/run workflow step.'],
]);

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function text(value) {
  return value == null ? '' : String(value);
}

function clean(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function esc(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readStored(key, fallback = '') {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function activeConverterId(root = document) {
  return root.querySelector?.('#model-converters-select')?.value || '';
}

function isXmlCiiActive(root = document) {
  return activeConverterId(root) === 'xml_to_cii';
}

function fileNameText(root, selector) {
  const input = root.querySelector?.(selector);
  const file = input?.files?.[0];
  return file?.name || 'No file selected';
}

function supportConfigHasSideload(root) {
  const raw = root.querySelector?.('[data-option-key="supportConfigJson"]')?.value || '';
  try {
    const cfg = JSON.parse(raw || '{}');
    return !!clean(cfg?.sideload?.restraintsText || '');
  } catch {
    return false;
  }
}

function statsCards(items) {
  return `<div class="model-converters-workflow-preview-grid">${items.map(([label, value]) => `
    <div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
  </div>`;
}

function tabIntro(title, textValue) {
  return `
    <div class="model-converters-workflow-detail-title">${esc(title)}</div>
    <div class="model-converters-workflow-detail-text">${esc(textValue)}</div>`;
}

function safeScrollTo(node) {
  try { node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); } catch { node?.scrollIntoView?.(); }
}

function restoreMount(state) {
  const mount = state.activeMount;
  if (!mount?.node) return;
  const { node, parent, next, placeholder } = mount;
  try {
    if (placeholder?.parentNode) {
      placeholder.parentNode.insertBefore(node, placeholder);
      placeholder.remove();
    } else if (parent) {
      parent.insertBefore(node, next && next.parentNode === parent ? next : null);
    }
  } catch {}
  state.activeMount = null;
}

function mountExistingPanel(state, selector, target, missingHtml) {
  restoreMount(state);
  const node = document.querySelector(selector);
  if (!node) {
    target.innerHTML = missingHtml;
    return false;
  }
  const parent = node.parentNode;
  const next = node.nextSibling;
  const placeholder = document.createComment(`xml-cii-workflow-popup-placeholder:${selector}`);
  parent?.insertBefore(placeholder, node);
  target.innerHTML = '';
  target.appendChild(node);
  if (node.tagName === 'DETAILS') node.open = true;
  state.activeMount = { selector, node, parent, next, placeholder };
  return true;
}

function dispatchDirectRun(root) {
  const runButton = root.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return false;
  window[DIRECT_RUN_FLAG] = true;
  runButton.click();
  setTimeout(() => { window[DIRECT_RUN_FLAG] = false; }, 0);
  return true;
}

function openExistingXmlCiiPhase(root, phaseId) {
  const workflow = root.querySelector?.('#model-converters-xml-cii-workflow') || document.querySelector('#model-converters-xml-cii-workflow');
  if (!workflow) return false;
  workflow.dataset.selectedPhase = phaseId;
  workflow.querySelector('summary')?.click();
  return true;
}

function processPhaseCards() {
  return `
    <div class="model-converters-workflow-master-tabs" style="margin-top:12px;">
      ${PROCESS_PHASES.map(([id, label, desc]) => `
        <button type="button" class="model-converters-workflow-master-tab" data-xml-cii-open-existing-phase="${esc(id)}">
          <span>${esc(label)}</span>
          <small>${esc(desc)}</small>
        </button>`).join('')}
    </div>`;
}

function renderXmlModelData(root, state) {
  state.body.innerHTML = `
    ${tabIntro('XML - Model Data', 'Load and audit XML model data, staged/source-like JSON, Node/PS/POS resolver indexes, and manual side-load rows before matched preview.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      ${statsCards([
        ['Primary XML', fileNameText(root, '#model-converters-primary-input')],
        ['Staged / JSON', fileNameText(root, '#model-converters-secondary-input')],
        ['Manual side-load saved', supportConfigHasSideload(root) ? 'Yes' : 'No'],
        ['Active converter', activeConverterId(root) || 'none'],
      ])}
      <div class="model-converters-workflow-detail-note">The side-load panel below is the same live panel already coded: Resolver Index, JSON Config, JSON Resolved Data, PS→Node, POS→Node, Restraints, and Diagnostics.</div>
    </div>
    <div data-xml-cii-popup-panel="sideload" style="margin-top:10px;"></div>`;

  const mountTarget = state.body.querySelector('[data-xml-cii-popup-panel="sideload"]');
  mountExistingPanel(state, '#model-converters-xml-cii-sideload', mountTarget, `
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-detail-title">Sideload panel not available yet</div>
      <div class="model-converters-workflow-detail-text">Select XML→CII(2019) and wait for the side-load UI to initialize.</div>
    </div>`);
}

function renderProcessEnrichment(root, state) {
  restoreMount(state);
  state.body.innerHTML = `
    ${tabIntro('Process / Piping Class / Wt. Enrichment', 'Existing XML→CII enrichment workflow is kept intact. Use these shortcuts to open the current Regex, master import, preview, diagnostics, support mapping, config, and run phases.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      <div class="model-converters-workflow-section-title">Existing XML→CII workflow shortcuts</div>
      <div class="model-converters-workflow-detail-text">No converter logic is duplicated here. Each tile opens the existing workflow phase with the current loaded XML, staged JSON, and supportConfigJson state.</div>
      ${processPhaseCards()}
    </div>`;
  state.body.querySelectorAll('[data-xml-cii-open-existing-phase]').forEach((button) => {
    button.addEventListener('click', () => {
      const phaseId = button.getAttribute('data-xml-cii-open-existing-phase') || 'regex';
      const ok = openExistingXmlCiiPhase(root, phaseId);
      if (!ok) button.querySelector('small').textContent = 'Existing XML→CII workflow panel is not available.';
    });
  });
}

function renderMatchedAudit(root, state) {
  state.body.innerHTML = `
    ${tabIntro('Matched Audit', 'Read-only matched-only audit. It auto-loads latest XML→CII diagnostics; rejected and duplicate rows remain hidden from Matched Preview and visible in Diagnostics.')}
    <div data-xml-cii-popup-panel="matched-preview" style="margin-top:10px;"></div>`;
  const mountTarget = state.body.querySelector('[data-xml-cii-popup-panel="matched-preview"]');
  mountExistingPanel(state, '#model-converters-xml-cii-matched-preview', mountTarget, `
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-detail-title">Matched Preview panel not available yet</div>
      <div class="model-converters-workflow-detail-text">Run XML→CII or wait for the Matched Preview UI to initialize.</div>
    </div>`);
}

function renderOutputRun(root, state) {
  restoreMount(state);
  const outputText = clean(root.querySelector?.('#model-converters-output')?.textContent || 'No output generated yet.');
  const statusText = clean(root.querySelector?.('#model-converters-status')?.textContent || 'Idle');
  state.body.innerHTML = `
    ${tabIntro('Output / Run Conversion', 'Run final XML→CII conversion using the same existing runner. Outputs continue to render in the main Output panel.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      ${statsCards([
        ['Status', statusText || 'Idle'],
        ['Output panel', outputText.includes('No output') ? 'No output generated' : 'Output available'],
        ['Manual side-load saved', supportConfigHasSideload(root) ? 'Yes' : 'No'],
        ['Matched diagnostics', readStored('xmlCii2019.matchedPreview.lastDiagnostics.v1', '') ? 'Available' : 'Not stored'],
      ])}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="model-converters-run-btn" data-xml-cii-popup-run>Run Conversion</button>
        <button type="button" class="model-converters-download-btn" data-xml-cii-popup-scroll-output>Show Main Output Panel</button>
        <button type="button" class="model-converters-download-btn" data-xml-cii-popup-refresh>Refresh Summary</button>
      </div>
      <div class="model-converters-workflow-detail-note">Run Conversion uses the existing #model-converters-run button with a guarded bypass so the popup launcher does not recursively reopen.</div>
    </div>`;
  state.body.querySelector('[data-xml-cii-popup-run]')?.addEventListener('click', () => {
    const started = dispatchDirectRun(root);
    if (started) state.modal?.close();
  });
  state.body.querySelector('[data-xml-cii-popup-scroll-output]')?.addEventListener('click', () => {
    safeScrollTo(root.querySelector?.('#model-converters-output'));
  });
  state.body.querySelector('[data-xml-cii-popup-refresh]')?.addEventListener('click', () => renderOutputRun(root, state));
}

function renderActiveTab(root, state) {
  if (!state.body) return;
  const tabId = state.activeTab || WORKFLOW_TABS[0].id;
  if (tabId === 'process-enrichment') renderProcessEnrichment(root, state);
  else if (tabId === 'matched-audit') renderMatchedAudit(root, state);
  else if (tabId === 'output-run') renderOutputRun(root, state);
  else renderXmlModelData(root, state);
}

function openConversionWorkflow(root = document, state) {
  if (!browserReady()) return;
  if (state.modal) {
    renderActiveTab(root, state);
    return;
  }
  const active = readStored(ACTIVE_TAB_KEY, 'xml-model-data');
  state.activeTab = WORKFLOW_TABS.some((tab) => tab.id === active) ? active : 'xml-model-data';
  state.modal = new WorkflowModal({
    title: 'XML → CII (2019) Conversion Workflow',
    subtitle: 'Nested workflow for XML model data, side-loads, enrichment, matched audit, and final CII generation.',
    tabs: WORKFLOW_TABS,
    activeTabId: state.activeTab,
    onTabChange: (tabId) => {
      state.activeTab = tabId;
      writeStored(ACTIVE_TAB_KEY, tabId);
      renderActiveTab(root, state);
    },
    onClose: () => {
      restoreMount(state);
      state.modal = null;
      state.body = null;
    },
  });
  state.body = state.modal.open();
  renderActiveTab(root, state);
}

function ensureWorkflowButton(root, state) {
  const runButton = root.querySelector?.('#model-converters-run');
  if (!runButton) return;
  if (isXmlCiiActive(root)) {
    if (!runButton.dataset.xmlCiiOriginalText) runButton.dataset.xmlCiiOriginalText = runButton.textContent || 'Run Conversion';
    runButton.textContent = 'Open XML→CII Workflow';
    runButton.title = 'Open the XML→CII conversion workflow popup. Final conversion is available inside Output / Run Conversion.';
  } else if (runButton.dataset.xmlCiiOriginalText) {
    runButton.textContent = runButton.dataset.xmlCiiOriginalText;
    runButton.title = '';
  }

  if (root.querySelector('[data-xml-cii-open-conversion-workflow]')) return;
  const quickButton = document.createElement('button');
  quickButton.type = 'button';
  quickButton.className = 'model-converters-download-btn';
  quickButton.dataset.xmlCiiOpenConversionWorkflow = 'true';
  quickButton.textContent = 'Open XML→CII Workflow';
  quickButton.style.cssText = 'width:100%;padding:10px;margin-top:-4px;';
  quickButton.addEventListener('click', () => openConversionWorkflow(root, state));
  runButton.parentElement?.insertBefore(quickButton, runButton);
}

export function installXmlCiiConversionWorkflowPopup(container = document) {
  if (!browserReady() || window[FLAG]) return;
  window[FLAG] = true;
  const root = container || document;
  const state = { modal: null, body: null, activeTab: 'xml-model-data', activeMount: null };

  document.addEventListener('click', (event) => {
    const runButton = event.target?.closest?.('#model-converters-run');
    if (!runButton) return;
    if (window[DIRECT_RUN_FLAG]) return;
    if (!isXmlCiiActive(root)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openConversionWorkflow(root, state);
  }, true);

  const patch = () => ensureWorkflowButton(root, state);
  patch();
  const observer = new MutationObserver(patch);
  observer.observe(root === document ? document.body : root, { childList: true, subtree: true });
}
