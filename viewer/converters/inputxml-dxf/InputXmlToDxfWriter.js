import { createDxfDocument, lineEntity, pointEntity, textEntity } from '../../vendor/dxf-lines.js';

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProjectionMode(value) {
  const mode = String(value || '3d').trim().toLowerCase();
  if (['top', 'xy', 'plan'].includes(mode)) return 'top';
  if (['elevation-xz', 'xz', 'front', 'elevation-e'].includes(mode)) return 'elevation-xz';
  if (['elevation-yz', 'yz', 'side', 'elevation-n'].includes(mode)) return 'elevation-yz';
  if (['iso', 'iso-2.5d', 'isometric'].includes(mode)) return 'iso-2.5d';
  return '3d';
}

function projectPoint(point, projectionMode) {
  if (projectionMode === 'top') {
    return { x: point.x, y: point.y, z: 0 };
  }
  if (projectionMode === 'elevation-xz') {
    return { x: point.x, y: point.z, z: 0 };
  }
  if (projectionMode === 'elevation-yz') {
    return { x: point.y, y: point.z, z: 0 };
  }
  if (projectionMode === 'iso-2.5d') {
    return {
      x: point.x - point.y,
      y: point.z + 0.5 * (point.x + point.y),
      z: 0,
    };
  }
  return { x: point.x, y: point.y, z: point.z };
}

function transformPoint(point, scale, projectionMode) {
  const projected = projectPoint(point, projectionMode);
  return { x: projected.x * scale, y: projected.y * scale, z: projected.z * scale };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function normalizeBranch(branch) {
  return {
    id: String(branch?.id || '').trim(),
    label: String(branch?.label || branch?.id || '').trim(),
    pipelineRef: String(branch?.pipelineRef || '').trim(),
    lineKey: String(branch?.lineKey || '').trim(),
    lineNo: String(branch?.lineNo || '').trim(),
    aliases: Array.isArray(branch?.aliases) ? branch.aliases.map((alias) => String(alias || '').trim()).filter(Boolean) : [],
    componentCount: Number.isFinite(Number(branch?.componentCount)) ? Number(branch.componentCount) : 0,
  };
}

function branchSelected(branch, selectedIds) {
  if (!selectedIds.length) return true;
  const aliases = [branch.id, branch.pipelineRef, branch.lineKey, branch.lineNo, ...(branch.aliases || [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return aliases.some((alias) => selectedIds.includes(alias));
}

function normType(value) {
  return String(value || '').toUpperCase();
}

function vector(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    return null;
  }
  return { dx: dx / length, dy: dy / length, dz: dz / length, length };
}

function symbolSize(length, textHeight) {
  const base = Math.max(numberOr(textHeight, 2.5) * 2, 1);
  const byLength = Number.isFinite(length) && length > 0 ? length * 0.08 : base;
  return Math.min(Math.max(base, byLength), base * 4);
}

function offset(point, axis, along, side) {
  return {
    x: point.x + axis.dx * along - axis.dy * side,
    y: point.y + axis.dy * along + axis.dx * side,
    z: point.z + axis.dz * along,
  };
}

function addValveSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight);
  const left = offset(c, axis, -size, 0);
  const right = offset(c, axis, size, 0);
  const top = offset(c, axis, 0, size);
  const bottom = offset(c, axis, 0, -size);

  entities.push(lineEntity(`${id}-valve-a`, left, top, 'VALVES'));
  entities.push(lineEntity(`${id}-valve-b`, top, right, 'VALVES'));
  entities.push(lineEntity(`${id}-valve-c`, right, bottom, 'VALVES'));
  entities.push(lineEntity(`${id}-valve-d`, bottom, left, 'VALVES'));
  return 4;
}

function addFlangeSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight);
  const gap = size * 0.35;
  const points = [offset(c, axis, -gap, 0), offset(c, axis, gap, 0)];

  for (const [index, point] of points.entries()) {
    entities.push(lineEntity(`${id}-flange-${index}`, offset(point, axis, 0, -size), offset(point, axis, 0, size), 'FLANGES'));
  }
  return 2;
}

