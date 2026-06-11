const DEFAULT_OPTIONS = {
  boreMode: 'prefer',
  lineMode: 'prefer',
  supportMode: 'prefer',
  odToleranceMm: 1.5,
  allowRawDiaMatch: true,
  allowDnMatch: true,
  allowDuplicateAssignment: true,
};

const DEFAULT_MASTER_KEYWORDS = 'Rest, Guide, Line stop';

const DEFAULT_SUPPORT_KEYWORD_CATALOG = [
  { raw: 'Rest', canonical: 'REST', aliases: ['REST', 'PIPE REST', 'XRT'] },
  { raw: 'Guide', canonical: 'GUIDE', aliases: ['GUIDE'] },
  { raw: 'Line stop', canonical: 'LINE_STOP', aliases: ['LINE STOP', 'LINESTOP', 'PIPE STOP', 'STOP'] },
];

const OD_TO_DN = [
  { od: 21.3, dn: 15 }, { od: 26.7, dn: 20 }, { od: 33.4, dn: 25 }, { od: 48.3, dn: 40 },
  { od: 60.3, dn: 50 }, { od: 73.0, dn: 65 }, { od: 88.9, dn: 80 }, { od: 114.3, dn: 100 },
  { od: 141.3, dn: 125 }, { od: 168.3, dn: 150 }, { od: 219.1, dn: 200 }, { od: 273.0, dn: 250 },
  { od: 273.1, dn: 250 }, { od: 323.9, dn: 300 }, { od: 355.6, dn: 350 }, { od: 406.4, dn: 400 },
];

function hkey(value) {
  return String(value ?? '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function splitLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
}
function splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((v) => v.trim());
  if (raw.includes(',')) return raw.split(',').map((v) => v.trim());
  return raw.split(/ {2,}/).map((v) => v.trim()).filter(Boolean);
}
function idx(headers, aliases) {
  const set = new Set(aliases.map(hkey));
  return headers.findIndex((header) => set.has(hkey(header)));
}
function number(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}
function natural(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}
function uniqueSorted(values) {
  return [...new Set((values || []).filter((value) => value != null && value !== ''))].sort(natural);
}

export function normalizePsNo(rawValue) {
  const raw = String(rawValue ?? '').trim();
  const [beforeTag, ...tagParts] = raw.split('|');
  const tag = tagParts.length ? tagParts.join('|').trim() : '';
  let clean = String(beforeTag ?? '').trim();
  const isDatum = /\/\s*DATUM\b/i.test(clean);
  clean = clean.replace(/\/\s*DATUM\b/gi, '').replace(/\.\d+\b/g, '').trim();
  const basePsMatch = clean.match(/\bPS[-_ ]?\d+\b/i);
  const basePs = basePsMatch ? basePsMatch[0].toUpperCase().replace(/\s+/g, '').replace('_', '-') : clean.toUpperCase();
  const exactRawKey = raw.toUpperCase().replace(/\s+/g, '');
  return { raw, exactRawKey, basePs, isDatum, tag };
}

