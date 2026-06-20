// Stable app-shell export adapter for the 3D RVM Viewer tab.
// core/app.js expects a renderer named renderViewer3DRvm.
// The tab implementation currently exposes mountViewer3DRvmTab.
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260620-rvm-direct-tab-1';
import { installRvmProgressiveModelRootPatch } from '../rvm-viewer/RvmProgressiveModelRootPatch.js?v=20260620-rvm-rhbg-fitguard-1';

installRvmProgressiveModelRootPatch(RvmViewer3D);

export { mountViewer3DRvmTab as renderViewer3DRvm } from './viewer3d-rvm-tab.js?v=20260620-rvm-scale-safe-1';
