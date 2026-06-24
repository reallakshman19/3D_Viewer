function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function pickText(row, keys) {
  for (const key of keys || []) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (text(value).trim()) return text(value).trim();
  }
  return '';
}

function pickNumber(row, keys) {
  for (const key of keys || []) {
    const match = text(row?.[key] ?? row?._raw?.[key])
      .replace(/,/g, '')
      .match(/-?\d+(?:\.\d+)?/);
    if (!match) continue;
    const numeric = Number(match[0]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

export function normalizeWeightText(value) {
  return text(value)
    .toUpperCase()
    .replace(/[_/\\]+/g, '-')
    .replace(/[^A-Z0-9#+.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeRegex(pattern) {
  try { return pattern ? new RegExp(pattern, 'i') : null; }
  catch { return null; }
}

function normalizedRating(value) {
  return text(value).replace(/#/g, '').trim().toUpperCase();
}

function masterLength(rawLength, xmlLengthMm, config) {
  if (rawLength === null || rawLength === undefined) return null;
  if (config?.weight?.convertSmallLengthsInToMm !== true) return rawLength;
  return rawLength < 100 && xmlLengthMm > 100
    ? rawLength * numberOr(config?.weight?.inchToMm, 25.4)
    : rawLength;
}

export const DEFAULT_VALVE_HINT_MAPPING = Object.freeze([
  {
    on: true,
    priority: 10,
    code: 'VGT',
    label: 'Gate Valve',
    subtype: 'GATE',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VGT(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bGATE\b.*\bVALVE\b|\bVALVE\b.*\bGATE\b|\bGATE\b`,
    notes: 'Gate valve tag',
  },
  {
    on: true,
    priority: 20,
    code: 'VCH',
    label: 'Check Valve',
    subtype: 'CHECK',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VCH(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\b(CHECK|SWING|NRV|NON[- ]?RETURN)\b`,
    notes: 'Check / swing / NRV tag',
  },
  {
    on: true,
    priority: 30,
    code: 'VBL',
    label: 'Ball Valve',
    subtype: 'BALL',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VBL(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bBALL\b.*\bVALVE\b|\bVALVE\b.*\bBALL\b|\bBALL\b`,
    notes: 'Ball valve tag',
  },
  {
    on: true,
    priority: 40,
    code: 'VCV',
    label: 'Control Valve',
    subtype: 'CONTROL',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VCV(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bCONTROL\b.*\bVALVE\b|\bVALVE\b.*\bCONTROL\b|\bCONTROL\b`,
    notes: 'Control valve tag',
  },
  {
    on: true,
    priority: 50,
    code: 'VGL',
    label: 'Globe Valve',
    subtype: 'GLOBE',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VGL(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bGLOBE\b.*\bVALVE\b|\bVALVE\b.*\bGLOBE\b|\bGLOBE\b`,
    notes: 'Globe valve tag',
  },
  {
    on: true,
    priority: 60,
    code: 'VBF',
    label: 'Butterfly Valve',
    subtype: 'BUTTERFLY',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VBF(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bBUTTERFLY\b.*\bVALVE\b|\bVALVE\b.*\bBUTTERFLY\b|\bBUTTERFLY\b`,
    notes: 'Butterfly valve tag',
  },
  {
    on: true,
    priority: 70,
    code: 'VBV',
    label: 'Ball Valve',
    subtype: 'BALL',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VBV(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bBALL\b.*\bVALVE\b|\bVALVE\b.*\bBALL\b|\bBALL\b`,
    notes: 'Alternate ball valve tag',
  },
]);

export function valveHintLengthToleranceMm(config) {
  return Math.max(0, numberOr(config?.weight?.valveHintLengthToleranceMm, 6));
}

export function useNodeNameValveHints(config) {
  return config?.weight?.useNodeNameValveHints !== false;
}

export function valveHintMappingRows(config) {
  const rows = Array.isArray(config?.weight?.valveHintMapping) && config.weight.valveHintMapping.length
    ? config.weight.valveHintMapping
    : DEFAULT_VALVE_HINT_MAPPING;
  return rows.map((row, index) => ({
    on: row?.on !== false,
    priority: numberOr(row?.priority, (index + 1) * 10),
    code: text(row?.code).trim().toUpperCase(),
    label: text(row?.label).trim(),
    family: text(row?.family || 'VALVE').trim().toUpperCase() || 'VALVE',
    subtype: text(row?.subtype).trim().toUpperCase(),
    nodeNameRegex: text(row?.nodeNameRegex).trim(),
    masterRegex: text(row?.masterRegex).trim(),
    notes: text(row?.notes).trim(),
  }));
}

export function ensureValveHintConfig(config) {
  if (!config.weight || typeof config.weight !== 'object') config.weight = {};
  if (!Array.isArray(config.weight.valveHintMapping) || !config.weight.valveHintMapping.length) {
    config.weight.valveHintMapping = valveHintMappingRows(config);
  }
  if (!Number.isFinite(Number(config.weight.valveHintLengthToleranceMm))) config.weight.valveHintLengthToleranceMm = 6;
  if (config.weight.useNodeNameValveHints !== false) config.weight.useNodeNameValveHints = true;
  if (config.weight.showLengthRejectedSemanticMatches !== false) config.weight.showLengthRejectedSemanticMatches = true;
  if (config.weight.useWeightExtrapolation !== false) config.weight.useWeightExtrapolation = true;
  if (!Number.isFinite(Number(config.weight.extrapolationMinRatio))) config.weight.extrapolationMinRatio = 0.65;
  if (!Number.isFinite(Number(config.weight.extrapolationMaxRatio))) config.weight.extrapolationMaxRatio = 1.6;
  return config.weight;
}

export function resolveNodeNameValveHint(nodeName, config) {
  if (!useNodeNameValveHints(config)) return null;
  const raw = text(nodeName);
  if (!raw.trim()) return null;
  const normalized = normalizeWeightText(raw);
  for (const row of valveHintMappingRows(config).filter((entry) => entry.on !== false).sort((a, b) => a.priority - b.priority)) {
    const regex = safeRegex(row.nodeNameRegex);
    if (regex && (regex.test(raw) || regex.test(normalized))) return { ...row, family: 'VALVE' };
    if (row.code && (`-${normalized}-`).includes(`-${row.code}-`)) return { ...row, family: 'VALVE' };
  }
  return null;
}

export function formatValveHint(hint) {
  return hint ? `${hint.code} → ${hint.label || hint.subtype || 'Valve'}` : '';
}

export function classifyWeightMasterCandidate(candidate) {
  const value = typeof candidate === 'string' ? candidate : `${candidate?.type || ''} ${candidate?.typeDesc || ''}`;
  const normalized = normalizeWeightText(value);
  if (/\b(SPECTACLE|SPADE|SPACER|BLIND)\b/.test(normalized)) return { family: 'BLIND', subtype: 'BLIND' };
  if (/\b(CHECK|SWING|NRV|NON-RETURN|NONRETURN)\b/.test(normalized)) return { family: 'VALVE', subtype: 'CHECK' };
  if (/\bGATE\b/.test(normalized)) return { family: 'VALVE', subtype: 'GATE' };
  if (/\bBALL\b/.test(normalized)) return { family: 'VALVE', subtype: 'BALL' };
  if (/\bGLOBE\b/.test(normalized)) return { family: 'VALVE', subtype: 'GLOBE' };
  if (/\bCONTROL\b/.test(normalized)) return { family: 'VALVE', subtype: 'CONTROL' };
  if (/\bBUTTERFLY\b/.test(normalized)) return { family: 'VALVE', subtype: 'BUTTERFLY' };
  if (/\b(VALVE|VLV)\b/.test(normalized)) return { family: 'VALVE', subtype: 'VALVE_GENERIC' };
  if (/\b(FLANGE|FLANGED|WELDNECK|WELDING-NECK|WNFL)\b/.test(normalized)) return { family: 'FLANGE', subtype: 'FLANGE' };
  return { family: '', subtype: '' };
}

export function scoreValveHintAgainstCandidate(nodeHint, candidateClass, candidate) {
  if (!nodeHint) return { tier: 0, reason: '' };
  const masterText = `${candidate?.type || ''} ${candidate?.typeDesc || ''}`;
  const regex = safeRegex(nodeHint.masterRegex);
  if (regex && regex.test(masterText)) return { tier: 120, reason: `${nodeHint.code} exact` };
  if (nodeHint.family === 'VALVE' && candidateClass.family === 'VALVE' && nodeHint.subtype && nodeHint.subtype === candidateClass.subtype) {
    return { tier: 110, reason: `${nodeHint.code} exact` };
  }
  if (nodeHint.family === 'VALVE' && candidateClass.family === 'VALVE' && candidateClass.subtype && candidateClass.subtype !== 'VALVE_GENERIC') {
    return { tier: 70, reason: `${nodeHint.code} valve, wrong subtype` };
  }
  if (nodeHint.family === 'VALVE' && candidateClass.family === 'VALVE') return { tier: 50, reason: `${nodeHint.code} generic valve` };
  if (nodeHint.family === 'VALVE' && ['FLANGE', 'BLIND'].includes(candidateClass.family)) return { tier: -80, reason: `${nodeHint.code} non-valve demoted` };
  return { tier: 0, reason: `${nodeHint.code} no semantic match` };
}

function roundWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 1000) / 1000;
}

function resolveCandidateWeight(candidate, xmlLengthMm, config) {
  const masterWeight = Number(candidate.weight);
  const masterLength = Number(candidate.rowLength);
  const xmlLength = Number(xmlLengthMm);
  if (config?.weight?.useWeightExtrapolation === false || !Number.isFinite(masterWeight) || !Number.isFinite(masterLength) || !Number.isFinite(xmlLength) || masterLength <= 0) {
    return { masterWeight, selectedWeight: masterWeight, suggestedWeight: masterWeight, weightMethod: 'master', extrapolationRatio: 1, weightWarning: '' };
  }
  const ratio = xmlLength / masterLength;
  const minRatio = numberOr(config?.weight?.extrapolationMinRatio, 0.65);
  const maxRatio = numberOr(config?.weight?.extrapolationMaxRatio, 1.6);
  if (ratio < minRatio || ratio > maxRatio) {
    return { masterWeight, selectedWeight: masterWeight, suggestedWeight: masterWeight, weightMethod: 'master', extrapolationRatio: ratio, weightWarning: `extrapolation ratio ${ratio.toFixed(2)} outside ${minRatio}-${maxRatio}` };
  }
  if (Math.abs(ratio - 1) <= 1e-9) {
    return { masterWeight, selectedWeight: masterWeight, suggestedWeight: masterWeight, weightMethod: 'master', extrapolationRatio: 1, weightWarning: '' };
  }
  const selectedWeight = roundWeight(masterWeight * ratio);
  return { masterWeight, selectedWeight, suggestedWeight: selectedWeight, weightMethod: 'length-extrapolated', extrapolationRatio: ratio, weightWarning: '' };
}

function baseCandidateFromRow(row, config, lengthMm) {
  const rowBore = pickNumber(row, ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'BORE', 'DN', 'NB', 'NPS']);
  const rawLength = pickNumber(row, ['lengthMm', 'length', 'Length', 'LENGTH', 'Length mm', 'LENGTH_MM', 'Length (RF-F/F)', 'RF-F/F', 'LEN', 'faceToFace', 'Face To Face', 'F2F']);
  const rowLength = masterLength(rawLength, Number(lengthMm), config);
  const weight = pickNumber(row, ['valveWeight', 'directWeight', 'weight', 'Weight', 'WEIGHT', 'Weight kg', 'WEIGHT_KG', 'RF/RTJ KG', 'Valve Weight']);
  const rowRating = normalizedRating(pickText(row, ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']));
  const type = pickText(row, ['type', 'Type', 'TYPE', 'valveType', 'Valve Type']);
  const typeDesc = pickText(row, ['typeDesc', 'TypeDesc', 'Type Desc', 'Type Description', 'Description', 'Valve Type']);
  if (rowBore === null || rowLength === null || weight === null || !rowRating) return null;
  return { weight, rowBore, rowLength, rowRating, type, valveType: type, typeDesc, rowData: row };
}

function interpolateBetween(a, b, targetLength) {
  const lenA = Number(a.rowLength);
  const lenB = Number(b.rowLength);
  const wtA = Number(a.weight);
  const wtB = Number(b.weight);
  if (!Number.isFinite(lenA) || !Number.isFinite(lenB) || !Number.isFinite(wtA) || !Number.isFinite(wtB) || Math.abs(lenB - lenA) <= 1e-9) return null;
  return wtA + ((Number(targetLength) - lenA) * (wtB - wtA)) / (lenB - lenA);
}

function ratioFromNearest(nearest, targetLength) {
  const len = Number(nearest?.rowLength);
  const wt = Number(nearest?.weight);
  const target = Number(targetLength);
  if (!Number.isFinite(len) || !Number.isFinite(wt) || !Number.isFinite(target) || len <= 0) return null;
  return wt * target / len;
}

function sameBoreRatingRows(rows, config, { boreMm, wantedRating, lengthMm }) {
  const bore = Number(boreMm);
  return rows
    .map((row) => baseCandidateFromRow(row, config, lengthMm))
    .filter(Boolean)
    .filter((candidate) => {
      const boreDelta = Math.abs(Number(candidate.rowBore) - bore);
      return Number.isFinite(boreDelta) && boreDelta < 1 && candidate.rowRating === wantedRating && Number(candidate.rowLength) > 0 && Number(candidate.weight) > 0;
    })
    .sort((a, b) => Number(a.rowLength) - Number(b.rowLength));
}

function zeroWeightFallback({ boreMm, wantedRating, lengthMm, nodeHint }) {
  const length = Number(lengthMm);
  return {
    weight: 0,
    masterWeight: 0,
    selectedWeight: 0,
    suggestedWeight: 0,
    weightMethod: 'no-same-bore-rating',
    weightWarning: 'No matching weight master rows with the same bore and rating; defaulted to 0 kg for explicit review.',
    inferredWeight: true,
    fallbackSuggestion: true,
    zeroFallback: true,
    rowBore: Number(boreMm),
    rowRating: wantedRating,
    rowLength: Number.isFinite(length) ? length : 0,
    type: 'Fallback',
    valveType: 'Fallback',
    typeDesc: 'No same Bore/Rating master row',
    rowData: null,
    lengthDelta: 0,
    boreDelta: 0,
    ratingExact: Boolean(wantedRating),
    ratingScore: wantedRating ? 1 : 0,
    score: 0,
    candidateClass: { family: '', subtype: '' },
    lengthQualified: false,
    lengthToleranceMm: 0,
    nodeValveHint: nodeHint,
    valveHintLabel: formatValveHint(nodeHint),
    semanticTier: 0,
    semanticPotentialTier: 0,
    semanticReason: 'No same bore/rating master rows',
    rejectedReason: '',
    preferred: false,
  };
}

function sameBoreRatingInterpolationFallback({ rows, context, config, wantedRating, nodeHint, toleranceMm }) {
  const { boreMm, lengthMm } = context || {};
  const target = Number(lengthMm);
  if (boreMm === null || boreMm === undefined || !wantedRating || !Number.isFinite(target)) return null;

  const matches = sameBoreRatingRows(rows, config, { boreMm, wantedRating, lengthMm });
  if (!matches.length) return zeroWeightFallback({ boreMm, wantedRating, lengthMm, nodeHint });

  let method = 'length-extrapolated';
  let selected = null;
  let reference = matches[0];
  let referenceLabel = '';

  if (matches.length === 1) {
    reference = matches[0];
    selected = ratioFromNearest(reference, target);
    referenceLabel = `${Number(reference.rowLength).toFixed(1)}mm`;
  } else {
    let lower = null;
    let upper = null;
    for (const candidate of matches) {
      if (Number(candidate.rowLength) <= target) lower = candidate;
      if (Number(candidate.rowLength) >= target && !upper) upper = candidate;
    }

    if (lower && upper && lower !== upper) {
      method = 'length-interpolated';
      selected = interpolateBetween(lower, upper, target);
      reference = Math.abs(Number(lower.rowLength) - target) <= Math.abs(Number(upper.rowLength) - target) ? lower : upper;
      referenceLabel = `${Number(lower.rowLength).toFixed(1)}-${Number(upper.rowLength).toFixed(1)}mm`;
    } else {
      const pair = target < Number(matches[0].rowLength)
        ? [matches[0], matches[1]]
        : [matches[matches.length - 2], matches[matches.length - 1]];
      selected = interpolateBetween(pair[0], pair[1], target);
      reference = Math.abs(Number(pair[0].rowLength) - target) <= Math.abs(Number(pair[1].rowLength) - target) ? pair[0] : pair[1];
      referenceLabel = `${Number(pair[0].rowLength).toFixed(1)}-${Number(pair[1].rowLength).toFixed(1)}mm`;
    }

    if (!Number.isFinite(selected) || selected <= 0) selected = ratioFromNearest(reference, target);
  }

  const selectedWeight = roundWeight(selected);
  if (!Number.isFinite(selectedWeight) || selectedWeight <= 0) return zeroWeightFallback({ boreMm, wantedRating, lengthMm, nodeHint });

  const lengthDelta = Math.abs(Number(reference.rowLength) - target);
  const label = method === 'length-interpolated' ? 'Interpolated' : 'Extrapolated';
  return {
    ...reference,
    masterWeight: Number(reference.weight),
    selectedWeight,
    suggestedWeight: selectedWeight,
    weight: selectedWeight,
    weightMethod: method,
    weightWarning: `${label} from same Bore ${Number(boreMm).toFixed(0)} / Rating ${wantedRating} master row(s) at ${referenceLabel}.`,
    inferredWeight: true,
    fallbackSuggestion: true,
    zeroFallback: false,
    rowBore: Number(boreMm),
    rowRating: wantedRating,
    lengthDelta,
    boreDelta: 0,
    ratingExact: true,
    ratingScore: 1,
    score: 0.5,
    candidateClass: classifyWeightMasterCandidate(reference),
    lengthQualified: false,
    lengthToleranceMm: toleranceMm,
    nodeValveHint: nodeHint,
    valveHintLabel: formatValveHint(nodeHint),
    semanticTier: 0,
    semanticPotentialTier: 0,
    semanticReason: label,
    rejectedReason: '',
    preferred: false,
    type: reference.type || label,
    valveType: reference.valveType || label,
    typeDesc: `${label} from same Bore/Rating`,
  };
}

function enrichWeightCandidate({ candidate, nodeHint, xmlLengthMm, toleranceMm, config, wantedRating, boreMm }) {
  const lengthDelta = Number.isFinite(candidate.lengthDelta) ? candidate.lengthDelta : Math.abs(Number(candidate.rowLength) - Number(xmlLengthMm));
  const boreDelta = Number.isFinite(candidate.boreDelta) ? candidate.boreDelta : Math.abs(Number(candidate.rowBore) - Number(boreMm));
  const ratingExact = candidate.rowRating === wantedRating;
  const ratingPartial = !ratingExact && candidate.rowRating && wantedRating && (candidate.rowRating.includes(wantedRating) || wantedRating.includes(candidate.rowRating));
  const ratingScore = ratingExact ? 1 : (ratingPartial ? 0.65 : 0);
  const lengthQualified = Number.isFinite(lengthDelta) && lengthDelta <= toleranceMm;
  const candidateClass = classifyWeightMasterCandidate(candidate);
  const semantic = scoreValveHintAgainstCandidate(nodeHint, candidateClass, candidate);
  const weightInfo = resolveCandidateWeight(candidate, xmlLengthMm, config);
  const boreScore = Math.max(0, 1 - Math.min(boreDelta / Math.max(Math.abs(Number(boreMm)) * 0.25, 25), 1));
  const lengthScore = 1 - Math.min(lengthDelta / Math.max(toleranceMm, 1), 1);
  const score = ((ratingScore * 3) + (boreScore * 2) + lengthScore) / 6;
  return {
    ...candidate,
    ...weightInfo,
    lengthDelta,
    boreDelta,
    ratingExact,
    ratingScore,
    score,
    candidateClass,
    lengthQualified,
    lengthToleranceMm: toleranceMm,
    nodeValveHint: nodeHint,
    valveHintLabel: formatValveHint(nodeHint),
    semanticTier: lengthQualified ? semantic.tier : 0,
    semanticPotentialTier: semantic.tier,
    semanticReason: semantic.reason,
    rejectedReason: lengthQualified ? '' : `length failed, Δ${lengthDelta.toFixed(1)}mm > ±${toleranceMm}mm`,
    preferred: ratingExact && boreDelta < 1 && lengthQualified && Number(weightInfo.selectedWeight) > 0,
  };
}

export function compareRankedWeightCandidates(a, b) {
  return (b.semanticTier - a.semanticTier) || (Number(b.preferred) - Number(a.preferred)) || (b.score - a.score) || (a.lengthDelta - b.lengthDelta) || (a.boreDelta - b.boreDelta);
}

export function compareRejectedWeightCandidates(a, b) {
  return (b.semanticPotentialTier - a.semanticPotentialTier) || (a.lengthDelta - b.lengthDelta) || (b.score - a.score) || (a.boreDelta - b.boreDelta);
}

export function rankXmlCiiWeightCandidates(context, config, options = {}) {
  ensureValveHintConfig(config || {});
  const { boreMm, rating, lengthMm, nodeName = '' } = context || {};
  if (boreMm === null || boreMm === undefined || lengthMm === null || lengthMm === undefined) return { nodeHint: null, candidates: [], rejectedCandidates: [], best: null };
  const rows = Array.isArray(config?.weight?.masterRows) ? config.weight.masterRows : [];
  const wantedRating = normalizedRating(rating);
  const nodeHint = useNodeNameValveHints(config) ? resolveNodeNameValveHint(nodeName, config) : null;
  if (!rows.length) {
    const zero = zeroWeightFallback({ boreMm, wantedRating, lengthMm, nodeHint });
    return { nodeHint, candidates: [zero], rejectedCandidates: [], best: zero };
  }
  const toleranceMm = valveHintLengthToleranceMm(config);
  const includeRejected = options.includeRejected !== false && config?.weight?.showLengthRejectedSemanticMatches !== false;
  const ranked = [];
  const rejected = [];
  for (const row of rows) {
    const base = baseCandidateFromRow(row, config, lengthMm);
    if (!base) continue;
    const boreDelta = Math.abs(base.rowBore - Number(boreMm));
    if (!Number.isFinite(boreDelta) || boreDelta >= 1) continue;
    const ratingExact = base.rowRating === wantedRating;
    const ratingPartial = !ratingExact && base.rowRating && wantedRating && (base.rowRating.includes(wantedRating) || wantedRating.includes(base.rowRating));
    if (!ratingExact && !ratingPartial) continue;
    const enriched = enrichWeightCandidate({ candidate: { ...base, boreDelta }, nodeHint, xmlLengthMm: lengthMm, toleranceMm, config, wantedRating, boreMm });
    if (enriched.lengthQualified) ranked.push(enriched);
    else if (includeRejected && enriched.semanticPotentialTier > 0) rejected.push(enriched);
  }
  ranked.sort(compareRankedWeightCandidates);
  rejected.sort(compareRejectedWeightCandidates);
  if (!ranked.length) {
    const fallback = sameBoreRatingInterpolationFallback({ rows, context, config, wantedRating, nodeHint, toleranceMm });
    if (fallback) ranked.push(fallback);
  }
  return { nodeHint, candidates: ranked, rejectedCandidates: rejected, best: ranked[0] || null };
}

export function buildRankedWeightCandidates(context, config) {
  return rankXmlCiiWeightCandidates(context, config, { includeRejected: false }).candidates.slice(0, 8);
}
