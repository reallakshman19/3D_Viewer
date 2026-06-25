const BRIDGE_VERSION = '20260620-rvm-large-box-support-sync-1';

export function installRvmSelectionTreeSyncBridge() {
  injectStyles();
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root && viewer) bind(root, viewer);
    if ((!root || !viewer) && attempts < 180) setTimeout(attach, 350);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function bind(root, viewer) {
  if (!root || root.dataset.rvmSelectionTreeSync === BRIDGE_VERSION) return;
  root.dataset.rvmSelectionTreeSync = BRIDGE_VERSION;
  let lastKey = '';
  const tick = () => {
    const key = selectionKey(viewer);
    if (key !== lastKey) {
      lastKey = key;
      syncTreeToSelection(root, viewer);
    }
  };
  const timer = setInterval(tick, 300);
  root._rvmSelectionTreeSyncCleanup = () => clearInterval(timer);
  tick();
}

function selectionKey(viewer) {
  const meshes = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter(Boolean) : [];
  if (meshes.length) return meshes.map((mesh) => mesh.uuid).sort().join('|');
  const ids = [
    ...(viewer?.selection?.getSelectionRenderIds?.() || []),
    ...(viewer?.selection?.getSelectedCanonicalIds?.() || []),
  ];
  return ids.map(String).sort().join('|');
}

function syncTreeToSelection(root, viewer) {
  const tree = root.querySelector('#rvm-tree');
  if (!tree) return;
  const aliases = selectedAliases(viewer).map(normalize).filter(Boolean);
  tree.querySelectorAll('li.is-selected').forEach((row) => row.classList.remove('is-selected', 'is-canvas-selected'));
  if (!aliases.length) return;
  const rows = Array.from(tree.querySelectorAll('li[data-node-id]'));
  const match = rows.find((row) => rowMatches(row, aliases));
  if (!match) return;
  match.classList.add('is-selected', 'is-canvas-selected');
  match.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function selectedAliases(viewer) {
  const out = [];
  const meshes = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter(Boolean) : [];
  for (const mesh of meshes) out.push(...aliasesForObject(mesh));
  for (const id of viewer?.selection?.getSelectionRenderIds?.() || []) out.push(id);
  for (const id of viewer?.selection?.getSelectedCanonicalIds?.() || []) out.push(id);
  return unique(out);
}

function aliasesForObject(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return [
    obj?.name,
    obj?.uuid,
    data.name,
    data.sourcePath,
    data.sourceName,
    data.displayName,
    props.sourcePath,
    props.displayName,
    attrs.NAME,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.TYPE,
    attrs.RVM_PRIMITIVE_KIND,
    attrs.RVM_PRIMITIVE_CODE ? `RVM_PRIM_CODE_${attrs.RVM_PRIMITIVE_CODE}` : '',
  ].filter(Boolean);
}

function rowMatches(row, aliases) {
  const rowId = normalize(row.dataset.nodeId || '');
  const text = normalize(row.textContent || '');
  if (!rowId && !text) return false;
  return aliases.some((alias) => {
    if (!alias || alias.length < 2) return false;
    return rowId === alias || rowId.includes(alias) || alias.includes(rowId) || text.includes(alias);
  });
}

function normalize(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }

function injectStyles() {
  if (document.getElementById('rvm-selection-tree-sync-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-selection-tree-sync-style';
  style.textContent = `
    #rvm-tree li.is-canvas-selected > .rvm-tree-node { border-color: rgba(96,165,250,.95); box-shadow: inset 3px 0 0 rgba(96,165,250,.95); }
  `;
  document.head.appendChild(style);
}
