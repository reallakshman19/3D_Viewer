import { parseXmlCiiEnrichmentConfig } from '../../../../converters/xml-cii2019-core/config.js';
import { enrichXmlForCii2019 as enrichXmlForCii2019Base } from './enrichment-core.js?v=20260620-rating-override-1';
import { xmlCiiDryRunPreview } from './preview-renderer.js?v=20260623-preview-run-parity-1';

const RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'RIGID', 'INST']);
const INLINE_LENGTH_COMPONENT_TYPES = new Set(['INST']);
const RESOLVED_RIGID_MARKER_TYPES = new Set(['INST']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
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

function createChild(document, parent, name) {
  return parent?.namespaceURI ? document.createElementNS(parent.namespaceURI, name) : document.createElement(name);
}

function ensureChild(document, parent, name) {
  let element = firstChild(parent, name);
  if (element) return element;
  element = createChild(document, parent, name);
  parent.appendChild(element);
  return element;
}

function ensureChildAfter(document, parent, name, anchorName) {
  let element = firstChild(parent, name);
  if (element) return element;
  element = createChild(document, parent, name);
  const anchor = firstChild(parent, anchorName);
  if (anchor && anchor.parentNode === parent) parent.insertBefore(element, anchor.nextSibling);
  else parent.appendChild(element);
  return element;
}

function setText(document, parent, name, value) {
  const clean = text(value);
  if (clean === '') return false;
  const element = ensureChild(document, parent, name);
  const before = text(element.textContent);
  element.textContent = clean;
  return before !== clean;
}

function setTextAfter(document, parent, name, value, anchorName) {
  const clean = text(value);
  if (clean === '') return false;
  const element = ensureChildAfter(document, parent, name, anchorName);
  const before = text(element.textContent);
  element.textContent = clean;
  return before !== clean;
}

function normalizeBranchKey(value) {
  return text(value).toUpperCase().replace(/\s+/g, '');
}

function numberText(value) {
  const clean = text(value);
  if (clean === '') return '';
  const numeric = Number(clean);
  return Number.isFinite(numeric) ? String(numeric) : clean;
}

function numericValue(value) {
  const clean = text(value);
  if (!clean) return null;
  const match = clean.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function truthy(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  return /^(1|true|yes|on)$/i.test(text(value));
}

function rowValue(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (text(value) !== '') return text(value);
  }
  return '';
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
  if (!isObject(base)) return isObject(override) ? { ...override } : override;
  if (!isObject(override)) return { ...base };
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isObject(value) && isObject(out[key]) ? mergeDeep(out[key], value) : value;
  }
  return out;
}

function configWithRuntimeOptions(baseConfig, options = {}) {
  const parsed = parseXmlCiiEnrichmentConfig(options.supportConfigJson || '{}');
  const merged = mergeDeep(baseConfig || {}, parsed || {});
  if (isObject(options?.overrides)) merged.overrides = mergeDeep(merged.overrides || {}, options.overrides);
  if (Object.prototype.hasOwnProperty.call(options || {}, 'condenseRigidXsd')) merged.condenseRigidXsd = truthy(options.condenseRigidXsd);
  if (Object.prototype.hasOwnProperty.call(options || {}, 'splitCondensedValveFlange')) {
    merged.splitCondensedValveFlange = truthy(options.splitCondensedValveFlange);
    merged.split_condensed_valve_flange = merged.splitCondensedValveFlange;
  }
  if (Object.prototype.hasOwnProperty.call(options || {}, 'split_condensed_valve_flange')) {
    merged.splitCondensedValveFlange = truthy(options.split_condensed_valve_flange);
    merged.split_condensed_valve_flange = merged.splitCondensedValveFlange;
  }
  if (Object.prototype.hasOwnProperty.call(merged || {}, 'split_condensed_valve_flange') && !Object.prototype.hasOwnProperty.call(merged || {}, 'splitCondensedValveFlange')) {
    merged.splitCondensedValveFlange = truthy(merged.split_condensed_valve_flange);
  }
  return merged;
}

function setProcessBlock(document, branch, row) {
  let count = 0;
  const pressure = ensureChild(document, branch, 'Pressure');
  const temperature = ensureChild(document, branch, 'Temperature');

  if (setText(document, pressure, 'Pressure1', rowValue(row, 'p1', 'P1', 'pressure1', 'Pressure1'))) count += 1;
  if (setText(document, temperature, 'Temperature1', rowValue(row, 't1', 'T1', 'temperature1', 'Temperature1'))) count += 1;
  if (setText(document, temperature, 'Temperature2', rowValue(row, 't2', 'T2', 'temperature2', 'Temperature2'))) count += 1;
  if (setText(document, temperature, 'Temperature3', rowValue(row, 't3', 'T3', 'temperature3', 'Temperature3'))) count += 1;
  if (setText(document, branch, 'FluidDensity', rowValue(row, 'density', 'Density', 'fluidDensity', 'FluidDensity'))) count += 1;
  return count;
}

