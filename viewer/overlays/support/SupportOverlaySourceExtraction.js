import {
  classifySupportFamily,
  extractExplicitSign,
  readRecordGapMm,
  SUPPORT_FAMILIES,
} from './NonPrimitiveSupportOverlayResolver.js';
import { nodeIdFromAttrs } from './SupportOverlayCoordinateMapper.js';

export const SUPPORT_OVERLAY_SOURCE_EXTRACTION_SCHEMA = 'support-overlay-source-extraction/v1';

export const SUPPORT_SOURCE_CHILD_KEYS = Object.freeze([
  'children',
  'items',
  'branches',
  'nodes',
  'hierarchy',
  'components',
  'elements',
  'supports',
  'members',
]);

export const SUPPORT_COORDINATE_KEYS = Object.freeze([
  'SUPPORTCOORD',
  'SUPPORT_COORD',
  'SUPPORTCOORDINATE',
  'SUPPORT_COORDINATE',
  'SUPPORTCOORDINATES',
  'SUPPORT_COORDINATES',
  'SUPPORTPOS',
  'SUPPORT_POS',
  'SUPPORTPOSITION',
  'SUPPORT_POSITION',
  'SCOORD',
  'S_COORD',
  'POS',
  'POSITION',
  'COORD',
  'COORDS',
  'COORDINATE',
  'COORDINATES',
  'CO_ORDS',
  'CO_ORD',
  'LOCATION',
  'LOC',
  'XYZ',
  'POINT',
  'NODE_COORD',
  'NODECOORD',
  'WORLD_POS',
  'WORLD_POSITION',
  'GLOBAL_POS',
  'GLOBAL_POSITION',
  'BPOS',
  'BP',
  'APOS',
  'LPOS',
]);

export const SUPPORT_OD_KEYS = Object.freeze([
  'PIPE_OD_MM',
  'PIPEODMM',
  'PIPE_OD',
  'PIPEOD',
  'OD_MM',
  'OD',
  'OUTSIDE_DIAMETER',
  'OUTSIDEDIAMETER',
  'BORE_MM',
  'BORE',
  'NOMINAL_BORE',
  'NOMINALBORE',
  'NB',
  'NPS',
]);

export const SUPPORT_BRANCH_KEYS = Object.freeze([
  'BRANCH',
  'BRANCH_ID',
  'BRANCHID',
  'OWNER_BRANCH',
  'OWNERBRANCH',
  'BRANCHNAME',
  'BRANCH_NAME',
  'OWNER',
  'OWNER_ID',
]);

export const SUPPORT_LINE_KEYS = Object.freeze([
  'LINE',
  'LINE_NO',
  'LINENO',
  'LINE_NUMBER',
  'LINENUMBER',
  'LINEREF',
  'LINE_REF',
  'PIPELINE',
  'PIPE_LINE',
  'PIPELINE_ID',
]);

export const SUPPORT_AXIS_KEYS = Object.freeze([
  'PIPE_AXIS',
  'PIPEAXIS',
  'AXIS',
  'DIRECTION',
  'DIR',
  'ORIENTATION',
  'ORIENT',
  'RESTRAINT_AXIS',
  'RESTRAINTAXIS',
  'LINE_AXIS',
  'LINEAXIS',
  'AXIAL_AXIS',
  'AXIALAXIS',
  'RUN_AXIS',
  'RUNAXIS',
  'VECTOR',
  'VEC',
]);

export const SUPPORT_SIGN_KEYS = Object.freeze([
  'SIGN',
  'AXIS_SIGN',
  'AXISSIGN',
  'RESTRAINT_SIGN',
  'RESTRAINTSIGN',
  'DIRECTION_SIGN',
  'DIRECTIONSIGN',
  'LIMIT_SIGN',
  'LIMITSIGN',
  'LINESTOP_SIGN',
  'LINESTOPSIGN',
  'SENSE',
  'WAY',
]);

