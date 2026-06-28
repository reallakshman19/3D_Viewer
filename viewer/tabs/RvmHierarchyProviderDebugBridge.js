const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-debug-1');
export const RVM_HIERARCHY_PROVIDER_DEBUG_VERSION = '20260628-rvm-provider-debug-toggle-1';

function text(value) { return String(value ?? '').trim(); }
function escapeHtml(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function row(label, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '-')}</b></div>`; }
function providerTreeOptInEnabled(root) { return globalThis.__PCF_GLB_RVM_PROVIDER_TREE_READ_PATH__ === true || root?.dataset?.rvmProviderTreeReadPath === 'enabled'; }

function providerFromRoot(root, detail = {}) {
  return detail?.provider || root?.__rvmNativeHierarchyProvider || root?.__rvmFormatNeutralHierarchy?.providerResult || root?.__rvmFormatNeutralHierarchy?.hierarchyProviderResult || root?.__rvmHierarchyProviderResult || null;
}

function ensurePanel(root) {
  const diagnostics = root?.querySelector?.('#rvm-browser-parse-diagnostics');
  if (!diagnostics) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-debug');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rvm-hierarchy-provider-debug';
    panel.className = 'rvm-tag-list rvm-hierarchy-provider-debug';
    panel.dataset.rvmHierarchyProviderDebug = 'true';
    diagnostics.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function debugToggleHtml(root) {
  const checked = providerTreeOptInEnabled(root) ? ' checked' : '';
  const status = checked ? 'enabled for next explicit reload/render' : 'disabled';
  return `<label class="rvm-browser-diag-row rvm-provider-tree-toggle"><span><input type="checkbox" data-rvm-provider-tree-toggle="true"${checked}> Provider tree read path</span><b>${escapeHtml(status)}</b></label>`;
}

function renderProviderDebug(root, detail = {}) {
  const panel = ensurePanel(root);
  if (!panel) return;
  const provider = providerFromRoot(root, detail);
  const providerResult = provider?.providerResult || provider;
  const sourceKind = provider?.sourceKind || providerResult?.sourceKind || root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind || '';
  const authority = provider?.sourceAuthority || providerResult?.sourceAuthority || (sourceKind === 'rvm' ? 'native-rvm' : 'source-document');
  const nodeCount = provider?.nodeCount ?? providerResult?.nodeCount ?? root?.dataset?.rvmHierarchyNodeCount ?? '';
  const rows = [
    ['Provider', provider?.providerId || providerResult?.providerId || root?.dataset?.rvmHierarchyProvider || '-'],
    ['Source kind', sourceKind],
    ['Authority', authority],
    ['Node count', String(nodeCount || '-')],
    ['Contract', provider?.providerContractVersion || providerResult?.version || root?.dataset?.rvmHierarchyProviderContract || '-'],
  ];
  panel.innerHTML = `<div class="rvm-panel-header">Hierarchy Provider</div><div class="rvm-browser-diag-grid">${rows.map(([label, value]) => row(label, value)).join('')}${debugToggleHtml(root)}</div>`;
}

function handleToggle(event) {
  const toggle = event.target?.closest?.('[data-rvm-provider-tree-toggle]');
  if (!toggle) return;
  const root = toggle.closest?.('[data-rvm-viewer]');
  if (!root?.dataset) return;
  const enabled = !!toggle.checked;
  globalThis.__PCF_GLB_RVM_PROVIDER_TREE_READ_PATH__ = enabled;
  root.dataset.rvmProviderTreeReadPath = enabled ? 'enabled' : 'disabled';
  root.dataset.rvmProviderTreeReadPathDebugToggle = RVM_HIERARCHY_PROVIDER_DEBUG_VERSION;
  try { root.dispatchEvent(new CustomEvent('rvm-provider-tree-read-path-toggle', { bubbles: true, detail: { enabled, version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION } })); } catch (_) {}
  renderProviderDebug(root, {});
}

export function installRvmHierarchyProviderDebugBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_DEBUG__ = { version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION };
  const update = (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    if (!root?.querySelector) return;
    renderProviderDebug(root, event.detail || {});
  };
  document.addEventListener('change', handleToggle, true);
  document.addEventListener('rvm-tree-rendered', update, true);
  document.addEventListener('rvm-hierarchy-provider-attached', update, true);
}
