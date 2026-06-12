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

export function writeInputXmlDxf({ segments = [], supports = [], branches = [], diagnostics = [] } = {}, options = {}) {
  const scale = Math.max(numberOr(options.dxfScale, 1), Number.EPSILON);
  const textHeight = numberOr(options.textHeight, 2.5);
  const showLabels = options.showLabels !== false;
  const selectedBranchIds = Array.isArray(options.selectedBranchIds) ? options.selectedBranchIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  const branchManifest = branches.map(normalizeBranch);
  const selectedBranches = branchManifest.filter((branch) => branchSelected(branch, selectedBranchIds));
  const entities = [];

  for (const segment of segments) {
    const p1 = scalePoint(segment.p1, scale);
    const p2 = scalePoint(segment.p2, scale);
    entities.push(lineEntity(segment.id || segment.componentId, p1, p2, segment.layer || 'PIPING'));
    if (showLabels && segment.label) {
      entities.push(textEntity(`${segment.id || segment.componentId}-label`, midpoint(p1, p2), segment.label, 'LABELS', textHeight));
    }
  }

  for (const support of supports) {
    const point = scalePoint(support.point, scale);
    entities.push(pointEntity(support.id || support.componentId, point, 'SUPPORTS'));
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
      branchCount: branchManifest.length,
      selectedBranchCount: selectedCount,
      selectedBranchIds,
      branches: branchManifest,
      selectedBranches,
      segmentCount: segments.length,
      supportCount: supports.length,
      layers,
      diagnostics,
    },
  };
}