function setBranchNodeFacts(document, branch, row) {
  let count = 0;
  const pipingClass = rowValue(row, 'pipingClass', 'pipingClassResolved', 'resolvedPipingClass');
  const rating = rowValue(row, 'rating', 'branchRating');
  const boreMm = row?.sizeMm ?? row?.boreMm;
  const wallThickness = rowValue(row, 'wallThickness', 'wallThicknessMm', 'wallThk');
  const corrosion = rowValue(row, 'corrosion', 'corrosionAllowance', 'corrosionAllowanceMm');
  const material = rowValue(row, 'material', 'materialName');
  const materialCode = rowValue(row, 'materialCode', 'materialNumber');

  for (const node of childrenByName(branch, 'Node')) {
    if (setText(document, node, 'PipingClass', pipingClass)) count += 1;
    if (setText(document, node, 'Rating', rating)) count += 1;
    if (boreMm != null && text(boreMm) !== '' && setText(document, node, 'BoreMm', Number(boreMm).toFixed(3))) count += 1;
    if (setText(document, node, 'WallThickness', numberText(wallThickness))) count += 1;
    if (setText(document, node, 'CorrosionAllowance', numberText(corrosion))) count += 1;
    if (setText(document, node, 'MaterialName', material)) count += 1;
    if (setText(document, node, 'MaterialCode', materialCode)) count += 1;
  }
  if (setText(document, branch, 'MaterialNumber', materialCode)) count += 1;
  return count;
}

function rowsByBranchName(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const branchName = row?.branchName;
    if (text(branchName)) map.set(text(branchName), row);
    const normalized = normalizeBranchKey(branchName);
    if (normalized) map.set(normalized, row);
  }
  return map;
}

function rowForBranch(map, branchName) {
  return map.get(text(branchName)) || map.get(normalizeBranchKey(branchName)) || null;
}

function branchNodes(branch) {
  return childrenByName(branch, 'Node');
}

function pointFromPosition(positionText) {
  const values = text(positionText).match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (values.length >= 3) return [values[0], values[2], -values[1]];
  return null;
}

function distanceBetweenPositions(fromText, toText) {
  const from = pointFromPosition(fromText);
  const to = pointFromPosition(toText);
  if (!from || !to) return null;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number.isFinite(length) ? length : null;
}

function previousPositiveNode(nodes, startIndex) {
  for (let index = startIndex; index >= 0; index -= 1) {
    const number = numericValue(childText(nodes[index], 'NodeNumber'));
    if (number !== null && number > 0) return nodes[index];
  }
  return null;
}

function shouldAnnotateInlineLength(node) {
  return INLINE_LENGTH_COMPONENT_TYPES.has(childText(node, 'ComponentType').toUpperCase());
}

function annotateInlineElementLengths(document, enriched) {
  let count = 0;
  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const nodes = branchNodes(branch);
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!shouldAnnotateInlineLength(node)) continue;
      const existing = numericValue(childText(node, 'ElementLengthMm'));
      if (existing !== null && existing > 0) continue;
      const previous = previousPositiveNode(nodes, index - 1);
      if (!previous) continue;
      const length = distanceBetweenPositions(childText(previous, 'Position'), childText(node, 'Position'));
      if (length === null || length <= 0) continue;
      if (setText(document, node, 'ElementLengthMm', length.toFixed(3))) count += 1;
    }
  }
  enriched.stats = enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {};
  enriched.stats.instElementLengthAnnotations = count;
  if (count > 0) {
    enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
    enriched.diagnostics.push({
      type: 'element-length-inst',
      componentType: 'INST',
      annotatedNodes: count,
      message: 'ElementLengthMm calculated for INST nodes from previous positive-node CII coordinate distance.',
    });
  }
  return count;
}

function positiveNodeNumberFromOriginal(originalNumbers, nodes, startIndex, step) {
  for (let index = startIndex; index >= 0 && index < nodes.length; index += step) {
    const original = originalNumbers.get(nodes[index]);
    if (original !== null && original !== undefined && original > 0) return Math.round(original);
  }
  return null;
}

function ensureResolvedRigidMarker(document, node, componentType) {
  if (!RESOLVED_RIGID_MARKER_TYPES.has(componentType)) return false;
  return setTextAfter(document, node, 'Rigid', '2', 'Endpoint');
}

