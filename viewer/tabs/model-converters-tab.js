import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installInputXmlDxfBranchPicker } from './model-converters/inputxml-dxf-branch-picker.js';
import { installInputXmlDxfLegacyBridge } from './model-converters/inputxml-dxf-legacy-bridge.js';
import { installInputXmlDxfProjectionOption } from './model-converters/inputxml-dxf-projection-option.js';
import { installInputXmlDxfSymbolOption } from './model-converters/inputxml-dxf-symbol-option.js';
import { installInputXmlGlbLegacyBridge } from './model-converters/inputxml-glb-legacy-bridge.js';
import { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';

const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['inputxml-dxf-legacy-bridge', installInputXmlDxfLegacyBridge],
  ['inputxml-dxf-branch-picker', installInputXmlDxfBranchPicker],
  ['inputxml-dxf-symbol-option', installInputXmlDxfSymbolOption],
  ['inputxml-dxf-projection-option', installInputXmlDxfProjectionOption],
  ['inputxml-glb-legacy-bridge', installInputXmlGlbLegacyBridge],
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

  // Emergency responsiveness guard:
  // keep the legacy converter UI as the only synchronous renderer. XML/CII popup
  // is now a lightweight launcher only; heavy XML/CII observer/nesting installers
  // are intentionally not auto-installed here.
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));

  return result;
}
