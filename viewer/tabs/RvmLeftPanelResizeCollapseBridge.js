const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-left-panel-resize-collapse-v1');
const STYLE_ID = 'rvm-left-panel-resize-collapse-style';
const VERSION = '20260622-rvm-left-panel-resize-collapse-1';

const PANEL_SELECTORS = [
  '[data-rvm-support-att-panel]',
  '[data-rvm-support-engine-panel]',
];

export function installRvmLeftPanelResizeCollapseBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  injectStyles();
  const state = { version: VERSION, runs: 0, scan };
  globalThis[INSTALL_FLAG] = state;
  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.observer = observer;
  return state;
}

function scan() {
  const root = document.querySelector('[data-rvm-viewer]');
  const left = root?.querySelector?.('.rvm-left-panel');
  if (!root || !left) return;
  left.dataset.rvmLeftPanelResizable = 'true';
  const tree = left.querySelector('#rvm-tree');
  if (tree) tree.dataset.rvmResizablePanel = 'hierarchy';
  movePanelsToLeft(root, left);
  for (const selector of PANEL_SELECTORS) {
    root.querySelectorAll(selector).forEach((panel) => enhancePanel(panel));
  }
}

function movePanelsToLeft(root, left) {
  for (const selector of PANEL_SELECTORS) {
    const panel = root.querySelector(selector);
    if (panel && panel.parentElement !== left) left.appendChild(panel);
  }
}

function enhancePanel(panel) {
  if (!panel || panel.dataset.rvmResizeCollapseEnhanced === VERSION) return;
  panel.dataset.rvmResizeCollapseEnhanced = VERSION;
  panel.classList.add('rvm-left-collapsible-panel');
  const title = panel.querySelector('h3') || firstHeading(panel);
  if (!title) return;
  title.classList.add('rvm-left-collapsible-title');
  if (!title.querySelector('[data-rvm-left-panel-collapse]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rvm-left-panel-collapse-btn';
    button.dataset.rvmLeftPanelCollapse = 'true';
    button.setAttribute('aria-label', `Toggle ${title.textContent || 'panel'}`);
    button.textContent = '▸';
    title.insertBefore(button, title.firstChild);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(panel, panel.dataset.rvmCollapsed !== 'true');
    });
  }
  setCollapsed(panel, true);
}

function firstHeading(panel) {
  for (const child of [...panel.children]) {
    if (/^H[1-6]$/i.test(child.tagName)) return child;
  }
  return null;
}

function setCollapsed(panel, collapsed) {
  panel.dataset.rvmCollapsed = collapsed ? 'true' : 'false';
  panel.classList.toggle('is-collapsed', collapsed);
  const btn = panel.querySelector('[data-rvm-left-panel-collapse]');
  if (btn) btn.textContent = collapsed ? '▸' : '▾';
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rvm-left-panel[data-rvm-left-panel-resizable="true"]{overflow:auto;gap:6px;padding-bottom:8px;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree[data-rvm-resizable-panel="hierarchy"]{flex:0 0 auto;min-height:120px;height:clamp(150px,34vh,420px);max-height:70vh;resize:vertical;overflow:auto;border-bottom:1px solid rgba(126,190,255,.22);}
    .rvm-left-collapsible-panel{flex:0 0 auto;min-height:34px;max-height:60vh;resize:vertical;overflow:auto;margin:6px 6px 0;border:1px solid rgba(96,165,250,.28);border-radius:10px;background:rgba(15,23,42,.70);}
    .rvm-left-collapsible-panel.is-collapsed{height:auto!important;min-height:32px;max-height:36px;resize:none;overflow:hidden;}
    .rvm-left-collapsible-panel.is-collapsed > :not(.rvm-left-collapsible-title):not(h3){display:none!important;}
    .rvm-left-collapsible-title{display:flex!important;align-items:center;gap:6px;margin:0!important;padding:8px 9px!important;cursor:default;}
    .rvm-left-panel-collapse-btn{width:20px;height:20px;display:inline-grid;place-items:center;border:1px solid rgba(126,190,255,.35);border-radius:5px;background:#101a2b;color:#dbeafe;cursor:pointer;font-size:11px;padding:0;}
    .rvm-left-panel-collapse-btn:hover{background:#1d3150;border-color:#60a5fa;}
  `;
  document.head.appendChild(style);
}
