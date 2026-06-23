import { parseXmlCiiEnrichmentConfig } from '../../../../converters/xml-cii2019-core/config.js';
import { enrichXmlForCii2019 as enrichXmlForCii2019Base } from './enrichment-core.js?v=20260620-rating-override-1';
import { xmlCiiDryRunPreview } from './preview-renderer.js?v=20260623-preview-run-parity-1';

const RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'RIGID']);

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

function ensureChild(document, parent, name) {
  let element = firstChild(parent, name);
  if (element) return element;
  element = parent?.namespaceURI ? document.createElementNS(parent.namespaceURI, name) : document.createElement(name);
  parent.appendChild(element);
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
  // The base core parses supportConfigJson, but the popup/rich workflow can mutate
  // config immediately before Run.  Re-merge here so preview parity uses the same
  // live masters, field maps, process overrides, rating overrides, and defaults as
  // the visible Preview table.
  const merged = mergeDeep(baseConfig || {}, parsed || {});
  if (isObject(options?.overrides)) merged.overrides = mergeDeep(merged.overrides || {}, options.overrides);
  if (Object.prototype.hasOwnProperty.call(options || {}, 'splitCondensedValveFlange')) {
    merged.splitCondensedValveFlange = truthy(options.splitCondensedValveFlange);
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

function positiveNodeNumberFromOriginal(originalNumbers, nodes, startIndex, step) {
  for (let index = startIndex; index >= 0 && index < nodes.length; index += step) {
    const original = originalNumbers.get(nodes[index]);
    if (original !== null && original !== undefined && original > 0) return Math.round(original);
  }
  return null;
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
      used.add(assigned);
      changed += 1;
    }
  }
  return changed;
}

function applyCondenseRigidOption(enriched, document, options = {}) {
  const enabled = truthy(enriched?.config?.splitCondensedValveFlange) || truthy(options?.splitCondensedValveFlange);
  enriched.stats = enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {};
  enriched.stats.splitCondensedValveFlange = enabled;
  if (!enabled) return 0;
  const changed = renumberLengthBearingNegativeNodes(document);
  enriched.stats.splitCondensedRigidNodes = changed;
  enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
  enriched.diagnostics.push({
    type: 'split-condensed-valve-flange',
    enabled: true,
    renumberedNodes: changed,
    message: 'Condense Rigid option applied: length-bearing negative RIGID/FLAN nodes are assigned positive node numbers before CII conversion.',
  });
  return changed;
}

function applyPreviewRunParity(enriched, sourceXmlText, stagedJsonText, options = {}) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return enriched;
  enriched.config = configWithRuntimeOptions(enriched.config, options);
  const document = new DOMParser().parseFromString(enriched.xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return enriched;

  const rows = xmlCiiDryRunPreview(sourceXmlText, enriched.config, stagedJsonText).branchRows || [];
  if (!rows.length) {
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
