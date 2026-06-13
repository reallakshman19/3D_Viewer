import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installInputXmlDxfBranchPicker } from './model-converters/inputxml-dxf-branch-picker.js';
import { installInputXmlDxfLegacyBridge } from './model-converters/inputxml-dxf-legacy-bridge.js';
import { installInputXmlDxfProjectionOption } from './model-converters/inputxml-dxf-projection-option.js';
import { installInputXmlDxfSymbolOption } from './model-converters/inputxml-dxf-symbol-option.js';
import { installInputXmlGlbLegacyBridge } from './model-converters/inputxml-glb-legacy-bridge.js';
import { installXmlCiiPreviewLineKeyRemap } from './model-converters/xml-cii-preview-linekey-remap.js';
import { installXmlCiiWorkflowUiFixes } from './model-converters/xml-cii-workflow-ui-fixes.js';
import { installXmlCiiSideloadUi } from './model-converters/xml-cii-sideload-ui.js';
import { installXmlCiiSideloadJsonConfigTools } from './model-converters/xml-cii-sideload-json-config-tools.js';
import { installXmlCiiMatchedPreviewUi } from './model-converters/xml-cii-matched-preview-ui.js';
import { installXmlCiiConversionWorkflowPopup } from './model-converters/xml-cii-conversion-workflow-popup.js';
import { installXmlCiiConversionWorkflowModelDataNesting } from './model-converters/xml-cii-conversion-workflow-model-data-nesting.js';
import { installXmlCiiConversionWorkflowProcessNesting } from './model-converters/xml-cii-conversion-workflow-process-nesting.js';
import { installXmlCiiConversionWorkflowAuditOutputNesting } from './model-converters/xml-cii-conversion-workflow-audit-output-nesting.js';
import { installXmlCiiConversionWorkflowPolish } from './model-converters/xml-cii-conversion-workflow-polish.js';
import { installXmlCiiDefaultMasterAutoload, installXmlCiiRecoveryPatch } from './xml-cii-master-autoload-patch.js';

const MODEL_CONVERTER_INSTALLERS = Object.freeze([
  ['xml-cii-default-master-autoload', installXmlCiiDefaultMasterAutoload],
  ['xml-cii-recovery-patch', installXmlCiiRecoveryPatch],
  ['xml-cii-preview-line-key-remap', installXmlCiiPreviewLineKeyRemap],
  ['xml-cii-workflow-ui-fixes', installXmlCiiWorkflowUiFixes],
  ['xml-cii-sideload-ui', installXmlCiiSideloadUi],
  ['xml-cii-sideload-json-config-tools', installXmlCiiSideloadJsonConfigTools],
  ['xml-cii-matched-preview-ui', installXmlCiiMatchedPreviewUi],
  ['xml-cii-conversion-workflow-popup', installXmlCiiConversionWorkflowPopup],
  ['xml-cii-conversion-workflow-model-data-nesting', installXmlCiiConversionWorkflowModelDataNesting],
  ['xml-cii-conversion-workflow-process-nesting', installXmlCiiConversionWorkflowProcessNesting],
  ['xml-cii-conversion-workflow-audit-output-nesting', installXmlCiiConversionWorkflowAuditOutputNesting],
  ['xml-cii-conversion-workflow-polish', installXmlCiiConversionWorkflowPolish],
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
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 700 });
    return;
  }
  setTimeout(run, 0);
}

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);

  // Keep the tab responsive even if an optional XML/CII/DXF enhancer regresses.
  // The legacy converter UI must render first; enhancement failures are logged but
  // must not prevent the Model Converters tab from opening.
  MODEL_CONVERTER_INSTALLERS.forEach(([name, installer]) => scheduleInstaller(name, installer, container));

  return result;
}
