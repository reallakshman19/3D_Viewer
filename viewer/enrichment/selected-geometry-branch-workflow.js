/**
 * Functionality: adapts the XML->CII branch enrichment resolver to immutable
 * selected-geometry scopes. Parameters: selected scope snapshots, imported
 * master rows, and editable XML->CII-style config. Outputs: branch preview rows
 * and enriched object snapshots. Fallback: unresolved branches are preserved
 * with review diagnostics; source geometry is never mutated.
 */

import { deriveLineKeyFromBranchName, tokenAtPosition, tokenizeBranchName } from '../converters/xml-cii2019-core/regex-line-key.js';
import { computeLineNoKey, detectLineListFieldMap, normalizeLineListRow } from '../converters/xml-cii2019-core/linelist-mapping.js';
import { parseXmlCiiEnrichmentConfig, toFiniteNumber } from '../converters/xml-cii2019-core/config.js';
import { buildPipingClassIndex } from '../converters/xml-cii2019-core/piping-class-resolver.js';
import { resolveBranchProcessData } from '../converters/xml-cii2019-core/branch-process-resolver.js';
import { resolveLineListDensity } from '../converters/xml-cii2019-core/line-density-resolver.js';
import { rankXmlCiiWeightCandidates } from '../converters/xml-cii2019-core/weight-valve-hints.js';
import { cloneSafe, freezeDeep, normalizeKey, rowNumber, rowValue, text } from './selected-geometry-shared.js';

export const SELECTED_GEOMETRY_BRANCH_WORKFLOW_SCHEMA = 'selected-geometry-branch-workflow/v1';
export const SELECTED_GEOMETRY_BRANCH_ENRICHMENT_SCHEMA = 'selected-geometry-branch-enrichment/v1';

const MATERIAL_TOKENS = /^(CS|SS|LTCS|DSS|SDSS|ALLOY|GI|CI|DI|PVC|CPVC|HDPE|GRP|GRE)$/i;
const OD_TO_DN = Object.freeze([[10.3, 6], [13.7, 8], [17.1, 10], [21.3, 15], [26.7, 20], [33.4, 25], [42.2, 32], [48.3, 40], [60.3, 50], [73.0, 65], [88.9, 80], [114.3, 100], [141.3, 125], [168.3, 150], [219.1, 200], [273.0, 250], [323.9, 300], [355.6, 350], [406.4, 400], [457.0, 450], [508.0, 500], [610.0, 600]]);

export function buildSelectedGeometryWorkflowConfig(input) {
  const options = input && typeof input === 'object' ? input : {};
  const rawConfig = options.config && typeof options.config === 'object' ? options.config : {};
  const masters = options.masters && typeof options.masters === 'object' ? options.masters : {};
  const config = parseXmlCiiEnrichmentConfig(JSON.stringify(rawConfig));
  const lineRows = rowsFromMaster(masters.lineList);
  const fieldMap = detectLineListFieldMap(lineRows, config.linelist?.fieldMap || {}, config);
  const normalizedLineRows = lineRows.map((row, index) => normalizeLineListRow(row, fieldMap, index));
  config.linelist = { ...(config.linelist || {}), fieldMap, masterRows: normalizedLineRows };
  config.pipingClass = { ...(config.pipingClass || {}), masterRows: rowsFromMaster(masters.pipingClass) };
  config.material = { ...(config.material || {}), mapRows: rowsFromMaster(masters.materialMap) };
  config.weight = { ...(config.weight || {}), masterRows: rowsFromMaster(masters.weightMaster) };
  return config;
}

