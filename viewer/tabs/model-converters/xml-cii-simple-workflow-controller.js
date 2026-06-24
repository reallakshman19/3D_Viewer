/**
 * XML->CII(2019) simple/direct workflow controller.
 *
 * This module owns only the main "Run Conversion" button visibility and direct-run guard.
 * Rich Workflow popup code must not import this module or mutate the simple run
 * button directly.
 */

const XML_CII_SIMPLE_WORKFLOW_FLAG = '__xmlCiiSimpleWorkflowController_v2';
const XML_CII_SIMPLE_DIRECT_RUN_FLAG = '__xmlCiiSimpleWorkflowDirectRunAllowed';
const XML_CII_SIMPLE_STYLE_ID = 'xml-cii-simple-workflow-controller-style';

function xmlCiiSimpleWorkflowBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function xmlCiiSimpleWorkflowText(value) {
  return value == null ? '' : String(value).trim();
}

function xmlCiiSimpleWorkflowRoot(root = document) {
  return root?.querySelector?.('.model-converters-root') || root;
}

function xmlCiiSimpleWorkflowEnsureStyle() {
  if (!xmlCiiSimpleWorkflowBrowserReady() || document.getElementById(XML_CII_SIMPLE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = XML_CII_SIMPLE_STYLE_ID;
  style.textContent = `
    #model-converters-run[data-xml-cii-simple-workflow-button="true"] {
      visibility:visible!important;
      position:relative!important;
      z-index:2!important;
    }
  `;
  document.head.appendChild(style);
}

function xmlCiiSimpleWorkflowRunButton(root = document) {
  const scopedRoot = xmlCiiSimpleWorkflowRoot(root);
  return scopedRoot?.querySelector?.('#model-converters-run') || null;
}

export function xmlCiiSimpleWorkflowRestoreRunButton(root = document) {
  if (!xmlCiiSimpleWorkflowBrowserReady()) return null;
  xmlCiiSimpleWorkflowEnsureStyle();
  const runButton = xmlCiiSimpleWorkflowRunButton(root);
  if (!runButton) return null;

  window[XML_CII_SIMPLE_DIRECT_RUN_FLAG] = true;
  runButton.dataset.xmlCiiSimpleWorkflowButton = 'true';
  runButton.hidden = false;
  runButton.style.display = '';
  runButton.style.visibility = '';
  if (!xmlCiiSimpleWorkflowText(runButton.textContent)) runButton.textContent = 'Run Conversion';
  return runButton;
}

export function installXmlCiiSimpleWorkflowController(root = document) {
  if (!xmlCiiSimpleWorkflowBrowserReady()) return null;
  if (!window[XML_CII_SIMPLE_WORKFLOW_FLAG]) window[XML_CII_SIMPLE_WORKFLOW_FLAG] = { version: 'v2' };
  const tick = () => xmlCiiSimpleWorkflowRestoreRunButton(root || document);
  for (const delay of [0, 80, 250, 750]) setTimeout(tick, delay);
  return tick();
}
