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

import { renderLegacyModelConvertersTab } from './legacy-adapter.js?v=20260619-git-ss-adapt-8';
import { installBmCiiSupportAnnotationPopup } from './bm-cii-support-annotation-popup.js?v=20260617-bmcii-open-basic-handoff-2';
import { installInputXmlPropertyTransferUi } from './inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installRvmAttrUxmlAddon } from './rvmattr-uxml-addon.js?v=20260618-port-bore-contract-1';
import { installXmlCiiConversionWorkflowPopup } from './xml-cii-conversion-workflow-popup.js?v=20260619-git-ss-adapt-8';
import { installXmlCiiBranchSampleSync } from './xml-cii-branch-sample-sync.js?v=20260619-xml-cii-branch-sample-1';
import { installInputXmlBasicGlbBridge } from './inputxml-basic-glb-bridge.js';
import { installXmlCiiDefaultMasterAutoload, installXmlCiiRecoveryPatch } from '../xml-cii-master-autoload-patch.js';
import { installXmlCiiPreviewLineKeyRemap } from './xml-cii-preview-linekey-remap.js';

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
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
  ['inputxml-basic-glb-bridge', installInputXmlBasicGlbBridge],
  ['xml-cii-default-master-autoload', installXmlCiiDefaultMasterAutoload],
  ['xml-cii-recovery-patch', installXmlCiiRecoveryPatch],
  ['xml-cii-preview-linekey-remap', installXmlCiiPreviewLineKeyRemap],
]);

function trace(message, payload = {}) {
  try {
    console.log(`${TRACE_PREFIX} ${message}`, payload);
  } catch {}
}

function removeDeprecatedConverterOptions(container) {
  const root = container instanceof Element ? container : document;
  const selects = Array.from(root.querySelectorAll('select'));
  const removed = [];
  for (const select of selects) {
    for (const option of Array.from(select.options || [])) {
      const text = `${option.textContent || ''} ${option.value || ''}`.toLowerCase();
      if (text.includes('rich glb') || text.includes('bm_cii rich') || text.includes('bm-cii rich')) {
        removed.push({ text: option.textContent, value: option.value });
        option.remove();
      }
    }
  }
  if (removed.length) trace('removed deprecated rich GLB option', { removed });
  else trace('deprecated rich GLB option absent', { selects: selects.length });
}

function installSafely(name, installer, container) {
  try {
    trace('install start', { installer: name });
    installer(container);
    trace('install done', { installer: name });
  } catch (error) {
    console.warn(`Optional installer failed: ${name}`, error);
    trace('install failed', { installer: name, error: error?.message || String(error) });
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

function runInstallers(container) {
  for (const [name, installer] of MODEL_CONVERTER_INSTALLERS) {
    scheduleInstaller(name, installer, container);
  }
}

function cleanupBodyLevelWorkflowOverlays() {
  document.querySelectorAll('.model-converters-workflow-popup-overlay').forEach((el) => el.remove());
  document.querySelectorAll('[data-xml-cii-finalise-run-guard], [data-xml-cii-workflow-button-guard]').forEach((el) => el.remove());
  if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
}

export function renderModelConvertersTab(container, ctx = {}) {
  trace('render start', { containerPresent: Boolean(container) });
  const destroy = renderLegacyModelConvertersTab(container, ctx);
  removeDeprecatedConverterOptions(container);
  runInstallers(container);
  trace('render done', { installers: MODEL_CONVERTER_INSTALLERS.map(([name]) => name) });
  return () => {
    cleanupBodyLevelWorkflowOverlays();
    if (typeof destroy === 'function') destroy();
  };
}
