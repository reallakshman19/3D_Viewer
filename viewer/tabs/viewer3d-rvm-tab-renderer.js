// Stable app-shell export adapter for the 3D RVM Viewer tab.
// Active non-primitive source tools UI cache key: RvmNonPrimitiveSourceToolsUiBridge.js?v=20260624-source-tools-grouped-1
// RVM renderer lazy-loading contract: export/stagedJSON/validation bridges belong behind RvmDeferredBridgeLoader postModel.
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';

const VERSION = '20260624-rvm-perf-button-contract-1';
const CRITICAL_BRIDGES = Object.freeze([
  { id: 'progressive-model-root', specifier: '../rvm-viewer/RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1', install: 'installRvmProgressiveModelRootPatch', withViewerClass: true },
  { id: 'interaction-patch', specifier: './RvmViewerInteractionPatch.js?v=20260621-rvm-button-hardening-1', install: 'installRvmViewerInteractionPatch', withViewerClass: true },
  { id: 'ui-interaction-panel-patch', specifier: './RvmUiInteractionPanelPatch.js?v=20260621-rvm-ui-interaction-panels-1', install: 'installRvmUiInteractionPanelPatch', withViewerClass: true },
  { id: 'canvas-single-pick-guard', specifier: './RvmCanvasSelectionSinglePickGuardBridge.js?v=20260622-rvm-canvas-single-pick-guard-1', install: 'installRvmCanvasSelectionSinglePickGuardBridge', withViewerClass: true },
  { id: 'leaf-selection-identity', specifier: './RvmLeafSelectionIdentityBridge.js?v=20260622-rvm-leaf-selection-identity-1', install: 'installRvmLeafSelectionIdentityBridge', withViewerClass: true },
  { id: 'leaf-canvas-pick', specifier: './RvmLeafCanvasPickBridge.js?v=20260622-rvm-leaf-canvas-pick-orbit-guard-2', install: 'installRvmLeafCanvasPickBridge', withViewerClass: true },
  { id: 'hierarchy-selection', specifier: './RvmHierarchySelectionBridge.js?v=20260620-rvm-large-box-support-sync-1', install: 'installRvmHierarchySelectionBridge', withViewerClass: true },
  { id: 'selection-tree-sync', specifier: './RvmSelectionTreeSyncBridge.js?v=20260620-rvm-large-box-support-sync-1', install: 'installRvmSelectionTreeSyncBridge', withViewerClass: true },
  { id: 'visibility-toolbar', specifier: './RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1', install: 'installRvmVisibilityToolbarBridge', withViewerClass: true },
  { id: 'ui-event-safety', specifier: './RvmUiEventSafetyBridge.js?v=20260622-rvm-ui-event-safety-2', install: 'installRvmUiEventSafetyBridge' },
  { id: 'navigation-mode-arbiter', specifier: './RvmNavigationModeArbiterBridge.js?v=20260624-rvm-navigation-select-escape-1', install: 'installRvmNavigationModeArbiterBridge' },
  { id: 'bottom-diagnostics-drawer', specifier: './RvmBottomDiagnosticsDrawerBridge.js?v=20260622-rvm-support-tools-retired-1', install: 'installRvmBottomDiagnosticsDrawerBridge' },
  { id: 'deferred-bridge-loader', specifier: './RvmDeferredBridgeLoader.js?v=20260624-rvm-perf-button-contract-1', install: 'installRvmDeferredBridgeLoader' },
]);

