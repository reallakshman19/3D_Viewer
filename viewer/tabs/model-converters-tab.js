import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installXmlCiiDefaultMasterAutoload } from './xml-cii-master-autoload-patch.js';
import { installXmlCiiRecoveryPatch } from './xml-cii-recovery-patch.js';

export function renderModelConvertersTab(container, ctx) {
  installXmlCiiDefaultMasterAutoload();
  installXmlCiiRecoveryPatch();
  return renderLegacyModelConvertersTab(container, ctx);
}
