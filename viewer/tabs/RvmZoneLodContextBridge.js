const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-zone-lod-context-bridge-v2');
const VERSION = '20260630-rvm-zone-lod-context-3';
const STORAGE_PREFIX = 'rvm_zone_lod_context_v1:';
const MENU_ID = 'rvm-zone-lod-context-menu';
const DETAIL_VALUES = new Set(['hidden', '25', '50', '100', '250']);

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stableHash(text = '') {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function setStatus(root, message, warning = false) {
  const el = root?.querySelector?.('#rvm-sb-msg');
  if (!el) return;
  el.textContent = message;
  el.style.color = warning ? '#ffcf70' : '';
}

function viewer() {
  return globalThis.__3D_RVM_VIEWER__ || null;
}

function objectRenderId(obj) {
  return objectAliases(obj)[0] || '';
}

function objectAliases(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return [
    data.renderObjectId,
    data.leafRenderObjectId,
    data.canonicalId,
    data.canonicalObjectId,
    data.sourceObjectId,
    data.sourcePath,
    data.sourceName,
    data.displayName,
    data.name,
    props.sourcePath,
    props.SourcePath,
    props.displayName,
    props.name,
    attrs.ID,
    attrs.NAME,
    attrs.TAG,
    attrs.CANONICAL_ID,
    attrs.RVM_OWNER_PATH,
    attrs.RVM_OWNER_NAME,
    obj?.name,
    obj?.uuid,
  ].filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
}

function objectMatchesIds(obj, ids) {
  const aliases = objectAliases(obj);
  return aliases.some((alias) => ids.has(alias));
}

function fileKey(root) {
  const v = viewer();
  const scene = v?.modelGroup?.children?.[0] || v?.modelGroup;
  const raw = scene?.userData?.fileName
    || scene?.userData?.browserRvmParser?.fileName
    || scene?.userData?.browserRvmAtt?.fileName
    || root?.querySelector?.('#rvm-browser-parse-diagnostics')?.textContent
    || 'current-rvm-model';
  const text = String(raw || 'current-rvm-model').replace(/\s+/g, '-').slice(0, 160);
  return `${stableHash(text)}-${text.replace(/[^A-Za-z0-9_.-]+/g, '_')}`;
}

function storageKey(root) {
  return `${STORAGE_PREFIX}${fileKey(root)}`;
}

function readOverrides(root) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(root)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(root, overrides) {
  try { localStorage.setItem(storageKey(root), JSON.stringify(overrides || {})); } catch {}
}

function nodePathLabel(node) {
  const labels = [];
  let current = node;
  while (current) {
    labels.unshift(current.label || current.id);
    current = current.parent;
  }
  return labels.join('/') || node?.label || 'branch';
}

function objectIdsForNode(node) {
  return new Set([...(node?.objectIds || [])].map(String));
}

function keepObjectForDetail(id, detail, obj) {
  if (detail === '100' || detail === '250') return true;
  if (detail === 'hidden') return false;
  const modulo = detail === '50' ? 2 : 4;
  return stableHash(id) % modulo === 0;
}

function modelForRoot(root) {
  return root?.__rvmNavisHierarchyModel || formatNeutralModelForRoot(root);
}

function formatNeutralModelForRoot(root) {
  const nodes = root?.__rvmFormatNeutralHierarchy?.nodes;
  if (!Array.isArray(nodes) || !nodes.length) return null;
  const cache = root.__rvmZoneLodFormatNeutralModel;
  if (cache?.sourceNodes === nodes) return cache.model;
  const nodeById = new Map();
  const make = (source) => {
    const id = sourceNodeId(source);
    if (!id) return null;
    const node = {
      id,
      label: sourceNodeLabel(source),
      count: 0,
      objectIds: sourceObjectIds(source),
      children: [],
      parent: null,
      sourceNode: source,
    };
    nodeById.set(id, node);
    return node;
  };
  for (const source of nodes) make(source);
  for (const source of nodes) {
    const node = nodeById.get(sourceNodeId(source));
    const parent = nodeById.get(sourceParentId(source));
    if (node && parent && node !== parent) {
      node.parent = parent;
      parent.children.push(node);
    }
  }
  const ordered = [...nodeById.values()].sort((a, b) => depthForNode(b) - depthForNode(a));
  for (const node of ordered) {
    for (const child of node.children) for (const id of child.objectIds) node.objectIds.add(id);
    node.count = node.objectIds.size || node.children.length;
  }
  const model = { nodeById, objectById: new Map(), objectCount: nodeById.size, formatNeutral: true };
  root.__rvmZoneLodFormatNeutralModel = { sourceNodes: nodes, model };
  return model;
}

function sourceNodeId(node = {}) {
  return String(node.canonicalObjectId || node.id || node.nodeId || node.sourceObjectId || '').trim();
}

function sourceParentId(node = {}) {
  return String(node.parentCanonicalObjectId || node.parentId || node.parent || '').trim();
}

function sourceNodeLabel(node = {}) {
  return String(node.name || node.label || node.displayName || node.attributes?.NAME || sourceNodeId(node) || 'Hierarchy node');
}

function sourceObjectIds(node = {}) {
  const ids = [];
  const add = (value) => {
    const text = String(value ?? '').trim();
    if (text && !ids.includes(text)) ids.push(text);
  };
  add(node.canonicalObjectId);
  add(node.id);
  add(node.nodeId);
  add(node.sourceObjectId);
  add(node.attributes?.ID);
  add(node.attributes?.NAME);
  add(node.attributes?.TAG);
  add(node.attributes?.RVM_OWNER_PATH);
  add(node.attributes?.RVM_OWNER_NAME);
  if (Array.isArray(node.renderObjectIds)) node.renderObjectIds.forEach(add);
  if (Array.isArray(node.canonicalIds)) node.canonicalIds.forEach(add);
  return new Set(ids);
}

function depthForNode(node) {
  let depth = 0;
  let current = node?.parent || null;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = current.parent;
  }
  return depth;
}

