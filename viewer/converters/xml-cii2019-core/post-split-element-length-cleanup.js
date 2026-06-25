const LENGTH_COMPONENT_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function truthy(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  if (typeof value === 'number') return value !== 0;
  return /^(1|true|yes|on)$/i.test(text(value));
}

function numeric(value) {
  const match = text(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function localName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function childrenByName(parent, name) {
  return [...(parent?.childNodes || [])].filter((node) => node.nodeType === 1 && localName(node) === name);
}

function firstChild(parent, name) {
  return childrenByName(parent, name)[0] || null;
}

function childText(parent, name) {
  return text(firstChild(parent, name)?.textContent);
}

function ensureChild(document, parent, name) {
  let child = firstChild(parent, name);
  if (child) return child;
  child = parent?.namespaceURI ? document.createElementNS(parent.namespaceURI, name) : document.createElement(name);
  parent.appendChild(child);
  return child;
}

function setChildText(document, parent, name, value) {
  const child = ensureChild(document, parent, name);
  const before = text(child.textContent);
  const after = text(value);
  child.textContent = after;
  return before !== after;
}

function normalizeRef(value) {
  return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase();
}

function pointFromPosition(positionText) {
  const values = text(positionText).match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (values.length < 3) return null;
  return { x: values[0], y: values[1], z: values[2] };
}

function distance(a, b) {
  const pa = pointFromPosition(a);
  const pb = pointFromPosition(b);
  if (!pa || !pb) return null;
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const dz = pb.z - pa.z;
  const length = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  return Number.isFinite(length) && length > 0 ? length : null;
}

function componentType(node) {
  return childText(node, 'ComponentType').toUpperCase();
}

function shouldRecalculateNode(node) {
  return LENGTH_COMPONENT_TYPES.has(componentType(node));
}

function recalcBranchElementLengths(document, branch) {
  const nodes = childrenByName(branch, 'Node');
  const byRef = new Map();
  let changed = 0;
  for (const node of nodes) {
    if (!shouldRecalculateNode(node)) continue;
    const ref = normalizeRef(childText(node, 'ComponentRefNo'));
    if (!ref) continue;
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(node);
  }

  for (const group of byRef.values()) {
    if (group.length < 2) continue;
    let best = null;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const length = distance(childText(group[i], 'Position'), childText(group[j], 'Position'));
        if (length !== null && (best === null || length > best)) best = length;
      }
    }
    if (best === null || best <= 0) continue;
    for (const node of group) {
      if (setChildText(document, node, 'ElementLengthMm', best.toFixed(3))) changed += 1;
    }
  }

  for (let index = 1; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!shouldRecalculateNode(node)) continue;
    if (numeric(childText(node, 'ElementLengthMm')) !== null) continue;
    const length = distance(childText(nodes[index - 1], 'Position'), childText(node, 'Position'));
    if (length !== null && length > 0 && setChildText(document, node, 'ElementLengthMm', length.toFixed(3))) changed += 1;
  }
  return changed;
}

function dropShortElementLengthNodes(document, thresholdMm) {
  let dropped = 0;
  for (const node of [...document.getElementsByTagName('Node')]) {
    const length = numeric(childText(node, 'ElementLengthMm'));
    if (length === null || length > thresholdMm) continue;
    node.parentNode?.removeChild(node);
    dropped += 1;
  }
  return dropped;
}

function shouldDropShort(config = {}) {
  return config.dropShortElementLengthNodes !== false && truthy(config.dropShortElementLengthNodes ?? true);
}

export function applyXmlCiiPostSplitElementLengthCleanup(xmlText, options = {}) {
  const config = options?.config && typeof options.config === 'object' ? options.config : {};
  const stats = { postSplitElementLengthsRecalculated: 0, shortElementLengthNodesDropped: 0 };
  const diagnostics = [];
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return { xmlText, stats, diagnostics };
  let document = null;
  try {
    document = new DOMParser().parseFromString(text(xmlText), 'application/xml');
    if (document.getElementsByTagName('parsererror').length) return { xmlText, stats, diagnostics };
  } catch {
    return { xmlText, stats, diagnostics };
  }

  for (const branch of [...document.getElementsByTagName('Branch')]) {
    stats.postSplitElementLengthsRecalculated += recalcBranchElementLengths(document, branch);
  }
  if (stats.postSplitElementLengthsRecalculated > 0) {
    diagnostics.push({
      type: 'post-split-element-length-recalculated',
      count: stats.postSplitElementLengthsRecalculated,
      message: 'ElementLengthMm recalculated after gasket drop, rigid/valve/flange split, and staged geometry authority using matching ComponentRefNo endpoint distances.',
    });
  }

  const thresholdMm = Math.max(0, Number(config.shortElementLengthDropThresholdMm ?? 6));
  if (shouldDropShort(config) && thresholdMm > 0) {
    stats.shortElementLengthNodesDropped = dropShortElementLengthNodes(document, thresholdMm);
    if (stats.shortElementLengthNodesDropped > 0) {
      diagnostics.push({
        type: 'short-element-length-node-dropped',
        count: stats.shortElementLengthNodesDropped,
        thresholdMm,
        message: `Node blocks with ElementLengthMm <= ${thresholdMm} mm were removed after post-split length recalculation.`,
      });
    }
  }

  return { xmlText: new XMLSerializer().serializeToString(document), stats, diagnostics };
}
