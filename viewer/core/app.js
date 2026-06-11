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
import { renderPSNM_UtilityTab } from '../tabs/psnm-utility-tab.js?v=20260610-psnm-19-native-audit-1';
import '../tabs/psnm-utility/psnm-ui-p2-enhancements.js?v=20260609-p2-1';
import '../tabs/psnm-utility/psnm-phase4c-hardening.js?v=20260609-phase4c-1';
import '../tabs/psnm-utility/psnm-phase4d-persistence.js?v=20260609-phase4d-1';
import { emit, on } from './event-bus.js';
import { initDevDebugWindow, destroyDevDebugWindow } from '../debug/dev-debug-window.js';

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
  ['utilities', 'psnm-utility'],
]);

const TABS = [
  { id: 'viewer3d', label: '3D Viewer', render: renderViewer3D },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', render: renderViewer3DRvm },
  { id: 'model-converters', label: '3D Model Converters', render: renderModelConvertersTab },
  { id: 'basic-glb-pcf', label: 'Basic GLB↔PCF', render: renderBasicGlbPcfPanel },
  { id: 'pcfx-converter', label: 'PCFX Converter', render: renderPcfxConverterTab },
  { id: 'model-exchange', label: 'Model Exchange', render: renderModelExchangeTab },
  { id: 'interchange-config', label: 'Interchange Config', render: renderInterchangeConfigTab },
  { id: 'support-mapping-config', label: 'Support Mapping', render: renderSupportMappingConfigTab },
  { id: 'adapter-mapping', label: 'Adapter Mapping', render: renderAdapterMappingTab },
  { id: 'rvm-json-pcf', label: 'RVM JSON→PCF', render: mountRvmJsonPcfExtractTab },
  { id: 'universal-xml', label: 'Universal XML', render: renderUniversalXmlConverterTab },
  { id: 'xml-compare', label: 'XML Compare', render: renderXmlCompareTab },
  { id: 'psnm-utility', label: 'Utilities', render: renderPSNM_UtilityTab },
];

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveShellRefs(shell = {}) {
  return {
    nav: shell.nav || shell.tabBar || document.getElementById('tab-bar') || document.querySelector('[data-app-tab-bar]'),
    main: shell.main || shell.content || document.getElementById('tab-content') || document.querySelector('[data-app-tab-content]'),
  };
}

let activeDestroy = null;
let mountedDestroy = null;
let visibleTabs = [...TABS];
let shellRefs = resolveShellRefs();
let visibilityLoaded = false;

export async function init(shell) {
  if (mountedDestroy) {
    try { mountedDestroy(); } catch (error) { console.warn('Previous app mount cleanup failed', error); }
    mountedDestroy = null;
  }
  mountedDestroy = mountApp(resolveShellRefs(shell));
  return mountedDestroy;
}

function normalizeTabId(id) {
  return TAB_ID_ALIASES.get(String(id || '').trim()) || String(id || '').trim();
}

async function loadTabVisibility() {
  if (visibilityLoaded) return;
  visibilityLoaded = true;
  try {
    const res = await fetch(TAB_VISIBILITY_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const config = await res.json();
    const hidden = new Set((config.hiddenTabs || config.hidden || []).map(normalizeTabId));
    const explicit = config.tabs || config.visibleTabs || null;
    if (Array.isArray(explicit) && explicit.length) {
      const allowed = new Set(explicit.map((item) => typeof item === 'string' ? normalizeTabId(item) : normalizeTabId(item.id)));
      visibleTabs = TABS.filter((tab) => allowed.has(tab.id) && !hidden.has(tab.id));
    } else {
      visibleTabs = TABS.filter((tab) => !hidden.has(tab.id));
    }
  } catch (error) {
    console.warn('Tab visibility config not loaded; using defaults', error);
  }
}

function buildTabBar() {
  if (!shellRefs.nav) return;
  shellRefs.nav.innerHTML = visibleTabs.map((tab) => (
    `<button type="button" class="tab-btn" data-tab="${h(tab.id)}">${h(tab.label)}</button>`
  )).join('');
}

function resolveInitialTabId() {
  const wanted = normalizeTabId(state?.activeTab || location.hash.replace(/^#/, '') || visibleTabs[0]?.id || 'viewer3d');
  return visibleTabs.some((tab) => tab.id === wanted) ? wanted : (visibleTabs[0]?.id || 'viewer3d');
}

function markActive(tabId) {
  shellRefs.nav?.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', normalizeTabId(btn.dataset.tab) === tabId);
  });
}

export async function renderActiveTab(tabId = state?.activeTab) {
  shellRefs = resolveShellRefs(shellRefs);
  if (!shellRefs.main) return;
  await loadTabVisibility();
  const resolved = normalizeTabId(tabId || resolveInitialTabId());
  const activeTab = visibleTabs.find((tab) => tab.id === resolved) || visibleTabs[0];
  if (!activeTab) return;
  setActiveTab(activeTab.id);
  markActive(activeTab.id);
  if (activeDestroy) {
    try { activeDestroy(); } catch (error) { console.warn('Tab cleanup failed', error); }
    activeDestroy = null;
  }
  shellRefs.main.innerHTML = '';
  let renderDestroy = null;
  try {
    renderDestroy = activeTab.render(shellRefs.main, { emit, on, state });
  } catch (error) {
    console.error(`Failed to render tab ${activeTab.id}`, error);
    shellRefs.main.innerHTML = `<div class="error">Failed to render ${h(activeTab.label)}: ${h(error.message || error)}</div>`;
    return;
  }
  activeDestroy = typeof renderDestroy === 'function' ? renderDestroy : null;
  try {
    emit(RuntimeEvents.TAB_RENDERED, { tabId: activeTab.id });
  } catch (error) {
    console.warn(`Tab render notification failed for ${activeTab.id}`, error);
  }
}

function bindNavClick() {
  shellRefs.nav?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    event.preventDefault();
    renderActiveTab(btn.dataset.tab);
  });
}

export function mountApp(shell = {}) {
  shellRefs = resolveShellRefs(shell);
  loadStickyState();
  initDevDebugWindow();
  let cancelled = false;
  (async () => {
    await loadTabVisibility();
    if (cancelled) return;
    buildTabBar();
    bindNavClick();
    renderActiveTab(resolveInitialTabId());
  })();
  return () => {
    cancelled = true;
    try { activeDestroy?.(); } catch {}
    activeDestroy = null;
    destroyDevDebugWindow();
  };
}

export function loadRvmSource(payload) {
  emit(RuntimeEvents.RVM_SOURCE_LOADED, payload);
}
