import { loadStickyState, state, setActiveTab } from './state.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { emit, on } from './event-bus.js';
import { initDevDebugWindow } from '../debug/dev-debug-window.js';

const TAB_VISIBILITY_URL = new URL('../config/tab-visibility.json', import.meta.url).href;

const TAB_ID_ALIASES = new Map([
  ['viewer', 'viewer3d'],
  ['viewer3d', 'viewer3d'],
  ['rvm-viewer', 'viewer3d-rvm'],
  ['viewer3d-rvm', 'viewer3d-rvm'],
  ['converter', 'model-converters'],
  ['model-converters', 'model-converters'],
  ['basic-glb-pcf', 'basic-glb-pcf'],
  ['pcfx-converter', 'pcfx-converter'],
  ['model-exchange', 'model-exchange'],
  ['interchange-config', 'interchange-config'],
  ['support-mapping-config', 'support-mapping-config'],
  ['adapter-mapping', 'adapter-mapping'],
  ['rvm-json-pcf', 'rvm-json-pcf'],
  ['universal-xml', 'universal-xml'],
  ['xml-compare', 'xml-compare'],
  ['psnm-utility', 'psnm-utility'],
]);

function pickRenderer(module, exportName, tabId) {
  const renderer = module?.[exportName];
  if (typeof renderer !== 'function') {
    throw new Error(`Tab ${tabId} did not export renderer ${exportName}`);
  }
  return renderer;
}

async function loadPsnmUtilityRenderer() {
  await Promise.allSettled([
    import('../tabs/psnm-utility/psnm-ui-p2-enhancements.js?v=20260609-p2-1'),
    import('../tabs/psnm-utility/psnm-phase4c-hardening.js?v=20260609-phase4c-1'),
    import('../tabs/psnm-utility/psnm-phase4d-persistence.js?v=20260609-phase4d-1'),
  ]);
  return import('../tabs/psnm-utility-tab.js?v=20260611-psnm-23-psmap-visible-launcher-1')
    .then((module) => pickRenderer(module, 'renderPSNM_UtilityTab', 'psnm-utility'));
}

const TABS = [
  { id: 'viewer3d', label: '3D Viewer', load: () => import('../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12').then((module) => pickRenderer(module, 'renderViewer3D', 'viewer3d')) },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', load: () => import('../tabs/viewer3d-rvm-tab.js?v=20260518-statusbar-theme-12').then((module) => pickRenderer(module, 'renderViewer3DRvm', 'viewer3d-rvm')) },
  { id: 'model-converters', label: '3D Model Converters', load: () => import('../tabs/model-converters-tab.js').then((module) => pickRenderer(module, 'renderModelConvertersTab', 'model-converters')) },
  { id: 'basic-glb-pcf', label: 'Basic GLB-PCF', load: () => import('../js/pcf2glb/ui/BasicGlbPcfPanel.js').then((module) => pickRenderer(module, 'renderBasicGlbPcfPanel', 'basic-glb-pcf')) },
  { id: 'pcfx-converter', label: 'PCFX Converter', load: () => import('../tabs/pcfx-converter-tab.js').then((module) => pickRenderer(module, 'renderPcfxConverterTab', 'pcfx-converter')) },
  { id: 'model-exchange', label: 'Model Exchange', load: () => import('../tabs/model-exchange-tab.js').then((module) => pickRenderer(module, 'renderModelExchangeTab', 'model-exchange')) },
  { id: 'interchange-config', label: 'Interchange Config', load: () => import('../tabs/interchange-config-tab.js').then((module) => pickRenderer(module, 'renderInterchangeConfigTab', 'interchange-config')) },
  { id: 'support-mapping-config', label: 'Support Mapping', load: () => import('../tabs/support-mapping-config-tab.js').then((module) => pickRenderer(module, 'renderSupportMappingConfigTab', 'support-mapping-config')) },
  { id: 'adapter-mapping', label: 'Adapter Mapping', load: () => import('../tabs/adapter-mapping-tab.js').then((module) => pickRenderer(module, 'renderAdapterMappingTab', 'adapter-mapping')) },
  { id: 'rvm-json-pcf', label: 'RVM JSON→PCF', load: () => import('../tabs/rvm-json-pcf-extract-tab-workflow-wired.js').then((module) => pickRenderer(module, 'mount', 'rvm-json-pcf')) },
  { id: 'universal-xml', label: 'Universal XML', load: () => import('../tabs/universal-xml-converter-tab.js').then((module) => pickRenderer(module, 'renderUniversalXmlConverterTab', 'universal-xml')) },
  { id: 'xml-compare', label: 'XML Compare', load: () => import('../tabs/xml-compare-tab.js').then((module) => pickRenderer(module, 'renderXmlCompareTab', 'xml-compare')) },
  { id: 'psnm-utility', label: 'Utilities', load: loadPsnmUtilityRenderer },
];

