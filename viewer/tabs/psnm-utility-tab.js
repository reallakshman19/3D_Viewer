// Stable route: PSNM core v6 only.
// Overlay modules are temporarily disabled after popup hang/no-response report.
// These lightweight modules use bounded event handlers only; no MutationObserver.
import './psnm-utility/psnm-context-actions.js?v=20260610-context-actions-2';
import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
import { renderPSNM_UtilityTab as renderPSNMCoreUtilityTab } from './psnm-utility-tab-v6.js?v=20260609-psnm-v6-stable-1';
import { installPsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260610-psmap-support-1';

export function renderPSNM_UtilityTab(container, ctx = {}) {
  const destroyCore = renderPSNMCoreUtilityTab(container, ctx);
  installPsMappingUtilityTile(container, ctx);
  return () => {
    try { destroyCore?.(); } catch {}
  };
}
