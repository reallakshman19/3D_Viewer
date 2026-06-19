import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260619-inputxml-support-graphics-1';

function findViewerFromSupportRoot() {
  return window.__rvmInputXmlSupportGraphicsViewer || null;
}

function optionsFromUi() {
  const root = document.querySelector('[data-rvm-viewer]');
  const scale = Number(root?.querySelector?.('#rvm-support-scale')?.value);
  const labelsVisible = root?.querySelector?.('#rvm-support-labels')?.getAttribute?.('aria-pressed') === 'true';
  return {
    scaleMultiplier: Number.isFinite(scale) ? scale : 1,
    labelsVisible,
  };
}

function refresh() {
  const viewer = findViewerFromSupportRoot();
  if (!viewer) return;
  setTimeout(() => applyInputXmlSupportGraphicsOverlay(viewer, optionsFromUi()), 0);
}

document.addEventListener('input', (event) => {
  if (event.target?.id === 'rvm-support-scale') refresh();
}, true);

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#rvm-support-labels')) refresh();
}, true);
