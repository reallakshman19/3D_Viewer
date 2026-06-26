const VERSION = '20260626-rvm-toolbar-overflow-controller-1';
const CONTROLLER_KEY = '__PCF_GLB_RVM_TOOLBAR_OVERFLOW__';
const MENU_PREFIX = 'rvm-tools-menu';

const states = new WeakMap();
const installedRoots = new Set();
let nextMenuId = 1;

export function installRvmToolbarOverflow(root, options = {}) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot || typeof document === 'undefined') return null;
  const existing = states.get(resolvedRoot);
  if (existing) {
    existing.installCount += 1;
    return syncRvmToolbarOverflow(resolvedRoot, { ...options, reason: options.reason || 'repeat-install' });
  }

  const state = {
    version: VERSION,
    root: resolvedRoot,
    open: false,
    installCount: 1,
    clickCount: 0,
    closeCount: 0,
    lastReason: options.reason || 'install',
    onClick: null,
    onKeyDown: null,
    onPointerDown: null,
  };

  state.onClick = (event) => {
    const button = closest(event?.target, '[data-rvm-toolbar-more]');
    if (!button || !contains(resolvedRoot, button)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    state.clickCount += 1;
    setRvmToolbarOverflowOpen(resolvedRoot, !state.open, 'button-click');
  };

  state.onKeyDown = (event) => {
    if (event?.key !== 'Escape' || !state.open) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    setRvmToolbarOverflowOpen(resolvedRoot, false, 'escape');
    getElements(resolvedRoot).button?.focus?.();
  };

  state.onPointerDown = (event) => {
    if (!state.open) return;
    const { button, menu } = getElements(resolvedRoot);
    const target = event?.target;
    if ((button && contains(button, target)) || (menu && contains(menu, target))) return;
    setRvmToolbarOverflowOpen(resolvedRoot, false, 'outside-pointerdown');
  };

  resolvedRoot.addEventListener?.('click', state.onClick, true);
  document.addEventListener?.('keydown', state.onKeyDown, true);
  document.addEventListener?.('pointerdown', state.onPointerDown, true);
  states.set(resolvedRoot, state);
  installedRoots.add(resolvedRoot);
  resolvedRoot.dataset.rvmToolbarOverflowController = VERSION;
  publishApi();
  return syncRvmToolbarOverflow(resolvedRoot, { ...options, reason: options.reason || 'install' });
}

export function disposeRvmToolbarOverflow(root) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? states.get(resolvedRoot) : null;
  if (!resolvedRoot || !state) return false;
  resolvedRoot.removeEventListener?.('click', state.onClick, true);
  document.removeEventListener?.('keydown', state.onKeyDown, true);
  document.removeEventListener?.('pointerdown', state.onPointerDown, true);
  states.delete(resolvedRoot);
  installedRoots.delete(resolvedRoot);
  delete resolvedRoot.dataset.rvmToolbarOverflowController;
  return true;
}

export function syncRvmToolbarOverflow(root, options = {}) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot) return null;
  const state = states.get(resolvedRoot) || null;
  const { button, menu, rootNode } = getElements(resolvedRoot);
  if (!button || !menu) return null;

  const open = Boolean(state ? state.open : button.getAttribute?.('aria-expanded') === 'true' && !menu.hidden);
  if (!menu.id) menu.id = options.menuId || `${MENU_PREFIX}-${nextMenuId++}`;
  button.setAttribute?.('aria-haspopup', 'menu');
  button.setAttribute?.('aria-controls', menu.id);
  button.setAttribute?.('aria-expanded', String(open));
  if (String(button.tagName || '').toLowerCase() === 'button' && !button.getAttribute?.('type')) button.setAttribute?.('type', 'button');
  menu.hidden = !open;
  menu.setAttribute?.('aria-hidden', String(!open));
  menu.setAttribute?.('role', 'menu');
  rootNode?.classList?.toggle?.('is-open', open);
  if (rootNode?.dataset) rootNode.dataset.rvmToolbarOverflowOpen = String(open);
  resolvedRoot.dataset.rvmToolbarOverflowOpen = String(open);
  if (state) {
    state.lastReason = options.reason || state.lastReason || 'sync';
    state.diagnostics = buildDiagnostics(resolvedRoot, state, open, options.reason || 'sync');
    return state.diagnostics;
  }
  return buildDiagnostics(resolvedRoot, null, open, options.reason || 'sync');
}

export function setRvmToolbarOverflowOpen(root, open, reason = 'api') {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? states.get(resolvedRoot) : null;
  if (!resolvedRoot || !state) return null;
  const nextOpen = Boolean(open);
  if (state.open !== nextOpen && !nextOpen) state.closeCount += 1;
  state.open = nextOpen;
  state.lastReason = reason;
  return syncRvmToolbarOverflow(resolvedRoot, { reason });
}

export function getRvmToolbarOverflowDiagnostics(root) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? states.get(resolvedRoot) : null;
  if (!resolvedRoot) return null;
  return state?.diagnostics || syncRvmToolbarOverflow(resolvedRoot, { reason: 'diagnostics' });
}

function publishApi() {
  globalThis[CONTROLLER_KEY] = {
    version: VERSION,
    install: installRvmToolbarOverflow,
    dispose: disposeRvmToolbarOverflow,
    sync: syncRvmToolbarOverflow,
    setOpen: setRvmToolbarOverflowOpen,
    getDiagnostics: getRvmToolbarOverflowDiagnostics,
    getInstalledRootCount: () => installedRoots.size,
  };
}

function buildDiagnostics(root, state, open, reason) {
  const { button, menu } = getElements(root);
  return {
    version: VERSION,
    reason,
    open,
    installed: Boolean(state),
    installCount: state?.installCount || 0,
    clickCount: state?.clickCount || 0,
    closeCount: state?.closeCount || 0,
    hasButton: Boolean(button),
    hasMenu: Boolean(menu),
    buttonExpanded: button?.getAttribute?.('aria-expanded') || '',
    menuHidden: Boolean(menu?.hidden),
    menuItemCount: menu?.querySelectorAll?.('[data-rvm-tools-menu-item], .rvm-ribbon-section')?.length || 0,
  };
}

function getElements(root) {
  const rootNode = root?.querySelector?.('[data-rvm-toolbar-more-root]') || root?.querySelector?.('.rvm-toolbar-more') || null;
  const scope = rootNode || root;
  return {
    rootNode,
    button: scope?.querySelector?.('[data-rvm-toolbar-more]') || null,
    menu: scope?.querySelector?.('[data-rvm-tools-menu]') || scope?.querySelector?.('[data-rvm-toolbar-more-panel]') || null,
  };
}

function resolveRoot(root) {
  if (root && typeof root.querySelector === 'function') return root;
  if (typeof document !== 'undefined') return document.querySelector?.('[data-rvm-viewer]') || null;
  return null;
}

function closest(target, selector) {
  return target?.closest?.(selector) || null;
}

function contains(parent, child) {
  if (!parent || !child) return false;
  if (parent === child) return true;
  if (typeof parent.contains === 'function') return parent.contains(child);
  let cursor = child;
  while (cursor) {
    if (cursor === parent) return true;
    cursor = cursor.parentElement || cursor.parentNode || null;
  }
  return false;
}
