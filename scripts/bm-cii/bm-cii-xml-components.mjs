const SENTINEL = -1.0101;
const EPS = 1e-9;

function text(value) { return String(value ?? '').trim(); }
function attrs(src = '') { const out = {}; const re = /([A-Za-z0-9_:\-.]+)="([^"]*)"/g; let m; while ((m = re.exec(src))) out[m[1]] = m[2]; return out; }
function num(value) { const n = Number(value); return Number.isFinite(n) && Math.abs(n - SENTINEL) >= 1e-4 ? n : null; }
function nodeLabel(value) { const n = num(value); return n === null ? '' : String(Math.round(n)); }
function point(value, bore = undefined) { if (!value || typeof value !== 'object') return null; const x = Number(value.x ?? value[0]); const y = Number(value.y ?? value[1]); const z = Number(value.z ?? value[2]); return [x, y, z].every(Number.isFinite) ? (bore ? { x, y, z, bore } : { x, y, z }) : null; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function mul(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a) { const l = a ? len(a) : 0; return l > EPS ? mul(a, 1 / l) : null; }

function categoryForType(type) {
  const raw = text(type).toUpperCase();
  if (raw === 'PIPE' || raw === 'COUPLING' || raw === 'UNION') return 'pipe';
  if (raw === 'BEND' || raw === 'ELBOW') return 'bend';
  if (raw === 'VALVE') return 'valve';
  if (raw === 'FLANGE') return 'flange';
  if (raw === 'TEE' || raw === 'OLET') return 'teeOlet';
  if (raw === 'REDUCER' || raw.startsWith('REDUCER-')) return 'other';
  return 'other';
}

function classifyRigidType(rawType = '') {
  const raw = text(rawType).toUpperCase();
  if (/VALVE|\bVGT\b|\bVGL\b|\bVBA\b|\bVCH\b/.test(raw)) return 'VALVE';
  if (/FLANGE|\bFLG\b/.test(raw)) return 'FLANGE';
  if (/BEND|ELBOW|\bELB\b/.test(raw)) return 'BEND';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(raw)) return 'TEE';
  if (/REDUC/.test(raw)) return 'REDUCER';
  if (/COUPLING|UNION/.test(raw)) return 'COUPLING';
  return 'COUPLING';
}

function parseElements(xml = '') {
  const elements = [];
  const elementRe = /<PIPINGELEMENT\b([^>]*)(?:\/>|>([\s\S]*?)<\/PIPINGELEMENT>)/g;
  let inheritedDiameter = null;
  let m;
  while ((m = elementRe.exec(xml))) {
    const head = attrs(m[1]);
    const block = m[2] || '';
    const from = nodeLabel(head.FROM_NODE);
    const to = nodeLabel(head.TO_NODE);
    if (!from || !to) continue;
    const diameter = num(head.DIAMETER);
    if (diameter && diameter > 0) inheritedDiameter = diameter;
    const rigids = [];
    const rigidRe = /<RIGID\b([^>]*)\/?\s*>/g;
    let r;
    while ((r = rigidRe.exec(block))) rigids.push(attrs(r[1]));
    const bends = [];
    const bendRe = /<BEND\b([^>]*)\/?\s*>/g;
    let b;
    while ((b = bendRe.exec(block))) bends.push(attrs(b[1]));
    elements.push({ index: elements.length + 1, from, to, head, diameter: diameter ?? inheritedDiameter, rigids, bends });
  }
  return elements;
}

function pipeComponentFromSegment(segment) {
  if (!segment.p1 || !segment.p2 || !segment.diameter) return null;
  const bore = Number(segment.diameter);
  return {
    id: `BM_CII_XML_PIPE_${String(segment.elementIndex).padStart(3, '0')}_${segment.from}_${segment.to}`,
    type: 'PIPE',
    source: 'inputxml',
    fromNode: String(segment.from),
    toNode: String(segment.to),
    bore,
    ep1: point(segment.p1, bore),
    ep2: point(segment.p2, bore),
    raw: { SOURCE: 'BM_CII_INPUT.XML', ELEMENT_INDEX: segment.elementIndex, FROM_NODE: segment.from, TO_NODE: segment.to, DIAMETER: bore },
    attributes: { SOURCE: 'BM_CII_INPUT.XML', COMPONENT_KIND: 'PIPE', ELEMENT_INDEX: String(segment.elementIndex) },
  };
}

