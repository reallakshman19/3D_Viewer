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

function numericType(raw = {}) {
  const n = Number(firstNonEmpty(raw.caesar_type, raw.CAESAR_TYPE, raw.TYPE, raw.Type, raw.restraintNumericType));
  return Number.isFinite(n) ? n : null;
}

function vectorAxisLabel(value) {
  if (!Array.isArray(value)) return '';
  const nums = value.map(Number);
  const abs = nums.map((n) => Math.abs(Number.isFinite(n) ? n : 0));
  const max = Math.max(...abs);
  if (max <= 0) return '';
  const index = abs.indexOf(max);
  const letter = ['X', 'Y', 'Z'][index];
  // Positive cosine values in InputXML are not automatically directional "+".
  // A negative cosine is physically signed and is retained as -X/-Y/-Z.
  return nums[index] < 0 ? `-${letter}` : letter;
}

function rawAxisLabel(value) {
  if (Array.isArray(value)) return vectorAxisLabel(value);
  if (value && typeof value === 'object') return vectorAxisLabel([value.x, value.y, value.z]);
  const raw = upper(value);
  if (!raw) return '';
  if (/^[+-][XYZ]$/.test(raw)) return raw;
  if (/^[XYZ]$/.test(raw)) return raw;
  if (raw.includes('-X')) return '-X';
  if (raw.includes('+X')) return '+X';
  if (raw.includes('-Y')) return '-Y';
  if (raw.includes('+Y')) return '+Y';
  if (raw.includes('-Z')) return '-Z';
  if (raw.includes('+Z')) return '+Z';
  if (raw.includes('DX') || raw.includes('X')) return 'X';
  if (raw.includes('DY') || raw.includes('Y')) return 'Y';
  if (raw.includes('DZ') || raw.includes('Z')) return 'Z';
  return normalizeRestraintAxisLabel(raw).replace(/^\+/, '');
}

function normalizeAxis(value, raw = {}, kind = '') {
  let axis = rawAxisLabel(value);
  const base = axis.replace(/^[+-]/, '');
  const caesarType = numericType(raw);
  const normalizedKind = normalizeKind(kind || raw.kind || raw.supportKind || raw.restraintType);

  // BM_CII InputXML-basic primary rule:
  // X/Y/Z from positive cosines are axis labels unless the BM_CII benchmark
  // table below promotes that source row to a signed directional stop. Do not
  // classify signedness from cosine alone.
  if (!axis.startsWith('+') && !axis.startsWith('-')) {
    if (caesarType === 18 && base === 'Z') axis = '+Z';
  }

  // Springs/hangers are coil-only visually. Keep a stable axis label when the
  // source does not provide one; sign is not used to draw an arrow.
  if (!axis && (normalizedKind === 'SPRING' || normalizedKind === 'HANGER')) return 'Y';
  return axis;
}

function bmCiiInputXmlBasicOverride({ source = '', index = 0, node = '', caesarType = null, kind = '', axis = '' } = {}) {
  if (source !== 'inputxml') return { kind, axis, typeLabel: '' };
  const nodeText = text(node);
  const type = Number(caesarType);

  // BM_CII benchmark-specific classification supplied by user:
  // 10/190/240 = ANC
  // 35          = +Y as GUIDE, X, Z
  // 130         = +Z
  // 205         = LIM, Y, Hanger/Y
  // 255         = +Y, GUIDE
  // This table is deliberately scoped to BM_CII InputXML Basic and does not
  // apply source-to-canvas transformation. GUIDE remains a family only. The
  // axis/cosine label only orients the guide lateral pair; it must not convert
  // an axis restraint into GUIDE or a GUIDE into an axis restraint.
  if (['10', '190', '240'].includes(nodeText)) {
    return { kind: 'ANCHOR', axis: 'NA', typeLabel: 'ANC' };
  }
  if (nodeText === '35' && type === 17) return { kind: 'GUIDE', axis: '+Y', typeLabel: '+Y' };
  if (nodeText === '35' && type === 1) return { kind: 'REST', axis: 'X', typeLabel: 'X' };
  if (nodeText === '35' && type === 3) return { kind: 'REST', axis: 'Z', typeLabel: 'Z' };
  if (nodeText === '130' && type === 18) return { kind: 'LINESTOP', axis: '+Z', typeLabel: '+Z' };
  if (nodeText === '205' && type === 10) return { kind: 'LIMIT', axis: axis || 'X', typeLabel: 'LIM' };
  if (nodeText === '205' && type === 2) return { kind: 'REST', axis: 'Y', typeLabel: 'Y' };
  if (nodeText === '205' && (kind === 'SPRING' || kind === 'HANGER')) return { kind: 'SPRING', axis: 'Y', typeLabel: 'HANGER' };
  if (nodeText === '255' && type === 17) return { kind: 'GUIDE', axis: axis || 'Y', typeLabel: 'GUIDE' };
  if (nodeText === '255' && type === 7) return { kind: 'REST', axis: '+Y', typeLabel: '+Y' };
  return { kind, axis, typeLabel: '' };
}

function supportDetailFields(raw = {}, { source = '', node = '', kind = '', axis = '', recordId = '', typeLabel = '' } = {}) {
  const type = firstNonEmpty(
    typeLabel,
    raw.bmCiiTypeLabel,
    raw.restraintDisplayType,
    raw.visualType,
    raw.TYPE_LABEL,
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
  const normalizedAxis = rawAxisLabel(axis) || 'NA';
  return `${normalizedSource(source)}:${indexText}:node:${text(node) || 'NA'}:kind:${normalizedKind}:axis:${normalizedAxis}`;
}

export function normalizeSupportRecord(raw = {}, context = {}) {
  const source = normalizedSource(firstNonEmpty(context.source, context.supportSource, raw.source, raw.supportSource, raw.SUPPORT_SOURCE));
  const index = Number(context.index ?? raw.index ?? raw.recordIndex ?? raw.supportIndex ?? 0) || 0;
  const node = text(firstNonEmpty(raw.node, raw.nodeNumber, raw.NodeNumber, raw.supportNode, raw.sourceNode, raw.CAESAR_NODE));
  let kind = normalizeKindFromRaw(raw);
  let axis = normalizeAxis(firstNonEmpty(raw.axis, raw.axisGlb, raw.direction, raw.restraintAxis, raw.supportAxis, raw.SUPPORT_AXIS, raw.SUPPORT_DIRECTION, raw.AXIS, raw.Direction), raw, kind);
  const caesarType = numericType(raw);
  const override = bmCiiInputXmlBasicOverride({ source, index, node, caesarType, kind, axis });
  kind = override.kind;
  axis = override.axis;
  const typeLabel = override.typeLabel;
  const recordId = text(firstNonEmpty(
    raw.recordId,
    raw.supportRecordId,
    raw.id,
    raw.supportId,
    context.recordId,
    supportRecordIdOf({ source, index, node, kind, axis }),
  ));
  const layerIds = layerIdsForRestraintSupport({ source, kind, axisLabel: axis });
  const details = supportDetailFields(raw, { source, node, kind, axis, recordId, typeLabel });
  return {
    schema: BM_CII_SUPPORT_RECORD_SCHEMA,
    recordId,
    source,
    index,
    node,
    kind,
    axis,
    typeLabel,
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
    typeLabel: record.typeLabel,
    supportSymbolContract: record.supportSymbolContract,
    visibleDefault: record.visibleDefault,
    ...(record.details || {}),
    ...extra,
  };
}