function addSupportSymbol(entities, id, point, textHeight) {
  const size = Math.max(numberOr(textHeight, 2.5) * 2, 1);
  const top = point;
  const left = { x: point.x - size, y: point.y - size, z: point.z };
  const right = { x: point.x + size, y: point.y - size, z: point.z };
  const baseLeft = { x: point.x - size * 1.4, y: point.y - size * 1.35, z: point.z };
  const baseRight = { x: point.x + size * 1.4, y: point.y - size * 1.35, z: point.z };

  entities.push(lineEntity(`${id}-support-left`, top, left, 'SUPPORTS'));
  entities.push(lineEntity(`${id}-support-right`, top, right, 'SUPPORTS'));
  entities.push(lineEntity(`${id}-support-base`, baseLeft, baseRight, 'SUPPORTS'));
  return 3;
}

function addComponentSymbol(entities, segment, p1, p2, textHeight) {
  const id = segment.id || segment.componentId || 'segment';
  const type = normType(segment.type || segment.layer);
  if (segment.layer === 'VALVES' || type.includes('VALVE')) {
    return addValveSymbol(entities, id, p1, p2, textHeight);
  }
  if (segment.layer === 'FLANGES' || type.includes('FLANGE') || type.includes('GASKET')) {
    return addFlangeSymbol(entities, id, p1, p2, textHeight);
  }
  return 0;
}

export function writeInputXmlDxf({ segments = [], supports = [], branches = [], diagnostics = [] } = {}, options = {}) {
  const scale = Math.max(numberOr(options.dxfScale, 1), Number.EPSILON);
  const textHeight = numberOr(options.textHeight, 2.5);
  const showLabels = options.showLabels !== false;
  const showSymbols = options.showSymbols !== false;
  const projectionMode = normalizeProjectionMode(options.projectionMode || options.dxfProjectionMode || options.outputProjection);
  const selectedBranchIds = Array.isArray(options.selectedBranchIds) ? options.selectedBranchIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  const branchManifest = branches.map(normalizeBranch);
  const selectedBranches = branchManifest.filter((branch) => branchSelected(branch, selectedBranchIds));
  const entities = [];
  let symbolCount = 0;

  for (const segment of segments) {
    const p1 = transformPoint(segment.p1, scale, projectionMode);
    const p2 = transformPoint(segment.p2, scale, projectionMode);
    entities.push(lineEntity(segment.id || segment.componentId, p1, p2, segment.layer || 'PIPING'));
    if (showSymbols) {
      symbolCount += addComponentSymbol(entities, segment, p1, p2, textHeight);
    }
    if (showLabels && segment.label) {
      entities.push(textEntity(`${segment.id || segment.componentId}-label`, midpoint(p1, p2), segment.label, 'LABELS', textHeight));
    }
  }

  for (const support of supports) {
    const point = transformPoint(support.point, scale, projectionMode);
    entities.push(pointEntity(support.id || support.componentId, point, 'SUPPORTS'));
    if (showSymbols) {
      symbolCount += addSupportSymbol(entities, support.id || support.componentId || 'support', point, textHeight);
    }
    if (showLabels && support.label) {
      entities.push(textEntity(`${support.id || support.componentId}-label`, point, support.label, 'LABELS', textHeight));
    }
  }

  const layers = [...new Set(['PIPING', 'VALVES', 'FLANGES', 'SUPPORTS', 'LABELS', ...entities.map((tokens) => {
    const layerIndex = tokens.indexOf('8');
    return layerIndex >= 0 ? tokens[layerIndex + 1] : '';
  }).filter(Boolean)])];

  const selectedCount = selectedBranchIds.length ? selectedBranches.length : branchManifest.length;

  return {
    dxf: createDxfDocument({ layers, entities }),
    sidecar: {
      schema: 'inputxml-dxf-sidecar/v1',
      source: options.sourceName || '',
      projectionMode,
      branchCount: branchManifest.length,
      selectedBranchCount: selectedCount,
      selectedBranchIds,
      branches: branchManifest,
      selectedBranches,
      segmentCount: segments.length,
      supportCount: supports.length,
      symbolCount,
      layers,
      diagnostics,
    },
  };
}