function rigidComponentFromElement(element, rigid, segment, rigidIndex) {
  if (!segment?.p1 || !segment?.p2 || !segment?.diameter) return null;
  const rawType = rigid.TYPE || rigid.Type || rigid.DESCRIPTION || rigid.TYPE_DESC || '';
  const type = classifyRigidType(rawType);
  const bore = Number(segment.diameter);
  const suffix = `${String(element.index).padStart(3, '0')}_${element.from}_${element.to}_${String(rigidIndex + 1).padStart(2, '0')}`;
  return {
    id: `BM_CII_XML_RIGID_${suffix}_${type}`,
    type,
    source: 'inputxml',
    componentType: 'RIGID',
    typeDesc: rawType,
    fromNode: element.from,
    toNode: element.to,
    bore,
    ep1: point(segment.p1, bore),
    ep2: point(segment.p2, bore),
    raw: { ...rigid, SOURCE: 'BM_CII_INPUT.XML', ELEMENT_INDEX: element.index, FROM_NODE: element.from, TO_NODE: element.to, DIAMETER: bore, RIGID_TYPE: rawType },
    attributes: { SOURCE: 'BM_CII_INPUT.XML', COMPONENT_KIND: type, COMPONENT_TYPE: 'RIGID', TYPE: rawType, ELEMENT_INDEX: String(element.index) },
  };
}

function bendComponentFromElement(element, bend, segment, bendIndex) {
  if (!segment?.p1 || !segment?.p2 || !segment?.diameter) return null;
  const bore = Number(segment.diameter);
  const bendRadius = num(bend.RADIUS ?? bend.BEND_RADIUS ?? bend.CURVE_RADIUS);
  const bendAngleDeg = num(bend.ANGLE ?? bend.BEND_ANGLE);
  return {
    id: `BM_CII_XML_BEND_${String(element.index).padStart(3, '0')}_${element.from}_${element.to}_${String(bendIndex + 1).padStart(2, '0')}`,
    type: 'BEND',
    source: 'inputxml',
    fromNode: element.from,
    toNode: element.to,
    bore,
    ep1: point(segment.p1, bore),
    ep2: point(segment.p2, bore),
    bendRadius,
    bendAngleDeg,
    bendMetadataSource: 'BM_CII_INPUT.XML/BEND',
    bmCiiRequiresCurvedGeometry: true,
    raw: { ...bend, SOURCE: 'BM_CII_INPUT.XML', ELEMENT_INDEX: element.index, FROM_NODE: element.from, TO_NODE: element.to, DIAMETER: bore },
    attributes: {
      SOURCE: 'BM_CII_INPUT.XML',
      COMPONENT_KIND: 'BEND',
      COMPONENT_TYPE: 'BEND',
      ELEMENT_INDEX: String(element.index),
      BEND_METADATA_SOURCE: 'BM_CII_INPUT.XML/BEND',
      BEND_MUST_RENDER_CURVED: 'true',
    },
  };
}

function outwardDirectionFromNode(segment, node) {
  const p1 = point(segment.p1); const p2 = point(segment.p2); if (!p1 || !p2) return null;
  if (String(segment.from) === String(node)) return norm(sub(p2, p1));
  if (String(segment.to) === String(node)) return norm(sub(p1, p2));
  return null;
}

function chooseTeeLegs(usable = []) {
  let best = null;
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const d = dot(usable[i].direction, usable[j].direction);
      if (!best || d < best.dot) best = { a: usable[i], b: usable[j], dot: d };
    }
  }
  if (!best) return null;
  const branch = usable
    .filter((entry) => entry !== best.a && entry !== best.b)
    .sort((a, b) => Number(b.segment.length || 0) - Number(a.segment.length || 0))[0];
  return branch ? { mainA: best.a, mainB: best.b, branch, mainOppositionDot: best.dot } : null;
}

