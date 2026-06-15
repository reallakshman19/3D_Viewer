import { normalizeRestraintAxisLabel, normalizeRestraintKind } from '../../viewer/js/pcf2glb/glb/RestraintVisualProfile.js';

export const BM_CII_SIDECAR_SUPPORT_RECORD_SCHEMA = 'bm-cii-sidecar-support-records/v1';

function text(value) {
  return String(value ?? '').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const out = text(value);
    if (out) return out;
  }
  return '';
}

function sourceName(value, fallback = 'inputxml') {
  const raw = text(value || fallback).toLowerCase().replace(/[\s_-]+/g, '');
  if (raw.includes('isonote')) return 'isonote';
  return 'inputxml';
}

function normalizeKind(value) {
  const normalized = normalizeRestraintKind(value) || 'UNKNOWN';
  if (normalized === ('HO' + 'LDDOWN') || normalized === ('HO' + 'LD_DOWN') || normalized === 'SHOE') return 'REST';
  return normalized;
}

function normalizeAxis(value) {
  return normalizeRestraintAxisLabel(value).replace(/^[+-]/, '');
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePoint(value) {
  if (!value || typeof value !== 'object') return null;
  const x = numberOrNull(value.x ?? value[0]);
  const y = numberOrNull(value.y ?? value[1]);
  const z = numberOrNull(value.z ?? value[2]);
  return [x, y, z].every((n) => Number.isFinite(n)) ? { x, y, z } : null;
}

function nodeOf(record = {}) {
  return firstNonEmpty(record.node, record.Node, record.NODE, record.nodeNumber, record.NodeNumber, record.psNode, record.supportNode);
}

function kindOf(record = {}) {
  return firstNonEmpty(record.kind, record.type, record.restraintType, record.rawType, record.sourceKind, record.supportKind, record.SUPPORT_KIND, record.CAESAR_SUPPORT_KIND, record.SKEY, record.SUPPORT_TAG, 'UNKNOWN');
}

function axisOf(record = {}) {
  return normalizeAxis(firstNonEmpty(record.axis, record.Axis, record.AXIS, record.direction, record.Direction, record.DIRECTION, record.restraintAxis, record.RESTRAINT_AXIS, record['RESTRAINT-AXIS']));
}

function gapOf(record = {}) {
  return firstNonEmpty(record.gap, record.Gap, record.GAP, record.gapMm, record.GAP_MM, record.restraintGap, record.RESTRAINT_GAP);
}

function explicitRecords(sidecar = {}, source) {
  const src = sourceName(source);
  const direct = src === 'isonote'
    ? (sidecar.supportsIsonote || sidecar.isonoteSupports || sidecar.supportRecordsIsonote || sidecar.supports?.isonote || [])
    : (sidecar.supportsInputXml || sidecar.inputXmlSupports || sidecar.supportRecordsInputXml || sidecar.supports?.inputxml || sidecar.supports?.inputXml || []);
  if (!Array.isArray(direct)) return [];
  return direct.map((record, index) => ({ ...record, source: src, supportRecordIndex: record.supportRecordIndex ?? index }));
}

function recordsFromIsonoteCallouts(sidecar = {}) {
  const callouts = sidecar.caesarAnnotationCallouts || sidecar.callouts || [];
  const records = [];
  for (const callout of Array.isArray(callouts) ? callouts : []) {
    const node = nodeOf(callout);
    if (!node) continue;
    const tokens = Array.isArray(callout.supportTokens) ? callout.supportTokens : [];
    for (const token of tokens) {
      records.push({
        source: 'isonote',
        sourceCalloutNo: callout.no || callout.calloutNo || '',
        node,
        sourceKind: token.kind || token.type || 'UNKNOWN',
        kind: token.kind || token.type || 'UNKNOWN',
        axis: token.axis || token.direction || '',
        load: token.load || '',
      });
    }
  }
  return records.map((record, index) => ({ ...record, supportRecordIndex: index }));
}

export function sidecarSupportRecords(sidecar = {}) {
  const inputxml = explicitRecords(sidecar, 'inputxml');
  const explicitIsonote = explicitRecords(sidecar, 'isonote');
  const isonote = explicitIsonote.length ? explicitIsonote : recordsFromIsonoteCallouts(sidecar);
  return [...inputxml, ...isonote].map((record, index) => {
    const source = sourceName(record.source, index < inputxml.length ? 'inputxml' : 'isonote');
    const sourceKind = kindOf(record);
    const kind = normalizeKind(sourceKind);
    const axis = axisOf(record);
    const node = nodeOf(record) || 'NO_NODE';
    return {
      schema: BM_CII_SIDECAR_SUPPORT_RECORD_SCHEMA,
      id: `${source}:${record.supportRecordIndex ?? index}:${node}:${kind}:${axis || 'NA'}`,
      source,
      supportRecordIndex: Number.isFinite(Number(record.supportRecordIndex)) ? Number(record.supportRecordIndex) : index,
      node,
      sourceKind,
      kind,
      axis,
      gap: gapOf(record),
      raw: record,
    };
  });
}

export function supportComponentsFromSidecar(sidecar = {}, nodes = {}) {
  const records = sidecarSupportRecords(sidecar);
  return records.map((record) => {
    const point = normalizePoint(nodes[String(record.node)] || record.raw.position || record.raw.coOrds || record.raw.pipePoint) || { x: 0, y: 0, z: 0 };
    const outsideDiameter = numberOrNull(
      record.raw.outsideDiameter
        ?? record.raw.OutsideDiameter
        ?? record.raw.OUTSIDE_DIAMETER
        ?? record.raw.bore
        ?? record.raw.BORE
        ?? record.raw.p1bore,
    ) || 100;
    return {
      type: 'SUPPORT',
      id: `BM_CII_SUPPORT_${record.source}_${record.supportRecordIndex}_NODE_${record.node}_${record.kind}_${record.axis || 'NA'}`,
      node: String(record.node),
      supportRecordId: record.id,
      supportRecordIndex: record.supportRecordIndex,
      supportSource: record.source,
      source: record.source,
      sourceKind: record.sourceKind,
      supportKind: record.kind,
      axis: record.axis,
      restraintAxis: record.axis,
      gap: record.gap,
      coOrds: point,
      position: point,
      ep1: point,
      centrePoint: point,
      bore: outsideDiameter,
      outsideDiameter,
      pipeRadius: outsideDiameter / 2,
      attributes: {
        SUPPORT_SOURCE: record.source,
        SUPPORT_KIND: record.kind,
        SOURCE_KIND: record.sourceKind,
        AXIS: record.axis,
        NODE: String(record.node),
        GAP: record.gap,
      },
      raw: record.raw,
    };
  });
}

export function supportRecordMappingTable(sidecar = {}) {
  return sidecarSupportRecords(sidecar).map((record, index) => ({
    no: index + 1,
    id: record.id,
    source: record.source,
    node: record.node,
    sourceKind: record.sourceKind,
    normalizedKind: record.kind,
    axis: record.axis || 'NA',
    visibleDefault: record.kind !== 'UNKNOWN',
    render: record.kind === 'GUIDE'
      ? 'lateral arrows only'
      : record.kind === 'LINESTOP'
        ? 'axial arrows only, offset OD/2'
        : record.kind === 'LIMIT'
          ? 'axial/limit arrow, offset OD/2'
          : record.kind === 'REST'
            ? 'vertical REST arrow ending at OD/2'
            : record.kind === String.fromCharCode(72,65,78,71,69,82) || record.kind === 'SPRING'
              ? 'moderate suspension/spring symbol'
              : 'hidden/debug only',
  }));
}