function applyNodeDetail(root, node, detail, { persist = true } = {}) {
  if (!node || !DETAIL_VALUES.has(detail)) return { affected: 0, visible: 0 };
  const v = viewer();
  if (!v?.modelGroup) return { affected: 0, visible: 0 };
  const ids = objectIdsForNode(node);
  let affected = 0;
  let visible = 0;

  v.modelGroup.traverse?.((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isPoints)) return;
    if (!objectMatchesIds(obj, ids)) return;
    const id = objectRenderId(obj) || obj.uuid || obj.name || `${affected}`;
    affected += 1;
    obj.userData = obj.userData || {};
    if (obj.userData.rvmZoneLodOriginalVisible === undefined) {
      obj.userData.rvmZoneLodOriginalVisible = obj.visible !== false;
    }
    const nextVisible = keepObjectForDetail(id, detail, obj) && obj.userData.rvmZoneLodOriginalVisible !== false;
    obj.visible = nextVisible;
    obj.userData.rvmZoneLodDetail = detail;
    if (nextVisible) visible += 1;
  });

  if (persist) {
    const overrides = readOverrides(root);
    overrides[node.id] = {
      detail,
      label: nodePathLabel(node),
      count: node.objectIds?.size || affected,
      updatedAt: new Date().toISOString(),
    };
    writeOverrides(root, overrides);
  }
  markNodeOverride(root, node.id, detail);
  v.requestRender?.();
  return { affected, visible };
}

function clearNodeOverride(root, node) {
  if (!node) return;
  const overrides = readOverrides(root);
  delete overrides[node.id];
  writeOverrides(root, overrides);
  markNodeOverride(root, node.id, '');
  applyNodeDetail(root, node, '100', { persist: false });
}

