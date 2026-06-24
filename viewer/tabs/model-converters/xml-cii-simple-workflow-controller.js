/**
 * XML->CII(2019) simple/direct workflow controller.
 *
 * This module owns only the main "Run Conversion" button visibility and layout.
 * Rich Workflow popup code must not import this module or mutate the simple run
 * button directly.
 */

const XML_CII_SIMPLE_WORKFLOW_FLAG = '__xmlCiiSimpleWorkflowController_v1';
const XML_CII_SIMPLE_DIRECT_RUN_FLAG = '__xmlCiiSimpleWorkflowDirectRunAllowed';
const XML_CII_SIMPLE_STYLE_ID = 'xml-cii-simple-workflow-controller-style';

function xmlCiiSimpleWorkflowBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function xmlCiiSimpleWorkflowText(value) {
  return value == null ? '' : String(value).trim();
}

function xmlCiiSimpleWorkflowEnsureStyle() {
  if (!xmlCiiSimpleWorkflowBrowserReady() || document.getElementById(XML_CII_SIMPLE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = XML_CII_SIMPLE_STYLE_ID;
  style.textContent = `
    .xml-cii-simple-workflow-actions {
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:center!important;
      gap:10px!important;
    }
    #model-converters-run[data-xml-cii-simple-workflow-button="true"] {
      display:inline-flex!important;
      visibility:visible!important;
      position:relative!important;
      z-index:2!important;
      margin-right:10px!important;
    }
  `;
  document.head.appendChild(style);
}

function xmlCiiSimpleWorkflowRunButton(root = document) {
  return root?.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
}

function xmlCiiSimpleWorkflowRichButton(root = document) {
  return root?.querySelector?.('#model-converters-xml-cii-rich-btn') || document.querySelector('#model-converters-xml-cii-rich-btn');
}

export function xmlCiiSimpleWorkflowRestoreRunButton(root = document) {
  if (!xmlCiiSimpleWorkflowBrowserReady()) return null;
  xmlCiiSimpleWorkflowEnsureStyle();
  const runButton = xmlCiiSimpleWorkflowRunButton(root);
  const richButton = xmlCiiSimpleWorkflowRichButton(root);
  if (!runButton) return null;

  window[XML_CII_SIMPLE_DIRECT_RUN_FLAG] = true;
  runButton.dataset.xmlCiiSimpleWorkflowButton = 'true';
  runButton.hidden = false;
  runButton.style.display = 'inline-flex';
  runButton.style.visibility = 'visible';
  if (!xmlCiiSimpleWorkflowText(runButton.textContent)) runButton.textContent = 'Run Conversion';

  if (runButton.parentElement) runButton.parentElement.classList.add('xml-cii-simple-workflow-actions');
  if (richButton?.parentElement && richButton.parentElement === runButton.parentElement) {
    richButton.parentElement.classList.add('xml-cii-simple-workflow-actions');
  }
  return runButton;
}

export function installXmlCiiSimpleWorkflowController(root = document) {
  if (!xmlCiiSimpleWorkflowBrowserReady()) return null;
  if (!window[XML_CII_SIMPLE_WORKFLOW_FLAG]) window[XML_CII_SIMPLE_WORKFLOW_FLAG] = { version: 'v1' };
  const tick = () => xmlCiiSimpleWorkflowRestoreRunButton(root || document);
  for (const delay of [0, 80, 250, 750]) setTimeout(tick, delay);
  return tick();
}
