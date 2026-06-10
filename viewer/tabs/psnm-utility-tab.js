// Stable route: PSNM core v6 only.
// Overlay modules are temporarily disabled after popup hang/no-response report.
// These lightweight modules use bounded event handlers only; no MutationObserver.
import './psnm-utility/psnm-context-actions.js?v=20260610-context-actions-2';
import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
export { renderPSNM_UtilityTab } from './psnm-utility-tab-v6.js?v=20260609-psnm-v6-stable-1';
