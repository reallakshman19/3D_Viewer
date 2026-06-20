import * as THREE from 'three';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-toolbar-canvas-selection-patch-v1');
const BRIDGE_VERSION = '20260620-rvm-toolbar-selection-1';
const CLICK_DRAG_TOLERANCE_PX = 5;

export function installRvmViewerInteractionPatch(RvmViewer3D) {
  const proto = RvmViewer3D?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;

  proto.dispatchAction = function dispatchRvmToolbarAction(action) {
    return executeToolbarAction(this, action);
  };

  proto.setToolMode = function setRvmToolMode(action) {
    const mode = modeForAction(action);
    if (!mode) return false;
    this.setNavMode?.(mode);
    return true;
  };

  const originalSetNavMode = proto.setNavMode;
  if (typeof originalSetNavMode === 'function') {
    proto.setNavMode = function patchedSetNavMode(mode) {
      const normalized = String(mode || '').toLowerCase();
      const result = originalSetNavMode.call(this, mode);
      this._rvmLastToolMode = normalized || this._navMode || 'orbit';
      return result;
    };
  }

  proto[PATCH_FLAG] = true;
}

export function installRvmCanvasSelectionBridge() {
  injectStyles();
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const viewer = globalThis.__3D_RVM_VIEWER__;
    const root = document.querySelector('[data-rvm-viewer]');
    if (viewer && root && viewer.renderer?.domElement) bindCanvasSelection(root, viewer);
    if ((!viewer || !root) && attempts < 160) setTimeout(attach, 350);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function executeToolbarAction(viewer, action) {
  const key = normalizeAction(action);
  try {
    switch (key) {
      case 'NAV_SELECT': return setMode(viewer, 'select');
      case 'NAV_ORBIT': return setMode(viewer, 'orbit');
      case 'NAV_PAN': return setMode(viewer, 'pan');
      case 'MARQUEE_SELECT': return setMode(viewer, 'marquee_select');
      case 'MEASURE_TOOL': return setMode(viewer, 'measure_tool');
      case 'VIEW_MARQUEE_ZOOM': return setMode(viewer, 'view_marquee_zoom');
      case 'VIEW_FIT_ALL': return fitAllRvm(viewer);
      case 'VIEW_FIT_SELECTION': return fitCurrentSelection(viewer) || fitAllRvm(viewer);
      case 'VIEW_TOGGLE_PROJECTION': viewer.toggleProjection?.(); return true;
      case 'SECTION_BOX': viewer.setSectionMode?.('BOX'); return true;
      case 'SECTION_PLANE_UP': viewer.setSectionMode?.('PLANE_UP'); return true;
      case 'SECTION_DISABLE': viewer.disableSection?.(); return true;
      case 'NAV_PLAN_X': viewer.snapToPreset?.('TOP'); return true;
      case 'NAV_ROTATE_Y': viewer.snapToPreset?.('FRONT'); return true;
      case 'NAV_ROTATE_Z': viewer.snapToPreset?.('RIGHT'); return true;
      case 'SNAP_ISO_NW': viewer.snapToPreset?.('ISO_NW'); return true;
      case 'SNAP_ISO_NE': viewer.snapToPreset?.('ISO_NE'); return true;
      case 'SNAP_ISO_SW': viewer.snapToPreset?.('ISO_SW'); return true;
      case 'SNAP_ISO_SE': viewer.snapToPreset?.('ISO_SE'); return true;
      default: return false;
    }
  } catch (error) {
    console.warn('[RVM interaction] toolbar action failed', action, error);
    return false;
  }
}

function modeForAction(action) {
  const key = normalizeAction(action);
  if (key === 'NAV_SELECT') return 'select';
  if (key === 'NAV_ORBIT') return 'orbit';
  if (key === 'NAV_PAN') return 'pan';
  if (key === 'MARQUEE_SELECT') return 'marquee_select';
  if (key === 'MEASURE_TOOL') return 'measure_tool';
  if (key === 'VIEW_MARQUEE_ZOOM') return 'view_marquee_zoom';
  return '';
}

function setMode(viewer, mode) {
  viewer.setNavMode?.(mode);
  return true;
}

function bindCanvasSelection(root, viewer) {
  const canvas = viewer?.renderer?.domElement;
  if (!canvas || canvas.dataset.rvmCanvasSelectionBridge === BRIDGE_VERSION) return;
  canvas.dataset.rvmCanvasSelectionBridge = BRIDGE_VERSION;
  let down = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY, time: performanceNow() };
  }, true);

  canvas.addEventListener('pointerup', (event) => {
    if (event.button !== 0 || !down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const elapsed = performanceNow() - down.time;
    down = null;
    if (moved > CLICK_DRAG_TOLERANCE_PX || elapsed > 800) return;
    if (viewer.measureModeEnabled || viewer.marqueeModeEnabled) return;
    const selected = selectGeometryAtClientPoint(root, viewer, event.clientX, event.clientY, { additive: event.ctrlKey || event.shiftKey || event.metaKey });
    if (selected) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);
}

function selectGeometryAtClientPoint(root, viewer, clientX, clientY, options = {}) {
  if (!viewer?.camera || !viewer?.modelGroup || !viewer?.renderer?.domElement) return null;
  const rect = viewer.renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = viewer._rvmCanvasRaycaster || (viewer._rvmCanvasRaycaster = new THREE.Raycaster());
  raycaster.params.Line = { threshold: 2 };
  raycaster.params.Points = { threshold: 2 };
  raycaster.setFromCamera(mouse, viewer.camera);
  const hits = raycaster.intersectObject(viewer.modelGroup, true);
  const hit = hits.find((item) => item?.object?.visible !== false && isPickableMesh(item.object));
  if (!hit) {
    if (!options.additive) clearCanvasSelection(viewer, root);
    return null;
  }
  const pickRoot = resolvePickRoot(hit.object);
  const meshes = collectPickMeshes(pickRoot || hit.object);
  const id = stableObjectId(pickRoot || hit.object);
  if (!id || !meshes.length) return null;

  if (!options.additive) clearCanvasSelection(viewer, root);
  highlightMeshes(viewer, meshes);
  writeSelectionState(viewer, id, meshes);
  renderCanvasSelectionDetails(root, viewer, pickRoot || hit.object, meshes, hit.point);
  updateSelectedCount(root, meshes.length);
  return { id, object: pickRoot || hit.object, meshes, point: hit.point };
}

function isPickableMesh(obj) {
  return Boolean(obj?.isMesh && obj.visible !== false && obj.userData?.supportSymbol !== true);
}

function resolvePickRoot(obj) {
  let current = obj;
  let best = obj;
  while (current && current.parent) {
    if (current.userData?.browserRvmProperties || current.userData?.sourcePath || current.userData?.displayName || current.userData?.pickable) best = current;
    if (current.parent?.userData?.browserRvmProperties || current.parent?.userData?.sourcePath || current.parent?.userData?.displayName || current.parent?.userData?.pickable) best = current.parent;
    if (current.parent?.type === 'Scene') break;
    current = current.parent;
  }
  return best || obj;
}

function collectPickMeshes(root) {
  const meshes = [];
  root?.traverse?.((obj) => { if (isPickableMesh(obj)) meshes.push(obj); });
  if (!meshes.length && isPickableMesh(root)) meshes.push(root);
  return meshes;
}

function stableObjectId(obj) {
  const data = obj?.userData || {};
  return String(data.sourcePath || data.displayName || data.sourceName || data.browserRvmProperties?.sourcePath || data.browserRvmProperties?.displayName || obj?.name || obj?.uuid || '').trim();
}

function clearCanvasSelection(viewer, root = null) {
  const selected = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes : [];
  for (const mesh of selected) restoreMeshMaterial(mesh);
  viewer._rvmCanvasSelectedMeshes = [];
  try { viewer.selection?.clearSelection?.(); } catch (_) {}
  if (root) updateSelectedCount(root, 0);
}

function highlightMeshes(viewer, meshes = []) {
  viewer._rvmCanvasSelectedMeshes = Array.from(new Set([...(viewer._rvmCanvasSelectedMeshes || []), ...meshes]));
  for (const mesh of meshes) applySelectedMaterial(mesh);
}

function applySelectedMaterial(mesh) {
  if (!mesh?.material || mesh.userData?.rvmCanvasSelectionHighlighted) return;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.userData.rvmCanvasSelectionOriginalMaterial = mesh.material;
  const cloned = materials.map((mat) => {
    const copy = mat?.clone ? mat.clone() : mat;
    if (copy?.emissive) copy.emissive.setHex(0x2563eb);
    if (copy?.color) copy.color.lerp(new THREE.Color(0x60a5fa), 0.45);
    if (copy) copy.needsUpdate = true;
    return copy;
  });
  mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  mesh.userData.rvmCanvasSelectionHighlighted = true;
}

function restoreMeshMaterial(mesh) {
  if (!mesh?.userData?.rvmCanvasSelectionHighlighted) return;
  const current = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const original = mesh.userData.rvmCanvasSelectionOriginalMaterial;
  mesh.material = original || mesh.material;
  for (const mat of current) {
    const originalList = Array.isArray(original) ? original : [original];
    if (originalList.includes(mat)) continue;
    mat?.dispose?.();
  }
  delete mesh.userData.rvmCanvasSelectionHighlighted;
  delete mesh.userData.rvmCanvasSelectionOriginalMaterial;
}

function writeSelectionState(viewer, id, meshes) {
  try { viewer.selection?.clearSelection?.(); } catch (_) {}
  const ids = meshes.map((mesh) => mesh.userData?.name || mesh.name || mesh.uuid).filter(Boolean);
  if (viewer.selection) {
    viewer.selection._selectedCanonicalId = id;
    viewer.selection._selectedCanonicalIds = [id];
    viewer.selection._selectedRenderIds = ids;
    viewer.selection._emitSelection?.();
  }
}

function fitCurrentSelection(viewer) {
  const meshes = Array.isArray(viewer?._rvmCanvasSelectedMeshes) && viewer._rvmCanvasSelectedMeshes.length
    ? viewer._rvmCanvasSelectedMeshes
    : collectMeshesForSelectionAdapter(viewer);
  const box = boxForMeshes(meshes);
  if (!box || box.isEmpty()) return false;
  viewer._fitBox?.(box);
  return true;
}

function collectMeshesForSelectionAdapter(viewer) {
  const ids = new Set(viewer?.selection?.getSelectionRenderIds?.() || []);
  const meshes = [];
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!isPickableMesh(obj)) return;
    const id = obj.userData?.name || obj.name || obj.uuid;
    if (ids.has(id)) meshes.push(obj);
  });
  return meshes;
}