export function normalizeLineKey(value) {
  return String(value ?? '').toUpperCase().replace(/^\/+/, '').replace(/-HC\b/g, '').replace(/\s+/g, '').trim();
}
function extractLineFamily(value) {
  const text = normalizeLineKey(value);
  const match = text.match(/(\d+["']?-S\d+)/i);
  return match ? match[1].toUpperCase() : '';
}

function canonicalKeywordName(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}
function catalogForKeyword(rawKeyword) {
  const raw = String(rawKeyword || '').trim();
  const upper = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!upper) return null;
  if (upper === 'REST') return { raw, canonical: 'REST', aliases: ['REST', 'PIPE REST', 'XRT'] };
  if (upper === 'GUIDE') return { raw, canonical: 'GUIDE', aliases: ['GUIDE'] };
  if (upper === 'LINE STOP' || upper === 'LINESTOP' || upper === 'STOP') return { raw, canonical: 'LINE_STOP', aliases: ['LINE STOP', 'LINESTOP', 'PIPE STOP', 'STOP'] };
  return { raw, canonical: canonicalKeywordName(raw), aliases: [upper] };
}
function parseTable1DKeywords(text, log) {
  const source = String(text || '').trim() || DEFAULT_MASTER_KEYWORDS;
  const lines = splitLines(source);
  let rawText = source;
  if (lines.length > 1 && /master\s+keywords/i.test(lines[0])) rawText = lines.slice(1).join(',');
  const parsed = rawText.split(',').map((item) => catalogForKeyword(item)).filter(Boolean);
  const fallback = DEFAULT_SUPPORT_KEYWORD_CATALOG;
  const unique = [];
  const seen = new Set();
  for (const item of parsed.length ? parsed : fallback) {
    if (!item.canonical || seen.has(item.canonical)) continue;
    seen.add(item.canonical);
    unique.push(item);
  }
  log.debug('INFO', 'T1D_KEYWORD_CATALOG_PARSED', 'Table-1D', { source, catalog: unique });
  log.user('INFO', 'PARSE', 'Table-1D', `Parsed master support keyword(s): ${unique.map((item) => item.canonical).join(', ')}.`);
  return unique;
}

export function normalizeSupportTypes(value, catalog = DEFAULT_SUPPORT_KEYWORD_CATALOG) {
  const cleaned = String(value ?? '').replace(/\[[^\]]*GAP[^\]]*\]/gi, ' ').toUpperCase();
  const types = new Set();
  for (const item of catalog || DEFAULT_SUPPORT_KEYWORD_CATALOG) {
    for (const alias of item.aliases || [item.raw]) {
      const escaped = String(alias).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(cleaned)) { types.add(item.canonical); break; }
    }
  }
  return [...types];
}
function supportDisplay(type) {
  if (type === 'LINE_STOP') return 'STOP';
  if (type === 'REST') return 'REST';
  if (type === 'GUIDE') return 'GUIDE';
  return String(type || '').replace(/_/g, ' ');
}
function supportMatchText(types) {
  return types.length ? `${types.map(supportDisplay).join('+')} Match` : '';
}
function supportListText(types) {
  return (types || []).map(supportDisplay).join(', ');
}

function createLogger() {
  const userLog = [];
  const debugLog = [];
  return {
    userLog,
    debugLog,
    user(level, stage, subject, message, action = '') { userLog.push({ time: new Date().toISOString(), level, stage, subject, message, action }); },
    debug(level, code, subject, details = {}) { debugLog.push({ time: new Date().toISOString(), level, code, subject, details }); },
  };
}

function parseTable1(text, log) {
  const lines = splitLines(text);
  if (!lines.length) { log.user('ERROR', 'PARSE', 'Table-1', 'Table-1 is required.'); return []; }
  const headers = splitCells(lines[0]);
  const psIdx = idx(headers, ['ps no', 'ps name', 'ps']);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  if (psIdx < 0 || nodeIdx < 0) { log.user('ERROR', 'PARSE', 'Table-1', 'Required columns PS No and Node were not found.'); return []; }
  const rows = [];
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const rawPsNo = String(cells[psIdx] ?? '').trim();
    const node = String(cells[nodeIdx] ?? '').trim();
    if (!rawPsNo || !node) { log.user('WARNING', 'PARSE', `Table-1 row ${sourceRow}`, 'Blank PS No or Node skipped.'); continue; }
    const norm = normalizePsNo(rawPsNo);
    const row = { id: `T1#${String(offset + 1).padStart(3, '0')}`, sourceRow, rawPsNo, node, ...norm, tag: norm.tag, used: false };
    rows.push(row);
    log.debug('DEBUG', 'T1_ROW_PARSED', rawPsNo, row);
    if (norm.tag) log.user('INFO', 'NORMALIZE', rawPsNo, `Extracted tag "${norm.tag}" from Table-1 PS data.`);
  }
  log.user('INFO', 'PARSE', 'Table-1', `Parsed ${rows.length} PS→Node rows.`);
  return rows;
}

function parseTable1A(text, log) {
  const map = new Map();
  if (!String(text || '').trim()) { log.user('INFO', 'PARSE', 'Table-1A', 'Optional Node/Dia table is blank. Bore check will be limited.'); return map; }
  const lines = splitLines(text);
  const headers = splitCells(lines[0]);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const diaIdx = idx(headers, ['dia', 'diameter', 'od', 'od mm', 'dia mm', 'dia(mm)']);
  if (nodeIdx < 0 || diaIdx < 0) { log.user('WARNING', 'PARSE', 'Table-1A', 'Node/Dia columns not found. Bore will not be checked.'); return map; }
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const node = String(cells[nodeIdx] ?? '').trim();
    const dia = number(cells[diaIdx]);
    if (!node || !Number.isFinite(dia)) { log.user('WARNING', 'PARSE', `Table-1A row ${sourceRow}`, 'Invalid Node or Dia skipped.'); continue; }
    map.set(node, { node, dia, sourceRow });
    log.debug('DEBUG', 'T1A_DIA_PARSED', node, { node, dia, sourceRow });
  }
  log.user('INFO', 'PARSE', 'Table-1A', `Parsed ${map.size} Node/Dia rows.`);
  return map;
}

