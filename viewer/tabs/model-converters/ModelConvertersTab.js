/**
 * ModelConvertersTab — orchestration shell for the Model Converters tab.
 *
 * Responsibilities:
 *   1. Render the base tab via the legacy adapter.
 *   2. Install source-owned popup/bridge extensions through one guarded queue.
 *   3. Keep XML->CII(2019) Workflow 1 / Workflow 2 popup-only UI isolated.
 *
 * XML->CII(2019) workflow consolidation rule:
 *   - No XML->CII patch/hotfix modules are imported from this shell.
 *   - Workflow 1 popup UI is owned by xml-cii-workflow-popup.js.
 *   - Workflow 2 popup UI is owned by xml-cii-workflow2-popup.js.
 *   - Condense Rigid option state is owned by xml-cii-workflow-bridge.js.
 *   - Enriched XML corrections are owned by xmltocii2019_runner.js.
 */

import './xml-cii-rich-worker-cache-bust.js?v=20260623-xml-cii-rich-worker-1';
import { renderLegacyModelConvertersTab } from './legacy-adapter.js?v=20260624-startup-autoload-noise-1';
import { installBmCiiSupportAnnotationPopup } from './bm-cii-support-annotation-popup.js?v=20260617-bmcii-open-basic-handoff-2';
import { installInputXmlPropertyTransferUi } from './inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installRvmAttrUxmlAddon } from './rvmattr-uxml-addon.js?v=20260618-port-bore-contract-1';
import { installXmlCiiWorkflowButtonScope } from './xml-cii-workflow-button-scope.js?v=20260624-workflow2-standalone-1';
import { installXmlCiiSimpleWorkflowController } from './xml-cii-simple-workflow-controller.js?v=20260624-workflow-consolidation-1';
import { installXmlCiiWorkflowPopup } from './xml-cii-workflow-popup.js?v=20260624-workflow2-standalone-1';
import { installXmlCiiWorkflow2Popup } from './xml-cii-workflow2-popup.js?v=20260624-workflow2-standalone-1';
import { installXmlCiiBranchSampleSync } from './xml-cii-branch-sample-sync.js?v=20260624-workflow-consolidation-1';
import { installInputXmlBasicGlbBridge } from './inputxml-basic-glb-bridge.js';
import { installInputXmlManagedStageBridge } from './inputxml-managed-stage-bridge.js?v=20260623-inputxml-direct-stage-1';
import { installXmlCiiDefaultMasterAutoloadLite } from '../xml-cii-master-autoload-lite.js?v=20260624-startup-autoload-noise-1';
import { installXmlCiiPreviewLineKeyRemap } from './xml-cii-preview-linekey-remap.js?v=20260620-rating-runtime-1';
import { installXmlCiiRuntimeOverrideSync } from './xml-cii-runtime-override-sync.js?v=20260624-master-tab-responsive-1';

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

function monotonicNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function scheduleModelConverterTask(callback) {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(callback, { timeout: 750 });
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(() => callback(null));
  return Promise.resolve().then(() => callback(null));
}

function scheduleInstallerQueue(container) {
  const queue = MODEL_CONVERTER_INSTALLERS.map((entry) => entry);
  const runNext = (deadline) => {
    const startedAt = monotonicNow();
    while (queue.length) {
      const [name, install] = queue.shift();
      installSafely(name, install, container);
      const elapsed = monotonicNow() - startedAt;
      if (deadline?.timeRemaining && deadline.timeRemaining() <= 4) break;
      if (!deadline?.timeRemaining && elapsed > 12) break;
    }
    if (queue.length) scheduleModelConverterTask(runNext);
  };
  scheduleModelConverterTask(runNext);
}

/**
 * Ordered installer pairs. Each entry is [debugName, installerFn].
 * The XML->CII entries here are source-level owners only; active hotfix/patch
 * modules are deliberately excluded from the runtime import path.
 *
 * @type {ReadonlyArray<[string, (container: HTMLElement) => void]>}
 */
const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['rvmattr-uxml-addon', installRvmAttrUxmlAddon],
  ['xml-cii-workflow-button-scope', installXmlCiiWorkflowButtonScope],
  ['xml-cii-simple-workflow-controller', installXmlCiiSimpleWorkflowController],
  ['xml-cii-workflow1-popup', installXmlCiiWorkflowPopup],
  ['xml-cii-workflow2-popup', installXmlCiiWorkflow2Popup],
  ['xml-cii-branch-sample-sync', installXmlCiiBranchSampleSync],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
  ['inputxml-basic-glb-bridge', installInputXmlBasicGlbBridge],
  ['inputxml-managed-stage-bridge', installInputXmlManagedStageBridge],
  ['xml-cii-default-master-autoload-lite', installXmlCiiDefaultMasterAutoloadLite],
  ['xml-cii-preview-linekey-remap', installXmlCiiPreviewLineKeyRemap],
  ['xml-cii-runtime-override-sync', installXmlCiiRuntimeOverrideSync],
]);

export function renderModelConvertersTab(container, ctx) {
  ensureModelConvertersStyles();
  renderLegacyModelConvertersTab(container, ctx);
  markStylesReady(container);
  scheduleInstallerQueue(container);
}
