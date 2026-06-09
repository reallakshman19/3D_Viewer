import { PIPE_OD_TO_DN } from '../../pcf-legacy/services/bore-converter.js';

const PSNM_DEFAULT_COORD_DECIMALS = 2;
const PSNM_EXACT_EPS_MM = 0.01;
const PSNM_EPS = 1e-9;
const PSNM_TIE_EPS_MM = 1e-6;

function PSNM_safeString(value) { return String(value ?? '').trim(); }
function PSNM_number(value) {
  const text = PSNM_safeString(value).replace(/,/g, '');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}
function PSNM_roundCoord(value, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  const factor = 10 ** Number(decimals || PSNM_DEFAULT_COORD_DECIMALS);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
function PSNM_coordKey(coord, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  return [PSNM_roundCoord(coord.x, decimals).toFixed(decimals), PSNM_roundCoord(coord.y, decimals).toFixed(decimals), PSNM_roundCoord(coord.z, decimals).toFixed(decimals)].join('|');
}
function PSNM_assertFinite(value, label) { if (!Number.isFinite(value)) throw new Error(`[PSNM] Invalid numeric value for ${label}: ${value}`); }
export function PSNM_roundUp1(value) { const n = Number(value); return Number.isFinite(n) ? Math.ceil((n - PSNM_EPS) * 10) / 10 : null; }
const PSNM_OD_TO_BORE = new Map(PIPE_OD_TO_DN.map((row) => [PSNM_roundUp1(row.od).toFixed(1), row.dn]));
export function PSNM_boreFromOdMm(odMm) { const rounded = PSNM_roundUp1(odMm); return rounded == null ? null : (PSNM_OD_TO_BORE.get(rounded.toFixed(1)) ?? null); }

export function PSNM_createRunLogger() {
  const userLog = [];
  const debugLog = [];
  let sequence = 0;
  function debug(level, code, message, data = {}) {
    debugLog.push({ sequence: ++sequence, timestamp: new Date().toISOString(), level: String(level || 'INFO').toUpperCase(), code: String(code || 'TRACE'), message: String(message || ''), data });
  }
  function user(level, category, source, item, reason, suggestedAction, data = {}) {
    const entry = { level: String(level || 'INFO').toUpperCase(), category: String(category || ''), source: String(source || ''), item: String(item || ''), reason: String(reason || ''), suggestedAction: String(suggestedAction || ''), data };
    userLog.push(entry);
    debug(entry.level, `USER_${entry.category.toUpperCase().replace(/\s+/g, '_')}`, entry.reason, { source: entry.source, item: entry.item, suggestedAction: entry.suggestedAction, ...data });
  }
  return { userLog, debugLog, debug, user };
}

export function PSNM_parsePsPosition(positionText) {
  const text = String(positionText || '');
  const result = { e: null, s: null, u: null };
  for (const match of text.matchAll(/\b([EWSNUD])\s*(-?\d+(?:\.\d+)?)\s*mm\b/gi)) {
    const axis = match[1].toUpperCase();
    const value = Number(match[2]);
    if (axis === 'E') result.e = value;
    else if (axis === 'W') result.e = -value;
    else if (axis === 'S') result.s = value;
    else if (axis === 'N') result.s = -value;
    else if (axis === 'U') result.u = value;
    else if (axis === 'D') result.u = -value;
  }
  PSNM_assertFinite(result.e, 'PS position E/W');
  PSNM_assertFinite(result.s, 'PS position S/N');
  PSNM_assertFinite(result.u, 'PS position U/D');
  return result;
}

export function PSNM_parseNodePosition(positionText) {
  const parts = String(positionText || '').split(',').map((value) => PSNM_number(value));
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) throw new Error(`[PSNM] Invalid transformed node position: ${positionText}`);
  return { x: parts[0], y: parts[1], z: parts[2] };
}

