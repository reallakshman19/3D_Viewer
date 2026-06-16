import {
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
  layerIdsForRestraintSupport,
} from './RestraintVisualProfile.js';

export const BM_CII_SUPPORT_RECORD_SCHEMA = 'bm-cii-support-record/v1';

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && text(value) !== '') return value;
  }
  return '';
}

function normalizedSource(value) {
  return text(value).toLowerCase().includes('isonote') ? 'isonote' : 'inputxml';
}

function normalizeKind(value) {
  const kind = normalizeRestraintKind(value) || 'UNKNOWN';
  if (kind === 'SHOE') return 'REST';
  if (kind === 'SUPPORT') return 'REST';
  return kind;
}

function normalizeKindFromRaw(raw = {}) {
  const rawKind = firstNonEmpty(raw.kind, raw.type, raw.display, raw.supportKind, raw.restraintType, raw.CMPSUPTYPE, raw.SKEY, raw.labelText);
  let kind = normalizeKind(rawKind);
  const displayText = upper(firstNonEmpty(raw.display, raw.Display, raw.note, raw.Note, raw.labelText, raw.name));
  const typeText = upper(firstNonEmpty(raw.TYPE, raw.Type, raw.type, raw.kind, raw.supportKind, raw.restraintType));

  // BM_CII InputXML basic benchmark: Type 0 rows that are explicitly labelled
  // as ANCHOR/ANC/ANCHOR_PROVISIONAL are real anchor symbols for the visual
  // review, not UNKNOWN debug markers.
  if (kind === 'UNKNOWN' && (displayText.includes('ANCHOR') || typeText === 'ANC')) {
    kind = 'ANCHOR';
  }
  return kind;
}

function normalizeAxis(value) {
  const axis = normalizeRestraintAxisLabel(value);
  if (axis.includes('X')) return axis.startsWith('-') ? '-X' : '+X';
  if (axis.includes('Y')) return axis.startsWith('-') ? '-Y' : '+Y';
  if (axis.includes('Z')) return axis.startsWith('-') ? '-Z' : '+Z';
  return '';
}

function supportDetailFields(raw = {}, { source = '', node = '', kind = '', axis = '', recordId = '' } = {}) {
  const type = firstNonEmpty(
    raw.TYPE,
    raw.Type,
    raw.type,
    raw.kind,
    raw.supportKind,
    raw.restraintType,
    raw.CMPSUPTYPE,
    raw.CAESAR_TYPE,
    raw.caesar_type,
    kind,
  );
  const stiffness = firstNonEmpty(
    raw.STIFFNESS,
    raw.Stiffness,
    raw.stiffness,
    raw.restraintStiffness,
    raw.supportStiffness,
    raw.K,
    raw.k,
  );
  const gap = firstNonEmpty(
    raw.GAP,
    raw.Gap,
    raw.gap,
    raw.gapMm,
    raw.restraintGap,
    raw.supportGap,
  );
  const fricCoef = firstNonEmpty(
    raw.FRIC_COEF,
    raw.FricCoef,
    raw.fricCoef,
    raw.frictionCoefficient,
    raw.FRICTION,
    raw.friction,
    raw.MU,
    raw.mu,
  );
  const tag = firstNonEmpty(
    raw.TAG,
    raw.Tag,
    raw.tag,
    raw.supportTag,
    raw.NodeName,
    raw.nodeName,
    raw.name,
    recordId,
  );
  const guid = firstNonEmpty(
    raw.GUID,
    raw.Guid,
    raw.guid,
    raw.componentGuid,
    raw.ComponentRefNo,
    raw.componentRefNo,
    raw.refNo,
    raw.id,
    recordId,
  );

  return {
    TYPE: type,
    STIFFNESS: stiffness,
    GAP: gap,
    FRIC_COEF: fricCoef,
    TAG: tag,
    GUID: guid,
    supportType: type,
    supportStiffness: stiffness,
    supportGap: gap,
    supportFricCoef: fricCoef,
    supportTag: tag,
    supportGuid: guid,
    supportNode: node,
    supportAxis: axis,
    supportSource: source,
  };
}

