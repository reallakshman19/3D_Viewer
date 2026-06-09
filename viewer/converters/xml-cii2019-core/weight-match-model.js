function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return fallback;
}

function parseNumericMm(value) {
  const text = toText(value).replace(/mm/gi, ' ').trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function normalizePoint(point) {
  if (point === undefined || point === null || point === '') return null;
  if (Array.isArray(point) && point.length >= 3) {
    const x = Number(point[0]);
    const y = Number(point[1]);
    const z = Number(point[2]);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  if (typeof point === 'object') {
    const x = Number(point.x ?? point.X);
    const y = Number(point.y ?? point.Y);
    const z = Number(point.z ?? point.Z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return { x, y, z };
  }
  const text = toText(point).trim();
  if (!text) return null;
  const tokens = text.split(/\s+/g);
  const directional = { x: 0, y: 0, z: 0 };
  let parsedDirectional = false;
  for (let i = 0; i < tokens.length - 1; i += 2) {
    const axis = tokens[i].toUpperCase();
    const value = parseNumericMm(tokens[i + 1]);
    if (!Number.isFinite(value)) continue;
    if (axis === 'E') { directional.x = value; parsedDirectional = true; }
    else if (axis === 'W') { directional.x = -value; parsedDirectional = true; }
    else if (axis === 'N') { directional.y = value; parsedDirectional = true; }
    else if (axis === 'S') { directional.y = -value; parsedDirectional = true; }
    else if (axis === 'U') { directional.z = value; parsedDirectional = true; }
    else if (axis === 'D') { directional.z = -value; parsedDirectional = true; }
  }
  if (parsedDirectional) return directional;
  const values = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return values.length >= 3 ? { x: values[0], y: values[1], z: values[2] } : null;
}

function pointDistanceMm(a, b) {
  const pa = normalizePoint(a);
  const pb = normalizePoint(b);
  if (!pa || !pb) return null;
  return Math.sqrt(((pa.x - pb.x) ** 2) + ((pa.y - pb.y) ** 2) + ((pa.z - pb.z) ** 2));
}

function rowNumber(row, keys) {
  for (const key of keys) {
    const direct = row?.[key];
    const raw = row?._raw?.[key];
    const numeric = parseNumericMm(direct ?? raw);
    if (numeric !== null) return numeric;
  }
  return null;
}

function rowText(row, keys) {
  for (const key of keys) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (toText(value).trim()) return toText(value).trim();
  }
  return '';
}

function xmlLocalName(node) {
  return toText(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function xmlChildrenByName(parent, localName) {
  return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && xmlLocalName(child) === localName);
}

function xmlFirstChild(parent, localName) {
  return xmlChildrenByName(parent, localName)[0] || null;
}

function xmlText(parent, localName) {
  return toText(xmlFirstChild(parent, localName)?.textContent).trim();
}

function xmlSetText(document, parent, localName, value) {
  let element = xmlFirstChild(parent, localName);
  if (!element) {
    element = parent?.namespaceURI
      ? document.createElementNS(parent.namespaceURI, localName)
      : document.createElement(localName);
    parent.appendChild(element);
  }
  element.textContent = toText(value);
  return element;
}

function walkStagedComponents(value, branchName = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkStagedComponents(item, branchName, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  const attrs = value.attributes && typeof value.attributes === 'object' ? value.attributes : {};
  const type = toText(value.type || attrs.TYPE).toUpperCase();
  const currentBranch = (type === 'BRANCH' || Array.isArray(value.children))
    ? toText(value.name || attrs.NAME || branchName)
    : branchName;
  out.push({ component: value, attrs, branchName: currentBranch });
  if (Array.isArray(value.children)) value.children.forEach((child) => walkStagedComponents(child, currentBranch, out));
  return out;
}

function stagedComponentDtxr(indexed) {
  const attrs = indexed?.attrs || {};
  return toText(attrs.DTXR_POS || attrs.DTXR || attrs.DESC || attrs.DESCRIPTION || attrs.NAME || indexed?.component?.name || '').trim();
}

function xmlPositionKey(positionText, tolerance) {
  const point = normalizePoint(positionText);
  if (!point) return '';
  const tol = toFiniteNumber(tolerance, 1) || 1;
  return [point.x, point.y, point.z].map((value) => Math.round(value / tol)).join('|');
}

function normalizeSupportTag(value) {
  const text = toText(value).trim().toUpperCase().replace(/^\/+/, '');
  const match = text.match(/PS-\d+(?:\.\d+)?/i);
  if (!match) return '';
  return match[0].replace(/\.\d+$/, '');
}

function supportTagsFromText(value) {
  const text = toText(value);
  const tags = new Set();
  for (const match of text.matchAll(/\/?PS-\d+(?:\.\d+)?/ig)) {
    const tag = normalizeSupportTag(match[0]);
    if (tag) tags.add(tag);
  }
  return [...tags];
}

function supportTagsFromAttrs(attrs, componentName = '') {
  const tags = new Set(supportTagsFromText(componentName));
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value && typeof value === 'object') continue;
    for (const tag of supportTagsFromText(`${key} ${value}`)) tags.add(tag);
  }
  return [...tags];
}

function xmlNodeSupportTags(node) {
  const parts = [xmlText(node, 'NodeName'), xmlText(node, 'ComponentRefNo')];
  for (const child of xmlChildrenByName(node, 'SupportTag')) parts.push(toText(child.textContent));
  return [...new Set(parts.flatMap(supportTagsFromText))];
}

export function buildStagedComponentIndex(stagedJsonText, config) {
  const empty = { byCoord: new Map(), byTag: new Map(), count: 0 };
  if (!toText(stagedJsonText).trim()) return empty;
  let parsed = null;
  try {
    parsed = JSON.parse(stagedJsonText);
  } catch {
    return empty;
  }
  const byCoord = new Map();
  const byTag = new Map();
  const tolerance = toFiniteNumber(config.coordinateTolerance, 1);
  let count = 0;
  for (const entry of walkStagedComponents(parsed)) {
    const attrs = entry.attrs || {};
    let point = null;
    for (const key of ['SUPPORTCOORD', 'POS', 'BPOS', 'APOS', 'LPOS', 'CPOS', 'HPOS', 'TPOS']) {
      point = normalizePoint(attrs[key]);
      if (point) break;
    }
    const indexed = { ...entry, point };
    if (point) {
      const coordinateKey = xmlPositionKey(`${point.x} ${point.y} ${point.z}`, tolerance);
      if (coordinateKey) {
        if (!byCoord.has(coordinateKey)) byCoord.set(coordinateKey, []);
        byCoord.get(coordinateKey).push(indexed);
      }
    }
    for (const tag of supportTagsFromAttrs(attrs, entry.component?.name || '')) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(indexed);
    }
    count += 1;
  }
  return { byCoord, byTag, count };
}

export function stagedComponentForXmlNode(node, stagedIndex, config) {
  if (!stagedIndex || stagedIndex.count <= 0) return { match: null, method: '' };
  for (const tag of xmlNodeSupportTags(node)) {
    const matches = stagedIndex.byTag.get(tag) || [];
    if (matches.length) return { match: matches[0], method: `PS tag ${tag}` };
  }
  const positionKey = xmlPositionKey(xmlText(node, 'Position'), toFiniteNumber(config.coordinateTolerance, 1));
  const coordMatches = positionKey ? (stagedIndex.byCoord.get(positionKey) || []) : [];
  if (coordMatches.length) return { match: coordMatches[0], method: 'coordinate' };
  return { match: null, method: '' };
}

export function findWeightMasterMatch({ boreMm, rating, lengthMm }, config) {
  const best = findAllWeightCandidates({ boreMm, rating, lengthMm }, config)[0] || null;
  return best || null;
}

export function findAllWeightCandidates({ boreMm, rating, lengthMm }, config) {
  const rows = Array.isArray(config.weight?.masterRows) ? config.weight.masterRows : [];
  if (!rows.length || boreMm === null || !rating || lengthMm === null) return [];
  const tolerance = toFiniteNumber(config.weight?.lengthToleranceMm, 4);
  const normalizedRating = toText(rating).replace(/#/g, '').toUpperCase();
  const candidates = [];
  for (const row of rows) {
    const rowBore = rowNumber(row, ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'DN', 'NB']);
    const rowLengthRaw = rowNumber(row, ['lengthMm', 'length', 'Length', 'Length (RF-F/F)', 'RF-F/F', 'LEN', 'faceToFace']);
    const unit = toText(config.weight?.masterLengthUnit || 'auto').toLowerCase();
    const rowLength = rowLengthRaw === null
      ? null
      : (unit === 'in' || (unit === 'auto' && rowLengthRaw < 100 && lengthMm > 100)
        ? rowLengthRaw * toFiniteNumber(config.weight?.inchToMm, 25.4)
        : rowLengthRaw);
    const rowWeight = rowNumber(row, ['valveWeight', 'directWeight', 'weight', 'Weight', 'RF/RTJ KG', 'Valve Weight']);
    const rowRating = rowText(row, ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']).replace(/#/g, '').toUpperCase();
    const valveType = rowText(row, ['valveType', 'Type Description', 'Valve Type', 'Type', 'Description']);
    if (rowBore === null || rowLength === null || rowWeight === null || !rowRating) continue;
    if (Math.abs(rowBore - boreMm) >= 1) continue;
    if (rowRating !== normalizedRating) continue;
    const lengthDelta = Math.abs(rowLength - lengthMm);
    if (lengthDelta > tolerance) continue;
    candidates.push({ weight: rowWeight, lengthDelta, valveType, rowData: row });
  }
  candidates.sort((a, b) => a.lengthDelta - b.lengthDelta);
  return candidates;
}

export function normalizedXmlCiiRating(value) {
  return toText(value).replace(/#/g, '').trim().toUpperCase();
}

export function xmlCiiWeightCandidateFromRow(row, config, lengthMm) {
  const rowBore = rowNumber(row, ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'DN', 'NB']);
  const rowLengthRaw = rowNumber(row, ['lengthMm', 'length', 'Length', 'Length (RF-F/F)', 'RF-F/F', 'LEN', 'faceToFace']);
  const unit = toText(config.weight?.masterLengthUnit || 'auto').toLowerCase();
  const rowLength = rowLengthRaw === null
    ? null
    : (unit === 'in' || (unit === 'auto' && rowLengthRaw < 100 && lengthMm > 100)
      ? rowLengthRaw * toFiniteNumber(config.weight?.inchToMm, 25.4)
      : rowLengthRaw);
  const rowWeight = rowNumber(row, ['valveWeight', 'directWeight', 'weight', 'Weight', 'RF/RTJ KG', 'Valve Weight']);
  const rowRating = normalizedXmlCiiRating(rowText(row, ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']));
  const valveType = rowText(row, ['valveType', 'Type Description', 'Valve Type', 'Type', 'Description']);
  if (rowBore === null || rowLength === null || rowWeight === null) return null;
  return { weight: rowWeight, rowBore, rowLength, rowRating, valveType, rowData: row };
}

const XML_CII_WEIGHT_MATCH_WEIGHTS = Object.freeze({ bore: 2, rating: 3, length: 1 });

export function scoreXmlCiiWeightCandidates({ boreMm, rating, lengthMm }, config) {
  const rows = Array.isArray(config.weight?.masterRows) ? config.weight.masterRows : [];
  if (!rows.length || boreMm === null || lengthMm === null) return [];
  const normalizedRating = normalizedXmlCiiRating(rating);
  const lengthScale = Math.max(toFiniteNumber(config.weight?.lengthToleranceMm, 4) * 5, Math.abs(lengthMm) * 0.2, 25);
  const boreScale = Math.max(Math.abs(boreMm) * 0.25, 25);
  const { bore: wBore, rating: wRating, length: wLength } = XML_CII_WEIGHT_MATCH_WEIGHTS;
  const wTotal = wBore + wRating + wLength;
  const candidates = [];
  for (const row of rows) {
    const base = xmlCiiWeightCandidateFromRow(row, config, lengthMm);
    if (!base) continue;
    const lengthDelta = Math.abs(base.rowLength - lengthMm);
    const boreDelta = Math.abs(base.rowBore - boreMm);
    const lengthScore = 1 - Math.min(lengthDelta / lengthScale, 1);
    const boreScore = 1 - Math.min(boreDelta / boreScale, 1);
    let ratingScore = 0;
    if (base.rowRating && normalizedRating && base.rowRating === normalizedRating) ratingScore = 1;
    else if (base.rowRating && normalizedRating && (base.rowRating.includes(normalizedRating) || normalizedRating.includes(base.rowRating))) ratingScore = 0.65;
    const score = (boreScore * wBore + ratingScore * wRating + lengthScore * wLength) / wTotal;
    if (score <= 0) continue;
    const preferred = boreDelta < 1 && ratingScore === 1;
    const suggestedWeight = (preferred && base.rowLength > 0)
      ? base.weight * (lengthMm / base.rowLength)
      : base.weight;
    candidates.push({
      ...base,
      lengthDelta,
      boreDelta,
      score,
      preferred,
      suggestedWeight: Math.round(suggestedWeight * 1000) / 1000,
    });
  }
  candidates.sort((a, b) =>
    (Number(b.preferred) - Number(a.preferred))
    || (b.score - a.score)
    || (a.lengthDelta - b.lengthDelta)
    || (a.boreDelta - b.boreDelta));
  return candidates.slice(0, 5);
}

export function xmlCiiRigidWeightOverrideKey(branchName, nodeNumber) {
  return `${toText(branchName).trim()}::${toText(nodeNumber).trim()}`;
}

export function isXmlCiiRigidNode(node) {
  return xmlText(node, 'ComponentType').toUpperCase() === 'RIGID' || Number(xmlText(node, 'Rigid')) === 2;
}

export function xmlCiiNumberText(value) {
  const text = toText(value).replace(/,/g, '').trim();
  if (text === '') return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

export function xmlCiiAncestorBranchName(node) {
  let current = node?.parentNode || null;
  while (current) {
    if (current.nodeType === 1 && xmlLocalName(current) === 'Branch') return xmlText(current, 'Branchname');
    current = current.parentNode || null;
  }
  return '';
}

export function xmlCiiRigidWeightOverrideForNode(branchName, node, config) {
  const nodeNumber = xmlText(node, 'NodeNumber');
  const overrides = config?.overrides?.rigidWeight || {};
  const raw = overrides[xmlCiiRigidWeightOverrideKey(branchName, nodeNumber)] ?? overrides[nodeNumber];
  const numeric = xmlCiiNumberText(raw);
  return numeric !== null && numeric > 0 ? numeric : null;
}

export function xmlCiiForwardElementLengths(nodes) {
  const out = new Array(nodes.length).fill(null);

  const mapPositionToCii = (posStr) => {
    const p = normalizePoint(posStr);
    if (!p) return null;
    return [p.x, p.z, -p.y];
  };

  for (let j = 0; j < nodes.length; j += 1) {
    const toNum = Number(xmlText(nodes[j], 'NodeNumber'));
    if (!Number.isFinite(toNum) || toNum <= 0) continue;
    const toPos = xmlText(nodes[j], 'Position');
    if (!toPos) continue;

    // Find the closest preceding positive node i
    let fromPos = null;
    for (let i = j - 1; i >= 0; i -= 1) {
      const fromNum = Number(xmlText(nodes[i], 'NodeNumber'));
      if (Number.isFinite(fromNum) && fromNum > 0) {
        fromPos = xmlText(nodes[i], 'Position');
        break;
      }
    }

    if (fromPos) {
      const pFrom = mapPositionToCii(fromPos);
      const pTo = mapPositionToCii(toPos);
      if (pFrom && pTo) {
        const dx = pTo[0] - pFrom[0];
        const dy = pTo[1] - pFrom[1];
        const dz = pTo[2] - pFrom[2];
        out[j] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    }
  }
  return out;
}

const OD_TO_DN = [
  [10.3, 6],
  [13.7, 8],
  [17.1, 10],
  [21.3, 15],
  [26.7, 20],
  [33.4, 25],
  [42.2, 32],
  [48.3, 40],
  [60.3, 50],
  [73.0, 65],
  [88.9, 80],
  [114.3, 100],
  [141.3, 125],
  [168.3, 150],
  [219.1, 200],
  [273.0, 250],
  [273.1, 250],
  [323.8, 300],
  [323.9, 300],
  [355.6, 350],
  [406.4, 400],
  [457.0, 450],
  [457.2, 450],
  [508.0, 500],
  [609.6, 600],
  [610.0, 600],
  [711.0, 700],
  [762.0, 750],
];

function nominalDnFromOd(odNum) {
  if (odNum === null || !Number.isFinite(odNum)) return null;
  let best = null;
  for (const [od, dn] of OD_TO_DN) {
    const err = Math.abs(odNum - od);
    if (!best || err < best.err) {
      best = { od, dn, err };
    }
  }
  if (best) {
    const tolerance = Math.max(1.5, Math.abs(best.od) * 0.006);
    if (best.err <= tolerance) {
      return best.dn;
    }
  }
  return odNum;
}

export function collectXmlCiiZeroRigidWeightIssues(xmlTextVal, stagedJsonText, config) {
  if (typeof DOMParser === 'undefined') return [];
  const document = new DOMParser().parseFromString(toText(xmlTextVal), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return [];
  const stagedIndex = buildStagedComponentIndex(stagedJsonText, config);
  const issues = [];
  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = xmlText(branch, 'Branchname');
    const branchNodeList = xmlChildrenByName(branch, 'Node');
    const forwardLengths = xmlCiiForwardElementLengths(branchNodeList);
    branchNodeList.forEach((node, nodeIdx) => {
      const lengthRaw = xmlText(node, 'ElementLengthMm');
      const lengthFromXml = lengthRaw ? xmlCiiNumberText(lengthRaw) : null;
      const lengthMm = lengthFromXml !== null ? lengthFromXml : forwardLengths[nodeIdx];
      const weight = xmlCiiNumberText(xmlText(node, 'Weight'));
      const nodeNumber = xmlText(node, 'NodeNumber');
      if (isXmlCiiRigidNode(node) && Number(nodeNumber) > 0 && lengthMm !== null && (weight === null || Math.abs(weight) <= 1e-12)) {
        const staged = stagedComponentForXmlNode(node, stagedIndex, config);
        let boreMm = xmlCiiNumberText(xmlText(node, 'BoreMm'));
        if (boreMm === null) {
          const od = xmlCiiNumberText(xmlText(node, 'OutsideDiameter'));
          if (od !== null) {
            boreMm = nominalDnFromOd(od);
          }
        }
        const rating = xmlText(node, 'Rating');
        issues.push({
          key: xmlCiiRigidWeightOverrideKey(branchName, nodeNumber),
          branchName,
          nodeNumber,
          nodeName: xmlText(node, 'NodeName'),
          componentType: xmlText(node, 'ComponentType'),
          boreMm,
          rating,
          lengthMm,
          dtxr: stagedComponentDtxr(staged.match),
          stagedName: toText(staged.match?.component?.name || staged.match?.attrs?.NAME || '').trim(),
          stagedMatchMethod: staged.method,
          candidates: scoreXmlCiiWeightCandidates({ boreMm, rating, lengthMm }, config).slice(0, 5),
        });
      }
    });
  }
  return issues;
}

export function applyXmlCiiRigidWeightOverrides(xmlTextVal, weightsByKey) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return { xmlText: xmlTextVal, appliedCount: 0, appliedRows: [] };
  }
  const document = new DOMParser().parseFromString(toText(xmlTextVal), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return { xmlText: xmlTextVal, appliedCount: 0, appliedRows: [] };
  const appliedRows = [];
  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = xmlText(branch, 'Branchname');
    for (const node of xmlChildrenByName(branch, 'Node')) {
      const nodeNumber = xmlText(node, 'NodeNumber');
      const key = xmlCiiRigidWeightOverrideKey(branchName, nodeNumber);
      const numeric = xmlCiiNumberText(weightsByKey?.[key]);
      if (numeric === null || numeric <= 0) continue;
      xmlSetText(document, node, 'Weight', String(numeric));
      appliedRows.push({ type: 'rigid-weight-manual-override', branchName, nodeNumber, weight: numeric });
    }
  }
  return {
    xmlText: new XMLSerializer().serializeToString(document),
    appliedCount: appliedRows.length,
    appliedRows,
  };
}