function parseTable1B(text, log) {
  const map = new Map();
  if (!String(text || '').trim()) { log.user('INFO', 'PARSE', 'Table-1B', 'Optional Node/Line No table is blank. Line check disabled.'); return map; }
  const lines = splitLines(text);
  const headers = splitCells(lines[0]);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const lineIdx = idx(headers, ['line no', 'line', 'pipe', 'line number']);
  if (nodeIdx < 0 || lineIdx < 0) { log.user('WARNING', 'PARSE', 'Table-1B', 'Node/Line No columns not found. Line check disabled.'); return map; }
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const node = String(cells[nodeIdx] ?? '').trim();
    const lineNo = String(cells[lineIdx] ?? '').trim();
    if (!node || !lineNo) continue;
    const row = { node, lineNo, lineKey: normalizeLineKey(lineNo), sourceRow };
    map.set(node, row);
    log.debug('DEBUG', 'T1B_LINE_PARSED', node, row);
  }
  log.user('INFO', 'PARSE', 'Table-1B', `Parsed ${map.size} Node/Line rows.`);
  return map;
}

function parseTable1C(text, log, keywordCatalog) {
  const map = new Map();
  if (!String(text || '').trim()) { log.user('INFO', 'PARSE', 'Table-1C', 'Optional Node/ISONOTE table is blank. Support check disabled.'); return map; }
  const lines = splitLines(text);
  const headers = splitCells(lines[0]);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const isoIdx = idx(headers, ['isonote', 'iso note', 'support', 'support note', 'dtxr']);
  if (nodeIdx < 0 || isoIdx < 0) { log.user('WARNING', 'PARSE', 'Table-1C', 'Node/ISONOTE columns not found. Support check disabled.'); return map; }
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const node = String(cells[nodeIdx] ?? '').trim();
    const isonote = String(cells[isoIdx] ?? '').trim();
    if (!node || !isonote) continue;
    const supportTypes = normalizeSupportTypes(isonote, keywordCatalog);
    const row = { node, isonote, supportTypes, sourceRow };
    map.set(node, row);
    log.debug('DEBUG', 'T1C_SUPPORT_PARSED', node, row);
    if (supportTypes.length) log.user('INFO', 'SUPPORT_PARSE', node, `Parsed support type(s): ${supportListText(supportTypes)}.`);
  }
  log.user('INFO', 'PARSE', 'Table-1C', `Parsed ${map.size} Node/ISONOTE support rows.`);
  return map;
}

function parseTable2(text, log, keywordCatalog) {
  const lines = splitLines(text);
  if (!lines.length) { log.user('ERROR', 'PARSE', 'Table-2', 'Table-2 is required.'); return []; }
  const headers = splitCells(lines[0]);
  const psIdx = idx(headers, ['psno model', 'psno_model', 'ps model', 'ps no', 'ps']);
  const boreIdx = idx(headers, ['bore', 'nb', 'dn']);
  const pipeIdx = idx(headers, ['pipe', 'line no', 'line', 'branchname']);
  const dtxrIdx = idx(headers, ['dtxr', 'dtxr optional', 'dtxr(optional)', 'support', 'support note']);
  if (psIdx < 0) { log.user('ERROR', 'PARSE', 'Table-2', 'Required column PSNO_Model was not found.'); return []; }
  const rows = [];
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const rawPsNo = String(cells[psIdx] ?? '').trim();
    if (!rawPsNo) continue;
    const norm = normalizePsNo(rawPsNo);
    const bore = boreIdx >= 0 ? number(cells[boreIdx]) : NaN;
    const pipe = pipeIdx >= 0 ? String(cells[pipeIdx] ?? '').trim() : '';
    const dtxr = dtxrIdx >= 0 ? String(cells[dtxrIdx] ?? '').trim() : '';
    const supportTypesRequested = normalizeSupportTypes(dtxr, keywordCatalog);
    const row = { id: `T2#${String(offset + 1).padStart(3, '0')}`, sourceRow, rawPsNo, psnoModel: rawPsNo, ...norm, modelTag: norm.tag, bore: Number.isFinite(bore) ? bore : null, pipe, pipeKey: normalizeLineKey(pipe), dtxr, supportTypesRequested };
    rows.push(row);
    log.debug('DEBUG', 'T2_ROW_PARSED', rawPsNo, row);
    if (supportTypesRequested.length) log.debug('DEBUG', 'DTXR_SUPPORT_PARSED', rawPsNo, { dtxr, supportTypesRequested });
  }
  log.user('INFO', 'PARSE', 'Table-2', `Parsed ${rows.length} model PS rows.`);
  return rows;
}

