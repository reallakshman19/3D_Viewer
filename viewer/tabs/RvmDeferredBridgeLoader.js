const VERSION = '20260625-rvm-deferred-source-preview-tools-1';
const API_KEY = '__PCF_GLB_RVM_BRIDGE_LOADER__';
const ACTION_DIAGNOSTICS_KEY = '__PCF_GLB_RVM_ACTION_DIAGNOSTICS__';

const SOURCE_PREVIEW_KIND_RE = /^(json|jscon|inputxml|uxml|txt|source-preview|stagedjson)$/i;

const BRIDGE_GROUPS = Object.freeze({
  sourcePreview: [
    { id: 'nonprimitive-support-overlay', specifier: './RvmNonPrimitiveSupportOverlayBridge.js?v=20260623-nonprimitive-support-overlay-9', install: 'installRvmNonPrimitiveSupportOverlayBridge' },
    { id: 'nonprimitive-support-hard-disable', specifier: './RvmNonPrimitiveSupportOverlayHardDisableBridge.js?v=20260623-nonprimitive-support-hard-disable-1', install: 'installRvmNonPrimitiveSupportOverlayHardDisableBridge' },
    { id: 'nonprimitive-support-details-panel', specifier: './RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260623-nonprimitive-support-details-panel-4', install: 'installRvmNonPrimitiveSupportOverlayDetailsPanelBridge' },
    { id: 'nonprimitive-support-hover', specifier: './RvmNonPrimitiveSupportOverlayHoverBridge.js?v=20260623-nonprimitive-support-hover-2', install: 'installRvmNonPrimitiveSupportOverlayHoverBridge' },
    { id: 'nonprimitive-auto-bend', specifier: './RvmNonPrimitiveAutoBendBridge.js?v=20260623-nonprimitive-auto-bend-preview-2', install: 'installRvmNonPrimitiveAutoBendBridge' },
    { id: 'nonprimitive-node-markers', specifier: './RvmNonPrimitiveNodeMarkerBridge.js?v=20260625-node-marker-deferred-1', install: 'installRvmNonPrimitiveNodeMarkerBridge' },
    { id: 'nonprimitive-source-tools-ui', specifier: './RvmNonPrimitiveSourceToolsUiBridge.js?v=20260626-source-tools-shell-slot-1', install: 'installRvmNonPrimitiveSourceToolsUiBridge' },
  ],
  postModel: [
    { id: 'stagedjson-export', specifier: './RvmStagedJsonExportBridge.js?v=20260624-rvm-stagedjson-support-policy-1', install: 'installRvmStagedJsonExportBridge' },
    { id: 'stagedjson-validation', specifier: './RvmStagedJsonValidationBridge.js?v=20260624-rvm-stagedjson-support-policy-1', install: 'installRvmStagedJsonValidationBridge' },
    { id: 'primitive-fallback', specifier: './RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1', install: 'installRvmPrimitiveFallbackBridge' },
    { id: 'native-glb-export', specifier: './RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-glb-component-hierarchy-v3-1', install: 'installRvmNativeSceneGlbExportBridge' },
    { id: 'glb-export-profile', specifier: './RvmGlbExportProfileBridge.js?v=20260620-rvm-glb-export-profile-units-1', install: 'installRvmGlbExportProfileBridge' },
    { id: 'glb-export-validation', specifier: './RvmGlbExportValidationBridge.js?v=20260620-rvm-glb-export-validation-1', install: 'installRvmGlbExportValidationBridge' },
    { id: 'glb-roundtrip-validation', specifier: './RvmGlbRoundTripValidationBridge.js?v=20260620-rvm-glb-roundtrip-validation-1', install: 'installRvmGlbRoundTripValidationBridge' },
    { id: 'glb-selection-parity', specifier: './RvmGlbSelectionParityBridge.js?v=20260620-rvm-glb-selection-details-parity-1', install: 'installRvmGlbSelectionParityBridge' },
    { id: 'glb-acceptance-pack', specifier: './RvmGlbAcceptancePackBridge.js?v=20260620-rvm-stagedjson-validation-1', install: 'installRvmGlbAcceptancePackBridge' },
    { id: 'native-tessellation-diagnostics', specifier: './RvmNativeTessellationDiagnosticsBridge.js?v=20260620-rvm-native-diagnostics-1', install: 'installRvmNativeTessellationDiagnosticsBridge' },
    { id: 'object-search', specifier: './RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1', install: 'installRvmObjectSearchBridge' },
    { id: 'visibility-snapshots', specifier: './RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1', install: 'installRvmVisibilitySnapshotsBridge' },
    { id: 'selection-sets', specifier: './RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1', install: 'installRvmSelectionSetsBridge' },
    { id: 'report-export', specifier: './RvmReportExportBridge.js?v=20260621-rvm-report-export-1', install: 'installRvmReportExportBridge' },
    { id: 'model-health', specifier: './RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1', install: 'installRvmModelHealthBridge' },
    { id: 'model-health-issues', specifier: './RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1', install: 'installRvmModelHealthIssuesBridge' },
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
    ensureSourcePreview: (reason = 'api') => ensureSourcePreviewGroupIfNeeded(reason),
    getLoadedBridgeIds: () => [...loadedSpecs.keys()],
    getDiagnostics: () => globalThis[ACTION_DIAGNOSTICS_KEY] || null,
  };
  api.version = VERSION;
  api.groups = Object.keys(BRIDGE_GROUPS);
  api.ensureSourcePreview = (reason = 'api') => ensureSourcePreviewGroupIfNeeded(reason);
  globalThis[API_KEY] = api;
  installRvmBridgeActionDiagnostics();
  installModelLoadedListener();
  startModelReadyPolling(api);
  afterFirstPaint(() => {
    const root = document.querySelector('[data-rvm-viewer]');
    if (root?.dataset?.rvmModelLoaded === 'true') {
      api.ensurePostModel('already-loaded-after-first-paint');
      api.ensureSourcePreview('already-loaded-after-first-paint');
    }
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
    if (groupName === 'sourcePreview' && !failures.length) refreshSourcePreviewRuntime(reason);
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
  globalThis.addEventListener('rvm-model-loaded', (event) => {
    const reason = event?.detail?.reason || 'rvm-model-loaded';
    afterFirstPaint(() => {
      ensureRvmBridgeGroup('postModel', reason);
      ensureSourcePreviewGroupIfNeeded(reason);
    });
  });
}

function startModelReadyPolling(api) {
  if (modelReadyPollStarted) return;
  modelReadyPollStarted = true;
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    if (root?.dataset?.rvmModelLoaded === 'true') {
      api.ensurePostModel('model-ready-poll');
      api.ensureSourcePreview('model-ready-poll');
      return;
    }
    if (attempts < 18) setTimeout(tick, 500);
  };
  setTimeout(tick, 500);
}

function ensureSourcePreviewGroupIfNeeded(reason = 'source-preview-check') {
  refreshRootInstallEpoch();
  const root = activeRoot || document.querySelector('[data-rvm-viewer]');
  if (!root) return Promise.resolve({ group: 'sourcePreview', reason, skipped: 'missing-root' });
  const mode = String(root.dataset?.rvmModelPrimitiveMode || '').toLowerCase();
  const kind = String(root.dataset?.rvmLoadedSourceKind || '').toLowerCase();
  const sourceHierarchy = globalThis.__3D_RVM_VIEWER__?.modelGroup?.userData?.__rvmNonPrimitiveSourceHierarchy;
  if (mode === 'source-preview' && SOURCE_PREVIEW_KIND_RE.test(kind) && sourceHierarchy) return ensureRvmBridgeGroup('sourcePreview', reason);
  return Promise.resolve({ group: 'sourcePreview', reason, skipped: 'not-source-preview', mode, kind });
}

function refreshSourcePreviewRuntime(reason) {
  const root = activeRoot || document.querySelector('[data-rvm-viewer]');
  const viewer = globalThis.__3D_RVM_VIEWER__;
  globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_AUTO_BEND__?.refresh?.(viewer, reason);
  globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__?.refresh?.(viewer, reason);
  globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI__?.sync?.(root, viewer);
  globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_NODE_MARKERS__?.refresh?.(viewer, reason);
}

function refreshDiagnosticsDrawer() {
  globalThis.__PCF_GLB_RVM_BOTTOM_DIAGNOSTICS__?.sync?.('bridge-loader');
}

function installRvmBridgeActionDiagnostics() {
  if (actionDiagnosticsInstalled) return;
  actionDiagnosticsInstalled = true;
  globalThis.addEventListener?.('error', (event) => reportRvmActionError(event.error || event.message, { action: 'window-error' }));
  globalThis.addEventListener?.('unhandledrejection', (event) => reportRvmActionError(event.reason, { action: 'unhandled-rejection' }));
}

function reportRvmActionError(error, context = {}) {
  const message = error?.message || String(error || 'Unknown error');
  const stack = error?.stack || '';
  const diagnostics = globalThis[ACTION_DIAGNOSTICS_KEY] || { version: VERSION, errors: [] };
  diagnostics.version = VERSION;
  diagnostics.errors.push({ message, stack, context, at: new Date().toISOString() });
  diagnostics.errors = diagnostics.errors.slice(-20);
  globalThis[ACTION_DIAGNOSTICS_KEY] = diagnostics;
  try { console.warn('[RVM Bridge Loader]', message, context); } catch (_) {}
}

function afterFirstPaint(callback) {
  const raf = globalThis.requestAnimationFrame;
  if (typeof raf === 'function') raf(() => setTimeout(callback, 0));
  else setTimeout(callback, 0);
}