export function PSNM_deriveTransformFromAnchor(anchor) {
  const ps = PSNM_parsePsPosition(anchor.psPosition);
  const node = PSNM_parseNodePosition(anchor.nodePosition);
  return { datumE: ps.e - node.x, datumU: ps.u - node.y, datumS: ps.s - node.z };
}
export function PSNM_transformPsPosition(positionText, transform, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  const ps = PSNM_parsePsPosition(positionText);
  return { x: PSNM_roundCoord(ps.e - transform.datumE, decimals), y: PSNM_roundCoord(ps.u - transform.datumU, decimals), z: PSNM_roundCoord(ps.s - transform.datumS, decimals) };
}

function PSNM_normalizeHeader(header) { return PSNM_safeString(header).toLowerCase().replace(/\s+/g, ' ').replace(/[_.-]+/g, ' ').trim(); }
function PSNM_splitTableLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((value) => value.trim());
  return raw.split(/ {2,}/).map((value) => value.trim()).filter(Boolean);
}
function PSNM_parseTableRows(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  if (!lines.length) return [];
  const headers = PSNM_splitTableLine(lines[0]).map(PSNM_normalizeHeader);
  return lines.slice(1).map((line, index) => {
    const cells = PSNM_splitTableLine(line);
    const row = { __raw: line, __rowIndex: index + 1 };
    headers.forEach((header, cellIndex) => { row[header] = cells[cellIndex] ?? ''; });
    return row;
  });
}

export function PSNM_parsePsRows(text, logger = null) {
  const parsed = [];
  for (const row of PSNM_parseTableRows(text)) {
    const psName = row['ps name'] || row.psname || row.name || '';
    const position = row.position || '';
    const p1bore = PSNM_number(row.p1bore || row.bore || row['bore mm']);
    if (!psName || !position) { logger?.user?.('ERROR', 'Parse Failed', 'PS Table', row.__raw, 'PS row must contain PS NAME and Position.', 'Paste PS table with columns: PS NAME, Position, p1bore.', { row }); continue; }
    parsed.push({ psName: PSNM_safeString(psName).replace(/\.$/, ''), position: PSNM_safeString(position), p1bore, rowIndex: row.__rowIndex });
  }
  return parsed;
}

export function PSNM_parseNodeRows(text, logger = null) {
  const parsed = [];
  for (const row of PSNM_parseTableRows(text)) {
    const node = row.node || '';
    const position = row['position(x,y,z) transformed'] || row['position(x,y,z)'] || row.position || row['transformed position'] || '';
    const x = PSNM_number(row.x);
    const y = PSNM_number(row.y);
    const z = PSNM_number(row.z);
    if (!node) { logger?.user?.('ERROR', 'Parse Failed', 'Node XYZ Table', row.__raw, 'Node row must contain Node.', 'Paste Node table with columns: Node, X, Y, Z.', { row }); continue; }
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      parsed.push({ node: PSNM_safeString(node), x, y, z, position: `${x}, ${y}, ${z}`, rowIndex: row.__rowIndex });
    } else if (position) {
      parsed.push({ node: PSNM_safeString(node), position: PSNM_safeString(position), rowIndex: row.__rowIndex });
    } else {
      logger?.user?.('ERROR', 'Parse Failed', 'Node XYZ Table', row.__raw, 'Node row must contain X/Y/Z or Position.', 'Paste Node table as Node, X, Y, Z or legacy Node, Position.', { row });
    }
  }
  return parsed;
}

export function PSNM_parseNodeDiaRows(text, logger = null) {
  const parsed = [];
  for (const row of PSNM_parseTableRows(text)) {
    const node = row.node || '';
    const odMm = PSNM_number(row['dia(mm)'] || row['dia mm'] || row.dia || row.odmm || row['od mm']);
    if (!node || !Number.isFinite(odMm)) { logger?.user?.('ERROR', 'Parse Failed', 'Node Dia Table', row.__raw, 'Node dia row must contain Node and Dia(mm).', 'Paste Node Dia table with columns: Node, Dia(mm).', { row }); continue; }
    parsed.push({ node: PSNM_safeString(node), odMm, rowIndex: row.__rowIndex });
  }
  return parsed;
}

