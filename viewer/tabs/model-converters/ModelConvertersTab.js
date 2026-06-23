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

import './xml-cii-rich-worker-cache-bust.js?v=20260623-xml-cii-rich-worker-1';
import { renderLegacyModelConvertersTab } from './legacy-adapter.js?v=20260620-master-session-1';
import { installBmCiiSupportAnnotationPopup } from './bm-cii-support-annotation-popup.js?v=20260617-bmcii-open-basic-handoff-2';
import { installInputXmlPropertyTransferUi } from './inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installRvmAttrUxmlAddon } from './rvmattr-uxml-addon.js?v=20260618-port-bore-contract-1';
import { installXmlCiiCondenseRigidUiBridge } from './xml-cii-condense-rigid-ui-bridge.js?v=20260623-xml-cii-condense-rigid-ui-4';
import { installXmlCiiBranchSampleSync } from './xml-cii-branch-sample-sync.js?v=20260620-rating-runtime-1';
import { installXmlCiiLineKeySelectPatch } from './xml-cii-linekey-select-patch.js?v=20260622-regex-pos-persist-1';
import { installInputXmlBasicGlbBridge } from './inputxml-basic-glb-bridge.js';
import { installInputXmlManagedStageBridge } from './inputxml-managed-stage-bridge.js?v=20260623-inputxml-direct-stage-1';
import { installXmlCiiDefaultMasterAutoload, installXmlCiiRecoveryPatch } from '../xml-cii-master-autoload-patch.js?v=20260620-master-session-1';
import { installXmlCiiPreviewLineKeyRemap } from './xml-cii-preview-linekey-remap.js?v=20260620-rating-runtime-1';
import { installXmlCiiRuntimeOverrideSync } from './xml-cii-runtime-override-sync.js?v=20260620-rating-runtime-1';
import { installXmlCiiMasterPreservePatch } from './xml-cii-master-preserve-patch.js?v=20260620-master-session-1';

const TRACE_PREFIX = '[BM_CII_CONVERTER_TRACE]';
const STYLE_LINKS = Object.freeze([
  ['model-converters-tab-css', './tabs/model-converters-tab.css?v=20260621-model-converters-css-1'],
  ['model-converters-css-fix', './tabs/model-converters-css-fix.css?v=20260621-model-converters-css-1'],
]);

function ensureStylesheet(id, href) {
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.getAttribute('href') !== href) existing.setAttribute('href', href);
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.owner = 'model-converters-tab';
  document.head.appendChild(link);
}

function ensureModelConvertersStyles() {
  if (typeof document === 'undefined') return;
  for (const [id, href] of STYLE_LINKS) ensureStylesheet(id, href);
}

function markStylesReady(container) {
  if (!container) return;
  container.classList.add('model-converters-style-ready');
  container.dataset.modelConvertersCss = '20260621-model-converters-css-1';
  const root = container.querySelector?.('.model-converters-root');
  if (root) root.dataset.modelConvertersCss = '20260621-model-converters-css-1';
}

function installSafely(name, installer, container) {
  try {
    installer(container);
  } catch (error) {
    console.warn(`${TRACE_PREFIX} Optional installer failed: ${name}`, error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

/**
 * Ordered installer pairs. Each entry is [debugName, installerFn].
 * Adding a new popup/bridge: append one entry here — no other changes needed.
 *
 * @type {ReadonlyArray<[string, (container: HTMLElement) => void]>}
 */
const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['rvmattr-uxml-addon', installRvmAttrUxmlAddon],
  ['xml-cii-condense-rigid-ui-bridge', installXmlCiiCondenseRigidUiBridge],
  ['xml-cii-branch-sample-sync', installXmlCiiBranchSampleSync],
  ['xml-cii-linekey-select-patch', installXmlCiiLineKeySelectPatch],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
  ['inputxml-basic-glb-bridge', installInputXmlBasicGlbBridge],
  ['inputxml-managed-stage-bridge', installInputXmlManagedStageBridge],
  ['xml-cii-default-master-autoload', installXmlCiiDefaultMasterAutoload],
  ['xml-cii-recovery-patch', installXmlCiiRecoveryPatch],
  ['xml-cii-preview-linekey-remap', installXmlCiiPreviewLineKeyRemap],
  ['xml-cii-runtime-override-sync', installXmlCiiRuntimeOverrideSync],
  ['xml-cii-master-preserve-patch', installXmlCiiMasterPreservePatch],
]);

export function renderModelConvertersTab(container, ctx) {
  ensureModelConvertersStyles();
  renderLegacyModelConvertersTab(container, ctx);
  markStylesReady(container);
  for (const [name, install] of MODEL_CONVERTER_INSTALLERS) {
    scheduleInstaller(name, install, container);
  }
}
