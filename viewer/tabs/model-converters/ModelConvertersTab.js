/**
 * ModelConvertersTab — orchestration shell for the Model Converters tab.
 *
 * Responsibilities (Phase 1):
 *   1. Render the base tab via the legacy adapter.
 *   2. Install popup/bridge extensions via scheduled installers.
 *   3. Remove deprecated converter options from the dropdown.
 *
 * XML->CII(2019) workflow isolation rule:
 *   - Visible XML->CII workflow buttons are owned by xml-cii-workflow-button-scope.js.
 *   - The legacy direct Run Conversion button is kept away from XML->CII popup-only mode.
 *   - Workflow 1 / Workflow 2 popup behavior is installed by xml-cii-workflow-popup.js.
 *   - Workflow modules must not restore or intercept the legacy direct run button.
 */

import './xml-cii-rich-worker-cache-bust.js?v=20260623-xml-cii-rich-worker-1';
import { renderLegacyModelConvertersTab } from './legacy-adapter.js?v=20260624-startup-autoload-noise-1';
import { installBmCiiSupportAnnotationPopup } from './bm-cii-support-annotation-popup.js?v=20260617-bmcii-open-basic-handoff-2';
import { installInputXmlPropertyTransferUi } from './inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installRvmAttrUxmlAddon } from './rvmattr-uxml-addon.js?v=20260618-port-bore-contract-1';
import { installXmlCiiWorkflowButtonScope } from './xml-cii-workflow-button-scope.js?v=20260624-startup-autoload-noise-1';
import { installXmlCiiSimpleWorkflowController } from './xml-cii-simple-workflow-controller.js?v=20260624-popup-only-1';
import { installXmlCiiWorkflowHotfix } from './xml-cii-workflow-hotfix.js?v=20260624-workflow1-workflow2-1';
import { installXmlCiiWorkflowPopup } from './xml-cii-workflow-popup.js?v=20260624-startup-autoload-noise-1';
import { installXmlCiiCondenseRigidUiBridge } from './xml-cii-condense-rigid-ui-bridge.js?v=20260624-simple-rich-isolation-1';
import { installXmlCiiBranchSampleSync } from './xml-cii-branch-sample-sync.js?v=20260620-rating-runtime-1';
import { installXmlCiiLineKeySelectPatch } from './xml-cii-linekey-select-patch.js?v=20260624-simple-rich-isolation-1';
import { installInputXmlBasicGlbBridge } from './inputxml-basic-glb-bridge.js';
import { installInputXmlManagedStageBridge } from './inputxml-managed-stage-bridge.js?v=20260623-inputxml-direct-stage-1';
import { installXmlCiiDefaultMasterAutoloadLite } from '../xml-cii-master-autoload-lite.js?v=20260624-startup-autoload-noise-1';
import { installXmlCiiRecoveryPatch } from '../xml-cii-master-autoload-patch.js?v=20260624-workflow1-workflow2-1';
import { installXmlCiiPreviewLineKeyRemap } from './xml-cii-preview-linekey-remap.js?v=20260620-rating-runtime-1';
import { installXmlCiiRuntimeOverrideSync } from './xml-cii-runtime-override-sync.js?v=20260624-master-tab-responsive-1';
import { installXmlCiiMasterPreservePatch } from './xml-cii-master-preserve-patch.js?v=20260620-master-session-1';

const TRACE_PREFIX = '[BM_CII_CONVERTER_TRACE]';
const STYLE_LINKS = Object.freeze([
  ['model-converters-tab-css', './tabs/model-converters-tab.css?v=20260624-button-scope-1'],
  ['model-converters-css-fix', './tabs/model-converters-css-fix.css?v=20260624-simple-rich-isolation-1'],
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
  container.dataset.modelConvertersCss = '20260624-button-scope-1';
  const root = container.querySelector?.('.model-converters-root');
  if (root) root.dataset.modelConvertersCss = '20260624-button-scope-1';
}

function installSafely(name, installer, container) {
  try {
    installer(container);
  } catch (error) {
    console.warn(`${TRACE_PREFIX} Optional installer failed: ${name}`, error);
  }
}

function scheduleInstallerQueue(container) {
  const queue = MODEL_CONVERTER_INSTALLERS.map((entry) => entry);
  const runNext = (deadline) => {
    const startedAt = performance?.now?.() || Date.now();
    while (queue.length) {
      const [name, install] = queue.shift();
      installSafely(name, install, container);
      const elapsed = (performance?.now?.() || Date.now()) - startedAt;
      if (deadline?.timeRemaining && deadline.timeRemaining() <= 4) break;
      if (!deadline?.timeRemaining && elapsed > 12) break;
    }
    if (!queue.length) return;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(runNext, { timeout: 750 });
    else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => runNext(null));
    else Promise.resolve().then(() => runNext(null));
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(runNext, { timeout: 750 });
  else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => runNext(null));
  else Promise.resolve().then(() => runNext(null));
}

/**
 * Ordered installer pairs. Each entry is [debugName, installerFn].
 * The button scope runs before Workflow 1/Workflow 2 popup binding so both
 * workflows bind to the same canonical current-root action row.
 *
 * @type {ReadonlyArray<[string, (container: HTMLElement) => void]>}
 */
const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['rvmattr-uxml-addon', installRvmAttrUxmlAddon],
  ['xml-cii-workflow-button-scope', installXmlCiiWorkflowButtonScope],
  ['xml-cii-simple-workflow-controller', installXmlCiiSimpleWorkflowController],
  ['xml-cii-workflow-hotfix', installXmlCiiWorkflowHotfix],
  ['xml-cii-workflow-popup', installXmlCiiWorkflowPopup],
  ['xml-cii-condense-rigid-ui-bridge', installXmlCiiCondenseRigidUiBridge],
  ['xml-cii-branch-sample-sync', installXmlCiiBranchSampleSync],
  ['xml-cii-linekey-select-patch', installXmlCiiLineKeySelectPatch],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
  ['inputxml-basic-glb-bridge', installInputXmlBasicGlbBridge],
  ['inputxml-managed-stage-bridge', installInputXmlManagedStageBridge],
  ['xml-cii-default-master-autoload-lite', installXmlCiiDefaultMasterAutoloadLite],
  ['xml-cii-recovery-patch', installXmlCiiRecoveryPatch],
  ['xml-cii-preview-linekey-remap', installXmlCiiPreviewLineKeyRemap],
  ['xml-cii-runtime-override-sync', installXmlCiiRuntimeOverrideSync],
  ['xml-cii-master-preserve-patch', installXmlCiiMasterPreservePatch],
]);

export function renderModelConvertersTab(container, ctx) {
  ensureModelConvertersStyles();
  renderLegacyModelConvertersTab(container, ctx);
  markStylesReady(container);
  scheduleInstallerQueue(container);
}