export function collectSelectedGeometryBranchGroups(scope, config) {
  const objects = Array.isArray(scope?.objects) ? scope.objects : [];
  const map = new Map();
  for (const object of objects) {
    const branchInfo = branchInfoForObject(object, config);
    const key = branchInfo.branchName || `missing:${object?.id || map.size}`;
    const current = map.get(key) || {
      branchName: branchInfo.branchName,
      lineKeyFallback: branchInfo.lineKeyFallback,
      objects: [],
      objectIds: [],
      objectNames: [],
    };
    current.objects.push(object);
    current.objectIds.push(text(object?.id));
    current.objectNames.push(text(object?.name || object?.id));
    if (!current.lineKeyFallback && branchInfo.lineKeyFallback) current.lineKeyFallback = branchInfo.lineKeyFallback;
    map.set(key, current);
  }
  return freezeDeep(Array.from(map.values()).map((group) => ({
    branchName: group.branchName,
    lineKeyFallback: group.lineKeyFallback,
    objectCount: group.objects.length,
    objectIds: group.objectIds.filter(Boolean),
    objectNames: group.objectNames.filter(Boolean),
    objects: group.objects,
  })));
}

export function buildSelectedGeometryBranchPreview(input) {
  const options = input && typeof input === 'object' ? input : {};
  const scope = options.scope && typeof options.scope === 'object' ? options.scope : {};
  const config = buildSelectedGeometryWorkflowConfig({ masters: options.masters, config: options.config });
  const groups = collectSelectedGeometryBranchGroups(scope, config);
  const pipingClassIndex = buildPipingClassIndex(config.pipingClass?.masterRows || []);
  const branchRows = groups.map((group) => resolveBranchGroup(group, config, pipingClassIndex));
  const nodeRows = branchRows.flatMap((row) => row.weightRows || []);
  const diagnostics = branchRows.flatMap(branchDiagnostics);
  return freezeDeep({
    schema: SELECTED_GEOMETRY_BRANCH_WORKFLOW_SCHEMA,
    scopeMode: text(scope.scopeMode || 'selected'),
    capturedAt: text(scope.capturedAt),
    counts: {
      objects: Number(scope.stats?.objects || scope.objects?.length || 0),
      branches: branchRows.length,
      resolved: branchRows.filter((row) => !row.needsReview).length,
      diagnostics: diagnostics.length,
      weights: nodeRows.length,
    },
    config,
    groups,
    branchRows,
    nodeRows,
    diagnostics,
  });
}

export function enrichSelectedGeometryScopeWithBranchWorkflow(input) {
  const options = input && typeof input === 'object' ? input : {};
  const scope = options.scope && typeof options.scope === 'object' ? options.scope : {};
  const preview = buildSelectedGeometryBranchPreview({ scope, masters: options.masters, config: options.config });
  const byBranch = new Map(preview.branchRows.map((row) => [normalizeBranchKey(row.branchName), row]));
  const objects = (Array.isArray(scope.objects) ? scope.objects : []).map((object) => {
    const branchInfo = branchInfoForObject(object, preview.config);
    const row = byBranch.get(normalizeBranchKey(branchInfo.branchName)) || null;
    return enrichObjectFromBranchRow(object, row, branchInfo);
  });
  return freezeDeep({
    ...scope,
    schema: scope.schema || 'selected-geometry-scope/v1',
    objects,
    branchWorkflowPreview: preview,
  });
}

