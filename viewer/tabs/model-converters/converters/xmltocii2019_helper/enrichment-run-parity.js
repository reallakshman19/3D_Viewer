import { enrichXmlForCii2019 as enrichXmlForCii2019Base } from './enrichment-core.js?v=20260620-rating-override-1';
import { xmlCiiDryRunPreview } from './preview-renderer.js?v=20260623-preview-run-parity-1';

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
  if (!clean) return false;
  const element = ensureChild(document, parent, name);
  const before = text(element.textContent);
  element.textContent = clean;
  return before !== clean;
}

function setProcessBlock(document, branch, row) {
  let count = 0;
  const pressure = ensureChild(document, branch, 'Pressure');
  const temperature = ensureChild(document, branch, 'Temperature');

  if (setText(document, pressure, 'Pressure1', row.p1)) count += 1;
  if (setText(document, temperature, 'Temperature1', row.t1)) count += 1;
  if (setText(document, temperature, 'Temperature2', row.t2)) count += 1;
  if (setText(document, temperature, 'Temperature3', row.t3)) count += 1;
  if (setText(document, branch, 'FluidDensity', row.density)) count += 1;
  return count;
}

function setBranchNodeFacts(document, branch, row) {
  let count = 0;
  for (const node of childrenByName(branch, 'Node')) {
    if (setText(document, node, 'PipingClass', row.pipingClass)) count += 1;
    if (setText(document, node, 'Rating', row.rating)) count += 1;
    if (row.sizeMm != null && setText(document, node, 'BoreMm', Number(row.sizeMm).toFixed(3))) count += 1;
    if (setText(document, node, 'WallThickness', row.wallThickness)) count += 1;
    if (setText(document, node, 'CorrosionAllowance', row.corrosion)) count += 1;
    if (setText(document, node, 'MaterialName', row.material)) count += 1;
    if (setText(document, node, 'MaterialCode', row.materialCode)) count += 1;
  }
  if (setText(document, branch, 'MaterialNumber', row.materialCode)) count += 1;
  return count;
}

function applyPreviewRunParity(enriched, sourceXmlText, stagedJsonText) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return enriched;
  const rows = xmlCiiDryRunPreview(sourceXmlText, enriched.config, stagedJsonText).branchRows || [];
  if (!rows.length) return enriched;

  const rowsByBranch = new Map(rows.map((row) => [row.branchName, row]));
  const document = new DOMParser().parseFromString(enriched.xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return enriched;

  let branchCount = 0;
  let processCount = 0;
  let nodeFactCount = 0;

  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const row = rowsByBranch.get(childText(branch, 'Branchname'));
    if (!row) continue;
    branchCount += 1;
    processCount += setProcessBlock(document, branch, row);
    nodeFactCount += setBranchNodeFacts(document, branch, row);
  }

  if (!branchCount) return enriched;
  enriched.xmlText = new XMLSerializer().serializeToString(document);
  enriched.stats = enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {};
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
    message: 'Run/enriched XML was synchronised from the same dry-run preview resolver used by phase 3.',
  });
  return enriched;
}

export async function enrichXmlForCii2019(xmlTextVal, stagedJsonText, options = {}) {
  const enriched = await enrichXmlForCii2019Base(xmlTextVal, stagedJsonText, options);
  return applyPreviewRunParity(enriched, xmlTextVal, stagedJsonText);
}
