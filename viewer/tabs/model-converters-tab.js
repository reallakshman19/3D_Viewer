import { renderLegacyModelConvertersTab } from './model-converters/legacy-adapter.js';
import { installXmlCiiDefaultMasterAutoload } from './xml-cii-master-autoload-patch.js';

export function renderModelConvertersTab(container, ctx) {
  installXmlCiiDefaultMasterAutoload();
  return renderLegacyModelConvertersTab(container, ctx);
}