function resolveBranchGroup(group, config, pipingClassIndex) {
  const branchName = text(group.branchName);
  const lineKey = deriveLineKeyFromBranchName(branchName, config) || text(group.lineKeyFallback);
  const lineListMatch = lineKey ? findLineListRow(lineKey, config) : null;
  const lineListClass = rowText(lineListMatch, ['pipingClass', 'Piping Class', 'PIPING_CLASS']);
  const branchClass = derivePipingClassFromBranchName(branchName, config);
  const derivedClassRaw = branchClass || lineListClass;
  const boreMm = deriveBoreFromBranchName(branchName, config) || boreFromGroup(group, lineListMatch, config);
  const ratingKeys = uniqueKeys([lineKey, branchName, derivedClassRaw]);
  const manualRating = ratingOverride(config, ratingKeys);
  const rowRating = rowText(lineListMatch, ['rating', 'Rating', 'RATING']);
  const inputRating = manualRating || deriveRatingFromPipingClass(derivedClassRaw, config) || rowRating;
  const resolverLineRow = { ...(lineListMatch || {}), pipingClass: derivedClassRaw };
  const resolved = resolveBranchProcessData({
    branchName,
    lineKey,
    lineRow: resolverLineRow,
    boreMm,
    componentType: 'PIPE',
    rating: inputRating,
    materialMap: config.material?.mapRows || [],
    pipingClassIndex,
    overrides: config.overrides || {},
    xmlNode: null,
    xmlBranch: null,
    config,
  });
  const branchRating = manualRating || deriveRatingFromPipingClass(resolved.pipingClass, config) || resolved.rating || rowRating;
  const pdOverride = (lineKey && config?.overrides?.processData?.[lineKey]) || {};
  const densityInfo = resolveLineListDensity(lineListMatch, pdOverride);
  const densityDefault = lineListMatch ? processDefaultValue(config, 'density') : '';
  const materialCodeMethod = materialCodeMethodFor(resolved.materialSource);
  const weightRows = buildWeightRowsForGroup(group, {
    branchName,
    lineKey,
    boreMm,
    rating: branchRating,
    pipingClass: resolved.pipingClass,
    config,
  });
  const missing = [];
  if (!branchName) missing.push('branchName');
  if (!lineKey) missing.push('lineKey');
  if (!lineListMatch) missing.push('lineList');
  if (!resolved.pipingClass) missing.push('pipingClass');
  if (!resolved.materialCode) missing.push('materialCode');
  const needsReview = Boolean(missing.length || resolved.pipingClassNeedsReview || !branchRating);
  return {
    branchName,
    objectCount: group.objectCount,
    sampleObject: group.objectNames?.[0] || group.objectIds?.[0] || '',
    lineKey,
    lineMiss: !lineListMatch,
    size: boreMm != null ? `${boreMm}mm` : '',
    sizeMm: boreMm,
    pipingClass: resolved.pipingClass || '',
    pipingClassDerived: derivedClassRaw || '',
    pipingClassMethod: resolved.pipingClassMatchMethod || '',
    pipingClassConfidence: resolved.pipingClassConfidence ?? null,
    pipingClassScore: resolved.pipingClassScore ?? null,
    pipingClassRowScore: resolved.pipingClassRowScore ?? null,
    pipingClassRowReasons: resolved.pipingClassRowReasons || [],
    pipingClassNeedsReview: Boolean(resolved.pipingClassNeedsReview),
    pipingClassCandidates: resolved.pipingClassCandidates || [],
    material: resolved.material || '',
    materialSource: resolved.materialSource || overrideSource(config.overrides, 'material', lineKey),
    materialCode: resolved.materialCode || '',
    materialCodeMethod,
    materialCodeNeedsReview: !resolved.materialCode,
    rating: branchRating || '',
    ratingSource: manualRating ? 'override' : (branchRating ? 'piping-class-prefix' : 'none'),
    p1: processValue(pdOverride, lineListMatch, 'p1', ['p1'], config),
    t1: processValue(pdOverride, lineListMatch, 't1', ['t1'], config),
    t2: processValue(pdOverride, lineListMatch, 't2', ['t2'], config),
    t3: processValue(pdOverride, lineListMatch, 't3', ['t3'], config),
    density: densityInfo.value || densityDefault,
    p1Source: processSource(pdOverride, lineListMatch, 'p1', ['p1'], config),
    t1Source: processSource(pdOverride, lineListMatch, 't1', ['t1'], config),
    t2Source: processSource(pdOverride, lineListMatch, 't2', ['t2'], config),
    t3Source: processSource(pdOverride, lineListMatch, 't3', ['t3'], config),
    densitySource: densityInfo.value ? densityInfo.source : (densityDefault ? 'default' : (lineListMatch ? 'none' : 'line-list-missing')),
    wallThickness: resolved.wallThicknessMm != null ? String(Number(resolved.wallThicknessMm.toPrecision(6))) : '',
    wallThicknessSource: resolved.wallThicknessSource || overrideSource(config.overrides, 'wallThickness', lineKey),
    corrosion: resolved.corrosionAllowanceMm != null ? String(resolved.corrosionAllowanceMm) : '',
    corrosionSource: resolved.corrosionSource || overrideSource(config.overrides, 'corrosion', lineKey),
    weightRows,
    missing,
    needsReview,
    status: needsReview ? 'review' : 'resolved',
  };
}

