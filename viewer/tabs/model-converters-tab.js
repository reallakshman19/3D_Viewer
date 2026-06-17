import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installBmCiiSupportAnnotationPopup } from './model-converters/bm-cii-support-annotation-popup.js?v=20260617-bmcii-enrich-fix-2';
import { installInputXmlPropertyTransferUi } from './model-converters/inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';

const TRACE_PREFIX = '[BM_CII_CONVERTER_TRACE]';

const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
]);

function trace(message, payload = {}) {
  try {
    console.log(`${TRACE_PREFIX} ${message}`, payload);
  } catch {}
}

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
      options: Array.from(container?.querySelectorAll?.('#model-converters-select option') || []).map((option) => option.value),
    });
  } catch (error) {
    console.error(`[ModelConverters] Optional installer failed: ${name}`, error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

export function renderModelConvertersTab(container, ctx) {
  trace('render start', { ctxKeys: Object.keys(ctx || {}) });
  const result = renderLegacyModelConvertersTab(container, ctx);
  removeDeprecatedRichGlbOption(container);
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));
  setTimeout(() => removeDeprecatedRichGlbOption(container), 0);
  setTimeout(() => removeDeprecatedRichGlbOption(container), 250);
  trace('render done', {
    selectValue: container?.querySelector?.('#model-converters-select')?.value || '',
    options: Array.from(container?.querySelectorAll?.('#model-converters-select option') || []).map((option) => option.value),
  });
  return result;
}
