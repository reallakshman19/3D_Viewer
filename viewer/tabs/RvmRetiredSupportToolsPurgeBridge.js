const CACHE_KEY = '20260622-rvm-retired-support-tools-purge-1';
const API_KEY = '__PCF_GLB_RVM_RETIRED_SUPPORT_TOOLS__';

const RETIRED_SCENE_ROOTS = Object.freeze([
  '__RVM_GEOMETRY_SUPPORT_SYMBOLS__',
  '__RVM_SUPPORT_ASSEMBLY_MARKERS__',
  '__RVM_EXPORTABLE_SUPPORT_GEOMETRY__',
  '__RVM_SUPPORT_SYMBOLS__',
]);

const RETIRED_GLOBALS = Object.freeze([
  '__PCF_GLB_RVM_SUPPORT_DIAGNOSTICS__',
  '__PCF_GLB_RVM_SUPPORT_ASSEMBLY_DIAGNOSTICS__',
  '__PCF_GLB_RVM_INTELLIGENT_SUPPORT_ENGINE_DIAGNOSTICS__',
  '__PCF_GLB_RVM_INTELLIGENT_SUPPORT_ENGINE__',
  '__PCF_GLB_RVM_SUPPORT_ATT_MAPPING_DIAGNOSTICS__',
  '__PCF_GLB_RVM_SUPPORT_GEOMETRY_DIAGNOSTICS__',
  '__PCF_GLB_RVM_RAW_SUPPORT_CYLINDER_GUARD__',
]);

const RETIRED_STORAGE_KEYS = Object.freeze([
  'rvm_support_render_mode_v1',
  'rvm_support_geometry_mode_v1',
  'rvm_support_assembly_markers_v1',
]);

export function installRvmRetiredSupportToolsPurgeBridge() {
  const api = globalThis[API_KEY] || {
    version: CACHE_KEY,
    retired: true,
    purge: () => purgeRetiredSupportTools('api'),
  };
  api.version = CACHE_KEY;
  api.retired = true;
  globalThis[API_KEY] = api;

  purgeStorage();
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    purgeRetiredSupportTools(`startup-${attempts}`);
    if (attempts < 40) setTimeout(tick, attempts < 10 ? 250 : 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, { once: true });
  else tick();
  installEventPurge();
  return api;
}

function installEventPurge() {
  if (globalThis.__PCF_GLB_RVM_RETIRED_SUPPORT_TOOLS_EVENT_PURGE__) return;
  globalThis.__PCF_GLB_RVM_RETIRED_SUPPORT_TOOLS_EVENT_PURGE__ = true;
  for (const eventName of ['rvm-model-loaded', 'rvm-render-complete', 'rvm-support-assembly-diagnostics', 'rvm-intelligent-support-engine-diagnostics']) {
    globalThis.addEventListener?.(eventName, () => setTimeout(() => purgeRetiredSupportTools(eventName), 0));
  }
}

function purgeRetiredSupportTools(reason = 'manual') {
  const root = document.querySelector('[data-rvm-viewer]');
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const removedSceneRoots = purgeSceneRoots(viewer);
  const removedDomNodes = purgeDom(root);
  const clearedGlobals = purgeGlobals();
  purgeStorage();
  const payload = { schema: 'rvm-retired-support-tools/v1', version: CACHE_KEY, reason, removedSceneRoots, removedDomNodes, clearedGlobals, retired: true };
  globalThis[API_KEY] = { ...(globalThis[API_KEY] || {}), ...payload, purge: () => purgeRetiredSupportTools('api') };
  if (root) root.dataset.rvmSupportToolsRetired = CACHE_KEY;
  return payload;
}

function purgeSceneRoots(viewer) {
  let count = 0;
  const scene = viewer?.scene;
  for (const name of RETIRED_SCENE_ROOTS) {
    let obj = scene?.getObjectByName?.(name);
    while (obj) {
      scene.remove(obj);
      disposeObject(obj);
      count += 1;
      obj = scene?.getObjectByName?.(name);
    }
  }
  return count;
}

function purgeDom(root) {
  if (!root) return 0;
  let count = 0;
  for (const selector of [
    '[data-rvm-support-engine]',
    '[data-rvm-support-att-mapping]',
    '[data-rvm-support-assembly-toggle]',
    '[data-rvm-support-assembly-diagnostics]',
    '[data-rvm-support-att-panel]',
    '[data-rvm-support-engine-panel]',
    '[data-rvm-support-geometry-panel]',
    '.rvm-support-engine-section',
    '.rvm-support-att-section',
    '.rvm-support-mode-row',
    '.rvm-support-summary-list',
    '.rvm-support-assembly-row',
    '.rvm-support-assembly-diag',
  ]) count += removeAll(root, selector);

  const summary = root.querySelector('#rvm-support-summary');
  if (summary) {
    const header = previousElement(summary);
    if (/support/i.test(header?.textContent || '')) {
      header.remove();
      count += 1;
    }
    summary.remove();
    count += 1;
  }

  const scale = root.querySelector('#rvm-support-scale');
  const label = root.querySelector('#rvm-support-labels');
  const section = scale?.closest?.('.rvm-ribbon-section') || label?.closest?.('.rvm-ribbon-section');
  if (section) {
    section.remove();
    count += 1;
  }

  const supportChip = root.querySelector('[data-rvm-status-chip="supports"]');
  if (supportChip) {
    supportChip.remove();
    count += 1;
  }

  const search = root.querySelector('#rvm-search-input');
  if (search && /support tag/i.test(search.getAttribute('placeholder') || '')) search.setAttribute('placeholder', 'Search hierarchy / object…');
  return count;
}

function previousElement(node) {
  let current = node?.previousElementSibling || null;
  while (current && current.nodeType !== 1) current = current.previousElementSibling;
  return current;
}

function removeAll(root, selector) {
  let count = 0;
  root.querySelectorAll(selector).forEach((node) => { node.remove(); count += 1; });
  return count;
}

function purgeGlobals() {
  let count = 0;
  for (const key of RETIRED_GLOBALS) {
    if (Object.prototype.hasOwnProperty.call(globalThis, key)) {
      try { delete globalThis[key]; } catch (_) { globalThis[key] = undefined; }
      count += 1;
    }
  }
  return count;
}

function purgeStorage() {
  try { for (const key of RETIRED_STORAGE_KEYS) localStorage.removeItem(key); } catch (_) {}
}

function disposeObject(root) {
  root?.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    mats.forEach((mat) => mat?.dispose?.());
  });
}
