const VERSION = '20260628-rvm-hierarchy-multiselect-actions-1';
const INSTALL_KEY = '__PCF_GLB_RVM_HIERARCHY_MULTISELECT_ACTIONS__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const ACTIONS = new Set(['fit', 'isolate', 'hide', 'show']);

export function installRvmHierarchyMultiSelectActionBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[INSTALL_KEY];
  if (existing?.version === VERSION) return existing;
  const state = { version: VERSION, dispatch: dispatchHierarchyMultiSelectAction };
  globalThis[INSTALL_KEY] = state;
  document.addEventListener('rvm-hierarchy-multiselect-action', onAction, true);
  state.dispose = () => {
    document.removeEventListener('rvm-hierarchy-multiselect-action', onAction, true);
    if (globalThis[INSTALL_KEY] === state) delete globalThis[INSTALL_KEY];
  };
  return state;
}

function onAction(event) {
  const root = event.target?.closest?.(ROOT_SELECTOR) || event.target;
  const result = dispatchHierarchyMultiSelectAction(root, event.detail || {});
  if (result?.handled) {
    event.stopPropagation?.();
    event.preventDefault?.();
  }
}

function currentViewer(root) {
  return root?.__rvmViewer3D || root?.__rvmViewer || root?.viewer || globalThis.__3D_RVM_VIEWER__ || null;
}

export function dispatchHierarchyMultiSelectAction(root, detail = {}) {
  const action = String(detail.action || '').toLowerCase();
  const selectedIds = Array.isArray(detail.selectedIds) ? detail.selectedIds.filter(Boolean) : [];
  const viewer = currentViewer(root);
  const result = { version: VERSION, action, selectedIds, selectedCount: selectedIds.length, handled: false, method: '', error: '' };
  if (!ACTIONS.has(action)) return emitResult(root, result);
  if (!viewer) return emitResult(root, { ...result, error: 'viewer-not-found' });
  if (!selectedIds.length) return emitResult(root, { ...result, error: 'empty-selection' });
  try {
    if (action === 'fit') {
      viewer.selectCanonicalIds?.(selectedIds, { additive: false });
      viewer.fitSelection?.();
      return emitResult(root, { ...result, handled: true, method: 'selectCanonicalIds+fitSelection' });
    }
    if (action === 'isolate') {
      viewer.visibility?.isolate?.(selectedIds);
      return emitResult(root, { ...result, handled: true, method: 'visibility.isolate' });
    }
    if (action === 'hide') {
      viewer.visibility?.hide?.(selectedIds);
      return emitResult(root, { ...result, handled: true, method: 'visibility.hide' });
    }
    if (action === 'show') {
      if (typeof viewer.visibility?.show === 'function') viewer.visibility.show(selectedIds);
      else viewer.showAll?.();
      return emitResult(root, { ...result, handled: true, method: 'visibility.show' });
    }
  } catch (error) {
    return emitResult(root, { ...result, error: error?.message || String(error) });
  }
  return emitResult(root, result);
}

function emitResult(root, result) {
  if (root?.dataset) {
    root.dataset.rvmHierarchyMultiselectActionVersion = VERSION;
    root.dataset.rvmHierarchyMultiselectLastAction = result.action || '';
    root.dataset.rvmHierarchyMultiselectLastActionHandled = result.handled ? 'true' : 'false';
  }
  try { root?.dispatchEvent?.(new CustomEvent('rvm-hierarchy-multiselect-action-applied', { bubbles: true, detail: result })); } catch (_) {}
  return result;
}
