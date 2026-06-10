import { deriveLineKeyFromBranchName, tokenAtPosition } from './regex-line-key.js';
import { buildPipingClassIndex } from './piping-class-resolver.js';
import { resolveBranchProcessData } from './branch-process-resolver.js';
import { buildStagedDtxrIndex, resolveXmlCiiNodeDtxr } from './dtxr-resolver.js';

function toText(value) { return value === undefined || value === null ? '' : String(value); }
function toFiniteNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function parseNumericMm(value) { const m = toText(value).replace(/mm/gi, ' ').match(/-?\d+(?:\.\d+)?/); const n = m ? Number(m[0]) : NaN; return Number.isFinite(n) ? n : null; }
function rowText(row, keys) { for (const key of keys || []) { const value = row?.[key] ?? row?._raw?.[key]; if (toText(value).trim()) return toText(value).trim(); } return ''; }
function rowNumber(row, keys) { for (const key of keys || []) { const value = row?.[key] ?? row?._raw?.[key]; const n = parseNumericMm(value); if (n !== null) return n; } return null; }
function xmlLocalName(node) { return toText(node?.localName || node?.nodeName).replace(/^.*:/, ''); }
function xmlChildrenByName(parent, localName) { return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && xmlLocalName(child) === localName); }
function xmlFirstChild(parent, localName) { return xmlChildrenByName(parent, localName)[0] || null; }
function xmlText(parent, localName) { return toText(xmlFirstChild(parent, localName)?.textContent).trim(); }
function xmlSetText(document, parent, localName, value) { let element = xmlFirstChild(parent, localName); if (!element) { element = parent?.namespaceURI ? document.createElementNS(parent.namespaceURI, localName) : document.createElement(localName); parent.appendChild(element); } element.textContent = toText(value); return element; }

