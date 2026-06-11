import './psnm-utility/psnm-context-actions.js?v=20260610-context-actions-2';
import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
import { renderPSNM_UtilityTab as renderPSNMCoreUtilityTab } from './psnm-utility-tab-v6.js?v=20260609-psnm-v6-stable-1';
import { installPsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260611-line-diagnostics-ui-1';
import './ps-mapping-utility/ps-mapping-mandatory-audit-shim.js?v=20260610-psmap-audit-tag-1';

function mountPsMappingLauncher(container, ctx) {
  const utilitiesRoot = container.querySelector('.psnm-root') || container;
  if (utilitiesRoot.querySelector('[data-psmap-action="open"]')) return null;
  return installPsMappingUtilityTile(utilitiesRoot, ctx);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  const destroyCore = renderPSNMCoreUtilityTab(container, ctx);
  const destroyPsMap = mountPsMappingLauncher(container, ctx);
  return () => {
    try { destroyPsMap?.(); } catch {}
    try { destroyCore?.(); } catch {}
  };
}
