const CAESAR_UNSET = -1.0101;
const DIRECT_SCHEMA = 'inputxml-direct-managed-stage/v1';

function text(value) { return String(value ?? '').trim(); }
function normNode(value) {
  const n = Number(text(value));
  return Number.isFinite(n) ? String(Math.trunc(n)) : '';
}
function num(value, fallback = 0) {
  const n = Number(text(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}
function isUnset(value) {
  const raw = text(value);
  if (!raw) return true;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) && Math.abs(n - CAESAR_UNSET) < 0.0002;
}
function finiteOrNull(value) {
  if (isUnset(value)) return null;
  const n = Number(text(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function bendElementLengthInMm(radiusValue, angleDegValue) {
  const radius = finiteOrNull(radiusValue);
  const angleDeg = finiteOrNull(angleDegValue);
  if (!(radius > 0) || !(angleDeg > 0)) return null;
  return Number((radius * angleDeg * Math.PI / 180).toFixed(6));
}
function cleanTagName(tag) { return text(tag).replace(/^\//, '').split(/\s+/)[0].replace(/[^A-Za-z0-9_-]/g, '').toUpperCase(); }
function attrsFrom(raw = '') {
  const out = {};
  String(raw).replace(/([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g, (_, key, value) => { out[key.toUpperCase()] = value; return ''; });
  return out;
}
function collectBlocks(xml, tag) {
  const name = cleanTagName(tag);
  const source = String(xml || '');
  const out = [];
  const start = new RegExp(`<${name}\\b([^>]*)>`, 'gi');
  let match;
  while ((match = start.exec(source))) {
    const full = match[0] || '';
    const attrs = attrsFrom(match[1] || '');
    if (/\/\s*>$/.test(full)) {
      out.push({ attrs, body: '', paired: false });
      continue;
    }
    const bodyStart = start.lastIndex;
    const close = new RegExp(`</${name}>`, 'gi');
    close.lastIndex = bodyStart;
    const closeMatch = close.exec(source);
    if (!closeMatch) {
      out.push({ attrs, body: '', paired: false });
      continue;
    }
    const nextStart = new RegExp(`<${name}\\b`, 'gi');
    nextStart.lastIndex = bodyStart;
    const nextMatch = nextStart.exec(source);
    if (nextMatch && nextMatch.index < closeMatch.index) {
      out.push({ attrs, body: '', paired: false, inferredSelfClose: true });
      start.lastIndex = bodyStart;
      continue;
    }
    out.push({ attrs, body: source.slice(bodyStart, closeMatch.index), paired: true });
    start.lastIndex = closeMatch.index + closeMatch[0].length;
  }
  return out;
}
function firstChildAttrs(body, tag) { return collectBlocks(body || '', tag)[0]?.attrs || null; }
function childAttrs(body, tag) { return collectBlocks(body || '', tag).map((item) => item.attrs); }
function stem(name = '') { return text(name).replace(/\.[^.]+$/, '') || 'InputXML'; }
function branchName(sourceName) { return `/INPUTXML/${stem(sourceName)}/BRANCH-001`; }
function point(x = 0, y = 0, z = 0) { return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }; }
function formatMm(value, fallback = 100) {
  const n = finiteOrNull(value);
  const v = n && n > 0 ? n : fallback;
  return `${Number.isInteger(v) ? v : Number(v.toFixed(6)).toString()}mm`;
}
function directionalPoint(p) {
  const ew = p.x >= 0 ? `E ${p.x}` : `W ${Math.abs(p.x)}`;
  const ns = p.y >= 0 ? `N ${p.y}` : `S ${Math.abs(p.y)}`;
  const ud = p.z >= 0 ? `U ${p.z}` : `D ${Math.abs(p.z)}`;
  return `${ew}mm ${ns}mm ${ud}mm`;
}
function normalizeRawType(type) { return text(type || 'PIPE').toUpperCase().replace(/\s+/g, '_'); }
function viewerTypeFor(rawType) {
  const textValue = normalizeRawType(rawType);
  if (/BEND|ELBO/.test(textValue)) return 'BEND';
  if (/VALVE|VALV/.test(textValue)) return 'VALV';
  if (/FLANGE|FLAN/.test(textValue)) return 'FLAN';
  if (/TEE/.test(textValue)) return 'TEE';
  if (/REDU/.test(textValue)) return 'REDU';
  return 'PIPE';
}
function resolveField(attrs, key, ctx) {
  const raw = attrs[key];
  if (!isUnset(raw)) {
    ctx[key] = raw;
    return { value: raw, source: 'explicit' };
  }
  if (ctx[key] != null) return { value: ctx[key], source: 'inherited' };
  return { value: '', source: 'missing' };
}
function axisText(axis = {}) {
  const ax = Math.abs(Number(axis.x) || 0), ay = Math.abs(Number(axis.y) || 0), az = Math.abs(Number(axis.z) || 0);
  if (ax >= ay && ax >= az) return 'X';
  if (ay >= ax && ay >= az) return 'Y';
  return 'Z';
}
function tangent(element = {}) {
  const dx = Number(element.dx) || 0, dy = Number(element.dy) || 0, dz = Number(element.dz) || 0;
  const len = Math.hypot(dx, dy, dz);
  return len > 1e-9 ? { x: dx / len, y: dy / len, z: dz / len } : { x: 0, y: 1, z: 0 };
}
function supportKind(restraint = {}, pipeAxis = { x: 0, y: 1, z: 0 }) {
  const type = String(Number(restraint.TYPE));
  if (['1', '7'].includes(type)) return { kind: 'GUIDE', source: 'caesar-type-code' };
  if (['3', '10', '18'].includes(type)) return { kind: 'LINESTOP', source: 'caesar-type-code' };
  if (['0', '2', '17'].includes(type)) return { kind: 'REST', source: 'caesar-type-code' };
  const axis = { x: num(restraint.XCOSINE, 0), y: num(restraint.YCOSINE, 0), z: num(restraint.ZCOSINE, 0) };
  if (Math.abs(axis.y) > 0.75) return { kind: 'REST', source: 'cosine-y' };
  const align = Math.abs(axis.x * pipeAxis.x + axis.y * pipeAxis.y + axis.z * pipeAxis.z);
  if (align > 0.72) return { kind: 'LINESTOP', source: 'cosine-pipe-axis' };
  if (Math.hypot(axis.x, axis.y, axis.z) > 0.2) return { kind: 'GUIDE', source: 'cosine-lateral' };
  return { kind: 'REST', source: 'default-rest' };
}
function supportDirection(kind, pipeAxis) {
  if (kind === 'REST') return 'Y';
  if (kind === 'GUIDE') return 'PIPE_NORMAL';
  if (kind === 'LINESTOP') return `PIPE_AXIS_${axisText(pipeAxis)}`;
  return 'SUPPORT';
}
function attachResolved(attrs, key, resolved) {
  attrs[key] = resolved.value;
  attrs[`${key}_SOURCE`] = resolved.source;
}

export function buildInputXmlDirectManagedStageJson(xmlText, options = {}) {
  const xml = String(xmlText || '');
  if (!/<CAESARII\b/i.test(xml) || !/<PIPINGMODEL\b/i.test(xml)) throw new Error('Input is not a CAESAR II InputXML document.');
  const sourceName = text(options.sourceName || 'input.xml');
  const modelAttrs = collectBlocks(xml, 'PIPINGMODEL')[0]?.attrs || {};
  const owner = branchName(sourceName);
  const piping = collectBlocks(xml, 'PIPINGELEMENT');
  const allRestraints = collectBlocks(xml, 'RESTRAINT').map((row, index) => ({ ...row.attrs, _rowIndex: index + 1 }));
  const blankRestraints = allRestraints.filter((r) => isUnset(r.NODE) || isUnset(r.TYPE));
  const validRestraints = allRestraints.filter((r) => !isUnset(r.NODE) && !isUnset(r.TYPE));
  const nodes = new Map();
  const elements = [];
  const ctx = {};
  let cursor = point(0, 0, 0);

  const ensureNode = (id, pos) => {
    const key = normNode(id);
    if (!key) return null;
    if (!nodes.has(key)) nodes.set(key, { id: key, ...pos });
    return nodes.get(key);
  };

  for (const [index, block] of piping.entries()) {
    const a = block.attrs;
    const fromNode = normNode(a.FROM_NODE || index * 10 + 10);
    const toNode = normNode(a.TO_NODE || index * 10 + 20);
    const dx = isUnset(a.DELTA_X) ? 0 : num(a.DELTA_X, 0);
    const dy = isUnset(a.DELTA_Y) ? 0 : num(a.DELTA_Y, 0);
    const dz = isUnset(a.DELTA_Z) ? 0 : num(a.DELTA_Z, 0);
    const from = nodes.get(fromNode) || ensureNode(fromNode, cursor) || cursor;
    const to = ensureNode(toNode, point(from.x + dx, from.y + dy, from.z + dz));
    cursor = point(to.x, to.y, to.z);
    const rigid = firstChildAttrs(block.body, 'RIGID');
    const bend = firstChildAttrs(block.body, 'BEND');
    const sifs = childAttrs(block.body, 'SIF');
    const rawType = rigid?.TYPE || (bend ? 'BEND' : 'PIPE');
    const cleanType = normalizeRawType(rawType);
    const type = viewerTypeFor(rawType);
    const id = `PE_${String(index + 1).padStart(3, '0')}_${cleanType}_${fromNode}_TO_${toNode}`;
    const attrs = {
      TYPE: type,
      RAW_TYPE: text(rawType || type),
      NAME: id,
      REF: id,
      OWNER: owner,
      SOURCE_FORMAT: 'INPUTXML_DIRECT_MANAGED_STAGE',
      SOURCE_CONVERTER: 'INPUTXML->STAGEDJSON',
      SOURCE_ELEMENT_ID: id,
      SOURCE_XML_INDEX: index + 1,
      SOURCE_XML_NAME: text(a.NAME || ''),
      FROM_NODE: fromNode,
      TO_NODE: toNode,
      APOS: point(from.x, from.y, from.z),
      LPOS: point(to.x, to.y, to.z),
      DELTA_X: dx,
      DELTA_Y: dy,
      DELTA_Z: dz,
      DTXR: cleanType,
    };
    for (const key of ['DIAMETER', 'WALL_THICK', 'INSUL_THICK', 'CORR_ALLOW', 'TEMP_EXP_C1', 'TEMP_EXP_C2', 'TEMP_EXP_C3', 'PRESSURE1', 'PRESSURE2', 'PRESSURE3', 'HYDRO_PRESSURE', 'MODULUS', 'HOT_MOD1', 'HOT_MOD2', 'POISSONS', 'PIPE_DENSITY', 'INSUL_DENSITY', 'FLUID_DENSITY', 'MATERIAL_NUM', 'MATERIAL_NAME']) {
      attachResolved(attrs, key, resolveField(a, key, ctx));
    }
    attrs.BORE = formatMm(attrs.DIAMETER, 100);
    attrs.ABORE = attrs.BORE;
    attrs.LBORE = attrs.BORE;
    attrs.MATERIAL = attrs.MATERIAL_NAME;
    if (rigid) {
      attrs.RIGID_TYPE = text(rigid.TYPE || 'Rigid');
      attrs.RIGID_WEIGHT = isUnset(rigid.WEIGHT) ? '' : rigid.WEIGHT;
      attrs.SOURCE_RIGID_ATTRS = rigid;
    }
    if (bend) {
      attrs.BEND_RADIUS = isUnset(bend.RADIUS) ? '' : bend.RADIUS;
      attrs.BEND_ANGLE = isUnset(bend.ANGLE1) ? '' : bend.ANGLE1;
      attrs.BEND_NODE1 = isUnset(bend.NODE1) ? '' : normNode(bend.NODE1);
      attrs.BEND_ANGLE2 = isUnset(bend.ANGLE2) ? '' : bend.ANGLE2;
      attrs.BEND_NODE2 = isUnset(bend.NODE2) ? '' : normNode(bend.NODE2);
      const bendLengthMm = bendElementLengthInMm(bend.RADIUS, bend.ANGLE1);
      attrs.BEND_ELEMENT_LENGTH_MM = bendLengthMm ?? '';
      attrs.ELEMENT_LENGTH_IN_MM = bendLengthMm ?? '';
      attrs.ElementLengthInMm = bendLengthMm ?? '';
      attrs.ELBOW_ARC_LENGTH_MM = bendLengthMm ?? '';
      attrs.BEND_ELEMENT_LENGTH_SOURCE = bendLengthMm == null ? 'missing-radius-or-angle' : 'bend-radius-times-angle-radians';
      attrs.SOURCE_BEND_ATTRS = bend;
    } else {
      attrs.BEND_RADIUS = '';
      attrs.BEND_ANGLE = '';
      attrs.BEND_ELEMENT_LENGTH_MM = '';
      attrs.ELEMENT_LENGTH_IN_MM = '';
      attrs.ElementLengthInMm = '';
      attrs.ELBOW_ARC_LENGTH_MM = '';
      attrs.BEND_ELEMENT_LENGTH_SOURCE = 'not-bend';
    }
    if (sifs.length) {
      attrs.SIF_COUNT = sifs.length;
      attrs.SIF_ENTRIES = sifs;
    }
    elements.push({ id, fromNode, toNode, dx, dy, dz, attrs, from, to, rawType, type });
  }

  const elementAtNode = (nodeId) => elements.find((el) => el.fromNode === nodeId || el.toNode === nodeId) || elements[0];
  const supportNameCounts = new Map();
  const supports = validRestraints.map((r) => {
    const nodeId = normNode(r.NODE);
    const node = nodes.get(nodeId);
    if (!node) return null;
    const host = elementAtNode(nodeId);
    const pipeAxis = tangent(host);
    const kindInfo = supportKind(r, pipeAxis);
    const sourceTag = text(r.TAG || '');
    const baseTag = sourceTag || `INPUTXML-${nodeId}-${kindInfo.kind}`;
    const count = (supportNameCounts.get(baseTag) || 0) + 1;
    supportNameCounts.set(baseTag, count);
    const tag = count > 1 ? `${baseTag}-R${r._rowIndex}` : baseTag;
    return {
      name: `SUPPORT ${tag}`,
      type: 'ATTA',
      attributes: {
        TYPE: 'ATTA', RAW_TYPE: 'ATTA', NAME: tag, REF: `INPUTXML_RESTRAINT_${r._rowIndex}`,
        OWNER: owner, SOURCE_FORMAT: 'INPUTXML_DIRECT_MANAGED_STAGE', SOURCE_CONVERTER: 'INPUTXML->STAGEDJSON',
        SOURCE_RESTRAINT_ID: `INPUTXML_RESTRAINT_${r._rowIndex}`, SOURCE_RESTRAINT_ROW_INDEX: r._rowIndex, SOURCE_RESTRAINT_NUM: text(r.NUM || ''), SOURCE_RESTRAINT_TYPE: text(r.TYPE || ''), SOURCE_TAG: sourceTag,
        SUPPORT_TAG: tag, SUPPORT_KIND: kindInfo.kind, SUPPORT_KIND_SOURCE: kindInfo.source, SUPPORT_MAPPER_KIND: kindInfo.kind, SUPPORT_TYPE: kindInfo.kind, CMPSUPTYPE: kindInfo.kind, MDSSUPPTYPE: kindInfo.kind,
        NODE: nodeId, POS: point(node.x, node.y, node.z), SUPPORTCOORD: point(node.x, node.y, node.z), SUPPORT_COORD: point(node.x, node.y, node.z), LBOP: directionalPoint(node),
        PIPE_AXIS: axisText(pipeAxis), ROUTE_AXIS: axisText(pipeAxis), SUPPORT_DIRECTION: supportDirection(kindInfo.kind, pipeAxis),
        ATTACHED_PIPE_BORE: formatMm(host?.attrs?.DIAMETER, 100), ATTACHED_PIPE_OD: formatMm(host?.attrs?.DIAMETER, 100),
        SUPPORT_GAP_MM: finiteOrNull(r.GAP) ?? '', GAP: finiteOrNull(r.GAP) ?? '', X_COSINE: num(r.XCOSINE, 0), Y_COSINE: num(r.YCOSINE, 0), Z_COSINE: num(r.ZCOSINE, 0), SOURCE_RESTRAINT_ATTRS: r,
      },
    };
  }).filter(Boolean);

  const children = [...elements.map((el) => ({ name: `${el.type} ${el.id}`, type: el.type, attributes: el.attrs })), ...supports];
  const first = elements[0];
  const last = elements[elements.length - 1] || first;
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: sourceName,
    converter: 'INPUTXML->STAGEDJSON',
    converterSchema: DIRECT_SCHEMA,
    generatedAt: new Date().toISOString(),
    units: { length: 'mm' },
    sourceHeader: { JOBNAME: modelAttrs.JOBNAME || '', TIME: modelAttrs.TIME || '', VERSION: (attrsFrom(xml.match(/<CAESARII\b([^>]*)>/i)?.[1] || '').VERSION || '') },
    stats: {
      components: elements.length, componentRows: piping.length, restraintRows: allRestraints.length, validRestraints: validRestraints.length, blankRestraintRows: blankRestraints.length, emittedSupports: supports.length,
      bends: elements.filter((e) => e.type === 'BEND').length, bendElementLengthRows: elements.filter((e) => e.attrs.BEND_ELEMENT_LENGTH_MM !== '').length, rigids: elements.filter((e) => e.attrs.RIGID_TYPE).length, sifElements: elements.filter((e) => e.attrs.SIF_COUNT).length,
      branches: 1, children: children.length,
    },
    audit: {
      sourceCounts: { NUMELT: modelAttrs.NUMELT || '', NUMBEND: modelAttrs.NUMBEND || '', NUMRIGID: modelAttrs.NUMRIGID || '', NUMREST: modelAttrs.NUMREST || '', NUMISECT: modelAttrs.NUMISECT || '' },
      conversionPolicy: 'direct InputXML parse; no GLB scene side effects; invalid restraint placeholder rows are counted but not emitted',
      retainedFields: ['rigid weight/type', 'bend angle/radius/nodes/element length', 'SIF entries', 'hydro/pressure/temp/material/density fields', 'source restraint tag and cosines'],
    },
    hierarchy: [{
      name: owner,
      type: 'BRANCH',
      attributes: {
        TYPE: 'BRAN', NAME: owner, OWNER: '/INPUTXML', SOURCE_FORMAT: 'INPUTXML_DIRECT_MANAGED_STAGE', SOURCE_CONVERTER: 'INPUTXML->STAGEDJSON', SOURCE_FILE: sourceName,
        HPOS: first ? point(first.from.x, first.from.y, first.from.z) : null, TPOS: last ? point(last.to.x, last.to.y, last.to.z) : null,
        HBORE: first ? formatMm(first.attrs.DIAMETER, 100) : '', TBORE: last ? formatMm(last.attrs.DIAMETER, 100) : '',
      },
      children,
    }],
  };
}
