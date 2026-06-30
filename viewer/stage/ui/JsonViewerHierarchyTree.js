function row(type, id, label, depth, selectedRef, meta = '') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'json-viewer-tree-row';
  node.dataset.refType = type;
  node.dataset.refId = id;
  node.style.setProperty('--json-tree-depth', String(depth));
  node.setAttribute('role', 'treeitem');
  if (selectedRef?.type === type && selectedRef?.id === id) node.classList.add('is-selected');
  const name = document.createElement('span');
  name.className = 'json-viewer-tree-name';
  name.textContent = label;
  const badge = document.createElement('span');
  badge.className = 'json-viewer-tree-badge';
  badge.textContent = meta || type;
  node.append(name, badge);
  return node;
}

function childrenByParent(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const parent = node.parentId || 'node-root';
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(node);
  }
  return map;
}

function renderNodeRows(fragment, node, byParent, componentByNode, selectedRef, depth) {
  fragment.appendChild(row('node', node.id, node.name || node.id, depth, selectedRef, 'node'));
  for (const component of componentByNode.get(node.id) || []) {
    const label = component.name || component.semanticType || component.id;
    fragment.appendChild(row('component', component.id, label, depth + 1, selectedRef, component.semanticType));
  }
  for (const child of byParent.get(node.id) || []) renderNodeRows(fragment, child, byParent, componentByNode, selectedRef, depth + 1);
}

export function renderHierarchyTree(target, model, selectedRef) {
  target.replaceChildren();
  if (!model) {
    const empty = document.createElement('div');
    empty.className = 'json-viewer-empty-state';
    empty.textContent = 'No staged model loaded';
    target.appendChild(empty);
    return;
  }

  const nodes = Array.isArray(model.hierarchy?.nodes) ? model.hierarchy.nodes : [];
  const components = Array.isArray(model.components) ? model.components : [];
  const byParent = childrenByParent(nodes);
  const componentByNode = new Map();
  for (const component of components) {
    if (!componentByNode.has(component.nodeId)) componentByNode.set(component.nodeId, []);
    componentByNode.get(component.nodeId).push(component);
  }

  const fragment = document.createDocumentFragment();
  const rootId = model.hierarchy?.rootId || 'node-root';
  fragment.appendChild(row('root', rootId, rootId, 0, selectedRef, 'root'));
  for (const node of byParent.get(rootId) || []) renderNodeRows(fragment, node, byParent, componentByNode, selectedRef, 1);
  if (fragment.childNodes.length === 1 && components.length) {
    for (const component of components) fragment.appendChild(row('component', component.id, component.name || component.id, 1, selectedRef, component.semanticType));
  }
  target.appendChild(fragment);
}
