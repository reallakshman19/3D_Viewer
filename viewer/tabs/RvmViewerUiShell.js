const VERSION = '20260626-rvm-ui-shell-slots-1';
const API_KEY = '__PCF_GLB_RVM_UI_SHELL__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
let bootstrapScheduled = false;

export const RVM_UI_SHELL_SLOTS = Object.freeze({
  hierarchy: 'hierarchy',
  selection: 'selection',
  sourceTools: 'source-tools',
  nodeMarkers: 'node-markers',
  supports: 'supports',
  diagnostics: 'diagnostics',
  exports: 'exports',
});

const DEFAULT_RIGHT_PANEL_TABS = Object.freeze([
  { id: RVM_UI_SHELL_SLOTS.selection, label: 'Selection' },
  { id: RVM_UI_SHELL_SLOTS.sourceTools, label: 'Source Tools' },
  { id: RVM_UI_SHELL_SLOTS.nodeMarkers, label: 'Node Markers' },
  { id: RVM_UI_SHELL_SLOTS.supports, label: 'Supports' },
  { id: RVM_UI_SHELL_SLOTS.diagnostics, label: 'Diagnostics' },
]);

const stateByRoot = new WeakMap();

export function installRvmViewerUiShell(root, options = {}) {
  if (typeof document === 'undefined') return null;
  const resolvedRoot = resolveRoot(root);
  publishApi();
  if (!resolvedRoot) {
    scheduleShellBootstrap(options.reason || 'waiting-for-rvm-root');
    return globalThis[API_KEY];
  }
  const existing = stateByRoot.get(resolvedRoot);
  if (existing) {
    existing.installCount += 1;
    return syncRvmViewerUiShell(resolvedRoot, { ...options, reason: options.reason || 'repeat-install' });
  }
  const state = {
    version: VERSION,
    root: resolvedRoot,
    installCount: 1,
    syncCount: 0,
    activeRightPanelTab: options.activeRightPanelTab || RVM_UI_SHELL_SLOTS.selection,
    registeredPanels: new Map(),
    traces: [],
    onClick: null,
  };
  state.onClick = (event) => {
    const tab = event?.target?.closest?.('[data-rvm-right-panel-tab]');
    if (!tab || !resolvedRoot.contains?.(tab)) return;
    event.preventDefault?.();
    setRvmRightPanelTab(resolvedRoot, tab.dataset.rvmRightPanelTab || RVM_UI_SHELL_SLOTS.selection, 'tab-click');
  };
  resolvedRoot.addEventListener?.('click', state.onClick, true);
  stateByRoot.set(resolvedRoot, state);
  recordTrace(state, 'install', { reason: options.reason || 'install' });
  return syncRvmViewerUiShell(resolvedRoot, { ...options, reason: options.reason || 'install' });
}

export function disposeRvmViewerUiShell(root) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? stateByRoot.get(resolvedRoot) : null;
  if (!resolvedRoot || !state) return false;
  resolvedRoot.removeEventListener?.('click', state.onClick, true);
  stateByRoot.delete(resolvedRoot);
  delete resolvedRoot.dataset.rvmUiShellVersion;
  return true;
}

export function syncRvmViewerUiShell(root, options = {}) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot) return null;
  const state = stateByRoot.get(resolvedRoot) || null;
  const auditBefore = auditRvmViewerUiShell(resolvedRoot);
  ensureBaseSlots(resolvedRoot);
  ensureRightPanelTabs(resolvedRoot, state?.activeRightPanelTab || RVM_UI_SHELL_SLOTS.selection);
  if (state) {
    state.syncCount += 1;
    recordTrace(state, 'sync', { reason: options.reason || 'sync' });
    state.diagnostics = buildDiagnostics(resolvedRoot, state, options.reason || 'sync', auditBefore);
    resolvedRoot.dataset.rvmUiShellVersion = VERSION;
    resolvedRoot.dataset.rvmUiShellAudit = state.diagnostics.audit.ok ? 'ok' : 'invalid';
    return state.diagnostics;
  }
  return buildDiagnostics(resolvedRoot, null, options.reason || 'sync', auditBefore);
}

