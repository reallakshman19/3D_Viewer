import {
  enrichXmlForCii2019 as enrichXmlForCii2019Base,
  deriveBoreFromBranchName,
  derivePipingClassFromBranchName,
  deriveRatingFromPipingClass,
} from './enrichment-core.js?v=20260620-rating-override-1';
import { deriveLineKeyFromBranchName } from '../../../../converters/xml-cii2019-core/regex-line-key.js';
import { computeLineNoKey } from '../../../../converters/xml-cii2019-core/linelist-mapping.js';
import { resolveLineListDensity } from '../../../../converters/xml-cii2019-core/line-density-resolver.js';
import { buildPipingClassIndex } from '../../../../converters/xml-cii2019-core/piping-class-resolver.js';
import { resolveBranchProcessData } from '../../../../converters/xml-cii2019-core/branch-process-resolver.js';

function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function xmlLocalName(node) {
  const name = node?.localName || node?.nodeName || '';
  return String(name).replace(/^.*:/, '');
}

function xmlChildrenByName(parent, localName) {
  return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && xmlLocalName(child) === localName);
}

function xmlFirstChild(parent, localName) {
  return xmlChildrenByName(parent, localName)[0] || null;
}

function xmlText(parent, localName) {
  const child = xmlFirstChild(parent, localName);
  return toText(child?.textContent).trim();
}

function xmlEnsureChild(document, parent, localName) {
  let element = xmlFirstChild(parent, localName);
  if (element) return element;
  element = parent?.namespaceURI
    ? document.createElementNS(parent.namespaceURI, localName)
    : document.createElement(localName);
  parent.appendChild(element);
  return element;
}

function xmlSetText(document, parent, localName, value) {
  const element = xmlEnsureChild(document, parent, localName);
  element.textContent = String(value);
  return element;
}

function parseNumericMm(value) {
  const text = toText(value).replace(/mm/gi, ' ').trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function rowNumber(row, keys) {
  for (const key of keys || []) {
    const direct = row?.[key];
    const raw = row?._raw?.[key];
    const numeric = parseNumericMm(direct ?? raw);
    if (numeric !== null) return numeric;
  }
  return null;
}

function rowText(row, keys) {
  for (const key of keys || []) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (toText(value).trim()) return toText(value).trim();
  }
  return '';
}

function regexGroup(text, pattern, groupIndex = 1) {
  const source = toText(text);
  const patternText = toText(pattern).trim();
  if (!source || !patternText) return '';
  try {
    const match = new RegExp(patternText, 'i').exec(source);
    const index = Math.max(0, Number(groupIndex || 0));
    return toText(match?.[index] || '').trim();
  } catch {
    return '';
  }
}

function xmlCiiNormalizeLineKey(value) {
  return toText(value).trim().toUpperCase().replace(/\s+/g, '');
}

function xmlCiiLineKeyRegexValue(value, pattern, groupIndex) {
  const text = toText(value).trim();
  const patternText = toText(pattern).trim();
  if (!text || !patternText) return text;
  const regexHit = regexGroup(text, patternText, groupIndex || 1);
  return regexHit || text;
}

function lineListRowKey(row, config) {
  const fieldMap = config?.linelist?.fieldMap || {};
  const mapped = computeLineNoKey(row, fieldMap);
  if (mapped) return mapped;

  const key1 = rowText(row, ['lineKey1', 'Key 1', 'ColumnX1', 'Service', 'Fluid']);
  const key2 = rowText(row, ['lineKey2', 'Key 2', 'ColumnX2', 'Line number', 'Line Number', 'Line No']);
  if (key1 || key2) return `${key1}${key2}`;

  return rowText(row, [
    'lineNoKey',
    'lineNo',
    'lineKey',
    'lineSeqNo',
    'LineNo',
    'Line No',
    'Line Number',
    'PipelineReference',
  ]);
}

export function xmlCiiFindPreviewParityLineListRow(branchLineKey, config) {
  const rows = Array.isArray(config?.linelist?.masterRows) ? config.linelist.masterRows : [];
  if (!rows.length) return null;
  const lookupKey = xmlCiiNormalizeLineKey(branchLineKey);
  const columnRegex = config?.linelist?.linelistColumnRegex || '';
  const columnGroup = config?.linelist?.linelistColumnGroup || 1;

  for (const row of rows) {
    const rawKey = lineListRowKey(row, config);
    const cleanKey = xmlCiiNormalizeLineKey(xmlCiiLineKeyRegexValue(rawKey, columnRegex, columnGroup));
    if (cleanKey && cleanKey === lookupKey) return row;
  }
  return null;
}

