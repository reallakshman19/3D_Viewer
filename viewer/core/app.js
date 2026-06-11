import { loadStickyState, state, setActiveTab } from './state.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { renderViewer3D } from '../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12';
import { renderViewer3DRvm } from '../tabs/viewer3d-rvm-tab.js?v=20260518-statusbar-theme-12';
import { renderBasicGlbPcfPanel } from '../js/pcf2glb/ui/BasicGlbPcfPanel.js';
import { renderPcfxConverterTab } from '../tabs/pcfx-converter-tab.js';
import { renderModelExchangeTab } from '../tabs/model-exchange-tab.js';
import { renderInterchangeConfigTab } from '../tabs/interchange-config-tab.js';
import { renderSupportMappingConfigTab } from '../tabs/support-mapping-config-tab.js';
import { renderModelConvertersTab } from '../tabs/model-converters-tab.js';
import { renderAdapterMappingTab } from '../tabs/adapter-mapping-tab.js';
import { mount as mountRvmJsonPcfExtractTab } from '../tabs/rvm-json-pcf-extract-tab-workflow-wired.js';
import { renderUniversalXmlConverterTab } from '../tabs/universal-xml-converter-tab.js';
import { renderXmlCompareTab } from '../tabs/xml-compare-tab.js';
import { renderPSNM_UtilityTab } from '../tabs/psnm-utility-tab.js?v=20260610-psnm-15';
import '../tabs/psnm-utility/psnm-ui-p2-enhancements.js?v=20260609-p2-1';
import '../tabs/psnm-utility/psnm-phase4c-hardening.js?v=20260609-phase4c-1';
import '../tabs/psnm-utility/psnm-phase4d-persistence.js?v=20260609-phase4d-1';
import { emit, on } from './event-bus.js';
import { initDevDebugWindow, destroyDevDebugWindow } from '../debug/dev-debug-window.js';
import { loadRvmSource } from '../rvm/RvmLoadPipeline.js';

const TAB_CONFIG_URL = './opt/tab-visibility.json';
const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const TABS = [
  { id: 'viewer3d', configKeys: ['viewer3d', 'geometry'], label: '3D Viewer', render: renderViewer3D },
  { id: 'viewer3d-rvm', configKeys: ['viewer3d-rvm', 'rvm'], label: '3D RVM Viewer', render: renderViewer3DRvm },
  { id: 'adv-glb', configKeys: ['adv-glb', 'pcf2glb'], label: 'Basic GLB/PCF Viewer', render: renderBasicGlbPcfPanel, devOnly: true },
  { id: 'model-converters', configKeys: ['model-converters'], label: '3D Model Converters', render: renderModelConvertersTab },
  { id: 'model-exchange', configKeys: ['model-exchange', 'modelExchange'], label: 'PCF/PCFX/XML/GLB Converter', render: renderModelExchangeTab },
  { id: 'interchange-config', configKeys: ['interchange-config', 'interchangeConfig'], label: 'PCF/PCFX/XML/GLB Config', render: renderInterchangeConfigTab },
  { id: 'support-mapping-config', configKeys: ['support-mapping-config', 'supportMapping'], label: 'PCF/PCFX/XML/GLB Support Config', render: renderSupportMappingConfigTab },
  { id: 'pcfx-converter', configKeys: ['pcfx-converter', 'pcfx'], label: 'PCF<->PCFX<->GLB', render: renderPcfxConverterTab },
  { id: 'adapter-mapping', configKeys: ['adapter-mapping', 'adapterMapping'], label: '⚙ 3D RVM Adapter Mapping', render: renderAdapterMappingTab },
  { id: 'rvm-json-pcf-extract', configKeys: ['rvm-json-pcf-extract', 'rvmJsonPcfExtract'], label: 'RVM JSON → PCF Extract', render: mountRvmJsonPcfExtractTab },
  { id: 'universal-xml-converter', configKeys: ['universal-xml-converter', 'universalXml'], label: 'Universal XML Converter', render: renderUniversalXmlConverterTab },
  { id: 'xml-compare', configKeys: ['xml-compare', 'xmlCompare'], label: 'XML Compare', render: renderXmlCompareTab },
  { id: 'psnm-utility', configKeys: ['psnm-utility', 'psnmUtility', 'utilities'], label: 'Utilities', render: renderPSNM_UtilityTab },
];

