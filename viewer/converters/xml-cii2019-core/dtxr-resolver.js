function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return fallback;
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

export function getXmlNodeProperty(node, name) {
  if (!node) return '';
  if (typeof node.querySelector === 'function') {
    return node.querySelector(name)?.textContent?.trim() || '';
  }
  if (typeof node.getElementsByTagName === 'function') {
    return xmlText(node, name);
  }
  return String(
    node[name] ??
    node[name.toLowerCase()] ??
    node[name.toUpperCase()] ??
    ''
  ).trim();
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
  const parts = [];
  if (typeof node.getElementsByTagName === 'function') {
    parts.push(xmlText(node, 'NodeName'), xmlText(node, 'ComponentRefNo'));
    for (const child of xmlChildrenByName(node, 'SupportTag')) parts.push(toText(child.textContent));
  } else {
    parts.push(getXmlNodeProperty(node, 'NodeName'), getXmlNodeProperty(node, 'ComponentRefNo'));
    const tagsVal = node.SupportTag || node.supportTag || '';
    if (Array.isArray(tagsVal)) {
      parts.push(...tagsVal.map(toText));
    } else if (tagsVal) {
      parts.push(toText(tagsVal));
    }
  }
  return [...new Set(parts.flatMap(supportTagsFromText))];
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

function cleanDtxr(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[;,/|]+/g, '+')
    .replace(/\++/g, '+')
    .replace(/^\+|\+$/g, '')
    .trim()
    .toUpperCase();
}

function canonKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^=/, '')
    .toUpperCase();
}

function coordKey(coord, precision = 1) {
  if (!coord) return '';
  return [coord.x, coord.y, coord.z]
    .map((v) => Math.round(v / precision))
    .join('|');
}

export function buildStagedDtxrIndex(stagedJson, config = {}) {
  let items = [];
  try {
    const parsed = typeof stagedJson === 'string' ? JSON.parse(stagedJson) : stagedJson;
    items = walkStagedComponents(parsed);
  } catch {}

  const byComponentRefNo = new Map();
  const byPsTag = new Map();
  const byNodeNumber = new Map();
  const byNodeName = new Map();
  const byCoordKey = new Map();

  for (const item of items) {
    const dtxr = stagedComponentDtxr(item);
    if (!dtxr) continue;

    const attrs = item.attrs || {};
    const refKeys = [
      attrs.ComponentRefNo,
      attrs.COMPONENTREFNO,
      attrs.componentRefNo,
      attrs.RefNo,
      attrs.REFNO,
      attrs.REF,
      item.componentRefNo,
      item.refNo,
      item.component?.refNo
    ];

    const indexedItem = {
      raw: item,
      attrs,
      dtxr,
      coord: null
    };

    for (const ref of refKeys) {
      if (ref) byComponentRefNo.set(canonKey(ref), indexedItem);
    }

    const name = item.component?.name || '';
    for (const tag of supportTagsFromAttrs(attrs, name)) {
      byPsTag.set(canonKey(tag), indexedItem);
    }

    const nodeNo = attrs.NodeNumber || attrs.NODE || '';
    if (nodeNo) byNodeNumber.set(String(nodeNo).trim(), indexedItem);

    const nodeName = attrs.NodeName || '';
    if (nodeName) byNodeName.set(canonKey(nodeName), indexedItem);

    let coord = null;
    for (const key of ['SUPPORTCOORD', 'POS', 'BPOS', 'APOS', 'LPOS', 'CPOS', 'HPOS', 'TPOS']) {
      coord = normalizePoint(attrs[key]);
      if (coord) break;
    }
    if (coord) {
      indexedItem.coord = coord;
      const precisionKey = coordKey(coord, config.coordinatePrecision ?? 1);
      if (!byCoordKey.has(precisionKey)) {
        byCoordKey.set(precisionKey, []);
      }
      byCoordKey.get(precisionKey).push(indexedItem);
    }
  }

  return {
    items,
    byComponentRefNo,
    byPsTag,
    byNodeNumber,
    byNodeName,
    byCoordKey
  };
}