function enrichObjectFromBranchRow(object, row, branchInfo) {
  const source = object && typeof object === 'object' ? object : {};
  const missing = row?.missing || ['branchWorkflow'];
  const audit = {
    sources: row ? [{ source: 'xml-cii-branch-workflow', method: row.pipingClassMethod || 'branch-regex', confidence: row.pipingClassConfidence }] : [],
    method: 'xml-cii-branch-workflow',
    confidence: row?.pipingClassConfidence ?? null,
    needsReview: !row || Boolean(row.needsReview),
    conflicts: [],
    missing,
  };
  return freezeDeep({
    ...source,
    sourceAttributes: cloneSafe(source.sourceAttributes || {}),
    calculatedFields: cloneSafe(source.calculatedFields || {}),
    attributes: {
      ...(source.attributes || {}),
      enrichment: {
        schema: SELECTED_GEOMETRY_BRANCH_ENRICHMENT_SCHEMA,
        branch: {
          branchName: row?.branchName || branchInfo.branchName || '',
          objectCount: row?.objectCount || 0,
          status: row?.status || 'review',
        },
        lineList: {
          lineNo: row?.lineKey || '',
          lineKey: row?.lineKey || '',
          p1: row?.p1 || '',
          t1: row?.t1 || '',
          t2: row?.t2 || '',
          t3: row?.t3 || '',
          density: row?.density || '',
        },
        pipingClass: {
          className: row?.pipingClass || '',
          requestedClass: row?.pipingClassDerived || '',
          rating: row?.rating || '',
          wallThicknessMm: numberFromText(row?.wallThickness),
          corrosionAllowanceMm: numberFromText(row?.corrosion),
          materialName: row?.material || '',
          materialCode: row?.materialCode || '',
        },
        material: {
          materialName: row?.material || '',
          materialCode: row?.materialCode || '',
          source: row?.materialSource || '',
        },
        weight: {
          rating: row?.rating || '',
          candidateCount: row?.weightRows?.length || 0,
          bestWeightKg: firstWeight(row?.weightRows),
        },
        audit,
      },
    },
  });
}

function buildWeightRowsForGroup(group, context) {
  const rows = [];
  const objects = Array.isArray(group.objects) ? group.objects : [];
  for (const object of objects.slice(0, 250)) {
    const lengthMm = objectLengthMm(object);
    const boreMm = context.boreMm || objectBoreMm(object, context.config);
    if (lengthMm === null || boreMm === null || !context.rating) continue;
    const ranking = rankXmlCiiWeightCandidates({
      boreMm,
      rating: context.rating,
      lengthMm,
      nodeName: text(object?.name || object?.id),
      componentType: text(object?.type),
      componentRefNo: text(object?.sourceAttributes?.COMPONENT_REF_NO || object?.sourceAttributes?.COMPONENTREFNO),
      dtxr: '',
    }, context.config, { includeRejected: true });
    const best = ranking.best || null;
    if (!best) continue;
    rows.push({
      key: `${context.branchName || 'branch'}::${object?.id || rows.length}`,
      branchName: context.branchName,
      lineKey: context.lineKey,
      nodeNumber: text(object?.toNode || object?.fromNode || object?.id),
      objectId: text(object?.id),
      componentType: text(object?.type),
      boreMm,
      rating: context.rating,
      resolvedPipingClass: context.pipingClass,
      lengthMm,
      weight: best.selectedWeight ?? best.suggestedWeight ?? best.weight ?? '',
      weightMethod: best.weightMethod || '',
      lengthDelta: best.lengthDelta,
      typeDesc: best.typeDesc || best.valveType || best.type || '',
      candidates: ranking.candidates.slice(0, 5),
      rejectedCandidates: ranking.rejectedCandidates.slice(0, 3),
    });
  }
  return rows;
}

