/**
 * model-converters-tab.js — compatibility shim.
 *
 * All tab orchestration now lives in:
 *   viewer/tabs/model-converters/ModelConvertersTab.js
 *
 * This file is kept only so existing import paths in the viewer shell continue
 * to resolve without changes.  Do not add render orchestration logic here.
 *
 * Static workflow tests also read this legacy entry directly and verify that the
 * XML CII workflow popup installer is exposed from the model-converters tab path.
 * ModelConvertersTab performs the actual installer scheduling; this named export
 * keeps the legacy entrypoint discoverable without duplicating runtime install
 * logic.
 */
export { renderModelConvertersTab } from './model-converters/index.js?v=20260618-port-bore-contract-1';
export { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';