export function registerRvmToolPanel(root, panel) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? stateByRoot.get(resolvedRoot) : null;
  if (!resolvedRoot || !state || !panel?.id) return null;
  const slotId = normalizeSlotId(panel.slot || panel.group || panel.id);
  const entry = {
    id: String(panel.id),
    title: String(panel.title || panel.id),
    slot: slotId,
    priority: Number.isFinite(panel.priority) ? panel.priority : 100,
    render: typeof panel.render === 'function' ? panel.render : null,
  };
  state.registeredPanels.set(entry.id, entry);
  const slot = getSlot(resolvedRoot, slotId);
  if (slot) {
    slot.dataset.rvmPanelSlotRegistered = 'true';
    if (entry.render) entry.render({ root: resolvedRoot, container: slot, shell: getRvmViewerUiShellApi() });
  }
  recordTrace(state, 'register-panel', { id: entry.id, slot: entry.slot });
  return syncRvmViewerUiShell(resolvedRoot, { reason: `register:${entry.id}` });
}

export function setRvmRightPanelTab(root, tabId, reason = 'api') {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? stateByRoot.get(resolvedRoot) : null;
  if (!resolvedRoot || !state) return null;
  const normalized = normalizeSlotId(tabId);
  state.activeRightPanelTab = normalized;
  recordTrace(state, 'set-right-tab', { tabId: normalized, reason });
  return syncRvmViewerUiShell(resolvedRoot, { reason });
}

export function auditRvmViewerUiShell(root) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot) return { version: VERSION, ok: false, reason: 'missing-root' };
  const slots = Object.values(RVM_UI_SHELL_SLOTS).reduce((acc, slotId) => {
    acc[slotId] = resolvedRoot.querySelectorAll?.(`[data-rvm-panel-slot="${slotId}"]`)?.length || 0;
    return acc;
  }, {});
  const missingRequired = [];
  if (!resolvedRoot.querySelector?.('.rvm-left-panel')) missingRequired.push('left-panel');
  if (!resolvedRoot.querySelector?.('.rvm-right-panel')) missingRequired.push('right-panel');
  if (!resolvedRoot.querySelector?.('.rvm-viewport')) missingRequired.push('viewport');
  if (slots.hierarchy !== 1) missingRequired.push('hierarchy-slot');
  if (slots.selection !== 1) missingRequired.push('selection-slot');
  if (slots.diagnostics !== 1) missingRequired.push('diagnostics-slot');
  return {
    version: VERSION,
    ok: missingRequired.length === 0,
    reason: missingRequired.length ? 'missing-shell-contract' : 'shell-contract-ok',
    missingRequired,
    tabCount: resolvedRoot.querySelectorAll?.('[data-rvm-right-panel-tab]')?.length || 0,
    slots,
  };
}

export function getRvmViewerUiShellDiagnostics(root) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? stateByRoot.get(resolvedRoot) : null;
  return state?.diagnostics || syncRvmViewerUiShell(resolvedRoot, { reason: 'diagnostics' });
}

function scheduleShellBootstrap(reason) {
  if (bootstrapScheduled || typeof document === 'undefined') return;
  bootstrapScheduled = true;
  const delays = [0, 80, 250, 750, 1500, 3000];
  for (const delay of delays) {
    setTimeout(() => {
      const root = document.querySelector?.(ROOT_SELECTOR);
      if (root && !stateByRoot.get(root)) installRvmViewerUiShell(root, { reason: `bootstrap:${reason}` });
      if (root) bootstrapScheduled = false;
    }, delay);
  }
}

