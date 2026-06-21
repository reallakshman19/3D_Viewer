const BRIDGE_VERSION = '20260621-rvm-perf-lazy-bridges-1';

export function installRvmVisibilityToolbarBridge() {
  injectStyles();
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root) {
      injectToolbar(root, viewer);
      forceSelectUi(root);
    }
    if ((!root || !viewer) && attempts < 160) setTimeout(attach, 350);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function injectToolbar(root, viewer) {
  const ribbon = root?.querySelector?.('.geo-top-ribbon');
  if (!ribbon || ribbon.dataset.rvmVisibilityToolbar === BRIDGE_VERSION) return;
  ribbon.dataset.rvmVisibilityToolbar = BRIDGE_VERSION;
  const section = document.createElement('div');
  section.className = 'rvm-ribbon-section rvm-tool-group rvm-visibility-tool-group';
  section.setAttribute('aria-label', 'Display tools');
  section.innerHTML = `
    <span class="rvm-ribbon-label">Display</span>
    <div class="rvm-ribbon-button-row">
      <button class="rvm-tool-btn" data-action="VIEW_HIDE_SELECTION" type="button" title="Hide selected geometry" aria-label="Hide selected geometry"><span aria-hidden="true">◌</span><span>Hide</span></button>
      <button class="rvm-tool-btn" data-action="VIEW_SHOW_HIDDEN" type="button" title="Show hidden geometry" aria-label="Show hidden geometry"><span aria-hidden="true">◎</span><span>Show</span></button>
      <button class="rvm-tool-btn" data-action="VIEW_CLEAR_SELECTION" type="button" title="Clear selected geometry" aria-label="Clear selected geometry"><span aria-hidden="true">×</span><span>Clear</span></button>
      <button class="rvm-tool-btn" data-action="NAV_SELECT" data-rvm-force-select="true" type="button" title="Select mode / Esc" aria-label="Select mode"><span aria-hidden="true">⌖</span><span>Select</span></button>
    </div>`;
  const search = ribbon.querySelector('.rvm-ribbon-search');
  ribbon.insertBefore(section, search || null);
  section.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const liveViewer = globalThis.__3D_RVM_VIEWER__ || viewer;
    const api = globalThis.__PCF_GLB_RVM_INTERACTION__;
    event.preventDefault();
    event.stopPropagation();
    if (action === 'VIEW_HIDE_SELECTION') {
      if (!api?.hideSelection?.()) liveViewer?.dispatchAction?.(action);
      return;
    }
    if (action === 'VIEW_SHOW_HIDDEN') {
      if (!api?.showHidden?.()) liveViewer?.dispatchAction?.(action);
      return;
    }
    if (action === 'VIEW_CLEAR_SELECTION') {
      if (!api?.clearSelection?.()) liveViewer?.clearSelection?.();
      forceSelectUi(root);
      return;
    }
    if (action === 'NAV_SELECT') {
      if (!api?.setMode?.('select')) liveViewer?.dispatchAction?.(action);
      forceSelectUi(root);
    }
  }, true);
}

function forceSelectUi(root) {
  if (!root) return;
  root.querySelectorAll('[data-action]').forEach((button) => button.classList.toggle('is-active', button.dataset.action === 'NAV_SELECT'));
  const chip = root.querySelector('#rvm-mode-chip');
  if (chip) chip.textContent = 'Select';
}

function injectStyles() {
  if (document.getElementById('rvm-visibility-toolbar-bridge-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-visibility-toolbar-bridge-style';
  style.textContent = `
    .rvm-visibility-tool-group .rvm-tool-btn span:last-child { font-size: 11px; }
    .rvm-tool-btn[data-action="VIEW_HIDE_SELECTION"] span:first-child { color: #fca5a5; }
    .rvm-tool-btn[data-action="VIEW_SHOW_HIDDEN"] span:first-child { color: #86efac; }
    .rvm-tool-btn[data-action="VIEW_CLEAR_SELECTION"] span:first-child { color: #fcd34d; }
  `;
  document.head.appendChild(style);
}
