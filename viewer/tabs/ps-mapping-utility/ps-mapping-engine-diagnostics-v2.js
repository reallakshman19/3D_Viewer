import {
  DEFAULT_OPTIONS as BASE_DEFAULT_OPTIONS,
  runPsMappingResolver as runBasePsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics.js?v=20260611-line-diagnostics-1';

export { rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...BASE_DEFAULT_OPTIONS,

  // Global override checkboxes. Both are intentionally OFF by default.
  // Exact canonical line-family matching remains available; this only controls
  // approximate/diagnostic typo matching such as P88102014 ~ P8810204.
  attemptApproxLineMatch: false,

  // Exact DN matching from Table-1C Pipe size or Table-1A Dia-derived DN remains
  // available. This controls raw/approx bore tolerance matching.
  attemptApproxBoreMatch: false,

  enableNearLineDiagnostic: false,
  allowRawDiaMatch: false,
};

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function appendWarning(existing, warning) {
  const parts = String(existing || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (warning && !parts.includes(warning)) parts.push(warning);
  return parts.join('; ');
}

function hasLineConflict(row) {
  return String(row?.lineBasis || '').toUpperCase() === 'LINE_CONFLICT';
}

function fixBoreBasis(row) {
  if (!row || String(row.boreBasis || '').toUpperCase() !== 'BORE_MISSING') return row;

  const modelBore = numeric(row.modelBore ?? row.bore ?? row.t2Bore);
  const derivedDn = numeric(row.derivedDn ?? row.nodeDerivedDn ?? row.table1DerivedDn);

  if (modelBore == null || derivedDn == null) return row;

  if (Math.abs(modelBore - derivedDn) <= 1e-6) {
    row.boreBasis = row.pipeSizeRaw ? 'BORE_DN_FROM_NPS' : 'BORE_DN_FROM_OD';
    row.warnings = String(row.warnings || '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part && part !== 'BORE_MISSING')
      .join('; ');
    return row;
  }

  row.boreBasis = 'BORE_CONFLICT';
  row.warnings = appendWarning(row.warnings, 'BORE_CONFLICT');

  if (hasLineConflict(row)) {
    row.eligible = false;
    row.autoSelectable = false;
    row.reviewRequired = false;
    row.selected = false;
    row.finalStatus = 'BASE_PS_FOUND_BUT_CONTEXT_REJECTED';
    row.confidence = 'LOW';
    row.confidenceScore = 20;
    row.warnings = appendWarning(row.warnings, 'BASE_PS_FOUND_BUT_CONTEXT_REJECTED');
    row.reason = `Rejected: base PS matched, but Table-2 Bore ${modelBore} conflicts with Table-1 derived DN ${derivedDn}, and line family conflicts.`;
    row.nodeCoverageNote = row.reason;
  }

  return row;
}

function normalizeBoreDiagnosticsInRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => fixBoreBasis(row));
}

export function normalizePsMappingOptions(options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };

  const attemptApproxLineMatch = merged.attemptApproxLineMatch === true;
  const attemptApproxBoreMatch = merged.attemptApproxBoreMatch === true;

  merged.attemptApproxLineMatch = attemptApproxLineMatch;
  merged.attemptApproxBoreMatch = attemptApproxBoreMatch;

  // Approx line override gates only near/typo diagnostics. Normal exact family
  // matching like S-8811951 -> S8811951 remains enabled through regex normalization.
  merged.enableNearLineDiagnostic = attemptApproxLineMatch && merged.enableNearLineDiagnostic !== false;
  merged.nearLineReviewOnly = true;
  merged.nearLineMaxEditDistance = toFiniteNumber(merged.nearLineMaxEditDistance, 1);
  merged.nearLineMinStemLength = toFiniteNumber(merged.nearLineMinStemLength, 6);

  // Approx bore override gates raw/OD tolerance matching. DN matching remains
  // available via Table-1C Pipe size -> DN or Table-1A Dia -> derived DN.
  merged.allowRawDiaMatch = attemptApproxBoreMatch;
  if (!attemptApproxBoreMatch) {
    merged.odToleranceMm = 0;
  } else {
    merged.odToleranceMm = toFiniteNumber(merged.odToleranceMm, 1.5);
  }

  return merged;
}

function annotateResult(result, options) {
  const approxConfig = {
    attemptApproxLineMatch: options.attemptApproxLineMatch,
    attemptApproxBoreMatch: options.attemptApproxBoreMatch,
    approxLineLogic: 'When enabled, after exact size-free line-family match fails, compare Table-2 and Table-1 line families using edit distance. If distance <= max and min length passes, mark LINE_FAMILY_NEAR_MISMATCH / USER_REVIEW_REQUIRED. Never auto-correct.',
    approxBoreLogic: 'When enabled, allow raw/OD bore tolerance matching using odToleranceMm. Exact DN matching from Table-1C Pipe size or Table-1A Dia-derived DN remains available even when OFF.',
  };

  const normalized = {
    ...result,
    rows: normalizeBoreDiagnosticsInRows(result?.rows),
    outputRows: normalizeBoreDiagnosticsInRows(result?.outputRows),
    candidateRows: normalizeBoreDiagnosticsInRows(result?.candidateRows),
    validatorRows: normalizeBoreDiagnosticsInRows(result?.validatorRows),
  };

  return {
    ...normalized,
    optionsUsed: options,
    approxConfig,
    summary: {
      ...(result?.summary || {}),
      approxLineEnabled: options.attemptApproxLineMatch,
      approxBoreEnabled: options.attemptApproxBoreMatch,
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runBasePsMappingResolver({ ...input, options });
  return annotateResult(result, options);
}