function ensureBaseSlots(root) {
  root.dataset.rvmUiShellVersion = VERSION;
  const leftPanel = root.querySelector?.('.rvm-left-panel');
  const rightPanel = root.querySelector?.('.rvm-right-panel');
  const viewport = root.querySelector?.('.rvm-viewport');
  if (leftPanel) {
    leftPanel.dataset.rvmPanelRegion = 'left';
    const tree = root.querySelector?.('#rvm-tree');
    if (tree && !tree.closest?.('[data-rvm-panel-slot]')) wrapRange(leftPanel, [tree], RVM_UI_SHELL_SLOTS.hierarchy, 'Hierarchy');
    else ensureSlotMarker(leftPanel, RVM_UI_SHELL_SLOTS.hierarchy, 'Hierarchy');
  }
  if (viewport) viewport.dataset.rvmPanelRegion = 'viewport';
  if (rightPanel) {
    rightPanel.dataset.rvmPanelRegion = 'right';
    ensureRightPanelSlot(rightPanel, RVM_UI_SHELL_SLOTS.selection, 'Selection');
    ensureRightPanelSlot(rightPanel, RVM_UI_SHELL_SLOTS.sourceTools, 'Source Tools');
    ensureRightPanelSlot(rightPanel, RVM_UI_SHELL_SLOTS.nodeMarkers, 'Node Markers');
    ensureRightPanelSlot(rightPanel, RVM_UI_SHELL_SLOTS.supports, 'Supports');
    ensureRightPanelSlot(rightPanel, RVM_UI_SHELL_SLOTS.diagnostics, 'Diagnostics');
    moveKnownRightPanelContent(rightPanel);
  }
}

function ensureRightPanelTabs(root, activeTab) {
  const rightPanel = root.querySelector?.('.rvm-right-panel');
  if (!rightPanel) return;
  let tabs = rightPanel.querySelector?.('[data-rvm-right-panel-tabs]');
  if (!tabs) {
    tabs = document.createElement('div');
    tabs.className = 'rvm-right-panel-tabs';
    tabs.dataset.rvmRightPanelTabs = VERSION;
    rightPanel.insertBefore(tabs, rightPanel.firstChild || null);
  }
  tabs.innerHTML = DEFAULT_RIGHT_PANEL_TABS.map((tab) => `<button type="button" class="rvm-right-panel-tab ${tab.id === activeTab ? 'is-active' : ''}" data-rvm-right-panel-tab="${escapeAttr(tab.id)}" aria-selected="${tab.id === activeTab ? 'true' : 'false'}">${escapeHtml(tab.label)}</button>`).join('');
  for (const slot of [...rightPanel.querySelectorAll('[data-rvm-panel-slot]')]) {
    const active = slot.dataset.rvmPanelSlot === activeTab;
    slot.hidden = !active;
    slot.dataset.rvmPanelSlotActive = String(active);
  }
}

function ensureRightPanelSlot(rightPanel, slotId, title) {
  let slot = rightPanel.querySelector?.(`[data-rvm-panel-slot="${slotId}"]`);
  if (slot) return slot;
  slot = document.createElement('section');
  slot.className = `rvm-panel-slot rvm-panel-slot-${slotId}`;
  slot.dataset.rvmPanelSlot = slotId;
  slot.dataset.rvmPanelSlotTitle = title;
  slot.innerHTML = `<div class="rvm-panel-slot-empty">${escapeHtml(title)} slot ready.</div>`;
  rightPanel.appendChild(slot);
  return slot;
}

function moveKnownRightPanelContent(rightPanel) {
  const selectionSlot = rightPanel.querySelector?.('[data-rvm-panel-slot="selection"]');
  const diagnosticsSlot = rightPanel.querySelector?.('[data-rvm-panel-slot="diagnostics"]');
  const attrs = rightPanel.querySelector?.('#rvm-attributes-panel');
  const browserDiagnostics = rightPanel.querySelector?.('#rvm-browser-parse-diagnostics');
  if (attrs && selectionSlot && !selectionSlot.contains(attrs)) {
    const header = findPreviousPanelHeader(attrs);
    clearSlotEmpty(selectionSlot);
    if (header) selectionSlot.appendChild(header);
    selectionSlot.appendChild(attrs);
  }
  if (browserDiagnostics && diagnosticsSlot && !diagnosticsSlot.contains(browserDiagnostics)) {
    const header = findPreviousPanelHeader(browserDiagnostics);
    clearSlotEmpty(diagnosticsSlot);
    if (header) diagnosticsSlot.appendChild(header);
    diagnosticsSlot.appendChild(browserDiagnostics);
  }
}