function branchInfoForObject(object, config) {
  const attrs = object?.sourceAttributes || {};
  const candidates = [
    attrs.BRANCH_NAME,
    attrs.BRANCHNAME,
    attrs.BRANCH,
    attrs.OWNER,
    attrs.RVM_OWNER_PATH,
    attrs.RVM_OWNER_NAME,
    attrs.SOURCE_PATH,
    object?.sourcePath,
    object?.name,
  ].map(text).filter(Boolean);
  const branchName = bestBranchNameCandidate(candidates, config);
  const lineKeyFallback = text(attrs.LINEKEY || attrs.LINE_KEY || attrs.LINE_NO || attrs.LINE_NUMBER || rowValue(attrs, ['Line Number', 'Line No']));
  return { branchName, lineKeyFallback };
}

function bestBranchNameCandidate(candidates, config) {
  const delimiter = config?.linelist?.tokenDelimiter || '-';
  for (const value of candidates) {
    const direct = normalizeBranchText(value);
    if (looksLikeBranchName(direct, delimiter)) return direct;
    const fromPath = branchFromPathText(value, delimiter);
    if (fromPath) return fromPath;
  }
  return text(candidates[0] || '');
}

function normalizeBranchText(value) {
  const raw = text(value).replace(/\\/g, '/');
  const branchMatch = raw.match(/\/[^/]+\/B\d+\b/i);
  if (branchMatch) return branchMatch[0];
  return raw;
}

function branchFromPathText(value, delimiter) {
  const parts = text(value).replace(/\\/g, '/').split('/').map((part) => part.trim()).filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    const candidate = `/${parts.slice(index).join('/')}`;
    if (looksLikeBranchName(candidate, delimiter)) return candidate;
  }
  return '';
}

function looksLikeBranchName(value, delimiter) {
  const candidate = text(value);
  if (!candidate) return false;
  if (/\/B\d+\b/i.test(candidate) && candidate.includes(delimiter)) return true;
  return tokenizeBranchName(candidate, delimiter).length >= 4;
}

function findLineListRow(lineKey, config) {
  const lookupKey = normalizeLineKey(lineKey);
  const columnRegex = config.linelist?.linelistColumnRegex || '';
  const columnGroup = config.linelist?.linelistColumnGroup || 1;
  for (const row of config.linelist?.masterRows || []) {
    const rawKey = lineListRowKey(row, config);
    const cleanKey = normalizeLineKey(lineKeyRegexValue(rawKey, columnRegex, columnGroup));
    if (cleanKey && cleanKey === lookupKey) return row;
  }
  return null;
}

function lineListRowKey(row, config) {
  const mapped = computeLineNoKey(row, config.linelist?.fieldMap || {});
  if (mapped) return mapped;
  const key1 = rowText(row, ['lineKey1', 'Key 1', 'ColumnX1', 'Service', 'Fluid']);
  const key2 = rowText(row, ['lineKey2', 'Key 2', 'ColumnX2', 'Line number', 'Line Number', 'Line No']);
  if (key1 || key2) return `${key1}${key2}`;
  return rowText(row, ['lineNoKey', 'lineNo', 'lineKey', 'LineNo', 'Line No', 'Line Number', 'PipelineReference']);
}

function derivePipingClassFromBranchName(branchName, config) {
  const regexValue = regexGroup(branchName, config.rating?.pipingClassRegex, config.rating?.pipingClassGroup || 1);
  if (regexValue) return regexValue;
  const delimiter = config.rating?.tokenDelimiter || config.linelist?.tokenDelimiter || '-';
  const index = Number(config.rating?.pipingClassTokenIndex || 5);
  const value = tokenAtPosition(branchName, delimiter, index);
  const fourth = tokenAtPosition(branchName, delimiter, 4);
  const sixth = tokenAtPosition(branchName, delimiter, 6);
  if (index === 5 && MATERIAL_TOKENS.test(value) && looksLikeNpsToken(fourth) && /^S\d+/i.test(sixth)) return '';
  return value;
}

function deriveRatingFromPipingClass(pipingClass, config) {
  const source = text(pipingClass).toUpperCase();
  const sequence = Array.isArray(config.rating?.ratingSequence) ? config.rating.ratingSequence : [];
  for (const pair of sequence) {
    if (Array.isArray(pair) && pair.length >= 2 && source.startsWith(text(pair[0]).toUpperCase())) return text(pair[1]);
  }
  return '';
}

