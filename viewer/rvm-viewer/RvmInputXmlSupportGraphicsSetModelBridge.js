import { RvmViewer3D } from './RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260619-inputxml-support-graphics-1';

if (!RvmViewer3D.prototype.__inputXmlSupportGraphicsSetModelBridge) {
  const setModelOriginal = RvmViewer3D.prototype.setModel;
  RvmViewer3D.prototype.setModel = function setModelWithInputXmlSupportGraphics(...args) {
    const result = setModelOriginal.apply(this, args);
    setTimeout(() => {
      const root = document.querySelector('[data-rvm-viewer]');
      const scale = Number(root?.querySelector?.('#rvm-support-scale')?.value);
      const labelsVisible = root?.querySelector?.('#rvm-support-labels')?.getAttribute?.('aria-pressed') === 'true';
      applyInputXmlSupportGraphicsOverlay(this, {
        scaleMultiplier: Number.isFinite(scale) ? scale : 1,
        labelsVisible,
      });
    }, 0);
    return result;
  };
  RvmViewer3D.prototype.__inputXmlSupportGraphicsSetModelBridge = true;
}
