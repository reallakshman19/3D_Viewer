import { createDxfDocument, lineEntity, pointEntity, textEntity } from '../../vendor/dxf-lines.js';

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOutputMode(value) {
  const mode = String(value || 'iso-drawing').trim().toLowerCase();
  if (['geometry', 'raw', 'model', 'model-geometry'].includes(mode)) return 'geometry';
  return 'iso-drawing';
}

function normalizeProjectionMode(value) {
  const mode = String(value || '3d').trim().toLowerCase();
  if (['top', 'xy', 'plan'].includes(mode)) return 'top';
  if (['elevation-xz', 'xz', 'front', 'elevation-e'].includes(mode)) return 'elevation-xz';
  if (['elevation-yz', 'yz', 'side', 'elevation-n'].includes(mode)) return 'elevation-yz';
  if (['iso', 'iso-2.5d', 'isometric'].includes(mode)) return 'iso-2.5d';
  return '3d';
}

function resolveProjectionMode(options, outputMode) {
  const explicit = options.projectionMode ?? options.dxfProjectionMode ?? options.outputProjection;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    return normalizeProjectionMode(explicit);
  }
  return outputMode === 'iso-drawing' ? 'iso-2.5d' : '3d';
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

function projectScaledPoint(point, scale, projectionMode) {
  const projected = projectPoint(point, projectionMode);
  return { x: projected.x * scale, y: projected.y * scale, z: projected.z * scale };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function emptyExtents() {
  return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, width: 0, height: 0, depth: 0 };
}

function pointExtents(points) {
  const finite = (points || []).filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  if (!finite.length) return emptyExtents();
  const xs = finite.map((point) => point.x);
  const ys = finite.map((point) => point.y);
  const zs = finite.map((point) => point.z);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const minZ = Math.min(...zs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const maxZ = Math.max(...zs);
  return {
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
    width: maxX - minX,
    height: maxY - minY,
    depth: maxZ - minZ,
  };
}

function createPaperTransform(points, outputMode, options) {
  const before = pointExtents(points);
  if (outputMode !== 'iso-drawing') {
    return {
      fitScale: 1,
      sheet: null,
      extentsBefore: before,
      extentsAfter: before,
      apply: (point) => ({ x: point.x, y: point.y, z: point.z }),
    };
  }

  const sheetWidth = Math.max(numberOr(options.sheetWidth || options.dxfSheetWidth, 420), 10);
  const sheetHeight = Math.max(numberOr(options.sheetHeight || options.dxfSheetHeight, 297), 10);
  const margin = Math.max(numberOr(options.sheetMargin || options.dxfSheetMargin, 15), 0);
  const availableWidth = Math.max(sheetWidth - margin * 2, 1);
  const availableHeight = Math.max(sheetHeight - margin * 2, 1);
  const sourceWidth = Math.max(before.width, 1);
  const sourceHeight = Math.max(before.height, 1);
  const fitScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const safeFit = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;

  const apply = (point) => ({
    x: (point.x - before.minX) * safeFit + margin,
    y: sheetHeight - margin - (point.y - before.minY) * safeFit,
    z: 0,
  });
  const extentsAfter = pointExtents(points.map(apply));

  return {
    fitScale: safeFit,
    sheet: { width: sheetWidth, height: sheetHeight, margin },
    extentsBefore: before,
    extentsAfter,
    apply,
  };
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
  const outputMode = normalizeOutputMode(options.outputMode || options.dxfOutputMode);
  const projectionMode = resolveProjectionMode(options, outputMode);
  const selectedBranchIds = Array.isArray(options.selectedBranchIds) ? options.selectedBranchIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  const branchManifest = branches.map(normalizeBranch);
  const selectedBranches = branchManifest.filter((branch) => branchSelected(branch, selectedBranchIds));
  const baseSegmentPoints = segments.flatMap((segment) => [
    projectScaledPoint(segment.p1, scale, projectionMode),
    projectScaledPoint(segment.p2, scale, projectionMode),
  ]);
  const baseSupportPoints = supports.map((support) => projectScaledPoint(support.point, scale, projectionMode));
  const paper = createPaperTransform([...baseSegmentPoints, ...baseSupportPoints], outputMode, options);
  const entities = [];
  let symbolCount = 0;

  for (const segment of segments) {
    const p1 = paper.apply(projectScaledPoint(segment.p1, scale, projectionMode));
    const p2 = paper.apply(projectScaledPoint(segment.p2, scale, projectionMode));
    entities.push(lineEntity(segment.id || segment.componentId, p1, p2, segment.layer || 'PIPING'));
    if (showSymbols) {
      symbolCount += addComponentSymbol(entities, segment, p1, p2, textHeight);
    }
    if (showLabels && segment.label) {
      entities.push(textEntity(`${segment.id || segment.componentId}-label`, midpoint(p1, p2), segment.label, 'LABELS', textHeight));
    }
  }

  for (const support of supports) {
    const point = paper.apply(projectScaledPoint(support.point, scale, projectionMode));
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
      outputMode,
      projectionMode,
      drawing: {
        sheet: paper.sheet,
        fitScale: paper.fitScale,
        extentsBeforeFit: paper.extentsBefore,
        extentsAfterFit: paper.extentsAfter,
      },
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