function deriveBoreFromBranchName(branchName, config) {
  const regexRaw = regexGroup(branchName, config.weight?.boreRegex, config.weight?.boreGroup || 1);
  const delimiter = config.weight?.tokenDelimiter || config.linelist?.tokenDelimiter || '-';
  const index = Number(config.weight?.boreTokenIndex || 3);
  let raw = regexRaw || tokenAtPosition(branchName, delimiter, index);
  if (!looksLikeNpsToken(raw) && index === 3) {
    const fourth = tokenAtPosition(branchName, delimiter, 4);
    const sixth = tokenAtPosition(branchName, delimiter, 6);
    if (looksLikeNpsToken(fourth) && /^S\d+/i.test(sixth)) raw = fourth;
  }
  return nominalDnFromNps(numericFromSizeToken(raw), config);
}

function boreFromGroup(group, lineRow, config) {
  const lineBore = rowNumber(lineRow, ['convertedBore', 'Bore', 'DN', 'NB']);
  if (lineBore !== null) return lineBore;
  for (const object of group.objects || []) {
    const bore = objectBoreMm(object, config);
    if (bore !== null) return bore;
  }
  return null;
}

function objectBoreMm(object, config) {
  const attrs = object?.sourceAttributes || {};
  const direct = firstNumber(attrs, ['BOREMM', 'BORE_MM', 'CONVERTED_BORE', 'DN', 'NB', 'NOMINAL_BORE']);
  if (direct !== null) return direct;
  const nps = firstNumber(attrs, ['NPS', 'NS', 'NOMINAL_SIZE']);
  if (nps !== null) return nominalDnFromNps(nps, config);
  const od = firstNumber(attrs, ['OUTSIDE_DIAMETER', 'OUTSIDEDIAMETER', 'PIPE_OD', 'OD', 'DIAMETER']);
  if (od !== null) return nominalDnFromOd(od);
  return null;
}

function objectLengthMm(object) {
  const attrs = object?.sourceAttributes || {};
  const explicit = firstNumber(attrs, ['ELEMENT_LENGTH_MM', 'ElementLengthMm', 'LENGTHMM', 'LENGTH_MM', 'LENGTH']);
  if (explicit !== null) return explicit;
  const a = pointFromObject(object?.apos);
  const b = pointFromObject(object?.lpos);
  if (!a || !b) return null;
  return Math.sqrt(((a.x - b.x) ** 2) + ((a.y - b.y) ** 2) + ((a.z - b.z) ** 2));
}

function pointFromObject(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value.X ?? value[0]);
  const y = Number(value.y ?? value.Y ?? value[1]);
  const z = Number(value.z ?? value.Z ?? value[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
}

function nominalDnFromNps(inches, config) {
  if (!Number.isFinite(inches)) return null;
  const map = config.weight?.npsToDn && typeof config.weight.npsToDn === 'object' ? config.weight.npsToDn : {};
  const key = String(Number(inches));
  const mapped = Number(map[key] ?? map[inches] ?? map[inches.toFixed(3)]);
  return Number.isFinite(mapped) ? mapped : inches * toFiniteNumber(config.weight?.inchToMm, 25.4);
}

function nominalDnFromOd(odNum) {
  if (!Number.isFinite(odNum)) return null;
  let best = null;
  for (const pair of OD_TO_DN) {
    const err = Math.abs(odNum - pair[0]);
    if (!best || err < best.err) best = { od: pair[0], dn: pair[1], err };
  }
  return best && best.err <= Math.max(1.5, Math.abs(best.od) * 0.006) ? best.dn : odNum;
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const numeric = numberFromText(rowValue(row, [key]));
    if (numeric !== null) return numeric;
  }
  return null;
}

function rowsFromMaster(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.masterRows)) return value.masterRows;
  if (Array.isArray(value?.mapRows)) return value.mapRows;
  return [];
}

