import { loadStickyState, state, setActiveTab } from './state.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { emit, on } from './event-bus.js';
import { hideLoading } from './loading.js';
import { initDevDebugWindow } from '../debug/dev-debug-window.js';

const TAB_VISIBILITY_URL = new URL('../config/tab-visibility.json', import.meta.url).href;
const RVM_RENDERER_PREFLIGHT_MODULES = [
  '../rvm/RvmFileLoadedBridge.js?v=20260618-modular-rvm-file-loaded-1',
  '../rvm/AvevaJsonVisibleFallbackPatch.js?v=20260618-staged-visible-fallback-1',
  '../rvm-viewer/RvmSupportSymbols.js?v=20260618-support-kind-authority-1',
  '../rvm-viewer/RvmSupportIndexAttributeBridge.js?v=20260620-rvm-direct-tab-1',
  '../tabs/viewer3d-rvm-file-dialog-singleton.js?v=20260618-rvm-file-dialog-singleton-1',
  '../tabs/viewer3d-rvm-uxml-import-addon.js?v=20260618-support-kind-authority-1',
];

const TAB_ID_ALIASES = new Map([
  ['viewer', 'viewer3d'], ['viewer3d', 'viewer3d'], ['rvm-viewer', 'viewer3d-rvm'], ['viewer3d-rvm', 'viewer3d-rvm'],
  ['converter', 'model-converters'], ['model-converters', 'model-converters'], ['basic-glb-pcf', 'basic-glb-pcf'],
  ['pcfx-converter', 'pcfx-converter'], ['model-exchange', 'model-exchange'], ['interchange-config', 'interchange-config'],
  ['support-mapping-config', 'support-mapping-config'], ['adapter-mapping', 'adapter-mapping'], ['rvm-json-pcf', 'rvm-json-pcf'],
  ['universal-xml', 'universal-xml'], ['xml-compare', 'xml-compare'], ['psnm-utility', 'psnm-utility'],
]);

let activeTabDestroy = null;
let appDestroy = null;
const tabRendererCache = new Map();

function cleanupActiveTab() {
  if (!activeTabDestroy) return;
  try { activeTabDestroy(); }
  catch (error) { console.warn('Tab cleanup failed', error); }
  finally { activeTabDestroy = null; }
}

