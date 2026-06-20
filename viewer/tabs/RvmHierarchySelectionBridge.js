import * as THREE from 'three';

const BRIDGE_VERSION = 'rvm-hierarchy-selection-bridge/v2-fit-hide-css';
const ATTACH_FLAG = 'rvmHierarchySelectionBridge';

export function installRvmHierarchySelectionBridge() {
  injectStyles();
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    if (root) bindRoot(root);
    if (!root && attempts < 120) setTimeout(attach, 500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function bindRoot(root) {
  if (!root || root.dataset[ATTACH_FLAG] === BRIDGE_VERSION) return;
  root.dataset[ATTACH_FLAG] = BRIDGE_VERSION;
  const tree = root.querySelector('#rvm-tree');
  const props = root.querySelector('#rvm-attributes-panel');
  if (!tree || !props) return;

  tree.addEventListener('click', (event) => {
    const li = event.target?.closest?.('li[data-node-id]');
    if (!li || !tree.contains(li)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    handleTreeSelection(root, li);
  }, true);

  props.addEventListener('click', (event) => {
    const action = event.target?.closest?.('[data-rvm-tree-action]')?.dataset?.rvmTreeAction;
    if (!action) return;
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (!viewer) return;
    const api = globalThis.__PCF_GLB_RVM_INTERACTION__;
    if (action === 'fit-selection') {
      if (!api?.fitSelection?.()) fitCurrentSelection(viewer);
    }
    if (action === 'hide-selection') {
      if (!api?.hideSelection?.()) hideCurrentSelection(viewer, root);
    }
    if (action === 'show-hidden') {
      if (!api?.showHidden?.()) showHiddenObjects(viewer, root);
    }
    if (action === 'fit-all') viewer.fitProgressiveBounds?.(viewer._progressiveModelBounds || viewer.modelGroup?.children?.[0]?.userData?.bounds || null, { force: true });
    if (action === 'clear-selection') {
      api?.clearSelection?.();
      viewer.selection?.clearSelection?.();
      viewer._rvmCanvasSelectedMeshes = [];
      root.querySelectorAll('#rvm-tree li.is-selected').forEach((row) => row.classList.remove('is-selected'));
      props.innerHTML = '<div class="rvm-empty-state">No object selected.</div>';
      updateSelectionChip(root, 0);
    }
  });
}

function handleTreeSelection(root, li) {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const id = li.dataset.nodeId || '';
  const label = li.textContent || id;
  root.querySelectorAll('#rvm-tree li.is-selected').forEach((row) => row.classList.remove('is-selected'));
  li.classList.add('is-selected');
  if (!viewer) {
    renderDetails(root, { id, label, matches: [], message: 'Viewer is not ready yet.' });
    return;
  }
  const matches = collectMatches(viewer, id, label);
  const api = globalThis.__PCF_GLB_RVM_INTERACTION__;
  if (matches.length && api?.setSelectionFromObjects) {
    api.setSelectionFromObjects(matches, { sourceObject: matches[0] });
  } else {
    const renderIds = unique(matches.map((obj) => renderIdFor(obj)).filter(Boolean));
    try {
      viewer.selection?.clearSelection?.();
      viewer._rvmCanvasSelectedMeshes = matches;
      if (renderIds.length) viewer.selection?.selectCanonicalIds?.(renderIds);
    } catch (error) {
      console.warn('[RVM hierarchy bridge] selection failed', error);
    }
  }
  fitObjects(viewer, matches);
  renderDetails(root, { id, label, matches });
  updateSelectionChip(root, matches.length);
}

function collectMatches(viewer, id, label) {
  const normalizedId = normalize(id);
  const last = normalize(lastSegment(id) || label || id);
  const matches = [];
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!obj?.isMesh || obj.visible === false) return;
    const aliases = aliasesFor(obj).map(normalize).filter(Boolean);
    const exact = aliases.some((alias) => alias === normalizedId || alias.endsWith(`/${normalizedId}`));
    const prefix = aliases.some((alias) => alias.startsWith(`${normalizedId}/`) || alias.includes(`/${normalizedId}/`));
    const loose = last.length >= 4 && aliases.some((alias) => alias.includes(last));
    if (exact || prefix || loose) matches.push(obj);
  });
  return matches;
}

function aliasesFor(obj) {
  const data = obj.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return [
    data.sourcePath,
    data.sourceName,
    data.displayName,
    props.sourcePath,
    props.displayName,
    data.type,
    data.kind,
    obj.name,
    obj.uuid,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.NAME,
    attrs.TYPE,
    attrs.RVM_PRIMITIVE_KIND,
    attrs.RVM_BROWSER_RENDER_PRIMITIVE,
  ].filter((value) => value !== undefined && value !== null && value !== '');
}

function fitObjects(viewer, objects = []) {
  const box = boxForObjects(objects.filter((obj) => obj?.visible !== false));
  if (box && !box.isEmpty()) {
    try { viewer._fitBox?.(box); return true; }
    catch (error) { console.warn('[RVM hierarchy bridge] fit selected failed', error); }
  }
  try { viewer.fitProgressiveBounds?.(viewer._progressiveModelBounds || null, { force: true }); }
  catch (_) {}
  return false;
}

function fitCurrentSelection(viewer) {
  const direct = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter((obj) => obj?.visible !== false) : [];
  if (direct.length) return fitObjects(viewer, direct);
  const ids = new Set([...(viewer?.selection?.getSelectionRenderIds?.() || []), ...(viewer?.selection?.getSelectedCanonicalIds?.() || [])]);
  const objects = [];
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!obj?.isMesh || obj.visible === false) return;
    const aliases = aliasesFor(obj);
    if (aliases.some((alias) => ids.has(alias))) objects.push(obj);
  });
  return fitObjects(viewer, objects);
}

