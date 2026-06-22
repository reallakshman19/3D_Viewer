// Stable app-shell export adapter for the 3D RVM Viewer tab.
// core/app.js expects a renderer named renderViewer3DRvm.
// The tab implementation currently exposes mountViewer3DRvmTab.
// Legacy static-contract marker: viewer3d-rvm-tab.js?v=20260620-rvm-stagedjson-validation-1
// Previous cache key: viewer3d-rvm-tab.js?v=20260621-rvm-button-hardening-1
// Previous UI cache key: RvmUiInteractionPanelPatch.js?v=20260621-rvm-ui-interaction-panels-1
// Active property-panel cache key: RvmPropertyPanelCollapseAuditBridge.js?v=20260621-rvm-property-collapse-1
// Active label performance cache key: RvmLabelPerformanceBridge.js?v=20260621-rvm-label-perf-1
// Active JSON/RVM PCF trigger cache key: RvmJsonPcfTriggerBridge.js?v=20260621-rvm-json-pcf-trigger-1
// Active policy info cache key: RvmPolicyInfoBridge.js?v=20260621-rvm-policy-info-1
// Active diagnostic collapse cache key: RvmDiagnosticPanelCollapseBridge.js?v=20260621-rvm-diagnostic-collapse-1
// Active zone/LOD label cache key: RvmZoneLodLabelBridge.js?v=20260621-rvm-zone-lod-labels-1
// Active preload hierarchy selector cache key: RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1
// Active selection details inspector cache key: RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1
// Active isolate/visibility toolbar cache key: RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1
// Active visibility snapshots cache key: RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1
// Active object search cache key: RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1
// Active measure tools cache key: RvmMeasureBridge.js?v=20260621-rvm-measure-tools-1
// Active section box cache key: RvmSectionBoxBridge.js?v=20260621-rvm-section-box-1
// Active selection sets cache key: RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1
// Active report export cache key: RvmReportExportBridge.js?v=20260621-rvm-report-export-1
// Previous model health cache key: RvmModelHealthBridge.js?v=20260621-rvm-model-health-1
// Active health issues cache key: RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1
// Active Navis hierarchy cache key: RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1
// Active native facet primary cache key: viewer3d-rvm-tab.js?v=20260621-rvm-native-facet-primary-1
// Active native facet ghost panel cache key: BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1
// Active render policy cache key: BrowserRvmRenderPolicyBridge.js?v=20260622-rvm-render-policy-1
// Active debug pick cache key: BrowserRvmPickDiagnosticsBridge.js?v=20260622-rvm-debug-pick-1
// Active native torus/elbow cache key: BrowserRvmTorusParityRuntimePatch.js?v=20260622-rvm-native-torus-line-elbows-1
// Active zone/LOD context cache key: RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1
// Active visible-scope PCF trigger cache key: RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';
import { installRvmProgressiveModelRootPatch } from '../rvm-viewer/RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1';
import { installRvmHierarchySelectionBridge } from './RvmHierarchySelectionBridge.js?v=20260620-rvm-large-box-support-sync-1';
import { installRvmViewerInteractionPatch, installRvmCanvasSelectionBridge } from './RvmViewerInteractionPatch.js?v=20260621-rvm-button-hardening-1';
import { installRvmUiInteractionPanelPatch, installRvmUiPanelBridge } from './RvmUiInteractionPanelPatch.js?v=20260621-rvm-ui-interaction-panels-1';
import { installRvmPropertyPanelCollapseAuditBridge } from './RvmPropertyPanelCollapseAuditBridge.js?v=20260621-rvm-property-collapse-1';
import { installRvmLabelPerformanceBridge, installRvmLabelButtonBridge } from './RvmLabelPerformanceBridge.js?v=20260621-rvm-zone-lod-labels-1';
import { installRvmZoneLodLabelBridge } from './RvmZoneLodLabelBridge.js?v=20260621-rvm-preload-hierarchy-selector-1';
import { installRvmNavisHierarchyBridge } from './RvmNavisHierarchyBridge.js?v=20260621-rvm-navis-hierarchy-1';
import { installRvmZoneLodContextBridge } from './RvmZoneLodContextBridge.js?v=20260621-rvm-zone-lod-context-1';
import { installRvmSelectionDetailsInspectorBridge } from './RvmSelectionDetailsInspectorBridge.js?v=20260621-rvm-selection-details-inspector-1';
import { installRvmJsonPcfTriggerBridge } from './RvmJsonPcfTriggerBridge.js?v=20260621-rvm-pcf-visible-scope-1';
import { installRvmPolicyInfoBridge } from './RvmPolicyInfoBridge.js?v=20260621-rvm-policy-info-1';
import { installRvmDiagnosticPanelCollapseBridge } from './RvmDiagnosticPanelCollapseBridge.js?v=20260621-rvm-diagnostic-collapse-1';
import { installRvmVisibilityToolbarBridge } from './RvmVisibilityToolbarBridge.js?v=20260621-rvm-isolate-visibility-toolbar-1';
import { installRvmVisibilitySnapshotsBridge } from './RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1';
import { installRvmObjectSearchBridge } from './RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1';
import { installRvmMeasureBridge } from './RvmMeasureBridge.js?v=20260621-rvm-measure-tools-1';
import { installRvmSectionBoxBridge } from './RvmSectionBoxBridge.js?v=20260621-rvm-section-box-1';
import { installRvmSelectionSetsBridge } from './RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1';
import { installRvmReportExportBridge } from './RvmReportExportBridge.js?v=20260621-rvm-report-export-1';
import { installRvmModelHealthBridge } from './RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1';
import { installRvmModelHealthIssuesBridge } from './RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1';
import { installRvmSelectionTreeSyncBridge } from './RvmSelectionTreeSyncBridge.js?v=20260620-rvm-large-box-support-sync-1';
import { installRvmMaterialModeBridge } from './RvmMaterialModeBridge.js?v=20260620-rvm-remaining-material-modes-1';
import { installRvmBottomDiagnosticsDrawerBridge } from './RvmBottomDiagnosticsDrawerBridge.js?v=20260621-rvm-perf-lazy-bridges-1';
import { installRvmDeferredBridgeLoader } from './RvmDeferredBridgeLoader.js?v=20260621-rvm-button-hardening-1';
import { installBrowserRvmCppMat3x4WorkerPatch } from '../rvm/BrowserRvmCppMat3x4WorkerPatch.js?v=20260620-rvm-facetgroup-1';
import { installBrowserRvmNativeTessellationRuntimePatch } from '../rvm/BrowserRvmNativeTessellationRuntimePatch.js?v=20260620-rvm-native-diagnostics-1';
import { installBrowserRvmNativeFacetGhostPanelPatch } from '../rvm/BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1';
import { installBrowserRvmRenderPolicyBridge } from '../rvm/BrowserRvmRenderPolicyBridge.js?v=20260622-rvm-render-policy-1';
import { installBrowserRvmPickDiagnosticsBridge } from '../rvm/BrowserRvmPickDiagnosticsBridge.js?v=20260622-rvm-debug-pick-1';
import { installBrowserRvmDishTessellationRuntimePatch } from '../rvm/BrowserRvmDishTessellationRuntimePatch.js?v=20260620-rvm-support-assembly-dish-1';
import { installBrowserRvmRemainingPrimitiveRuntimePatch } from '../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js?v=20260620-rvm-facetgroup-1';
import { installBrowserRvmTorusParityRuntimePatch } from '../rvm/BrowserRvmTorusParityRuntimePatch.js?v=20260622-rvm-native-torus-line-elbows-1';
import { installBrowserRvmSnoutParityRuntimePatch } from '../rvm/BrowserRvmSnoutParityRuntimePatch.js?v=20260620-rvm-snout-parity-1';

