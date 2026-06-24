/**
 * XML->CII workflow button scope owner.
 *
 * Owns only the visible converter action area in the Model Converters tab.
 * It does not open workflow popups, run conversion, or mutate phase content.
 *
 * Contract:
 * - XML->CII left panel shows exactly two workflow launchers: Workflow 1 and Workflow 2.
 * - The generic converter Advanced options block is hidden for XML->CII.
 * - The legacy direct Run Conversion button is hidden for XML->CII and restored for other converters.
 * - Workflow launchers are visible only when the selected converter is xml_to_cii.
 * - Workflow launchers must not remain inside the legacy dark workflow shell.
 * - Duplicate launchers from stale renders are removed inside the current root.
 * - Stale/cached launcher click listeners are stripped before popup binding.
 */

const XML_CII_BUTTON_SCOPE_STYLE_ID = 'xml-cii-workflow-button-scope-style';
const XML_CII_BUTTON_SCOPE_FLAG = '__xmlCiiWorkflowButtonScope_v6';
const XML_CII_EXCLUSIVE_LAUNCHER_VERSION = '20260624-workflow-consolidation-1';
const XML_CII_CONVERTER_ID = 'xml_to_cii';
const XML_CII_DIRECT_RUN_HIDDEN_ATTR = 'data-xml-cii-direct-run-hidden';

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
      align-items:stretch!important;
      gap:10px!important;
      padding:0!important;
      margin:0 0 10px 0!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
    }
    .xml-cii-workflow-action-row > .xml-cii-workflow-card {
      flex:1 1 220px!important;
      min-width:0!important;
      padding:10px!important;
      border:1px solid rgba(148,163,184,0.28)!important;
      border-radius:10px!important;
      background:rgba(15,23,42,0.22)!important;
      box-shadow:none!important;
    }
    .xml-cii-workflow-card-title {
      font-weight:700!important;
      color:#d7e6ff!important;
      font-size:13px!important;
      margin:0 0 4px 0!important;
    }
    .xml-cii-workflow-card-note {
      color:#8ea4bd!important;
      font-size:11px!important;
      line-height:1.35!important;
      margin:0 0 8px 0!important;
    }
    .xml-cii-workflow-card-actions {
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:center!important;
      gap:8px!important;
    }
    .xml-cii-workflow-action-row .model-converters-run-btn,
    .xml-cii-workflow-action-row .model-converters-download-btn {
      width:auto!important;
      margin:0!important;
      padding:10px 12px!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      min-height:38px!important;
      white-space:nowrap!important;
    }
    [${XML_CII_DIRECT_RUN_HIDDEN_ATTR}="true"] {
      display:none!important;
    }
    details.model-converters-advanced[data-xml-cii-left-panel-options-hidden="true"] {
      display:none!important;
    }
    .xml-cii-workflow-action-row [data-xml-cii-workflow-launcher="true"][hidden],
    .xml-cii-workflow-card[hidden] {
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

function xmlCiiWorkflowButtonScopeEnsureCard(row, workflow) {
  if (!row) return null;
  const attrName = workflow === 'workflow1' ? 'data-xml-cii-workflow1-card' : 'data-xml-cii-workflow2-card';
  let card = row.querySelector(`:scope > [${attrName}]`);
  if (card) return card;
  card = document.createElement('section');
  card.className = `xml-cii-workflow-card xml-cii-${workflow}-card`;
  card.setAttribute(attrName, 'true');
  card.innerHTML = workflow === 'workflow1'
    ? `
      <div class="xml-cii-workflow-card-title">Workflow 1</div>
      <div class="xml-cii-workflow-card-note">Opens the Workflow 1 XML-&gt;CII popup. Import masters, map fields, inspect diagnostics, and run enriched CII conversion.</div>
      <div class="xml-cii-workflow-card-actions" data-xml-cii-workflow1-actions></div>`
    : `
      <div class="xml-cii-workflow-card-title">Workflow 2</div>
      <div class="xml-cii-workflow-card-note">Opens the Workflow 2 XML-&gt;CII popup. Includes the enhanced master/customisation UI for process data and weight data.</div>
      <div class="xml-cii-workflow-card-actions" data-xml-cii-workflow2-actions></div>`;
  if (workflow === 'workflow1') row.insertBefore(card, row.firstChild);
  else row.appendChild(card);
  return card;
}

function xmlCiiWorkflowButtonScopeAdvancedDetails(root) {
  const left = xmlCiiWorkflowButtonScopeLeft(root);
  if (!left) return null;
  return left.querySelector(':scope > details.model-converters-advanced:not(#model-converters-support-mapper)') || null;
}

function xmlCiiWorkflowButtonScopeHideAdvancedOptions(root, isXmlCii) {
  const details = xmlCiiWorkflowButtonScopeAdvancedDetails(root);
  if (!details) return null;
  if (isXmlCii) {
    details.dataset.xmlCiiLeftPanelOptionsHidden = 'true';
    details.hidden = true;
    details.style.display = 'none';
  } else {
    delete details.dataset.xmlCiiLeftPanelOptionsHidden;
    details.hidden = false;
    details.style.display = '';
  }
  return details;
}

function xmlCiiWorkflowButtonScopeFreshLauncher(button) {
  if (!button) return null;
  if (button.dataset.xmlCiiExclusiveLauncherVersion === XML_CII_EXCLUSIVE_LAUNCHER_VERSION) return button;

  const fresh = button.cloneNode(true);
  fresh.dataset.xmlCiiExclusiveLauncherVersion = XML_CII_EXCLUSIVE_LAUNCHER_VERSION;
  delete fresh.dataset.xmlCiiWorkflowPopupBound;
  delete fresh.dataset.xmlCiiWorkflow1PopupBound;
  delete fresh.dataset.xmlCiiWorkflow2PopupBound;
  delete fresh.dataset.xmlCiiSimpleWorkflowPopupBound;
  delete fresh.dataset.xmlCiiRichWorkflowPopupBound;
  delete fresh.dataset.xmlCiiHotfixBound;
  button.replaceWith(fresh);
  return fresh;
}

function xmlCiiWorkflowButtonScopeCanonicalLauncher(root, workflow) {
  const id = workflow === 'workflow1' ? 'model-converters-xml-cii-workflow1-btn' : 'model-converters-xml-cii-workflow2-btn';
  const oldId = workflow === 'workflow1' ? 'model-converters-xml-cii-simple-btn' : 'model-converters-xml-cii-rich-btn';
  const attr = workflow === 'workflow1' ? 'data-xml-cii-workflow1-launcher' : 'data-xml-cii-workflow2-launcher';
  const oldAttr = workflow === 'workflow1' ? 'data-xml-cii-simple-workflow-launcher' : 'data-xml-cii-rich-workflow-launcher';
  const cardAttr = workflow === 'workflow1' ? 'data-xml-cii-workflow1-card' : 'data-xml-cii-workflow2-card';
  const candidates = Array.from(root?.querySelectorAll?.(`#${id}, #${oldId}, [${attr}="true"], [${oldAttr}="true"]`) || []);
  let canonical = candidates.find((button) => button.closest(`[${cardAttr}]`)) || candidates[0] || null;
  if (!canonical) {
    canonical = document.createElement('button');
    canonical.type = 'button';
    canonical.id = id;
    canonical.setAttribute(attr, 'true');
    canonical.setAttribute('data-xml-cii-workflow-launcher', 'true');
  }
  canonical = xmlCiiWorkflowButtonScopeFreshLauncher(canonical);
  for (const button of candidates) {
    if (button !== canonical && button.isConnected) button.remove();
  }
  return canonical;
}

function xmlCiiWorkflowButtonScopePrepareLauncher(root, card, workflow) {
  const button = xmlCiiWorkflowButtonScopeCanonicalLauncher(root, workflow);
  const target = card?.querySelector?.(workflow === 'workflow1' ? '[data-xml-cii-workflow1-actions]' : '[data-xml-cii-workflow2-actions]');
  if (!button || !target) return null;
  if (button.parentElement !== target) target.appendChild(button);
  button.id = workflow === 'workflow1' ? 'model-converters-xml-cii-workflow1-btn' : 'model-converters-xml-cii-workflow2-btn';
  button.dataset.xmlCiiWorkflowLauncher = 'true';
  if (workflow === 'workflow1') button.dataset.xmlCiiWorkflow1Launcher = 'true';
  else button.dataset.xmlCiiWorkflow2Launcher = 'true';
  delete button.dataset.xmlCiiSimpleWorkflowLauncher;
  delete button.dataset.xmlCiiRichWorkflowLauncher;
  button.dataset.xmlCiiExclusiveLauncherVersion = XML_CII_EXCLUSIVE_LAUNCHER_VERSION;
  button.classList.add(workflow === 'workflow1' ? 'model-converters-download-btn' : 'model-converters-run-btn');
  button.removeAttribute('style');
  button.type = 'button';
  button.textContent = workflow === 'workflow1' ? 'XML->CII Workflow 1' : 'XML->CII Workflow 2';
  return button;
}

function xmlCiiWorkflowButtonScopeLegacyRunButton(root) {
  return root?.querySelector?.('#model-converters-run') || null;
}

function xmlCiiWorkflowButtonScopeToggleDirectRun(root, isXmlCii) {
  const runButton = xmlCiiWorkflowButtonScopeLegacyRunButton(root);
  if (!runButton) return null;
  if (isXmlCii) {
    runButton.setAttribute(XML_CII_DIRECT_RUN_HIDDEN_ATTR, 'true');
    runButton.hidden = true;
    runButton.style.display = 'none';
  } else {
    runButton.removeAttribute(XML_CII_DIRECT_RUN_HIDDEN_ATTR);
    runButton.hidden = false;
    runButton.style.display = '';
    runButton.style.visibility = '';
  }
  return runButton;
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
  const isXmlCii = xmlCiiWorkflowButtonScopeIsXmlCiiSelected(root);
  const workflow1Card = isXmlCii ? xmlCiiWorkflowButtonScopeEnsureCard(row, 'workflow1') : row?.querySelector?.(':scope > [data-xml-cii-workflow1-card]');
  const workflow2Card = isXmlCii ? xmlCiiWorkflowButtonScopeEnsureCard(row, 'workflow2') : row?.querySelector?.(':scope > [data-xml-cii-workflow2-card]');
  const workflow1Button = isXmlCii ? xmlCiiWorkflowButtonScopePrepareLauncher(root, workflow1Card, 'workflow1') : row?.querySelector?.('[data-xml-cii-workflow1-launcher="true"]');
  const workflow2Button = isXmlCii ? xmlCiiWorkflowButtonScopePrepareLauncher(root, workflow2Card, 'workflow2') : row?.querySelector?.('[data-xml-cii-workflow2-launcher="true"]');
  const runButton = xmlCiiWorkflowButtonScopeToggleDirectRun(root, isXmlCii);

  xmlCiiWorkflowButtonScopeHideAdvancedOptions(root, isXmlCii);

  for (const card of [workflow1Card, workflow2Card]) {
    if (!card) continue;
    card.hidden = !isXmlCii;
    card.style.display = isXmlCii ? '' : 'none';
    if (!isXmlCii) card.remove();
  }
  for (const button of [workflow1Button, workflow2Button]) {
    if (!button) continue;
    button.hidden = !isXmlCii;
    button.style.display = isXmlCii ? 'inline-flex' : 'none';
    button.setAttribute('aria-hidden', isXmlCii ? 'false' : 'true');
    if (!isXmlCii && button.isConnected) button.remove();
  }
  xmlCiiWorkflowButtonScopeRetireLegacyShell(root);
  return { root, row, workflow1Card, workflow2Card, runButton, workflow1Button, workflow2Button, isXmlCii };
}

export function installXmlCiiWorkflowButtonScope(container = document) {
  if (!xmlCiiWorkflowButtonScopeBrowserReady()) return null;
  if (!window[XML_CII_BUTTON_SCOPE_FLAG]) window[XML_CII_BUTTON_SCOPE_FLAG] = { version: 'v6' };
  const root = xmlCiiWorkflowButtonScopeRoot(container);
  const select = xmlCiiWorkflowButtonScopeSelect(root);
  const sync = () => xmlCiiWorkflowButtonScopeSync(container);
  if (select && select.dataset.xmlCiiWorkflowButtonScopeBound !== 'true') {
    select.addEventListener('change', sync);
    select.dataset.xmlCiiWorkflowButtonScopeBound = 'true';
  }
  return sync();
}
