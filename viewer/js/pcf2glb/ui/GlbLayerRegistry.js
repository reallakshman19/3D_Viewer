function userDataOf(object) {
  return object?.userData || {};
}

function layerKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s/-]+/g, '.');
}

const BARE_PLANT_LAYER_ALIASES = new Map([
  ['pipe', 'plant.pipe'],
  ['pipes', 'plant.pipe'],
  ['bend', 'plant.bend'],
  ['bends', 'plant.bend'],
  ['elbow', 'plant.bend'],
  ['elbows', 'plant.bend'],
  ['pipe.trimmed.for.bend', 'plant.pipe_trimmed_for_bend'],
  ['pipe.trimmed.for.bends', 'plant.pipe_trimmed_for_bend'],
  ['pipe.trimmed.for.bend', 'plant.pipe_trimmed_for_bend'],
  ['pipe.trimmed', 'plant.pipe_trimmed_for_bend'],
  ['pipe_trimmed_for_bend', 'plant.pipe_trimmed_for_bend'],
  ['pipe.trimmed.for.bend', 'plant.pipe_trimmed_for_bend'],
  ['flange', 'plant.flange'],
  ['flanges', 'plant.flange'],
  ['flange.pair', 'plant.flange_pair'],
  ['flangepair', 'plant.flange_pair'],
  ['valve', 'plant.valve'],
  ['valves', 'plant.valve'],
  ['valve.flanged', 'plant.valve_flanged'],
  ['valveflanged', 'plant.valve_flanged'],
  ['rigid', 'plant.rigid'],
  ['rigids', 'plant.rigid'],
  ['rigid.unspecified', 'plant.rigid_unspecified'],
  ['rigidunspecified', 'plant.rigid_unspecified'],
  ['olet', 'plant.olet'],
  ['olets', 'plant.olet'],
  ['tee', 'plant.tee_olet'],
  ['tee.olet', 'plant.tee_olet'],
  ['teeolet', 'plant.tee_olet'],
  ['reducer', 'plant.reducer'],
  ['reducers', 'plant.reducer'],
  ['cap', 'plant.cap'],
  ['caps', 'plant.cap'],
  ['terminal', 'plant.cap'],
]);

const BARE_RESTRAINT_LAYER_ALIASES = new Map([
  ['restraints', 'plant.restraints'],
  ['support', 'plant.restraints'],
  ['supports', 'plant.restraints'],
  ['support.restraints', 'plant.restraints'],
  ['inputxml', 'restraints.inputxml'],
  ['input.xml', 'restraints.inputxml'],
  ['isonote', 'restraints.isonote'],
  ['iso.note', 'restraints.isonote'],
  ['rest', 'restraints.rest'],
  ['guide', 'restraints.guide'],
  ['line.stop', 'restraints.linestop'],
  ['linestop', 'restraints.linestop'],
  ['limit', 'restraints.limit'],
  ['spring', 'restraints.spring'],
  ['hanger', 'restraints.hanger'],
  ['anchor', 'restraints.anchor'],
  ['unknown', 'restraints.unknown'],
  ['unknown.type0', 'restraints.unknown'],
  ['type0', 'restraints.unknown'],
]);

function canonicalLayerId(rawId = '') {
  const id = String(rawId || '').trim();
  if (!id) return '';
  const key = layerKey(id);

  if (key.startsWith('plant.')) return key;
  if (key.startsWith('restraints.')) return key.replace('restraints.line.stop', 'restraints.linestop');
  if (key.startsWith('annotation.')) return key;
  if (key.startsWith('axis.')) return key;
  if (key.startsWith('source.')) return key;
  if (key.startsWith('debug.')) return key;

  if (BARE_PLANT_LAYER_ALIASES.has(key)) return BARE_PLANT_LAYER_ALIASES.get(key);
  if (BARE_RESTRAINT_LAYER_ALIASES.has(key)) return BARE_RESTRAINT_LAYER_ALIASES.get(key);

  return id;
}