export function deriveDnFromOd(od) {
  const value = Number(od);
  if (!Number.isFinite(value)) return null;
  let best = null;
  let bestErr = Infinity;
  for (const item of OD_TO_DN) {
    const err = Math.abs(value - item.od);
    if (err < bestErr) { best = item; bestErr = err; }
  }
  if (!best) return null;
  const tolerance = Math.max(1.5, Math.abs(best.od) * 0.006);
  return bestErr <= tolerance ? best.dn : null;
}

function evaluateBore(modelBore, nodeDia, options) {
  if (options.boreMode === 'ignore') return { basis: 'BORE_IGNORED', rank: 5, eligible: true, derivedDn: deriveDnFromOd(nodeDia) };
  if (!Number.isFinite(modelBore) || !Number.isFinite(nodeDia)) return { basis: 'BORE_MISSING', rank: 4, eligible: options.boreMode !== 'strict', derivedDn: deriveDnFromOd(nodeDia) };
  const derivedDn = deriveDnFromOd(nodeDia);
  if (options.allowDnMatch && derivedDn != null && Math.abs(modelBore - derivedDn) <= 1e-6) return { basis: 'BORE_DN', rank: 0, eligible: true, derivedDn };
  if (options.allowRawDiaMatch && Math.abs(modelBore - nodeDia) <= 1e-6) return { basis: 'BORE_OD', rank: 1, eligible: true, derivedDn };
  if (options.allowRawDiaMatch && Math.abs(modelBore - nodeDia) <= options.odToleranceMm) return { basis: 'BORE_OD_APPROX', rank: 2, eligible: true, derivedDn };
  return { basis: 'BORE_CONFLICT', rank: 9, eligible: options.boreMode !== 'strict', derivedDn };
}

function evaluateLine(modelPipe, nodeLine, options) {
  if (options.lineMode === 'ignore') return { basis: 'LINE_IGNORED', rank: 5, eligible: true };
  if (!modelPipe || !nodeLine) return { basis: 'LINE_MISSING', rank: 4, eligible: options.lineMode !== 'strict' };
  const a = normalizeLineKey(modelPipe);
  const b = normalizeLineKey(nodeLine);
  if (a === b) return { basis: 'LINE_EXACT', rank: 0, eligible: true };
  if (a.includes(b) || b.includes(a)) return { basis: 'LINE_SUBSTRING', rank: 1, eligible: true };
  const af = extractLineFamily(a);
  const bf = extractLineFamily(b);
  if (af && bf && af === bf) return { basis: 'LINE_FAMILY', rank: 2, eligible: true };
  return { basis: 'LINE_CONFLICT', rank: 9, eligible: options.lineMode !== 'strict' };
}

function evaluateSupport(modelTypes, nodeTypes, options) {
  if (options.supportMode === 'ignore') return { basis: 'SUPPORT_IGNORED', matchText: '', rank: 5, eligible: true, matchedTypes: [] };
  const requested = Array.isArray(modelTypes) ? modelTypes : [];
  const available = Array.isArray(nodeTypes) ? nodeTypes : [];
  if (!requested.length) return { basis: 'SUPPORT_NOT_REQUESTED', matchText: '', rank: 4, eligible: true, matchedTypes: [] };
  if (!available.length) return { basis: 'SUPPORT_MISSING', matchText: '', rank: 8, eligible: options.supportMode !== 'strict', matchedTypes: [] };
  const matchedTypes = requested.filter((type) => available.includes(type));
  if (matchedTypes.length) return { basis: `SUPPORT_${matchedTypes.join('_')}`, matchText: supportMatchText(matchedTypes), rank: 0, eligible: true, matchedTypes };
  return { basis: 'SUPPORT_CONFLICT', matchText: '', rank: 9, eligible: options.supportMode !== 'strict', matchedTypes: [] };
}