function processDefaultValue(config, fieldKey) {
  const defaults = config?.processDefaults && typeof config.processDefaults === 'object'
    ? config.processDefaults
    : {};
  return toText(defaults[fieldKey]).trim();
}

function xmlCiiProcessValue(pdOverride, row, overrideKey, rowKeys, config) {
  if (pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey)) {
    const overrideText = toText(pdOverride[overrideKey]).trim();
    if (overrideText !== '') return overrideText;
  }

  const rowValue = rowText(row, rowKeys);
  if (rowValue) return rowValue;

  return processDefaultValue(config, overrideKey);
}

function xmlCiiApplyPreviewParityProcessData(document, branch, row, config, branchLineKey, explicitOverride = null) {
  if (!row && !explicitOverride) return 0;
  let count = 0;
  const rowLineKey = rowText(row, ['lineNoKey', 'lineNo', 'lineSeqNo', 'lineKey']) || '';
  const lineKey = branchLineKey || rowLineKey;
  const pdOverride = explicitOverride || (lineKey && config?.overrides?.processData?.[lineKey]) || {};

  const p1 = xmlCiiProcessValue(pdOverride, row, 'p1', ['p1', 'P1'], config);
  const hydro = xmlCiiProcessValue(pdOverride, row, 'hydroPressure', [
    'hydroPressure',
    'Hydro Test Pressure',
    'Hydrotest Pressure',
    'Hydro Pressure',
    'Hydro Pr',
    'Hyd Test Pr',
    'Hyd. Test Pressure',
    'Test Pressure',
    'TEST_PRESSURE',
    'HYDRO_TEST_PRESSURE',
    'Pressure Test',
    'Proof Pressure',
  ], config);
  const t1 = xmlCiiProcessValue(pdOverride, row, 't1', ['t1', 'T1'], config);
  const t2 = xmlCiiProcessValue(pdOverride, row, 't2', [
    't2',
    'T2',
    'Temperature2',
    'Temperature 2',
    'Temp',
    'Temp. C',
    'Temp °C',
  ], config);
  const t3 = xmlCiiProcessValue(pdOverride, row, 't3', [
    't3',
    'T3',
    'Temperature3',
    'Temperature 3',
    'Temp Min',
    'Temp Min C',
    'Temp Min °C',
    'Min',
  ], config);
  const insThk = xmlCiiProcessValue(pdOverride, row, 'insThk', ['insThk', 'InsThk'], config);
  const densityInfo = resolveLineListDensity(row, pdOverride);
  const density = densityInfo.value || processDefaultValue(config, 'density');

  const pressure = xmlEnsureChild(document, branch, 'Pressure');
  if (p1) {
    xmlSetText(document, pressure, 'Pressure1', p1);
    count += 1;
  }
  if (hydro) {
    xmlSetText(document, pressure, 'HydroPressure', hydro);
    count += 1;
  }

  const temperature = xmlEnsureChild(document, branch, 'Temperature');
  if (t1) {
    xmlSetText(document, temperature, 'Temperature1', t1);
    count += 1;
  }
  if (t2) {
    xmlSetText(document, temperature, 'Temperature2', t2);
    count += 1;
  }
  if (t3) {
    xmlSetText(document, temperature, 'Temperature3', t3);
    count += 1;
  }
  if (insThk) {
    xmlSetText(document, branch, 'InsulationThickness', insThk);
    xmlSetText(document, branch, 'InsulationDensity', insThk);
    count += 1;
  }
  if (density) {
    xmlSetText(document, branch, 'FluidDensity', density);
    count += 1;
  }
  return count;
}

