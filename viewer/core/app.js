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

// Lifecycle isolation contract checked by viewer/tests/app-entrypoint-static.test.js.
// activeTabDestroy is only for the mounted tab; appDestroy is only for full app teardown.
let activeTabDestroy = null;
let appDestroy = null;
const tabRendererCache = new Map();

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
  await import('../rvm-viewer/RvmSupportSymbols.js?v=20260618-support-index-attrs-1');
  await import('../rvm-viewer/RvmSupportIndexAttributeBridge.js?v=20260618-support-index-attrs-1');
  await import('../tabs/viewer3d-rvm-uxml-import-addon.js?v=20260618-support-index-attrs-1');
  return import('../tabs/viewer3d-rvm-tab.js?v=20260618-support-index-attrs-1')
    .then((module) => pickRenderer(module, 'renderViewer3DRvm', 'viewer3d-rvm'));
}

async function loadBasicGlbPcfRenderer() {
  await import('../js/pcf2glb/ui/basicGlbPcfUiEnhancer.js?v=20260618-resizable-properties-1');
  return import('../js/pcf2glb/ui/BasicGlbPcfPanel.js?v=20260618-resizable-properties-1')
    .then((module) => pickRenderer(module, 'renderBasicGlbPcfPanel', 'basic-glb-pcf'));
}

const TABS = [
  { id: 'viewer3d', label: '3D Viewer', load: () => import('../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12').then((module) => pickRenderer(module, 'renderViewer3D', 'viewer3d')) },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', load: loadRvmViewerRenderer },
  { id: 'model-converters', label: '3D Model Converters', load: () => import('../tabs/model-converters-tab.js?v=20260618-port-bore-contract-1').then((module) => pickRenderer(module, 'renderModelConvertersTab', 'model-converters')) },
  { id: 'basic-glb-pcf', label: 'Basic GLB-PCF', load: loadBasicGlbPcfRenderer },
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

function createAppShell(root) {
  root.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  const content = document.createElement('main');
  content.className = 'app-content';
  shell.append(nav, content);
  root.appendChild(shell);
  return { nav, content };
}

async function visibleTabs() {
  try {
    const response = await fetch(TAB_VISIBILITY_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    const hidden = new Set(Array.isArray(config?.hiddenTabs) ? config.hiddenTabs : []);
    return TABS.filter((tab) => !hidden.has(tab.id));
  } catch {
    return TABS;
  }
}

function tabGroupFor(tabId) {
  return TAB_GROUPS.find((group) => group.ids.includes(tabId))?.label || '';
}

function renderNav(nav, tabs, content) {
  nav.innerHTML = '';
  for (const group of TAB_GROUPS) {
    const groupTabs = tabs.filter((tab) => group.ids.includes(tab.id));
    if (!groupTabs.length) continue;
    const groupWrap = document.createElement('div');
    groupWrap.className = 'app-nav-group';
    const label = document.createElement('span');
    label.className = 'app-nav-group-label';
    label.textContent = group.label;
    groupWrap.appendChild(label);
    for (const tab of groupTabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tab.label;
      button.dataset.tabId = tab.id;
      button.dataset.group = tabGroupFor(tab.id);
      button.addEventListener('click', () => activateTab(tab.id, tabs, nav, content));
      groupWrap.appendChild(button);
    }
    nav.appendChild(groupWrap);
  }
}

function cleanupActiveTab() {
  if (typeof activeTabDestroy !== 'function') {
    activeTabDestroy = null;
    return;
  }
  const destroy = activeTabDestroy;
  activeTabDestroy = null;
  try {
    destroy();
  } catch (error) {
    console.warn('[app] active tab cleanup failed', error);
  }
}

function renderTabError(content, error) {
  const message = error?.message || String(error || 'Unknown tab error');
  content.innerHTML = `<div class="tab-error">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadTabRenderer(tab) {
  if (!tabRendererCache.has(tab.id)) {
    tabRendererCache.set(tab.id, Promise.resolve().then(() => tab.load()));
  }
  return tabRendererCache.get(tab.id);
}

async function activateTab(tabId, tabs, nav, content) {
  const alias = TAB_ID_ALIASES.get(tabId) || tabId;
  const tab = tabs.find((item) => item.id === alias) || tabs[0];
  if (!tab) return;
  cleanupActiveTab();
  setActiveTab(tab.id);
  nav.querySelectorAll('button[data-tab-id]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabId === tab.id);
  });
  content.innerHTML = '<div class="tab-loading">Loading…</div>';
  try {
    const render = await loadTabRenderer(tab);
    content.innerHTML = '';
    const destroy = render(content, { RuntimeEvents, emit, on, state });
    activeTabDestroy = typeof destroy === 'function' ? destroy : null;
  } catch (error) {
    console.error(error);
    activeTabDestroy = null;
    renderTabError(content, error);
  }
}

export async function bootstrapApp(root = document.getElementById('app-layout')) {
  if (typeof appDestroy === 'function') {
    appDestroy();
  }
  initDevDebugWindow();
  const tabs = await visibleTabs();
  loadStickyState();
  const { nav, content } = createAppShell(root);
  renderNav(nav, tabs, content);
  appDestroy = () => {
    cleanupActiveTab();
    if (root) root.innerHTML = '';
    appDestroy = null;
  };
  const preferred = TAB_ID_ALIASES.get(state.activeTab) || state.activeTab || tabs[0]?.id;
  await activateTab(preferred, tabs, nav, content);
  return appDestroy;
}

export function init(root = document.getElementById('app-layout')) {
  return bootstrapApp(root);
}