const SUPPORT_KIND_RE = /\b(GUIDE|GDE|GUI|LINE\s*STOP|LINESTOP|LIMIT\s*STOP|LIMIT|LIM|RESTING|REST|HOLDDOWN|HOLD\s*DOWN|HOLD-DOWN|DOWN\s*STOP|DOWNSTOP|SHOE|ANCHOR|FIXED|FIXED\s*POINT|STOPPER|STOP|SUPPORT|ATTA|ANCI|HANGER|SPRING|CAN\s*SPRING|SPRING\s*CAN)\b/i;
const SUPPORT_TAG_RE = /\b(?:PS|PPS|SUP|SUPPORT|SPS)[-_\s]?[A-Z0-9][A-Z0-9._/\-]*\b/i;
const EXPLICIT_SUPPORT_REF_KEYS = Object.freeze([
  'SUPPORT_TAG',
  'SUPPORTTAG',
  'SUPPORT_NO',
  'SUPPORTNO',
  'SUPPORT_NUMBER',
  'SUPPORTNUMBER',
  'SUPPORT_NUM',
  'SUPPORTNUM',
  'SUPPORT_REF',
  'SUPPORTREF',
  'SUPPORT_ID',
  'SUPPORTID',
  'PS_NO',
  'PSNO',
  'PS_NUMBER',
  'PSNUMBER',
  'PS',
  'CMPSUPREFN',
  'MDSSUPREFN',
  'NAME',
  'TAG',
  'TAGNO',
  'REF',
  'REFNO',
  'DBREF',
  'SKEY',
  'SPRE',
  'ELEMENT_ID',
  'ELEMENTID',
  'DESCRIPTION',
  'DESC',
]);

export function collectNonPrimitiveSupportRecords(source, out = [], options = {}) {
  const max = positiveInteger(options.max) || 500;
  const roots = Array.isArray(source) ? source : [source];
  for (const node of roots) collectNode(node, out, max);
  return out;
}

export function parseSupportRecordFromSourceNode(node) {
  if (!node || typeof node !== 'object') return null;
  const a = attrs(node);
  const text = supportText(node, a);
  const sourceType = String(node.type || node.kind || a.TYPE || a.RAW_TYPE || '').toUpperCase();
  const isPipeLike = /^(PIPE|BRAN|BRANCH|PIPING|TUBE|SEGMENT)$/i.test(sourceType);
  const matched = !isPipeLike && (/\b(SUPPORT|ATTA|ANCI|PIPE_SUPPORT|PIPESUPPORT)\b/i.test(text) || SUPPORT_KIND_RE.test(text));
  if (!matched) return null;

  const supportKind = supportKindFromText(text);
  const local = coordinateFromAttributes(a);
  if (!supportKind || !local) return null;

  return {
    source: node,
    attrs: a,
    rawText: text,
    rawType: rawSupportType(node, a),
    kind: supportKind,
    local,
    tag: supportTag(node, a),
    nodeId: nodeIdFromAttrs(a),
    branchId: firstTextFromKeys(a, SUPPORT_BRANCH_KEYS),
    lineNo: firstTextFromKeys(a, SUPPORT_LINE_KEYS),
    axis: pipeAxisFromAttributes(a),
    gapMm: readRecordGapMm(a),
    explicitSign: explicitSignFromAttributes(a, text),
    pipeOdMm: pipeOdFromAttributes(a),
    singleAxis: singleAxisFromAttributes(a, text),
  };
}

export function coordinateFromAttributes(a = {}) {
  for (const key of SUPPORT_COORDINATE_KEYS) {
    const pt = parseVec3(a[key]);
    if (pt) return pt;
  }
  const x = firstDefined(a.X, a.x, a.EASTING, a.Easting, a.E, a.EAST, a.WORLD_X, a.GLOBAL_X);
  const y = firstDefined(a.Y, a.y, a.NORTHING, a.Northing, a.N, a.NORTH, a.WORLD_Y, a.GLOBAL_Y);
  const z = firstDefined(a.Z, a.z, a.ELEVATION, a.Elevation, a.EL, a.ELEV, a.U, a.UP, a.WORLD_Z, a.GLOBAL_Z);
  if (x !== undefined && y !== undefined && z !== undefined) return parseVec3({ x, y, z });
  return null;
}

