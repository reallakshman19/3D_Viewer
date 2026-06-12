import {
  DEFAULT_OPTIONS as V7_DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeV7Options,
  runPsMappingResolver as runV7PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v7.js?v=20260612-table1-only-ps-unmapped-2';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...V7_DEFAULT_OPTIONS,
  showOptionalUnmatchedPsNo: false,
  showOptionalUnmatchedNodeNo: false,
};

function bool(value) {
  return value === true || String(value ?? '').trim() === 'true' || String(value ?? '').trim() === '1';
}

export function normalizePsMappingOptions(options = {}) {
  const normalized = normalizeV7Options(options);
  return {
    ...normalized,
    showOptionalUnmatchedPsNo: bool(options.showOptionalUnmatchedPsNo),
    showOptionalUnmatchedNodeNo: bool(options.showOptionalUnmatchedNodeNo),
  };
}

function isTruthy(value) {
  return value === true || /^(yes|y|true|1|mandatory|required|req|must|audit)$/i.test(String(value ?? '').trim());
}

function modelKey(row = {}) {
  return row.psnoModel || row.modelPsNo || row.basePs || '__UNKNOWN_MODEL__';
}

function hasNode(row = {}) {
  return Boolean(String(row.mappedNode || row.candidateNode || row.node || '').trim());
}

function hasMappedTable2Ps(row = {}) {
  const value = String(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || '').trim();
  return Boolean(value && value !== '-' && value.toUpperCase() !== 'N/A');
}

function isMandatory(row = {}) {
  return isTruthy(row.mandatory || row.modelMandatory || row.mandatoryRaw || row.isMandatory || row.table1Mandatory || row.nodeMandatory);
}

function hasNoNodeTable2Ps(row = {}) {
  return hasMappedTable2Ps(row) && !hasNode(row);
}

function noNodeAction(row = {}, mandatory = false) {
  return mandatory ? 'No matching node, needs review.' : 'Optional PS No. not mapped.';
}

function makeNoNodeCandidate(row = {}, { mandatory = false } = {}) {
  const action = noNodeAction(row, mandatory);
  return {
    psnoModel: row.psnoModel || row.modelPsNo || '',
    basePs: row.basePs || '',
    modelBore: row.modelBore ?? row.bore ?? '',
    pipe: row.pipe || '',
    lineFamily: row.lineFamily || row.modelLineFamily || '',
    dtxr: row.dtxr || '',
    mandatory,
    supportTypesRequested: row.modelDtxrKeywords || row.supportTypesRequested || '',
    modelDtxrKeywords: row.modelDtxrKeywords || row.supportTypesRequested || '',
    candidateNode: '',
    node: '',
    table1PsNo: '',
    psBasis: row.basis || 'NO_MATCH',
    boreBasis: '',
    lineBasis: '',
    supportBasis: '',
    supportMatch: '',
    eligible: false,
    autoSelectable: false,
    reviewRequired: mandatory,
    selected: false,
    finalStatus: mandatory ? 'USER_REVIEW_REQUIRED' : 'OPTIONAL_PS_NO_UNMAPPED',
    confidence: mandatory ? 'REVIEW' : 'AUDIT',
    confidenceScore: 0,
    warnings: row.warnings || (mandatory ? 'NO_MATCHING_NODE' : 'OPTIONAL_NO_MATCHING_NODE'),
    reason: action,
    reviewAction: action,
    consolidatedNodeWiseAction: action,
    nodeCoverageNote: action,
    matchGroup: mandatory ? '04_UNMATCHED_MANDATORY' : '05_UNMATCHED_OPTIONAL_PS_NO',
    table2Row: row.table2Row || row.sourceRow || '',
  };
}

function appendConfiguredNoNodeAuditRows(candidateRows = [], resultRows = [], options = {}) {
  const rows = Array.isArray(candidateRows) ? [...candidateRows] : [];
  const existing = new Set(rows.map((row) => modelKey(row)));
  for (const row of resultRows || []) {
    if (!hasNoNodeTable2Ps(row)) continue;
    const mandatory = isMandatory(row);
    if (!mandatory && options.showOptionalUnmatchedPsNo !== true) continue;
    const key = modelKey(row);
    if (existing.has(key)) continue;
    rows.push(makeNoNodeCandidate(row, { mandatory }));
    existing.add(key);
  }
  return rows;
}

function visibleAction(row = {}) {
  return String(row.consolidatedNodeWiseAction || row.nodeCoverageNote || row.reason || '').trim();
}

function isTable1OnlyUnmappedNode(row = {}) {
  return hasNode(row) && !hasMappedTable2Ps(row) && visibleAction(row) === 'PS No. not Mapped';
}

function keepRow(row = {}, options = {}) {
  if (!isTable1OnlyUnmappedNode(row)) return true;
  if (isMandatory(row)) return true;
  return options.showOptionalUnmatchedNodeNo === true;
}

function filterOptionalRows(rows, options) {
  return Array.isArray(rows) ? rows.filter((row) => keepRow(row, options)) : rows;
}

function applyOptionalUnmatchedPolicy(result = {}, options = {}) {
  const baseRows = result?.rows || result?.outputRows || [];
  const candidateBase = result?.candidateRows || result?.candidates || [];
  const candidates = filterOptionalRows(appendConfiguredNoNodeAuditRows(candidateBase, baseRows, options), options);
  const rows = filterOptionalRows(result?.rows, options);
  const outputRows = filterOptionalRows(result?.outputRows, options);
  const validatorRows = filterOptionalRows(result?.validatorRows || rows, options);
  const supportCoverageRows = filterOptionalRows(result?.supportCoverageRows, options);
  return {
    ...result,
    rows,
    outputRows,
    validatorRows,
    candidateRows: candidates,
    candidates,
    supportCoverageRows,
    summary: {
      ...(result?.summary || {}),
      candidateRows: candidates.length,
      optionalUnmatchedPsNoRows: candidates.filter((row) => visibleAction(row) === 'Optional PS No. not mapped.').length,
      optionalUnmatchedNodeNoRows: candidates.filter((row) => isTable1OnlyUnmappedNode(row) && !isMandatory(row)).length,
    },
    approxConfig: {
      ...(result?.approxConfig || {}),
      optionalUnmatchedPolicy: 'Mandatory unmatched rows are always shown. Optional unmatched Table-2 PS rows require showOptionalUnmatchedPsNo=true. Optional Table-1-only node rows require showOptionalUnmatchedNodeNo=true.',
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV7PsMappingResolver({ ...input, options });
  return applyOptionalUnmatchedPolicy(result, options);
}
