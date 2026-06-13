import { WorkflowModal } from './shared/WorkflowModal.js';

const FLAG = '__xmlCiiConversionWorkflowPopup_lean_v1';
const ACTIVE_TAB_KEY = 'xmlCii2019.conversionWorkflow.activeTab.v1';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';

const WORKFLOW_TABS = Object.freeze([
  { id: 'xml-model-data', label: 'XML - Model Data', state: 'Model' },
  { id: 'process-enrichment', label: 'Process / Piping Class / Wt. Enrichment', state: 'Existing' },
  { id: 'matched-audit', label: 'Matched Audit', state: 'Audit' },
  { id: 'output-run', label: 'Output / Run Conversion', state: 'Run' },
]);

const MODEL_STEPS = Object.freeze([
  ['input-xml', 'Input XML / JSON Import', 'Load primary XML and optional staged/source-like JSON.'],
  ['resolver', 'Resolver Index', 'Build Node / PS / POS resolver indexes from loaded XML.'],
  ['json-config', 'JSON Config', 'Configure JSON aliases for PS, POS, restraint, DTXR, weight, rating, and metadata.'],
  ['json-data', 'JSON Resolved Data', 'Audit resolved JSON-derived facts before Matched Preview.'],
  ['ps', 'PS → Node', 'Test PS/support-tag resolution against XML nodes.'],
  ['pos', 'POS → Node', 'Test coordinate resolution against XML Position values.'],
  ['restraints', 'Manual Restraints', 'Load Node / PS / POS side-load restraint rows.'],
  ['diagnostics', 'Diagnostics', 'Review rejected, duplicate, invalid, or unresolved rows.'],
]);