export function pipeAxisFromAttributes(a = {}) {
  for (const key of SUPPORT_AXIS_KEYS) {
    const explicit = normalizeVec(parseVec3(a[key]));
    if (explicit) return explicit;
  }
  const ap = parseVec3(a.APOS ?? a.A_POS ?? a.FROM_POS ?? a.START_POS);
  const lp = parseVec3(a.LPOS ?? a.L_POS ?? a.TO_POS ?? a.END_POS);
  if (ap && lp) {
    const axis = normalizeVec(sub(lp, ap));
    if (axis) return axis;
  }
  return null;
}

export function explicitSignFromAttributes(a = {}, text = '') {
  for (const key of SUPPORT_SIGN_KEYS) {
    const sign = normalizeExplicitSign(a[key]);
    if (sign) return sign;
  }
  return extractExplicitSign(text);
}

export function supportTag(node, a = {}) {
  for (const key of EXPLICIT_SUPPORT_REF_KEYS) {
    const value = a[key];
    const direct = cleanSupportTag(value);
    if (direct) return direct;
    const match = SUPPORT_TAG_RE.exec(textValue(value));
    if (match) return cleanSupportTag(match[0]);
  }
  for (const value of [node?.name, node?.id, node?.tag, node?.ref]) {
    const direct = cleanSupportTag(value);
    if (direct) return direct;
    const match = SUPPORT_TAG_RE.exec(textValue(value));
    if (match) return cleanSupportTag(match[0]);
  }
  return textValue(a.CMPSUPREFN || a.SUPPORT_TAG || a.SUPPORTNO || a.NAME || node?.name || node?.id || 'SUPPORT').slice(0, 64);
}

export function pipeOdFromAttributes(a = {}) {
  for (const key of SUPPORT_OD_KEYS) {
    const n = numberValue(a[key]);
    if (n && n > 0) return n;
  }
  return null;
}

export function singleAxisFromAttributes(a = {}, text = '') {
  const upper = String(text || '').toUpperCase();
  if (/\bSINGLE\s*AXIS\b|\bONE\s*WAY\b|\bONEWAY\b|\bUNI[-\s]?DIRECTION/.test(upper)) return true;
  return Boolean(a.SINGLE_AXIS || a.SINGLEAXIS || a.ONE_WAY || a.ONEWAY || a.UNIDIRECTIONAL || a.UNI_DIRECTIONAL);
}

function collectNode(node, out, max) {
  if (!node || typeof node !== 'object' || out.length >= max) return;
  const record = parseSupportRecordFromSourceNode(node);
  if (record) out.push(record);
  for (const key of SUPPORT_SOURCE_CHILD_KEYS) {
    const children = node[key];
    if (Array.isArray(children)) for (const child of children) collectNode(child, out, max);
  }
}

function attrs(node) { return { ...(node.attributes || {}), ...(node.attrs || {}), ...(node.rawAttributes || {}) }; }
function textValue(value) { return value === undefined || value === null ? '' : String(value); }
function firstDefined(...values) { return values.find((value) => value !== undefined && value !== null && value !== ''); }
function positiveInteger(value) { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }

function supportText(node, a) {
  return [
    node.type,
    node.kind,
    node.name,
    node.path,
    node.id,
    node.tag,
    a.TYPE,
    a.STYP,
    a.RAW_TYPE,
    a.DTXR,
    a.SUPPORT_TYPE,
    a.SUPPORTTYPE,
    a.CMPSUPTYPE,
    a.MDSSUPPTYPE,
    a.CMPSUPREFN,
    a.SUPPORT_TAG,
    a.SUPPORTNO,
    a.SUPPORT_NO,
    a.PSNO,
    a.PS_NO,
    a.NAME,
    a.TAG,
    a.TAGNO,
    a.SKEY,
    a.SPRE,
    a.DESCRIPTION,
    a.DESC,
  ].map(textValue).join(' ');
}