function psBasisFor(model, ref) {
  if (model.exactRawKey === ref.exactRawKey) return 'EXACT_RAW';
  if (model.basePs === ref.basePs) return 'BASE_PS';
  return 'NO_PS_MATCH';
}
function psRank(basis) { return basis === 'EXACT_RAW' ? 0 : basis === 'BASE_PS' ? 1 : 99; }
function compareCandidates(a, b) {
  return a.psBasisRank - b.psBasisRank
    || a.boreRank - b.boreRank
    || a.supportRank - b.supportRank
    || a.lineRank - b.lineRank
    || a.warnings.length - b.warnings.length
    || a.table1Row - b.table1Row
    || natural(a.node, b.node);
}

function buildCandidate(model, ref, options, log) {
  const psBasis = psBasisFor(model, ref);
  if (psBasis === 'NO_PS_MATCH') return null;
  const boreEval = evaluateBore(model.bore, ref.nodeDia, options);
  const supportEval = evaluateSupport(model.supportTypesRequested, ref.supportTypesAvailable, options);
  const lineEval = evaluateLine(model.pipe, ref.nodeLine, options);
  const eligible = boreEval.eligible && supportEval.eligible && lineEval.eligible;
  const parts = [psBasis];
  if (boreEval.basis && boreEval.basis !== 'BORE_IGNORED') parts.push(boreEval.basis);
  if (supportEval.matchText) parts.push(supportEval.basis);
  else if (supportEval.basis === 'SUPPORT_CONFLICT' && model.supportTypesRequested?.length) parts.push('SUPPORT_CONFLICT');
  if (['LINE_EXACT', 'LINE_SUBSTRING', 'LINE_FAMILY'].includes(lineEval.basis)) parts.push(lineEval.basis);
  const candidate = {
    modelId: model.id, refId: ref.id, psnoModel: model.psnoModel, node: ref.node, tag: ref.tag || '',
    table1PsNo: ref.rawPsNo, table1Row: ref.sourceRow, table2Row: model.sourceRow,
    psBasis, boreBasis: boreEval.basis, supportBasis: supportEval.basis, lineBasis: lineEval.basis,
    psBasisRank: psRank(psBasis), boreRank: boreEval.rank, supportRank: supportEval.rank, lineRank: lineEval.rank,
    eligible, basisParts: parts, basis: parts.join(' + '), modelBore: model.bore,
    nodeDia: ref.nodeDia, derivedDn: boreEval.derivedDn, pipe: model.pipe, nodeLine: ref.nodeLine,
    dtxr: model.dtxr || '', modelSupportTypes: model.supportTypesRequested || [],
    nodeIsonote: ref.nodeIsonote || '', nodeIsonoteRaw: ref.nodeIsonote || '', nodeSupportTypes: ref.supportTypesAvailable || [],
    matchedSupportTypes: supportEval.matchedTypes || [], supportMatch: supportEval.matchText || '',
    nodeCoverageNote: '', nodeCoverageStatus: '', warnings: [], selected: false, rejectReason: '',
  };
  if (!eligible) candidate.rejectReason = !boreEval.eligible ? boreEval.basis : !supportEval.eligible ? supportEval.basis : lineEval.basis;
  if (boreEval.basis === 'BORE_CONFLICT') candidate.warnings.push('BORE_CONFLICT');
  if (supportEval.basis === 'SUPPORT_CONFLICT') candidate.warnings.push('SUPPORT_CONFLICT');
  log.debug('DEBUG', 'CANDIDATE_BUILT', `${model.psnoModel} -> ${ref.node}`, candidate);
  return candidate;
}

