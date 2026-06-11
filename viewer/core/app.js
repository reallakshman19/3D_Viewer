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
  return import('../tabs/psnm-utility-tab.js?v=20260611-psnm-22-psmap-line-diagnostics-1')
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
  if (visibilityRulesPromise) return visibilityRulesPromise;
  visibilityRulesPromise = fetch(TAB_VISIBILITY_URL, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : { tabs: {} }))
    .then((json) => {
      visibilityRules = json || { tabs: {} };
      return visibilityRules;
    })
    .catch(() => {
      visibilityRules = { tabs: {} };
      return visibilityRules;
    });
  return visibilityRulesPromise;
}

function isTabVisible(tab) {
  const rule = visibilityRules?.tabs?.[tab.id];
  return rule?.visible !== false;
}

function visibleTabs() {
  return TABS.filter(isTabVisible);
}

function loadTabRenderer(tab) {
  if (!tab?.id || typeof tab.load !== 'function') {
    return Promise.reject(new Error(`Invalid tab definition: ${tab?.id || '<missing>'}`));
  }
  if (!tabRendererCache.has(tab.id)) {
    tabRendererCache.set(tab.id, Promise.resolve().then(() => tab.load()));
  }
  return tabRendererCache.get(tab.id);
}

function cleanupActiveTab() {
  if (typeof activeTabDestroy !== 'function') return;
  try {
    activeTabDestroy();
  } catch (error) {
    console.warn('[app] active tab cleanup failed', error);
  } finally {
    activeTabDestroy = null;
  }
}

function renderTabLoading(main, tab) {
  main.innerHTML = `
    <section class="tab-load-state" role="status" aria-live="polite">
      <h2>Loading ${h(tab?.label || 'tab')}...</h2>
      <p>Please wait while this panel is prepared.</p>
    </section>
  `;
}

function renderTabError(main, tab, error) {
  const message = error?.message || String(error || 'Unknown error');
  main.innerHTML = `
    <section class="tab-error-state" role="alert">
      <h2>${h(tab?.label || 'Tab')} failed to open</h2>
      <p>The rest of the application is still available. Open another tab or retry this one.</p>
      <pre>${h(message)}</pre>
      <div class="tab-error-state__actions">
        <button type="button" data-tab-error-action="retry">Retry</button>
        <button type="button" data-tab-error-action="viewer3d">Open 3D Viewer</button>
      </div>
    </section>
  `;
  main.querySelector('[data-tab-error-action="retry"]')?.addEventListener('click', () => renderActiveTab(appShell));
  main.querySelector('[data-tab-error-action="viewer3d"]')?.addEventListener('click', () => setActiveTab('viewer3d'));
}

function renderTabBar(shellRefs = appShell) {
  if (!shellRefs?.nav) return;
  const tabs = visibleTabs();
  shellRefs.nav.innerHTML = tabs.map((tab) => `<button type="button" class="tab-btn" data-tab="${h(tab.id)}">${h(tab.label)}</button>`).join('');
}

function syncActiveTabButton(shellRefs = appShell) {
  if (!shellRefs?.nav) return;
  const active = normalizeTabId(state.activeTab) || visibleTabs()[0]?.id || TABS[0]?.id;
  shellRefs.nav.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', normalizeTabId(button.dataset.tab) === active);
  });
}

export async function renderActiveTab(shellRefs = appShell) {
  if (!shellRefs?.main) return;
  const renderToken = ++activeRenderToken;
  await loadTabVisibilityRules();
  if (renderToken !== activeRenderToken) return;

  const tabs = visibleTabs();
  let activeId = normalizeTabId(state.activeTab);
  if (!tabs.some((tab) => tab.id === activeId)) {
    activeId = tabs[0]?.id || TABS[0].id;
    // Do not call setActiveTab() while already rendering; that would emit
    // TAB_CHANGED and can re-enter renderActiveTab during initial startup.
    state.activeTab = activeId;
  }

  const tab = tabs.find((item) => item.id === activeId) || tabs[0] || TABS[0];
  syncActiveTabButton(shellRefs);
  cleanupActiveTab();
  renderTabLoading(shellRefs.main, tab);

  try {
    const renderer = await loadTabRenderer(tab);
    if (renderToken !== activeRenderToken) return;
    shellRefs.main.innerHTML = '';
    const maybeDestroy = await renderer(shellRefs.main, { emit, setActiveTab, activeTab: tab.id });
    if (renderToken !== activeRenderToken) {
      if (typeof maybeDestroy === 'function') {
        try { maybeDestroy(); } catch (error) { console.warn('[app] stale tab cleanup failed', error); }
      }
      return;
    }
    if (typeof maybeDestroy === 'function') activeTabDestroy = maybeDestroy;
    emit(RuntimeEvents.TAB_RENDERED, { tabId: tab.id });
  } catch (error) {
    if (renderToken !== activeRenderToken) return;
    console.error(`[app] Failed to render tab ${tab.id}`, error);
    renderTabError(shellRefs.main, tab, error);
    emit(RuntimeEvents.RENDER_ERROR, { tabId: tab.id, error: error?.message || String(error) });
  } finally {
    if (renderToken === activeRenderToken) syncActiveTabButton(shellRefs);
  }
}

function resolveShellRefs(shell) {
  if (shell?.main || shell?.nav) return shell;
  return {
    nav: document.getElementById('tab-bar'),
    main: document.getElementById('tab-content'),
  };
}

export function mountApp(shell) {
  appShell = resolveShellRefs(shell);
  activeRenderToken += 1;
  cleanupActiveTab();
  loadStickyState();
  if (devDebugDestroy) { try { devDebugDestroy(); } catch {} }
  devDebugDestroy = initDevDebugWindow({ emit });
  loadTabVisibilityRules().then(() => {
    renderTabBar(appShell);
    renderActiveTab(appShell);
  });
  if (unsubscribeTabChange) unsubscribeTabChange();
  unsubscribeTabChange = on(RuntimeEvents.TAB_CHANGED, () => renderActiveTab(appShell));
  appShell.nav?.removeEventListener('click', onTabClick);
  appShell.nav?.addEventListener('click', onTabClick);
  return () => {
    activeRenderToken += 1;
    appShell?.nav?.removeEventListener('click', onTabClick);
    if (unsubscribeTabChange) { unsubscribeTabChange(); unsubscribeTabChange = null; }
    cleanupActiveTab();
    if (devDebugDestroy) { try { devDebugDestroy(); } catch {} devDebugDestroy = null; }
  };
}

function onTabClick(event) {
  const button = event.target?.closest?.('[data-tab]');
  if (!button) return;
  event.preventDefault();
  const nextTab = normalizeTabId(button.dataset.tab);
  if (!nextTab || normalizeTabId(state.activeTab) === nextTab) return;
  setActiveTab(nextTab);
}

export async function init(shell) {
  if (appDestroy) {
    try { appDestroy(); } catch (error) { console.warn('Previous app mount cleanup failed', error); }
    appDestroy = null;
  }
  appDestroy = mountApp(resolveShellRefs(shell));
  return appDestroy;
}

export async function loadRvmSource() {
  // Kept for backward compatibility with older tab bootstrap code.
  return null;
}