function rawSupportType(node, a) {
  return String(a.TYPE || a.STYP || a.SUPPORT_TYPE || a.SUPPORTTYPE || a.CMPSUPTYPE || a.MDSSUPPTYPE || node.type || node.kind || '');
}

function numberValue(value) {
  const n = Number.parseFloat(textValue(value).replace(/,/g, '').replace(/mm/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseVec3(value) {
  if (!value && value !== 0) return null;
  if (Array.isArray(value) && value.length >= 3) {
    const x = numberValue(value[0]), y = numberValue(value[1]), z = numberValue(value[2]);
    return x === null || y === null || z === null ? null : { x, y, z };
  }
  if (typeof value === 'object') {
    const x = numberValue(value.x ?? value.X ?? value.e ?? value.E);
    const y = numberValue(value.y ?? value.Y ?? value.n ?? value.N);
    const z = numberValue(value.z ?? value.Z ?? value.u ?? value.U ?? value.el ?? value.EL);
    return x === null || y === null || z === null ? null : { x, y, z };
  }
  const text = textValue(value).trim();
  const directional = text.match(/\b([EWNSUD])\s*(-?\d+(?:\.\d+)?)/gi);
  if (directional?.length >= 3) {
    const out = { x: 0, y: 0, z: 0 };
    for (const entry of directional) {
      const [, dir, raw] = /([EWNSUD])\s*(-?\d+(?:\.\d+)?)/i.exec(entry) || [];
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      if (/E/i.test(dir)) out.x = n;
      else if (/W/i.test(dir)) out.x = -n;
      else if (/N/i.test(dir)) out.y = n;
      else if (/S/i.test(dir)) out.y = -n;
      else if (/U/i.test(dir)) out.z = n;
      else if (/D/i.test(dir)) out.z = -n;
    }
    return out;
  }
  const values = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return values.length >= 3 ? { x: values[0], y: values[1], z: values[2] } : null;
}

function normalizeExplicitSign(value) {
  const upper = textValue(value).trim().toUpperCase();
  if (!upper) return null;
  if (upper === '+/-' || upper === '±' || upper === 'BOTH' || upper === 'BIDIRECTIONAL' || upper === 'BI-DIRECTIONAL') return '+/-';
  if (upper === '+' || upper === 'PLUS' || upper === 'POS' || upper === 'POSITIVE' || upper === '+AXIS' || upper === '+ AXIS') return '+';
  if (upper === '-' || upper === 'MINUS' || upper === 'NEG' || upper === 'NEGATIVE' || upper === '-AXIS' || upper === '- AXIS') return '-';
  return null;
}

function supportKindFromText(text = '') {
  const family = classifySupportFamily(text);
  if (family !== SUPPORT_FAMILIES.UNKNOWN) return family;
  if (/\b(ANCHOR|FIXED|FIXED\s*POINT|FULL\s*ANCHOR)\b/i.test(String(text || ''))) return SUPPORT_FAMILIES.LINESTOP;
  return SUPPORT_KIND_RE.test(String(text || '')) ? SUPPORT_FAMILIES.UNKNOWN : '';
}

function cleanSupportTag(value) {
  const text = textValue(value).trim();
  if (!text) return '';
  if (/^\[object Object\]$/i.test(text)) return '';
  return text.replace(/\s+/g, '-').slice(0, 64);
}

function sub(a, b) {
  return { x: Number(a.x) - Number(b.x), y: Number(a.y) - Number(b.y), z: Number(a.z) - Number(b.z) };
}

function normalizeVec(value) {
  if (!value) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(len) || len < 1e-9) return null;
  return { x: x / len, y: y / len, z: z / len };
}

function firstTextFromKeys(a, keys) {
  for (const key of keys) {
    const text = textValue(a[key]).trim();
    if (text) return text;
  }
  return '';
}
