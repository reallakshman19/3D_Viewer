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
import { renderPSNM_UtilityTab } from '../tabs/psnm-utility-tab.js?v=20260610-psnm-20-psmap-tag-1';
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
]);

const TABS = [
  { id: 'viewer3d', label: '3D Viewer', render: renderViewer3D },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', render: renderViewer3DRvm },
  { id: 'model-converters', label: '3D Model Converters', render: renderModelConvertersTab },
  { id: 'basic-glb-pcf', label: 'Basic GLB-PCF', render: renderBasicGlbPcfPanel },
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

let mountedDestroy = null;
let appShell = null;
let visibilityRules = null;
let visibilityRulesPromise = null;
let unsubscribeTabChange = null;
let devDebugDestroy = null;

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
    .then((res) => res.ok ? res.json() : { tabs: {} })
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
  await loadTabVisibilityRules();
  const tabs = visibleTabs();
  let activeId = normalizeTabId(state.activeTab);
  if (!tabs.some((tab) => tab.id === activeId)) {
    activeId = tabs[0]?.id || TABS[0].id;
    setActiveTab(activeId);
  }
  syncActiveTabButton(shellRefs);
  const tab = tabs.find((item) => item.id === activeId) || tabs[0] || TABS[0];
  shellRefs.main.innerHTML = '';
  if (typeof mountedDestroy === 'function') {
    try { mountedDestroy(); } catch {}
    mountedDestroy = null;
  }
  const maybeDestroy = tab.render(shellRefs.main, { emit, setActiveTab, activeTab: tab.id });
  if (typeof maybeDestroy === 'function') mountedDestroy = maybeDestroy;
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
  loadStickyState();
  if (devDebugDestroy) { try { devDebugDestroy(); } catch {} }
  devDebugDestroy = initDevDebugWindow({ emit });
  loadTabVisibilityRules().then(() => {
    renderTabBar(appShell);
    renderActiveTab(appShell);
  });
  if (unsubscribeTabChange) unsubscribeTabChange();
  unsubscribeTabChange = on(RuntimeEvents.TAB_CHANGED, () => renderActiveTab(appShell));
  appShell.nav?.addEventListener('click', onTabClick);
  return () => {
    appShell?.nav?.removeEventListener('click', onTabClick);
    if (unsubscribeTabChange) { unsubscribeTabChange(); unsubscribeTabChange = null; }
    if (typeof mountedDestroy === 'function') { try { mountedDestroy(); } catch {} mountedDestroy = null; }
    if (devDebugDestroy) { try { devDebugDestroy(); } catch {} devDebugDestroy = null; }
  };
}

function onTabClick(event) {
  const button = event.target?.closest?.('[data-tab]');
  if (!button) return;
  setActiveTab(normalizeTabId(button.dataset.tab));
}

export async function init(shell) {
  if (mountedDestroy) {
    try { mountedDestroy(); } catch (error) { console.warn('Previous app mount cleanup failed', error); }
    mountedDestroy = null;
  }
  mountedDestroy = mountApp(resolveShellRefs(shell));
  return mountedDestroy;
}

export async function loadRvmSource() {
  // Kept for backward compatibility with older tab bootstrap code.
  return null;
}