function normalizePoint(point) {
  if (point === undefined || point === null || point === '') return null;
  if (Array.isArray(point) && point.length >= 3) {
    const x = Number(point[0]), y = Number(point[1]), z = Number(point[2]);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  if (typeof point === 'object') {
    const x = Number(point.x ?? point.X), y = Number(point.y ?? point.Y), z = Number(point.z ?? point.Z);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  const text = toText(point).trim();
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

function xmlPositionKey(positionText, tolerance) { const p = normalizePoint(positionText); if (!p) return ''; const tol = toFiniteNumber(tolerance, 1) || 1; return [p.x, p.y, p.z].map((v) => Math.round(v / tol)).join('|'); }
function normalizeSupportTag(value) { const m = toText(value).trim().toUpperCase().replace(/^\/+/, '').match(/PS-\d+(?:\.\d+)?/i); return m ? m[0].replace(/\.\d+$/, '') : ''; }
function supportTagsFromText(value) { const tags = new Set(); for (const m of toText(value).matchAll(/\/?PS-\d+(?:\.\d+)?/ig)) { const tag = normalizeSupportTag(m[0]); if (tag) tags.add(tag); } return [...tags]; }
function supportTagsFromAttrs(attrs, componentName = '') { const tags = new Set(supportTagsFromText(componentName)); for (const [key, value] of Object.entries(attrs || {})) { if (value && typeof value === 'object') continue; for (const tag of supportTagsFromText(`${key} ${value}`)) tags.add(tag); } return [...tags]; }
function xmlNodeSupportTags(node) { const parts = [xmlText(node, 'NodeName'), xmlText(node, 'ComponentRefNo')]; for (const child of xmlChildrenByName(node, 'SupportTag')) parts.push(toText(child.textContent)); return [...new Set(parts.flatMap(supportTagsFromText))]; }
function walkStagedComponents(value, branchName = '', out = []) { if (Array.isArray(value)) { value.forEach((item) => walkStagedComponents(item, branchName, out)); return out; } if (!value || typeof value !== 'object') return out; const attrs = value.attributes && typeof value.attributes === 'object' ? value.attributes : {}; const type = toText(value.type || attrs.TYPE).toUpperCase(); const currentBranch = (type === 'BRANCH' || Array.isArray(value.children)) ? toText(value.name || attrs.NAME || attrs.OWNER || branchName) : branchName; out.push({ component: value, attrs, branchName: currentBranch }); if (Array.isArray(value.children)) value.children.forEach((child) => walkStagedComponents(child, currentBranch, out)); return out; }
function stagedComponentDtxr(indexed) { const attrs = indexed?.attrs || {}; return toText(attrs.DTXR_POS || attrs.DTXR_PS || attrs.DTXR || attrs.DESC || attrs.DESCRIPTION || attrs.NAME || indexed?.component?.name || '').trim(); }

export function buildStagedComponentIndex(stagedJsonText, config) {
  const empty = { byCoord: new Map(), byTag: new Map(), count: 0 };
  if (!toText(stagedJsonText).trim()) return empty;
  let parsed = null;
  try { parsed = JSON.parse(stagedJsonText); } catch { return empty; }
  const byCoord = new Map();
  const byTag = new Map();
  let count = 0;
  for (const entry of walkStagedComponents(parsed)) {
    const attrs = entry.attrs || {};
    let point = null;
    for (const key of ['SUPPORTCOORD', 'POS', 'BPOS', 'APOS', 'LPOS', 'CPOS', 'HPOS', 'TPOS']) { point = normalizePoint(attrs[key]); if (point) break; }
    const indexed = { ...entry, point };
    if (point) {
      const key = xmlPositionKey(`${point.x} ${point.y} ${point.z}`, toFiniteNumber(config.coordinateTolerance, 1));
      if (key) { if (!byCoord.has(key)) byCoord.set(key, []); byCoord.get(key).push(indexed); }
    }
    for (const tag of supportTagsFromAttrs(attrs, entry.component?.name || '')) { if (!byTag.has(tag)) byTag.set(tag, []); byTag.get(tag).push(indexed); }
    count += 1;
  }
  return { byCoord, byTag, count };
}

export function stagedComponentForXmlNode(node, stagedIndex, config) {
  if (!stagedIndex || stagedIndex.count <= 0) return { match: null, method: '' };
  for (const tag of xmlNodeSupportTags(node)) { const matches = stagedIndex.byTag.get(tag) || []; if (matches.length) return { match: matches[0], method: `PS tag ${tag}` }; }
  const positionKey = xmlPositionKey(xmlText(node, 'Position'), toFiniteNumber(config.coordinateTolerance, 1));
  const coordMatches = positionKey ? (stagedIndex.byCoord.get(positionKey) || []) : [];
  if (coordMatches.length) return { match: coordMatches[0], method: 'coordinate' };
  return { match: null, method: '' };
}

export function shouldConvertSmallWeightLengthsToMm(config) { return config?.weight?.convertSmallLengthsInToMm === true; }
function resolveWeightMasterLength(rowLengthRaw, xmlLengthMm, config) {
  if (rowLengthRaw === null) return null;
  if (!shouldConvertSmallWeightLengthsToMm(config)) return rowLengthRaw;
  return rowLengthRaw < 100 && xmlLengthMm > 100 ? rowLengthRaw * toFiniteNumber(config.weight?.inchToMm, 25.4) : rowLengthRaw;
}
function weightType(row) { return rowText(row, ['type', 'Type', 'TYPE', 'valveType', 'Valve Type']); }
function weightTypeDesc(row) { return rowText(row, ['typeDesc', 'TypeDesc', 'Type Desc', 'Type Description', 'Description', 'Valve Type']); }

export function findWeightMasterMatch({ boreMm, rating, lengthMm }, config) { return findAllWeightCandidates({ boreMm, rating, lengthMm }, config)[0] || null; }
export function findAllWeightCandidates({ boreMm, rating, lengthMm }, config) {
  const rows = Array.isArray(config.weight?.masterRows) ? config.weight.masterRows : [];
  if (!rows.length || boreMm === null || !rating || lengthMm === null) return [];
  const tolerance = toFiniteNumber(config.weight?.lengthToleranceMm, 4);
  const normalizedRating = toText(rating).replace(/#/g, '').toUpperCase();
  const candidates = [];
  for (const row of rows) {
    const rowBore = rowNumber(row, ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'DN', 'NB']);
    const rowLengthRaw = rowNumber(row, ['lengthMm', 'length', 'Length (RF-F/F)', 'RF-F/F', 'LEN', 'faceToFace']);
    const rowLength = resolveWeightMasterLength(rowLengthRaw, lengthMm, config);
    const rowWeight = rowNumber(row, ['valveWeight', 'directWeight', 'weight', 'Weight', 'RF/RTJ KG', 'Valve Weight']);
    const rowRating = rowText(row, ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']).replace(/#/g, '').toUpperCase();
    const valveType = weightType(row);
    const typeDesc = weightTypeDesc(row);
    if (rowBore === null || rowLength === null || rowWeight === null || !rowRating) continue;
    if (Math.abs(rowBore - boreMm) >= 1) continue;
    if (rowRating !== normalizedRating) continue;
    const lengthDelta = Math.abs(rowLength - lengthMm);
    if (lengthDelta > tolerance) continue;
    candidates.push({ weight: rowWeight, lengthDelta, valveType, type: valveType, typeDesc, rowLength, rowBore, rowRating, rowData: row });
  }
  return candidates.sort((a, b) => a.lengthDelta - b.lengthDelta);
}

export function normalizedXmlCiiRating(value) { return toText(value).replace(/#/g, '').trim().toUpperCase(); }
export function xmlCiiWeightCandidateFromRow(row, config, lengthMm) {
  const rowBore = rowNumber(row, ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'DN', 'NB']);
  const rowLengthRaw = rowNumber(row, ['lengthMm', 'length', 'Length (RF-F/F)', 'RF-F/F', 'LEN', 'faceToFace']);
  const rowLength = resolveWeightMasterLength(rowLengthRaw, lengthMm, config);
  const rowWeight = rowNumber(row, ['valveWeight', 'directWeight', 'weight', 'Weight', 'RF/RTJ KG', 'Valve Weight']);
  const rowRating = normalizedXmlCiiRating(rowText(row, ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']));
  const valveType = weightType(row);
  const typeDesc = weightTypeDesc(row);
  return rowBore === null || rowLength === null || rowWeight === null ? null : { weight: rowWeight, rowBore, rowLength, rowRating, valveType, type: valveType, typeDesc, rowData: row };
}
const XML_CII_WEIGHT_MATCH_WEIGHTS = Object.freeze({ bore: 2, rating: 3, length: 1 });
export function scoreXmlCiiWeightCandidates({ boreMm, rating, lengthMm }, config) { const rows = Array.isArray(config.weight?.masterRows) ? config.weight.masterRows : []; if (!rows.length || boreMm === null || lengthMm === null) return []; const normalizedRating = normalizedXmlCiiRating(rating); const lengthScale = Math.max(toFiniteNumber(config.weight?.lengthToleranceMm, 4) * 5, Math.abs(lengthMm) * 0.2, 25); const boreScale = Math.max(Math.abs(boreMm) * 0.25, 25); const { bore: wBore, rating: wRating, length: wLength } = XML_CII_WEIGHT_MATCH_WEIGHTS; const wTotal = wBore + wRating + wLength; const candidates = []; for (const row of rows) { const base = xmlCiiWeightCandidateFromRow(row, config, lengthMm); if (!base) continue; const lengthDelta = Math.abs(base.rowLength - lengthMm); const boreDelta = Math.abs(base.rowBore - boreMm); const lengthScore = 1 - Math.min(lengthDelta / lengthScale, 1); const boreScore = 1 - Math.min(boreDelta / boreScale, 1); let ratingScore = 0; if (base.rowRating && normalizedRating && base.rowRating === normalizedRating) ratingScore = 1; else if (base.rowRating && normalizedRating && (base.rowRating.includes(normalizedRating) || normalizedRating.includes(base.rowRating))) ratingScore = 0.65; const score = (boreScore * wBore + ratingScore * wRating + lengthScore * wLength) / wTotal; if (score <= 0) continue; const preferred = boreDelta < 1 && ratingScore === 1; const suggestedWeight = preferred && base.rowLength > 0 ? base.weight * (lengthMm / base.rowLength) : base.weight; candidates.push({ ...base, lengthDelta, boreDelta, score, preferred, suggestedWeight: Math.round(suggestedWeight * 1000) / 1000 }); } return candidates.sort((a, b) => (Number(b.preferred) - Number(a.preferred)) || (b.score - a.score) || (a.lengthDelta - b.lengthDelta) || (a.boreDelta - b.boreDelta)).slice(0, 5); }

export function xmlCiiRigidWeightOverrideKey(branchName, nodeNumber) { return `${toText(branchName).trim()}::${toText(nodeNumber).trim()}`; }
export function isXmlCiiRigidNode(node) { return xmlText(node, 'ComponentType').toUpperCase() === 'RIGID' || Number(xmlText(node, 'Rigid')) === 2; }
export function isXmlCiiWeightReviewNode(node, dtxrText = '') { const text = `${xmlText(node, 'ComponentType')} ${xmlText(node, 'NodeName')} ${dtxrText}`.toUpperCase(); return isXmlCiiRigidNode(node) || /FLAN/.test(text) || /VALV|\bVLV\b/.test(text); }
export function xmlCiiNumberText(value) { const text = toText(value).replace(/,/g, '').trim(); if (text === '') return null; const numeric = Number(text); return Number.isFinite(numeric) ? numeric : null; }
export function xmlCiiAncestorBranchName(node) { let current = node?.parentNode || null; while (current) { if (current.nodeType === 1 && xmlLocalName(current) === 'Branch') return xmlText(current, 'Branchname'); current = current.parentNode || null; } return ''; }
function isOwnerBranchDtxrLeak(componentType, dtxrResult) { const source = toText(dtxrResult?.source); const text = toText(dtxrResult?.value).toUpperCase(); return /^staged-owner-dtxr-ps/.test(source) && /^(RIGID|FLAN)$/.test(toText(componentType).toUpperCase()) && /\bTEE\b/.test(text); }
function resolveWeightMatchDtxr(node, stagedDtxrIndex, config) { const result = resolveXmlCiiNodeDtxr(node, stagedDtxrIndex, config); const componentType = xmlText(node, 'ComponentType'); if (isOwnerBranchDtxrLeak(componentType, result)) return { value: '', source: 'staged-owner-dtxr-suppressed', confidence: 0, matchedKey: result.matchedKey || '' }; return result; }
export function xmlCiiRigidWeightOverrideForNode(branchName, node, config) { const nodeNumber = xmlText(node, 'NodeNumber'); const overrides = config?.overrides?.rigidWeight || {}; const raw = overrides[xmlCiiRigidWeightOverrideKey(branchName, nodeNumber)] ?? overrides[nodeNumber]; const numeric = xmlCiiNumberText(raw); return numeric !== null && numeric > 0 ? numeric : null; }
export function xmlCiiForwardElementLengths(nodes) { const out = new Array(nodes.length).fill(null); const mapPositionToCii = (posStr) => { const p = normalizePoint(posStr); return p ? [p.x, p.z, -p.y] : null; }; for (let j = 0; j < nodes.length; j += 1) { const toNum = Number(xmlText(nodes[j], 'NodeNumber')); if (!Number.isFinite(toNum) || toNum <= 0) continue; const toPos = xmlText(nodes[j], 'Position'); if (!toPos) continue; let fromPos = null; for (let i = j - 1; i >= 0; i -= 1) { const fromNum = Number(xmlText(nodes[i])); if (Number.isFinite(fromNum) && fromNum > 0) { fromPos = xmlText(nodes[i], 'Position'); break; } } if (fromPos) { const pFrom = mapPositionToCii(fromPos), pTo = mapPositionToCii(toPos); if (pFrom && pTo) { const dx = pTo[0] - pFrom[0], dy = pTo[1] - pFrom[1], dz = pTo[2] - pFrom[2]; out[j] = Math.sqrt(dx * dx + dy * dy + dz * dz); } } } return out; }

const OD_TO_DN = [[10.3,6],[13.7,8],[17.1,10],[21.3,15],[26.7,20],[33.4,25],[42.2,32],[48.3,40],[60.3,50],[73.0,65],[88.9,80],[114.3,100],[141.3,125],[168.3,150],[219.1,200],[273.0,250],[273.1,250],[323.8,300],[323.9,300],[355.6,350],[406.4,400],[457.0,450],[457.2,450],[508.0,500],[609.6,600],[610.0,600],[711.0,700],[762.0,750]];
function nominalDnFromOd(odNum) { if (odNum === null || !Number.isFinite(odNum)) return null; let best = null; for (const [od, dn] of OD_TO_DN) { const err = Math.abs(odNum - od); if (!best || err < best.err) best = { od, dn, err }; } if (best && best.err <= Math.max(1.5, Math.abs(best.od) * 0.006)) return best.dn; return odNum; }
function normalizeLineKey(value) { return toText(value).trim().toUpperCase().replace(/\s+/g, ''); }
function lineListRowForBranch(branchName, config) { const rows = Array.isArray(config.linelist?.masterRows) ? config.linelist.masterRows : []; const lineKey = deriveLineKeyFromBranchName(branchName, config); const wanted = normalizeLineKey(lineKey); if (!wanted) return { lineKey: '', row: null }; for (const row of rows) { const raw = rowText(row, ['lineNoKey', 'lineNo', 'lineKey', 'LineNo', 'Line No', 'Line Number', 'PipelineReference']); if (normalizeLineKey(raw) === wanted) return { lineKey, row }; } return { lineKey, row: null }; }
function derivePipingClassFromBranchName(branchName, config) { const regex = toText(config.rating?.pipingClassRegex).trim(); if (regex) { try { const match = new RegExp(regex, 'i').exec(branchName); const group = Number(config.rating?.pipingClassGroup || 1); if (match?.[group]) return toText(match[group]).trim(); } catch {} } return tokenAtPosition(branchName, config.rating?.tokenDelimiter || '-', config.rating?.pipingClassTokenIndex || 5); }
function branchBoreFromFirstUsefulNode(branch) { for (const node of xmlChildrenByName(branch, 'Node')) { let boreMm = xmlCiiNumberText(xmlText(node, 'BoreMm')); if (boreMm !== null) return boreMm; const od = xmlCiiNumberText(xmlText(node, 'OutsideDiameter')); if (od !== null) { boreMm = nominalDnFromOd(od); if (boreMm !== null) return boreMm; } } return null; }
function resolveRigidWeightBranchContext(branch, config, pipingClassIndex) { const branchName = xmlText(branch, 'Branchname'); const { lineKey, row: lineRow } = lineListRowForBranch(branchName, config); const derivedClass = derivePipingClassFromBranchName(branchName, config); const resolverLineRow = { ...(lineRow || {}), pipingClass: rowText(lineRow, ['pipingClass', 'Piping Class', 'PIPING_CLASS']) || derivedClass }; const boreMm = branchBoreFromFirstUsefulNode(branch); const resolved = resolveBranchProcessData({ branchName, lineKey, lineRow: resolverLineRow, boreMm, componentType: 'PIPE', rating: rowText(lineRow, ['rating', 'Rating', 'RATING']), materialMap: config.material?.mapRows || [], pipingClassIndex, overrides: config.overrides || {}, xmlNode: null, xmlBranch: branch, config }); return { branchName, lineKey, lineRow: resolverLineRow, boreMm, requestedPipingClass: resolverLineRow.pipingClass, resolvedPipingClass: resolved.pipingClass, rating: resolved.rating, pipingClassMatchMethod: resolved.pipingClassMatchMethod, pipingClassNeedsReview: resolved.pipingClassNeedsReview, pipingClassCandidates: resolved.pipingClassCandidates || [] }; }
function ratingForRigidWeightIssue(node, branchContext) { return toText(branchContext.rating).trim() || xmlText(node, 'Rating'); }

function collectWeightRows(xmlTextVal, stagedJsonText, config, mode = 'zero-rigid') {
  if (typeof DOMParser === 'undefined') return [];
  const document = new DOMParser().parseFromString(toText(xmlTextVal), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return [];
  const stagedDtxrIndex = buildStagedDtxrIndex(stagedJsonText, config);
  const pipingClassIndex = buildPipingClassIndex(config.pipingClass?.masterRows || []);
  const rows = [];
  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchContext = resolveRigidWeightBranchContext(branch, config, pipingClassIndex);
    const branchName = branchContext.branchName;
    const branchNodeList = xmlChildrenByName(branch, 'Node');
    const forwardLengths = xmlCiiForwardElementLengths(branchNodeList);
    branchNodeList.forEach((node, nodeIdx) => {
      const nodeNumber = xmlText(node, 'NodeNumber');
      if (Number(nodeNumber) <= 0) return;
      const dtxrResult = resolveWeightMatchDtxr(node, stagedDtxrIndex, config);
      const componentType = xmlText(node, 'ComponentType');
      const reviewNode = isXmlCiiWeightReviewNode(node, dtxrResult.value || '');
      const lengthRaw = xmlText(node, 'ElementLengthMm');
      const explicitLength = lengthRaw ? xmlCiiNumberText(lengthRaw) : null;
      const lengthMm = explicitLength !== null ? explicitLength : forwardLengths[nodeIdx];
      const weight = xmlCiiNumberText(xmlText(node, 'Weight'));
      const overrideWeight = xmlCiiRigidWeightOverrideForNode(branchName, node, config);
      const mappedWeight = overrideWeight ?? weight;
      const isMapped = mappedWeight !== null && mappedWeight > 0;
      if (mode === 'all-review-nodes') {
        if (!reviewNode || lengthMm === null || lengthMm <= 6) return;
      } else {
        if (!isXmlCiiRigidNode(node) || lengthMm === null || (weight !== null && Math.abs(weight) > 1e-12)) return;
      }
      let boreMm = xmlCiiNumberText(xmlText(node, 'BoreMm'));
      if (boreMm === null) { const od = xmlCiiNumberText(xmlText(node, 'OutsideDiameter')); if (od !== null) boreMm = nominalDnFromOd(od); }
      if (boreMm === null) boreMm = branchContext.boreMm;
      const rating = ratingForRigidWeightIssue(node, branchContext);
      rows.push({
        key: xmlCiiRigidWeightOverrideKey(branchName, nodeNumber), branchName, nodeNumber,
        nodeName: xmlText(node, 'NodeName'), componentType, boreMm, rating,
        requestedPipingClass: branchContext.requestedPipingClass, resolvedPipingClass: branchContext.resolvedPipingClass,
        pipingClassMatchMethod: branchContext.pipingClassMatchMethod, pipingClassNeedsReview: branchContext.pipingClassNeedsReview,
        pipingClassCandidates: branchContext.pipingClassCandidates, lengthMm, elementLengthSource: explicitLength !== null ? 'ElementLengthMm' : 'computed-forward',
        weight: mappedWeight, originalWeight: weight, overrideWeight, weightSource: overrideWeight !== null ? 'override' : (weight !== null && weight > 0 ? 'xml-weight' : 'unresolved'),
        mapped: isMapped, status: isMapped ? 'mapped' : 'unresolved', dtxr: dtxrResult.value || '', dtxrSource: dtxrResult.source,
        dtxrMatchedKey: dtxrResult.matchedKey, candidates: scoreXmlCiiWeightCandidates({ boreMm, rating, lengthMm }, config).slice(0, 5)
      });
    });
  }
  return rows;
}

export function collectXmlCiiWeightMatchRows(xmlTextVal, stagedJsonText, config) { return collectWeightRows(xmlTextVal, stagedJsonText, config, 'all-review-nodes'); }
export function collectXmlCiiZeroRigidWeightIssues(xmlTextVal, stagedJsonText, config) { return collectWeightRows(xmlTextVal, stagedJsonText, config, 'zero-rigid').filter((row) => !row.mapped); }

export function applyXmlCiiRigidWeightOverrides(xmlTextVal, weightsByKey) { if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return { xmlText: xmlTextVal, appliedCount: 0, appliedRows: [] }; const document = new DOMParser().parseFromString(toText(xmlTextVal), 'application/xml'); if (document.getElementsByTagName('parsererror').length) return { xmlText: xmlTextVal, appliedCount: 0, appliedRows: [] }; const appliedRows = []; for (const branch of [...document.getElementsByTagName('Branch')]) { const branchName = xmlText(branch, 'Branchname'); for (const node of xmlChildrenByName(branch, 'Node')) { const nodeNumber = xmlText(node, 'NodeNumber'); const key = xmlCiiRigidWeightOverrideKey(branchName, nodeNumber); const numeric = xmlCiiNumberText(weightsByKey?.[key]); if (numeric === null || numeric <= 0) continue; xmlSetText(document, node, 'Weight', String(numeric)); appliedRows.push({ type: 'rigid-weight-manual-override', branchName, nodeNumber, weight: numeric }); } } return { xmlText: new XMLSerializer().serializeToString(document), appliedCount: appliedRows.length, appliedRows }; }
