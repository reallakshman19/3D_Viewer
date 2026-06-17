const EPS = 1e-9;

function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }
function num(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function tagBlocks(xmlText, tagName) {
  const name = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blocks = [];
  // self-closing first so pair regex below skips them
  const self = new RegExp(`<${name}\\b([^>]*?)\\s*\\/>`, 'gi');
  const selfPositions = new Set();
  let match;
  while ((match = self.exec(xmlText))) {
    blocks.push({ attrsText: match[1] || '', body: '', full: match[0] || '' });
    selfPositions.add(match.index);
  }
  // pair tags: exclude those starting at a self-closing position
  const pair = new RegExp(`<${name}\\b([^>]*[^/])>([\\s\\S]*?)<\\/${name}>`, 'gi');
  while ((match = pair.exec(xmlText))) {
    if (!selfPositions.has(match.index)) blocks.push({ attrsText: match[1] || '', body: match[2] || '', full: match[0] || '' });
  }
  return blocks.sort((a, b) => xmlText.indexOf(a.full) - xmlText.indexOf(b.full));
}

function attrs(attrsText = '') {
  const out = {};
  for (const re of [/([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g, /([A-Za-z_][\w:.-]*)\s*=\s*'([^']*)'/g]) {
    let m;
    while ((m = re.exec(attrsText))) {
      const key = m[1].split(':').pop().toUpperCase();
      if (!(key in out)) out[key] = m[2];
    }
  }
  return out;
}

function childTags(body = '') {
  const result = [];
  const re = /<([A-Za-z_][\w:.-]*)\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(body))) {
    const name = m[1].split(':').pop().toUpperCase();
    if (name !== 'PIPINGELEMENT') result.push({ name, attrs: attrs(m[2] || '') });
  }
  return result;
}

function point(x = 0, y = 0, z = 0) { return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }; }
function addPoint(a, b) { return point(a.x + b.x, a.y + b.y, a.z + b.z); }
function deltaFromAttrs(a) { return point(num(a.DELTA_X ?? a.DX), num(a.DELTA_Y ?? a.DY), num(a.DELTA_Z ?? a.DZ)); }
function nodeKey(value, fallback) { return text(value) || fallback; }

function classifyElement(a, children = []) {
  const childNames = new Set(children.map((c) => c.name));
  const rawType = upper(a.COMPONENTTYPE || a.COMPONENT_TYPE || a.TYPE || a.NAME || a.DESCRIPTION || '');
  const hay = `${rawType} ${children.map((c) => c.name).join(' ')}`;
  if (childNames.has('BEND') || /\bBEND\b|ELBOW/.test(hay)) return 'BEND';
  if (childNames.has('TEE') || /\bTEE\b/.test(hay)) return 'TEE';
  if (childNames.has('OLET') || /\bOLET\b|WELDOLET|SOCKOLET/.test(hay)) return 'OLET';
  if (childNames.has('VALVE') || /\bVALVE\b|GATE|GLOBE|BALL|CHECK|VGT|VGL|VBA|VCH/.test(hay)) return 'VALVE';
  if (childNames.has('FLANGE') || /\bFLANGE\b|\bFLG\b/.test(hay)) return 'FLANGE';
  if (childNames.has('RIGID') || /\bRIGID\b/.test(hay)) return 'RIGID';
  return 'PIPE';
}

function supportKind(tagName, a = {}) {
  const raw = upper(`${tagName} ${a.KIND || ''} ${a.TYPE || ''} ${a.DESCRIPTION || ''} ${a.NAME || ''}`);
  if (/HANGER|SPRING/.test(raw)) return 'HANGER';
  if (/ANCHOR|ANC/.test(raw)) return 'ANCHOR';
  if (/LINE\s*STOP|LINESTOP|LIMIT/.test(raw)) return 'LINESTOP';
  if (/GUIDE|GUID/.test(raw)) return 'GUIDE';
  if (/HOLD\s*DOWN|HOLDDOWN/.test(raw)) return 'HOLDDOWN';
  if (/REST|SHOE|SUPPORT|TYPE="?17"?/.test(raw)) return 'REST';
  return tagName === 'HANGER' ? 'HANGER' : 'UNKNOWN';
}

