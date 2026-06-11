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

function canonicalSupportKeyword(value) {
  const upper = String(value || '').toUpperCase().replace(/[\s_-]+/g, ' ').trim();
  if (!upper) return '';
  if (upper.includes('GUIDE')) return 'GUIDE';
  if (upper.includes('REST') || upper === 'XRT') return 'REST';
  if (
    upper.includes('LINE STOP')
    || upper.includes('LINESTOP')
    || upper === 'STOP'
    || upper.includes('PIPE STOP')
    || upper.includes('ANCHOR')
  ) {
    return 'LINE_STOP';
  }
  return upper.replace(/\s+/g, '_');
}

function displaySupportKeyword(value) {
  const canonical = canonicalSupportKeyword(value);
  if (canonical === 'LINE_STOP') return 'STOP';
  return canonical.replace(/_/g, ' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractSupportKeywords(text) {
  const upper = String(text || '').toUpperCase();
  const found = [];
  if (/\bGUIDE\b/.test(upper)) found.push('GUIDE');
  if (/\bREST\b|\bXRT\b/.test(upper)) found.push('REST');
  if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bPIPE\s*STOP\b|\bSTOP\b|\bANCHOR\b/.test(upper)) found.push('LINE_STOP');
  return unique(found);
}

function splitSupportList(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const extracted = extractSupportKeywords(raw);
  if (extracted.length) return extracted;

  return unique(raw
    .split(/[;,|/]+/)
    .map((part) => canonicalSupportKeyword(part))
    .filter(Boolean));
}

function supportDisplayList(values) {
  return unique(values || []).map(displaySupportKeyword).join(', ');
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

function clarifySupportConflict(row) {
  if (!row) return row;

  const supportBasis = String(row.supportBasis || '').toUpperCase();
  if (!['SUPPORT_CONFLICT', 'SUPPORT_PARTIAL', 'SUPPORT_MISSING_MASTER'].includes(supportBasis)) {
    return row;
  }

  const requested = splitSupportList(row.supportTypesRequested ?? row.supportRequested ?? row.dtxr ?? row.dtxrRaw);
  const available = unique([
    ...extractSupportKeywords(row.nodeIsonote),
    ...extractSupportKeywords(row.nodeMasterKeywords),
    ...extractSupportKeywords(row.masterKeywords),
  ]);

  if (!requested.length) return row;

  const matched = requested.filter((type) => available.includes(type));
  const missing = requested.filter((type) => !available.includes(type));

  if (!missing.length) return row;

  row.missingSupportKeywords = supportDisplayList(missing);
  if (matched.length) row.matchedSupportKeywords = supportDisplayList(matched);

  row.supportMatch = matched.length
    ? `${supportDisplayList(matched)} Match; Missing ${supportDisplayList(missing)}`
    : `Missing ${supportDisplayList(missing)}`;

  row.warnings = appendWarning(row.warnings, `SUPPORT_MISSING_${missing.join('_')}`);

  if (!row.reason || /^Review required:\s*SUPPORT_/i.test(String(row.reason))) {
    row.reason = `Review required: Table-2 requests ${supportDisplayList(requested)}, but Table-1 support basis is missing ${supportDisplayList(missing)}.`;
  }

  if (!row.nodeCoverageNote || /^Review required:\s*SUPPORT_/i.test(String(row.nodeCoverageNote))) {
    row.nodeCoverageNote = row.reason;
  }

  return row;
}

function normalizeDiagnosticsInRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => clarifySupportConflict(fixBoreBasis(row)));
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
    rows: normalizeDiagnosticsInRows(result?.rows),
    outputRows: normalizeDiagnosticsInRows(result?.outputRows),
    candidateRows: normalizeDiagnosticsInRows(result?.candidateRows),
    validatorRows: normalizeDiagnosticsInRows(result?.validatorRows),
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
