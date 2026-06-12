function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

export function parseSelectedBranches(value) {
  if (Array.isArray(value)) return new Set(value.map(text).filter(Boolean));
  return new Set(text(value).split(',').map((item) => item.trim()).filter(Boolean));
}

function componentAliases(component) {
  return [
    component?.pipelineRef,
    component?.lineKey,
    component?.rawAttributes?.pipelineRef,
  ].map(text).filter(Boolean);
}

function componentSelected(component, selectedIds) {
  if (!selectedIds.size) return true;
  return componentAliases(component).some((alias) => selectedIds.has(alias));
}

function layerForComponent(component) {
  const type = upper(component?.normalizedType || component?.type);
  if (type.includes('VALVE')) return 'VALVES';
  if (type.includes('FLANGE') || type.includes('GASKET')) return 'FLANGES';
  return 'PIPING';
}

function point3(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const z = Number(point?.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

function isSupportComponent(component, segment) {
  const type = upper(component?.normalizedType || component?.type || segment?.type);
  return type.includes('SUPPORT') || upper(segment?.type) === 'SUPPORT_ASSOCIATION';
}

export function projectToDxfGeometry(doc, options = {}) {
  const selectedIds = parseSelectedBranches(options.selectedBranches);
  const components = new Map((doc.components || []).map((component) => [component.id, component]));
  const anchors = new Map((doc.anchors || []).map((anchor) => [anchor.id, anchor]));
  const segments = [];
  const supports = [];
  const diagnostics = [];

  for (const segment of doc.segments || []) {
    const component = components.get(segment.componentId);
    if (!component || !componentSelected(component, selectedIds)) continue;
    if (isSupportComponent(component, segment)) continue;

    const p1 = point3(anchors.get(segment.startAnchorId)?.point);
    const p2 = point3(anchors.get(segment.endAnchorId)?.point);

    if (!p1 || !p2) {
      diagnostics.push({
        type: 'inputxml-dxf-segment-missing-anchor',
        severity: 'WARN',
        componentId: segment.componentId,
        segmentId: segment.id,
      });
      continue;
    }

    segments.push({
      id: segment.id,
      componentId: segment.componentId,
      layer: layerForComponent(component),
      type: text(component.normalizedType || component.type || segment.type),
      label: text(component.name || component.refNo || component.seqNo || component.id),
      p1,
      p2,
      branchAliases: componentAliases(component),
    });
  }

  for (const support of doc.supports || []) {
    const component = components.get(support.componentId);
    if (component && !componentSelected(component, selectedIds)) continue;
    if (!component && selectedIds.size) continue;

    const point = point3(anchors.get(support.supportAnchorId)?.point);
    if (!point) {
      diagnostics.push({
        type: 'inputxml-dxf-support-missing-anchor',
        severity: 'WARN',
        supportId: support.id,
        componentId: support.componentId,
      });
      continue;
    }

    supports.push({
      id: support.id,
      componentId: support.componentId,
      layer: 'SUPPORTS',
      type: text(support.type || component?.type || 'SUPPORT'),
      label: text(component?.name || support.type || support.id),
      point,
      branchAliases: component ? componentAliases(component) : [],
    });
  }

  return { selectedBranchIds: [...selectedIds], segments, supports, diagnostics };
}
