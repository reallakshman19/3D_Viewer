/**
 * XML->CII workflow button scope owner.
 *
 * Owns only the visible converter action area in the Model Converters tab.
 * It does not open the rich workflow, run conversion, or mutate phase content.
 *
 * Contract:
 * - Simple Run Conversion stays as the normal #model-converters-run button.
 * - XML->CII simple/direct options stay under the simple workflow card.
 * - Rich Workflow launcher is visible only when the selected converter is xml_to_cii.
 * - Rich Workflow launcher card must never contain the simple Advanced options block.
 * - Rich Workflow launcher must not remain inside the legacy dark workflow shell.
 * - Duplicate rich launchers from stale renders are removed inside the current root.
 * - Stale/cached rich launcher click listeners are stripped before rich popup binding.
 */

const XML_CII_BUTTON_SCOPE_STYLE_ID = 'xml-cii-workflow-button-scope-style';
const XML_CII_BUTTON_SCOPE_FLAG = '__xmlCiiWorkflowButtonScope_v3';
const XML_CII_EXCLUSIVE_LAUNCHER_VERSION = '20260624-popup-identity-1';
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
    .xml-cii-simple-workflow-card > details.model-converters-advanced {
      margin:10px 0 0 0!important;
      border-color:rgba(148,163,184,0.26)!important;
      background:rgba(2,6,23,0.18)!important;
    }
    .xml-cii-simple-workflow-card > details.model-converters-advanced > summary {
      color:#cbd5e1!important;
    }
    .xml-cii-rich-workflow-card > details.model-converters-advanced,
    .xml-cii-rich-workflow-card [data-option-key="supportConfigJson"],
    .xml-cii-rich-workflow-card [data-json-popup-key="supportConfigJson"] {
      display:none!important;
    }
    .xml-cii-workflow-action-row [data-xml-cii-rich-workflow-launcher="true"][hidden],
    .xml-cii-rich-workflow-card[hidden] {
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
      <div class="xml-cii-workflow-card-title">Simple/direct workflow</div>
      <div class="xml-cii-workflow-card-note">Uses the main converter options and runs from the visible Run Conversion button.</div>
      <div class="xml-cii-workflow-card-actions" data-xml-cii-simple-actions></div>`
    : `
      <div class="xml-cii-workflow-card-title">Rich workflow</div>
      <div class="xml-cii-workflow-card-note">Opens the isolated rich popup. Regex, masters, preview, diagnostics, support mapping, and rich run options are configured inside the popup.</div>
      <div class="xml-cii-workflow-card-actions" data-xml-cii-rich-actions></div>`;
  if (kind === 'simple') row.insertBefore(card, row.firstChild);
  else row.appendChild(card);
  return card;
}

function xmlCiiWorkflowButtonScopeAdvancedDetails(root) {
  const left = xmlCiiWorkflowButtonScopeLeft(root);
  if (!left) return null;
  return left.querySelector(':scope > details.model-converters-advanced:not(#model-converters-support-mapper)')
    || left.querySelector('[data-xml-cii-simple-workflow-card] > details.model-converters-advanced:not(#model-converters-support-mapper)')
    || null;
}

function xmlCiiWorkflowButtonScopeSetAdvancedSummary(details, text) {
  const summary = details?.querySelector?.(':scope > summary');
  if (summary) summary.textContent = text;
}

function xmlCiiWorkflowButtonScopeRestoreAdvancedToGenericPosition(root, row) {
  const left = xmlCiiWorkflowButtonScopeLeft(root);
  const details = xmlCiiWorkflowButtonScopeAdvancedDetails(root);
  if (!left || !details) return null;
  xmlCiiWorkflowButtonScopeSetAdvancedSummary(details, 'Advanced options');
  details.dataset.xmlCiiSimpleWorkflowOptions = 'false';
  if (details.parentElement !== left) left.insertBefore(details, row || left.querySelector(':scope > #model-converters-xml-cii-workflow') || left.querySelector(':scope > #model-converters-run') || null);
  return details;
}

function xmlCiiWorkflowButtonScopePlaceAdvancedInSimpleCard(root, simpleCard) {
  const details = xmlCiiWorkflowButtonScopeAdvancedDetails(root);
  if (!details || !simpleCard) return null;
  xmlCiiWorkflowButtonScopeSetAdvancedSummary(details, 'Simple/direct workflow options');
  details.dataset.xmlCiiSimpleWorkflowOptions = 'true';
  if (details.parentElement !== simpleCard) simpleCard.appendChild(details);
  return details;
}

function xmlCiiWorkflowButtonScopeFreshRichButton(button) {
  if (!button) return null;
  if (button.dataset.xmlCiiExclusiveLauncherVersion === XML_CII_EXCLUSIVE_LAUNCHER_VERSION) return button;

  const fresh = button.cloneNode(true);
  fresh.dataset.xmlCiiExclusiveLauncherVersion = XML_CII_EXCLUSIVE_LAUNCHER_VERSION;
  delete fresh.dataset.xmlCiiRichWorkflowPopupBound;
  delete fresh.dataset.xmlCiiHotfixBound;
  button.replaceWith(fresh);
  return fresh;
}

function xmlCiiWorkflowButtonScopeCanonicalRichButton(root) {
  const candidates = Array.from(root?.querySelectorAll?.('#model-converters-xml-cii-rich-btn, [data-xml-cii-rich-workflow-launcher="true"]') || []);
  let canonical = candidates.find((button) => button.closest('[data-xml-cii-rich-workflow-card]')) || candidates[0] || null;
  if (!canonical) {
    canonical = document.createElement('button');
    canonical.type = 'button';
    canonical.id = 'model-converters-xml-cii-rich-btn';
    canonical.setAttribute('data-xml-cii-rich-workflow-launcher', 'true');
  }
  canonical = xmlCiiWorkflowButtonScopeFreshRichButton(canonical);
  for (const button of candidates) {
    if (button !== canonical && button.isConnected) button.remove();
  }
  return canonical;
}

function xmlCiiWorkflowButtonScopePrepareRunButton(root, simpleCard, isXmlCii) {
  const runButton = root?.querySelector?.('#model-converters-run');
  if (!runButton) return null;
  const target = isXmlCii
    ? simpleCard?.querySelector?.('[data-xml-cii-simple-actions]')
    : xmlCiiWorkflowButtonScopeEnsureActionRow(root);
  if (target && runButton.parentElement !== target) target.insertBefore(runButton, target.firstChild || null);
  runButton.dataset.xmlCiiSimpleWorkflowButton = 'true';
  runButton.hidden = false;
  runButton.style.display = '';
  runButton.style.visibility = '';
  runButton.style.width = '';
  runButton.style.margin = '';
  if (!String(runButton.textContent || '').trim()) runButton.textContent = 'Run Conversion';
  return runButton;
}

function xmlCiiWorkflowButtonScopePrepareRichButton(root, row, richCard) {
  const richButton = xmlCiiWorkflowButtonScopeCanonicalRichButton(root, row);
  const target = richCard?.querySelector?.('[data-xml-cii-rich-actions]');
  if (!richButton || !target) return null;
  if (richButton.parentElement !== target) target.appendChild(richButton);
  richButton.id = 'model-converters-xml-cii-rich-btn';
  richButton.dataset.xmlCiiRichWorkflowLauncher = 'true';
  richButton.dataset.xmlCiiExclusiveLauncherVersion = XML_CII_EXCLUSIVE_LAUNCHER_VERSION;
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
  const isXmlCii = xmlCiiWorkflowButtonScopeIsXmlCiiSelected(root);
  const simpleCard = isXmlCii ? xmlCiiWorkflowButtonScopeEnsureCard(row, 'simple') : null;
  const richCard = isXmlCii ? xmlCiiWorkflowButtonScopeEnsureCard(row, 'rich') : row?.querySelector?.(':scope > [data-xml-cii-rich-workflow-card]');
  const runButton = xmlCiiWorkflowButtonScopePrepareRunButton(root, simpleCard, isXmlCii);
  const richButton = isXmlCii ? xmlCiiWorkflowButtonScopePrepareRichButton(root, row, richCard) : row?.querySelector?.('[data-xml-cii-rich-workflow-launcher="true"]');

  if (isXmlCii) {
    xmlCiiWorkflowButtonScopePlaceAdvancedInSimpleCard(root, simpleCard);
  } else {
    xmlCiiWorkflowButtonScopeRestoreAdvancedToGenericPosition(root, row);
    const simple = row?.querySelector?.(':scope > [data-xml-cii-simple-workflow-card]');
    if (simple) simple.remove();
  }

  if (richCard) {
    richCard.hidden = !isXmlCii;
    richCard.style.display = isXmlCii ? '' : 'none';
  }
  if (richButton) {
    richButton.hidden = !isXmlCii;
    richButton.style.display = isXmlCii ? 'inline-flex' : 'none';
    richButton.setAttribute('aria-hidden', isXmlCii ? 'false' : 'true');
  }
  xmlCiiWorkflowButtonScopeRetireLegacyShell(root);
  return { root, row, simpleCard, richCard, runButton, richButton, isXmlCii };
}

export function installXmlCiiWorkflowButtonScope(container = document) {
  if (!xmlCiiWorkflowButtonScopeBrowserReady()) return null;
  if (!window[XML_CII_BUTTON_SCOPE_FLAG]) window[XML_CII_BUTTON_SCOPE_FLAG] = { version: 'v3' };
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
