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

function installInputXmlDxfImmediateEnhancers(container) {
  try {
    // Keep this synchronous and explicit: the branch picker and symbol checkbox are
    // lightweight InputXML→DXF enhancers and their static gate checks these calls.
    installInputXmlDxfBranchPicker(container);
    installInputXmlDxfSymbolOption(container);
  } catch (error) {
    console.error('[ModelConverters] Optional installer failed: inputxml-dxf-immediate-enhancers', error);
  }
}

function scheduleInstaller(name, installer, container) {
  const run = () => installSafely(name, installer, container);
  setTimeout(run, 0);
}

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);

  // Install critical lightweight InputXML→DXF enhancers immediately after legacy
  // render so controls are available to tests/users without waiting for the
  // deferred converter helper queue.
  installInputXmlDxfImmediateEnhancers(container);

  // Emergency responsiveness guard:
  // keep the legacy converter UI as the only synchronous renderer. XML/CII popup
  // is now a lightweight launcher only; heavy XML/CII observer/nesting installers
  // are intentionally not auto-installed here.
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));

  return result;
}
