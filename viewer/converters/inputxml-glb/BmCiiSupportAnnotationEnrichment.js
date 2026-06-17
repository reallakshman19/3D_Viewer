const SENTINELS = new Set(['-1.010100', '-1.0101', '-999', '-999.0', '-9999', '-9999.0']);

const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();

function normalizeNode(value) {
  const raw = text(value);
  const n = Number(raw);
  return raw && Number.isFinite(n) ? String(Math.trunc(n)) : raw;
}

function attrs(raw = '') {
  const out = {};
  for (const match of raw.matchAll(/([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g)) out[match[1]] = match[2];
  return out;
}

function clean(value) {
  const raw = text(value);
  if (!raw || SENTINELS.has(raw)) return '';
  const n = Number(raw);
  if (Number.isFinite(n) && [...SENTINELS].some((s) => Math.abs(n - Number(s)) < 1e-6)) return '';
  return raw;
}

function parsePipeElements(xml = '') {
  const records = [];
  const carry = {};
  const re = /<PIPINGELEMENT\b([^>]*)>([\s\S]*?)<\/PIPINGELEMENT\s*>|<PIPINGELEMENT\b([^>]*)\/>/gi;
  for (const match of xml.matchAll(re)) {
    const a = attrs(match[1] || match[3] || '');
    const body = match[2] || '';
    const raw = {
      bore: a.DIAMETER,
      diameterMm: a.DIAMETER,
      wallThickness: a.WALL_THICK,
      materialThickness: a.WALL_THICK,
      materialName: a.MATERIAL_NAME,
      pressure: a.PRESSURE1,
      hydroPressure: a.HYDRO_PRESSURE,
      temp1: a.TEMP_EXP_C1,
      temp2: a.TEMP_EXP_C2,
      temp3: a.TEMP_EXP_C3,
    };
    const resolved = {};
    const sources = {};
    for (const [key, value] of Object.entries(raw)) {
      const explicit = clean(value);
      if (explicit) {
        resolved[key] = explicit;
        carry[key] = explicit;
        sources[key] = 'explicit InputXML PIPINGELEMENT attribute';
      } else if (carry[key]) {
        resolved[key] = carry[key];
        sources[key] = 'component/process carry-forward from previous PIPINGELEMENT';
      } else {
        resolved[key] = '';
        sources[key] = 'unavailable';
      }
    }
    const rigid = body.match(/<RIGID\b([^>]*)\/?\s*>/i);
    records.push({
      fromNode: normalizeNode(a.FROM_NODE || a.FromNode),
      toNode: normalizeNode(a.TO_NODE || a.ToNode),
      resolved,
      sources,
      rigid: rigid ? attrs(rigid[1]) : {},
    });
  }
  return records;
}

function peParts(id = '') {
  const m = text(id).match(/^PE_(\d+)_.*?_(\d+)_TO_(\d+)/i);
  return m ? { index: Number(m[1]), fromNode: normalizeNode(m[2]), toNode: normalizeNode(m[3]) } : null;
}

function componentRecord(component, records) {
  const a = { ...(component.raw || {}), ...(component.attributes || {}) };
  const p = peParts(component.id || a.COMPONENT_IDENTIFIER || a.pcfId || a.id || '');
  if (!p) return null;
  return records[p.index - 1] || records.find((r) => r.fromNode === p.fromNode && r.toNode === p.toNode) || null;
}

function parseLineNo(raw = '') {
  for (const line of text(raw).split(/\r?\n/)) {
    if (!line.trim() || /^node\s*,/i.test(line)) continue;
    const comma = line.indexOf(',');
    if (comma > 0) return { node: normalizeNode(line.slice(0, comma)), lineNo: text(line.slice(comma + 1)) };
  }
  return { node: '', lineNo: '' };
}

function stampComponentData(model, xml, options) {
  const records = parsePipeElements(xml);
  const { node: lineNoNode, lineNo } = parseLineNo(options.bmCiiLineNoSideloadText);
  let updated = 0;
  for (const component of model.components || []) {
    if (component.type === 'SUPPORT' || component.type === 'NODE_LABEL') continue;
    const record = componentRecord(component, records);
    if (!record) continue;
    const r = record.resolved || {};
    const a = { ...(component.attributes || {}) };
    Object.assign(a, {
      pcfId: component.id,
      id: component.id,
      refNo: component.refNo || component.id,
      fromNode: record.fromNode,
      toNode: record.toNode,
      bore: Number(r.bore) || r.bore || '',
      diameterMm: Number(r.diameterMm) || r.diameterMm || '',
      wallThickness: r.wallThickness || '',
      'Wall Thickness': r.wallThickness || '',
      materialThickness: r.materialThickness || '',
      'Material Thickness': r.materialThickness || '',
      materialName: r.materialName || '',
      Material: r.materialName || '',
      pressure: r.pressure || '',
      Pressure: r.pressure || '',
      hydroPressure: r.hydroPressure || '',
      'Hydro Pressure': r.hydroPressure || '',
      temp1: r.temp1 || '',
      Temp1: r.temp1 || '',
      temp2: r.temp2 || '',
      Temp2: r.temp2 || '',
      temp3: r.temp3 || '',
      Temp3: r.temp3 || '',
      lineNo,
      'Line No': lineNo,
      LINE_NO_SOURCE: lineNo ? 'BM_CII_LINE_NO_sideload' : '',
      LINE_NO_ANCHOR_NODE: lineNoNode,
      LINE_NO_SCOPE: lineNo ? 'node-wise sideload topology carry-forward' : '',
      componentPropertySources: record.sources,
      inputXmlPropertyResolution: 'component/process fields only; restraints/supports are record-scoped and not carry-forward',
      provenanceTrace: 'InputXML -> BM_CII Model Converter -> GLB package',
    });
    if (record.rigid?.TYPE) a.rigidType = record.rigid.TYPE;
    if (record.rigid?.WEIGHT) a.rigidWeight = record.rigid.WEIGHT;
    component.attributes = a;
    component.raw = { ...(component.raw || {}), ...a };
    component.lineNo = lineNo;
    component.fromNode = record.fromNode;
    component.toNode = record.toNode;
    component.bore = Number(r.bore) || component.bore;
    updated += 1;
  }
  if (lineNo) {
    model.lineNo = lineNo;
    model.lineNos = [lineNo];
  }
  return { componentRecords: records.length, componentMetadataUpdated: updated, lineNo };
}

function point(v) {
  if (!v) return null;
  const x = Number(v.x), y = Number(v.y), z = Number(v.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function tangent(a, b) {
  if (!a || !b) return { x: 1, y: 0, z: 0 };
  const x = b.x - a.x, y = b.y - a.y, z = b.z - a.z;
  const d = Math.hypot(x, y, z) || 1;
  return { x: x / d, y: y / d, z: z / d };
}

function dominant(v = {}) {
  const a = { X: Math.abs(v.x || 0), Y: Math.abs(v.y || 0), Z: Math.abs(v.z || 0) };
  return Object.entries(a).sort((x, y) => y[1] - x[1])[0][0];
}

function nodeIndex(model) {
  const map = new Map();
  for (const c of model.components || []) {
    if (c.type === 'SUPPORT' || c.type === 'NODE_LABEL') continue;
    const a = { ...(c.raw || {}), ...(c.attributes || {}) };
    const p = peParts(c.id || a.COMPONENT_IDENTIFIER || '');
    const n1 = normalizeNode(c.fromNode || a.fromNode || p?.fromNode);
    const n2 = normalizeNode(c.toNode || a.toNode || p?.toNode);
    const p1 = point(c.ep1 || c.centrePoint || c.coOrds);
    const p2 = point(c.ep2 || c.branch1Point);
    const t = tangent(p1, p2);
    const bore = Number(c.bore || a.bore || a.DIAMETER) || 100;
    if (n1 && p1) map.set(n1, { point: p1, tangent: t, bore });
    if (n2 && p2) map.set(n2, { point: p2, tangent: t, bore });
  }
  return map;
}

function parseIsonote(raw = '') {
  const rows = [];
  for (const line of text(raw).split(/\r?\n/).map((v) => v.trim()).filter(Boolean)) {
    if (/^node\s*,/i.test(line)) continue;
    const comma = line.indexOf(',');
    if (comma > 0) rows.push({ node: normalizeNode(line.slice(0, comma)), note: text(line.slice(comma + 1)) });
  }
  return rows.filter((r) => r.node && r.note);
}

function load(note, token) {
  const m = note.match(new RegExp(`\\b${token.replace(/\s+/g, '\\s*')}\\s*\\(([^)]*)\\)`, 'i'));
  return m ? text(m[1].split(',')[0]) : '';
}

function gap(note, token) {
  const m = note.match(new RegExp(`\\b${token.replace(/\s+/g, '\\s*')}\\s*\\(([^)]*)\\)`, 'i'));
  const inside = m?.[1]?.match(/\bGAP\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)/i);
  return inside ? inside[1] : '';
}

function guideAxes(t) {
  const d = dominant(t);
  if (d === 'Y') return ['X', 'Z'];
  return d === 'X' ? ['Z'] : ['X'];
}

function cos(axis) {
  const a = axis.replace(/^[+-]/, '').toUpperCase();
  return { XCOSINE: a === 'X' ? '1' : '0', YCOSINE: a === 'Y' ? '1' : '0', ZCOSINE: a === 'Z' ? '1' : '0' };
}

function support({ row, info, kind, family, axis, index, loadText = '', gapValue = '', warning = '' }) {
  const p = info?.point || { x: 0, y: 0, z: 0 };
  const t = info?.tangent || { x: 1, y: 0, z: 0 };
  const attrs = {
    source: 'ISONOTE', SUPPORT_SOURCE: 'ISONOTE', supportSource: 'ISONOTE', sourceMode: warning ? 'WARNING_ISONOTE' : 'EXPECTED_RESTRAINT',
    node: row.node, supportNode: row.node, CAESAR_NODE: row.node,
    kind, supportKind: kind, CMPSUPTYPE: kind, SUPPORT_KIND: kind, FAMILY: family, engineeringFamily: family,
    axis, AXIS: axis, supportAxis: axis, restraintAxis: axis,
    pipeTangent: t, PIPE_TANGENT: `${t.x},${t.y},${t.z}`,
    ...cos(axis || 'X'), GAP: gapValue, gapMm: gapValue, loadText, supportLoadText: loadText,
    SOURCE_NOTE_NAME: row.note, sourceNoteName: row.note, warningText: warning,
    SPRING_WARNING_BELOW_PIPE: kind === 'SPRING' && warning ? 'true' : '', labelText: '',
  };
  const id = `BM_CII_ISONOTE_${String(index).padStart(2, '0')}_NODE_${row.node}_${kind}_${axis || 'NA'}`;
  return { id, type: 'SUPPORT', coOrds: p, ep1: p, bore: Number(info?.bore) || 100, refNo: id, attributes: attrs, raw: attrs, supportKind: kind, supportType: kind, supportSource: 'ISONOTE', supportRecordIndex: index };
}

function appendIsonoteSupports(model, options) {
  const mode = text(options.bmCiiSupportMode).toLowerCase();
  if (!['isonote-expected', 'compare'].includes(mode)) return { isonoteRecords: 0, syntheticSupportsAdded: 0, inputXmlSupportsRemoved: 0 };
  const rows = parseIsonote(options.bmCiiIsonoteSideloadText);
  const nodes = nodeIndex(model);
  const before = model.components.length;
  if (mode === 'isonote-expected') model.components = model.components.filter((c) => c.type !== 'SUPPORT');
  let index = 1;
  const added = [];
  for (const row of rows) {
    const u = upper(row.note);
    const info = nodes.get(row.node);
    const noRest = /REST\s+NOT\s+DEFINED|NO\s+REST|WITHOUT\s+REST/.test(u);
    const noGuide = /WITHOUT\s+GUIDE|NO\s+GUIDE|GUIDE\s+NOT\s+REQUIRED/.test(u);
    if (!noRest && /\bREST\s*\(/i.test(row.note)) added.push(support({ row, info, kind: 'REST', family: 'REST', axis: '+Y', index: index++, loadText: load(row.note, 'REST'), gapValue: gap(row.note, 'REST') }));
    if (!noGuide && /\bGUIDE\b/i.test(row.note)) for (const axis of guideAxes(info?.tangent)) added.push(support({ row, info, kind: 'GUIDE', family: 'GUIDE', axis, index: index++, loadText: load(row.note, 'GUIDE'), gapValue: gap(row.note, 'GUIDE') }));
    if (/\bLINE\s*STOP\b/i.test(row.note)) added.push(support({ row, info, kind: 'LINESTOP', family: 'LINE STOP', axis: dominant(info?.tangent || { z: 1 }), index: index++, loadText: load(row.note, 'LINE STOP'), gapValue: gap(row.note, 'LINE STOP') }));
    if (/\bHOLD\s*DOWN\b|\bHOLDDOWN\b/i.test(row.note)) added.push(support({ row, info, kind: 'HOLDDOWN', family: 'HOLDDOWN', axis: 'Y', index: index++ }));
    if (/\bCAN\s+SPRING\b|\bSPRING\s+CAN\b/i.test(row.note)) added.push(support({ row, info, kind: 'SPRING', family: 'SPRING WARNING', axis: 'Y', index: index++, warning: 'Can Spring / Spring Can warning: review possible spring below pipe.' }));
    for (const m of row.note.matchAll(/\bSINGLE\s+AXIS\s+([XYZ])\b/ig)) {
      const axis = m[1].toUpperCase();
      const decision = upper(options.bmCiiSingleAxisZDecision || 'warning');
      if (decision === `+${axis}` || decision === `-${axis}`) added.push(support({ row, info, kind: 'REST', family: 'AXIS RESTRAINT', axis: decision, index: index++ }));
      else added.push(support({ row, info, kind: 'UNKNOWN', family: 'UNRESOLVED SINGLE AXIS', axis, index: index++, warning: `SINGLE AXIS ${axis} found without +/- sign. Select +${axis} or -${axis}.` }));
    }
  }
  model.components.push(...added);
  return { isonoteRecords: rows.length, syntheticSupportsAdded: added.length, inputXmlSupportsRemoved: before - model.components.length, mode };
}

export function applyBmCiiSupportAnnotationEnrichment(model, xmlText, options = {}) {
  if (!options.bmCiiSupportAnnotationTool) return { enabled: false };
  const componentStats = stampComponentData(model, xmlText, options);
  const supportStats = appendIsonoteSupports(model, options);
  const stats = { schema: 'bm-cii-support-annotation-model-enrichment/v1', enabled: true, ...componentStats, ...supportStats };
  model.bmCiiSupportAnnotationEnrichment = stats;
  return stats;
}