function normalizeLayerIds(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  const seen = new Set();
  for (const rawId of ids) {
    const id = canonicalLayerId(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function layerIdsOf(object) {
  const data = userDataOf(object);
  const ids = data.bmCiiLayer?.layerIds || data.bmCiiLayerIds || data.extras?.bmCiiLayer?.layerIds || [];
  return normalizeLayerIds(ids);
}

function objectLayerMeta(object) {
  const data = userDataOf(object);
  return data.bmCiiLayer || data.extras?.bmCiiLayer || null;
}

function isAnnotationLayerId(id = '') {
  return String(id).startsWith('annotation.');
}

function isDebugLayerId(id = '') {
  return String(id).startsWith('debug.');
}

function normalizedDefaultVisible(layer = {}) {
  const id = canonicalLayerId(layer.id || '');
  if (!id) return false;

  // Native Basic GLB-PCF default review mode must match direct GLB viewing:
  // plant geometry ON, support/annotation/debug layers OFF until explicitly enabled.
  if (id === 'plant.restraints') return false;
  if (id.startsWith('restraints.')) return false;
  if (id === 'plant.annotations') return false;
  if (isAnnotationLayerId(id)) return false;
  if (isDebugLayerId(id)) return false;
  return layer.defaultVisible !== false;
}

function normalizeManifestLayer(layer = {}) {
  const id = canonicalLayerId(layer.id || '');
  if (!id) return null;
  return {
    ...layer,
    id,
    label: labelFromLayerId(id),
    // Always derive the group from the layer id for known BM_CII layers. Older
    // generated GLBs sometimes stamped plant geometry with the support group,
    // which made Pipe/Bend/Valve/Flange appear under Supports / Restraints.
    group: groupFromLayerId(id, layer.group),
    defaultVisible: normalizedDefaultVisible({ ...layer, id }),
  };
}

export function normalizeLayerManifest(manifest = {}) {
  const seen = new Set();
  const layers = [];
  for (const rawLayer of manifest.layers || []) {
    const layer = normalizeManifestLayer(rawLayer);
    if (!layer || seen.has(layer.id)) continue;
    seen.add(layer.id);
    layers.push(layer);
  }
  return {
    ...manifest,
    schema: manifest.schema || 'bm-cii-layer-manifest/normalized-v2-canonical',
    layers,
  };
}

export function layerManifestOf(gltfOrScene) {
  const scene = gltfOrScene?.scene || gltfOrScene;
  const candidates = [scene, ...(scene?.children || [])];
  for (const candidate of candidates) {
    const manifest = candidate?.userData?.bmCiiLayerManifest || candidate?.userData?.extras?.bmCiiLayerManifest;
    if (manifest?.layers?.length) return normalizeLayerManifest(manifest);
  }

  // Fallback: build a manifest from layer IDs stamped directly on mesh nodes.
  const ids = new Set();
  scene?.traverse?.((object) => {
    for (const id of layerIdsOf(object)) ids.add(id);
  });
  if (ids.size > 0) {
    return normalizeLayerManifest({
      schema: 'bm-cii-layer-manifest/generated-from-node-layers-v2-canonical',
      layers: Array.from(ids).sort().map((id) => ({
        id,
        label: labelFromLayerId(id),
        group: groupFromLayerId(id),
        defaultVisible: normalizedDefaultVisible({ id }),
      })),
    });
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
  for (const layer of normalizeLayerManifest(manifest).layers || []) {
    state[layer.id] = layer.defaultVisible !== false;
  }
  return state;
}

function hasAny(ids, predicate) {
  for (const id of ids) if (predicate(id)) return true;
  return false;
}

function hasLayer(ids, id) {
  return ids.has(id);
}

function isRestraintObject(ids, meta = {}) {
  return hasLayer(ids, 'plant.restraints')
    || hasAny(ids, (id) => id.startsWith('restraints.'))
    || meta.category === 'support';
}

function isAnnotationObject(ids, meta = {}) {
  return hasLayer(ids, 'plant.annotations')
    || hasLayer(ids, 'annotation.all')
    || hasAny(ids, (id) => id.startsWith('annotation.'))
    || meta.category === 'annotation';
}

export function isObjectVisibleByLayerState(object, state = {}) {
  const ids = new Set(layerIdsOf(object));
  const meta = objectLayerMeta(object) || {};
  if (ids.size === 0) return true;

  // Strict AND semantics for restraints. The parent semantic layer controls all
  // restraint sublayers even if a generated GLB forgot to include plant.restraints
  // on an individual support mesh.
  if (isRestraintObject(ids, meta)) {
    if (state['plant.restraints'] !== true) return false;

    const hasInputXml = hasLayer(ids, 'restraints.inputxml') || meta.source === 'inputxml';
    const hasIsonote = hasLayer(ids, 'restraints.isonote') || meta.source === 'isonote';
    if (hasInputXml && state['restraints.inputxml'] !== true) return false;
    if (hasIsonote && state['restraints.isonote'] !== true) return false;

    const subtypeLayers = Array.from(ids).filter((id) => (
      id.startsWith('restraints.')
      && id !== 'restraints.inputxml'
      && id !== 'restraints.isonote'
    ));
    for (const id of subtypeLayers) if (state[id] !== true) return false;

    const axisLayers = Array.from(ids).filter((id) => id.startsWith('axis.'));
    for (const id of axisLayers) if (state[id] !== true) return false;

    return true;
  }

  // Strict AND semantics for annotations. In visual-recovery mode annotations are
  // default-off in the normalized manifest, but when enabled the sublayers are
  // still independent and predictable.
  if (isAnnotationObject(ids, meta)) {
    if (state['plant.annotations'] !== true) return false;
    if (state['annotation.all'] !== true) return false;
    for (const id of ids) {
      if (id.startsWith('annotation.') && id !== 'annotation.all' && state[id] !== true) return false;
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

export function labelFromLayerId(id = '') {
  const value = canonicalLayerId(id);
  if (value === 'plant.pipe_trimmed_for_bend') return 'Pipe Trimmed For Bend';
  if (value === 'plant.flange_pair') return 'Flange Pair';
  if (value === 'plant.valve_flanged') return 'Valve Flanged';
  if (value === 'plant.rigid_unspecified') return 'Rigid Unspecified';
  if (value === 'plant.tee_olet') return 'Tee / Olet';
  if (value === 'restraints.inputxml') return 'InputXML';
  if (value === 'restraints.isonote') return 'ISONOTE';
  if (value === 'restraints.linestop') return 'LINESTOP';
  const tail = String(value).split('.').pop() || value;
  return tail
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace('Inputxml', 'InputXML')
    .replace('Isonote', 'ISONOTE')
    .replace('Linestop', 'LINESTOP')
    .replace('Tee Olet', 'Tee / Olet');
}

export function groupFromLayerId(id = '', fallback = 'Layers') {
  const value = canonicalLayerId(id);
  if (value === 'plant.restraints') return 'Supports / Restraints';
  if (value === 'plant.annotations') return 'Annotations';
  if (value.startsWith('plant.')) return 'Plant Geometry';
  if (value.startsWith('restraints.')) return 'Supports / Restraints';
  if (value.startsWith('annotation.')) return 'Annotations';
  if (value.startsWith('axis.')) return 'Direction / Axis';
  if (value.startsWith('source.')) return 'Source';
  if (value.startsWith('debug.')) return 'Debug / QC';
  return fallback || 'Layers';
}

function groupWeight(group = '') {
  const order = [
    'Plant Geometry',
    'Supports / Restraints',
    'Annotations',
    'Direction / Axis',
    'Source',
    'Debug / QC',
    'Layers',
  ];
  const idx = order.indexOf(group);
  return idx >= 0 ? idx : order.length + String(group).localeCompare('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sortGroupLayers(groupLayers = []) {
  const order = [
    'plant.pipe', 'plant.bend', 'plant.pipe_trimmed_for_bend', 'plant.valve', 'plant.valve_flanged', 'plant.flange', 'plant.flange_pair', 'plant.tee_olet', 'plant.rigid', 'plant.rigid_unspecified', 'plant.olet', 'plant.reducer', 'plant.cap', 'plant.other',
    'plant.restraints', 'restraints.inputxml', 'restraints.isonote', 'restraints.rest', 'restraints.guide', 'restraints.linestop', 'restraints.limit', 'restraints.anchor', 'restraints.hanger', 'restraints.spring', 'restraints.unknown',
    'plant.annotations', 'annotation.all', 'annotation.callout', 'annotation.node_labels', 'annotation.isonote',
    'axis.x', 'axis.y', 'axis.z',
  ];
  const weight = (id) => {
    const canonical = canonicalLayerId(id);
    const idx = order.indexOf(canonical);
    return idx >= 0 ? idx : order.length + String(canonical).localeCompare('');
  };
  return [...groupLayers].sort((a, b) => weight(a.id) - weight(b.id));
}

export function buildLayerPanelHtml(manifest = {}) {
  const layers = normalizeLayerManifest(manifest).layers || [];
  if (!layers.length) {
    return `
      <div class="bm-cii-layer-panel" style="padding:12px; border-radius:14px; background:rgba(19,34,53,0.92); color:#d8ecff; border:1px solid rgba(119,196,255,0.18); box-shadow:0 10px 26px rgba(0,0,0,0.22);">
        <div style="font-weight:800; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#9fd4ff; margin-bottom:6px;">Layers</div>
        <div style="font-size:11px; line-height:1.45; color:#b7c9dc;">No <code>bmCiiLayer</code> metadata found. All objects remain visible.</div>
      </div>`;
  }

  const byGroup = new Map();
  for (const layer of layers) {
    const group = groupFromLayerId(layer.id, layer.group || 'Layers');
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(layer);
  }

  let html = `
    <div class="bm-cii-layer-panel" style="padding:12px; border-radius:14px; background:rgba(19,34,53,0.94); color:#e8f3ff; border:1px solid rgba(119,196,255,0.18); box-shadow:0 10px 26px rgba(0,0,0,0.24);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
        <div style="font-weight:800; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#9fd4ff;">Layers</div>
        <button type="button" data-layer-action="all" style="font-size:10px; padding:3px 7px; border-radius:8px; border:1px solid rgba(159,212,255,.32); background:rgba(31,53,81,.8); color:#d8ecff; cursor:pointer;">All</button>
      </div>`;
  const orderedGroups = [...byGroup.entries()].sort(([a], [b]) => groupWeight(a) - groupWeight(b));
  for (const [group, groupLayers] of orderedGroups) {
    html += `<div class="bm-cii-layer-group" style="margin:10px 0 8px;"><div class="bm-cii-layer-group-title" style="font-size:10px; text-transform:uppercase; letter-spacing:.10em; color:#90acd0; margin-bottom:5px;">${escapeHtml(group)}</div>`;
    for (const layer of sortGroupLayers(groupLayers)) {
      const checked = layer.defaultVisible === false ? '' : ' checked';
      html += `<label class="bm-cii-layer-row" style="display:flex; align-items:center; gap:7px; font-size:11px; line-height:1.35; margin:4px 0; cursor:pointer;"><input type="checkbox" data-layer-id="${escapeHtml(layer.id)}"${checked} style="accent-color:#4a9eff;"> <span>${escapeHtml(layer.label || labelFromLayerId(layer.id))}</span></label>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export function mountLayerPanel(container, scene, manifest = layerManifestOf(scene), { onChange } = {}) {
  if (!container) return null;
  const normalizedManifest = normalizeLayerManifest(manifest);
  const state = createLayerStateFromManifest(normalizedManifest);
  container.innerHTML = buildLayerPanelHtml(normalizedManifest);
  container.style.display = 'block';

  const apply = () => applyLayerState(scene, state);
  container.querySelectorAll('input[data-layer-id]').forEach((input) => {
    input.addEventListener('change', () => {
      state[input.dataset.layerId] = input.checked;
      apply();
      onChange?.({ layerId: input.dataset.layerId, checked: input.checked, state: { ...state } });
    });
  });

  const allBtn = container.querySelector('[data-layer-action="all"]');
  allBtn?.addEventListener('click', () => {
    const inputs = Array.from(container.querySelectorAll('input[data-layer-id]'));
    const next = inputs.some((input) => !input.checked);
    inputs.forEach((input) => {
      input.checked = next;
      state[input.dataset.layerId] = next;
    });
    apply();
    onChange?.({ layerId: '*', checked: next, state: { ...state } });
  });

  apply();
  return { state, apply, manifest: normalizedManifest };
}