function renumberLengthBearingNegativeNodes(document) {
  const branches = [...document.getElementsByTagName('Branch')];
  const nodesByBranch = branches.map(branchNodes);
  const originalNumbers = new Map();
  const used = new Set();
  for (const nodes of nodesByBranch) {
    for (const node of nodes) {
      const number = numericValue(childText(node, 'NodeNumber'));
      originalNumbers.set(node, number);
      if (number !== null && number > 0) used.add(Math.round(number));
    }
  }

  let fallback = 10000;
  let changed = 0;
  let rigidMarkers = 0;
  for (const nodes of nodesByBranch) {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const nodeNumber = originalNumbers.get(node);
      const componentType = childText(node, 'ComponentType').toUpperCase();
      const elementLength = numericValue(childText(node, 'ElementLengthMm'));
      if (nodeNumber === null || nodeNumber === undefined || Math.round(nodeNumber) >= 0) continue;
      if (!RENUMBERABLE_NEGATIVE_TYPES.has(componentType) || elementLength === null || elementLength <= 0) continue;

      const previous = positiveNodeNumberFromOriginal(originalNumbers, nodes, index - 1, -1);
      const next = positiveNodeNumberFromOriginal(originalNumbers, nodes, index + 1, 1);
      const candidates = [
        next !== null ? next - 1 : null,
        previous !== null ? previous + 1 : null,
      ].filter((candidate) => candidate !== null && candidate > 0 && !used.has(candidate));

      let assigned = candidates[0];
      if (!assigned) {
        while (used.has(fallback)) fallback += 10;
        assigned = fallback;
        fallback += 10;
      }
      setText(document, node, 'NodeNumber', assigned);
      if (ensureResolvedRigidMarker(document, node, componentType)) rigidMarkers += 1;
      used.add(assigned);
      changed += 1;
    }
  }
  return { renumberedNodes: changed, rigidMarkers };
}

function applyCondenseRigidOption(enriched, document, options = {}) {
  const config = enriched?.config || {};
  const enabled = truthy(config.splitCondensedValveFlange) || truthy(config.split_condensed_valve_flange) || truthy(options?.splitCondensedValveFlange) || truthy(options?.split_condensed_valve_flange);
  enriched.stats = enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {};
  enriched.stats.condenseRigidXsd = truthy(config.condenseRigidXsd) || truthy(options?.condenseRigidXsd);
  enriched.stats.splitCondensedValveFlange = enabled;
  enriched.stats.split_condensed_valve_flange = enabled;
  if (!enabled) return 0;
  const result = renumberLengthBearingNegativeNodes(document);
  enriched.stats.splitCondensedRigidNodes = result.renumberedNodes;
  enriched.stats.instRigid2Annotations = result.rigidMarkers;
  enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
  enriched.diagnostics.push({
    type: 'split-condensed-valve-flange-resolved',
    enabled: true,
    split_condensed_valve_flange: true,
    renumberedNodes: result.renumberedNodes,
    instRigid2Annotations: result.rigidMarkers,
    message: 'Resolved Condense Rigid option applied: length-bearing negative RIGID/FLAN/INST nodes are assigned positive node numbers; resolved INST nodes are marked with Rigid=2 before CII conversion.',
  });
  return result.renumberedNodes;
}

function applyPreviewRunParity(enriched, sourceXmlText, stagedJsonText, options = {}) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return enriched;
  enriched.config = configWithRuntimeOptions(enriched.config, options);
  const document = new DOMParser().parseFromString(enriched.xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return enriched;

  const rows = xmlCiiDryRunPreview(sourceXmlText, enriched.config, stagedJsonText).branchRows || [];
  if (!rows.length) {
    annotateInlineElementLengths(document, enriched);
    applyCondenseRigidOption(enriched, document, options);
    enriched.xmlText = new XMLSerializer().serializeToString(document);
    enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
    enriched.diagnostics.push({ type: 'preview-run-parity-skipped', reason: 'no-preview-branch-rows' });
    return enriched;
  }

  const byBranch = rowsByBranchName(rows);
  let branchCount = 0;
  let processCount = 0;
  let nodeFactCount = 0;
  const missedBranches = [];

  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = childText(branch, 'Branchname');
    const row = rowForBranch(byBranch, branchName);
    if (!row) {
      if (branchName) missedBranches.push(branchName);
      continue;
    }
    branchCount += 1;
    processCount += setProcessBlock(document, branch, row);
    nodeFactCount += setBranchNodeFacts(document, branch, row);
  }

  annotateInlineElementLengths(document, enriched);
  applyCondenseRigidOption(enriched, document, options);
  enriched.xmlText = new XMLSerializer().serializeToString(document);
  enriched.stats = enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {};

  if (!branchCount) {
    enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
    enriched.diagnostics.push({ type: 'preview-run-parity-skipped', reason: 'no-branch-name-match', previewRows: rows.length, missedBranches: missedBranches.slice(0, 20) });
    return enriched;
  }
  enriched.stats.previewRunParityBranches = branchCount;
  enriched.stats.previewRunParityProcessFields = processCount;
  enriched.stats.previewRunParityNodeFacts = nodeFactCount;
  enriched.stats.processAnnotations = Math.max(Number(enriched.stats.processAnnotations || 0), processCount);
  enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
  enriched.diagnostics.push({
    type: 'preview-run-parity-applied',
    branches: branchCount,
    processFields: processCount,
    nodeFacts: nodeFactCount,
    previewRows: rows.length,
    missedBranches: missedBranches.slice(0, 20),
    message: 'Run/enriched XML was synchronised from the same dry-run preview resolver used by phase 3.',
  });
  return enriched;
}

export async function enrichXmlForCii2019(xmlTextVal, stagedJsonText, options = {}) {
  const enriched = await enrichXmlForCii2019Base(xmlTextVal, stagedJsonText, options);
  return applyPreviewRunParity(enriched, xmlTextVal, stagedJsonText, options);
}
