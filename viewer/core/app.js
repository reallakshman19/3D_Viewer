import { loadStickyState, state, setActiveTab } from './state.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { renderViewer3D } from '../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12';
import { renderViewer3DRvm } from '../tabs/viewer3d-rvm-tab.js?v=20260518-statusbar-theme-12';
import { renderBasicGlbPcfPanel } from '../js/pcf2glb/ui/BasicGlbPcfPanel.js';
import { renderPcfxConverterTab } from '../tabs/pcfx-converter-tab.js';
import { renderModelExchangeTab } from '../tabs/model-exchange-tab.js';
import { renderInterchangeConfigTab } from '../tabs/interchange-config-tab.js';
import { renderSupportMappingConfigTab } from '../tabs/support-mapping-config-tab.js';
import { renderAdapterMappingTab } from '../tabs/adapter-mapping-tab.js';
import { mount as mountRvmJsonPcfExtractTab } from '../tabs/rvm-json-pcf-extract-tab.js';
import { renderUniversalXmlConverterTab } from '../tabs/universal-xml-converter-tab.js';
import { renderXmlCompareTab } from '../tabs/xml-compare-tab.js';
import { renderPSNM_UtilityTab } from '../tabs/psnm-utility-tab.js?v=20260610-psnm-15';
import '../tabs/psnm-utility/psnm-ui-p2-enhancements.js?v=20260609-p2-1';
import '../tabs/psnm-utility/psnm-phase4c-hardening.js?v=20260609-phase4c-1';
import '../tabs/psnm-utility/psnm-phase4d-persistence.js?v=20260609-phase4d-1';
import { emit, on } from './event-bus.js';
import { initDevDebugWindow, destroyDevDebugWindow } from '../debug/dev-debug-window.js';
import { loadRvmSource } from '../rvm/RvmLoadPipeline.js';

const renderers = {
  viewer3d: renderViewer3D,
  rvm: renderViewer3DRvm,
  pcf2glb: renderBasicGlbPcfPanel,
  pcfx: renderPcfxConverterTab,
  modelExchange: renderModelExchangeTab,
  interchangeConfig: renderInterchangeConfigTab,
  supportMapping: renderSupportMappingConfigTab,
  adapterMapping: renderAdapterMappingTab,
  rvmJsonPcfExtract: mountRvmJsonPcfExtractTab,
  universalXml: renderUniversalXmlConverterTab,
  xmlCompare: renderXmlCompareTab,
  psnmUtility: renderPSNM_UtilityTab,
};

let activeDestroy = null;
let shellRefs = null;

function setStatus(message) {
  if (!shellRefs?.status) return;
  shellRefs.status.textContent = message || '';
}

function getTabButton(tab) {
  return shellRefs?.nav?.querySelector(`[data-tab="${tab}"]`) || null;
}

function updateActiveNav(tab) {
  if (!shellRefs?.nav) return;
  shellRefs.nav.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

function createContext(tab) {
  return {
    tab,
    state,
    setStatus,
    emit,
    on,
    showToast(message, type = 'info') {
      emit(RuntimeEvents.ToastShow, { message, type });
    },
  };
}

export function renderActiveTab(tab = state.activeTab) {
  if (!shellRefs?.main) return;
  if (activeDestroy) {
    try { activeDestroy(); } catch (error) { console.warn('Tab destroy failed', error); }
    activeDestroy = null;
  }
  shellRefs.main.innerHTML = '';
  updateActiveNav(tab);
  setStatus('');
  const renderer = renderers[tab] || renderViewer3D;
  const result = renderer(shellRefs.main, createContext(tab));
  if (typeof result === 'function') activeDestroy = result;
}

export function mountApp(shell) {
  loadStickyState();
  shellRefs = shell;
  initDevDebugWindow();
  if (shellRefs?.nav) {
    shellRefs.nav.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab;
      setActiveTab(tab);
      renderActiveTab(tab);
    });
  }
  renderActiveTab(state.activeTab);
  return () => {
    if (activeDestroy) activeDestroy();
    destroyDevDebugWindow();
  };
}

export { loadRvmSource };
