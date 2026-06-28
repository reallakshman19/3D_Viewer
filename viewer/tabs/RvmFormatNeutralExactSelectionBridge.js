import * as THREE from 'three';

const VERSION = '20260627-rvm-format-neutral-fit-resize-1';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-format-neutral-exact-selection-1');
const NAVIS_CONTROL_SELECTOR = '[data-rvm-navis-toggle],[data-rvm-navis-off],[data-rvm-navis-on],[data-rvm-navis-select],.rvm-navis-row';
const EXACT_SELECTION_SOURCE_KINDS = new Set(['stagedjson', 'uxml', 'json', 'jscon', 'txt', 'source-preview', 'inputxml']);
const GENERIC_LABELS = new Set(['flange', 'valve', 'pipe', 'elbow', 'bend', 'support', 'branch', 'group', 'node', 'component', 'cylinder', 'torus', 'box', 'sphere']);

function norm(value) { return String(value || '').trim(); }
function lower(value) { return norm(value).toLowerCase(); }
function nodeKey(node) { return norm(node?.canonicalObjectId || node?.id); }
function parentKey(node) { return norm(node?.parentCanonicalObjectId || node?.parentId); }
function rowId(row) { return norm(row?.dataset?.nodeId); }
function rowLabel(row) { return norm(row?.querySelector?.('[data-rvm-tree-label]')?.textContent || row?.querySelector?.('.rvm-tree-label')?.textContent || ''); }
function sourceKind(root) { return lower(root?.dataset?.rvmLoadedSourceKind || root?.dataset?.rvmHierarchySourceKind || root?.__rvmFormatNeutralHierarchy?.sourceKind); }
function sourceNodes(root) { const nodes = root?.__rvmFormatNeutralHierarchy?.nodes; return Array.isArray(nodes) ? nodes : []; }
function isFormatNeutralSourceTree(root) { return root?.dataset?.rvmHierarchyController === 'format-neutral' && EXACT_SELECTION_SOURCE_KINDS.has(sourceKind(root)); }
function nodeForRow(root, row) { const id = rowId(row); return sourceNodes(root).find((node) => nodeKey(node) === id) || null; }
function descendantsForNode(root, node) {
  const nodes = sourceNodes(root);
  const start = nodeKey(node);
  if (!start) return node ? [node] : [];
  const byParent = new Map();
  for (const item of nodes) {
    const parent = parentKey(item);
    if (!parent) continue;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(item);
  }
  const out = [];
  const seen = new Set();
  const visit = (item) => {
    const key = nodeKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
    for (const child of byParent.get(key) || []) visit(child);
  };
  visit(node);
  return out;
}
function idCandidatesForNodes(nodes, row) {
  const ids = [];
  const add = (value) => { const text = norm(value); if (text && !ids.includes(text)) ids.push(text); };
  add(rowId(row));
  for (const node of nodes) {
    add(node?.canonicalObjectId);
    add(node?.id);
    add(node?.sourceObjectId);
    add(node?.attributes?.ID);
    add(node?.attributes?.NAME);
    add(node?.attributes?.TAG);
    if (Array.isArray(node?.renderObjectIds)) node.renderObjectIds.forEach(add);
    if (Array.isArray(node?.canonicalIds)) node.canonicalIds.forEach(add);
  }
  return ids;
}
function objectAliases(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return [obj?.uuid, obj?.name, data.name, data.canonicalId, data.renderObjectId, data.leafRenderObjectId, data.sourcePath, data.sourceName, data.displayName, props.sourcePath, props.displayName, props.name, attrs.ID, attrs.NAME, attrs.TAG, attrs.RVM_OWNER_NAME, attrs.RVM_OWNER_PATH, attrs.CANONICAL_ID].filter(Boolean).map(norm);
}
function collectExactObjects(viewer, ids) {
  const wanted = new Set(ids.map(norm).filter(Boolean));
  const matches = [];
  if (!wanted.size) return matches;
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isLineSegments || obj?.isPoints) || obj.visible === false) return;
    const aliases = objectAliases(obj);
    if (aliases.some((alias) => wanted.has(alias))) matches.push(obj);
  });
  return [...new Set(matches)];
}
function fallbackAllowed(label) { const text = lower(label); return text.length >= 6 && !GENERIC_LABELS.has(text); }
function collectStrictFallbackObjects(viewer, label) {
  if (!fallbackAllowed(label)) return [];
  const wanted = lower(label);
  const matches = [];
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!(obj?.isMesh || obj?.isLine || obj?.isLineSegments || obj?.isPoints) || obj.visible === false) return;
    const aliases = objectAliases(obj).map(lower);
    if (aliases.some((alias) => alias === wanted || alias.endsWith(`/${wanted}`))) matches.push(obj);
  });
  return [...new Set(matches)];
}
function forceViewerResize(viewer) {
  try { viewer?._onResize?.(); } catch (_) {}
  try { viewer?.renderer?.setSize?.(viewer?.container?.clientWidth || 1, viewer?.container?.clientHeight || 1); } catch (_) {}
  try { viewer?.labelRenderer?.setSize?.(viewer?.container?.clientWidth || 1, viewer?.container?.clientHeight || 1); } catch (_) {}
  try { window.dispatchEvent(new Event('resize')); } catch (_) {}
}
function boxForObjects(objects = []) {
  const box = new THREE.Box3();
  let any = false;
  for (const obj of objects) {
    try {
      const item = new THREE.Box3().setFromObject(obj);
      if (item && !item.isEmpty()) { box.union(item); any = true; }
    } catch (_) {}
  }
  return any ? box : null;
}
function fitObjects(viewer, objects) {
  if (!objects.length) return;
  forceViewerResize(viewer);
  const box = boxForObjects(objects);
  try { if (box && !box.isEmpty()) viewer?._fitBox?.(box); else viewer?.fitSelection?.(); } catch (_) { try { viewer?.fitSelection?.(); } catch (__) {} }
  requestAnimationFrame(() => { forceViewerResize(viewer); try { if (box && !box.isEmpty()) viewer?._fitBox?.(box); } catch (_) {} });
}
function updatePanel(root, node, row, matches, scopeCount, note = '') {
  const panel = root?.querySelector?.('#rvm-attributes-panel');
  if (!panel) return;
  const attrs = node?.attributes || {};
  const rows = [['Node', rowId(row)], ['Label', rowLabel(row)], ['Kind', node?.kind || node?.type || attrs.TYPE || '-'], ['Hierarchy scope nodes', String(scopeCount || 1)], ['Exact render matches', String(matches.length)], ['Selection mode', note || 'exact source node ids']];
  const attrRows = Object.entries(attrs).slice(0, 18);
  const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const line = ([k, v]) => `<div class="rvm-browser-diag-row"><span>${esc(k)}</span><b>${esc(v === undefined || v === null || v === '' ? '-' : v)}</b></div>`;
  panel.innerHTML = `<div class="rvm-tree-selection-card"><div class="rvm-tree-selection-title">Source hierarchy selection</div><div class="rvm-browser-diag-grid">${rows.map(line).join('')}</div><div class="rvm-tree-selection-title">Attributes</div><div class="rvm-browser-diag-grid">${attrRows.length ? attrRows.map(line).join('') : line(['Attributes', 'No source attributes'])}</div></div>`;
}
function setStatus(root, text) { const status = root?.querySelector?.('#rvm-sb-msg'); if (status) status.textContent = text; }
function markSelected(root, row) { root?.querySelectorAll?.('#rvm-tree li.is-selected, #rvm-tree li.is-canvas-selected').forEach((entry) => entry.classList.remove('is-selected', 'is-canvas-selected')); row?.classList?.add('is-selected'); }
function selectRow(root, row, event) {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const node = nodeForRow(root, row);
  const scopedNodes = descendantsForNode(root, node);
  const ids = idCandidatesForNodes(scopedNodes.length ? scopedNodes : [node].filter(Boolean), row);
  let matches = collectExactObjects(viewer, ids);
  let note = scopedNodes.length > 1 ? 'exact source subtree ids' : 'exact source node ids';
  if (!matches.length) { matches = collectStrictFallbackObjects(viewer, rowLabel(row)); note = matches.length ? 'strict full-label fallback' : 'no exact render object match'; }
  event?.preventDefault?.(); event?.stopPropagation?.(); event?.stopImmediatePropagation?.();
  markSelected(root, row);
  try { viewer?.selection?.clearSelection?.(); } catch (_) {}
  if (viewer) viewer._rvmCanvasSelectedMeshes = matches;
  const renderIds = matches.map((obj) => norm(obj?.userData?.renderObjectId || obj?.userData?.leafRenderObjectId || obj?.userData?.name || obj?.name || obj?.uuid)).filter(Boolean);
  try { if (renderIds.length) viewer?.selection?.selectCanonicalIds?.(renderIds, { additive: false }); } catch (_) {}
  fitObjects(viewer, matches);
  updatePanel(root, node, row, matches, scopedNodes.length || 1, note);
  setStatus(root, matches.length ? `Selected ${matches.length} exact object(s) for ${rowLabel(row) || rowId(row)}` : `Selected source row ${rowLabel(row) || rowId(row)}; no exact render object match`);
  try { root.dispatchEvent(new CustomEvent('rvm-hierarchy-selection', { bubbles: true, detail: { nodeId: rowId(row), label: rowLabel(row), matches, scopeNodeCount: scopedNodes.length || 1, version: VERSION, exactSourceSelection: true } })); } catch (_) {}
}
function onPointer(event) { const root = event.target?.closest?.('[data-rvm-viewer]'); if (!isFormatNeutralSourceTree(root)) return; if (event.target?.closest?.(NAVIS_CONTROL_SELECTOR)) return; const row = event.target?.closest?.('#rvm-tree li[data-node-id]'); if (!row || !root.contains(row)) return; selectRow(root, row, event); }
function onKey(event) { if (event.key !== 'Enter' && event.key !== ' ') return; onPointer(event); }
export function installRvmFormatNeutralExactSelectionBridge() { if (globalThis[INSTALL_FLAG]) return; globalThis[INSTALL_FLAG] = true; globalThis.__PCF_GLB_RVM_FORMAT_NEUTRAL_EXACT_SELECTION__ = { version: VERSION }; document.addEventListener('click', onPointer, true); document.addEventListener('keydown', onKey, true); }
