const VERSION = '20260621-rvm-button-hardening-1';
const API_KEY = '__PCF_GLB_RVM_BRIDGE_LOADER__';
const ACTION_DIAGNOSTICS_KEY = '__PCF_GLB_RVM_ACTION_DIAGNOSTICS__';

const BRIDGE_GROUPS = Object.freeze({
  postModel: [
    { id: 'support-summary', specifier: './RvmSupportSummaryBridge.js?v=20260620-rvm-support-symbol-mode-1', install: 'installRvmSupportSummaryBridge' },
    { id: 'support-assembly', specifier: './RvmSupportAssemblyBridge.js?v=20260620-rvm-support-assembly-dish-1', install: 'installRvmSupportAssemblyBridge' },
    { id: 'support-engine', specifier: './RvmIntelligentSupportEngineBridge.js?v=20260620-rvm-intelligent-support-engine-1', install: 'installRvmIntelligentSupportEngineBridge' },
    { id: 'support-geometry', specifier: './RvmSupportGeometryBridge.js?v=20260621-rvm-button-hardening-1', install: 'installRvmSupportGeometryBridge', beforeInstall: clearSupportGeometryStickyMode },
    { id: 'support-att', specifier: './RvmSupportAttMappingBridge.js?v=20260621-rvm-button-hardening-1', install: 'installRvmSupportAttMappingBridge' },
    { id: 'stagedjson-export', specifier: './RvmStagedJsonExportBridge.js?v=20260621-rvm-button-hardening-1', install: 'installRvmStagedJsonExportBridge' },
    { id: 'stagedjson-validation', specifier: './RvmStagedJsonValidationBridge.js?v=20260620-rvm-stagedjson-validation-1', install: 'installRvmStagedJsonValidationBridge' },
    { id: 'primitive-fallback', specifier: './RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1', install: 'installRvmPrimitiveFallbackBridge' },
    { id: 'native-glb-export', specifier: './RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-glb-component-hierarchy-v3-1', install: 'installRvmNativeSceneGlbExportBridge' },
    { id: 'glb-export-profile', specifier: './RvmGlbExportProfileBridge.js?v=20260620-rvm-glb-export-profile-units-1', install: 'installRvmGlbExportProfileBridge' },
    { id: 'glb-export-validation', specifier: './RvmGlbExportValidationBridge.js?v=20260620-rvm-glb-export-validation-1', install: 'installRvmGlbExportValidationBridge' },
    { id: 'glb-roundtrip-validation', specifier: './RvmGlbRoundTripValidationBridge.js?v=20260620-rvm-glb-roundtrip-validation-1', install: 'installRvmGlbRoundTripValidationBridge' },
    { id: 'glb-selection-parity', specifier: './RvmGlbSelectionParityBridge.js?v=20260620-rvm-glb-selection-details-parity-1', install: 'installRvmGlbSelectionParityBridge' },
    { id: 'glb-acceptance-pack', specifier: './RvmGlbAcceptancePackBridge.js?v=20260620-rvm-stagedjson-validation-1', install: 'installRvmGlbAcceptancePackBridge' },
    { id: 'native-tessellation-diagnostics', specifier: './RvmNativeTessellationDiagnosticsBridge.js?v=20260620-rvm-native-diagnostics-1', install: 'installRvmNativeTessellationDiagnosticsBridge' },
  ],
});

const loadedSpecs = new Map();
const groupPromises = new Map();
let activeRoot = null;
let modelLoadedListenerInstalled = false;
let modelReadyPollStarted = false;
let actionDiagnosticsInstalled = false;

export function installRvmDeferredBridgeLoader() {
  refreshRootInstallEpoch();
  const api = globalThis[API_KEY] || {
    version: VERSION,
    groups: Object.keys(BRIDGE_GROUPS),
    ensureGroup: (groupName, reason = 'api') => ensureRvmBridgeGroup(groupName, reason),
    ensurePostModel: (reason = 'api') => ensureRvmBridgeGroup('postModel', reason),
    getLoadedBridgeIds: () => [...loadedSpecs.keys()],
    getDiagnostics: () => globalThis[ACTION_DIAGNOSTICS_KEY] || null,
  };
  api.version = VERSION;
  globalThis[API_KEY] = api;
  installRvmBridgeActionDiagnostics();
  installModelLoadedListener();
  startModelReadyPolling(api);
  afterFirstPaint(() => {
    const root = document.querySelector('[data-rvm-viewer]');
    if (root?.dataset?.rvmModelLoaded === 'true') api.ensurePostModel('already-loaded-after-first-paint');
  });
  return api;
}

export function ensureRvmBridgeGroup(groupName, reason = 'manual') {
  refreshRootInstallEpoch();
  const group = BRIDGE_GROUPS[groupName];
  if (!group) return Promise.reject(new Error(`Unknown RVM bridge group: ${groupName}`));
  const existing = groupPromises.get(groupName);
  if (existing) return existing;
  const promise = Promise.allSettled(group.map((spec) => loadAndInstall(spec, reason))).then((results) => {
    const failures = results
      .map((result, index) => ({ result, spec: group[index] }))
      .filter(({ result }) => result.status === 'rejected');
    if (failures.length) {
      for (const { result, spec } of failures) reportRvmActionError(result.reason, { action: 'bridge-install', bridge: spec.id, group: groupName, reason });
    }
    refreshDiagnosticsDrawer();
    return { group: groupName, reason, results, failures };
  });
  groupPromises.set(groupName, promise);
  return promise;
}

