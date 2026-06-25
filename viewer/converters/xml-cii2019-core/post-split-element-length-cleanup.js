import { cleanXmlCiiNodeBlocks } from './xml-cii-node-block-cleanup.js';

const LENGTH_COMPONENT_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST']);
function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function numeric(value) { const match = text(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/); if (!match) return null; const number = Number(match[0]); return Number.isFinite(number) ? number : null; }
function localName(node) { return text(node?.localName || node?.nodeName).replace(/^.*:/, ''); }
function childrenByName(parent, name) { return [...(parent?.childNodes || [])].filter((node) => node.nodeType === 1 && localName(node) === name); }
function firstChild(parent, name) { return childrenByName(parent, name)[0] || null; }
function childText(parent, name) { return text(firstChild(parent, name)?.textContent); }
function ensureChild(document, parent, name) { let child = firstChild(parent, name); if (child) return child; child = parent?.namespaceURI ? document.createElementNS(parent.namespaceURI, name) : document.createElement(name); parent.appendChild(child); return child; }
function setChildText(document, parent, name, value) { const child = ensureChild(document, parent, name); const before = text(child.textContent); const after = text(value); child.textContent = after; return before !== after; }
function normalizeRef(value) { return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase(); }
function pointFromPosition(positionText) { const values = text(positionText).match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/g)?.map(Number).filter(Number.isFinite) || []; return values.length >= 3 ? { x: values[0], y: values[1], z: values[2] } : null; }
function distance(a, b) { const pa = pointFromPosition(a), pb = pointFromPosition(b); if (!pa || !pb) return null; const length = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z); return Number.isFinite(length) && length > 0 ? length : null; }
function componentType(node) { return childText(node, 'ComponentType').toUpperCase(); }
function shouldRecalculateNode(node) { return LENGTH_COMPONENT_TYPES.has(componentType(node)); }
function previousNodeWithPosition(nodes, index) { for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (childText(nodes[cursor], 'Position')) return nodes[cursor]; return null; }
function incomingGapLength(nodes, nodeIndex) { const previous = previousNodeWithPosition(nodes, nodeIndex); return previous ? distance(childText(previous, 'Position'), childText(nodes[nodeIndex], 'Position')) : null; }
function bestPairLength(group) { let best = null; for (let i = 0; i < group.length; i += 1) for (let j = i + 1; j < group.length; j += 1) { const length = distance(childText(group[i], 'Position'), childText(group[j], 'Position')); if (length !== null && (best === null || length > best)) best = length; } return best; }
function setInlineLength(document, node, length) { return length !== null && length > 0 && setChildText(document, node, 'ElementLengthMm', length.toFixed(3)); }
function recalcBranchElementLengths(document, branch) {
  const nodes = childrenByName(branch, 'Node'); const byRef = new Map(); const nodeIndex = new Map(); let changed = 0;
  nodes.forEach((node, index) => nodeIndex.set(node, index));
  for (const node of nodes) { if (!shouldRecalculateNode(node)) continue; const ref = normalizeRef(childText(node, 'ComponentRefNo')); if (!ref) continue; if (!byRef.has(ref)) byRef.set(ref, []); byRef.get(ref).push(node); }
  for (const group of byRef.values()) {
    const pairLength = group.length >= 2 ? bestPairLength(group) : null;
    for (const node of group) {
      const idx = nodeIndex.get(node);
      const endpoint = text(childText(node, 'Endpoint'));
      const incoming = endpoint === '1' ? incomingGapLength(nodes, idx) : null;
      const length = incoming || pairLength;
      if (setInlineLength(document, node, length)) changed += 1;
    }
  }
  for (let index = 1; index < nodes.length; index += 1) { const node = nodes[index]; if (!shouldRecalculateNode(node)) continue; if (numeric(childText(node, 'ElementLengthMm')) !== null) continue; if (setInlineLength(document, node, incomingGapLength(nodes, index))) changed += 1; }
  return changed;
}
function cleanupSerializedXml(xmlText, options = {}, recalculated = 0, existingDiagnostics = []) {
  const cleanup = cleanXmlCiiNodeBlocks(xmlText, { ...(options || {}), stage: options.stage || 'post-split-element-length-cleanup' });
  return { xmlText: cleanup.xmlText, stats: { postSplitElementLengthsRecalculated: recalculated, shortElementLengthNodesDropped: cleanup.stats.shortElementLengthNodesDropped || 0, shortElementLengthNodesDroppedByType: cleanup.stats.shortElementLengthNodesDroppedByType || {}, gasketNodesDropped: cleanup.stats.gasketNodesDropped || 0 }, diagnostics: [...existingDiagnostics, ...(cleanup.diagnostics || [])] };
}
export function applyXmlCiiPostSplitElementLengthCleanup(xmlText, options = {}) {
  const diagnostics = [];
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return cleanupSerializedXml(xmlText, options, 0, diagnostics);
  let document = null;
  try { document = new DOMParser().parseFromString(text(xmlText), 'application/xml'); if (document.getElementsByTagName('parsererror').length) return cleanupSerializedXml(xmlText, options, 0, diagnostics); } catch { return cleanupSerializedXml(xmlText, options, 0, diagnostics); }
  let recalculated = 0;
  for (const branch of [...document.getElementsByTagName('Branch')]) recalculated += recalcBranchElementLengths(document, branch);
  if (recalculated > 0) diagnostics.push({ type: 'post-split-element-length-recalculated', count: recalculated, message: 'ElementLengthMm recalculated after gasket drop and split: Endpoint 1 uses incoming adjacent gap; Endpoint 2 and other inline endpoints use matching ComponentRefNo span.' });
  return cleanupSerializedXml(new XMLSerializer().serializeToString(document), options, recalculated, diagnostics);
}
