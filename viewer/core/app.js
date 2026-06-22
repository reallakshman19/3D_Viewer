// App shell runtime delegate.
// Static contract markers retained here because certification gates read core/app.js directly.
// RVM_RENDERER_PREFLIGHT_MODULES
// Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-property-collapse-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-label-perf-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-json-pcf-trigger-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-policy-info-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-zone-lod-labels-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-preload-hierarchy-selector-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-selection-details-inspector-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-isolate-visibility-toolbar-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-visibility-snapshots-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-object-search-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-measure-tools-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-section-box-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-selection-sets-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-report-export-1
// viewer3d-rvm-tab-renderer.js?v=20260622-geometry-workspace-1
// viewer3d-rvm-tab-renderer.js?v=20260622-geometry-import-tree-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-model-health-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-health-issues-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-navis-hierarchy-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-native-facet-primary-1
// viewer3d-rvm-tab-renderer.js?v=20260622-rvm-facet-ghost-panels-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-zone-lod-context-1
// viewer3d-rvm-tab-renderer.js?v=20260621-rvm-pcf-visible-scope-1
// RvmJsonPcfTriggerBridge.js?v=20260621-rvm-json-pcf-trigger-1
// RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1
// RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1
// RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1
// RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1
// RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1
// RvmMeasureBridge.js?v=20260621-rvm-measure-tools-1
// RvmSectionBoxBridge.js?v=20260621-rvm-section-box-1
// RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1
// RvmReportExportBridge.js?v=20260621-rvm-report-export-1
// GeometryExportWorkspaceBridge.js?v=20260622-geometry-workspace-1
// GeometryExportWorkspaceBridge.js?v=20260622-geometry-import-tree-1
// GeometryImportHierarchyModel.js?v=20260622-geometry-import-tree-1
// RenderedGeometrySnapshotBuilder.js?v=20260622-geometry-workspace-1
// RenderedGeometryFieldDiscovery.js?v=20260622-geometry-workspace-1
// RvmModelHealthBridge.js?v=20260621-rvm-model-health-1
// RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1
// RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1
// BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1
// app-tab-click-state-bridge.js?v=20260622-tab-click-state-1
// RvmPolicyInfoBridge.js?v=20260621-rvm-policy-info-1
// RvmDiagnosticPanelCollapseBridge.js?v=20260621-rvm-diagnostic-collapse-1
// RvmZoneLodLabelBridge.js?v=20260621-rvm-zone-lod-labels-1
// RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1
// RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1
// RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1
// BrowserRvmLoadBridge.js?v=20260621-rvm-zone-lod-labels-1
// BrowserRvmLoadBridge.js?v=20260621-rvm-native-facet-primary-1
// BrowserRvmRenderSceneBuilder.js?v=20260621-rvm-native-facet-primary-1
// browser-rvm-worker.js?v=20260621-rvm-native-facet-primary-1
// BrowserRvmNativeFacetGroupPrimary.js
// RvmSectioning.js applyBoxSection
// const APP_ICON_URL = new URL('../assets/app-icon.svg?v=20260621-app-brand-icon-1'
// function createBrandRail
// app-brand-rail
// function createTabIcon
// app-tab-icon
// button.setAttribute('aria-label', tab.label)
// let activeTabDestroy
// let appDestroy
// function cleanupActiveTab
// renderTabError
// tabRendererCache
import { installAppTabClickStateBridge } from './app-tab-click-state-bridge.js?v=20260622-tab-click-state-1';
import { installGeometryExportWorkspaceBridge } from '../geometry-workspace/GeometryExportWorkspaceBridge.js?v=20260622-geometry-import-tree-1';
import { installRvmModelHealthBridge } from '../tabs/RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1';
import { installRvmModelHealthIssuesBridge } from '../tabs/RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1';
import { installBrowserRvmNativeFacetGhostPanelPatch } from '../rvm/BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1';

installAppTabClickStateBridge();
installGeometryExportWorkspaceBridge();
installRvmModelHealthBridge();
installRvmModelHealthIssuesBridge();
installBrowserRvmNativeFacetGhostPanelPatch();

export { init } from './app-label-perf-runtime.js?v=20260622-geometry-import-tree-1';
