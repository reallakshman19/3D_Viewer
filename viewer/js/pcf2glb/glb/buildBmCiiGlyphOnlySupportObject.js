import * as THREE from 'three';
import {
  BM_CII_RESTRAINT_SYMBOL_RULES,
  buildSupportGlyphGroup,
  normalizeSupportRecord,
} from './RestraintSymbolRules.js';

const LAYER_SCHEMA = 'bm-cii-layer/v1';

function text(value) {
  return String(value ?? '').trim();
}

function sourceFrom(comp = {}, options = {}) {
  const rendering = options.supportRendering || {};
  const raw = text(rendering.source || options.supportSource || comp.supportSource || comp.source || comp.attributes?.SUPPORT_SOURCE || 'inputxml').toLowerCase();
  return raw.includes('isonote') ? 'isonote' : 'inputxml';
}

function recordIndexFrom(comp = {}) {
  const n = Number(comp.sourceRecordIndex ?? comp.recordIndex ?? comp.index ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) - 1 : 0;
}

export function isBmCiiGlyphOnlySupportMode(comp = {}, options = {}) {
  const rendering = options.supportRendering || {};
  return rendering.mode === 'bm-cii-glyph-only'
    || comp.supportRenderingMode === 'bm-cii-glyph-only'
    || comp.bmCiiGlyphOnlySupport === true
    || comp.bmCiiSupportRecord === true;
}

function metadataOnlyUnknownGroup(record) {
  const group = new THREE.Group();
  group.name = `BM_CII_RESTRAINT_${record.recordId}_UNKNOWN_METADATA_ONLY`;
  group.userData = {
    bmCiiGlyphOnlySupport: true,
    bmCiiSupportGlyphAuthoritative: true,
    bmCiiNoVisibleGeometry: true,
    bmCiiUnknownDebugGeometry: false,
    bmCiiTrace: {
      entity: 'support',
      renderPath: 'bm-cii-glyph-only',
      recordId: record.recordId,
      source: record.source,
      node: record.node,
      supportKind: record.kind,
      axis: record.axis || '',
      supportSymbolContract: record.supportSymbolContract,
      pipePoint: record.pipePoint.toArray(),
      pipeTangent: record.pipeTangent.toArray(),
      pipeRadius: record.pipeRadius,
      visibleDefault: false,
      noVisibleGeometry: true,
    },
    bmCiiLayer: {
      schema: LAYER_SCHEMA,
      category: 'support',
      source: record.source,
      supportKind: record.kind,
      axis: record.axis || '',
      visibleDefault: false,
      layerIds: record.layerIds,
      restraintVisualProfile: BM_CII_RESTRAINT_SYMBOL_RULES.id,
    },
    bmCiiLayerIds: record.layerIds,
    supportKind: record.kind,
    supportSource: record.source,
    restraintAxis: record.axis || '',
    supportRecordId: record.recordId,
    supportSymbolContract: record.supportSymbolContract,
    glbSupportVisualProfile: BM_CII_RESTRAINT_SYMBOL_RULES.id,
  };
  return group;
}

export function buildBmCiiGlyphOnlySupportObject(comp = {}, options = {}) {
  const source = sourceFrom(comp, options);
  const record = normalizeSupportRecord(comp, source, recordIndexFrom(comp), {
    pipePoint: comp.pipePoint || comp.displayPointGlb || comp.point,
    pipeTangent: comp.pipeTangent || comp.pipeTangentGlb || comp.tangent,
    pipeRadius: comp.pipeRadius || comp.pipeRadiusGlb || comp.pipeRadiusMm,
  });

  const group = record.kind === 'UNKNOWN'
    ? metadataOnlyUnknownGroup(record)
    : buildSupportGlyphGroup(record, { ...options, includeUnknownDebugGeometry: false });

  group.userData = {
    ...(group.userData || {}),
    bmCiiGlyphOnlySupport: true,
    bmCiiSupportGlyphAuthoritative: true,
    bmCiiTrace: {
      ...(group.userData?.bmCiiTrace || {}),
      renderPath: 'bm-cii-glyph-only',
      recordId: record.recordId,
      source: record.source,
      node: record.node,
      supportKind: record.kind,
      axis: record.axis || '',
      supportSymbolContract: record.supportSymbolContract,
      pipePoint: record.pipePoint.toArray(),
      pipeTangent: record.pipeTangent.toArray(),
      pipeRadius: record.pipeRadius,
      visibleDefault: record.visibleDefault,
    },
  };

  return group;
}