function chooseBestDtxrCandidate(candidates, xmlNode, config) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const xmlType = getXmlNodeProperty(xmlNode, 'ComponentType').toUpperCase();
  for (const cand of candidates) {
    const candType = String(cand.raw?.type || cand.attrs?.TYPE || '').toUpperCase();
    if (candType && candType === xmlType) return cand;
  }
  return candidates[0];
}

function resolvedFromIndexedItem(indexed, source, matchedKey) {
  return {
    value: cleanDtxr(indexed.dtxr),
    source,
    confidence: 1.0,
    matchedKey: String(matchedKey || '')
  };
}

export function resolveXmlCiiNodeDtxr(xmlNode, stagedIndex, config = {}) {
  const nodeNumber = getXmlNodeProperty(xmlNode, 'NodeNumber');
  const dtxrPos = cleanDtxr(getXmlNodeProperty(xmlNode, 'DTXR_POS') || getXmlNodeProperty(xmlNode, 'DtxrPos'));
  if (dtxrPos) {
    return {
      value: dtxrPos,
      source: 'xml-dtxr-pos',
      confidence: 1.0,
      matchedKey: `NodeNumber:${nodeNumber}`,
    };
  }

  const dtxrPs = cleanDtxr(getXmlNodeProperty(xmlNode, 'DTXR_PS') || getXmlNodeProperty(xmlNode, 'DtxrPs'));
  if (dtxrPs) {
    return {
      value: dtxrPs,
      source: 'xml-dtxr-ps',
      confidence: 1.0,
      matchedKey: `NodeNumber:${nodeNumber}`,
    };
  }

  if (!stagedIndex) {
    return { value: '', source: 'not-found', confidence: 0, matchedKey: '' };
  }

  const componentRefNo = getXmlNodeProperty(xmlNode, 'ComponentRefNo');
  if (componentRefNo) {
    const byRef = stagedIndex.byComponentRefNo.get(canonKey(componentRefNo));
    if (byRef) return resolvedFromIndexedItem(byRef, 'staged-component-refno', componentRefNo);
  }

  for (const psKey of xmlNodeSupportTags(xmlNode)) {
    const byPs = stagedIndex.byPsTag.get(canonKey(psKey));
    if (byPs) return resolvedFromIndexedItem(byPs, 'staged-ps-tag', psKey);
  }

  if (nodeNumber) {
    const byNode = stagedIndex.byNodeNumber.get(nodeNumber);
    if (byNode) return resolvedFromIndexedItem(byNode, 'staged-node-number', nodeNumber);
  }

  const nodeName = getXmlNodeProperty(xmlNode, 'NodeName');
  if (nodeName) {
    const byName = stagedIndex.byNodeName.get(canonKey(nodeName));
    if (byName) return resolvedFromIndexedItem(byName, 'staged-node-name', nodeName);
  }

  const posText = getXmlNodeProperty(xmlNode, 'Position');
  const coord = normalizePoint(posText);
  if (coord) {
    const precisionKey = coordKey(coord, config.coordinatePrecision ?? 1);
    const exactCandidates = stagedIndex.byCoordKey.get(precisionKey) || [];
    const exact = chooseBestDtxrCandidate(exactCandidates, xmlNode, config);
    if (exact) {
      return resolvedFromIndexedItem(exact, 'staged-coordinate-key', precisionKey);
    }

    const nearest = findNearestCoordinateMatch(
      coord,
      stagedIndex.items,
      config.dtxrCoordinateToleranceMm ?? 2.0
    );
    if (nearest) {
      const indexedNearest = {
        raw: nearest.item,
        attrs: nearest.item.attrs || {},
        dtxr: stagedComponentDtxr(nearest.item),
        coord: nearest.item.coord
      };
      return resolvedFromIndexedItem(indexedNearest, 'staged-nearest-coordinate', `${nearest.distanceMm.toFixed(3)} mm`);
    }
  }

  return {
    value: '',
    source: 'not-found',
    confidence: 0,
    matchedKey: '',
  };
}

