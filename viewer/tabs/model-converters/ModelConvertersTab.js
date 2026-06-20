/**
 * ModelConvertersTab — orchestration shell for the Model Converters tab.
 *
 * Responsibilities (Phase 1):
 *   1. Render the base tab via the legacy adapter.
 *   2. Install popup/bridge extensions via scheduled installers.
 *   3. Remove deprecated converter options from the dropdown.
 *
 * After Phase 7 (legacy adapter shrinkdown) the bulk of the render logic will
 * migrate into this file, making it the true tab owner rather than a thin
 * orchestrator.
 */

import { renderLegacyModelConvertersTab } from './legacy-adapter.js?v=20260620-rich-state-refresh-1';
import { installBmCiiSupportAnnotationPopup } from './bm-cii-support-annotation-popup.js?v=20260617-bmcii-open-basic-handoff-2';
import { installInputXmlPropertyTransferUi } from './inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installRvmAttrUxmlAddon } from './rvmattr-uxml-addon.js?v=20260618-port-bore-contract-1';
import { installXmlCiiConversionWorkflowPopup } from './xml-cii-conversion-workflow-popup.js?v=20260620-rich-state-refresh-1';
import { installXmlCiiBranchSampleSync } from './xml-cii-branch-sample-sync.js?v=20260620-rich-state-refresh-1';
import { installXmlCiiLineKeySelectPatch } from './xml-cii-linekey-select-patch.js?v=20260620-rich-state-refresh-1';
import { installInputXmlBasicGlbBridge } from './inputxml-basic-glb-bridge.js';
import { installXmlCiiDefaultMasterAutoload, installXmlCiiRecoveryPatch } from '../xml-cii-master-autoload-patch.js?v=20260620-rich-state-refresh-1';
import { installXmlCiiPreviewLineKeyRemap } from './xml-cii-preview-linekey-remap.js?v=20260620-rich-state-refresh-1';

const TRACE_PREFIX = '[BM_CII_CONVERTER_TRACE]';

/**
 * Ordered installer pairs. Each entry is [debugName, installerFn].
 * Adding a new popup/bridge: append one entry here — no other changes needed.
 *
 * @type {ReadonlyArray<[string, (container: HTMLElement) => void]>}
 */
const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['rvmattr-uxml-addon', installRvmAttrUxmlAddon],
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['xml-cii-branch-sample-sync', installXmlCiiBranchSampleSync],
  ['xml-cii-linekey-select-patch', installXmlCiiLineKeySelectPatch],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
  ['inputxml-basic-glb-bridge', installInputXmlBasicGlbBridge],
  ['xml-cii-default-master-autoload', installXmlCiiDefaultMasterAutoload],
  ['xml-cii-recovery-patch', installXmlCiiRecoveryPatch],
  ['xml-cii-preview-linekey-remap', installXmlCiiPreviewLineKeyRemap],
]);

export function renderModelConvertersTab(container) {
  renderLegacyModelConvertersTab(container);
  for (const [name, install] of MODEL_CONVERTER_INSTALLERS) {
    try {
      install(container);
    } catch (error) {
      console.warn(`${TRACE_PREFIX} installer failed: ${name}`, error);
    }
  }
}