function extractSupports(element, children) {
  const supports = [];
  for (const child of children) {
    if (!['RESTRAINT', 'HANGER', 'SUPPORT'].includes(child.name)) continue;
    const a = child.attrs || {};
    supports.push({
      id: `SUP-${element.index}-${supports.length + 1}`,
      sourceElementIndex: element.index,
      node: nodeKey(a.NODE || a.CNODE || a.FROM_NODE || element.toNode, element.toNode),
      kind: supportKind(child.name, a),
      rawTag: child.name,
      xcosine: num(a.XCOSINE, NaN),
      ycosine: num(a.YCOSINE, NaN),
      zcosine: num(a.ZCOSINE, NaN),
      attrs: a,
    });
  }
  return supports;
}

function solveNodeCoordinates(elements, diagnostics) {
  const coords = new Map();
  if (elements[0]?.fromNode) coords.set(elements[0].fromNode, point(0, 0, 0));
  let changed = true;
  for (let pass = 0; pass < Math.max(4, elements.length + 2) && changed; pass += 1) {
    changed = false;
    for (const e of elements) {
      const from = coords.get(e.fromNode);
      const to = coords.get(e.toNode);
      if (from && !to) { coords.set(e.toNode, addPoint(from, e.delta)); changed = true; }
      else if (!from && to) { coords.set(e.fromNode, point(to.x - e.delta.x, to.y - e.delta.y, to.z - e.delta.z)); changed = true; }
    }
  }
  for (const e of elements) {
    if (!coords.has(e.fromNode)) {
      diagnostics.push({ severity: 'WARN', code: 'UNSOLVED_FROM_NODE', message: `Node ${e.fromNode} was not connected to solved chain.` });
      coords.set(e.fromNode, point(0, 0, 0));
    }
    if (!coords.has(e.toNode)) {
      diagnostics.push({ severity: 'WARN', code: 'UNSOLVED_TO_NODE', message: `Node ${e.toNode} was not connected to solved chain.` });
      coords.set(e.toNode, addPoint(coords.get(e.fromNode), e.delta));
    }
    e.start = coords.get(e.fromNode);
    e.end = coords.get(e.toNode);
  }
  return coords;
}

function statsFor(elements, supports, coords) {
  const typeCounts = {};
  for (const e of elements) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  const supportKindCounts = {};
  for (const s of supports) supportKindCounts[s.kind] = (supportKindCounts[s.kind] || 0) + 1;
  return { elementCount: elements.length, nodeCount: coords.size, supportCount: supports.length, typeCounts, supportKindCounts };
}

export function parseInputXmlBasic(xmlText, options = {}) {
  const diagnostics = [];
  const source = text(options.sourceName || options.fileName || 'input.xml');
  const blocks = tagBlocks(xmlText, 'PIPINGELEMENT');
  const elements = blocks.map((block, index) => {
    const a = attrs(block.attrsText);
    const children = childTags(block.body);
    const fromNode = nodeKey(a.FROM_NODE || a.FROMNODE || a.FROM || a.NODE1, `E${index + 1}A`);
    const toNode = nodeKey(a.TO_NODE || a.TONODE || a.TO || a.NODE2, `E${index + 1}B`);
    const diameter = Math.max(num(a.DIAMETER ?? a.OUTSIDE_DIAMETER ?? a.OD, 50), 1);
    return { id: `IXB-E-${String(index + 1).padStart(4, '0')}-${fromNode}-${toNode}`, index: index + 1, fromNode, toNode, diameter, type: classifyElement(a, children), delta: deltaFromAttrs(a), attrs: a, childTags: children, start: null, end: null };
  });
  if (!elements.length) diagnostics.push({ severity: 'ERROR', code: 'NO_PIPINGELEMENT', message: 'No PIPINGELEMENT tags found in Input XML.' });
  const coords = solveNodeCoordinates(elements, diagnostics);
  const supports = elements.flatMap((element) => extractSupports(element, element.childTags));
  return { schema: 'inputxml-basic-glb-model/v1', source, elements, nodes: Object.fromEntries([...coords.entries()].map(([key, value]) => [key, value])), supports, diagnostics, stats: statsFor(elements, supports, coords) };
}

export const __private__ = { attrs, childTags, classifyElement, tagBlocks, supportKind, solveNodeCoordinates };
