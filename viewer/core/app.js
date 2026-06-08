import { loadStickyState, state, setActiveTab } from './state.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { renderViewer3D } from '../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12';
import { renderViewer3DRvm } from '../tabs/viewer3d-rvm-tab.js?v=20260518-statusbar-theme-12';
import { renderBasicGlbPcfPanel } from '../js/pcf2glb/ui/BasicGlbPcfPanel.js';
import { renderPcfxConverterTab } from '../tabs/pcfx-converter-tab.js';
import { renderModelExchangeTab } from '../tabs/model-exchange-tab.js';
import { renderInterchangeConfigTab } from '../tabs/interchange-config-tab.js';
import { renderSupportMappingConfigTab } from '../tabs/support-mapping-config-tab.js';
import { renderModelConvertersTab } from '../tabs/model-converters-tab.js?v=20260605-xml-cii-linelist-map-1';
import { enhanceModelConvertersTab } from '../tabs/model-converters-ui-enhancements.js?v=20260607-xml-cii-ui-3';
import { enhanceNpsBoreMasterTab } from '../tabs/nps-bore-master-enhancements.js?v=20260607-nps-master-2';
import { renderAdapterMappingTab } from '../tabs/adapter-mapping-tab.js';
import { mount as mountRvmJsonPcfExtractTab } from '../tabs/rvm-json-pcf-extract-tab.js';
import { renderUniversalXmlConverterTab } from '../tabs/universal-xml-converter-tab.js';
import { renderXmlCompareTab } from '../tabs/xml-compare-tab.js';
import { emit, on } from './event-bus.js';
import { initDevDebugWindow, destroyDevDebugWindow } from '../debug/dev-debug-window.js';
import { loadRvmSource } from '../rvm/RvmLoadPipeline.js';
import { RvmStaticBundleLoader } from '../rvm/RvmStaticBundleLoader.js';
import { RvmHelperBridge } from '../converters/rvm-helper-bridge.js';
import { RvmGitHubActionsBridge } from '../converters/rvm-github-bridge.js';
import { convertRevFileToAvevaHierarchy } from '../rvm/RevLocalLoader.js?v=20260508-control-counts';
import { showToast } from './toast.js';
import { showLoading, hideLoading } from './loading.js';
import { requestPat } from './pat-modal.js';

const TAB_CONFIG_URL = './opt/tab-visibility.json';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function renderEnhancedModelConvertersTab(container) {
  const destroyBase = renderModelConvertersTab(container);
  const destroyEnhancer = enhanceModelConvertersTab(container);
  const destroyNpsEnhancer = enhanceNpsBoreMasterTab(container);
  return () => {
    try { destroyNpsEnhancer?.(); } catch {}
    try { destroyEnhancer?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}

const TABS = [
  { id: 'viewer3d',     label: '3D Viewer',     group: 'Viewers', render: renderViewer3D },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', group: 'Viewers', render: renderViewer3DRvm },
  { id: 'rvm-json-pcf-extract',    label: 'JSON → PCF Extract',     group: 'Extraction', render: (container, ctx) => mountRvmJsonPcfExtractTab(container, ctx) },
  { id: 'universal-xml-converter', label: 'XML Converter',           group: 'Extraction', render: renderUniversalXmlConverterTab },
  { id: 'xml-compare',             label: 'XML Compare',             group: 'Extraction', render: renderXmlCompareTab },
  { id: 'model-converters', label: 'Model Converters',  group: 'Convert', render: renderEnhancedModelConvertersTab },
  { id: 'model-exchange',   label: 'Format Converter',  group: 'Convert', render: renderModelExchangeTab },
  { id: 'interchange-config',    label: 'Converter Config', group: 'Config', render: renderInterchangeConfigTab },
  { id: 'support-mapping-config', label: 'Support Config',  group: 'Config', render: renderSupportMappingConfigTab },
  { id: 'adapter-mapping',        label: '⚙ Adapter Config', group: 'Config', render: renderAdapterMappingTab },
  ...(IS_DEV ? [
    { id: 'adv-glb',        label: 'Basic GLB/PCF Viewer', group: 'Dev', render: renderBasicGlbPcfPanel },
    { id: 'pcfx-converter', label: 'PCF↔PCFX↔GLB',        group: 'Dev', render: renderPcfxConverterTab },
  ] : []),
];

let _visibleTabs = [...TABS];
let _switchHandlerBound = false;

export async function init() {
  loadStickyState();
  if (IS_DEV) {
    try { destroyDevDebugWindow(); } catch {}
  }
  _visibleTabs = await _loadVisibleTabs();
  _buildTabBar();
  _bindAppSwitchHandler();
  _bindGlobalEvents();
  if (state.activeTab && _visibleTabs.some((tab) => tab.id === state.activeTab)) {
    setActiveTab(state.activeTab);
  } else {
    setActiveTab(_visibleTabs[0]?.id || 'viewer3d');
  }
}

async function _loadVisibleTabs() {
  try {
    const response = await fetch(TAB_CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    if (!config || typeof config !== 'object') return [...TABS];
    const hidden = new Set(Array.isArray(config.hiddenTabs) ? config.hiddenTabs : []);
    const order = Array.isArray(config.order) ? config.order : [];
    const tabById = new Map(TABS.map((tab) => [tab.id, tab]));
    const ordered = [];
    for (const id of order) {
      const tab = tabById.get(id);
      if (tab && !hidden.has(id)) ordered.push(tab);
    }
    for (const tab of TABS) {
      if (!hidden.has(tab.id) && !ordered.includes(tab)) ordered.push(tab);
    }
    return ordered;
  } catch (error) {
    console.warn('[tabs] Failed to load tab visibility config:', error);
    return [...TABS];
  }
}

function _buildTabBar() {
  const tabBar = document.getElementById('tab-bar');
  if (!tabBar) return;
  tabBar.innerHTML = '';
  const groups = new Map();
  for (const tab of _visibleTabs) {
    if (!groups.has(tab.group)) groups.set(tab.group, []);
    groups.get(tab.group).push(tab);
  }
  for (const [group, tabs] of groups) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-group';
    const label = document.createElement('div');
    label.className = 'tab-group-label';
    label.textContent = group;
    wrapper.appendChild(label);
    for (const tab of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-btn';
      button.dataset.tab = tab.id;
      button.textContent = tab.label;
      wrapper.appendChild(button);
    }
    tabBar.appendChild(wrapper);
  }
}

function _bindAppSwitchHandler() {
  if (_switchHandlerBound) return;
  _switchHandlerBound = true;
  const tabBar = document.getElementById('tab-bar');
  tabBar?.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.tab-btn');
    if (!button) return;
    const tabId = button.dataset.tab;
    if (tabId) setActiveTab(tabId);
  });
}

function _bindGlobalEvents() {
  on(RuntimeEvents.TAB_CHANGED, (tabId) => {
    _renderActiveTab(tabId);
  });
}

let _destroyActiveTab = null;
function _renderActiveTab(tabId) {
  const container = document.getElementById('app');
  if (!container) return;
  try { _destroyActiveTab?.(); } catch {}
  _destroyActiveTab = null;
  const tab = _visibleTabs.find((entry) => entry.id === tabId) || _visibleTabs[0];
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab?.id);
  });
  container.innerHTML = '';
  if (!tab) return;
  try {
    _destroyActiveTab = tab.render(container, { state, emit, showToast, showLoading, hideLoading, requestPat, loadRvmSource, RvmStaticBundleLoader, RvmHelperBridge, RvmGitHubActionsBridge });
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="error-card">Failed to render tab: ${String(error?.message || error)}</div>`;
  }
}