const AFTER_PAINT_BRIDGES = Object.freeze([
  { id: 'retired-support-tools-purge', specifier: './RvmRetiredSupportToolsPurgeBridge.js?v=20260622-rvm-retired-support-tools-purge-2', install: 'installRvmRetiredSupportToolsPurgeBridge' },
  { id: 'nonprimitive-support-hard-disable', specifier: './RvmNonPrimitiveSupportOverlayHardDisableBridge.js?v=20260623-nonprimitive-support-hard-disable-1', install: 'installRvmNonPrimitiveSupportOverlayHardDisableBridge' },
  { id: 'selected-geometry-enrichment-panel', specifier: '../enrichment/SelectedGeometryEnrichmentPanel.js?v=20260624-selected-geometry-floating-workflow-3', install: 'installSelectedGeometryEnrichmentPanel' },
  { id: 'property-collapse-audit', specifier: './RvmPropertyPanelCollapseAuditBridge.js?v=20260621-rvm-property-collapse-1', install: 'installRvmPropertyPanelCollapseAuditBridge' },
  { id: 'label-performance', specifier: './RvmLabelPerformanceBridge.js?v=20260622-rvm-label-perf-no-support-runtime-1', install: 'installRvmLabelPerformanceBridge', withViewerClass: true },
  { id: 'zone-lod-labels', specifier: './RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1', install: 'installRvmZoneLodLabelBridge' },
  { id: 'deep-source-path-recovery', specifier: './RvmDeepSourcePathRecoveryBridge.js?v=20260622-rvm-deep-source-path-recovery-1', install: 'installRvmDeepSourcePathRecoveryBridge', withViewerClass: true },
  { id: 'zone-density-selector', specifier: './RvmZoneDensitySelectorBridgeV5.js?v=20260622-rvm-zone-density-selector-5', install: 'installRvmZoneDensitySelectorBridge' },
  { id: 'navis-hierarchy', specifier: './RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1', install: 'installRvmNavisHierarchyBridge', withViewerClass: true },
  { id: 'zone-lod-context', specifier: './RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1', install: 'installRvmZoneLodContextBridge' },
  { id: 'selection-details-inspector', specifier: './RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1', install: 'installRvmSelectionDetailsInspectorBridge' },
  { id: 'json-pcf-trigger', specifier: './RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1', install: 'installRvmJsonPcfTriggerBridge' },
  { id: 'policy-info', specifier: './RvmPolicyInfoBridge.js?v=20260621-rvm-policy-info-1', install: 'installRvmPolicyInfoBridge' },
  { id: 'diagnostic-panel-collapse', specifier: './RvmDiagnosticPanelCollapseBridge.js?v=20260621-rvm-diagnostic-collapse-1', install: 'installRvmDiagnosticPanelCollapseBridge' },
  { id: 'visibility-snapshots', specifier: './RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1', install: 'installRvmVisibilitySnapshotsBridge' },
  { id: 'object-search', specifier: './RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1', install: 'installRvmObjectSearchBridge', withViewerClass: true },
  { id: 'measure-tools', specifier: './RvmMeasureBridge.js?v=20260621-rvm-measure-tools-1', install: 'installRvmMeasureBridge', withViewerClass: true },
  { id: 'section-box', specifier: './RvmSectionBoxBridge.js?v=20260621-rvm-section-box-1', install: 'installRvmSectionBoxBridge', withViewerClass: true },
  { id: 'selection-sets', specifier: './RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1', install: 'installRvmSelectionSetsBridge' },
  { id: 'report-export', specifier: './RvmReportExportBridge.js?v=20260621-rvm-report-export-1', install: 'installRvmReportExportBridge', withViewerClass: true },
  { id: 'geometry-export-workspace', specifier: '../geometry-workspace/GeometryExportWorkspaceBridge.js?v=20260622-geometry-mapping-1', install: 'installGeometryExportWorkspaceBridge' },
  { id: 'geometry-mapping-profile', specifier: '../geometry-workspace/GeometryMappingProfileBridge.js?v=20260622-geometry-profile-ui-1', install: 'installGeometryMappingProfileBridge' },
  { id: 'model-health', specifier: './RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1', install: 'installRvmModelHealthBridge' },
  { id: 'model-health-issues', specifier: './RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1', install: 'installRvmModelHealthIssuesBridge' },
  { id: 'material-mode', specifier: './RvmMaterialModeBridge.js?v=20260620-rvm-remaining-material-modes-1', install: 'installRvmMaterialModeBridge', withViewerClass: true },
  { id: 'left-panel-resize-collapse', specifier: './RvmLeftPanelResizeCollapseBridge.js?v=20260624-rvm-panel-resize-1', install: 'installRvmLeftPanelResizeCollapseBridge' },
]);

const loadedBridgeIds = new Set();
let criticalBridgePromise = null;
let afterPaintBridgePromise = null;

async function installBridge(spec, reason) {
  if (loadedBridgeIds.has(spec.id)) return { id: spec.id, skipped: true };
  const module = await import(spec.specifier);
  const installer = module?.[spec.install];
  if (typeof installer !== 'function') throw new Error(`RVM bridge ${spec.id} missing installer ${spec.install}`);
  const api = spec.withViewerClass ? installer(RvmViewer3D) : installer();
  loadedBridgeIds.add(spec.id);
  return { id: spec.id, reason, api: Boolean(api), version: VERSION };
}

async function installBridgeList(specs, reason) {
  const results = await Promise.allSettled(specs.map((spec) => installBridge(spec, reason)));
  const failures = results
    .map((result, index) => ({ result, spec: specs[index] }))
    .filter(({ result }) => result.status === 'rejected');
  for (const { result, spec } of failures) reportRvmBridgeFailure(result.reason, { action: 'bridge-install', bridge: spec.id, reason });
  return { results, failures };
}

export function installRvmCriticalViewerBridges(reason = 'rvm-renderer-critical') {
  if (!criticalBridgePromise) criticalBridgePromise = installBridgeList(CRITICAL_BRIDGES, reason);
  return criticalBridgePromise;
}

function scheduleAfterPaintBridges(reason = 'after-rvm-tab-render') {
  if (afterPaintBridgePromise) return afterPaintBridgePromise;
  afterPaintBridgePromise = new Promise((resolve) => {
    afterFirstPaint(() => resolve(installBridgeList(AFTER_PAINT_BRIDGES, reason)));
  });
  return afterPaintBridgePromise;
}

function reportRvmBridgeFailure(error, context = {}) {
  if (typeof globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__ === 'function') {
    globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__(error, context);
    return;
  }
  console.warn('[RVM renderer] bridge installation failed', context, error);
}

function afterFirstPaint(fn) {
  const run = () => {
    if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(fn, { timeout: 1400 });
    else setTimeout(fn, 0);
  };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
  else setTimeout(run, 0);
}

export { RvmViewer3D };
export async function renderViewer3DRvm(root, options = {}) {
  await installRvmCriticalViewerBridges();
  const { mountViewer3DRvmTab } = await import('./viewer3d-rvm-tab.js?v=20260624-rvm-perf-button-contract-1');
  const destroy = mountViewer3DRvmTab(root, options);
  scheduleAfterPaintBridges();
  return destroy;
}
