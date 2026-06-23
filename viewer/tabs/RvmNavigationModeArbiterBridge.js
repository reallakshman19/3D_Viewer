export const RVM_NAVIGATION_MODE_ARBITER_SCHEMA = 'rvm-navigation-mode-arbiter/v1';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-navigation-mode-arbiter-v1');
const ROOT_SELECTOR = '[data-rvm-viewer]';
const MODE_ACTIONS = new Set(['NAV_SELECT', 'NAV_ORBIT', 'NAV_PAN', 'MARQUEE_SELECT', 'MEASURE_TOOL', 'VIEW_MARQUEE_ZOOM']);
const MODE_BY_ACTION = Object.freeze({
  NAV_SELECT: 'select',
  NAV_ORBIT: 'orbit',
  NAV_PAN: 'pan',
  MARQUEE_SELECT: 'marquee_select',
  MEASURE_TOOL: 'measure_tool',
  VIEW_MARQUEE_ZOOM: 'view_marquee_zoom',
});
const CANVAS_BLOCKER_ALLOW_RE = /^(canvas|rvm-canvas|rvm-viewport|rvm-placeholder)$/i;

export function installRvmNavigationModeArbiterBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];

  const state = {
    schema: RVM_NAVIGATION_MODE_ARBITER_SCHEMA,
    ensured: 0,
    toolbarModeEvents: 0,
    pointerRepairs: 0,
    lastReason: 'installed',
    ensure: ensureDefaultNavigationMode,
    diagnose: diagnoseRvmNavigation,
    repair: repairRvmNavigationPointerStack,
  };

  globalThis[INSTALL_FLAG] = state;
  globalThis.__PCF_GLB_RVM_NAVIGATION_ARBITER__ = state;

  const tick = (reason) => setTimeout(() => ensureDefaultNavigationMode(globalThis.__3D_RVM_VIEWER__, reason), 0);
  bindToolbarModeTracking(state);
  tick('install');
  for (const delay of [80, 250, 750, 1500]) setTimeout(() => ensureDefaultNavigationMode(globalThis.__3D_RVM_VIEWER__, `install-${delay}`), delay);
  try { globalThis.addEventListener?.('rvm-model-loaded', () => tick('model-loaded')); } catch (_) {}
  try { globalThis.addEventListener?.('app:tool-changed', () => tick('tool-changed')); } catch (_) {}
  return state;
}

function bindToolbarModeTracking(state) {
  if (state.toolbarBound) return;
  state.toolbarBound = true;
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-action]');
    if (!button) return;
    const action = String(button.dataset.action || '').trim().toUpperCase();
    if (!MODE_ACTIONS.has(action)) return;
    const viewer = globalThis.__3D_RVM_VIEWER__;
    const mode = MODE_BY_ACTION[action] || '';
    if (viewer && mode) {
      viewer.__rvmNavigationUserMode = mode;
      viewer.__rvmNavigationUserModeAction = action;
      viewer.__rvmNavigationUserModeAt = Date.now();
    }
    state.toolbarModeEvents += 1;
  }, true);
}

export function ensureDefaultNavigationMode(viewer = globalThis.__3D_RVM_VIEWER__, reason = 'ensure') {
  const root = document.querySelector(ROOT_SELECTOR);
  const state = globalThis[INSTALL_FLAG] || {};
  if (!viewer) return writeDiagnostics(viewer, { status: 'skipped', reason: 'viewer-missing' });

  repairRvmNavigationPointerStack(viewer, reason);

  const current = normalizeMode(viewer._rvmInteractionMode || viewer._navMode || '');
  const explicit = normalizeMode(viewer.__rvmNavigationUserMode || '');
  const shouldForceOrbit = !explicit && (!current || current === 'select');

  if (shouldForceOrbit) {
    if (typeof viewer.setNavMode === 'function') viewer.setNavMode('orbit');
    else applyOrbitFallback(viewer);
    viewer.__rvmNavigationArbiterDefaulted = 'orbit';
    updateModeUi(root, 'orbit');
    state.ensured = Number(state.ensured || 0) + 1;
    state.lastReason = reason;
    return writeDiagnostics(viewer, {
      status: 'defaulted-orbit',
      reason,
      previousMode: current || 'unset',
      mode: 'orbit',
      controlsEnabled: viewer.controls?.enabled === true,
    });
  }

  if (current) updateModeUi(root, current);
  return writeDiagnostics(viewer, {
    status: 'preserved',
    reason,
    mode: current || 'orbit',
    explicitMode: explicit || '',
    controlsEnabled: viewer.controls?.enabled === true,
  });
}

export function repairRvmNavigationPointerStack(viewer = globalThis.__3D_RVM_VIEWER__, reason = 'repair') {
  const state = globalThis[INSTALL_FLAG] || {};
  const canvas = viewer?.renderer?.domElement;
  const container = viewer?.container;
  if (canvas?.style) {
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
  }
  if (container?.style) container.style.pointerEvents = 'auto';
  if (viewer?.labelRenderer?.domElement?.style) viewer.labelRenderer.domElement.style.pointerEvents = 'none';
  document.querySelectorAll?.('[data-rvm-nonprimitive-support-hover-preview="true"], .rvm-support-hover-preview').forEach((el) => {
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';
  });
  state.pointerRepairs = Number(state.pointerRepairs || 0) + 1;
  return writeDiagnostics(viewer, {
    status: 'pointer-stack-repaired',
    reason,
    canvasPointerEvents: canvas?.style?.pointerEvents || '',
    labelPointerEvents: viewer?.labelRenderer?.domElement?.style?.pointerEvents || '',
  });
}