function applyResolvedBranchData(document, branch, config, branchName, lineKey, lineListMatch) {
  const derivedClassRaw = derivePipingClassFromBranchName(branchName, config)
    || rowText(lineListMatch, ['pipingClass', 'PipingClass', 'Piping Class', 'PIPING_CLASS']);
  const branchBore = deriveBoreFromBranchName(branchName, config)
    || rowNumber(lineListMatch, ['convertedBore', 'Bore']);

  const resolverLineRow = {
    ...(lineListMatch || {}),
    pipingClass: derivedClassRaw || rowText(lineListMatch, ['pipingClass', 'PipingClass', 'Piping Class', 'PIPING_CLASS']),
  };

  const resolved = resolveBranchProcessData({
    branchName,
    lineKey,
    lineRow: resolverLineRow,
    boreMm: branchBore,
    componentType: 'PIPE',
    rating: deriveRatingFromPipingClass(derivedClassRaw, config) || rowText(lineListMatch, ['rating', 'Rating']),
    materialMap: config?.material?.mapRows || [],
    pipingClassIndex: buildPipingClassIndex(config?.pipingClass?.masterRows || []),
    overrides: config?.overrides || {},
    xmlNode: null,
    xmlBranch: branch,
    config,
  });

  const pipingClass = resolved.pipingClass || derivedClassRaw;
  const branchRating = resolved.pipingClassMatchedRow?.rating
    || deriveRatingFromPipingClass(pipingClass, config)
    || rowText(lineListMatch, ['rating', 'Rating']);

  let count = 0;
  for (const node of xmlChildrenByName(branch, 'Node')) {
    if (pipingClass) {
      xmlSetText(document, node, 'PipingClass', pipingClass);
      count += 1;
    }
    if (branchRating) {
      xmlSetText(document, node, 'Rating', branchRating);
      count += 1;
    }
    if (branchBore !== null) {
      xmlSetText(document, node, 'BoreMm', branchBore.toFixed(3));
      count += 1;
    }
    if (resolved.wallThicknessMm) {
      xmlSetText(document, node, 'WallThickness', Number(resolved.wallThicknessMm.toPrecision(6)).toString());
      count += 1;
    }
    if (resolved.corrosionAllowanceMm != null) {
      xmlSetText(document, node, 'CorrosionAllowance', String(resolved.corrosionAllowanceMm));
      count += 1;
    }
    if (resolved.material) {
      xmlSetText(document, node, 'MaterialName', resolved.material);
      count += 1;
    }
    if (resolved.materialCode) {
      xmlSetText(document, node, 'MaterialCode', resolved.materialCode);
      xmlSetText(document, branch, 'MaterialNumber', resolved.materialCode);
      count += 1;
    }
  }

  return {
    count,
    pipingClass,
    branchRating,
    branchBore,
    wallThicknessMm: resolved.wallThicknessMm,
    corrosionAllowanceMm: resolved.corrosionAllowanceMm,
    materialCode: resolved.materialCode || '',
  };
}

export function applyXmlCiiPreviewProcessParity(enriched) {
  if (!enriched || typeof enriched !== 'object' || !enriched.xmlText) return enriched;
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return enriched;

  const config = enriched.config || {};
  const parser = new DOMParser();
  const document = parser.parseFromString(enriched.xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return enriched;

  const diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
  const stats = enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {};
  let lineListMatches = 0;
  let processAnnotations = 0;
  let resolvedBranchAnnotations = 0;

  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = xmlText(branch, 'Branchname');
    const lineKey = deriveLineKeyFromBranchName(branchName, config);
    const lineListMatch = lineKey ? xmlCiiFindPreviewParityLineListRow(lineKey, config) : null;
    const processOverride = lineKey ? config?.overrides?.processData?.[lineKey] : null;

    if (lineKey) {
      xmlSetText(document, branch, 'PipelineReference', lineKey);
      xmlSetText(document, branch, 'LineNo', lineKey);
    }

    if (lineListMatch) {
      lineListMatches += 1;
      processAnnotations += xmlCiiApplyPreviewParityProcessData(document, branch, lineListMatch, config, lineKey, processOverride);
    } else if (processOverride) {
      processAnnotations += xmlCiiApplyPreviewParityProcessData(document, branch, processOverride, config, lineKey, processOverride);
    }

    const branchResolved = applyResolvedBranchData(document, branch, config, branchName, lineKey, lineListMatch || processOverride || null);
    resolvedBranchAnnotations += branchResolved.count;

    if (lineListMatch || processOverride || branchResolved.count) {
      diagnostics.push({
        type: 'preview-process-parity',
        branchName,
        lineKey,
        lineListMatched: !!lineListMatch,
        processOverride: !!processOverride,
        pipingClass: branchResolved.pipingClass || '',
        rating: branchResolved.branchRating || '',
        boreMm: branchResolved.branchBore,
        wallThickness: branchResolved.wallThicknessMm == null ? '' : String(branchResolved.wallThicknessMm),
        corrosion: branchResolved.corrosionAllowanceMm == null ? '' : String(branchResolved.corrosionAllowanceMm),
        materialCode: branchResolved.materialCode || '',
      });
    }
  }

  stats.previewParityLineListMatches = lineListMatches;
  stats.previewParityProcessAnnotations = processAnnotations;
  stats.previewParityResolvedBranchAnnotations = resolvedBranchAnnotations;
  enriched.stats = stats;
  enriched.diagnostics = diagnostics;
  enriched.xmlText = new XMLSerializer().serializeToString(document);
  return enriched;
}

export async function enrichXmlForCii2019(xmlTextVal, stagedJsonText, options = {}) {
  const enriched = await enrichXmlForCii2019Base(xmlTextVal, stagedJsonText, options);
  return applyXmlCiiPreviewProcessParity(enriched);
}
