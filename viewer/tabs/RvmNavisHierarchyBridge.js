const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-navis-hierarchy-bridge-v1');
const TREE_ROOT_ATTR = 'data-rvm-navis-tree-root';
const TREE_ROW_ATTR = 'data-rvm-navis-node-row';
const MAX_CHILDREN_PER_BRANCH = 350;
const MAX_SEARCH_RESULTS = 450;
const MAX_BRANCH_SELECTION_IDS = 750;

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizePathPart(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

function cleanPathParts(path = '', displayName = '') {
  const rawParts = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .map(normalizePathPart)
    .filter(Boolean)
    .filter((part) => !/^RVM\s+RVM_PRIM_CODE/i.test(part));

  const leaf = normalizePathPart(displayName);
  if (leaf && !rawParts.includes(leaf)) rawParts.push(leaf);
  return rawParts.length ? rawParts : [leaf || 'Unassigned'];
}

function objectRenderId(obj) {
  return String(obj?.userData?.name || obj?.name || obj?.uuid || '').trim();
}

function objectPath(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  return data.sourcePath || props.sourcePath || props.SourcePath || data.sourceName || data.displayName || obj?.name || '';
}

function objectLabel(obj) {
  const data = obj?.userData || {};
  return data.displayName || data.sourceName || obj?.name || data.renderPrimitive || 'RVM object';
}

function objectKind(obj) {
  const data = obj?.userData || {};
  const attrs = data.browserRvmAttributes || data.attributes || {};
  return String(data.type || data.kind || attrs.TYPE || data.effectiveRenderPrimitive || data.renderPrimitive || 'NODE').toUpperCase();
}

function classifyLabel(label, kind = '') {
  const text = `${label} ${kind}`.toUpperCase();
  if (/\.RVM$|\.REV$|GAS_?\d|ROOT/.test(text)) return 'FILE';
  if (/BRANCH|\/BTRM|BTRM-|PIPE|PIPING|ZONE|AREA|SITE|CU-/.test(text)) return 'BRANCH';
  if (/STRUCT|FRAME|FRMW|PANEL|FLOOR|GRAD|GRID|ROAD|GENSEC|TMPLATE|EQUIPMENT/.test(text)) return 'STRUCTURE';
  if (/CYLINDER|BOX|DISH|TORUS|CONE|FACET|PRIM/.test(text)) return 'PRIM';
  return kind || 'NODE';
}

function makeNode(id, label, depth, kind = '') {
  return {
    id,
    label,
    depth,
    kind: classifyLabel(label, kind),
    count: 0,
    objectIds: new Set(),
    children: new Map(),
    parent: null,
  };
}

function addObjectToTree(rootNode, nodeById, obj) {
  const renderId = objectRenderId(obj);
  if (!renderId) return;
  const parts = cleanPathParts(objectPath(obj), objectLabel(obj));
  let current = rootNode;
  current.count += 1;
  current.objectIds.add(renderId);
  let key = rootNode.id;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    key = `${key}/${part}`;
    let child = current.children.get(part);
    if (!child) {
      child = makeNode(key, part, current.depth + 1, i === parts.length - 1 ? objectKind(obj) : 'BRANCH');
      child.parent = current;
      current.children.set(part, child);
      nodeById.set(key, child);
    }
    child.count += 1;
    child.objectIds.add(renderId);
    current = child;
  }
}

function buildHierarchyModel(viewer) {
  const rootNode = makeNode('rvm-root', 'Loaded RVM model', -1, 'FILE');
  const nodeById = new Map([[rootNode.id, rootNode]]);
  let objectCount = 0;
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isPoints)) return;
    if (obj.userData?.pickable === false) return;
    objectCount += 1;
    addObjectToTree(rootNode, nodeById, obj);
  });
  return { rootNode, nodeById, objectCount, builtAt: new Date().toISOString() };
}

