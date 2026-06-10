const DEFAULT_OPTIONS = {
  boreMode: 'prefer',
  lineMode: 'prefer',
  odToleranceMm: 1.5,
  allowRawDiaMatch: true,
  allowDnMatch: true,
  allowDuplicateAssignment: true,
};

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

function parseTable2(text, log) {
  const lines = splitLines(text);
  if (!lines.length) { log.user('ERROR', 'PARSE', 'Table-2', 'Table-2 is required.'); return []; }
  const headers = splitCells(lines[0]);
  const psIdx = idx(headers, ['psno model', 'psno_model', 'ps model', 'ps no', 'ps']);
  const boreIdx = idx(headers, ['bore', 'nb', 'dn']);
  const pipeIdx = idx(headers, ['pipe', 'line no', 'line', 'branchname']);
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
    const row = { id: `T2#${String(offset + 1).padStart(3, '0')}`, sourceRow, rawPsNo, psnoModel: rawPsNo, ...norm, modelTag: norm.tag, bore: Number.isFinite(bore) ? bore : null, pipe, pipeKey: normalizeLineKey(pipe) };
    rows.push(row);
    log.debug('DEBUG', 'T2_ROW_PARSED', rawPsNo, row);
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

function psBasisFor(model, ref) {
  if (model.exactRawKey === ref.exactRawKey) return 'EXACT_RAW';
  if (model.basePs === ref.basePs) return 'BASE_PS';
  return 'NO_PS_MATCH';
}
function psRank(basis) { return basis === 'EXACT_RAW' ? 0 : basis === 'BASE_PS' ? 1 : 99; }
function compareCandidates(a, b) {
  return a.psBasisRank - b.psBasisRank
    || a.boreRank - b.boreRank
    || a.lineRank - b.lineRank
    || a.warnings.length - b.warnings.length
    || a.table1Row - b.table1Row
    || natural(a.node, b.node);
}

function buildCandidate(model, ref, options, log) {
  const psBasis = psBasisFor(model, ref);
  if (psBasis === 'NO_PS_MATCH') return null;
  const boreEval = evaluateBore(model.bore, ref.nodeDia, options);
  const lineEval = evaluateLine(model.pipe, ref.nodeLine, options);
  const eligible = boreEval.eligible && lineEval.eligible;
  const parts = [psBasis];
  if (boreEval.basis && boreEval.basis !== 'BORE_IGNORED') parts.push(boreEval.basis);
  if (['LINE_EXACT', 'LINE_SUBSTRING', 'LINE_FAMILY'].includes(lineEval.basis)) parts.push(lineEval.basis);
  const candidate = {
    modelId: model.id, refId: ref.id, psnoModel: model.psnoModel, node: ref.node, tag: ref.tag || '',
    table1PsNo: ref.rawPsNo, table1Row: ref.sourceRow, table2Row: model.sourceRow,
    psBasis, boreBasis: boreEval.basis, lineBasis: lineEval.basis,
    psBasisRank: psRank(psBasis), boreRank: boreEval.rank, lineRank: lineEval.rank,
    eligible, basisParts: parts, basis: parts.join(' + '), modelBore: model.bore,
    nodeDia: ref.nodeDia, derivedDn: boreEval.derivedDn, pipe: model.pipe, nodeLine: ref.nodeLine,
    warnings: [], selected: false, rejectReason: '',
  };
  if (!eligible) candidate.rejectReason = !boreEval.eligible ? boreEval.basis : lineEval.basis;
  if (boreEval.basis === 'BORE_CONFLICT') candidate.warnings.push('BORE_CONFLICT');
  log.debug('DEBUG', 'CANDIDATE_BUILT', `${model.psnoModel} -> ${ref.node}`, candidate);
  return candidate;
}

function makeResultRow(candidate) {
  return {
    enabled: true, psnoModel: candidate.psnoModel, node: candidate.node, tag: candidate.tag || '', basis: candidate.basis,
    confidence: candidate.warnings.length ? 'MEDIUM' : 'HIGH', psBasis: candidate.psBasis, boreBasis: candidate.boreBasis,
    lineBasis: candidate.lineBasis, table1PsNo: candidate.table1PsNo, table1Row: candidate.table1Row, table2Row: candidate.table2Row,
    modelBore: candidate.modelBore, nodeDia: candidate.nodeDia, derivedDn: candidate.derivedDn, pipe: candidate.pipe,
    nodeLine: candidate.nodeLine, warnings: candidate.warnings, debugId: `${candidate.modelId}:${candidate.refId}`,
  };
}
function makeNoMatch(model, reason) {
  return { enabled: false, psnoModel: model.psnoModel, node: '', tag: '', basis: 'NO_MATCH', confidence: 'NO_MATCH', psBasis: 'NO_MATCH', boreBasis: '', lineBasis: '', table1PsNo: '', table1Row: null, table2Row: model.sourceRow, warnings: [reason], debugId: `${model.id}:NO_MATCH` };
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
function buildSummary(rows, table1Rows, modelRows, candidates, userLog) {
  const warnings = rows.reduce((sum, row) => sum + (row.warnings?.length || 0), 0) + userLog.filter((e) => e.level === 'WARNING').length;
  return {
    table1Rows: table1Rows.length,
    table2Rows: modelRows.length,
    candidateRows: candidates.length,
    mapped: rows.filter((r) => r.enabled).length,
    noMatch: rows.filter((r) => !r.enabled).length,
    warnings,
    tags: Array.from(new Set(rows.map((r) => r.tag).filter(Boolean))),
  };
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
    const selected = eligible.find((c) => !usedRefs.has(c.refId)) || eligible[0];
    if (!selected) { outputRows.push(makeNoMatch(model, candidates[0]?.rejectReason || 'NO_ELIGIBLE_CANDIDATE')); continue; }
    usedRefs.add(selected.refId);
    selected.selected = true;
    if (models.length > 1 || refs.length > 1) selected.basis = `${selected.basis} + DUPLICATE_ASSIGN`;
    outputRows.push(makeResultRow(selected));
    log.user(models.length > 1 || refs.length > 1 ? 'INFO' : 'INFO', models.length > 1 || refs.length > 1 ? 'DUPLICATE_ASSIGN' : 'RESOLVE', model.psnoModel, `Mapped to Node ${selected.node} using ${selected.basis}.`);
  }
  return { outputRows, candidateRows };
}

export function runPsMappingResolver(input = {}) {
  const log = createLogger();
  const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  options.odToleranceMm = Number(options.odToleranceMm ?? 1.5);
  const table1Rows = parseTable1(input.table1PsNodeText, log);
  const diaByNode = parseTable1A(input.table1aNodeDiaText, log);
  const lineByNode = parseTable1B(input.table1bNodeLineText, log);
  const modelRows = parseTable2(input.table2ModelText, log);
  for (const ref of table1Rows) {
    const dia = diaByNode.get(ref.node);
    if (dia) { ref.nodeDia = dia.dia; ref.derivedDn = deriveDnFromOd(dia.dia); }
    const line = lineByNode.get(ref.node);
    if (line) { ref.nodeLine = line.lineNo; ref.nodeLineKey = line.lineKey; }
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
  return { rows, candidates, userLog: log.userLog, debugLog: log.debugLog, summary: buildSummary(rows, table1Rows, modelRows, candidates, log.userLog), options };
}

export function rowsToCsv(rows) {
  const headers = ['PSNO_Model', 'Node', 'Tag', 'Basis'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => [r.psnoModel, r.node, r.tag, r.basis].map(esc).join(','))].join('\n');
}