function findNearestCoordinateMatch(target, items, tolerance) {
  let nearestItem = null;
  let nearestDist = Infinity;
  for (const item of items) {
    let itemCoord = item.coord;
    if (!itemCoord) {
      const attrs = item.attrs || {};
      for (const key of ['SUPPORTCOORD', 'POS', 'BPOS', 'APOS', 'LPOS', 'CPOS', 'HPOS', 'TPOS']) {
        itemCoord = normalizePoint(attrs[key]);
        if (itemCoord) break;
      }
    }
    if (!itemCoord) continue;
    const dx = itemCoord.x - target.x;
    const dy = itemCoord.y - target.y;
    const dz = itemCoord.z - target.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist <= tolerance && dist < nearestDist) {
      nearestDist = dist;
      nearestItem = item;
    }
  }
  return nearestItem ? { item: nearestItem, distanceMm: nearestDist } : null;
}

// Legacy exports for backwards compatibility
export function xmlCiiDtxrPsForNode(node, stagedComponentIndex) {
  if (!stagedComponentIndex || stagedComponentIndex.count <= 0) return { text: '', tags: [], values: [] };
  const tags = xmlNodeSupportTags(node);
  const values = [];
  for (const tag of tags) {
    const matches = stagedComponentIndex.byTag.get(tag) || [];
    for (const match of matches) {
      const dtxr = stagedComponentDtxr(match);
      if (dtxr && !values.includes(dtxr)) values.push(dtxr);
    }
  }
  return { text: values.join('|'), tags, values };
}

export function xmlCiiDtxrPositionOffset(config) {
  const option = config?.dtxrPositionOffset || {};
  return {
    enabled: option.enabled === true,
    xOffset: toFiniteNumber(option.xOffset, 0),
    yOffset: toFiniteNumber(option.yOffset, 0),
    zOffset: toFiniteNumber(option.zOffset, 0),
    tolerance: Math.max(toFiniteNumber(option.tolerance, 0.5), 0),
  };
}

export function xmlCiiApplyDtxrPositionOffset(point, config) {
  if (!point) return null;
  const option = xmlCiiDtxrPositionOffset(config);
  if (!option.enabled) return point;
  return {
    x: point.x + option.xOffset,
    y: point.y + option.yOffset,
    z: point.z + option.zOffset,
  };
}

export function xmlCiiPositionsMatch(left, right, tolerance) {
  if (!left || !right) return false;
  return Math.abs(left.x - right.x) <= tolerance
    && Math.abs(left.y - right.y) <= tolerance
    && Math.abs(left.z - right.z) <= tolerance;
}

export function buildStagedDtxrPositionIndex(stagedJsonText, config) {
  const empty = { entries: [], count: 0 };
  if (!toText(stagedJsonText).trim()) return empty;
  let parsed = null;
  try {
    parsed = JSON.parse(stagedJsonText);
  } catch {
    return empty;
  }
  const entries = [];
  for (const entry of walkStagedComponents(parsed)) {
    const attrs = entry.attrs || {};
    const dtxr = stagedComponentDtxr(entry);
    const rawPoint = normalizePoint(attrs.POSI);
    const point = xmlCiiApplyDtxrPositionOffset(rawPoint, config);
    if (!dtxr || !point) continue;
    entries.push({ ...entry, dtxr, point, rawPoint });
  }
  return { entries, count: entries.length };
}

export function xmlCiiDtxrPosForNode(node, dtxrPositionIndex, config) {
  if (!dtxrPositionIndex || dtxrPositionIndex.count <= 0) return { text: '', values: [] };
  const target = normalizePoint(xmlText(node, 'Position'));
  if (!target) return { text: '', values: [] };
  const tolerance = xmlCiiDtxrPositionOffset(config).tolerance;
  const values = [];
  for (const entry of dtxrPositionIndex.entries) {
    if (!xmlCiiPositionsMatch(entry.point, target, tolerance)) continue;
    if (entry.dtxr && !values.includes(entry.dtxr)) values.push(entry.dtxr);
  }
  return { text: values.join('|'), values };
}