const LEGACY_TAB_ALIASES = new Map([
  ['rvm', 'viewer3d-rvm'],
  ['pcf2glb', 'adv-glb'],
  ['pcfx', 'pcfx-converter'],
  ['modelExchange', 'model-exchange'],
  ['interchangeConfig', 'interchange-config'],
  ['supportMapping', 'support-mapping-config'],
  ['adapterMapping', 'adapter-mapping'],
  ['rvmJsonPcfExtract', 'rvm-json-pcf-extract'],
  ['universalXml', 'universal-xml-converter'],
  ['xmlCompare', 'xml-compare'],
  ['psnmUtility', 'psnm-utility'],
  ['summary', 'viewer3d'],
]);

let activeDestroy = null;
let shellRefs = null;
let mountedDestroy = null;
let visibleTabs = [];
let switchHandlerBound = false;

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setStatus(message) {
  if (!shellRefs?.status) return;
  shellRefs.status.textContent = message || '';
}

function normalizeTabId(tab) {
  const id = String(tab || '').trim();
  return LEGACY_TAB_ALIASES.get(id) || id;
}

function tabVisibleByConfig(tab, config) {
  if (tab.devOnly && !IS_DEV) return false;
  for (const key of tab.configKeys || [tab.id]) {
    if (Object.prototype.hasOwnProperty.call(config || {}, key)) return configFlagEnabled(config[key]);
  }
  return true;
}

function configFlagEnabled(value) {
  return value === undefined || value === 1 || value === true || value === '1' || value === 'true' || value === 'on';
}

async function loadVisibleTabs() {
  try {
    const response = await fetch(TAB_CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    const tabs = TABS.filter((tab) => tabVisibleByConfig(tab, config));
    return tabs.length ? tabs : TABS.filter((tab) => !tab.devOnly);
  } catch (error) {
    console.warn('[app] Tab visibility config unavailable, using built-in defaults.', error);
    return TABS.filter((tab) => !tab.devOnly || IS_DEV);
  }
}

function resolveInitialTabId() {
  const requested = normalizeTabId(state.activeTab || 'viewer3d');
  return visibleTabs.some((tab) => tab.id === requested) ? requested : (visibleTabs[0]?.id || 'viewer3d');
}

function getTab(tabId) {
  const normalized = normalizeTabId(tabId);
  return visibleTabs.find((tab) => tab.id === normalized) || visibleTabs[0] || TABS[0];
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

function buildTabBar() {
  if (!shellRefs?.nav) return;
  shellRefs.nav.innerHTML = visibleTabs.map((tab) => (
    `<button type="button" class="tab-btn" data-tab="${h(tab.id)}">${h(tab.label)}</button>`
  )).join('');
}

function updateActiveNav(tab) {
  if (!shellRefs?.nav) return;
  const normalized = normalizeTabId(tab);
  shellRefs.nav.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === normalized);
  });
}

export function renderActiveTab(tab = state.activeTab) {
  if (!shellRefs?.main) return;
  const tabDef = getTab(tab);
  const tabId = tabDef.id;
  if (activeDestroy) {
    try { activeDestroy(); } catch (error) { console.warn('Tab destroy failed', error); }
    activeDestroy = null;
  }
  shellRefs.main.innerHTML = '';
  updateActiveNav(tabId);
  setStatus('');
  setActiveTab(tabId);
  emit(RuntimeEvents.TAB_CHANGED, { tabId });
  const result = tabDef.render(shellRefs.main, createContext(tabId));
  if (typeof result === 'function') activeDestroy = result;
}

function resolveShellRefs(shell = {}) {
  return {
    nav: shell.nav || document.getElementById('tab-bar'),
    main: shell.main || document.getElementById('tab-content'),
    status: shell.status || document.getElementById('app-status') || null,
  };
}

function bindNavClick() {
  if (!shellRefs?.nav) return;
  shellRefs.nav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    renderActiveTab(btn.dataset.tab);
  });
}

function bindSwitchEvent() {
  if (switchHandlerBound) return;
  window.addEventListener('app:switch-tab', (event) => {
    const nextId = event?.detail?.tabId;
    if (nextId) renderActiveTab(nextId);
  });
  switchHandlerBound = true;
}

export async function mountApp(shell) {
  loadStickyState();
  shellRefs = resolveShellRefs(shell);
  visibleTabs = await loadVisibleTabs();
  buildTabBar();
  bindNavClick();
  bindSwitchEvent();
  initDevDebugWindow();
  renderActiveTab(resolveInitialTabId());
  return () => {
    if (activeDestroy) activeDestroy();
    destroyDevDebugWindow();
  };
}

export async function init(shell) {
  if (mountedDestroy) {
    try { mountedDestroy(); } catch (error) { console.warn('Previous app mount cleanup failed', error); }
    mountedDestroy = null;
  }
  mountedDestroy = await mountApp(resolveShellRefs(shell));
  return mountedDestroy;
}

export { loadRvmSource };