const tabRendererCache = new Map();

let activeTabDestroy = null;
let appShell = null;
let visibilityRules = null;
let visibilityRulesPromise = null;
let unsubscribeTabChange = null;
let devDebugDestroy = null;
let appDestroy = null;
let activeRenderToken = 0;

async function loadVisibilityRules() {
  if (!visibilityRulesPromise) {
    visibilityRulesPromise = fetch(TAB_VISIBILITY_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        const rules = json && typeof json === 'object' ? json : {};
        visibilityRules = rules;
        return rules;
      })
      .catch((error) => {
        console.warn('[app] tab visibility config unavailable; showing all tabs', error);
        visibilityRules = {};
        return visibilityRules;
      });
  }
  return visibilityRulesPromise;
}

function normalizeTabId(tabId) {
  return TAB_ID_ALIASES.get(String(tabId || '').trim()) || String(tabId || '').trim();
}

function visibleTabs() {
  const hidden = new Set((visibilityRules?.hiddenTabs || []).map(normalizeTabId));
  return TABS.filter((tab) => !hidden.has(tab.id));
}

function getDefaultTabId() {
  const tabs = visibleTabs();
  return tabs[0]?.id || 'viewer3d';
}

async function loadRenderer(tab) {
  if (!tabRendererCache.has(tab.id)) {
    tabRendererCache.set(tab.id, tab.load());
  }
  return tabRendererCache.get(tab.id);
}

function renderShell() {
  const tabs = visibleTabs();
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand-block">
          <div class="brand-title">PCF / GLB Viewer</div>
          <div class="brand-subtitle">3D review, model converters and support utilities</div>
        </div>
        <nav class="app-tabs" aria-label="Application tabs">
          ${tabs.map((tab) => `<button type="button" class="app-tab" data-tab-id="${tab.id}">${tab.label}</button>`).join('')}
        </nav>
      </header>
      <main id="app-main" class="app-main" tabindex="-1"></main>
    </div>
  `;
  appShell = {
    main: document.getElementById('app-main'),
    tabButtons: [...document.querySelectorAll('[data-tab-id]')],
  };
  appShell.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabId));
  });
}

function syncActiveTabButton(tabId) {
  appShell?.tabButtons?.forEach((button) => {
    button.classList.toggle('active', button.dataset.tabId === tabId);
  });
}

async function renderActiveTab(tabId) {
  const normalized = normalizeTabId(tabId) || getDefaultTabId();
  const tabs = visibleTabs();
  const tab = tabs.find((item) => item.id === normalized) || tabs[0];
  if (!tab || !appShell?.main) return;

  const token = ++activeRenderToken;
  syncActiveTabButton(tab.id);
  appShell.main.innerHTML = '<section class="loading-panel">Loading...</section>';

  if (typeof activeTabDestroy === 'function') {
    try { activeTabDestroy(); } catch (error) { console.warn('[app] previous tab cleanup failed', error); }
  }
  activeTabDestroy = null;

  try {
    const renderer = await loadRenderer(tab);
    if (token !== activeRenderToken) return;
    appShell.main.innerHTML = '';
    const maybeDestroy = renderer(appShell.main, { state, emit, RuntimeEvents, showToast });
    activeTabDestroy = typeof maybeDestroy === 'function' ? maybeDestroy : null;
  } catch (error) {
    console.error(`[app] failed to render tab ${tab.id}`, error);
    appShell.main.innerHTML = `<section class="error-panel"><h2>Unable to load ${tab.label}</h2><p>${String(error?.message || error)}</p></section>`;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

export async function init() {
  await loadVisibilityRules();
  loadStickyState();
  const current = normalizeTabId(state.activeTab) || getDefaultTabId();
  if (!visibleTabs().some((tab) => tab.id === current)) {
    state.activeTab = getDefaultTabId();
  } else {
    state.activeTab = current;
  }
  renderShell();
  unsubscribeTabChange = on(RuntimeEvents.TAB_CHANGED, (tabId) => renderActiveTab(tabId));
  await renderActiveTab(state.activeTab);
  initDevDebugWindow({ state, emit, setActiveTab });
  appDestroy = () => {
    if (typeof activeTabDestroy === 'function') activeTabDestroy();
    if (typeof unsubscribeTabChange === 'function') unsubscribeTabChange();
  };
  return appDestroy;
}

if (typeof window !== 'undefined') {
  window.PCFGLBApp = { init, state, setActiveTab };
}
