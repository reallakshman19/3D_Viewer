// Stable app-shell export adapter for the 3D RVM Viewer tab.
// core/app.js expects a renderer named renderViewer3DRvm.
// The tab implementation currently exposes mountViewer3DRvmTab.
// Legacy static-contract marker: viewer3d-rvm-tab.js?v=20260620-rvm-stagedjson-validation-1
// Active cache key: viewer3d-rvm-tab.js?v=20260621-rvm-button-hardening-1
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';
import { installRvmProgressiveModelRootPatch } from '../rvm-viewer/RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1';
import { installRvmHierarchySelectionBridge } from './RvmHierarchySelectionBridge.js?v=20260620-rvm-large-box-support-sync-1';
import { installRvmViewerInteractionPatch, installRvmCanvasSelectionBridge } from './RvmViewerInteractionPatch.js?v=20260621-rvm-button-hardening-1';
import { installRvmVisibilityToolbarBridge } from './RvmVisibilityToolbarBridge.js?v=20260621-rvm-perf-lazy-bridges-1';
import { installRvmSelectionTreeSyncBridge } from './RvmSelectionTreeSyncBridge.js?v=20260620-rvm-large-box-support-sync-1';
import { installRvmMaterialModeBridge } from './RvmMaterialModeBridge.js?v=20260620-rvm-remaining-material-modes-1';
import { installRvmBottomDiagnosticsDrawerBridge } from './RvmBottomDiagnosticsDrawerBridge.js?v=20260621-rvm-perf-lazy-bridges-1';
import { installRvmDeferredBridgeLoader } from './RvmDeferredBridgeLoader.js?v=20260621-rvm-button-hardening-1';
import { installBrowserRvmCppMat3x4WorkerPatch } from '../rvm/BrowserRvmCppMat3x4WorkerPatch.js?v=20260620-rvm-facetgroup-1';
import { installBrowserRvmNativeTessellationRuntimePatch } from '../rvm/BrowserRvmNativeTessellationRuntimePatch.js?v=20260620-rvm-native-diagnostics-1';
import { installBrowserRvmDishTessellationRuntimePatch } from '../rvm/BrowserRvmDishTessellationRuntimePatch.js?v=20260620-rvm-support-assembly-dish-1';
import { installBrowserRvmRemainingPrimitiveRuntimePatch } from '../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js?v=20260620-rvm-facetgroup-1';
import { installBrowserRvmTorusParityRuntimePatch } from '../rvm/BrowserRvmTorusParityRuntimePatch.js?v=20260620-rvm-torus-parity-1';
import { installBrowserRvmSnoutParityRuntimePatch } from '../rvm/BrowserRvmSnoutParityRuntimePatch.js?v=20260620-rvm-snout-parity-1';

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
installRvmMaterialModeBridge();
installRvmBottomDiagnosticsDrawerBridge();
installRvmDeferredBridgeLoader();

export { mountViewer3DRvmTab as renderViewer3DRvm } from './viewer3d-rvm-tab.js?v=20260621-rvm-button-hardening-1';
