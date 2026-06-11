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
  return import('../tabs/psnm-utility-tab.js?v=20260610-psnm-21-psmap-consolidated-t1-ui-1')
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

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeTabId(tabId) {
  return TAB_ID_ALIASES.get(String(tabId || '').trim()) || String(tabId || '').trim();
}

async function loadTabVisibilityRules() {
  if (visibilityRules) return visibilityRules;
  if (!visibilityRulesPromise) {
    visibilityRulesPromise = fetch(TAB_VISIBILITY_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`tab visibility ${res.status}`);
        return res.json();
      })
      .then((json) => {
        visibilityRules = json || {};
        return visibilityRules;
      })
      .catch((error) => {
        console.warn('Tab visibility config unavailable; defaulting to all tabs visible.', error);
        visibilityRules = { hiddenTabs: [] };
        return visibilityRules;
      });
  }
  return visibilityRulesPromise;
}

function visibleTabsFromRules(rules) {
  const hidden = new Set((rules?.hiddenTabs || []).map(normalizeTabId));
  return TABS.filter((tab) => !hidden.has(tab.id));
}

function renderShellTabs(tabs) {
  if (!appShell?.nav) return;
  appShell.nav.innerHTML = tabs.map((tab) => `<button type="button" class="tab-btn" data-tab="${h(tab.id)}">${h(tab.label)}</button>`).join('');
}

function updateActiveButton(activeId) {
  if (!appShell?.nav) return;
  appShell.nav.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeId);
  });
}

async function renderActiveTab(tabId = state.activeTab) {
  const normalized = normalizeTabId(tabId) || 'viewer3d';
  const rules = await loadTabVisibilityRules();
  const tabs = visibleTabsFromRules(rules);
  const selected = tabs.find((tab) => tab.id === normalized) || tabs[0];
  if (!selected || !appShell?.main) return;

  const token = ++activeRenderToken;
  setActiveTab(selected.id);
  updateActiveButton(selected.id);
  appShell.main.innerHTML = '<div class="loading">Loading tab…</div>';

  try {
    const renderer = tabRendererCache.get(selected.id) || await selected.load();
    tabRendererCache.set(selected.id, renderer);
    if (token !== activeRenderToken) return;
    try { activeTabDestroy?.(); } catch (error) { console.warn('Tab cleanup failed', error); }
    activeTabDestroy = null;
    appShell.main.innerHTML = '';
    const maybeDestroy = renderer(appShell.main, { showToast: appShell.showToast || (() => {}) });
    if (typeof maybeDestroy === 'function') activeTabDestroy = maybeDestroy;
  } catch (error) {
    console.error(`Failed to render tab ${selected.id}`, error);
    appShell.main.innerHTML = `<div class="error-panel"><h2>Failed to load ${h(selected.label)}</h2><pre>${h(error?.stack || error?.message || error)}</pre></div>`;
  }
}

function resolveShellRefs(shell = {}) {
  return {
    nav: shell.nav || document.getElementById('tab-bar'),
    main: shell.main || document.getElementById('tab-content'),
    showToast: shell.showToast || ((message) => console.log(message)),
  };
}

function mountApp(shell = {}) {
  appShell = resolveShellRefs(shell);
  if (!appShell.nav || !appShell.main) throw new Error('App shell requires nav and main containers.');
  loadStickyState();
  loadTabVisibilityRules().then((rules) => {
    const tabs = visibleTabsFromRules(rules);
    renderShellTabs(tabs);
    const active = tabs.some((tab) => tab.id === normalizeTabId(state.activeTab)) ? state.activeTab : tabs[0]?.id;
    renderActiveTab(active);
  });

  const onClick = (event) => {
    const btn = event.target?.closest?.('[data-tab]');
    if (!btn) return;
    renderActiveTab(btn.dataset.tab);
  };
  appShell.nav.addEventListener('click', onClick);
  unsubscribeTabChange = on(RuntimeEvents.TAB_CHANGED, ({ tabId }) => renderActiveTab(tabId));
  try { devDebugDestroy = initDevDebugWindow?.({ emit }); } catch (error) { console.warn('Dev debug init failed', error); }

  return () => {
    appShell.nav.removeEventListener('click', onClick);
    try { unsubscribeTabChange?.(); } catch {}
    try { activeTabDestroy?.(); } catch {}
    try { devDebugDestroy?.(); } catch {}
    appShell = null;
    activeTabDestroy = null;
    unsubscribeTabChange = null;
    devDebugDestroy = null;
  };
}

export async function init(shell) {
  if (appDestroy) {
    try { appDestroy(); } catch (error) { console.warn('Previous app mount cleanup failed', error); }
    appDestroy = null;
  }
  appDestroy = mountApp(resolveShellRefs(shell));
  return appDestroy;
}

export { mountApp, renderActiveTab };
