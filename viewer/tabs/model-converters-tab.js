import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installBmCiiSupportAnnotationPopup } from './model-converters/bm-cii-support-annotation-popup.js';
import { installInputXmlDxfBranchPicker } from './model-converters/inputxml-dxf-branch-picker.js';
import { installInputXmlDxfLegacyBridge } from './model-converters/inputxml-dxf-legacy-bridge.js';
import { installInputXmlDxfProjectionOption } from './model-converters/inputxml-dxf-projection-option.js';
import { installInputXmlDxfSymbolOption } from './model-converters/inputxml-dxf-symbol-option.js';
import { installInputXmlGlbLegacyBridge } from './model-converters/inputxml-glb-legacy-bridge.js';
import { installInputXmlPropertyTransferUi } from './model-converters/inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1';
import { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';

const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['inputxml-dxf-legacy-bridge', installInputXmlDxfLegacyBridge],
  ['inputxml-dxf-symbol-option', installInputXmlDxfSymbolOption],
  ['inputxml-dxf-projection-option', installInputXmlDxfProjectionOption],
  ['inputxml-glb-legacy-bridge', installInputXmlGlbLegacyBridge],
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

function installBranchPickerImmediately(container) {
  try {
    installInputXmlDxfBranchPicker(container);
  } catch (error) {
    console.error('[ModelConverters] Optional installer failed: inputxml-dxf-branch-picker', error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);
  installBranchPickerImmediately(container);
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));
  return result;
}
