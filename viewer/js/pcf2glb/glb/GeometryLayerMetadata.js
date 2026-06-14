export const BM_CII_LAYER_SCHEMA = 'bm-cii-layer/v1';
export const BM_CII_LAYER_MANIFEST_SCHEMA = 'bm-cii-layer-manifest/v1';

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function lower(value) {
  return text(value).toLowerCase();
}

function cleanLayerId(value) {
  return lower(value)
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function unique(values) {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function axisLayer(axis) {
  const raw = upper(axis);
  if (raw === 'X' || raw.includes('DX') || raw.includes('+X') || raw.includes('-X')) return 'axis.x';
  if (raw === 'Y' || raw.includes('DY') || raw.includes('+Y') || raw.includes('-Y')) return 'axis.y';
  if (raw === 'Z' || raw.includes('DZ') || raw.includes('+Z') || raw.includes('-Z')) return 'axis.z';
  return '';
}

export function normalizeSupportKind(value) {
  const raw = upper(value).replace(/[\s-]+/g, '_');
  if (!raw) return '';
  if (raw.includes('LINESTOP') || raw.includes('LINE_STOP') || raw.includes('LIMIT_STOP')) return 'LINESTOP';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('ANCHOR') || raw === 'ANC') return 'ANCHOR';
  if (raw.includes('HANGER')) return 'HANGER';
  if (raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('REST') || raw.includes('SUPPORT') || raw.includes('SHOE')) return 'REST';
  if (raw.includes('TYPE0') || raw === '0' || raw.includes('UNKNOWN')) return 'UNKNOWN';
  return raw;
}

function categoryFromTrace(trace = {}, extra = {}) {
  return lower(trace.semanticCategory || trace.category || extra.category || 'other');
}

function sourceForLayer(trace = {}, extra = {}) {
  const entity = lower(trace.entity || extra.entity);
  const category = categoryFromTrace(trace, extra);

  if (entity === 'annotation' || category === 'annotation') {
    return lower(trace.source || extra.source || 'isonote');
  }

  if (category === 'support') {
    return lower(trace.supportSource || trace.source || extra.source || 'generated');
  }

  // Plant geometry in the InputXML pipeline originates from InputXML, even when the
  // selected restraint source is ISONOTE. Do not let supportSource leak into pipe,
  // valve, flange, bend, or tee/olet layers.
  return lower(trace.source || trace.componentSource || extra.source || 'inputxml');
}

export function layerIdsForTrace(trace = {}, extra = {}) {
  const entity = lower(trace.entity || extra.entity);
  const category = categoryFromTrace(trace, extra);
  const source = sourceForLayer(trace, extra);
  const kind = normalizeSupportKind(trace.supportKind || trace.kind || extra.supportKind || extra.kind);
  const ids = [];

  if (entity === 'annotation' || category === 'annotation') {
    ids.push('annotation.all', 'annotation.callout');
    if (source) ids.push(`annotation.${cleanLayerId(source)}`);
    if (source) ids.push(`source.${cleanLayerId(source)}`);
    return unique(ids);
  }

  if (category === 'support') {
    ids.push('plant.restraints');
    ids.push(source === 'isonote' ? 'restraints.isonote' : source === 'inputxml' ? 'restraints.inputxml' : `restraints.${cleanLayerId(source || 'generated')}`);
    if (source) ids.push(`source.${cleanLayerId(source)}`);
    if (kind) ids.push(`restraints.${cleanLayerId(kind)}`);
    const axis = axisLayer(trace.axis || trace.direction || trace.restraintAxis || extra.axis || extra.direction);
    if (axis) ids.push(axis);
    return unique(ids);
  }

  if (category === 'pipe') ids.push('plant.pipe');
  else if (category === 'bend') ids.push('plant.bend');
  else if (category === 'valve') ids.push('plant.valve');
  else if (category === 'flange') ids.push('plant.flange');
  else if (category === 'teeolet' || category === 'tee_olet') ids.push('plant.tee_olet');
  else if (category === 'axis') ids.push('plant.axis');
  else ids.push('plant.other');

  if (source) ids.push(`source.${cleanLayerId(source)}`);
  return unique(ids);
}

export function layerMetadataFromTrace(trace = {}, extra = {}) {
  const category = categoryFromTrace(trace, extra);
  const source = sourceForLayer(trace, extra);
  const supportKind = normalizeSupportKind(trace.supportKind || trace.kind || extra.supportKind || extra.kind);
  return {
    schema: BM_CII_LAYER_SCHEMA,
    category,
    source,
    supportKind,
    axis: upper(trace.axis || trace.direction || trace.restraintAxis || extra.axis || extra.direction || ''),
    gap: text(trace.gap || trace.restraintGap || extra.gap || ''),
    visibleDefault: extra.visibleDefault !== false,
    layerIds: layerIdsForTrace(trace, extra),
  };
}

export function withGeometryLayer(userData = {}, trace = {}, extra = {}) {
  const layer = layerMetadataFromTrace(trace, extra);
  return {
    ...(userData || {}),
    bmCiiLayerSchema: BM_CII_LAYER_SCHEMA,
    bmCiiLayer: layer,
    bmCiiLayerIds: layer.layerIds,
    bmCiiLayerCategory: layer.category,
    bmCiiLayerSource: layer.source,
  };
}

export function applyGeometryLayer(object, trace = {}, extra = {}, { includeChildren = true } = {}) {
  if (!object) return object;
  const apply = (target) => {
    target.userData = withGeometryLayer(target.userData || {}, trace, extra);
  };
  apply(object);
  if (includeChildren && object.traverse) object.traverse((child) => apply(child));
  return object;
}

function layer(id, label, group, defaultVisible = true) {
  return { id, label, group, defaultVisible };
}

export function buildDefaultBmCiiLayerManifest({ supportSource = '' } = {}) {
  const selectedSupportSource = lower(supportSource);
  return {
    schema: BM_CII_LAYER_MANIFEST_SCHEMA,
    layers: [
      layer('plant.pipe', 'Pipe', 'Plant Geometry'),
      layer('plant.bend', 'Bends', 'Plant Geometry'),
      layer('plant.valve', 'Valves', 'Plant Geometry'),
      layer('plant.flange', 'Flanges', 'Plant Geometry'),
      layer('plant.tee_olet', 'Tee / Olet', 'Plant Geometry'),
      layer('plant.restraints', 'Restraints', 'Supports / Restraints'),
      layer('plant.axis', 'Axis / Triad', 'Plant Geometry'),
      layer('plant.other', 'Other Geometry', 'Plant Geometry'),

      layer('restraints.inputxml', 'InputXML Restraints', 'Supports / Restraints', selectedSupportSource !== 'isonote'),
      layer('restraints.isonote', 'ISONOTE Restraints', 'Supports / Restraints', selectedSupportSource === 'isonote'),
      layer('restraints.rest', 'REST', 'Supports / Restraints'),
      layer('restraints.guide', 'GUIDE', 'Supports / Restraints'),
      layer('restraints.linestop', 'LINESTOP', 'Supports / Restraints'),
      layer('restraints.limit', 'LIMIT', 'Supports / Restraints'),
      layer('restraints.anchor', 'ANCHOR', 'Supports / Restraints'),
      layer('restraints.hanger', 'HANGER', 'Supports / Restraints'),
      layer('restraints.spring', 'SPRING', 'Supports / Restraints'),
      layer('restraints.unknown', 'UNKNOWN / TYPE0', 'Supports / Restraints'),

      layer('axis.x', 'X Axis', 'Direction / Axis'),
      layer('axis.y', 'Y Axis', 'Direction / Axis'),
      layer('axis.z', 'Z Axis', 'Direction / Axis'),

      layer('annotation.all', 'Annotations', 'Annotations'),
      layer('annotation.callout', 'Callouts', 'Annotations'),
      layer('annotation.isonote', 'ISONOTE Callouts', 'Annotations'),

      layer('source.inputxml', 'Source: InputXML', 'Source'),
      layer('source.isonote', 'Source: ISONOTE', 'Source'),
      layer('source.generated', 'Source: Generated', 'Source'),
      layer('debug.qc', 'QC / Debug', 'Debug / QC', false),
    ],
  };
}