function fitAllRvm(viewer) {
  try {
    const bounds = viewer?._progressiveModelBounds || viewer?.modelGroup?.children?.[0]?.userData?.bounds || null;
    if (bounds && viewer?.fitProgressiveBounds?.(bounds, { force: true })) return true;
  } catch (_) {}
  viewer?.fitAll?.();
  return true;
}

function boxForMeshes(meshes = []) {
  const box = new THREE.Box3();
  let any = false;
  for (const mesh of meshes) {
    try {
      const itemBox = new THREE.Box3().setFromObject(mesh);
      if (itemBox && !itemBox.isEmpty()) { box.union(itemBox); any = true; }
    } catch (_) {}
  }
  return any ? box : null;
}

function renderCanvasSelectionDetails(root, viewer, object, meshes, point) {
  const panel = root?.querySelector?.('#rvm-attributes-panel');
  if (!panel) return;
  const data = object?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || props.attributes || data.attributes || {};
  const box = boxForMeshes(meshes);
  const size = box ? box.getSize(new THREE.Vector3()) : null;
  const rows = [
    ['Picked', props.displayName || data.displayName || object?.name || object?.uuid || '-'],
    ['Source path', props.sourcePath || data.sourcePath || '-'],
    ['Type', props.type || data.type || attrs.TYPE || '-'],
    ['Kind', props.kind || data.kind || attrs.RVM_PRIMITIVE_KIND || '-'],
    ['Render primitive', props.effectiveRenderPrimitive || data.effectiveRenderPrimitive || data.renderPrimitive || '-'],
    ['Matched meshes', meshes.length],
    ['Size', size ? `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}` : '-'],
    ['Pick point', point ? `${fmt(point.x)}, ${fmt(point.y)}, ${fmt(point.z)}` : '-'],
  ];
  const attrRows = Object.entries(attrs || {}).slice(0, 28).map(([key, value]) => [key, value]);
  panel.innerHTML = `
    <div class="rvm-canvas-selection-card">
      <div class="rvm-tree-selection-title">Canvas selection</div>
      <div class="rvm-tree-action-row">
        <button type="button" class="rvm-btn" data-rvm-canvas-action="fit-selection">Fit Selection</button>
        <button type="button" class="rvm-btn" data-rvm-canvas-action="clear-selection">Clear</button>
      </div>
      <div class="rvm-browser-diag-grid">${rows.map(([key, value]) => row(key, value)).join('')}</div>
      <div class="rvm-tree-selection-title">Attributes</div>
      <div class="rvm-browser-diag-grid">${attrRows.length ? attrRows.map(([key, value]) => row(key, value)).join('') : row('Attributes', 'No attributes on picked mesh')}</div>
    </div>`;
  panel.querySelector('[data-rvm-canvas-action="fit-selection"]')?.addEventListener('click', () => fitCurrentSelection(viewer));
  panel.querySelector('[data-rvm-canvas-action="clear-selection"]')?.addEventListener('click', () => {
    clearCanvasSelection(viewer, root);
    panel.innerHTML = '<div class="rvm-empty-state">No object selected.</div>';
  });
}

function updateSelectedCount(root, count) {
  const chip = root?.querySelector?.('[data-rvm-status-chip="selected"]');
  const footer = root?.querySelector?.('#rvm-sel-count');
  if (chip) chip.textContent = `Selected: ${count}`;
  if (footer) footer.textContent = String(count || 0);
}

function normalizeAction(action) { return String(action || '').trim().toUpperCase(); }
function performanceNow() { return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now(); }
function fmt(value) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(3) : '-'; }
function row(key, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(key)}</span><b>${escapeHtml(value === undefined || value === null || value === '' ? '-' : String(value))}</b></div>`; }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

function injectStyles() {
  if (document.getElementById('rvm-toolbar-canvas-selection-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-toolbar-canvas-selection-style';
  style.textContent = `
    .rvm-canvas-selection-card { display: grid; gap: 8px; }
    .rvm-tree-selection-title { color: #93c5fd; font-weight: 700; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
    .rvm-tree-action-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .rvm-tree-action-row .rvm-btn { padding: 4px 8px; font-size: 12px; }
  `;
  document.head.appendChild(style);
}