function sortedChildren(node) {
  return [...(node?.children?.values?.() || [])].sort((a, b) => {
    const aBranch = a.children.size > 0 ? 0 : 1;
    const bBranch = b.children.size > 0 ? 0 : 1;
    return aBranch - bBranch || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function nodeIcon(node) {
  if (node.children.size) return '▣';
  if (node.kind === 'STRUCTURE') return '▤';
  if (node.kind === 'PRIM') return '◇';
  return '◻';
}

function nodeRowHtml(node, expanded = false) {
  const hasChildren = node.children.size > 0;
  const depth = Math.max(0, node.depth);
  return `
    <li ${TREE_ROW_ATTR}="true" data-node-id="${esc(node.id)}" data-rvm-navis-depth="${depth}" data-rvm-navis-label="${esc(node.label.toLowerCase())}">
      <div class="rvm-navis-row ${expanded ? 'is-expanded' : ''}" style="--rvm-navis-depth:${depth}">
        <button type="button" class="rvm-navis-expander" data-rvm-navis-toggle="${esc(node.id)}" ${hasChildren ? '' : 'disabled'} aria-label="${expanded ? 'Collapse' : 'Expand'} ${esc(node.label)}">${hasChildren ? (expanded ? '−' : '+') : ''}</button>
        <button type="button" class="rvm-navis-select" data-rvm-navis-select="${esc(node.id)}" title="Select / fit ${esc(node.label)}">
          <span class="rvm-navis-icon" aria-hidden="true">${nodeIcon(node)}</span>
          <span class="rvm-kind">${esc(node.kind)}</span>
          <span class="rvm-navis-label">${esc(node.label)}</span>
          <span class="rvm-tree-count">${node.count}</span>
        </button>
      </div>
    </li>`;
}

function renderChildrenList(node, depth = 0) {
  const children = sortedChildren(node).slice(0, MAX_CHILDREN_PER_BRANCH);
  const more = node.children.size > MAX_CHILDREN_PER_BRANCH
    ? `<li class="rvm-empty-state">Showing ${MAX_CHILDREN_PER_BRANCH} of ${node.children.size} child nodes. Use search to narrow.</li>`
    : '';
  return `<ul class="rvm-navis-children" data-rvm-navis-children-of="${esc(node.id)}">${children.map((child) => nodeRowHtml(child, false)).join('')}${more}</ul>`;
}

function renderInitialTree(root, model) {
  root.innerHTML = '';
  const status = document.createElement('li');
  status.className = 'rvm-navis-summary';
  status.innerHTML = `<span>Navis hierarchy</span><b>${model.objectCount}</b><small>rendered objects</small>`;
  root.appendChild(status);
  const shell = document.createElement('li');
  shell.setAttribute(TREE_ROOT_ATTR, 'true');
  shell.innerHTML = nodeRowHtml(model.rootNode, true) + renderChildrenList(model.rootNode);
  root.appendChild(shell);
}

function findMatches(model, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const node of model.nodeById.values()) {
    if (node === model.rootNode) continue;
    const path = node.id.toLowerCase();
    if (node.label.toLowerCase().includes(q) || path.includes(q)) out.push(node);
    if (out.length >= MAX_SEARCH_RESULTS) break;
  }
  return out;
}

function renderSearchResults(tree, model, query) {
  const matches = findMatches(model, query);
  tree.innerHTML = `
    <li class="rvm-navis-summary"><span>Search</span><b>${matches.length}</b><small>match(es)</small></li>
    ${matches.map((node) => nodeRowHtml(node, false)).join('') || '<li class="rvm-empty-state">No matching hierarchy items.</li>'}
  `;
}

function setStatus(root, text, warning = false) {
  const el = root?.querySelector?.('#rvm-sb-msg');
  if (!el) return;
  el.textContent = text;
  el.style.color = warning ? '#ffcf70' : '';
}

function selectNode(root, node) {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  if (!viewer || !node) return;
  const ids = [...node.objectIds].slice(0, MAX_BRANCH_SELECTION_IDS);
  if (!ids.length) {
    setStatus(root, `No rendered objects under ${node.label}.`, true);
    return;
  }
  try {
    viewer.selection?.selectCanonicalIds?.(ids, { additive: false });
    viewer.fitSelection?.();
    setStatus(root, `Selected ${ids.length}${node.objectIds.size > ids.length ? '+' : ''} object(s) under ${node.label}.`);
  } catch (error) {
    setStatus(root, `Hierarchy selection failed: ${error?.message || error}`, true);
    console.warn('[RVM hierarchy] selection failed', error);
  }
}

function toggleNode(tree, model, nodeId) {
  const node = model.nodeById.get(nodeId);
  if (!node || !node.children.size) return;
  const row = tree.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!row) return;
  const next = row.nextElementSibling;
  const expanded = row.querySelector('.rvm-navis-row')?.classList.contains('is-expanded');
  if (expanded) {
    row.querySelector('.rvm-navis-row')?.classList.remove('is-expanded');
    const btn = row.querySelector('[data-rvm-navis-toggle]');
    if (btn) btn.textContent = '+';
    if (next?.matches?.(`[data-rvm-navis-children-of="${CSS.escape(nodeId)}"]`)) next.remove();
    return;
  }
  row.querySelector('.rvm-navis-row')?.classList.add('is-expanded');
  const btn = row.querySelector('[data-rvm-navis-toggle]');
  if (btn) btn.textContent = '−';
  row.insertAdjacentHTML('afterend', renderChildrenList(node));
}

function bindTree(root, tree, model) {
  root.__rvmNavisHierarchyModel = model;
  if (root.dataset.rvmNavisHierarchyBound !== 'true') {
    root.dataset.rvmNavisHierarchyBound = 'true';
    tree.addEventListener('click', (event) => {
      const modelNow = root.__rvmNavisHierarchyModel;
      if (!modelNow) return;
      const toggle = event.target?.closest?.('[data-rvm-navis-toggle]');
      if (toggle && !toggle.disabled) {
        event.preventDefault();
        event.stopPropagation();
        toggleNode(tree, modelNow, toggle.dataset.rvmNavisToggle);
        return;
      }
      const select = event.target?.closest?.('[data-rvm-navis-select]');
      if (select) {
        event.preventDefault();
        event.stopPropagation();
        selectNode(root, modelNow.nodeById.get(select.dataset.rvmNavisSelect));
      }
    });
    const filter = root.querySelector('#rvm-tree-filter');
    filter?.addEventListener('input', (event) => {
      const modelNow = root.__rvmNavisHierarchyModel;
      if (!modelNow) return;
      const q = event.target.value.trim();
      if (q) renderSearchResults(tree, modelNow, q);
      else renderInitialTree(tree, modelNow);
    }, true);
  }
}

function installStyles() {
  if (typeof document === 'undefined' || document.getElementById('rvm-navis-hierarchy-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-navis-hierarchy-style';
  style.textContent = `
    .rvm-tree .rvm-navis-summary{display:flex;align-items:center;gap:6px;padding:6px 8px;margin:2px 4px 6px;border:1px solid rgba(126,190,255,.18);border-radius:6px;background:rgba(59,130,246,.08);font-size:10px;color:#bcd8ff}.rvm-tree .rvm-navis-summary b{color:#fff}.rvm-tree .rvm-navis-summary small{color:#7f94b7}
    .rvm-tree .rvm-navis-children{list-style:none;margin:0;padding:0}.rvm-tree [data-rvm-navis-node-row]{list-style:none;margin:1px 0;padding:0}.rvm-navis-row{display:flex;align-items:center;gap:2px;min-width:0;padding-left:calc(var(--rvm-navis-depth,0) * 12px)}
    .rvm-navis-expander{width:16px;height:18px;line-height:14px;display:inline-grid;place-items:center;border:1px solid rgba(126,190,255,.30);border-radius:3px;background:#101a2b;color:#bcd8ff;font-size:11px;padding:0}.rvm-navis-expander:disabled{opacity:.35;border-color:transparent;background:transparent}
    .rvm-navis-select{min-width:0;flex:1;display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:4px;height:20px;border:1px solid rgba(126,190,255,.13);border-radius:4px;background:rgba(255,255,255,.035);color:#d9e9ff;text-align:left;font-size:9px;padding:2px 5px}.rvm-navis-select:hover{border-color:#60a5fa;background:rgba(59,130,246,.18)}
    .rvm-navis-icon{color:#83b7ff;font-size:10px}.rvm-navis-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rvm-tree .rvm-kind{font-size:8px;line-height:1;padding:2px 4px;border-radius:999px;background:#20324c;color:#bcd8ff}.rvm-tree .rvm-tree-count{font-size:8px;color:#94a3b8;margin-left:auto}
  `;
  document.head.appendChild(style);
}

function refreshHierarchy() {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-rvm-viewer]');
  const tree = root?.querySelector?.('#rvm-tree');
  const viewer = globalThis.__3D_RVM_VIEWER__;
  if (!root || !tree || !viewer?.modelGroup) return;
  const model = buildHierarchyModel(viewer);
  if (!model.objectCount) return;
  installStyles();
  bindTree(root, tree, model);
  renderInitialTree(tree, model);
  setStatus(root, `Navis hierarchy indexed ${model.objectCount} rendered object(s).`);
}

export function installRvmNavisHierarchyBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_NAVIS_HIERARCHY__ = {
    version: '20260621-rvm-navis-hierarchy-1',
    refresh: refreshHierarchy,
  };
  globalThis.addEventListener?.('rvm-model-loaded', () => {
    setTimeout(refreshHierarchy, 80);
    setTimeout(refreshHierarchy, 500);
  });
}
