import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV5PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v5.js?v=20260612-support-gap-match-alias-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const EXACT_BORE = new Set([
  'BORE_DN_FROM_NPS',
  'BORE_DN_FROM_OD',
  'BORE_NPS_RAW',
  'BORE_OD',
  'BORE_IGNORED',
]);
const APPROX_BORE = new Set(['BORE_OD_APPROX', 'BORE_APPROX', 'BORE_RAW_APPROX']);
const EXACT_LINE = new Set(['LINE_EXACT', 'LINE_FAMILY']);
const APPROX_LINE = new Set(['LINE_FAMILY_NEAR_MISMATCH']);

function upper(value) { return String(value || '').toUpperCase(); }
function modelKey(row = {}) { return row.psnoModel || row.modelPsNo || row.basePs || '__UNKNOWN_MODEL__'; }
function isAuditRow(row = {}) { return row.psnoModel === '-' || /^SUPPORT_MISSING_/i.test(String(row.finalStatus || '')); }
function isPsCandidate(row = {}) { return ['PS_BASE', 'PS_EXACT'].includes(row.psBasis); }
function hasExactBore(row = {}) { return EXACT_BORE.has(upper(row.boreBasis)); }
function hasApproxBore(row = {}) { return APPROX_BORE.has(upper(row.boreBasis)); }
function hasExactLine(row = {}) { return EXACT_LINE.has(upper(row.lineBasis)); }
function hasApproxLine(row = {}) { return APPROX_LINE.has(upper(row.lineBasis)); }

function psRank(row = {}) {
  const basis = upper(row.psBasis);
  if (basis === 'PS_EXACT') return 0;
  if (basis === 'PS_BASE') return 1;
  return 9;
}

function lineRank(row = {}) {
  const basis = upper(row.lineBasis);
  if (basis === 'LINE_EXACT') return 0;
  if (basis === 'LINE_FAMILY') return 1;
  if (basis === 'LINE_FAMILY_NEAR_MISMATCH') return 5;
  if (basis === 'LINE_IGNORED') return 7;
  return 9;
}

function boreRank(row = {}) {
  const basis = upper(row.boreBasis);
  if (basis === 'BORE_DN_FROM_NPS') return 0;
  if (basis === 'BORE_DN_FROM_OD') return 1;
  if (basis === 'BORE_NPS_RAW') return 2;
  if (basis === 'BORE_OD') return 3;
  if (basis === 'BORE_OD_APPROX' || basis === 'BORE_APPROX' || basis === 'BORE_RAW_APPROX') return 6;
  if (basis === 'BORE_IGNORED') return 8;
  return 9;
}

function naturalCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });
}

function candidateSortByAnchor(a, b) {
  // IMPORTANT: supportBasis, supportMatch, gapMatch/supportGapMatch, selected,
  // autoSelectable and raw score are deliberately not used here. They may be
  // influenced by support/gap diagnostics. Mapping anchor must be chosen only
  // from PS + line + bore context; support/gap are evaluated after anchoring.
  return psRank(a) - psRank(b)
    || lineRank(a) - lineRank(b)
    || boreRank(a) - boreRank(b)
    || naturalCompare(a.candidateNode || a.node || '', b.candidateNode || b.node || '')
    || naturalCompare(a.table1PsNo || '', b.table1PsNo || '');
}

function selectStageCandidate(group, options = {}) {
  const candidates = (group || []).filter((row) => isPsCandidate(row));
  const loop1 = candidates.filter((row) => hasExactBore(row) && hasExactLine(row));
  if (loop1.length) return { stage: 'LOOP1_EXACT_LINE_BORE', candidate: [...loop1].sort(candidateSortByAnchor)[0] };

  if (options.attemptApproxLineMatch === true) {
    const loop2 = candidates.filter((row) => hasExactBore(row) && hasApproxLine(row));
    if (loop2.length) return { stage: 'LOOP2_APPROX_LINE', candidate: [...loop2].sort(candidateSortByAnchor)[0] };
  }

  if (options.attemptApproxBoreMatch === true) {
    const loop3 = candidates.filter((row) => (hasExactLine(row) || (options.attemptApproxLineMatch === true && hasApproxLine(row))) && hasApproxBore(row));
    if (loop3.length) return { stage: 'LOOP3_APPROX_BORE', candidate: [...loop3].sort(candidateSortByAnchor)[0] };
  }

  return { stage: 'UNMAPPED', candidate: null };
}

function markMapped(row, selected, stage) {
  if (!row || !selected || modelKey(row) !== modelKey(selected)) return row;
  return {
    ...row,
    mapped: true,
    mappedStage: stage,
    mappedNode: selected.candidateNode || selected.node || '',
    mappedTable1PsNo: selected.table1PsNo || '',
  };
}

function normalizeVisibleCandidates(candidates = [], options = {}) {
  if (!Array.isArray(candidates)) return candidates;
  const byModel = new Map();
  const auditRows = [];

  for (const row of candidates) {
    if (isAuditRow(row)) {
      auditRows.push(row);
      continue;
    }
    const key = modelKey(row);
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key).push(row);
  }

  const visible = [];
  const stageByModel = new Map();
  for (const [key, group] of byModel.entries()) {
    const { stage, candidate } = selectStageCandidate(group, options);
    stageByModel.set(key, { stage, candidate });
    if (!candidate) continue;
    visible.push({
      ...candidate,
      mapped: true,
      mappedStage: stage,
      mappedNode: candidate.candidateNode || candidate.node || '',
      mappedTable1PsNo: candidate.table1PsNo || '',
      matchGroup: stage === 'LOOP1_EXACT_LINE_BORE'
        ? (candidate.reviewRequired ? '03_REVIEW_REQUIRED' : '01_SELECTED_MATCH')
        : '03_REVIEW_REQUIRED',
      reason: candidate.reason || (stage === 'LOOP1_EXACT_LINE_BORE'
        ? 'Mapped in Loop 1 by PS, exact line family and exact bore. Support/gap diagnostics are evaluated only after this mapping anchor is selected.'
        : `Mapped in ${stage}. Support/gap diagnostics are evaluated only after this mapping anchor is selected.`),
    });
  }

  return { visibleCandidates: [...visible, ...auditRows], stageByModel };
}

function annotateRowsByStage(rows, stageByModel) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const mapped = stageByModel.get(modelKey(row));
    if (!mapped?.candidate) return row;
    return markMapped(row, mapped.candidate, mapped.stage);
  });
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV5PsMappingResolver({ ...input, options });
  const { visibleCandidates, stageByModel } = normalizeVisibleCandidates(result?.candidates || result?.candidateRows || [], options);

  return {
    ...result,
    rows: annotateRowsByStage(result?.rows, stageByModel),
    outputRows: annotateRowsByStage(result?.outputRows, stageByModel),
    validatorRows: annotateRowsByStage(result?.validatorRows, stageByModel),
    candidateRows: visibleCandidates,
    candidates: visibleCandidates,
    approxConfig: {
      ...(result?.approxConfig || {}),
      stagedResolver: 'Loop 1 exact PS+line+bore maps Table-2 rows first. Loop 2/3 approximate passes run only for still-unmapped rows and only when enabled. Support and support-gap are post-anchor diagnostics only and never select the mapping anchor.',
    },
    summary: {
      ...(result?.summary || {}),
      candidateRows: visibleCandidates.length,
      stagedMappedRows: [...stageByModel.values()].filter((entry) => entry.candidate).length,
    },
  };
}