async function loadAndInstall(spec, reason) {
  if (loadedSpecs.has(spec.id)) return loadedSpecs.get(spec.id);
  spec.beforeInstall?.();
  const module = await import(spec.specifier);
  const installer = module?.[spec.install];
  if (typeof installer !== 'function') throw new Error(`RVM bridge ${spec.id} missing installer ${spec.install}`);
  const api = installer();
  const entry = { id: spec.id, version: VERSION, reason, installedAt: new Date().toISOString(), api: Boolean(api) };
  loadedSpecs.set(spec.id, entry);
  return entry;
}

function refreshRootInstallEpoch() {
  const root = document.querySelector('[data-rvm-viewer]');
  if (!root || root === activeRoot) return;
  activeRoot = root;
  groupPromises.clear();
  loadedSpecs.clear();
}

function installModelLoadedListener() {
  if (modelLoadedListenerInstalled || typeof globalThis.addEventListener !== 'function') return;
  modelLoadedListenerInstalled = true;
  globalThis.addEventListener('rvm-model-loaded', () => {
    afterFirstPaint(() => ensureRvmBridgeGroup('postModel', 'rvm-model-loaded'));
  });
}

function startModelReadyPolling(api) {
  if (modelReadyPollStarted) return;
  modelReadyPollStarted = true;
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    const modelReady = Boolean(root && viewer?.modelGroup?.children?.length);
    if (modelReady) {
      root.dataset.rvmModelLoaded = 'true';
      afterFirstPaint(() => api.ensurePostModel('detected-model-group'));
      return;
    }
    if (attempts < 240) setTimeout(tick, 500);
  };
  afterFirstPaint(tick);
}

function clearSupportGeometryStickyMode() {
  const root = document.querySelector('[data-rvm-viewer]');
  if (root && root.dataset.rvmSupportGeometryUserSet !== 'true') root.dataset.rvmSupportGeometryMode = 'off';
  try { if (root?.dataset?.rvmSupportGeometryUserSet !== 'true') localStorage.removeItem('rvm_support_geometry_mode_v1'); } catch (_) {}
}

function installRvmBridgeActionDiagnostics() {
  if (actionDiagnosticsInstalled) return;
  actionDiagnosticsInstalled = true;
  globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__ = reportRvmActionError;
  globalThis.addEventListener?.('unhandledrejection', (event) => {
    if (!document.querySelector('[data-rvm-viewer]')) return;
    reportRvmActionError(event.reason || event, { action: 'unhandled-promise' });
  });
  globalThis.addEventListener?.('error', (event) => {
    if (!document.querySelector('[data-rvm-viewer]')) return;
    reportRvmActionError(event.error || event.message || event, { action: 'window-error' });
  });
}

function reportRvmActionError(error, context = {}) {
  const root = document.querySelector('[data-rvm-viewer]');
  const message = String(error?.message || error || 'Unknown RVM action error');
  const entry = {
    at: new Date().toISOString(),
    message,
    stack: String(error?.stack || ''),
    ...context,
  };
  const current = globalThis[ACTION_DIAGNOSTICS_KEY] || { schema: 'rvm-action-diagnostics/v1', version: VERSION, failures: [] };
  current.version = VERSION;
  current.failures = [entry, ...(current.failures || [])].slice(0, 20);
  current.failureCount = current.failures.length;
  globalThis[ACTION_DIAGNOSTICS_KEY] = current;
  if (root) {
    root.dataset.rvmButtonActionFailures = String(current.failureCount);
    const status = root.querySelector('#rvm-sb-msg');
    if (status) status.textContent = `RVM action failed: ${message}`;
    updateActionDiagnosticsPanel(root, current);
  }
  try { globalThis.dispatchEvent?.(new CustomEvent('rvm-action-diagnostics', { detail: current })); } catch (_) {}
  refreshDiagnosticsDrawer();
  console.warn('[RVM action diagnostics]', context, error);
  return current;
}

function updateActionDiagnosticsPanel(root, diagnostics) {
  if (!root) return;
  let panel = root.querySelector('[data-rvm-action-diagnostics-panel]');
  if (!panel) {
    panel = document.createElement('div');
    panel.dataset.rvmActionDiagnosticsPanel = VERSION;
    panel.className = 'rvm-action-diagnostics-panel rvm-browser-parse-diagnostics';
    panel.innerHTML = '<h3>RVM Action Errors</h3><div data-rvm-action-diagnostics-body></div>';
    const right = root.querySelector('.rvm-right-panel') || root;
    right.appendChild(panel);
  }
  const body = panel.querySelector('[data-rvm-action-diagnostics-body]') || panel;
  const failures = diagnostics?.failures || [];
  body.innerHTML = failures.length
    ? failures.slice(0, 6).map((failure) => `<div class="rvm-browser-diag-warning"><b>${escapeHtml(failure.action || failure.bridge || 'action')}</b>: ${escapeHtml(failure.message)}</div>`).join('')
    : '<div class="rvm-empty-state">No action errors.</div>';
}

function refreshDiagnosticsDrawer() {
  try { globalThis.__PCF_GLB_RVM_BOTTOM_DIAGNOSTICS_DRAWER__?.refresh?.(); } catch (_) {}
}

function afterFirstPaint(fn) {
  const run = () => {
    if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 0);
  };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
  else setTimeout(run, 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