function clearAllOverrides(root) {
  try { localStorage.removeItem(storageKey(root)); } catch {}
  const v = viewer();
  let restored = 0;
  v?.modelGroup?.traverse?.((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isPoints)) return;
    if (obj.userData?.rvmZoneLodOriginalVisible !== undefined) {
      obj.visible = obj.userData.rvmZoneLodOriginalVisible !== false;
      delete obj.userData.rvmZoneLodDetail;
      restored += 1;
    }
  });
  root.querySelectorAll?.('[data-rvm-zone-lod-detail]').forEach((row) => {
    row.removeAttribute('data-rvm-zone-lod-detail');
    row.classList.remove('has-zone-lod-override');
  });
  v?.requestRender?.();
  setStatus(root, `Cleared hierarchy LOD overrides (${restored} object state(s) restored).`);
}

function markNodeOverride(root, nodeId, detail) {
  if (typeof CSS === 'undefined' || !CSS.escape) return;
  const row = root.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!row) return;
  const button = row.querySelector('.rvm-navis-select, :scope > .rvm-tree-node');
  if (!button) return;
  if (detail) {
    button.dataset.rvmZoneLodDetail = detail;
    button.classList.add('has-zone-lod-override');
  } else {
    button.removeAttribute('data-rvm-zone-lod-detail');
    button.classList.remove('has-zone-lod-override');
  }
}

function markKnownOverrides(root) {
  const model = modelForRoot(root);
  if (!model) return;
  const overrides = readOverrides(root);
  for (const [nodeId, entry] of Object.entries(overrides)) {
    if (!model.nodeById?.has(nodeId)) continue;
    markNodeOverride(root, nodeId, String(entry?.detail || ''));
  }
}

function applyPersistedOverrides(root) {
  const model = modelForRoot(root);
  if (!model) return { applied: 0, affected: 0 };
  const overrides = readOverrides(root);
  let applied = 0;
  let affected = 0;
  for (const [nodeId, entry] of Object.entries(overrides)) {
    const node = model.nodeById?.get(nodeId);
    const detail = String(entry?.detail || '');
    if (!node || !DETAIL_VALUES.has(detail)) continue;
    const result = applyNodeDetail(root, node, detail, { persist: false });
    applied += 1;
    affected += result.affected;
  }
  if (applied) setStatus(root, `Applied ${applied} saved hierarchy LOD override(s) to ${affected} object(s).`);
  return { applied, affected };
}

function selectAndFit(root, node) {
  const v = viewer();
  if (!v || !node) return;
  const ids = objectIdsForNode(node);
  const objects = [];
  v.modelGroup?.traverse?.((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isPoints) || obj.visible === false) return;
    if (objectMatchesIds(obj, ids)) objects.push(obj);
  });
  const renderIds = objects.map(objectRenderId).filter(Boolean).slice(0, 750);
  try {
    v._rvmCanvasSelectedMeshes = objects;
    v.selection?.selectCanonicalIds?.(renderIds, { additive: false });
    v.fitSelection?.();
    setStatus(root, `Selected ${objects.length}${node.objectIds.size > objects.length ? '+' : ''} object(s) under ${node.label}.`);
  } catch (error) {
    setStatus(root, `Branch selection failed: ${error?.message || error}`, true);
  }
}

function hideMenu() {
  document.getElementById(MENU_ID)?.remove();
}

