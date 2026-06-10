import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installXmlCiiPreviewLineKeyRemap } from './model-converters/xml-cii-preview-linekey-remap.js';
import { installXmlCiiDefaultMasterAutoload, installXmlCiiRecoveryPatch } from './xml-cii-master-autoload-patch.js';

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);
  installXmlCiiDefaultMasterAutoload();
  installXmlCiiRecoveryPatch();
  installXmlCiiPreviewLineKeyRemap();
  return result;
}