function hideCurrentSelection(viewer, root) {
  const meshes = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter((obj) => obj?.visible !== false) : [];
  if (!meshes.length) return false;
  for (const mesh of meshes) {
    mesh.visible = false;
    mesh.userData.rvmHiddenByUser = true;
  }
  viewer._rvmCanvasSelectedMeshes = [];
  viewer.selection?.clearSelection?.();
  root.querySelector('#rvm-attributes-panel').innerHTML = '<div class="rvm-empty-state">No object selected.</div>';
  updateSelectionChip(root, 0);
  return true;
}

function showHiddenObjects(viewer, root) {
  let count = 0;
  viewer?.modelGroup?.traverse?.((obj) => {
    if (obj?.userData?.rvmHiddenByUser) {
      obj.visible = true;
      delete obj.userData.rvmHiddenByUser;
      count += 1;
    }
  });
  const status = root?.querySelector?.('#rvm-sb-msg');
  if (status) status.textContent = count ? `Shown ${count} hidden mesh${count === 1 ? '' : 'es'}` : 'No hidden meshes';
  return true;
}

function boxForObjects(objects = []) {
  const box = new THREE.Box3();
  let any = false;
  for (const obj of objects) {
    try {
      const itemBox = new THREE.Box3().setFromObject(obj);
      if (itemBox && !itemBox.isEmpty()) { box.union(itemBox); any = true; }
    } catch (_) {}
  }
  return any ? box : null;
}

function renderDetails(root, { id, label, matches, message = '' }) {
  const panel = root.querySelector('#rvm-attributes-panel');
  if (!panel) return;
  const first = matches?.[0] || null;
  const attrs = first?.userData?.browserRvmAttributes || first?.userData?.attributes || first?.userData?.browserRvmProperties?.attributes || {};
  const fitBox = boxForObjects(matches || []);
  const size = fitBox ? fitBox.getSize(new THREE.Vector3()) : null;
  const rows = [
    ['Node', id],
    ['Label', cleanLabel(label)],
    ['Matched meshes', matches?.length || 0],
    ['Type', first?.userData?.type || attrs.TYPE || '-'],
    ['Kind', first?.userData?.kind || attrs.RVM_PRIMITIVE_KIND || '-'],
    ['Render primitive', first?.userData?.effectiveRenderPrimitive || first?.userData?.renderPrimitive || attrs.RVM_BROWSER_RENDER_PRIMITIVE || '-'],
    ['Source path', first?.userData?.sourcePath || first?.userData?.browserRvmProperties?.sourcePath || '-'],
    ['Size', size ? `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}` : '-'],
  ];
  const attrRows = Object.entries(attrs || {}).slice(0, 24).map(([key, value]) => [key, value]);
  panel.innerHTML = `
    <div class="rvm-tree-selection-card" data-rvm-tree-selection-card="true">
      <div class="rvm-tree-selection-title">Hierarchy selection</div>
      ${message ? `<div class="rvm-browser-diag-warning">${escapeHtml(message)}</div>` : ''}
      <div class="rvm-tree-action-row">
        <button type="button" class="rvm-btn" data-rvm-tree-action="fit-selection">Fit Selection</button>
        <button type="button" class="rvm-btn" data-rvm-tree-action="hide-selection">Hide</button>
        <button type="button" class="rvm-btn" data-rvm-tree-action="show-hidden">Show Hidden</button>
        <button type="button" class="rvm-btn" data-rvm-tree-action="fit-all">Fit All</button>
        <button type="button" class="rvm-btn" data-rvm-tree-action="clear-selection">Clear</button>
      </div>
      <div class="rvm-browser-diag-grid">${rows.map(([key, value]) => row(key, value)).join('')}</div>
      <div class="rvm-tree-selection-title">Attributes</div>
      <div class="rvm-browser-diag-grid">${attrRows.length ? attrRows.map(([key, value]) => row(key, value)).join('') : row('Attributes', 'No attributes on matched mesh')}</div>
    </div>`;
}

function updateSelectionChip(root, count) {
  const chip = root.querySelector('[data-rvm-status-chip="selected"]');
  const footer = root.querySelector('#rvm-sel-count');
  if (chip) chip.textContent = `Selected: ${count}`;
  if (footer) footer.textContent = String(count || 0);
}

function renderIdFor(obj) { return obj?.userData?.name || obj?.name || obj?.uuid || ''; }
function unique(values) { return Array.from(new Set(values)); }
function normalize(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function lastSegment(value) { const parts = String(value || '').split('/').map((part) => part.trim()).filter(Boolean); return parts[parts.length - 1] || String(value || ''); }
function cleanLabel(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function fmt(value) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(3) : '-'; }
function row(key, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(key)}</span><b>${escapeHtml(value === undefined || value === null || value === '' ? '-' : String(value))}</b></div>`; }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

function injectStyles() {
  let style = document.getElementById('rvm-hierarchy-selection-bridge-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'rvm-hierarchy-selection-bridge-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    #rvm-tree li.is-selected > .rvm-tree-node { outline: 1px solid rgba(96,165,250,.95); background: rgba(37,99,235,.28); }
    .rvm-tree-selection-card { display: grid; gap: 8px; }
    .rvm-tree-selection-title { color: #93c5fd; font-weight: 700; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
    .rvm-tree-action-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .rvm-tree-action-row .rvm-btn { padding: 4px 8px; font-size: 12px; }
    .rvm-tree { padding: 4px 2px; }
    .rvm-tree-node { text-align: left; }
  `;
}