function ensureSlotMarker(panel, slotId, title) {
  if (panel.querySelector?.(`[data-rvm-panel-slot="${slotId}"]`)) return;
  const slot = document.createElement('section');
  slot.className = `rvm-panel-slot rvm-panel-slot-${slotId}`;
  slot.dataset.rvmPanelSlot = slotId;
  slot.dataset.rvmPanelSlotTitle = title;
  panel.appendChild(slot);
}

function wrapRange(panel, nodes, slotId, title) {
  const slot = document.createElement('section');
  slot.className = `rvm-panel-slot rvm-panel-slot-${slotId}`;
  slot.dataset.rvmPanelSlot = slotId;
  slot.dataset.rvmPanelSlotTitle = title;
  for (const node of nodes) slot.appendChild(node);
  panel.appendChild(slot);
}

function findPreviousPanelHeader(node) {
  let prev = node?.previousElementSibling || null;
  while (prev) {
    if (prev.classList?.contains?.('rvm-panel-header')) return prev;
    if (prev.dataset?.rvmRightPanelTabs || prev.dataset?.rvmPanelSlot) return null;
    prev = prev.previousElementSibling || null;
  }
  return null;
}

function clearSlotEmpty(slot) {
  for (const empty of [...slot.querySelectorAll?.('.rvm-panel-slot-empty') || []]) empty.remove?.();
}

function getSlot(root, slotId) {
  return root?.querySelector?.(`[data-rvm-panel-slot="${normalizeSlotId(slotId)}"]`) || null;
}

function normalizeSlotId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'sourcetools') return RVM_UI_SHELL_SLOTS.sourceTools;
  if (raw === 'nodemarkers') return RVM_UI_SHELL_SLOTS.nodeMarkers;
  return Object.values(RVM_UI_SHELL_SLOTS).includes(raw) ? raw : RVM_UI_SHELL_SLOTS.diagnostics;
}

function buildDiagnostics(root, state, reason, auditBefore) {
  const audit = auditRvmViewerUiShell(root);
  return {
    version: VERSION,
    reason,
    installed: Boolean(state),
    installCount: state?.installCount || 0,
    syncCount: state?.syncCount || 0,
    activeRightPanelTab: state?.activeRightPanelTab || RVM_UI_SHELL_SLOTS.selection,
    registeredPanels: [...(state?.registeredPanels?.values?.() || [])].map((entry) => ({ id: entry.id, title: entry.title, slot: entry.slot, priority: entry.priority })),
    auditBefore,
    audit,
    trace: [...(state?.traces || [])],
  };
}

function recordTrace(state, event, detail = {}) {
  const entry = { event, detail, activeRightPanelTab: state.activeRightPanelTab };
  state.traces.push(entry);
  if (state.traces.length > 30) state.traces.splice(0, state.traces.length - 30);
  return entry;
}

function publishApi() {
  globalThis[API_KEY] = getRvmViewerUiShellApi();
}

function getRvmViewerUiShellApi() {
  return {
    version: VERSION,
    slots: RVM_UI_SHELL_SLOTS,
    install: installRvmViewerUiShell,
    dispose: disposeRvmViewerUiShell,
    sync: syncRvmViewerUiShell,
    registerPanel: registerRvmToolPanel,
    setRightPanelTab: setRvmRightPanelTab,
    audit: auditRvmViewerUiShell,
    getDiagnostics: getRvmViewerUiShellDiagnostics,
  };
}

function resolveRoot(root) {
  if (root && typeof root.querySelector === 'function') return root;
  if (typeof document !== 'undefined') return document.querySelector?.(ROOT_SELECTOR) || null;
  return null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
