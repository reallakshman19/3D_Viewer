import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installBmCiiSupportAnnotationPopup } from './model-converters/bm-cii-support-annotation-popup.js';
import { installInputXmlPropertyTransferUi } from './model-converters/inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';

const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['bm-cii-support-annotation-popup', installBmCiiSupportAnnotationPopup],
  ['inputxml-property-transfer-popup-ui-v4', installInputXmlPropertyTransferUi],
]);

function installSafely(name, installer, container) {
  try {
    installer(container);
  } catch (error) {
    console.error(`[ModelConverters] Optional installer failed: ${name}`, error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));
  return result;
}
