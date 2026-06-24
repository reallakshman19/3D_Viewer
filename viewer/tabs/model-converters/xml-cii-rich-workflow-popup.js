/**
 * Deprecated compatibility shim.
 *
 * Workflow 2 popup ownership moved to xml-cii-workflow2-popup.js. Keep this
 * filename as a safe re-export for cached or older imports only; it must not
 * contain active popup logic.
 */

export { installXmlCiiWorkflow2Popup as installXmlCiiRichWorkflowPopup } from './xml-cii-workflow2-popup.js?v=20260624-workflow2-standalone-1';
