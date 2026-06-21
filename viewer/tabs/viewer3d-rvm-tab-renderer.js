// Stable app-shell export adapter for the 3D RVM Viewer tab.
// core/app.js expects a renderer named renderViewer3DRvm.
// The tab implementation currently exposes mountViewer3DRvmTab.
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';
import { installRvmProgressiveModelRootPatch } from '../rvm-viewer/RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1';
import { installRvmHierarchySelectionBridge } from './RvmHierarchySelectionBridge.js?v=20260620-rvm-large-box-support-sync-1';
import { installRvmViewerInteractionPatch, installRvmCanvasSelectionBridge } from './RvmViewerInteractionPatch.js?v=20260620-rvm-esc-hide-selection-1';
import { installRvmVisibilityToolbarBridge } from './RvmVisibilityToolbarBridge.js?v=20260620-rvm-esc-hide-selection-1';
import { installRvmSelectionTreeSyncBridge } from './RvmSelectionTreeSyncBridge.js?v=20260620-rvm-large-box-support-sync-1';
import { installRvmSupportSummaryBridge } from './RvmSupportSummaryBridge.js?v=20260620-rvm-support-symbol-mode-1';
import { installRvmSupportAssemblyBridge } from './RvmSupportAssemblyBridge.js?v=20260620-rvm-support-assembly-dish-1';
import { installRvmIntelligentSupportEngineBridge } from './RvmIntelligentSupportEngineBridge.js?v=20260620-rvm-intelligent-support-engine-1';
import { installRvmSupportGeometryBridge } from './RvmSupportGeometryBridge.js?v=20260620-rvm-support-geometry-v1';
import { installRvmSupportAttMappingBridge } from './RvmSupportAttMappingBridge.js?v=20260620-rvm-support-att-mapping-1';
import { installRvmMaterialModeBridge } from './RvmMaterialModeBridge.js?v=20260620-rvm-remaining-material-modes-1';
import { installRvmPrimitiveFallbackBridge } from './RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1';
import { installRvmNativeSceneGlbExportBridge } from './RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-native-scene-glb-export-1';
import { installRvmGlbExportValidationBridge } from './RvmGlbExportValidationBridge.js?v=20260620-rvm-glb-export-validation-1';
import { installRvmGlbRoundTripValidationBridge } from './RvmGlbRoundTripValidationBridge.js?v=20260620-rvm-glb-roundtrip-validation-1';
import { installRvmGlbSelectionParityBridge } from './RvmGlbSelectionParityBridge.js?v=20260620-rvm-glb-selection-details-parity-1';
import { installRvmGlbAcceptancePackBridge } from './RvmGlbAcceptancePackBridge.js?v=20260620-rvm-glb-acceptance-pack-1';
import { installBrowserRvmCppMat3x4WorkerPatch } from '../rvm/BrowserRvmCppMat3x4WorkerPatch.js?v=20260620-rvm-facetgroup-1';
import { installBrowserRvmNativeTessellationRuntimePatch } from '../rvm/BrowserRvmNativeTessellationRuntimePatch.js?v=20260620-rvm-native-diagnostics-1';
import { installBrowserRvmDishTessellationRuntimePatch } from '../rvm/BrowserRvmDishTessellationRuntimePatch.js?v=20260620-rvm-support-assembly-dish-1';
import { installBrowserRvmRemainingPrimitiveRuntimePatch } from '../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js?v=20260620-rvm-facetgroup-1';
import { installBrowserRvmTorusParityRuntimePatch } from '../rvm/BrowserRvmTorusParityRuntimePatch.js?v=20260620-rvm-torus-parity-1';
import { installBrowserRvmSnoutParityRuntimePatch } from '../rvm/BrowserRvmSnoutParityRuntimePatch.js?v=20260620-rvm-snout-parity-1';
import { installRvmNativeTessellationDiagnosticsBridge } from './RvmNativeTessellationDiagnosticsBridge.js?v=20260620-rvm-native-diagnostics-1';

installBrowserRvmCppMat3x4WorkerPatch();
installBrowserRvmNativeTessellationRuntimePatch();
installBrowserRvmDishTessellationRuntimePatch();
installBrowserRvmRemainingPrimitiveRuntimePatch();
installBrowserRvmTorusParityRuntimePatch();
installBrowserRvmSnoutParityRuntimePatch();
installRvmProgressiveModelRootPatch(RvmViewer3D);
installRvmViewerInteractionPatch(RvmViewer3D);
installRvmHierarchySelectionBridge();
installRvmCanvasSelectionBridge();
installRvmVisibilityToolbarBridge();
installRvmSelectionTreeSyncBridge();
installRvmSupportSummaryBridge();
installRvmSupportAssemblyBridge();
installRvmIntelligentSupportEngineBridge();
installRvmSupportGeometryBridge();
installRvmSupportAttMappingBridge();
installRvmMaterialModeBridge();
installRvmPrimitiveFallbackBridge();
installRvmNativeSceneGlbExportBridge();
installRvmGlbExportValidationBridge();
installRvmGlbRoundTripValidationBridge();
installRvmGlbSelectionParityBridge();
installRvmGlbAcceptancePackBridge();
installRvmNativeTessellationDiagnosticsBridge();

export { mountViewer3DRvmTab as renderViewer3DRvm } from './viewer3d-rvm-tab.js?v=20260620-rvm-glb-acceptance-pack-1';
