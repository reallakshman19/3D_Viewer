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
const SUPPORT_RANK = new Map([
  ['SUPPORT_EXACT', 0],
  ['SUPPORT_PARTIAL', 1],
  ['SUPPORT_CONFLICT', 2],
  ['SUPPORT_MISSING_MASTER', 3],
  ['SUPPORT_NOT_REQUESTED', 4],
  ['SUPPORT_IGNORED', 5],
]);

function upper(value) { return String(value || '').toUpperCase(); }
function modelKey(row = {}) { return row.psnoModel || row.modelPsNo || row.basePs || '__UNKNOWN_MODEL__'; }
function isAuditRow(row = {}) { return row.psnoModel === '-' || /^SUPPORT_MISSING_/i.test(String(row.finalStatus || '')); }
function isPsCandidate(row = {}) { return ['PS_BASE', 'PS_EXACT'].includes(row.psBasis); }
function hasExactBore(row = {}) { return EXACT_BORE.has(upper(row.boreBasis)); }
function hasApproxBore(row = {}) { return APPROX_BORE.has(upper(row.boreBasis)); }
function hasExactLine(row = {}) { return EXACT_LINE.has(upper(row.lineBasis)); }
function hasApproxLine(row = {}) { return APPROX_LINE.has(upper(row.lineBasis)); }
function hasCleanGap(row = {}) { return !row.supportGapMatch || row.supportGapMatch === 'GAP_EXACT' || !row.gapMatch || row.gapMatch === 'GAP_EXACT'; }
function rankSupport(row = {}) { return SUPPORT_RANK.has(upper(row.supportBasis)) ? SUPPORT_RANK.get(upper(row.supportBasis)) : 9; }

function candidateSort(a, b) {
  return rankSupport(a) - rankSupport(b)
    || Number(b.selected === true) - Number(a.selected === true)
    || Number(b.autoSelectable === true) - Number(a.autoSelectable === true)
    || Number(a.score || 0) - Number(b.score || 0)
    || String(a.candidateNode || a.node || '').localeCompare(String(b.candidateNode || b.node || ''), undefined, { numeric: true });
}

function selectStageCandidate(group, options = {}) {
  const candidates = (group || []).filter((row) => isPsCandidate(row));
  const loop1 = candidates.filter((row) => hasExactBore(row) && hasExactLine(row));
  if (loop1.length) return { stage: 'LOOP1_EXACT_LINE_BORE', candidate: [...loop1].sort(candidateSort)[0] };

  if (options.attemptApproxLineMatch === true) {
    const loop2 = candidates.filter((row) => hasExactBore(row) && hasApproxLine(row));
    if (loop2.length) return { stage: 'LOOP2_APPROX_LINE', candidate: [...loop2].sort(candidateSort)[0] };
  }

  if (options.attemptApproxBoreMatch === true) {
    const loop3 = candidates.filter((row) => (hasExactLine(row) || (options.attemptApproxLineMatch === true && hasApproxLine(row))) && hasApproxBore(row));
    if (loop3.length) return { stage: 'LOOP3_APPROX_BORE', candidate: [...loop3].sort(candidateSort)[0] };
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
        ? 'Mapped in Loop 1 by exact line family and exact bore. Support/gap diagnostics remain on the mapped row.'
        : `Mapped in ${stage}.`),
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
      stagedResolver: 'Loop 1 exact line+bore maps Table-2 rows first. Loop 2/3 approximate passes run only for still-unmapped rows and only when enabled. Non-selected same-base candidates are suppressed from Candidate Matrix.',
    },
    summary: {
      ...(result?.summary || {}),
      candidateRows: visibleCandidates.length,
      stagedMappedRows: [...stageByModel.values()].filter((entry) => entry.candidate).length,
    },
  };
}
