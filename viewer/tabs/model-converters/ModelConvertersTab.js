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

import { renderLegacyModelConvertersTab } from './legacy-adapter.js?v=20260617-basic-glb-2';
import { installBmCiiSupportAnnotationPopup } from './bm-cii-support-annotation-popup.js?v=20260617-bmcii-open-basic-handoff-2';
import { installInputXmlPropertyTransferUi } from './inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installRvmAttrUxmlAddon } from './rvmattr-uxml-addon.js?v=20260618-active-registry-uxml-1';
import { installXmlCiiConversionWorkflowPopup } from './xml-cii-conversion-workflow-popup.js';
import { installInputXmlBasicGlbBridge } from './inputxml-basic-glb-bridge.js';

const TRACE_PREFIX = '[BM_CII_CONVERTER_TRACE]';

/**
 * Ordered installer pairs.  Each entry is [debugName, installerFn].
 * Adding a new popup/bridge: append one entry here — no other changes needed.
 *
 * @type {ReadonlyArray<[string, (container: HTMLElement) => void]>}
 */
const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['rvmattr-uxml-addon', installRvmAttrUxmlAddon],
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
  ['inputxml-basic-glb-bridge', installInputXmlBasicGlbBridge],
]);

function trace(message, payload = {}) {
  try {
    console.log(`${TRACE_PREFIX} ${message}`, payload);
  } catch {}
}

/**
 * Remove the deprecated rich GLB option from the converter select element.
 * Called immediately after render and again after 0 ms and 250 ms to survive
 * any deferred DOM writes by the legacy adapter.
 *
 * @param {HTMLElement} container
 */
function removeDeprecatedRichGlbOption(container) {
  const select = container?.querySelector?.('#model-converters-select');
  if (!select) return;
  const richOption = select.querySelector('option[value="inputxml_to_glb"]');
  if (!richOption) {
    trace('deprecated rich GLB option absent', { selectValue: select.value });
    return;
  }
  const wasSelected = select.value === 'inputxml_to_glb';
  richOption.remove();
  if (wasSelected) {
    const bmCii = select.querySelector('option[value="bmcii_support_annotation_glb"]');
    if (bmCii) {
      select.value = 'bmcii_support_annotation_glb';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  trace('removed deprecated rich GLB option', {
    wasSelected,
    newValue: select.value,
    options: Array.from(select.options || []).map((option) => option.value),
  });
}

function installSafely(name, installer, container) {
  try {
    trace('install start', { name });
    installer(container);
    trace('install done', {
      name,
      selectValue: container?.querySelector?.('#model-converters-select')?.value || '',
      options: Array.from(
        container?.querySelectorAll?.('#model-converters-select option') || [],
      ).map((option) => option.value),
    });
  } catch (error) {
    console.error(`[ModelConvertersTab] Optional installer failed: ${name}`, error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

/**
 * Render the Model Converters tab into `container`.
 *
 * Returns the cleanup function produced by the legacy adapter (dispose worker
 * runtime and preview renderer).
 *
 * @param {HTMLElement} container
 * @param {Object} [ctx]  - Tab context forwarded from the viewer shell.
 * @returns {Function|undefined}  Cleanup / dispose function.
 */
export function renderModelConvertersTab(container, ctx) {
  trace('render start', { ctxKeys: Object.keys(ctx || {}) });
  const result = renderLegacyModelConvertersTab(container, ctx);
  removeDeprecatedRichGlbOption(container);
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) =>
    scheduleInstaller(name, installer, container),
  );
  setTimeout(() => removeDeprecatedRichGlbOption(container), 0);
  setTimeout(() => removeDeprecatedRichGlbOption(container), 250);
  trace('render done', {
    selectValue: container?.querySelector?.('#model-converters-select')?.value || '',
    options: Array.from(
      container?.querySelectorAll?.('#model-converters-select option') || [],
    ).map((option) => option.value),
  });
  return result;
}