function branchDiagnostics(row) {
  const diagnostics = [];
  for (const missing of row.missing || []) {
    diagnostics.push({ type: 'missing', branchName: row.branchName, lineKey: row.lineKey, field: missing, message: `${missing} unresolved` });
  }
  if (row.pipingClassNeedsReview) diagnostics.push({ type: 'review', branchName: row.branchName, lineKey: row.lineKey, field: 'pipingClass', message: 'Piping class match needs review' });
  return diagnostics;
}

function processDefaultValue(config, fieldKey) {
  const defaults = config?.processDefaults && typeof config.processDefaults === 'object' ? config.processDefaults : {};
  return text(defaults[fieldKey]);
}

function processValue(processOverride, row, overrideKey, rowKeys, config) {
  if (processOverride && Object.prototype.hasOwnProperty.call(processOverride, overrideKey)) return text(processOverride[overrideKey]);
  if (!row) return '';
  const rowVal = rowText(row, rowKeys);
  if (rowVal) return rowVal;
  return processDefaultValue(config, overrideKey);
}

function processSource(processOverride, row, overrideKey, rowKeys, config) {
  if (processOverride && Object.prototype.hasOwnProperty.call(processOverride, overrideKey)) return 'override';
  if (!row) return 'line-list-missing';
  if (rowText(row, rowKeys)) return 'linelist';
  return processDefaultValue(config, overrideKey) ? 'default' : 'none';
}

function rowText(row, keys) {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    const direct = row[key];
    if (text(direct)) return text(direct);
    const raw = row._raw?.[key];
    if (text(raw)) return text(raw);
  }
  return '';
}

function regexGroup(sourceText, pattern, groupIndex) {
  const source = text(sourceText);
  const patternText = text(pattern);
  if (!source || !patternText) return '';
  try {
    const match = new RegExp(patternText, 'i').exec(source);
    return text(match?.[Math.max(0, Number(groupIndex || 0))] || '');
  } catch {
    return '';
  }
}

function lineKeyRegexValue(value, pattern, groupIndex) {
  const source = text(value);
  const patternText = text(pattern);
  if (!source || !patternText) return source;
  return regexGroup(source, patternText, groupIndex || 1) || source;
}

function normalizeLineKey(value) {
  return text(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeBranchKey(value) {
  return normalizeKey(value || '');
}

function uniqueKeys(values) {
  return [...new Set((values || []).map(text).filter(Boolean))];
}

function bucketText(config, bucketName, keys) {
  const bucket = config?.overrides?.[bucketName];
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return '';
  for (const key of uniqueKeys(keys)) {
    if (Object.prototype.hasOwnProperty.call(bucket, key) && text(bucket[key])) return text(bucket[key]);
  }
  return '';
}

function processDataText(config, keys, fieldKey) {
  const bucket = config?.overrides?.processData;
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return '';
  for (const key of uniqueKeys(keys)) {
    const value = bucket[key]?.[fieldKey];
    if (text(value)) return text(value);
  }
  return '';
}

function ratingOverride(config, keys) {
  return bucketText(config, 'rating', keys) || processDataText(config, keys, 'rating');
}

function overrideSource(overrides, bucket, key) {
  return overrides?.[bucket] && Object.prototype.hasOwnProperty.call(overrides[bucket], key) ? 'override' : 'auto';
}

function materialCodeMethodFor(source) {
  if (source === 'override' || source === 'override-material-map') return 'override';
  if (source === 'line-list-material-map' || source === 'piping-class-material-map') return 'exact';
  if (source === 'xml-fallback') return 'xml-fallback';
  return 'none';
}

function looksLikeNpsToken(value) {
  return /^\s*\d+(?:\.\d+)?\s*(?:"|in|inch|nps)?\s*$/i.test(text(value));
}

function numericFromSizeToken(value) {
  const n = Number(text(value).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function numberFromText(value) {
  const match = text(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+/);
  const numeric = match ? Number(match[0]) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function firstWeight(weightRows) {
  const first = Array.isArray(weightRows) ? weightRows[0] : null;
  const numeric = numberFromText(first?.weight);
  return numeric === null ? null : numeric;
}
