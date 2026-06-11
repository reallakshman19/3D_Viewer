import {
  DEFAULT_OPTIONS as V2_DEFAULT_OPTIONS,
  runPsMappingResolver as runV2Resolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v2.js?v=20260611-approx-overrides-1';

export { rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...V2_DEFAULT_OPTIONS,
  useBuiltInSupportKeywords: true,
  mapAnchorToLineStop: true,
};

function yn(value) {
  return value === true || String(value || '').toUpperCase() === 'YES';
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function splitSupportText(value) {
  return String(value || '')
    .split(/[,+]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .map((item) => (item === 'LINE_STOP' || item === 'LINE STOP' ? 'STOP' : item));
}

function supportText(types) {
  return uniq(types).join(', ');
}

function appendToken(text, token) {
  const source = String(text || '').trim();
  if (!token) return source;
  return source ? `${source}; ${token}` : token;
}

function appendBuiltInKeywords(text) {
  const source = String(text || '').trim();
  const builtIns = 'Rest, Guide, Line stop';
  return source ? `${source}, ${builtIns}` : builtIns;
}

function injectAnchorLineStop(text, enabled) {
  if (!enabled) return String(text || '');
  return String(text || '').replace(/\bANCHOR\b/gi, 'Anchor LINE STOP');
}

function prepInput(input, options) {
  const out = { ...(input || {}) };
  if (options.useBuiltInSupportKeywords !== false) {
    out.table1dKeywordText = appendBuiltInKeywords(input.table1dKeywordText || input.table1DText || '');
    out.table1DText = out.table1dKeywordText;
  }
  if (options.mapAnchorToLineStop !== false) {
    out.table2ModelText = injectAnchorLineStop(input.table2ModelText, true);
    out.table1cNodeIsonoteText = injectAnchorLineStop(input.table1cNodeIsonoteText, true);
  }
  return out;
}

function missingRequested(row) {
  const requested = splitSupportText(row.supportTypesRequested || row.modelDtxrKeywords);
  const available = splitSupportText(row.supportTypesAvailable || row.nodeMasterKeywords);
  return requested.filter((item) => !available.includes(item));
}

function improveCandidate(row) {
  const next = { ...(row || {}) };
  if (next.supportBasis === 'SUPPORT_CONFLICT') {
    const missing = supportText(missingRequested(next)) || supportText(splitSupportText(next.supportTypesRequested || next.modelDtxrKeywords)) || 'requested support';
    next.missingSupportKeywords = missing;
    next.supportMatch = `Missing ${missing}`;
    next.warnings = appendToken(next.warnings, `SUPPORT_MISSING: ${missing}`);
    next.reason = `Review required: ${missing} requested in Table-2 DTXR but not present in Table-1C ISONOTE.`;
    next.nodeCoverageNote = next.reason;
  }
  return next;
}

function improveRow(row) {
  const next = { ...(row || {}) };
  const basisText = String(next.basis || '');
  if (basisText.includes('SUPPORT_CONFLICT') || next.supportBasis === 'SUPPORT_CONFLICT') {
    const missing = supportText(missingRequested(next)) || supportText(splitSupportText(next.modelDtxrKeywords)) || 'requested support';
    next.missingSupportKeywords = missing;
    next.supportMatch = `Missing ${missing}`;
    next.warnings = appendToken(next.warnings, `SUPPORT_MISSING: ${missing}`);
    next.reviewAction = `Add ${missing} to Table-1C ISONOTE for this node, or remove/modify the Table-2 DTXR support if it is not required.`;
    next.nodeCoverageNote = next.nodeCoverageNote || next.reviewAction;
  }
  return next;
}

function supportMissingAudit(result) {
  const rows = [];
  const candidates = [];
  const seen = new Set();
  for (const coverage of result.supportCoverageRows || []) {
    for (const missing of splitSupportText(coverage.missingMasterKeywords)) {
      const key = `${coverage.node}|${coverage.table1PsNo}|${missing}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const common = {
        enabled: false,
        psnoModel: '-',
        modelBore: '',
        modelLineFamily: '',
        lineFamily: '',
        dtxr: '',
        mandatory: yn(coverage.mandatory),
        node: coverage.node,
        candidateNode: coverage.node,
        table1PsNo: coverage.table1PsNo,
        tag: coverage.tag,
        source: coverage.source,
        sourceRow: coverage.sourceRow,
        nodeLine: coverage.lineNo,
        nodeLineFamily: coverage.lineFamily,
        pipeSizeRaw: coverage.pipeSizeRaw,
        derivedDn: coverage.derivedDn,
        nodeIsonote: coverage.isonote,
        nodeMasterKeywords: coverage.masterKeywords,
        supportTypesAvailable: coverage.masterKeywords,
        supportTypesRequested: '',
        missingSupportKeywords: missing,
        supportBasis: 'SUPPORT_MISSING_MASTER_REQUIRED',
        supportMatch: `${missing} missing`,
        basis: 'SUPPORT_MISSING_MASTER_REQUIRED',
        finalStatus: 'SUPPORT_MISSING_REQUIRED',
        confidence: 'AUDIT',
        confidenceScore: 0,
        warnings: `SUPPORT_MISSING_REQUIRED: ${missing}`,
        reviewAction: `Add a Table-2 DTXR/model support row for ${missing}, or revise Table-1C ISONOTE if ${missing} is not required.`,
        nodeCoverageStatus: coverage.coverageStatus,
        nodeCoverageNote: `${missing} missing from mapped Table-2 DTXR for Node ${coverage.node}.`,
        table2Row: '',
      };
      rows.push(common);
      candidates.push({ ...common, eligible: false, autoSelectable: false, reviewRequired: true, selected: false, reason: common.reviewAction, score: 999999 });
    }
  }
  return { rows, candidates };
}

export function runPsMappingResolver(input = {}) {
  const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  const result = runV2Resolver({ ...prepInput(input, options), options });
  const rows = (result.rows || []).map(improveRow);
  const candidates = (result.candidates || []).map(improveCandidate);
  const audit = supportMissingAudit({ ...result, rows, candidates });
  return {
    ...result,
    rows: [...rows, ...audit.rows],
    candidates: [...candidates, ...audit.candidates],
    optionsUsed: options,
    approxConfig: {
      ...(result.approxConfig || {}),
      builtInSupportLogic: 'Built-in support detection recognizes REST, GUIDE, and LINE STOP. Anchor is treated as LINE STOP when enabled.',
      mapAnchorToLineStop: options.mapAnchorToLineStop !== false,
      useBuiltInSupportKeywords: options.useBuiltInSupportKeywords !== false,
    },
    summary: {
      ...(result.summary || {}),
      review: (result.summary?.review || 0) + audit.rows.length,
      candidateRows: (candidates.length + audit.candidates.length),
      supportMissingAuditRows: audit.rows.length,
      anchorMapsToLineStop: options.mapAnchorToLineStop !== false,
    },
  };
}