export function PSNM_parseMandatoryNodeRows(text, logger = null) {
  const nodes = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  for (const line of lines) {
    if (/node/i.test(line) && !/-?\d+/.test(line)) continue;
    const match = line.match(/-?\d+/);
    if (!match) continue;
    const node = match[0];
    if (seen.has(node)) { logger?.user?.('WARNING', 'Duplicate Mandatory Node', 'Mandatory Node List', node, 'Mandatory node appears more than once.', 'Remove duplicate entry from mandatory node list.', { line }); continue; }
    seen.add(node);
    nodes.push({ node, rowIndex: nodes.length + 1 });
  }
  return nodes;
}

function PSNM_distance(a, b) { const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y); const dz = Math.abs(a.z - b.z); return { dx, dy, dz, maxAxisDeltaMm: Math.max(dx, dy, dz), euclideanDeltaMm: Math.sqrt(dx * dx + dy * dy + dz * dz) }; }
function PSNM_within(delta, tolerance) { return delta.dx <= tolerance.xMm && delta.dy <= tolerance.yMm && delta.dz <= tolerance.zMm; }
function PSNM_classifyCandidate({ psKey, nodeKey, delta, boreMatch, cfg }) {
  if (psKey === nodeKey && delta.maxAxisDeltaMm <= PSNM_EXACT_EPS_MM && boreMatch) return 'EXACT';
  if (cfg.enableApprox1 && PSNM_within(delta, cfg.approx1) && boreMatch) return 'APPROX_1';
  if (cfg.enableApprox2 && PSNM_within(delta, cfg.approx2) && boreMatch) return 'APPROX_2';
  if (cfg.enableApprox3 && PSNM_within(delta, cfg.approx3)) return 'APPROX_3';
  return 'NO_MATCH';
}
function PSNM_rankMatchType(type) { return type === 'EXACT' ? 1 : type === 'APPROX_1' ? 2 : type === 'APPROX_2' ? 3 : type === 'APPROX_3' ? 4 : 99; }
function PSNM_boreRank(status) { return status === 'PASS' ? 0 : status === 'IGNORED' ? 1 : 2; }
function PSNM_candidateCompare(a, b) {
  return PSNM_rankMatchType(a.matchType) - PSNM_rankMatchType(b.matchType)
    || Number(b.isMandatory) - Number(a.isMandatory)
    || PSNM_boreRank(a.boreStatus) - PSNM_boreRank(b.boreStatus)
    || a.maxAxisDeltaMm - b.maxAxisDeltaMm
    || a.euclideanDeltaMm - b.euclideanDeltaMm
    || Number(a.isTerminal) - Number(b.isTerminal)
    || a.rowIndex - b.rowIndex
    || String(a.matchingNode).localeCompare(String(b.matchingNode), undefined, { numeric: true });
}
function PSNM_isAmbiguousTie(a, b) {
  if (!a || !b) return false;
  return a.matchType === b.matchType
    && a.isMandatory === b.isMandatory
    && a.boreStatus === b.boreStatus
    && a.isTerminal === b.isTerminal
    && Math.abs(a.maxAxisDeltaMm - b.maxAxisDeltaMm) <= PSNM_TIE_EPS_MM
    && Math.abs(a.euclideanDeltaMm - b.euclideanDeltaMm) <= PSNM_TIE_EPS_MM;
}
function PSNM_makeOccurrenceId(node, count) { return `${node}#${String(count).padStart(3, '0')}`; }