function showMenu(root, node, event) {
  hideMenu();
  const model = modelForRoot(root);
  const targetNodes = selectedContextNodes(root, model, node);
  const multi = targetNodes.length > 1;
  const current = readOverrides(root)?.[node.id]?.detail || '100';
  const menu = document.createElement('div');
  menu.id = MENU_ID;
  menu.className = 'rvm-zone-lod-context-menu';
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 230)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 220)}px`;
  menu.innerHTML = `
    <div class="rvm-zone-lod-menu-title">${esc(multi ? `${targetNodes.length} selected zones` : node.label)} <small>${esc(multi ? `${sumNodeCounts(targetNodes)} object reference(s)` : `${node.count} object(s)`)}</small></div>
    <button type="button" data-zone-lod-action="select">Select / fit ${multi ? 'clicked branch' : 'branch'}</button>
    <button type="button" data-zone-lod-action="250" ${current === '250' ? 'class="is-active"' : ''}>Render loaded branch at 250%</button>
    <button type="button" data-zone-lod-action="100" ${current === '100' ? 'class="is-active"' : ''}>Render branch at 100%</button>
    <button type="button" data-zone-lod-action="50" ${current === '50' ? 'class="is-active"' : ''}>Render branch at 50%</button>
    <button type="button" data-zone-lod-action="25" ${current === '25' ? 'class="is-active"' : ''}>Render branch at 25%</button>
    <button type="button" data-zone-lod-action="hidden" ${current === 'hidden' ? 'class="is-danger is-active"' : 'class="is-danger"'}>Hide branch</button>
    <button type="button" data-zone-lod-action="clear">Clear branch override</button>
    <button type="button" data-zone-lod-action="clear-all">Reset all saved overrides</button>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', (click) => {
    const action = click.target?.closest?.('[data-zone-lod-action]')?.dataset?.zoneLodAction;
    if (!action) return;
    click.preventDefault();
    if (action === 'select') selectAndFit(root, node);
    else if (action === 'clear') {
      for (const target of targetNodes) clearNodeOverride(root, target);
      setStatus(root, `Cleared LOD override for ${multi ? `${targetNodes.length} selected zones` : node.label}.`);
    }
    else if (action === 'clear-all') clearAllOverrides(root);
    else {
      const result = applyDetailToNodes(root, targetNodes, action);
      const label = action === 'hidden' ? 'hidden' : `${action}% detail`;
      setStatus(root, `${multi ? `${targetNodes.length} selected zones` : node.label}: ${label}; ${result.visible}/${result.affected} object(s) visible.`);
    }
    hideMenu();
  });
}

function selectedContextNodes(root, model, node) {
  const checkedRows = [...root.querySelectorAll?.('#rvm-tree li.is-multi-selected[data-node-id], #rvm-tree [data-rvm-hierarchy-row-checkbox]:checked') || []]
    .map((entry) => entry.closest?.('li[data-node-id]') || entry)
    .filter(Boolean);
  const ids = new Set(checkedRows.map((row) => row.dataset?.nodeId).filter(Boolean));
  if (ids.size <= 1 || !ids.has(node.id)) return [node];
  return [...ids].map((id) => model?.nodeById?.get(id)).filter(Boolean);
}

function applyHierarchyLodAction(event) {
  const root = event.target?.closest?.('[data-rvm-viewer]') || document.querySelector('[data-rvm-viewer]');
  const model = modelForRoot(root);
  const selectedIds = Array.isArray(event?.detail?.selectedIds) ? event.detail.selectedIds.map(String).filter(Boolean) : [];
  const detail = String(event?.detail?.renderDetail || '100');
  if (!root || !model || !selectedIds.length || !DETAIL_VALUES.has(detail)) return;
  const nodes = selectedIds.map((id) => model.nodeById?.get(id)).filter(Boolean);
  if (!nodes.length) {
    setStatus(root, 'Render detail: selected hierarchy rows are not available in the current model.', true);
    return;
  }
  const result = applyDetailToNodes(root, nodes, detail);
  const label = detail === 'hidden' ? 'hidden' : `${detail}% detail`;
  setStatus(root, `Applied ${label} to ${nodes.length} selected zone(s); ${result.visible}/${result.affected} object(s) visible.`);
}

function sumNodeCounts(nodes = []) {
  return nodes.reduce((sum, node) => sum + Number(node?.count || node?.objectIds?.size || 0), 0);
}

