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

export function layerIdsForTrace(trace = {}, extra = {}) {
  const entity = lower(trace.entity || extra.entity);
  const category = lower(trace.semanticCategory || trace.category || extra.category || 'other');
  const source = lower(trace.supportSource || trace.source || extra.source || 'generated');
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
  const category = lower(trace.semanticCategory || trace.category || extra.category || 'other');
  const source = lower(trace.supportSource || trace.source || extra.source || 'generated');
  const supportKind = normalizeSupportKind(trace.supportKind || trace.kind || extra.supportKind || extra.kind);
  return {
    schema: BM_CII_LAYER_SCHEMA,
    category,
    source,
    supportKind,
    axis: upper(trace.axis || trace.direction || trace.restraintAxis || extra.axis || extra.direction || ''),
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

export function buildDefaultBmCiiLayerManifest({ supportSource = '', includeIsonote = true, includeInputXml = true } = {}) {
  const selectedSource = lower(supportSource);
  const layers = [
    ['plant.pipe', 'Pipe', 'Plant Geometry', true],
    ['plant.bend', 'Bends / Elbows', 'Plant Geometry', true],
    ['plant.valve', 'Valves', 'Plant Geometry', true],
    ['plant.flange', 'Flanges', 'Plant Geometry', true],
    ['plant.tee_olet', 'Tee / Olet', 'Plant Geometry', true],
    ['plant.other', 'Other Plant Geometry', 'Plant Geometry', true],
    ['plant.axis', 'Axis / Triad', 'Plant Geometry', true],
    ['plant.restraints', 'All Restraints', 'Supports / Restraints', true],
    ['restraints.inputxml', 'InputXML Restraints', 'Supports / Restraints', includeInputXml && selectedSource !== 'isonote'],
    ['restraints.isonote', 'ISONOTE Restraints', 'Supports / Restraints', includeIsonote && selectedSource === 'isonote'],
    ['restraints.rest', 'REST', 'Supports / Restraints', true],
    ['restraints.guide', 'GUIDE', 'Supports / Restraints', true],
    ['restraints.linestop', 'LINESTOP', 'Supports / Restraints', true],
    ['restraints.limit', 'LIMIT', 'Supports / Restraints', true],
    ['restraints.anchor', 'ANCHOR', 'Supports / Restraints', true],
    ['restraints.hanger', 'HANGER', 'Supports / Restraints', true],
    ['restraints.spring', 'SPRING', 'Supports / Restraints', true],
    ['restraints.unknown', 'UNKNOWN / TYPE0', 'Supports / Restraints', true],
    ['axis.x', 'X-axis Restraints', 'Supports / Restraints', true],
    ['axis.y', 'Y-axis Restraints', 'Supports / Restraints', true],
    ['axis.z', 'Z-axis Restraints', 'Supports / Restraints', true],
    ['annotation.all', 'All Annotations', 'Annotations', true],
    ['annotation.callout', 'Callouts', 'Annotations', true],
    ['annotation.isonote', 'ISONOTE Callouts', 'Annotations', true],
    ['debug.qc', 'QC / Debug', 'Debug', false],
  ].map(([id, label, group, defaultVisible]) => ({ id, label, group, defaultVisible }));

  return {
    schema: BM_CII_LAYER_MANIFEST_SCHEMA,
    supportSource: selectedSource,
    layers,
  };
}