function teeComponentsFromConnectivity(segments = []) {
  const byNode = new Map();
  for (const segment of segments) {
    if (!segment?.p1 || !segment?.p2 || !segment?.diameter) continue;
    for (const node of [segment.from, segment.to]) { const key = String(node); if (!byNode.has(key)) byNode.set(key, []); byNode.get(key).push(segment); }
  }
  const components = [];
  for (const [node, connected] of byNode.entries()) {
    const usable = connected.map((segment) => ({ segment, direction: outwardDirectionFromNode(segment, node) })).filter((entry) => entry.direction);
    if (usable.length < 3) continue;
    const chosen = chooseTeeLegs(usable);
    if (!chosen) continue;
    const center = String(chosen.mainA.segment.from) === node ? point(chosen.mainA.segment.p1) : point(chosen.mainA.segment.p2);
    const bore = Number(chosen.mainA.segment.diameter || chosen.mainB.segment.diameter || chosen.branch.segment.diameter);
    if (!center || !Number.isFinite(bore) || bore <= 0) continue;
    const radius = bore / 2;
    const reach = Math.max(radius * 5, Math.min(220, Math.max(...[chosen.mainA, chosen.mainB, chosen.branch].map((entry) => Number(entry.segment.length || 0))) * 0.22));
    components.push({
      id: `BM_CII_XML_TEE_NODE_${node}`,
      type: 'TEE',
      source: 'inputxml',
      node,
      bore,
      centrePoint: point(center, bore),
      ep1: point(add(center, mul(chosen.mainA.direction, reach)), bore),
      ep2: point(add(center, mul(chosen.mainB.direction, reach)), bore),
      branch1Point: point(add(center, mul(chosen.branch.direction, reach)), bore),
      bmCiiConnectivityDerived: true,
      raw: { SOURCE: 'BM_CII_INPUT.XML', NODE: node, COMPONENT_KIND: 'TEE', CONNECTED_ELEMENTS: usable.map((entry) => entry.segment.elementIndex).join(','), MAIN_OPPOSITION_DOT: chosen.mainOppositionDot },
      attributes: { SOURCE: 'BM_CII_INPUT.XML', COMPONENT_KIND: 'TEE', COMPONENT_TYPE: 'BRANCH_TEE', NODE: node, TEE_MAIN_OPPOSITION_DOT: String(chosen.mainOppositionDot) },
    });
  }
  return components;
}

function summaryForComponents(components = []) {
  const byType = {}; const byCategory = {};
  let nonPipeTotal = 0;
  for (const component of components) {
    const type = text(component.type || 'UNKNOWN').toUpperCase();
    const category = categoryForType(type);
    byType[type] = (byType[type] || 0) + 1;
    byCategory[category] = (byCategory[category] || 0) + 1;
    if (category !== 'pipe') nonPipeTotal += 1;
  }
  return { total: components.length, byType, byCategory, nonPipeTotal };
}

export function componentsFromBmCiiXml(xml = '', frameIndex = {}) {
  const segments = Array.isArray(frameIndex.segments) ? frameIndex.segments : [];
  const segmentByIndex = new Map(segments.map((segment) => [Number(segment.elementIndex), segment]));
  const elements = parseElements(xml);
  const bendElementIndexes = new Set(elements.filter((element) => element.bends.length).map((element) => Number(element.index)));
  const components = [];

  // A CAESAR bend element already represents the bend geometry. Do not also export
  // a full straight pipe through the same chord, because it visually masks the curved bend.
  for (const segment of segments) {
    if (bendElementIndexes.has(Number(segment.elementIndex))) continue;
    const pipe = pipeComponentFromSegment(segment);
    if (pipe) components.push(pipe);
  }

  for (const element of elements) {
    const segment = segmentByIndex.get(Number(element.index));
    element.rigids.forEach((rigid, index) => { const component = rigidComponentFromElement(element, rigid, segment, index); if (component) components.push(component); });
    element.bends.forEach((bend, index) => { const component = bendComponentFromElement(element, bend, segment, index); if (component) components.push(component); });
  }
  components.push(...teeComponentsFromConnectivity(segments));
  const unique = []; const seen = new Set();
  for (const component of components) { if (!component?.id || seen.has(component.id)) continue; seen.add(component.id); unique.push(component); }
  return {
    components: unique,
    sourceStats: {
      elements: elements.length,
      xmlRigidRows: elements.reduce((sum, element) => sum + element.rigids.length, 0),
      xmlBendRows: elements.reduce((sum, element) => sum + element.bends.length, 0),
      pipeSegmentsSkippedForCurvedBends: bendElementIndexes.size,
      derivedBranchTees: unique.filter((component) => /^BM_CII_XML_TEE_NODE_/.test(component.id)).length,
    },
    summary: summaryForComponents(unique),
  };
}
