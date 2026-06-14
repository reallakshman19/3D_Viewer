function userDataOf(object) {
  return object?.userData || {};
}

export function layerIdsOf(object) {
  const data = userDataOf(object);
  const ids = data.bmCiiLayer?.layerIds || data.bmCiiLayerIds || data.extras?.bmCiiLayer?.layerIds || [];
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

export function layerManifestOf(gltfOrScene) {
  const scene = gltfOrScene?.scene || gltfOrScene;
  const candidates = [scene, ...(scene?.children || [])];
  for (const candidate of candidates) {
    const manifest = candidate?.userData?.bmCiiLayerManifest || candidate?.userData?.extras?.bmCiiLayerManifest;
    if (manifest?.layers?.length) return manifest;
  }
  return { schema: 'bm-cii-layer-manifest/generated-v1', layers: [] };
}

export function collectLayerRegistry(scene) {
  const registry = new Map();
  scene?.traverse?.((object) => {
    for (const layerId of layerIdsOf(object)) {
      if (!registry.has(layerId)) registry.set(layerId, []);
      registry.get(layerId).push(object);
    }
  });
  return registry;
}

export function createLayerStateFromManifest(manifest = {}) {
  const state = {};
  for (const layer of manifest.layers || []) {
    state[layer.id] = layer.defaultVisible !== false;
  }
  return state;
}

export function isObjectVisibleByLayerState(object, state = {}) {
  const ids = new Set(layerIdsOf(object));
  if (ids.size === 0) return true;

  // Group AND semantics for restraints: semantic + source + subtype can be filtered independently.
  if (ids.has('plant.restraints')) {
    if (state['plant.restraints'] === false) return false;
    if (ids.has('restraints.inputxml') && state['restraints.inputxml'] === false) return false;
    if (ids.has('restraints.isonote') && state['restraints.isonote'] === false) return false;
    for (const id of ids) {
      if (id.startsWith('restraints.') && id !== 'restraints.inputxml' && id !== 'restraints.isonote' && state[id] === false) return false;
      if (id.startsWith('axis.') && state[id] === false) return false;
    }
    return true;
  }

  if (ids.has('annotation.all')) {
    if (state['annotation.all'] === false) return false;
    for (const id of ids) {
      if (id.startsWith('annotation.') && id !== 'annotation.all' && state[id] === false) return false;
    }
    return true;
  }

  for (const id of ids) {
    if (state[id] === false) return false;
  }
  return true;
}

export function applyLayerState(scene, state = {}) {
  scene?.traverse?.((object) => {
    if (!object.isMesh && object.type !== 'Group') return;
    object.visible = isObjectVisibleByLayerState(object, state);
  });
}

export function buildLayerPanelHtml(manifest = {}) {
  const byGroup = new Map();
  for (const layer of manifest.layers || []) {
    const group = layer.group || 'Layers';
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(layer);
  }

  let html = '<div class="bm-cii-layer-panel">';
  for (const [group, layers] of byGroup.entries()) {
    html += `<div class="bm-cii-layer-group"><div class="bm-cii-layer-group-title">${group}</div>`;
    for (const layer of layers) {
      const checked = layer.defaultVisible === false ? '' : ' checked';
      html += `<label class="bm-cii-layer-row"><input type="checkbox" data-layer-id="${layer.id}"${checked}> ${layer.label || layer.id}</label>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export function mountLayerPanel(container, scene, manifest = layerManifestOf(scene), { onChange } = {}) {
  if (!container) return null;
  const state = createLayerStateFromManifest(manifest);
  container.innerHTML = buildLayerPanelHtml(manifest);
  container.querySelectorAll('input[data-layer-id]').forEach((input) => {
    input.addEventListener('change', () => {
      state[input.dataset.layerId] = input.checked;
      applyLayerState(scene, state);
      onChange?.({ state, layerId: input.dataset.layerId, checked: input.checked });
    });
  });
  applyLayerState(scene, state);
  return { state, manifest, apply: () => applyLayerState(scene, state) };
}