export function supportSymbolContractFor(kind) {
  const normalizedKind = normalizeKind(kind);
  if (normalizedKind === 'GUIDE') return 'guide-lateral-arrows-tip-at-od2';
  if (normalizedKind === 'REST' || normalizedKind === 'HOLDDOWN' || normalizedKind === 'SHOE') return 'rest-axis-arrow-tip-at-od2';
  if (normalizedKind === 'LINESTOP') return 'linestop-axial-arrows-offset-od2';
  if (normalizedKind === 'LIMIT') return 'limit-axial-arrow-offset-od2';
  if (normalizedKind === 'HANGER' || normalizedKind === 'SPRING') return 'spring-coil-only-no-arrow';
  if (normalizedKind === 'ANCHOR') return 'anchor-flat-flow-blocking-plate';
  return 'unknown-debug-default-off';
}

export function supportRecordIdOf({ source = 'inputxml', index = 0, node = '', kind = 'UNKNOWN', axis = '' } = {}) {
  const indexText = String(Number(index) > 0 ? Number(index) : 0).padStart(2, '0');
  const normalizedKind = normalizeKind(kind);
  const normalizedAxis = normalizeAxis(axis).replace(/^\+/, '') || 'NA';
  return `${normalizedSource(source)}:${indexText}:node:${text(node) || 'NA'}:kind:${normalizedKind}:axis:${normalizedAxis}`;
}

export function normalizeSupportRecord(raw = {}, context = {}) {
  const source = normalizedSource(firstNonEmpty(context.source, context.supportSource, raw.source, raw.supportSource, raw.SUPPORT_SOURCE));
  const index = Number(context.index ?? raw.index ?? raw.recordIndex ?? raw.supportIndex ?? 0) || 0;
  const node = text(firstNonEmpty(raw.node, raw.nodeNumber, raw.NodeNumber, raw.supportNode, raw.sourceNode, raw.CAESAR_NODE));
  const kind = normalizeKindFromRaw(raw);
  const axis = normalizeAxis(firstNonEmpty(raw.axis, raw.axisGlb, raw.direction, raw.restraintAxis, raw.supportAxis, raw.SUPPORT_AXIS, raw.SUPPORT_DIRECTION, raw.AXIS, raw.Direction));
  const recordId = text(firstNonEmpty(
    raw.recordId,
    raw.supportRecordId,
    raw.id,
    raw.supportId,
    context.recordId,
    supportRecordIdOf({ source, index, node, kind, axis }),
  ));
  const layerIds = layerIdsForRestraintSupport({ source, kind, axisLabel: axis });
  const details = supportDetailFields(raw, { source, node, kind, axis, recordId });
  return {
    schema: BM_CII_SUPPORT_RECORD_SCHEMA,
    recordId,
    source,
    index,
    node,
    kind,
    axis,
    visibleDefault: kind !== 'UNKNOWN',
    supportSymbolContract: supportSymbolContractFor(kind),
    layerIds,
    details,
    raw,
  };
}

export function isUnknownSupportRecord(record = {}) {
  return normalizeKind(record.kind).includes('UNKNOWN') || normalizeKind(record.kind).includes('TYPE0');
}

export function supportTraceFromRecord(record = {}, extra = {}) {
  return {
    schema: BM_CII_SUPPORT_RECORD_SCHEMA,
    entity: 'support',
    semanticCategory: 'support',
    recordId: record.recordId,
    supportRecordId: record.recordId,
    source: record.source,
    supportSource: record.source,
    node: record.node,
    sourceNode: record.node,
    supportKind: record.kind,
    kind: record.kind,
    axis: record.axis,
    restraintAxis: record.axis,
    supportSymbolContract: record.supportSymbolContract,
    visibleDefault: record.visibleDefault,
    ...(record.details || {}),
    ...extra,
  };
}