export function PSNM_buildMatchTable(options) {
  const logger = options.logger || PSNM_createRunLogger();
  const coordinateDecimals = Number(options.coordinateDecimals ?? PSNM_DEFAULT_COORD_DECIMALS);
  const cfg = { enableApprox1: options.enableApprox1 !== false, enableApprox2: options.enableApprox2 !== false, enableApprox3: options.enableApprox3 !== false, approx1: options.approx1 || { xMm: 25, yMm: 25, zMm: 25 }, approx2: options.approx2 || { xMm: 50, yMm: 25, zMm: 50 }, approx3: options.approx3 || options.approx2 || { xMm: 50, yMm: 25, zMm: 50 } };
  const psRows = options.psRows || [];
  const nodeRows = options.nodeRows || [];
  const nodeDiaRows = options.nodeDiaRows || [];
  const mandatoryNodeRows = options.mandatoryNodeRows || [];
  const mandatorySet = new Set(mandatoryNodeRows.map((row) => PSNM_safeString(row.node)).filter(Boolean));
  logger.debug('INFO', 'INIT', 'PSNM run started.', { psRows: psRows.length, nodeRows: nodeRows.length, nodeDiaRows: nodeDiaRows.length, mandatoryNodes: mandatorySet.size, coordinateDecimals, cfg });

  const transform = PSNM_deriveTransformFromAnchor(options.anchor);
  logger.debug('INFO', 'ANCHOR_TRANSFORM', 'Derived transform from anchor.', { anchor: options.anchor, transform });

  const diaByNode = new Map();
  for (const row of nodeDiaRows) {
    const node = PSNM_safeString(row.node);
    const od = Number(row.odMm);
    if (!node || !Number.isFinite(od)) continue;
    const previous = diaByNode.get(node);
    if (previous != null && Math.abs(previous - od) > 1e-6) { logger.user('ERROR', 'Duplicate Node Dia', 'Node Dia Table', node, `Same node has conflicting OD values: ${previous} and ${od}.`, 'Clean duplicate node diameter table before matching.', { previousOdMm: previous, newOdMm: od }); continue; }
    diaByNode.set(node, od);
  }

  const nodeCandidates = [];
  const occurrenceCounter = new Map();
  const occurrencesByNode = new Map();
  for (const row of nodeRows) {
    try {
      const node = PSNM_safeString(row.node);
      const count = (occurrenceCounter.get(node) || 0) + 1;
      occurrenceCounter.set(node, count);
      const coord = Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z) ? { x: row.x, y: row.y, z: row.z } : PSNM_parseNodePosition(row.position);
      const odMm = diaByNode.get(node) ?? null;
      const roundedOdMm = odMm == null ? null : PSNM_roundUp1(odMm);
      const boreMm = odMm == null ? null : PSNM_boreFromOdMm(odMm);
      const nodeEntry = { node, occurrenceId: PSNM_makeOccurrenceId(node, count), rowIndex: row.rowIndex ?? count, coord, key: PSNM_coordKey(coord, coordinateDecimals), odMm, roundedOdMm, boreMm, isMandatory: mandatorySet.has(node), isTerminal: node === '-1', selected: false };
      nodeCandidates.push(nodeEntry);
      if (!occurrencesByNode.has(node)) occurrencesByNode.set(node, []);
      occurrencesByNode.get(node).push(nodeEntry);
      logger.debug('INFO', 'NODE_XYZ_PARSED', `Node ${nodeEntry.occurrenceId} parsed.`, nodeEntry);
      if (count > 1) logger.user('INFO', 'Duplicate Node Occurrence', 'Node XYZ Table', node, 'Same node number appears multiple times and was kept as separate occurrences.', 'Review occurrence in Candidate Resolver if this node is selected.', { node, occurrenceId: nodeEntry.occurrenceId });
      if (odMm == null) logger.user('WARNING', 'Missing Node Dia', 'Node Dia Table', node, 'Node has no OD value, so bore cannot be validated.', 'Add node diameter or rely only on Approx 3 when acceptable.', { node, occurrenceId: nodeEntry.occurrenceId });
      else if (boreMm == null) logger.user('WARNING', 'Unmapped OD', 'Node Dia Table', node, `OD ${odMm} does not map to a bore in the NPS/Bore master.`, 'Check OD value or update NPS/Bore master.', { node, occurrenceId: nodeEntry.occurrenceId, odMm, roundedOdMm });
      else logger.debug('INFO', 'NODE_BORE_MAP', `Node ${nodeEntry.occurrenceId} OD mapped to bore.`, { node, occurrenceId: nodeEntry.occurrenceId, odMm, roundedOdMm, boreMm });
    } catch (error) {
      logger.user('ERROR', 'Parse Failed', 'Node XYZ Table', row.node || row.position, error.message || String(error), 'Correct node coordinate format: Node, X, Y, Z.', { row });
    }
  }

  const rows = [];
  const candidateRows = [];
  for (const psRow of psRows) {
    const psName = PSNM_safeString(psRow.psName).replace(/\.$/, '');
    try {
      const psCoord = PSNM_transformPsPosition(psRow.position, transform, coordinateDecimals);
      const psKey = PSNM_coordKey(psCoord, coordinateDecimals);
      const psBore = Number(psRow.p1bore);
      const candidates = [];
      logger.debug('INFO', 'PS_TRANSFORM', `${psName} transformed.`, { psName, sourcePosition: psRow.position, psCoord, psKey, psBore });
      for (const nodeRow of nodeCandidates) {
        const delta = PSNM_distance(psCoord, nodeRow.coord);
        const boreMatch = Number.isFinite(psBore) && nodeRow.boreMm != null && Math.abs(psBore - nodeRow.boreMm) <= 1e-6;
        const matchType = PSNM_classifyCandidate({ psKey, nodeKey: nodeRow.key, delta, boreMatch, cfg });
        const boreStatus = matchType === 'APPROX_3' && !boreMatch ? 'IGNORED' : (boreMatch ? 'PASS' : 'FAIL');
        const candidate = { psName, position: psRow.position, transformedX: psCoord.x, transformedY: psCoord.y, transformedZ: psCoord.z, matchingNode: nodeRow.node, occurrenceId: nodeRow.occurrenceId, isMandatory: nodeRow.isMandatory, isTerminal: nodeRow.isTerminal, rowIndex: nodeRow.rowIndex, nodeX: nodeRow.coord.x, nodeY: nodeRow.coord.y, nodeZ: nodeRow.coord.z, matchType, psBore: Number.isFinite(psBore) ? psBore : null, nodeOdMm: nodeRow.odMm, nodeRoundedOdMm: nodeRow.roundedOdMm, nodeBoreMm: nodeRow.boreMm, boreStatus, dxMm: delta.dx, dyMm: delta.dy, dzMm: delta.dz, maxAxisDeltaMm: delta.maxAxisDeltaMm, euclideanDeltaMm: delta.euclideanDeltaMm, decision: 'REJECTED_NO_MATCH', reason: 'Outside enabled tolerance or bore requirement.' };
        logger.debug(matchType === 'NO_MATCH' ? 'DEBUG' : 'INFO', matchType === 'NO_MATCH' ? 'CANDIDATE_REJECTED' : 'CANDIDATE_ACCEPTED', `Candidate ${nodeRow.occurrenceId} evaluated for ${psName}.`, candidate);
        if (matchType !== 'NO_MATCH') candidates.push(candidate);
      }
      candidates.sort(PSNM_candidateCompare);
      if (!candidates.length) {
        logger.user('WARNING', 'Unmapped PS', 'PS Table', psName, 'No node found within enabled tolerance rules.', 'Check anchor transform, load full Node XYZ table, or increase Approx 2/3 tolerance.', { psName, psCoord, psBore });
        rows.push({ psName, position: psRow.position, transformedX: psCoord.x, transformedY: psCoord.y, transformedZ: psCoord.z, matchingNode: '', occurrenceId: '', isMandatory: false, matchType: 'NO_MATCH', finalStatus: 'UNMAPPED', psBore: Number.isFinite(psBore) ? psBore : null, nodeOdMm: null, nodeRoundedOdMm: null, nodeBoreMm: null, boreStatus: 'N/A', dxMm: null, dyMm: null, dzMm: null, maxAxisDeltaMm: null, euclideanDeltaMm: null });
        continue;
      }
      const top = candidates[0];
      const ambiguous = candidates.length > 1 && PSNM_isAmbiguousTie(candidates[0], candidates[1]);
      if (ambiguous) {
        const tied = candidates.filter((candidate) => PSNM_isAmbiguousTie(top, candidate));
        tied.forEach((candidate) => { candidate.decision = 'AMBIGUOUS'; candidate.reason = 'Equivalent top-ranked candidate. Manual review required.'; candidateRows.push(candidate); });
        candidates.filter((candidate) => !tied.includes(candidate)).forEach((candidate) => { candidate.decision = 'REJECTED_BY_RANK'; candidate.reason = 'Lower ranked than ambiguous top candidate set.'; candidateRows.push(candidate); });
        logger.user('WARNING', 'Ambiguous Match', 'PS Table', psName, 'Multiple equivalent candidate nodes found for the same PS coordinate.', 'Use Candidate Resolver and add a manual override if needed.', { psName, tiedCandidates: tied.map((c) => ({ node: c.matchingNode, occurrenceId: c.occurrenceId })) });
        rows.push({ ...top, matchingNode: '', occurrenceId: '', matchType: 'AMBIGUOUS', finalStatus: 'USER_REVIEW_REQUIRED', candidateCount: tied.length });
        continue;
      }
      const selected = top;
      selected.decision = 'SELECTED';
      selected.reason = selected.isMandatory ? 'Selected as best-ranked candidate; mandatory node priority applied.' : 'Selected as best-ranked candidate by match type, bore, and delta.';
      candidates.slice(1).forEach((candidate) => { candidate.decision = 'REJECTED_BY_RANK'; candidate.reason = 'A higher ranked candidate was selected.'; });
      candidateRows.push(...candidates);
      const selectedNode = nodeCandidates.find((node) => node.occurrenceId === selected.occurrenceId);
      if (selectedNode) selectedNode.selected = true;
      rows.push({ ...selected, finalStatus: selected.matchType === 'APPROX_3' ? 'MATCHED_NO_BORE' : 'MATCHED' });
      logger.user(selected.matchType === 'APPROX_3' ? 'WARNING' : 'INFO', 'Match Accepted', 'Match Result', `${psName} → ${selected.matchingNode}`, `${selected.matchType} selected with max axis delta ${selected.maxAxisDeltaMm.toFixed(3)} mm.`, selected.matchType === 'APPROX_3' ? 'Review coordinate-only match because bore was ignored.' : 'No action required.', selected);
      logger.debug('INFO', 'MATCH_SELECTED', `${psName} matched ${selected.occurrenceId} as ${selected.matchType}.`, selected);
    } catch (error) {
      logger.user('ERROR', 'Parse Failed', 'PS Table', psName || psRow.position, error.message || String(error), 'Correct PS position format: E ...mm S ...mm U/D ...mm.', { psRow });
    }
  }

  const mandatoryCoverageRows = [];
  for (const mandatory of mandatoryNodeRows) {
    const node = PSNM_safeString(mandatory.node);
    if (!node) continue;
    const occurrences = occurrencesByNode.get(node) || [];
    const coveredOccurrences = occurrences.filter((occurrence) => occurrence.selected);
    const status = occurrences.length === 0 ? 'MISSING_FROM_NODE_TABLE' : coveredOccurrences.length > 0 ? 'COVERED' : 'UNCOVERED';
    const row = { node, inNodeTable: occurrences.length > 0, occurrences: occurrences.length, coveredOccurrences: coveredOccurrences.length, status, occurrenceIds: occurrences.map((item) => item.occurrenceId), matchedPsNames: rows.filter((match) => match.matchingNode === node && match.finalStatus?.startsWith('MATCHED')).map((match) => match.psName) };
    mandatoryCoverageRows.push(row);
    if (status === 'MISSING_FROM_NODE_TABLE') logger.user('ERROR', 'Mandatory Node Missing', 'Mandatory Node List', node, 'Node is mandatory but absent from Node XYZ table.', 'Verify exported Node XYZ table or mandatory list.', row);
    else if (status === 'UNCOVERED') logger.user('WARNING', 'Mandatory Node Uncovered', 'Mandatory Node List', node, 'Node exists in Node XYZ table but no PS matched to it.', 'Check whether PS Name is missing, coordinate transform is wrong, or tolerance is too small.', row);
  }
  for (const nodeRow of nodeCandidates) if (!nodeRow.selected && nodeRow.isMandatory !== true) logger.debug('DEBUG', 'UNUSED_NODE', `Node ${nodeRow.occurrenceId} was not selected.`, { node: nodeRow.node, occurrenceId: nodeRow.occurrenceId });

  return { transform, rows, candidateRows, mandatoryCoverageRows, userLog: logger.userLog, debugLog: logger.debugLog };
}
