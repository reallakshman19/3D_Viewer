import { createDxfDocument, lineEntity, pointEntity, textEntity } from '../../vendor/dxf-lines.js';

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function scalePoint(point, scale) {
  return { x: point.x * scale, y: point.y * scale, z: point.z * scale };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = Math.sin(Math.PI / 6);

function applyProjection(point, projectionMode) {
  switch (projectionMode) {
    case 'top':
      return { x: point.x, y: point.y, z: 0 };
    case 'elevation-xz':
      return { x: point.x, y: point.z, z: 0 };
    case 'elevation-yz':
      return { x: point.y, y: point.z, z: 0 };
    case 'iso-2.5d':
      return {
        x: (point.x - point.y) * ISO_COS,
        y: (point.x + point.y) * ISO_SIN + point.z,
        z: 0,
      };
    default:
      return point;
  }
}

export function writeInputXmlDxf({ segments = [], supports = [], branches = [], diagnostics = [] } = {}, options = {}) {
  const scale = Math.max(numberOr(options.dxfScale, 1), Number.EPSILON);
  const textHeight = numberOr(options.textHeight, 2.5);
  const showLabels = options.showLabels !== false;
  const projectionMode = options.projectionMode || '3d';
  const entities = [];

  for (const segment of segments) {
    const p1 = applyProjection(scalePoint(segment.p1, scale), projectionMode);
    const p2 = applyProjection(scalePoint(segment.p2, scale), projectionMode);
    entities.push(lineEntity(segment.id || segment.componentId, p1, p2, segment.layer || 'PIPING'));
    if (showLabels && segment.label) {
      entities.push(textEntity(`${segment.id || segment.componentId}-label`, midpoint(p1, p2), segment.label, 'LABELS', textHeight));
    }
  }

  for (const support of supports) {
    const point = applyProjection(scalePoint(support.point, scale), projectionMode);
    entities.push(pointEntity(support.id || support.componentId, point, 'SUPPORTS'));
    if (showLabels && support.label) {
      entities.push(textEntity(`${support.id || support.componentId}-label`, point, support.label, 'LABELS', textHeight));
    }
  }

  const layers = [...new Set(['PIPING', 'VALVES', 'FLANGES', 'SUPPORTS', 'LABELS', ...entities.map((tokens) => {
    const layerIndex = tokens.indexOf('8');
    return layerIndex >= 0 ? tokens[layerIndex + 1] : '';
  }).filter(Boolean)])];

  const selectedCount = Array.isArray(options.selectedBranchIds) && options.selectedBranchIds.length
    ? options.selectedBranchIds.length
    : branches.length;

  return {
    dxf: createDxfDocument({ layers, entities }),
    sidecar: {
      schema: 'inputxml-dxf-sidecar/v1',
      source: options.sourceName || '',
      branchCount: branches.length,
      selectedBranchCount: selectedCount,
      segmentCount: segments.length,
      supportCount: supports.length,
      layers,
      diagnostics,
    },
  };
}
