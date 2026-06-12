import './psnm-utility/psnm-context-actions.js?v=20260610-context-actions-2';
import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
import { renderPSNM_UtilityTab as renderPSNMCoreUtilityTab } from './psnm-utility-tab-v6.js?v=20260612-psnm-direct-auto-anchor-1';
import { installPsMappingUtilityTile } from './ps-mapping-utility-tab-tally-ui.js?v=20260612-psmap-tally-mount-input-fix-1';
import { installPsMappingModalBridge } from './ps-mapping-utility/ps-mapping-modal-bridge.js?v=20260611-modal-bridge-1';
import './ps-mapping-utility/ps-mapping-mandatory-audit-shim.js?v=20260610-psmap-audit-tag-1';

function mountPsMappingLauncher(container, ctx) {
  const utilitiesRoot = container.querySelector('.psnm-root') || container;
  if (utilitiesRoot.querySelector('[data-psmap-action="open"]')) return null;
  return installPsMappingUtilityTile(utilitiesRoot, ctx);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  const destroyPSNM = renderPSNMCoreUtilityTab(container, ctx);
  const destroyPsMapping = mountPsMappingLauncher(container, ctx);
  const destroyBridge = installPsMappingModalBridge?.(container, ctx);
  return () => {
    try { destroyBridge?.(); } catch {}
    try { destroyPsMapping?.(); } catch {}
    try { destroyPSNM?.(); } catch {}
  };
}
