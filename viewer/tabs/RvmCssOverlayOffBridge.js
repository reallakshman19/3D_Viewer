const VERSION = '20260622-rvm-css-overlays-off-1';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-css-overlays-off-v1');
const STYLE_ID = 'rvm-css-overlays-off-style';
const API_KEY = '__PCF_GLB_RVM_CSS_OVERLAY_OFF__';

const LABEL_SELECTORS = [
  '.rvm-support-symbol-label',
  '.rvm-tag-label',
  '[data-rvm-css2d-label]',
  '[data-rvm-overlay-label]',
].join(',');

const OVERLAY_SELECTORS = [
  '.rvm-zone-density-overlay',
  '.rvm-bottom-diagnostics-drawer',
  '[data-rvm-bottom-diagnostics-drawer]',
].join(',');

export function installRvmCssOverlayOffBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  injectStyles();
  const state = { version: VERSION, runs: 0, hiddenLabels: 0, hiddenOverlays: 0 };
  globalThis[INSTALL_FLAG] = state;
  globalThis[API_KEY] = {
    version: VERSION,
    state,
    off: () => suppressCssOverlays(state),
    hide: () => suppressCssOverlays(state),
    labelsOff: () => hideCss2dLabels(state),
    diagnosticsOff: () => hideDiagnosticOverlays(state),
  };

  const run = () => suppressCssOverlays(state);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  for (const delay of [0, 80, 250, 750, 1500, 3500]) setTimeout(run, delay);
  try { globalThis.addEventListener?.('rvm-model-loaded', () => forDelays(run, [0, 80, 250, 750, 1500])); } catch (_) {}

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => schedule(run));
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    state.observer = observer;
  }

  return state;
}

let scheduled = false;
function schedule(fn) {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    fn();
  }, 80);
}

function forDelays(fn, delays) {
  for (const delay of delays) setTimeout(fn, delay);
}

function suppressCssOverlays(state) {
  if (state) state.runs += 1;
  const hiddenLabels = hideCss2dLabels(state);
  const hiddenOverlays = hideDiagnosticOverlays(state);
  return { hiddenLabels, hiddenOverlays };
}

function hideCss2dLabels(state) {
  let hidden = 0;
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const labelRoot = viewer?.labelRenderer?.domElement;
  if (labelRoot?.style) {
    labelRoot.style.display = 'none';
    labelRoot.style.pointerEvents = 'none';
    labelRoot.dataset.rvmCssOverlaySuppressed = VERSION;
    hidden += 1;
  }

  try {
    viewer?.scene?.traverse?.((obj) => {
      if (!obj?.element) return;
      obj.visible = false;
      obj.element.style.display = 'none';
      obj.element.style.pointerEvents = 'none';
      obj.element.dataset.rvmCssOverlaySuppressed = VERSION;
      hidden += 1;
    });
  } catch (_) {}

  document.querySelectorAll?.(LABEL_SELECTORS)?.forEach((el) => {
    if (!el?.style) return;
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
    el.dataset.rvmCssOverlaySuppressed = VERSION;
    hidden += 1;
  });

  if (viewer) {
    viewer.__rvmLabelLayerVisible = false;
    try { viewer.setSupportSymbolLabelsVisible?.(false); } catch (_) {}
  }
  const labelsButton = document.querySelector('#rvm-support-labels');
  if (labelsButton) {
    labelsButton.setAttribute('aria-pressed', 'false');
    labelsButton.textContent = 'Labels Off';
    labelsButton.classList?.remove?.('is-active');
  }

  if (state) state.hiddenLabels = hidden;
  return hidden;
}

function hideDiagnosticOverlays(state) {
  let hidden = 0;
  try { localStorage.setItem('rvm_bottom_diagnostics_drawer_collapsed', 'true'); } catch (_) {}
  try { globalThis.__PCF_GLB_RVM_BOTTOM_DIAGNOSTICS_DRAWER__?.close?.(); } catch (_) {}

  document.querySelectorAll?.(OVERLAY_SELECTORS)?.forEach((el) => {
    if (!el?.style) return;
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
    el.dataset.rvmCssOverlaySuppressed = VERSION;
    hidden += 1;
  });

  if (state) state.hiddenOverlays = hidden;
  return hidden;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rvm-support-symbol-label,
    .rvm-tag-label,
    [data-rvm-css2d-label],
    [data-rvm-overlay-label],
    [data-rvm-css-overlay-suppressed],
    .rvm-zone-density-overlay,
    .rvm-bottom-diagnostics-drawer,
    [data-rvm-bottom-diagnostics-drawer]{display:none!important;pointer-events:none!important;}
  `;
  document.head.appendChild(style);
}
