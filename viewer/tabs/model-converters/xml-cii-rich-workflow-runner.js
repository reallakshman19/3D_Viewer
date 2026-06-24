/**
 * XML->CII(2019) Rich Workflow final-run handoff.
 *
 * This is the only rich-prefixed module allowed to invoke the current legacy
 * converter button. It gives the remaining handoff a named boundary while the
 * rich workflow run path is extracted from legacy-adapter.js in a later phase.
 */

const XML_CII_RICH_WORKFLOW_HANDOFF_FLAG = '__xmlCiiRichWorkflowRunHandoff_v1';
const XML_CII_LEGACY_DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';

function xmlCiiRichWorkflowBrowserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function xmlCiiRichWorkflowRequestFinalRun(root = document) {
  if (!xmlCiiRichWorkflowBrowserReady()) return false;
  const event = new CustomEvent('xml-cii-rich-workflow-finalise-run', {
    bubbles: true,
    cancelable: true,
    detail: { workflow: 'rich', version: 'v1' },
  });
  root?.dispatchEvent?.(event);
  if (event.defaultPrevented) return true;

  const runButton = document.querySelector('#model-converters-run');
  if (!runButton) return false;
  window[XML_CII_RICH_WORKFLOW_HANDOFF_FLAG] = true;
  window[XML_CII_LEGACY_DIRECT_RUN_FLAG] = true;
  try {
    runButton.click();
    return true;
  } finally {
    setTimeout(() => {
      window[XML_CII_RICH_WORKFLOW_HANDOFF_FLAG] = false;
      window[XML_CII_LEGACY_DIRECT_RUN_FLAG] = false;
    }, 0);
  }
}