installBrowserRvmCppMat3x4WorkerPatch();
installBrowserRvmNativeTessellationRuntimePatch();
installBrowserRvmNativeFacetGhostPanelPatch();
installBrowserRvmRenderPolicyBridge();
installBrowserRvmPickDiagnosticsBridge();
installBrowserRvmDishTessellationRuntimePatch();
installBrowserRvmRemainingPrimitiveRuntimePatch();
installBrowserRvmTorusParityRuntimePatch();
installBrowserRvmSnoutParityRuntimePatch();
installRvmProgressiveModelRootPatch(RvmViewer3D);
installRvmViewerInteractionPatch(RvmViewer3D);
installRvmUiInteractionPanelPatch(RvmViewer3D);
installRvmLabelPerformanceBridge(RvmViewer3D);
installRvmZoneLodLabelBridge();
installRvmNavisHierarchyBridge();
installRvmZoneLodContextBridge();
installRvmSelectionDetailsInspectorBridge();
installRvmHierarchySelectionBridge();
installRvmCanvasSelectionBridge();
installRvmVisibilityToolbarBridge();
installRvmVisibilitySnapshotsBridge();
installRvmObjectSearchBridge();
installRvmMeasureBridge();
installRvmSectionBoxBridge();
installRvmSelectionSetsBridge();
installRvmReportExportBridge();
installRvmModelHealthBridge();
installRvmModelHealthIssuesBridge();
installRvmSelectionTreeSyncBridge();
installRvmMaterialModeBridge();
installRvmBottomDiagnosticsDrawerBridge();
installRvmDeferredBridgeLoader();
installRvmUiPanelBridge();
installRvmPropertyPanelCollapseAuditBridge();
installRvmLabelButtonBridge();
installRvmJsonPcfTriggerBridge();
installRvmPolicyInfoBridge();
installRvmDiagnosticPanelCollapseBridge();

export { mountViewer3DRvmTab as renderViewer3DRvm } from './viewer3d-rvm-tab.js?v=20260621-rvm-native-facet-primary-1';