export function diagnoseRvmNavigation(viewer = globalThis.__3D_RVM_VIEWER__) {
  const root = document.querySelector(ROOT_SELECTOR);
  const canvas = viewer?.renderer?.domElement || null;
  const blockers = collectPotentialCanvasBlockers(canvas);
  return writeDiagnostics(viewer, {
    status: 'diagnosed',
    schema: RVM_NAVIGATION_MODE_ARBITER_SCHEMA,
    mode: normalizeMode(viewer?._rvmInteractionMode || viewer?._navMode || ''),
    explicitMode: normalizeMode(viewer?.__rvmNavigationUserMode || ''),
    controlsEnabled: viewer?.controls?.enabled === true,
    enableRotate: viewer?.controls?.enableRotate === true,
    enablePan: viewer?.controls?.enablePan === true,
    enableZoom: viewer?.controls?.enableZoom === true,
    activeAction: root?.querySelector?.('[data-action].is-active')?.dataset?.action || '',
    modeChip: root?.querySelector?.('#rvm-mode-chip')?.textContent || '',
    canvasPointerEvents: canvas?.style?.pointerEvents || '',
    containerPointerEvents: viewer?.container?.style?.pointerEvents || '',
    labelPointerEvents: viewer?.labelRenderer?.domElement?.style?.pointerEvents || '',
    potentialCanvasBlockers: blockers,
  });
}

function collectPotentialCanvasBlockers(canvas) {
  if (!canvas?.getBoundingClientRect || !document.elementsFromPoint) return [];
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return [];
  const points = [
    [rect.left + rect.width / 2, rect.top + rect.height / 2],
    [rect.left + Math.max(2, rect.width * 0.15), rect.top + Math.max(2, rect.height * 0.15)],
    [rect.left + rect.width * 0.85, rect.top + rect.height * 0.85],
  ];
  const out = [];
  for (const [x, y] of points) {
    for (const el of document.elementsFromPoint(x, y) || []) {
      if (!el || el === canvas || canvas.contains(el)) continue;
      const cls = String(el.className || '').trim();
      const id = String(el.id || '').trim();
      if (CANVAS_BLOCKER_ALLOW_RE.test(id) || CANVAS_BLOCKER_ALLOW_RE.test(cls)) continue;
      const style = globalThis.getComputedStyle?.(el);
      if (style?.pointerEvents === 'none' || style?.visibility === 'hidden' || style?.display === 'none') continue;
      out.push({ tag: el.tagName || '', id, className: cls, pointerEvents: style?.pointerEvents || '', zIndex: style?.zIndex || '' });
    }
  }
  return dedupeBlockers(out).slice(0, 12);
}

function dedupeBlockers(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = [item.tag, item.id, item.className].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function applyOrbitFallback(viewer) {
  viewer._rvmInteractionMode = 'orbit';
  viewer._navMode = 'orbit';
  if (viewer.controls) {
    viewer.controls.enabled = true;
    viewer.controls.enableRotate = true;
    viewer.controls.enablePan = true;
    viewer.controls.enableZoom = true;
  }
}

function updateModeUi(root, mode) {
  if (!root) return;
  const action = mode === 'pan' ? 'NAV_PAN'
    : mode === 'select' ? 'NAV_SELECT'
      : mode === 'marquee_select' ? 'MARQUEE_SELECT'
        : mode === 'measure' || mode === 'measure_tool' ? 'MEASURE_TOOL'
          : mode === 'view_marquee_zoom' || mode === 'zoom' ? 'VIEW_MARQUEE_ZOOM'
            : 'NAV_ORBIT';
  root.querySelectorAll?.('[data-action]').forEach((button) => button.classList.toggle('is-active', button.dataset.action === action));
  const chip = root.querySelector?.('#rvm-mode-chip');
  if (chip) chip.textContent = mode === 'pan' ? 'Pan'
    : mode === 'select' ? 'Select'
      : mode === 'marquee_select' ? 'Box Select'
        : mode === 'measure' || mode === 'measure_tool' ? 'Measure'
          : mode === 'view_marquee_zoom' || mode === 'zoom' ? 'Zoom'
            : 'Orbit';
}

function writeDiagnostics(viewer, state = {}) {
  const payload = {
    schema: RVM_NAVIGATION_MODE_ARBITER_SCHEMA,
    primitiveExcluded: false,
    ...state,
  };
  if (viewer) viewer.rvmNavigationArbiterDiagnostics = payload;
  return payload;
}

function normalizeMode(mode) {
  const text = String(mode || '').trim().toLowerCase();
  if (text === 'nav_select') return 'select';
  if (text === 'nav_orbit') return 'orbit';
  if (text === 'nav_pan') return 'pan';
  if (text === 'measure') return 'measure_tool';
  if (text === 'zoom') return 'view_marquee_zoom';
  return text;
}
