import { cleanMaterialText, cleanMaterialCode, mapMaterialTextToCiiCode } from './linelist-mapping.js';
import { findBestPipingClassRow, normalizePipingClass } from './piping-class-resolver.js';
import { toFiniteNumber } from './config.js';

function text(value) {
  return String(value ?? '').trim();
}

function firstText(row, keys) {
  for (const key of keys || []) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (text(value)) return text(value);
  }
  return '';
}

function overrideValue(overrides, bucketName, keys = []) {
  const bucket = overrides?.[bucketName];
  if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
    for (const key of keys) {
      if (key && Object.prototype.hasOwnProperty.call(bucket, key) && text(bucket[key])) return text(bucket[key]);
    }
  }
  if (bucket !== undefined && (typeof bucket !== 'object' || bucket === null) && text(bucket)) return text(bucket);
  return '';
}

function numericOverrideValue(overrides, bucketName, keys = []) {
  const raw = overrideValue(overrides, bucketName, keys);
  const numeric = toFiniteNumber(raw);
  return numeric == null ? null : numeric;
}

function readClassRowRating(row) {
  return text(
    row?.rating ??
    row?.Rating ??
    row?.RATING ??
    row?.['Pressure Class'] ??
    row?.ratingClass ??
    ''
  );
}

export function resolveMaterialCodeFromLineMaterial({
  lineRow,
  materialMap,
  pipingClassRow,
  overrides = {},
  overrideKeys = [],
  xmlNode,
  xmlBranch
}) {
  const lineMaterialRaw = firstText(lineRow, ['material', 'Material', 'MATERIAL', 'Material_Name', 'MOC']);
  const classMaterialRaw = text(
    pipingClassRow?.materialName ||
    pipingClassRow?.Material_Name ||
    pipingClassRow?.Material ||
    pipingClassRow?.material ||
    ''
  );

  const materialOverride = overrideValue(overrides, 'material', overrideKeys);
  const materialText = cleanMaterialText(materialOverride || lineMaterialRaw || classMaterialRaw);

  const explicitMaterialCode = overrideValue(overrides, 'materialCode', overrideKeys);
  if (explicitMaterialCode) {
    return {
      material: materialText,
      materialCode: cleanMaterialCode(explicitMaterialCode),
      source: 'override'
    };
  }

  // Backward compatibility: old preview stored material-code overrides in overrides.material keyed by material text.
  const legacyMaterialCode = overrideValue(overrides, 'material', [lineMaterialRaw, classMaterialRaw, materialText].filter(Boolean));
  if (legacyMaterialCode && legacyMaterialCode !== materialOverride) {
    return {
      material: materialText,
      materialCode: cleanMaterialCode(legacyMaterialCode),
      source: 'override'
    };
  }

  const fromLineMaterial = mapMaterialTextToCiiCode(cleanMaterialText(materialText || lineMaterialRaw), materialMap);
  if (fromLineMaterial?.code) {
    return {
      material: cleanMaterialText(materialText || lineMaterialRaw),
      materialCode: cleanMaterialCode(fromLineMaterial.code),
      source: materialOverride ? 'override-material-map' : 'line-list-material-map',
      matchedRow: fromLineMaterial
    };
  }

  const fromClassMaterial = mapMaterialTextToCiiCode(cleanMaterialText(classMaterialRaw), materialMap);
  if (fromClassMaterial?.code) {
    return {
      material: materialText || cleanMaterialText(classMaterialRaw),
      materialCode: cleanMaterialCode(fromClassMaterial.code),
      source: 'piping-class-material-map',
      matchedRow: fromClassMaterial
    };
  }

  const xmlMaterial = cleanMaterialText(xmlNode?.material || xmlBranch?.material || '');
  return {
    material: materialText || cleanMaterialText(lineMaterialRaw) || cleanMaterialText(classMaterialRaw) || xmlMaterial,
    materialCode: '',
    source: xmlMaterial ? 'xml-fallback' : 'blank',
    matchedRow: null
  };
}

export function resolveCorrosionFromPipingClass({
  lineRow,
  boreMm,
  componentType,
  rating,
  pipingClassIndex,
  overrides = {},
  overrideKeys = [],
  xmlNode,
  xmlBranch,
  config = {}
}) {
  const overrideCorrosion = numericOverrideValue(overrides, 'corrosion', overrideKeys);
  if (overrideCorrosion != null) {
    return { corrosionAllowanceMm: overrideCorrosion, source: 'override', matchedRow: null, needsReview: false };
  }

  const legacyOverride = toFiniteNumber(overrides.corrosionAllowanceMm);
  if (legacyOverride != null) {
    return { corrosionAllowanceMm: legacyOverride, source: 'override', matchedRow: null, needsReview: false };
  }

  const pipingClass = lineRow?.pipingClass || lineRow?.['Piping Class'] || '';
  const classMatch = findBestPipingClassRow({
    pipingClass,
    boreMm,
    componentType,
    rating,
    pipingClassIndex,
    overrides,
    config
  });
  const classRow = classMatch?.row || null;
  const fromClass = toFiniteNumber(
    classRow?.corrosion ??
    classRow?.Corrosion ??
    classRow?.corrosionAllowance ??
    classRow?.CORROSION_ALLOWANCE ??
    classRow?.CA
  );

  if (fromClass != null) {
    return {
      corrosionAllowanceMm: fromClass,
      source: 'piping-class-master',
      matchedPipingClass: pipingClass,
      matchedRow: classRow,
      matchMethod: classMatch.method,
      matchScore: classMatch.score,
      matchReasons: classMatch.reasons,
      needsReview: classMatch.needsReview,
      candidates: classMatch.candidates
    };
  }

  const fromXml = toFiniteNumber(xmlNode?.corrosionAllowance ?? xmlNode?.CorrosionAllowance ?? xmlBranch?.corrosionAllowance);
  if (fromXml != null) {
    return {
      corrosionAllowanceMm: fromXml,
      source: 'xml-fallback',
      matchedPipingClass: pipingClass,
      matchedRow: classRow || null,
      matchMethod: classMatch?.method || 'none',
      matchScore: classMatch?.score || 0,
      matchReasons: classMatch?.reasons || [],
      needsReview: classMatch?.needsReview ?? true,
      candidates: classMatch?.candidates || []
    };
  }

  const fromConfig = toFiniteNumber(config.defaultCorrosionAllowance);
  return {
    corrosionAllowanceMm: fromConfig ?? 0,
    source: fromConfig != null ? 'config-default' : 'default-zero',
    matchedPipingClass: pipingClass,
    matchedRow: classRow || null,
    matchMethod: classMatch?.method || 'none',
    matchScore: classMatch?.score || 0,
    matchReasons: classMatch?.reasons || [],
    needsReview: classMatch?.needsReview ?? true,
    candidates: classMatch?.candidates || []
  };
}