function makeResultRow(candidate) {
  return {
    enabled: true, psnoModel: candidate.psnoModel, node: candidate.node, tag: candidate.tag || '', supportMatch: candidate.supportMatch || '', basis: candidate.basis,
    confidence: candidate.warnings.length ? 'MEDIUM' : 'HIGH', psBasis: candidate.psBasis, boreBasis: candidate.boreBasis,
    supportBasis: candidate.supportBasis, lineBasis: candidate.lineBasis, table1PsNo: candidate.table1PsNo, table1Row: candidate.table1Row, table2Row: candidate.table2Row,
    modelBore: candidate.modelBore, nodeDia: candidate.nodeDia, derivedDn: candidate.derivedDn, pipe: candidate.pipe,
    nodeLine: candidate.nodeLine, dtxr: candidate.dtxr, modelSupportTypes: candidate.modelSupportTypes,
    modelDtxrKeywords: candidate.modelSupportTypes || [], nodeIsonote: candidate.nodeIsonote, nodeIsonoteRaw: candidate.nodeIsonoteRaw,
    nodeSupportTypes: candidate.nodeSupportTypes, nodeMasterKeywords: candidate.nodeSupportTypes || [], matchedSupportTypes: candidate.matchedSupportTypes,
    nodeCoverageNote: '', nodeCoverageStatus: '', warnings: candidate.warnings, debugId: `${candidate.modelId}:${candidate.refId}`,
  };
}
function makeNoMatch(model, reason) {
  return { enabled: false, psnoModel: model.psnoModel, node: '', tag: '', supportMatch: '', basis: 'NO_MATCH', confidence: 'NO_MATCH', psBasis: 'NO_MATCH', boreBasis: '', supportBasis: '', lineBasis: '', table1PsNo: '', table1Row: null, table2Row: model.sourceRow, modelDtxrKeywords: model.supportTypesRequested || [], nodeCoverageNote: '', nodeCoverageStatus: '', warnings: [reason], debugId: `${model.id}:NO_MATCH` };
}
function groupBy(rows, fn) {
  const map = new Map();
  for (const row of rows) {
    const key = fn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function coverageStatus(master, covered, missing, extra) {
  if (!master.length && !covered.length) return 'NO_MASTER_SUPPORT';
  if (!master.length && covered.length) return 'EXTRA_ONLY';
  if (missing.length && covered.length) return 'PARTIAL';
  if (missing.length) return 'MISSING_ALL';
  if (extra.length) return 'COVERED_WITH_EXTRA';
  return 'COVERED';
}
function coverageAction(status, missing, extra, node) {
  if (status === 'PARTIAL' || status === 'MISSING_ALL') return `Add/verify mapped Table-2 DTXR containing ${supportListText(missing)} for Node ${node}, or confirm it is not required.`;
  if (status === 'COVERED_WITH_EXTRA' || status === 'EXTRA_ONLY') return `Review mapped Table-2 DTXR keyword(s) ${supportListText(extra)} or update Table-1C if valid for Node ${node}.`;
  return 'No action.';
}
function buildSupportCoverageRows({ table1Rows, resultRows, log }) {
  const refsByNode = groupBy(table1Rows, (ref) => ref.node);
  const mappedByNode = groupBy(resultRows.filter((row) => row.node && row.confidence !== 'NO_MATCH'), (row) => row.node);
  const allNodes = uniqueSorted([...refsByNode.keys(), ...mappedByNode.keys()]);
  const rows = [];
  for (const node of allNodes) {
    const refs = refsByNode.get(node) || [];
    const mapped = mappedByNode.get(node) || [];
    const master = uniqueSorted(refs.flatMap((ref) => ref.supportTypesAvailable || []));
    const covered = uniqueSorted(mapped.flatMap((row) => row.modelDtxrKeywords || []));
    const missing = master.filter((item) => !covered.includes(item));
    const extra = covered.filter((item) => !master.includes(item));
    const status = coverageStatus(master, covered, missing, extra);
    const action = coverageAction(status, missing, extra, node);
    const row = {
      node,
      table1PsNo: uniqueSorted(refs.map((ref) => ref.rawPsNo)).join(', '),
      tag: uniqueSorted(refs.map((ref) => ref.tag)).join(', '),
      dia: uniqueSorted(refs.map((ref) => Number.isFinite(ref.nodeDia) ? String(ref.nodeDia) : '')).join(', '),
      derivedDn: uniqueSorted(refs.map((ref) => Number.isFinite(ref.derivedDn) ? String(ref.derivedDn) : '')).join(', '),
      lineNo: uniqueSorted(refs.map((ref) => ref.nodeLine)).join(', '),
      isonote: uniqueSorted(refs.map((ref) => ref.nodeIsonote)).join(' | '),
      masterKeywords: master,
      mappedPsnos: mapped.map((item) => item.psnoModel),
      coveredDtxrKeywords: covered,
      missingMasterKeywords: missing,
      extraDtxrKeywords: extra,
      coverageStatus: status,
      action,
    };
    rows.push(row);
    for (const mappedRow of mapped) {
      mappedRow.nodeCoverageNote = missing.length
        ? `Node ${node} missing ${supportListText(missing)} in mapped DTXR.`
        : extra.length ? `Node ${node} has extra DTXR keyword(s): ${supportListText(extra)}.` : '';
      mappedRow.nodeCoverageStatus = status;
    }
    if (missing.length) {
      log.user('WARNING', 'SUPPORT_COVERAGE', `Node ${node}`, `Master ISONOTE contains ${supportListText(master)}. Mapped Table-2 DTXR covers ${supportListText(covered) || 'none'}. Missing ${supportListText(missing)}.`, action);
      log.debug('WARNING', 'SUPPORT_COVERAGE_MISSING', `Node ${node}`, row);
    }
    if (extra.length) {
      log.user('WARNING', 'SUPPORT_COVERAGE', `Node ${node}`, `Mapped Table-2 DTXR contains ${supportListText(extra)}, but Table-1C master keywords are ${supportListText(master) || 'none'}.`, action);
      log.debug('WARNING', 'SUPPORT_COVERAGE_EXTRA', `Node ${node}`, row);
    }
    log.debug('INFO', 'SUPPORT_COVERAGE_NODE_BUILT', `Node ${node}`, row);
  }
  return rows;
}
function annotateCandidateCoverage(candidateRows, resultRows) {
  const selectedByDebugId = new Map(resultRows.filter((row) => row.debugId).map((row) => [row.debugId, row]));
  for (const candidate of candidateRows) {
    const row = selectedByDebugId.get(`${candidate.modelId}:${candidate.refId}`);
    if (!row) continue;
    candidate.nodeCoverageNote = row.nodeCoverageNote || '';
    candidate.nodeCoverageStatus = row.nodeCoverageStatus || '';
  }
}
function buildSummary(rows, table1Rows, modelRows, candidates, userLog, supportCoverageRows = []) {
  const warnings = rows.reduce((sum, row) => sum + (row.warnings?.length || 0), 0) + userLog.filter((e) => e.level === 'WARNING').length;
  return {
    table1Rows: table1Rows.length,
    table2Rows: modelRows.length,
    candidateRows: candidates.length,
    mapped: rows.filter((r) => r.enabled).length,
    noMatch: rows.filter((r) => !r.enabled).length,
    warnings,
    supportMatches: rows.filter((r) => r.supportMatch).length,
    supportCoverageRows: supportCoverageRows.length,
    supportCoverageWarnings: supportCoverageRows.filter((row) => ['PARTIAL', 'MISSING_ALL', 'COVERED_WITH_EXTRA', 'EXTRA_ONLY'].includes(row.coverageStatus)).length,
    tags: Array.from(new Set(rows.map((r) => r.tag).filter(Boolean))),
  };
}

function canUseCandidate(candidate, usedRefs) {
  if (!usedRefs.has(candidate.refId)) return true;
  return candidate.modelSupportTypes?.length > 0;
}
function supportSlotLabel(candidate) {
  if (candidate.supportMatch) return candidate.supportMatch;
  if (candidate.modelSupportTypes?.length) return `requested ${candidate.modelSupportTypes.map(supportDisplay).join('+')}`;
  return 'no support requested';
}
function resolveGroup(models, refs, options, log) {
  const candidateRows = [];
  const outputRows = [];
  const usedRefs = new Set();
  const sortedModels = [...models].sort((a, b) => a.sourceRow - b.sourceRow);
  for (const model of sortedModels) {
    const candidates = refs.map((ref) => buildCandidate(model, ref, options, log)).filter(Boolean).sort(compareCandidates);
    candidateRows.push(...candidates);
    const eligible = candidates.filter((c) => c.eligible);
    const selected = eligible.find((c) => canUseCandidate(c, usedRefs)) || eligible[0];
    if (!selected) { outputRows.push(makeNoMatch(model, candidates[0]?.rejectReason || 'NO_ELIGIBLE_CANDIDATE')); continue; }
    const reused = usedRefs.has(selected.refId);
    usedRefs.add(selected.refId);
    selected.selected = true;
    if (models.length > 1 || refs.length > 1) selected.basis = `${selected.basis} + DUPLICATE_ASSIGN`;
    if (reused) {
      selected.basis = `${selected.basis} + MULTI_SUPPORT_NODE`;
      selected.warnings.push(selected.supportMatch ? 'NODE_REUSED_FOR_SUPPORT' : 'NODE_REUSED_SUPPORT_REVIEW');
      log.debug('INFO', 'MULTI_SUPPORT_NODE_REUSE', `${model.psnoModel} -> ${selected.node}`, { psnoModel: model.psnoModel, node: selected.node, supportSlot: supportSlotLabel(selected), selected });
    }
    outputRows.push(makeResultRow(selected));
    const stage = models.length > 1 || refs.length > 1 ? 'DUPLICATE_ASSIGN' : 'RESOLVE';
    const supportMsg = selected.supportMatch ? ` Support ${selected.supportMatch}.` : selected.modelSupportTypes?.length ? ` Support requested but not matched (${selected.supportBasis}).` : '';
    log.user('INFO', stage, model.psnoModel, `Mapped to Node ${selected.node} using ${selected.basis}.${supportMsg}`);
  }
  return { outputRows, candidateRows };
}

export function runPsMappingResolver(input = {}) {
  const log = createLogger();
  const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  options.odToleranceMm = Number(options.odToleranceMm ?? 1.5);
  const keywordCatalog = parseTable1DKeywords(input.table1dKeywordText || input.table1DText || DEFAULT_MASTER_KEYWORDS, log);
  const table1Rows = parseTable1(input.table1PsNodeText, log);
  const diaByNode = parseTable1A(input.table1aNodeDiaText, log);
  const lineByNode = parseTable1B(input.table1bNodeLineText, log);
  const supportByNode = parseTable1C(input.table1cNodeIsonoteText, log, keywordCatalog);
  const modelRows = parseTable2(input.table2ModelText, log, keywordCatalog);
  for (const ref of table1Rows) {
    const dia = diaByNode.get(ref.node);
    if (dia) { ref.nodeDia = dia.dia; ref.derivedDn = deriveDnFromOd(dia.dia); }
    const line = lineByNode.get(ref.node);
    if (line) { ref.nodeLine = line.lineNo; ref.nodeLineKey = line.lineKey; }
    const support = supportByNode.get(ref.node);
    if (support) { ref.nodeIsonote = support.isonote; ref.supportTypesAvailable = support.supportTypes; }
    else { ref.nodeIsonote = ''; ref.supportTypesAvailable = []; }
    log.debug('DEBUG', 'REFERENCE_ENRICHED', ref.rawPsNo, ref);
  }
  const refsByBase = groupBy(table1Rows, (r) => r.basePs);
  const modelsByBase = groupBy(modelRows, (r) => r.basePs);
  const rows = [];
  const candidates = [];
  for (const [basePs, models] of modelsByBase.entries()) {
    const refs = refsByBase.get(basePs) || [];
    if (!refs.length) {
      for (const model of models) { rows.push(makeNoMatch(model, 'NO_BASE_PS_MATCH')); log.user('WARNING', 'RESOLVE', model.psnoModel, `No Table-1 row found for base PS ${basePs}.`); }
      continue;
    }
    const resolved = resolveGroup(models, refs, options, log);
    rows.push(...resolved.outputRows);
    candidates.push(...resolved.candidateRows);
  }
  rows.sort((a, b) => a.table2Row - b.table2Row);
  const supportCoverageRows = buildSupportCoverageRows({ table1Rows, resultRows: rows, log });
  annotateCandidateCoverage(candidates, rows);
  return { rows, candidates, supportCoverageRows, userLog: log.userLog, debugLog: log.debugLog, summary: buildSummary(rows, table1Rows, modelRows, candidates, log.userLog, supportCoverageRows), options };
}

export function rowsToCsv(rows) {
  const headers = ['PSNO_Model', 'Node', 'Tag', 'Support match', 'Node Coverage Note', 'Basis'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => [r.psnoModel, r.node, r.tag, r.supportMatch, r.nodeCoverageNote, r.basis].map(esc).join(','))].join('\n');
}
