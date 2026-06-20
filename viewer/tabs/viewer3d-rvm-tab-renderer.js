// Stable app-shell export adapter for the 3D RVM Viewer tab.
// core/app.js expects a renderer named renderViewer3DRvm.
// The tab implementation currently exposes mountViewer3DRvmTab.
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';
import { installRvmProgressiveModelRootPatch } from '../rvm-viewer/RvmProgressiveModelRootPatchV5.js?v=20260620-rvm-tree-select-nohide-1';
import { installRvmHierarchySelectionBridge } from './RvmHierarchySelectionBridge.js?v=20260620-rvm-tree-select-nohide-1';
import { installRvmViewerInteractionPatch, installRvmCanvasSelectionBridge } from './RvmViewerInteractionPatch.js?v=20260620-rvm-toolbar-selection-1';

installRvmProgressiveModelRootPatch(RvmViewer3D);
installRvmViewerInteractionPatch(RvmViewer3D);
installRvmHierarchySelectionBridge();
installRvmCanvasSelectionBridge();

export { mountViewer3DRvmTab as renderViewer3DRvm } from './viewer3d-rvm-tab.js?v=20260620-rvm-toolbar-selection-1';