function applyDetailToNodes(root, nodes, detail) {
  let affected = 0;
  let visible = 0;
  for (const node of nodes) {
    const result = applyNodeDetail(root, node, detail);
    affected += result.affected;
    visible += result.visible;
  }
  return { affected, visible };
}

function bindContextMenu(root) {
  const tree = root?.querySelector?.('#rvm-tree');
  if (!tree || root.dataset.rvmZoneLodContextBound === 'true') return;
  root.dataset.rvmZoneLodContextBound = 'true';
  tree.addEventListener('contextmenu', (event) => {
    const row = event.target?.closest?.('[data-node-id]');
    const nodeId = row?.dataset?.nodeId;
    const model = modelForRoot(root);
    const node = nodeId ? model?.nodeById?.get(nodeId) : null;
    if (!node || !node.objectIds?.size) return;
    event.preventDefault();
    event.stopPropagation();
    showMenu(root, node, event);
  }, true);
  document.addEventListener('click', hideMenu, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideMenu(); }, true);
}

function installStyles() {
  if (document.getElementById('rvm-zone-lod-context-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-zone-lod-context-style';
  style.textContent = `
    .rvm-zone-lod-context-menu{position:fixed;z-index:100000;min-width:218px;background:#0f172a;border:1px solid rgba(125,190,255,.35);border-radius:10px;box-shadow:0 18px 46px rgba(0,0,0,.48);padding:6px;color:#e8f3ff;font-family:system-ui,sans-serif;font-size:12px}
    .rvm-zone-lod-menu-title{padding:7px 8px;border-bottom:1px solid rgba(125,190,255,.16);font-weight:700}.rvm-zone-lod-menu-title small{display:block;color:#93a9c8;font-weight:500;margin-top:2px}
    .rvm-zone-lod-context-menu button{display:block;width:100%;text-align:left;margin:2px 0;padding:7px 8px;border:0;border-radius:7px;background:transparent;color:#dbeafe;cursor:pointer}.rvm-zone-lod-context-menu button:hover,.rvm-zone-lod-context-menu button.is-active{background:rgba(59,130,246,.22)}.rvm-zone-lod-context-menu button.is-danger{color:#fecaca}.rvm-zone-lod-context-menu button.is-danger:hover{background:rgba(239,68,68,.18)}
    .rvm-navis-select.has-zone-lod-override,.rvm-tree-node.has-zone-lod-override{border-color:#fbbf24!important;background:rgba(251,191,36,.10)!important}
    .rvm-navis-select[data-rvm-zone-lod-detail]::after,.rvm-tree-node[data-rvm-zone-lod-detail]::after{content:attr(data-rvm-zone-lod-detail);font-size:8px;color:#facc15;border:1px solid rgba(250,204,21,.35);border-radius:999px;padding:0 4px;justify-self:end;align-self:center}
    .rvm-navis-select[data-rvm-zone-lod-detail="hidden"]::after,.rvm-tree-node[data-rvm-zone-lod-detail="hidden"]::after{content:"OFF";color:#fecaca;border-color:rgba(248,113,113,.40)}
  `;
  document.head.appendChild(style);
}

function scan() {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-rvm-viewer]');
  if (!root) return;
  formatNeutralModelForRoot(root);
  bindContextMenu(root);
  markKnownOverrides(root);
}

export function installRvmZoneLodContextBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  installStyles();
  scan();
  globalThis.addEventListener?.('rvm-model-loaded', () => {
    setTimeout(() => {
      const root = document.querySelector('[data-rvm-viewer]');
      if (!root) return;
      scan();
      applyPersistedOverrides(root);
    }, 700);
  });
  document.addEventListener('rvm-hierarchy-lod-action', applyHierarchyLodAction, true);
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  globalThis.__PCF_GLB_RVM_ZONE_LOD_CONTEXT__ = {
    version: VERSION,
    applyHierarchyLodAction,
    applyPersistedOverrides,
    clearAllOverrides,
    refresh: scan,
  };
}
