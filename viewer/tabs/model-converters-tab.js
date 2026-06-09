import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installXmlCiiDefaultMasterAutoload, installXmlCiiRecoveryPatch } from './xml-cii-master-autoload-patch.js';

export function renderModelConvertersTab(container, ctx) {
  const result = renderLegacyModelConvertersTab(container, ctx);
  installXmlCiiDefaultMasterAutoload();
  installXmlCiiRecoveryPatch();
  return result;
}
