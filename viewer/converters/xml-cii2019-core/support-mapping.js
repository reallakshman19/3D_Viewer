import { resolveKindFromAttrs } from '../../rvm-viewer/RvmSupportMapper.js';

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

function xmlPositionKey(positionText, tolerance) {
  const point = normalizePoint(positionText);
  if (!point) return '';
  const tol = toFiniteNumber(tolerance, 1) || 1;
  return [point.x, point.y, point.z].map((value) => Math.round(value / tol)).join('|');
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

export function resolveXmlCiiSupportKind(attrs) {
  const direct = toText(attrs?.SUPPORT_KIND || attrs?.SUPPORT_MAPPER_KIND || attrs?.SUPPORT_TYPE).trim().toUpperCase();
  if (direct) return direct;
  const ruleKind = toText(resolveKindFromAttrs(attrs)).trim().toUpperCase();
  if (ruleKind) return ruleKind;
  const cmp = toText(attrs?.CMPSUPTYPE).toUpperCase();
  if (/^LS-|LINE\s*STOP|LINESTOP/.test(cmp)) return 'LINESTOP';
  if (/^PG-|GUIDE/.test(cmp)) return 'GUIDE';
  if (/^(SH-|BP-)|REST|SHOE|WEAR\s*PLATE|W\.?\s*PAD|WPAD|BASE\s*PLATE/.test(cmp)) return 'REST';
  const dtxr = toText(attrs?.DTXR).toUpperCase();
  if (/DIRECTIONAL\s*ANCHOR|LINE\s*STOP|LINESTOP/.test(dtxr)) return 'LINESTOP';
  if (/\bGUIDE\b/.test(dtxr)) return 'GUIDE';
  if (/\bANCHOR\b|\bFIXED\b/.test(dtxr)) return 'ANCHOR';
  if (/SHOE|\bREST\b|WEAR\s*PLATE|W\.?\s*PAD|BASE\s*PLATE/.test(dtxr)) return 'REST';
  return '';
}

export function buildStagedSupportIndex(stagedJsonText, config, diagnostics = []) {
  const empty = { byCoord: new Map(), byTag: new Map(), count: 0 };
  if (!toText(stagedJsonText).trim()) return empty;
  let parsed = null;
  try {
    parsed = JSON.parse(stagedJsonText);
  } catch (error) {
    diagnostics.push({ type: 'staged-json-parse-error', message: toText(error?.message || error) });
    return empty;
  }
  const byCoord = new Map();
  const byTag = new Map();
  const tolerance = toFiniteNumber(config.coordinateTolerance, 1);
  let count = 0;
  for (const entry of walkStagedComponents(parsed)) {
    const attrs = entry.attrs || {};
    const kind = resolveXmlCiiSupportKind(attrs);
    if (!kind) continue;
    let point = null;
    for (const key of ['SUPPORTCOORD', 'POS', 'BPOS', 'APOS', 'LPOS']) {
      point = normalizePoint(attrs[key]);
      if (point) break;
    }
    const indexed = { ...entry, kind, point };
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
  diagnostics.push({ type: 'staged-support-index', supports: count, coordinateKeys: byCoord.size, psTagKeys: byTag.size });
  return { byCoord, byTag, count };
}

const XML_CII_NATIVE_RESTRAINT_TYPE_ALIASES = Object.freeze({
  GUI: 'GUI',
  GUIDE: 'GUI',
  LIM: 'LIM',
  LIMIT: 'LIM',
});

export function normalizeExistingXmlCiiRestraintType(typeText, config) {
  const raw = toText(typeText).trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  const nativeType = XML_CII_NATIVE_RESTRAINT_TYPE_ALIASES[upper];
  if (nativeType) return nativeType;
  const sign = upper.startsWith('+') || upper.startsWith('-') ? upper[0] : '';
  const unsigned = sign ? upper.slice(1) : upper;
  const mapped = config.xmlAxisToCiiAxis?.[upper] || config.xmlAxisToCiiAxis?.[unsigned];
  if (mapped) return toText(mapped).trim().toUpperCase();
  return upper;
}

export function xmlCiiTypeEntriesFromSupportKind(kind, config) {
  const value = config.supportKindToXmlType?.[kind];
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => toText(entry).trim().toUpperCase())
    .filter(Boolean)
    .map((type) => XML_CII_NATIVE_RESTRAINT_TYPE_ALIASES[type] || type);
}

export function xmlCiiTypeEntryFromExistingRestraint(restraint, config) {
  return {
    type: normalizeExistingXmlCiiRestraintType(xmlText(restraint, 'Type'), config),
    stiffness: xmlText(restraint, 'Stiffness'),
    gap: xmlText(restraint, 'Gap'),
    friction: xmlText(restraint, 'Friction'),
  };
}

export function applyXmlRestraints(document, nodeElement, entries, config) {
  if (!entries || entries.length === 0) return;
  const existing = xmlChildrenByName(nodeElement, 'Restraint');
  let stiffness = config.defaultStiffness || '1.751270E+12';
  let gap = '0';
  let friction = config.defaultFriction || '0.3';
  if (existing.length > 0) {
    const r0 = existing[0];
    const s = xmlText(r0, 'Stiffness');
    if (s && Number.isFinite(Number(s)) && Number(s) > 0) stiffness = s;
    const g = xmlText(r0, 'Gap');
    if (g) gap = g;
    const f = xmlText(r0, 'Friction');
    if (f) friction = f;
  }
  for (const r of existing) nodeElement.removeChild(r);
  for (const entry of entries) {
    const type = toText(typeof entry === 'string' ? entry : entry?.type).trim();
    if (!type) continue;
    const restraint = nodeElement?.namespaceURI
      ? document.createElementNS(nodeElement.namespaceURI, 'Restraint')
      : document.createElement('Restraint');
    nodeElement.appendChild(restraint);
    xmlSetText(document, restraint, 'Type', type);
    xmlSetText(document, restraint, 'Stiffness', toText(entry?.stiffness).trim() || stiffness);
    xmlSetText(document, restraint, 'Gap', toText(entry?.gap).trim() || gap);
    xmlSetText(document, restraint, 'Friction', toText(entry?.friction).trim() || friction);
  }
}

export function supportKindForOutput(attrs) {
  return toText(attrs?.SUPPORT_TYPE || attrs?.SUPPORT_KIND || '').trim().toUpperCase();
}

export function applySupportMapperToAttributes(attrs) {
  if (!attrs || typeof attrs !== 'object') return '';
  const kind = toText(resolveKindFromAttrs(attrs)).trim().toUpperCase();
  if (!kind) return '';
  attrs.SUPPORT_TYPE = kind;
  attrs.SUPPORT_KIND = kind;
  attrs.SUPPORT_MAPPER_KIND = kind;
  return kind;
}

export function enrichHierarchyWithMapperKinds(nodes, stats = { scanned: 0, mapped: 0 }) {
  if (!Array.isArray(nodes)) return stats;
  for (const node of nodes) {
    if (!node) continue;
    const typeStr = String(node.type || node.attributes?.TYPE || '').toUpperCase();
    if (typeStr === 'SUPPORT' || typeStr === 'ATTA' || typeStr === 'ANCI') {
      const attrs = node.attributes || (node.attributes = {});
      const before = supportKindForOutput(attrs);
      const kind = applySupportMapperToAttributes(attrs);
      stats.scanned += 1;
      if (kind && kind !== before) stats.mapped += 1;
    }
    if (Array.isArray(node.children)) enrichHierarchyWithMapperKinds(node.children, stats);
    if (Array.isArray(node.items)) enrichHierarchyWithMapperKinds(node.items, stats);
    if (Array.isArray(node.branches)) enrichHierarchyWithMapperKinds(node.branches, stats);
  }
  return stats;
}
