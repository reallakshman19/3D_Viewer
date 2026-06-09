import { cleanMaterialText, cleanMaterialCode, mapMaterialTextToCiiCode } from './linelist-mapping.js';
import { findBestPipingClassRow, normalizePipingClass } from './piping-class-resolver.js';
import { toFiniteNumber } from './config.js';

export function resolveMaterialCodeFromLineMaterial({
  lineRow,
  materialMap,
  pipingClassRow,
  overrides = {},
  xmlNode,
  xmlBranch
}) {
  // 1. Explicit user override
  const overrideCode = cleanMaterialCode(overrides.materialCode);
  if (overrideCode) {
    return {
      material: cleanMaterialText(lineRow?.material || pipingClassRow?.materialName || ''),
      materialCode: overrideCode,
      source: 'override'
    };
  }

  // 2. Line-list Material -> Material Map -> Code
  const lineMaterial = cleanMaterialText(lineRow?.material);
  const fromLineMaterial = mapMaterialTextToCiiCode(lineMaterial, materialMap);
  if (fromLineMaterial?.code) {
    return {
      material: lineMaterial,
      materialCode: cleanMaterialCode(fromLineMaterial.code),
      source: 'line-list-material-map',
      matchedRow: fromLineMaterial
    };
  }

  // 3. Piping Class master Material_Name -> Material Map -> Code
  const classMaterial = cleanMaterialText(
    pipingClassRow?.materialName ||
    pipingClassRow?.Material_Name ||
    pipingClassRow?.Material ||
    pipingClassRow?.material
  );
  const fromClassMaterial = mapMaterialTextToCiiCode(classMaterial, materialMap);
  if (fromClassMaterial?.code) {
    return {
      material: classMaterial,
      materialCode: cleanMaterialCode(fromClassMaterial.code),
      source: 'piping-class-material-map',
      matchedRow: fromClassMaterial
    };
  }

  // 4. XML fallback
  const xmlMaterial = cleanMaterialText(xmlNode?.material || xmlBranch?.material || '');

  // 5. Blank
  return {
    material: lineMaterial || classMaterial || xmlMaterial,
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
  xmlNode,
  xmlBranch,
  config = {}
}) {
  // 1. Explicit user override
  const overrideCorrosion = toFiniteNumber(overrides.corrosionAllowanceMm);
  if (overrideCorrosion != null) {
    return {
      corrosionAllowanceMm: overrideCorrosion,
      source: 'override',
      matchedRow: null
    };
  }

  // 2. Piping Class + Bore/Size -> Piping Class master Corrosion
  const pipingClass = lineRow?.pipingClass || '';
  const classMatch = findBestPipingClassRow({
    pipingClass,
    boreMm,
    componentType,
    rating,
    pipingClassIndex,
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

  // 3. XML CorrosionAllowance fallback
  const fromXml = toFiniteNumber(
    xmlNode?.corrosionAllowance ??
    xmlNode?.CorrosionAllowance ??
    xmlBranch?.corrosionAllowance
  );
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

  // 4. Config default / 5. 0
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

export function resolveWallThicknessFromPipingClass({
  pipingClassRow,
  xmlNode,
  xmlBranch,
  config = {}
}) {
  const fromClass = toFiniteNumber(
    pipingClassRow?.wallThickness ??
    pipingClassRow?.WallThickness ??
    pipingClassRow?.WT
  );
  if (fromClass != null) {
    return { valueMm: fromClass, source: 'piping-class-master' };
  }
  const fromXml = toFiniteNumber(
    xmlNode?.wallThickness ??
    xmlNode?.WallThickness ??
    xmlBranch?.wallThickness
  );
  if (fromXml != null) {
    return { valueMm: fromXml, source: 'xml-fallback' };
  }
  return { valueMm: 0, source: 'default-zero' };
}

export function resolveBranchProcessData({
  branchName,
  lineKey,
  lineRow,
  boreMm,
  componentType,
  rating,
  materialMap,
  pipingClassIndex,
  overrides = {},
  xmlNode,
  xmlBranch,
  config = {}
}) {
  const pipingClass = lineRow?.pipingClass || '';
  const classMatch = findBestPipingClassRow({
    pipingClass,
    boreMm,
    componentType,
    rating: rating || lineRow?.rating,
    pipingClassIndex,
    config
  });
  const pipingClassRow = classMatch?.row || null;

  const material = resolveMaterialCodeFromLineMaterial({
    lineRow,
    materialMap,
    pipingClassRow,
    overrides,
    xmlNode,
    xmlBranch
  });

  const corrosion = resolveCorrosionFromPipingClass({
    lineRow,
    boreMm,
    componentType,
    rating: rating || lineRow?.rating,
    pipingClassIndex,
    overrides,
    xmlNode,
    xmlBranch,
    config
  });

  const wallThicknessMm = resolveWallThicknessFromPipingClass({
    pipingClassRow,
    xmlNode,
    xmlBranch,
    config
  });

  return {
    branchName,
    lineKey,
    pipingClass,

    material: material.material,
    materialCode: material.materialCode,
    materialSource: material.source,

    corrosionAllowanceMm: corrosion.corrosionAllowanceMm,
    corrosionSource: corrosion.source,

    wallThicknessMm: wallThicknessMm.valueMm,
    wallThicknessSource: wallThicknessMm.source,

    pipingClassMatchedRow: pipingClassRow,
    pipingClassMatchMethod: classMatch.method,
    pipingClassConfidence: classMatch.confidence,
    pipingClassRowScore: classMatch.score,
    pipingClassRowReasons: classMatch.reasons,
    pipingClassNeedsReview: classMatch.needsReview,
    pipingClassCandidates: classMatch.candidates
  };
}
