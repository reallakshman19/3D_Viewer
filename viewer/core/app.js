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
  return import('../tabs/psnm-utility-tab.js?v=20260613-psnm-anchor-no-blocker-1')
    .then((module) => pickRenderer(module, 'renderPSNM_UtilityTab', 'psnm-utility'));
}

async function loadRvmViewerRenderer() {
  await import('../rvm/RvmFileLoadedBridge.js?v=20260618-modular-rvm-file-loaded-1');
  await import('../rvm/AvevaJsonVisibleFallbackPatch.js?v=20260618-staged-visible-fallback-1');
  await import('../tabs/viewer3d-rvm-uxml-import-addon.js?v=20260618-rvm-uxml-content-sniff-1');
  return import('../tabs/viewer3d-rvm-tab.js?v=20260618-rvm-uxml-import-1')
    .then((module) => pickRenderer(module, 'renderViewer3DRvm', 'viewer3d-rvm'));
}

const TABS = [
  { id: 'viewer3d', label: '3D Viewer', load: () => import('../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12').then((module) => pickRenderer(module, 'renderViewer3D', 'viewer3d')) },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', load: loadRvmViewerRenderer },
  { id: 'model-converters', label: '3D Model Converters', load: () => import('../tabs/model-converters-tab.js?v=20260618-port-bore-contract-1').then((module) => pickRenderer(module, 'renderModelConvertersTab', 'model-converters')) },
  { id: 'basic-glb-pcf', label: 'Basic GLB-PCF', load: () => import('../js/pcf2glb/ui/BasicGlbPcfPanel.js?v=20260617-bmcii-open-basic-handoff-2').then((module) => pickRenderer(module, 'renderBasicGlbPcfPanel', 'basic-glb-pcf')) },
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

const TAB_GROUPS = [
  { label: 'Viewers',    ids: ['viewer3d', 'viewer3d-rvm'] },
  { label: 'Converters', ids: ['model-converters', 'basic-glb-pcf', 'pcfx-converter', 'rvm-json-pcf', 'universal-xml', 'xml-compare'] },
  { label: 'Exchange',   ids: ['model-exchange', 'interchange-config', 'support-mapping-config', 'adapter-mapping'] },
  { label: 'Utilities',  ids: ['psnm-utility'] },
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
    visibilityRulesPromise = fetch(TAB_VISIBILITY_URL)
      .then((response) => response.ok ? response.json() : { hiddenTabs: [] })
      .catch(() => ({ hiddenTabs: [] }));
  }
  visibilityRules = await visibilityRulesPromise;
  return visibilityRules;
}

function normalizeTabId(tabId) {
  return TAB_ID_ALIASES.get(tabId) || tabId;
}

function visibleTabs() {
  const hidden = new Set(visibilityRules?.hiddenTabs || []);
  return TABS.filter((tab) => !hidden.has(tab.id));
}

function groupVisibleTabs(tabs) {
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  const used = new Set();
  const groups = [];

  for (const group of TAB_GROUPS) {
    const items = group.ids.map((id) => byId.get(id)).filter(Boolean);
    if (items.length) {
      items.forEach((tab) => used.add(tab.id));
      groups.push({ label: group.label, tabs: items });
    }
  }

  const other = tabs.filter((tab) => !used.has(tab.id));
  if (other.length) groups.push({ label: 'Other', tabs: other });
  return groups;
}

async function ensureTabModule(tab) {
  if (!tabRendererCache.has(tab.id)) {
    tabRendererCache.set(tab.id, tab.load());
  }
  return tabRendererCache.get(tab.id);
}

function cleanupActiveTab() {
  if (typeof activeTabDestroy === 'function') {
    try { activeTabDestroy(); } catch (error) { console.warn('Tab destroy failed', error); }
  }
  activeTabDestroy = null;
}

function renderTabError(tab, error) {
  if (!appShell) return;
  appShell.content.innerHTML = `<div class="tab-error">Failed to load ${tab.label}: ${error.message || error}</div>`;
}

async function renderActiveTab(tabId) {
  if (!appShell) return;
  const normalizedId = normalizeTabId(tabId);
  const tab = visibleTabs().find((item) => item.id === normalizedId) || visibleTabs()[0];
  if (!tab) return;
  const token = ++activeRenderToken;

  if (state.activeTab !== tab.id) setActiveTab(tab.id);
  appShell.content.innerHTML = '<div class="tab-loading">Loading…</div>';
  updateActiveNav(tab.id);

  try {
    const renderer = await ensureTabModule(tab);
    if (token !== activeRenderToken) return;
    cleanupActiveTab();
    appShell.content.innerHTML = '';
    activeTabDestroy = renderer(appShell.content, { state, emit, on }) || null;
  } catch (error) {
    console.error(`Failed to render tab ${tab.id}`, error);
    if (token !== activeRenderToken) return;
    renderTabError(tab, error);
  }
}

function updateActiveNav(activeId) {
  if (!appShell) return;
  appShell.nav.querySelectorAll('button[data-tab-id]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabId === activeId);
  });
}

function createNav(tabs) {
  const nav = document.createElement('div');
  nav.className = 'app-nav';
  for (const group of groupVisibleTabs(tabs)) {
    const groupWrap = document.createElement('div');
    groupWrap.className = 'app-nav-group';
    const label = document.createElement('span');
    label.className = 'app-nav-group-label';
    label.textContent = group.label;
    groupWrap.appendChild(label);
    for (const tab of group.tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tabId = tab.id;
      button.textContent = tab.label;
      button.addEventListener('click', () => renderActiveTab(tab.id));
      groupWrap.appendChild(button);
    }
    nav.appendChild(groupWrap);
  }
  return nav;
}

function resolveAppRoot(candidateRoot) {
  if (candidateRoot instanceof Element) return candidateRoot;

  const explicitRoot = document.getElementById('app');
  if (explicitRoot) return explicitRoot;

  const legacyRoot = document.getElementById('app-layout');
  if (legacyRoot) return legacyRoot;

  const createdRoot = document.createElement('div');
  createdRoot.id = 'app';
  document.body.prepend(createdRoot);
  return createdRoot;
}

export async function initApp(root) {
  const resolvedRoot = resolveAppRoot(root);
  await loadVisibilityRules();
  const tabs = visibleTabs();
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.id = 'app-shell';
  const nav = createNav(tabs);
  const content = document.createElement('main');
  content.className = 'app-content';
  shell.append(nav, content);
  resolvedRoot.innerHTML = '';
  resolvedRoot.appendChild(shell);
  appShell = { root: resolvedRoot, shell, nav, content };
  initDevDebugWindow({ emit, on, state });
  unsubscribeTabChange = on(RuntimeEvents.TAB_CHANGE_REQUESTED, ({ tabId } = {}) => {
    if (tabId) renderActiveTab(tabId);
  });
  const initialTab = normalizeTabId(new URL(location.href).searchParams.get('tab') || state.activeTab || tabs[0]?.id);
  await renderActiveTab(initialTab);
  appDestroy = () => {
    cleanupActiveTab();
    if (typeof unsubscribeTabChange === 'function') unsubscribeTabChange();
    resolvedRoot.innerHTML = '';
    appShell = null;
  };
  return appDestroy;
}

export function init(root) {
  return initApp(root);
}

export function destroyApp() {
  if (typeof appDestroy === 'function') appDestroy();
}
