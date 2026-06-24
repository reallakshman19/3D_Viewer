/**
 * XML->CII workflow button scope owner.
 *
 * Owns only the visible converter action area in the Model Converters tab.
 * It does not open workflow popups, run conversion, or mutate phase content.
 *
 * Contract:
 * - XML->CII left panel shows exactly two workflow launchers: Simple and Rich.
 * - The generic converter Advanced options block is hidden for XML->CII.
 * - The legacy direct Run Conversion button is hidden for XML->CII and restored for other converters.
 * - Workflow launchers are visible only when the selected converter is xml_to_cii.
 * - Workflow launchers must not remain inside the legacy dark workflow shell.
 * - Duplicate launchers from stale renders are removed inside the current root.
 * - Stale/cached launcher click listeners are stripped before popup binding.
 */

const XML_CII_BUTTON_SCOPE_STYLE_ID = 'xml-cii-workflow-button-scope-style';
const XML_CII_BUTTON_SCOPE_FLAG = '__xmlCiiWorkflowButtonScope_v4';
const XML_CII_EXCLUSIVE_LAUNCHER_VERSION = '20260624-popup-only-1';
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

function xmlCiiWorkflowButtonScopeEnsureCard(row, kind) {
  if (!row) return null;
  const attrName = kind === 'simple' ? 'data-xml-cii-simple-workflow-card' : 'data-xml-cii-rich-workflow-card';
  let card = row.querySelector(`:scope > [${attrName}]`);
  if (card) return card;
  card = document.createElement('section');
  card.className = `xml-cii-workflow-card xml-cii-${kind}-workflow-card`;
  card.setAttribute(attrName, 'true');
  card.innerHTML = kind === 'simple'
    ? `
      <div class="xml-cii-workflow-card-title">Simple workflow</div>
      <div class="xml-cii-workflow-card-note">Opens the simple XML-&gt;CII popup. Import masters, map fields, inspect diagnostics, and run enriched CII conversion.</div>
      <div class="xml-cii-workflow-card-actions" data-xml-cii-simple-actions></div>`
    : `
      <div class="xml-cii-workflow-card-title">Rich workflow</div>
      <div class="xml-cii-workflow-card-note">Opens the rich XML-&gt;CII popup. Import masters, map fields, and maintain manual overrides in a standalone-ready config.</div>
      <div class="xml-cii-workflow-card-actions" data-xml-cii-rich-actions></div>`;
  if (kind === 'simple') row.insertBefore(card, row.firstChild);
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
  delete fresh.dataset.xmlCiiRichWorkflowPopupBound;
  delete fresh.dataset.xmlCiiHotfixBound;
  button.replaceWith(fresh);
  return fresh;
}

function xmlCiiWorkflowButtonScopeCanonicalLauncher(root, kind) {
  const id = kind === 'simple' ? 'model-converters-xml-cii-simple-btn' : 'model-converters-xml-cii-rich-btn';
  const attr = kind === 'simple' ? 'data-xml-cii-simple-workflow-launcher' : 'data-xml-cii-rich-workflow-launcher';
  const cardAttr = kind === 'simple' ? 'data-xml-cii-simple-workflow-card' : 'data-xml-cii-rich-workflow-card';
  const candidates = Array.from(root?.querySelectorAll?.(`#${id}, [${attr}="true"]`) || []);
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

function xmlCiiWorkflowButtonScopePrepareLauncher(root, card, kind) {
  const button = xmlCiiWorkflowButtonScopeCanonicalLauncher(root, kind);
  const target = card?.querySelector?.(kind === 'simple' ? '[data-xml-cii-simple-actions]' : '[data-xml-cii-rich-actions]');
  if (!button || !target) return null;
  if (button.parentElement !== target) target.appendChild(button);
  button.id = kind === 'simple' ? 'model-converters-xml-cii-simple-btn' : 'model-converters-xml-cii-rich-btn';
  button.dataset.xmlCiiWorkflowLauncher = 'true';
  if (kind === 'simple') button.dataset.xmlCiiSimpleWorkflowLauncher = 'true';
  else button.dataset.xmlCiiRichWorkflowLauncher = 'true';
  button.dataset.xmlCiiExclusiveLauncherVersion = XML_CII_EXCLUSIVE_LAUNCHER_VERSION;
  button.classList.add(kind === 'simple' ? 'model-converters-download-btn' : 'model-converters-run-btn');
  button.removeAttribute('style');
  button.type = 'button';
  button.textContent = kind === 'simple' ? 'XML->CII Simple Workflow' : 'XML->CII Rich Workflow';
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
  const simpleCard = isXmlCii ? xmlCiiWorkflowButtonScopeEnsureCard(row, 'simple') : row?.querySelector?.(':scope > [data-xml-cii-simple-workflow-card]');
  const richCard = isXmlCii ? xmlCiiWorkflowButtonScopeEnsureCard(row, 'rich') : row?.querySelector?.(':scope > [data-xml-cii-rich-workflow-card]');
  const simpleButton = isXmlCii ? xmlCiiWorkflowButtonScopePrepareLauncher(root, simpleCard, 'simple') : row?.querySelector?.('[data-xml-cii-simple-workflow-launcher="true"]');
  const richButton = isXmlCii ? xmlCiiWorkflowButtonScopePrepareLauncher(root, richCard, 'rich') : row?.querySelector?.('[data-xml-cii-rich-workflow-launcher="true"]');
  const runButton = xmlCiiWorkflowButtonScopeToggleDirectRun(root, isXmlCii);

  xmlCiiWorkflowButtonScopeHideAdvancedOptions(root, isXmlCii);

  for (const card of [simpleCard, richCard]) {
    if (!card) continue;
    card.hidden = !isXmlCii;
    card.style.display = isXmlCii ? '' : 'none';
    if (!isXmlCii) card.remove();
  }
  for (const button of [simpleButton, richButton]) {
    if (!button) continue;
    button.hidden = !isXmlCii;
    button.style.display = isXmlCii ? 'inline-flex' : 'none';
    button.setAttribute('aria-hidden', isXmlCii ? 'false' : 'true');
    if (!isXmlCii && button.isConnected) button.remove();
  }
  xmlCiiWorkflowButtonScopeRetireLegacyShell(root);
  return { root, row, simpleCard, richCard, runButton, simpleButton, richButton, isXmlCii };
}

export function installXmlCiiWorkflowButtonScope(container = document) {
  if (!xmlCiiWorkflowButtonScopeBrowserReady()) return null;
  if (!window[XML_CII_BUTTON_SCOPE_FLAG]) window[XML_CII_BUTTON_SCOPE_FLAG] = { version: 'v4' };
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