const PROCESS_PHASES = Object.freeze([
  ['regex', 'Regex / Line Key Matching', 'Existing Branchname, line key, class, rating, and bore extraction.'],
  ['import-masters', 'Process / Piping Class / Material / Wt.', 'Existing master import and mapping workflow.'],
  ['preview', 'Enrichment Preview', 'Existing dry preview of branch enrichment and mapping quality.'],
  ['diagnostics', 'Diagnostics Dry Run', 'Existing XML→CII diagnostic run and issue table.'],
  ['weight-match', 'Weight Match', 'Existing approximate rigid/valve weight review.'],
  ['support-mapper', 'Support Mapping', 'Existing support mapper rules and support-type classification.'],
  ['config', 'Config JSON', 'Existing XML→CII enrichment configuration.'],
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

function safeScrollTo(node) {
  try { node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); } catch { node?.scrollIntoView?.(); }
}

function statsCards(items) {
  return `<div class="model-converters-workflow-preview-grid">${items.map(([label, value]) => `
    <div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
  </div>`;
}

function tabIntro(title, body) {
  return `
    <div class="model-converters-workflow-detail-title">${esc(title)}</div>
    <div class="model-converters-workflow-detail-text">${esc(body)}</div>`;
}

function buttonCard(id, label, desc, kind = 'model') {
  return `
    <button type="button" class="model-converters-workflow-master-tab" data-xml-cii-popup-shortcut="${esc(id)}" data-shortcut-kind="${esc(kind)}">
      <span>${esc(label)}</span>
      <small>${esc(desc)}</small>
    </button>`;
}

function shortcutGrid(items, kind) {
  return `<div class="model-converters-workflow-master-tabs" style="margin-top:12px;">${items.map(([id, label, desc]) => buttonCard(id, label, desc, kind)).join('')}</div>`;
}

function openExistingXmlCiiPhase(root, phaseId) {
  const workflow = root.querySelector?.('#model-converters-xml-cii-workflow') || document.querySelector('#model-converters-xml-cii-workflow');
  if (!workflow) return false;
  workflow.dataset.selectedPhase = phaseId;
  const details = workflow.tagName === 'DETAILS' ? workflow : workflow.closest('details');
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

function renderXmlModelData(root, state) {
  state.body.innerHTML = `
    ${tabIntro('XML - Model Data', 'Load and audit XML model data, staged/source-like JSON, resolver indexes, and manual side-load rows before matched preview.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      ${statsCards([
        ['Primary XML', fileNameText(root, '#model-converters-primary-input')],
        ['Staged / JSON', fileNameText(root, '#model-converters-secondary-input')],
        ['Active converter', activeConverterId(root) || 'none'],
      ])}
      <div class="model-converters-workflow-detail-note">Lean mode: this popup does not move live DOM panels. Shortcuts scroll/open existing XML→CII panels to avoid UI hangs.</div>
      ${shortcutGrid(MODEL_STEPS, 'model')}
    </div>`;
}

function renderProcessEnrichment(root, state) {
  state.body.innerHTML = `
    ${tabIntro('Process / Piping Class / Wt. Enrichment', 'Use the existing XML→CII enrichment workflow for regex, process data, piping class, material, weights, valve CA8, support mapping, preview, diagnostics, and final run.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      <div class="model-converters-workflow-section-title">Existing XML→CII workflow shortcuts</div>
      <div class="model-converters-workflow-detail-text">No converter logic is duplicated here. Each tile opens the existing workflow phase.</div>
      ${shortcutGrid(PROCESS_PHASES, 'phase')}
    </div>`;
}

function renderMatchedAudit(root, state) {
  const stored = readStored('xmlCii2019.matchedPreview.lastDiagnostics.v1', '');
  let matched = 0;
  let rejected = 0;
  try {
    const payload = JSON.parse(stored || '{}');
    matched = Array.isArray(payload.matchedFacts) ? payload.matchedFacts.filter((fact) => fact?.status === 'MATCHED').length : 0;
    rejected = Array.isArray(payload.rejectedFacts) ? payload.rejectedFacts.length : 0;
  } catch {}
  state.body.innerHTML = `
    ${tabIntro('Matched Audit', 'Matched Preview is read-only and matched-only. Rejected, invalid, duplicate, and unresolved rows remain diagnostic-only.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      ${statsCards([
        ['Matched rows', matched],
        ['Rejected hidden', rejected],
        ['Latest diagnostics', stored ? 'Available' : 'Not stored'],
      ])}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="model-converters-download-btn" data-xml-cii-popup-shortcut="matched-preview" data-shortcut-kind="model">Open Matched Preview</button>
        <button type="button" class="model-converters-download-btn" data-xml-cii-popup-shortcut="diagnostics" data-shortcut-kind="model">Open Diagnostics</button>
      </div>
    </div>`;
}

function renderOutputRun(root, state) {
  const outputText = clean(root.querySelector?.('#model-converters-output')?.textContent || 'No output generated yet.');
  const statusText = clean(root.querySelector?.('#model-converters-status')?.textContent || 'Idle');
  state.body.innerHTML = `
    ${tabIntro('Output / Run Conversion', 'Run final XML→CII conversion using the existing converter runner. Outputs still render in the main Output panel.')}
    <div class="model-converters-workflow-master-card" style="margin-top:10px;">
      ${statsCards([
        ['Status', statusText || 'Idle'],
        ['Output panel', outputText.includes('No output') ? 'No output generated' : 'Output available'],
      ])}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="model-converters-run-btn" data-xml-cii-popup-run>Run Conversion</button>
        <button type="button" class="model-converters-download-btn" data-xml-cii-popup-shortcut="output" data-shortcut-kind="model">Show Main Output Panel</button>
      </div>
    </div>`;
  state.body.querySelector('[data-xml-cii-popup-run]')?.addEventListener('click', () => {
    if (dispatchDirectRun(root)) state.modal?.close();
  });
}

function renderActiveTab(root, state) {
  if (!state.body) return;
  const tabId = state.activeTab || WORKFLOW_TABS[0].id;
  if (tabId === 'process-enrichment') renderProcessEnrichment(root, state);
  else if (tabId === 'matched-audit') renderMatchedAudit(root, state);
  else if (tabId === 'output-run') renderOutputRun(root, state);
  else renderXmlModelData(root, state);
  bindShortcuts(root, state);
}

function bindShortcuts(root, state) {
  state.body.querySelectorAll('[data-xml-cii-popup-shortcut]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.getAttribute('data-shortcut-kind') || 'model';
      const id = button.getAttribute('data-xml-cii-popup-shortcut') || '';
      let ok = false;
      if (kind === 'phase') ok = openExistingXmlCiiPhase(root, id);
      else {
        const selectorMap = {
          'input-xml': '#model-converters-primary-input',
          'resolver': '#model-converters-xml-cii-sideload',
          'json-config': '#model-converters-xml-cii-sideload',
          'json-data': '#model-converters-xml-cii-sideload',
          'ps': '#model-converters-xml-cii-sideload',
          'pos': '#model-converters-xml-cii-sideload',
          'restraints': '#model-converters-xml-cii-sideload',
          'diagnostics': '#model-converters-xml-cii-sideload',
          'matched-preview': '#model-converters-xml-cii-matched-preview',
          'output': '#model-converters-output',
        };
        ok = scrollToSelector(root, selectorMap[id] || '#model-converters-xml-cii-workflow');
      }
      if (ok) state.modal?.close();
      else button.querySelector('small') ? button.querySelector('small').textContent = 'Panel is not available yet.' : button.textContent = 'Panel is not available yet';
    });
  });
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
    subtitle: 'XML model data, side-load audit, existing enrichment workflow, matched audit, and final CII generation.',
    tabs: WORKFLOW_TABS,
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