export function resolveWallThicknessFromPipingClass({ pipingClassRow, overrides = {}, overrideKeys = [], xmlNode, xmlBranch, config = {} }) {
  const overrideWall = numericOverrideValue(overrides, 'wallThickness', overrideKeys);
  if (overrideWall != null) return { valueMm: overrideWall, source: 'override' };

  const fromClass = toFiniteNumber(
    pipingClassRow?.wallThickness ??
    pipingClassRow?.WallThickness ??
    pipingClassRow?.['Wall Thickness'] ??
    pipingClassRow?.WALL_THICKNESS ??
    pipingClassRow?.WT
  );
  if (fromClass != null) return { valueMm: fromClass, source: 'piping-class-master' };

  const fromXml = toFiniteNumber(xmlNode?.wallThickness ?? xmlNode?.WallThickness ?? xmlBranch?.wallThickness);
  if (fromXml != null) return { valueMm: fromXml, source: 'xml-fallback' };
  return { valueMm: 0, source: 'default-zero' };
}

export function resolveBranchProcessData({
  branchName,
  lineKey,
  lineRow,
  boreMm,
  componentType,
  rating,
  schedule,
  materialMap,
  pipingClassIndex,
  overrides = {},
  xmlNode,
  xmlBranch,
  config = {}
}) {
  const requestedPipingClass =
    firstText(lineRow, ['pipingClass', 'Piping Class', 'PIPING_CLASS']) || '';
  const overrideKeys = [lineKey, branchName, requestedPipingClass].filter(Boolean);

  const classMatch = findBestPipingClassRow({
    pipingClass: requestedPipingClass,
    boreMm,
    componentType,
    rating: rating || firstText(lineRow, ['rating', 'Rating', 'RATING']),
    schedule,
    pipingClassIndex,
    overrides,
    config
  });
  const pipingClassRow = classMatch?.row || null;
  const resolvedPipingClass = classMatch?.resolvedPipingClass || classMatch?.classMatch?.pipingClass || requestedPipingClass;

  const resolvedRating =
    overrideValue(overrides, 'rating', overrideKeys) ||
    readClassRowRating(pipingClassRow) ||
    text(rating || firstText(lineRow, ['rating', 'Rating', 'RATING']));

  const resolverLineRow = { ...(lineRow || {}), pipingClass: resolvedPipingClass };

  const material = resolveMaterialCodeFromLineMaterial({
    lineRow: resolverLineRow,
    materialMap,
    pipingClassRow,
    overrides,
    overrideKeys,
    xmlNode,
    xmlBranch
  });

  const corrosion = resolveCorrosionFromPipingClass({
    lineRow: resolverLineRow,
    boreMm,
    componentType,
    rating: resolvedRating,
    pipingClassIndex,
    overrides,
    overrideKeys,
    xmlNode,
    xmlBranch,
    config
  });

  const wallThicknessMm = resolveWallThicknessFromPipingClass({
    pipingClassRow,
    overrides,
    overrideKeys,
    xmlNode,
    xmlBranch,
    config
  });

  return {
    branchName,
    lineKey,
    requestedPipingClass,
    resolvedPipingClass,
    normalizedPipingClass: normalizePipingClass(resolvedPipingClass),
    pipingClass: resolvedPipingClass,
    rating: resolvedRating,

    material: material.material,
    materialCode: material.materialCode,
    materialSource: material.source,

    corrosionAllowanceMm: corrosion.corrosionAllowanceMm,
    corrosionSource: corrosion.source,

    wallThicknessMm: wallThicknessMm.valueMm,
    wallThicknessSource: wallThicknessMm.source,

    pipingClassMatchedRow: pipingClassRow,
    pipingClassMatchMethod: classMatch.classMatch?.method || classMatch.method,
    pipingClassConfidence: classMatch.classMatch?.confidence ?? classMatch.confidence,
    pipingClassScore: classMatch.classMatch?.score ?? classMatch.score,
    pipingClassRowMethod: classMatch.method,
    pipingClassRowScore: classMatch.score,
    pipingClassRowReasons: classMatch.reasons,
    pipingClassNeedsReview: classMatch.classMatch?.needsReview || classMatch.needsReview,
    pipingClassCandidates: classMatch.classMatch?.candidates || classMatch.candidates || []
  };
}
