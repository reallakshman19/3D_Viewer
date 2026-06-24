/**
 * XML->CII workflow button scope owner.
 *
 * Owns only the visible converter action row in the Model Converters tab.
 * It does not open the rich workflow, run conversion, or mutate phase content.
 *
 * Contract:
 * - Simple Run Conversion stays as the normal #model-converters-run button.
 * - Rich Workflow launcher is visible only when the selected converter is xml_to_cii.
 * - Rich Workflow launcher must not remain inside the legacy dark workflow shell.
 * - Duplicate rich launchers from stale renders are removed inside the current root.
 */

const XML_CII_BUTTON_SCOPE_STYLE_ID = 'xml-cii-workflow-button-scope-style';
const XML_CII_BUTTON_SCOPE_FLAG = '__xmlCiiWorkflowButtonScope_v1';
const XML_CII_CONVERTER_ID = 'xml_to_cii';

function xmlCiiWorkflowButtonScopeBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function xmlCiiWorkflowButtonScopeRoot(container = document) {
  return container?.querySelector?.('.model-converters-root') || container;
}

function xmlCiiWorkflowButtonScopeLeft(root) {
  return root?.querySelector?.('.model-converters-left') || root;
}

function xmlCiiWorkflowButtonScopeSelect(root) {
  return root?.querySelector?.('#model-converters-select') || null;
}

function xmlCiiWorkflowButtonScopeIsXmlCiiSelected(root) {
  return xmlCiiWorkflowButtonScopeSelect(root)?.value === XML_CII_CONVERTER_ID;
}

function xmlCiiWorkflowButtonScopeEnsureStyle() {
  if (!xmlCiiWorkflowButtonScopeBrowserReady() || document.getElementById(XML_CII_BUTTON_SCOPE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = XML_CII_BUTTON_SCOPE_STYLE_ID;
  style.textContent = `
    .xml-cii-workflow-action-row {
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:center!important;
      gap:10px!important;
      padding:0!important;
      margin:0!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
    }
    .xml-cii-workflow-action-row > .model-converters-run-btn,
    .xml-cii-workflow-action-row > .model-converters-download-btn {
      width:auto!important;
      margin:0!important;
      padding:10px 12px!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      min-height:38px!important;
      white-space:nowrap!important;
    }
    .xml-cii-workflow-action-row [data-xml-cii-rich-workflow-launcher="true"][hidden] {
      display:none!important;
    }
    #model-converters-xml-cii-workflow[data-xml-cii-workflow-legacy-shell="retired"] {
      display:none!important;
    }
  `;
  document.head.appendChild(style);
}

function xmlCiiWorkflowButtonScopeEnsureActionRow(root) {
  const left = xmlCiiWorkflowButtonScopeLeft(root);
  if (!left) return null;
  let row = left.querySelector(':scope > [data-xml-cii-workflow-action-row]');
  if (row) return row;
  row = document.createElement('div');
  row.className = 'xml-cii-workflow-action-row';
  row.setAttribute('data-xml-cii-workflow-action-row', 'true');
  const workflowShell = left.querySelector(':scope > #model-converters-xml-cii-workflow');
  const supportMapper = left.querySelector(':scope > #model-converters-support-mapper');
  left.insertBefore(row, workflowShell || supportMapper || left.querySelector(':scope > #model-converters-run') || null);
  return row;
}

function xmlCiiWorkflowButtonScopeCanonicalRichButton(root, row) {
  const candidates = Array.from(root?.querySelectorAll?.('#model-converters-xml-cii-rich-btn, [data-xml-cii-rich-workflow-launcher="true"]') || []);
  if (!candidates.length) return null;
  const existingInRow = candidates.find((button) => button.parentElement === row) || null;
  const canonical = existingInRow || candidates[0];
  for (const button of candidates) {
    if (button !== canonical) button.remove();
  }
  return canonical;
}

function xmlCiiWorkflowButtonScopePrepareRunButton(root, row) {
  const runButton = root?.querySelector?.('#model-converters-run');
  if (!runButton || !row) return null;
  if (runButton.parentElement !== row) row.insertBefore(runButton, row.firstChild);
  runButton.dataset.xmlCiiSimpleWorkflowButton = 'true';
  runButton.hidden = false;
  runButton.style.display = '';
  runButton.style.visibility = '';
  runButton.style.width = '';
  runButton.style.margin = '';
  if (!String(runButton.textContent || '').trim()) runButton.textContent = 'Run Conversion';
  return runButton;
}

function xmlCiiWorkflowButtonScopePrepareRichButton(root, row) {
  const richButton = xmlCiiWorkflowButtonScopeCanonicalRichButton(root, row);
  if (!richButton || !row) return null;
  if (richButton.parentElement !== row) row.appendChild(richButton);
  richButton.id = 'model-converters-xml-cii-rich-btn';
  richButton.dataset.xmlCiiRichWorkflowLauncher = 'true';
  richButton.classList.add('model-converters-run-btn');
  richButton.removeAttribute('style');
  richButton.type = 'button';
  richButton.textContent = 'XML->CII Rich Workflow';
  return richButton;
}

function xmlCiiWorkflowButtonScopeRetireLegacyShell(root) {
  const workflowShell = root?.querySelector?.('#model-converters-xml-cii-workflow');
  if (!workflowShell) return;
  workflowShell.dataset.xmlCiiWorkflowLegacyShell = 'retired';
  workflowShell.hidden = true;
  workflowShell.style.display = 'none';
}

export function xmlCiiWorkflowButtonScopeSync(container = document) {
  if (!xmlCiiWorkflowButtonScopeBrowserReady()) return null;
  xmlCiiWorkflowButtonScopeEnsureStyle();
  const root = xmlCiiWorkflowButtonScopeRoot(container);
  if (!root) return null;
  const row = xmlCiiWorkflowButtonScopeEnsureActionRow(root);
  const runButton = xmlCiiWorkflowButtonScopePrepareRunButton(root, row);
  const richButton = xmlCiiWorkflowButtonScopePrepareRichButton(root, row);
  const isXmlCii = xmlCiiWorkflowButtonScopeIsXmlCiiSelected(root);
  if (richButton) {
    richButton.hidden = !isXmlCii;
    richButton.style.display = isXmlCii ? 'inline-flex' : 'none';
    richButton.setAttribute('aria-hidden', isXmlCii ? 'false' : 'true');
  }
  xmlCiiWorkflowButtonScopeRetireLegacyShell(root);
  return { root, row, runButton, richButton, isXmlCii };
}

export function installXmlCiiWorkflowButtonScope(container = document) {
  if (!xmlCiiWorkflowButtonScopeBrowserReady()) return null;
  if (!window[XML_CII_BUTTON_SCOPE_FLAG]) window[XML_CII_BUTTON_SCOPE_FLAG] = { version: 'v1' };
  const root = xmlCiiWorkflowButtonScopeRoot(container);
  const select = xmlCiiWorkflowButtonScopeSelect(root);
  const sync = () => xmlCiiWorkflowButtonScopeSync(container);
  if (select && select.dataset.xmlCiiWorkflowButtonScopeBound !== 'true') {
    select.addEventListener('change', sync);
    select.dataset.xmlCiiWorkflowButtonScopeBound = 'true';
  }
  for (const delay of [0, 40, 120, 300, 800]) setTimeout(sync, delay);
  return sync();
}
