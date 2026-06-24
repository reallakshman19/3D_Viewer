/**
 * XML->CII(2019) Workflow final-run handoff.
 *
 * This is the only neutral workflow module allowed to invoke the current legacy
 * converter button. It keeps the remaining handoff named while the final run
 * path is extracted from legacy-adapter.js in a later phase.
 */

const XML_CII_WORKFLOW_HANDOFF_FLAG = '__xmlCiiWorkflowRunHandoff_v1';
const XML_CII_LEGACY_DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';

function xmlCiiWorkflowBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function xmlCiiWorkflowRequestFinalRun(root = document, workflow = 'workflow2') {
  if (!xmlCiiWorkflowBrowserReady()) return false;
  const event = new CustomEvent('xml-cii-workflow-finalise-run', {
    bubbles: true,
    cancelable: true,
    detail: { workflow, version: 'v1' },
  });
  root?.dispatchEvent?.(event);
  if (event.defaultPrevented) return true;

  const runButton = document.querySelector('#model-converters-run');
  if (!runButton) return false;
  window[XML_CII_WORKFLOW_HANDOFF_FLAG] = true;
  window[XML_CII_LEGACY_DIRECT_RUN_FLAG] = true;
  try {
    runButton.click();
    return true;
  } finally {
    setTimeout(() => {
      window[XML_CII_WORKFLOW_HANDOFF_FLAG] = false;
      window[XML_CII_LEGACY_DIRECT_RUN_FLAG] = false;
    }, 0);
  }
}