function hideStartupOverlay() {
  try { hideLoading(); } catch {}
  const overlay = document.getElementById('app-loading-overlay');
  if (overlay) {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function pickRenderer(module, exportName, tabId) {
  const renderer = module?.[exportName];
  if (typeof renderer !== 'function') throw new Error(`Tab ${tabId} did not export renderer ${exportName}`);
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
  const results = await Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES.map((specifier) => import(specifier)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.warn(`[3D Viewer] optional RVM preflight module failed: ${RVM_RENDERER_PREFLIGHT_MODULES[index]}`, result.reason);
  });
  return import('../tabs/viewer3d-rvm-tab-renderer.js?v=20260621-rvm-property-collapse-1')
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
  { id: 'model-converters', label: '3D Model Converters', load: () => import('../tabs/model-converters-tab.js?v=20260621-model-converters-css-1').then((module) => pickRenderer(module, 'renderModelConvertersTab', 'model-converters')) },
  { id: 'basic-glb-pcf', label: 'Basic GLB-PCF', load: loadBasicGlbPcfRenderer },
  { id: 'pcfx-converter', label: 'PCFX Converter', load: () => import('../tabs/pcfx-converter-tab.js').then((module) => pickRenderer(module, 'renderPcfxConverterTab', 'pcfx-converter')) },
  { id: 'model-exchange', label: 'Model Exchange', load: () => import('../tabs/model-exchange-tab.js').then((module) => pickRenderer(module, 'renderModelExchangeTab', 'model-exchange')) },
  { id: 'interchange-config', label: 'Interchange Config', load: () => import('../tabs/interchange-config-tab.js').then((module) => pickRenderer(module, 'renderInterchangeConfigTab', 'interchange-config')) },
  { id: 'support-mapping-config', label: 'Support Mapping', load: () => import('../tabs/support-mapping-config-tab.js').then((module) => pickRenderer(module, 'renderSupportMappingTab', 'support-mapping-config')) },
  { id: 'adapter-mapping', label: 'Adapter Mapping', load: () => import('../tabs/adapter-mapping-tab.js').then((module) => pickRenderer(module, 'renderAdapterMappingTab', 'adapter-mapping')) },
  { id: 'rvm-json-pcf', label: 'RVM JSON→PCF', load: () => import('../tabs/rvm-json-pcf-extract-tab-workflow-wired.js').then((module) => pickRenderer(module, 'mount', 'rvm-json-pcf')) },
  { id: 'universal-xml', label: 'Universal XML', load: () => import('../tabs/universal-xml-converter-tab.js').then((module) => pickRenderer(module, 'renderUniversalXmlConverterTab', 'universal-xml')) },
  { id: 'xml-compare', label: 'XML Compare', load: () => import('../tabs/xml-compare-tab.js').then((module) => pickRenderer(module, 'renderXmlCompareTab', 'xml-compare')) },
  { id: 'psnm-utility', label: 'Utilities', load: loadPsnmUtilityRenderer },
];

const TAB_GROUPS = [
  { label: 'Viewers', ids: ['viewer3d', 'viewer3d-rvm'] },
  { label: 'Converters', ids: ['model-converters', 'basic-glb-pcf', 'pcfx-converter', 'rvm-json-pcf', 'universal-xml', 'xml-compare'] },
  { label: 'Exchange', ids: ['model-exchange', 'interchange-config', 'support-mapping-config', 'adapter-mapping'] },
  { label: 'Utilities', ids: ['psnm-utility'] },
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

function renderTabNav(nav, tabs) {
  nav.innerHTML = '';
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  const rendered = new Set();
  for (const group of TAB_GROUPS) {
    const groupTabs = group.ids.map((id) => tabById.get(id)).filter(Boolean);
    if (!groupTabs.length) continue;
    const label = document.createElement('div');
    label.className = 'app-nav-group-label';
    label.textContent = group.label;
    nav.appendChild(label);
    groupTabs.forEach((tab) => {
      rendered.add(tab.id);
      const btn = document.createElement('button');
      btn.className = 'app-nav-button';
      btn.dataset.tabId = tab.id;
      btn.type = 'button';
      btn.textContent = tab.label;
      nav.appendChild(btn);
    });
  }
  tabs.filter((tab) => !rendered.has(tab.id)).forEach((tab) => {
    const btn = document.createElement('button');
    btn.className = 'app-nav-button';
    btn.dataset.tabId = tab.id;
    btn.type = 'button';
    btn.textContent = tab.label;
    nav.appendChild(btn);
  });
}

function normalizeTabId(id) {
  return TAB_ID_ALIASES.get(id) || id || 'viewer3d';
}

async function activateTab(tabId, tabs, nav, content) {
  const normalizedId = normalizeTabId(tabId);
  const tab = tabs.find((candidate) => candidate.id === normalizedId) || tabs[0];
  if (!tab) return;
  cleanupActiveTab();
  state.activeTab = tab.id;
  setActiveTab(tab.id);
  nav.querySelectorAll('.app-nav-button').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tabId === tab.id));
  content.innerHTML = '';
  const renderer = await tab.load();
  const maybeCleanup = await renderer(content, { state, emit, on, RuntimeEvents });
  activeTabDestroy = typeof maybeCleanup === 'function' ? maybeCleanup : null;
  hideStartupOverlay();
}

export async function init() {
  const root = document.getElementById('app') || document.getElementById('app-layout') || document.body;
  initDevDebugWindow();
  loadStickyState();
  const tabs = await visibleTabs();
  const shell = createAppShell(root);
  renderTabNav(shell.nav, tabs);
  const onNavClick = (event) => {
    const btn = event.target.closest('.app-nav-button');
    if (!btn) return;
    activateTab(btn.dataset.tabId, tabs, shell.nav, shell.content).catch(console.error);
  };
  shell.nav.addEventListener('click', onNavClick);
  appDestroy = () => { shell.nav.removeEventListener('click', onNavClick); cleanupActiveTab(); };
  const target = normalizeTabId(state.activeTab || location.hash.replace('#', '') || 'viewer3d');
  await activateTab(target, tabs, shell.nav, shell.content);
}

export function destroyApp() {
  cleanupActiveTab();
  if (appDestroy) appDestroy();
  appDestroy = null;
}
