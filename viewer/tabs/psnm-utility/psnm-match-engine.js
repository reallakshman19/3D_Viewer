import { PIPE_OD_TO_DN } from '../../pcf-legacy/services/bore-converter.js';

const PSNM_DEFAULT_COORD_DECIMALS = 2;
const PSNM_EXACT_EPS_MM = 0.01;
const PSNM_EPS = 1e-9;
const PSNM_TIE_EPS_MM = 1e-6;
const PSNM_TRUE_VALUES = new Set(['yes', 'y', 'true', '1', 'm', 'mandatory', 'required', 'req', 'must']);

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
function PSNM_assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`[PSNM] Invalid numeric value for ${label}: ${value}`);
}
function PSNM_psKey(psCoord, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  return [
    PSNM_roundCoord(psCoord.e, decimals).toFixed(decimals),
    PSNM_roundCoord(psCoord.u, decimals).toFixed(decimals),
    PSNM_roundCoord(psCoord.s, decimals).toFixed(decimals),
  ].join('|');
}
function PSNM_nodeKey(nodeCoord, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  return [
    PSNM_roundCoord(nodeCoord.x, decimals).toFixed(decimals),
    PSNM_roundCoord(nodeCoord.y, decimals).toFixed(decimals),
    PSNM_roundCoord(nodeCoord.z, decimals).toFixed(decimals),
  ].join('|');
}
function PSNM_bool(value) {
  const text = PSNM_safeString(value).toLowerCase();
  return PSNM_TRUE_VALUES.has(text);
}
function PSNM_normalizeBoreMode(value) {
  const mode = PSNM_safeString(value).toLowerCase().replace(/[\s_-]+/g, '_');
  if (mode === 'strict' || mode === 'strict_bore') return 'strict';
  if (mode === 'ignore' || mode === 'ignore_bore' || mode === 'coordinate_only' || mode === 'coord_only') return 'ignore';
  return 'prefer';
}
function PSNM_firstFiniteNumber(...values) {
  for (const value of values) {
    const n = PSNM_number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}
function PSNM_directBoreFromRow(row) {
  return PSNM_firstFiniteNumber(row.bore, row.nb, row.dn, row['bore mm'], row['bore(mm)'], row['nominal bore'], row['p1bore'], row.p1bore);
}
function PSNM_mandatoryFromRow(row) {
  return PSNM_bool(row.mandatory || row.required || row['is mandatory'] || row['must match'] || row.req || row.mand || row.m);
}

export function PSNM_roundUp1(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.ceil((n - PSNM_EPS) * 10) / 10 : null;
}
const PSNM_OD_TO_BORE = new Map(PIPE_OD_TO_DN.map((row) => [PSNM_roundUp1(row.od).toFixed(1), row.dn]));
export function PSNM_boreFromOdMm(odMm) {
  const rounded = PSNM_roundUp1(odMm);
  return rounded == null ? null : (PSNM_OD_TO_BORE.get(rounded.toFixed(1)) ?? null);
}

export function PSNM_createRunLogger() {
  const userLog = [];
  const debugLog = [];
  let sequence = 0;
  function debug(level, code, message, data = {}) {
    debugLog.push({
      sequence: ++sequence,
      timestamp: new Date().toISOString(),
      level: String(level || 'INFO').toUpperCase(),
      code: String(code || 'TRACE'),
      message: String(message || ''),
      data,
    });
  }
  function user(level, category, source, item, reason, suggestedAction, data = {}) {
    const entry = {
      level: String(level || 'INFO').toUpperCase(),
      category: String(category || ''),
      source: String(source || ''),
      item: String(item || ''),
      reason: String(reason || ''),
      suggestedAction: String(suggestedAction || ''),
      data,
    };
    userLog.push(entry);
    debug(entry.level, `USER_${entry.category.toUpperCase().replace(/\s+/g, '_')}`, entry.reason, {
      source: entry.source,
      item: entry.item,
      suggestedAction: entry.suggestedAction,
      ...data,
    });
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
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) {
    throw new Error(`[PSNM] Invalid transformed node position: ${positionText}`);
  }
  return { x: parts[0], y: parts[1], z: parts[2] };
}
export function PSNM_deriveTransformFromAnchor(anchor) {
  const ps = PSNM_parsePsPosition(anchor.psPosition);
  const node = PSNM_parseNodePosition(anchor.nodePosition);
  return {
    datumE: ps.e - node.x,
    datumU: ps.u - node.y,
    datumS: ps.s - node.z,
    formula: {
      nodeToPs: 'E=X+datumE, U=Y+datumU, S=Z+datumS',
      psToNode: 'X=E-datumE, Y=U-datumU, Z=S-datumS',
    },
  };
}
export function PSNM_transformPsPosition(positionText, transform, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  const ps = PSNM_parsePsPosition(positionText);
  return {
    x: PSNM_roundCoord(ps.e - transform.datumE, decimals),
    y: PSNM_roundCoord(ps.u - transform.datumU, decimals),
    z: PSNM_roundCoord(ps.s - transform.datumS, decimals),
  };
}
export function PSNM_transformNodeToPsPosition(nodeCoord, transform, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  return {
    e: PSNM_roundCoord(nodeCoord.x + transform.datumE, decimals),
    u: PSNM_roundCoord(nodeCoord.y + transform.datumU, decimals),
    s: PSNM_roundCoord(nodeCoord.z + transform.datumS, decimals),
  };
}

function PSNM_normalizeHeader(header) {
  return PSNM_safeString(header).toLowerCase().replace(/\s+/g, ' ').replace(/[_.-]+/g, ' ').trim();
}
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
    const p1bore = PSNM_number(row.p1bore || row.bore || row.nb || row.dn || row['bore mm'] || row['bore(mm)']);
    const isMandatoryPs = PSNM_mandatoryFromRow(row);
    if (!psName || !position) {
      logger?.user?.('ERROR', 'Parse Failed', 'PS Table', row.__raw, 'PS row must contain PS NAME and Position.', 'Paste PS table with columns: PS NAME, Position, p1bore.', { row });
      continue;
    }
    parsed.push({ psName: PSNM_safeString(psName).replace(/\.$/, ''), position: PSNM_safeString(position), p1bore, isMandatoryPs, mandatorySource: isMandatoryPs ? 'PS_TABLE' : '', rowIndex: row.__rowIndex });
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
    const directBoreMm = PSNM_directBoreFromRow(row);
    const hasDirectBore = Number.isFinite(directBoreMm);
    const isMandatoryNode = PSNM_mandatoryFromRow(row);
    if (!node) {
      logger?.user?.('ERROR', 'Parse Failed', 'Node XYZ Table', row.__raw, 'Node row must contain Node.', 'Paste Node table with columns: Node, X, Y, Z.', { row });
      continue;
    }
    const base = { node: PSNM_safeString(node), directBoreMm: hasDirectBore ? directBoreMm : null, isMandatoryNode, rowMandatorySource: isMandatoryNode ? 'NODE_TABLE' : '', rowIndex: row.__rowIndex };
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      parsed.push({ ...base, x, y, z, position: `${x}, ${y}, ${z}` });
    } else if (position) {
      parsed.push({ ...base, position: PSNM_safeString(position) });
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
    if (!node || !Number.isFinite(odMm)) {
      logger?.user?.('ERROR', 'Parse Failed', 'Node Dia Table', row.__raw, 'Node dia row must contain Node and Dia(mm).', 'Paste Node Dia table with columns: Node, Dia(mm).', { row });
      continue;
    }
    parsed.push({ node: PSNM_safeString(node), odMm, rowIndex: row.__rowIndex });
  }
  return parsed;
}
export function PSNM_parseMandatoryNodeRows(text, logger = null) {
  const nodes = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  for (const line of lines) {
    if (/mandatory|node/i.test(line) && !/-?\d+/.test(line)) continue;
    const match = line.match(/-?\d+/);
    if (!match) continue;
    const node = match[0];
    if (seen.has(node)) {
      logger?.user?.('WARNING', 'Duplicate Mandatory Node', 'Mandatory Node List', node, 'Mandatory node appears more than once.', 'Remove duplicate entry from mandatory node list.', { line });
      continue;
    }
    seen.add(node);
    nodes.push({ node, rowIndex: nodes.length + 1, mandatorySource: 'MANDATORY_NODE_LIST' });
  }
  return nodes;
}

function PSNM_distancePs(a, b) {
  const dx = Math.abs(a.e - b.e);
  const dy = Math.abs(a.u - b.u);
  const dz = Math.abs(a.s - b.s);
  return { dx, dy, dz, maxAxisDeltaMm: Math.max(dx, dy, dz), euclideanDeltaMm: Math.sqrt(dx * dx + dy * dy + dz * dz) };
}
function PSNM_within(delta, tolerance) { return delta.dx <= tolerance.xMm && delta.dy <= tolerance.yMm && delta.dz <= tolerance.zMm; }
function PSNM_classifyCoordinate({ psKey, nodePsKey, delta, cfg }) {
  if (psKey === nodePsKey && delta.maxAxisDeltaMm <= PSNM_EXACT_EPS_MM) return 'EXACT';
  if (cfg.enableApprox1 && PSNM_within(delta, cfg.approx1)) return 'APPROX_1';
  if (cfg.enableApprox2 && PSNM_within(delta, cfg.approx2)) return 'APPROX_2';
  if (cfg.enableApprox3 && PSNM_within(delta, cfg.approx3)) return 'APPROX_3';
  return 'NO_MATCH';
}
function PSNM_coordMatchType(type) {
  return type === 'NO_MATCH' ? 'NO_MATCH' : `COORD_${type}`;
}
function PSNM_boreStatus({ boreMode, boreMatch, psBore, nodeBoreMm, boreConflict }) {
  const missing = !Number.isFinite(psBore) || nodeBoreMm == null;
  if (boreMode === 'ignore') {
    if (boreConflict) return 'CONFLICT_IGNORED';
    if (missing) return 'MISSING_IGNORED';
    return 'NOT_CHECKED';
  }
  if (boreMatch) return 'PASS';
  if (boreConflict) return 'CONFLICT';
  if (missing) return 'MISSING';
  return 'FAIL';
}
function PSNM_effectiveMatchType(coordType, boreStatus, boreMode) {
  if (coordType === 'NO_MATCH') return 'NO_MATCH';
  if (boreMode === 'strict') return boreStatus === 'PASS' ? coordType : 'NO_MATCH';
  if (boreMode === 'ignore') return PSNM_coordMatchType(coordType);
  return boreStatus === 'PASS' ? coordType : PSNM_coordMatchType(coordType);
}
function PSNM_rankMatchType(type) {
  if (type === 'EXACT' || type === 'COORD_EXACT') return 1;
  if (type === 'APPROX_1' || type === 'COORD_APPROX_1') return 2;
  if (type === 'APPROX_2' || type === 'COORD_APPROX_2') return 3;
  if (type === 'APPROX_3' || type === 'COORD_APPROX_3') return 4;
  return 99;
}
function PSNM_boreRank(status) {
  if (status === 'PASS') return 0;
  if (status === 'NOT_CHECKED' || status === 'MISSING_IGNORED' || status === 'CONFLICT_IGNORED') return 1;
  if (status === 'MISSING') return 2;
  if (status === 'CONFLICT') return 3;
  return 4;
}
function PSNM_mandatoryPairRank(candidate) {
  if (candidate.isMandatoryPs && candidate.isMandatoryNode) return 0;
  if (candidate.isMandatoryPs && !candidate.isMandatoryNode) return 1;
  if (!candidate.isMandatoryPs && candidate.isMandatoryNode) return 2;
  return 3;
}
function PSNM_candidateCompare(a, b) {
  return PSNM_rankMatchType(a.matchType) - PSNM_rankMatchType(b.matchType)
    || PSNM_mandatoryPairRank(a) - PSNM_mandatoryPairRank(b)
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
    && PSNM_mandatoryPairRank(a) === PSNM_mandatoryPairRank(b)
    && a.boreStatus === b.boreStatus
    && a.isTerminal === b.isTerminal
    && Math.abs(a.maxAxisDeltaMm - b.maxAxisDeltaMm) <= PSNM_TIE_EPS_MM
    && Math.abs(a.euclideanDeltaMm - b.euclideanDeltaMm) <= PSNM_TIE_EPS_MM;
}
function PSNM_makeOccurrenceId(node, count) { return `${node}#${String(count).padStart(3, '0')}`; }
function PSNM_finalStatus(selected, boreMode) {
  if (boreMode === 'ignore') return 'MATCHED_COORD_ONLY';
  if (selected.boreStatus !== 'PASS') return 'MATCHED_WITH_WARNING';
  return selected.matchType?.startsWith('COORD_') ? 'MATCHED_COORD_ONLY' : 'MATCHED';
}
function PSNM_nodeBoreModel({ row, node, odMm, roundedOdMm, odDerivedBoreMm, logger }) {
  const directBoreMm = Number.isFinite(row.directBoreMm) ? row.directBoreMm : null;
  const hasDirect = directBoreMm != null;
  const hasDerived = odDerivedBoreMm != null;
  const conflict = hasDirect && hasDerived && Math.abs(directBoreMm - odDerivedBoreMm) > 1e-6;
  let nodeBoreMm = null;
  let nodeBoreSource = 'MISSING';
  if (hasDirect) {
    nodeBoreMm = directBoreMm;
    nodeBoreSource = conflict ? 'TABLE2_BORE_CONFLICT_PRIMARY' : 'TABLE2_BORE';
    logger.debug('INFO', 'DIRECT_BORE_USED', `Node ${node} direct Table 2 bore used.`, { node, directBoreMm, odMm, roundedOdMm, odDerivedBoreMm, conflict });
    if (conflict) logger.user('WARNING', 'Bore Conflict', 'Node XYZ + Node Dia', node, `Table 2 bore ${directBoreMm} differs from OD-derived bore ${odDerivedBoreMm}.`, 'Table 2 direct bore is used as primary; verify Node Dia table.', { node, directBoreMm, odMm, odDerivedBoreMm });
  } else if (hasDerived) {
    nodeBoreMm = odDerivedBoreMm;
    nodeBoreSource = 'NODE_DIA_OD_MAP';
  }
  return { directBoreMm, odDerivedBoreMm, nodeBoreMm, nodeBoreSource, boreConflict: conflict };
}

export function PSNM_buildMatchTable(options) {
  const logger = options.logger || PSNM_createRunLogger();
  const coordinateDecimals = Number(options.coordinateDecimals ?? PSNM_DEFAULT_COORD_DECIMALS);
  const boreMode = PSNM_normalizeBoreMode(options.boreMode);
  const cfg = {
    enableApprox1: options.enableApprox1 !== false,
    enableApprox2: options.enableApprox2 !== false,
    enableApprox3: options.enableApprox3 !== false,
    approx1: options.approx1 || { xMm: 25, yMm: 25, zMm: 25 },
    approx2: options.approx2 || { xMm: 50, yMm: 25, zMm: 50 },
    approx3: options.approx3 || options.approx2 || { xMm: 50, yMm: 25, zMm: 50 },
  };
  const psRows = options.psRows || [];
  const nodeRows = options.nodeRows || [];
  const nodeDiaRows = options.nodeDiaRows || [];
  const mandatoryNodeRows = options.mandatoryNodeRows || [];
  const mandatorySet = new Set(mandatoryNodeRows.map((row) => PSNM_safeString(row.node)).filter(Boolean));
  logger.debug('INFO', 'INIT', 'PSNM run started.', { psRows: psRows.length, nodeRows: nodeRows.length, nodeDiaRows: nodeDiaRows.length, mandatoryNodes: mandatorySet.size, coordinateDecimals, boreMode, cfg });

  const transform = PSNM_deriveTransformFromAnchor(options.anchor);
  logger.debug('INFO', 'BASE_TRANSFORM', 'Derived base transform. Every Table 2 Node XYZ row is transformed to PS E/U/S before matching.', { anchor: options.anchor, transform });

  const diaByNode = new Map();
  for (const row of nodeDiaRows) {
    const node = PSNM_safeString(row.node);
    const od = Number(row.odMm);
    if (!node || !Number.isFinite(od)) continue;
    const previous = diaByNode.get(node);
    if (previous != null && Math.abs(previous - od) > 1e-6) {
      logger.user('ERROR', 'Duplicate Node Dia', 'Node Dia Table', node, `Same node has conflicting OD values: ${previous} and ${od}.`, 'Clean duplicate node diameter table before matching.', { previousOdMm: previous, newOdMm: od });
      continue;
    }
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
      const nodeXyz = Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z) ? { x: row.x, y: row.y, z: row.z } : PSNM_parseNodePosition(row.position);
      const nodePs = PSNM_transformNodeToPsPosition(nodeXyz, transform, coordinateDecimals);
      const odMm = diaByNode.get(node) ?? null;
      const roundedOdMm = odMm == null ? null : PSNM_roundUp1(odMm);
      const odDerivedBoreMm = odMm == null ? null : PSNM_boreFromOdMm(odMm);
      const boreModel = PSNM_nodeBoreModel({ row, node, odMm, roundedOdMm, odDerivedBoreMm, logger });
      const nodeMandatorySources = [];
      if (row.isMandatoryNode) nodeMandatorySources.push('NODE_TABLE');
      if (mandatorySet.has(node)) nodeMandatorySources.push('MANDATORY_NODE_LIST');
      const isMandatoryNode = nodeMandatorySources.length > 0;
      const nodeEntry = {
        node,
        occurrenceId: PSNM_makeOccurrenceId(node, count),
        rowIndex: row.rowIndex ?? count,
        coord: nodeXyz,
        nodePs,
        nodeKey: PSNM_nodeKey(nodeXyz, coordinateDecimals),
        nodePsKey: PSNM_psKey(nodePs, coordinateDecimals),
        odMm,
        roundedOdMm,
        boreMm: boreModel.nodeBoreMm,
        nodeBoreMm: boreModel.nodeBoreMm,
        directBoreMm: boreModel.directBoreMm,
        odDerivedBoreMm: boreModel.odDerivedBoreMm,
        nodeBoreSource: boreModel.nodeBoreSource,
        boreConflict: boreModel.boreConflict,
        isMandatory: isMandatoryNode,
        isMandatoryNode,
        mandatorySource: nodeMandatorySources.join(';'),
        isTerminal: node === '-1',
        selected: false,
      };
      nodeCandidates.push(nodeEntry);
      if (!occurrencesByNode.has(node)) occurrencesByNode.set(node, []);
      occurrencesByNode.get(node).push(nodeEntry);
      logger.debug('INFO', 'NODE_BASE_TRANSFORMED', `Node ${nodeEntry.occurrenceId} transformed from XYZ to PS E/U/S.`, nodeEntry);
      if (count > 1) logger.user('INFO', 'Duplicate Node Occurrence', 'Node XYZ Table', node, 'Same node number appears multiple times and was kept as separate occurrences.', 'Review occurrence in Candidate Resolver if this node is selected.', { node, occurrenceId: nodeEntry.occurrenceId });
      if (boreModel.nodeBoreMm == null) logger.user('WARNING', 'Missing Node Bore', 'Node XYZ / Node Dia Table', node, 'Node has no direct bore and no OD-derived bore.', 'Use Prefer/Ignore Bore mode if coordinate-only recovery is acceptable.', { node, occurrenceId: nodeEntry.occurrenceId });
      else logger.debug('INFO', 'NODE_BORE_MODEL', `Node ${nodeEntry.occurrenceId} bore normalized.`, { node, occurrenceId: nodeEntry.occurrenceId, ...boreModel });
    } catch (error) {
      logger.user('ERROR', 'Parse Failed', 'Node XYZ Table', row.node || row.position, error.message || String(error), 'Correct node coordinate format: Node, X, Y, Z.', { row });
    }
  }

  const rows = [];
  const candidateRows = [];
  for (const psRow of psRows) {
    const psName = PSNM_safeString(psRow.psName).replace(/\.$/, '');
    try {
      const psCoord = PSNM_parsePsPosition(psRow.position);
      const psRounded = { e: PSNM_roundCoord(psCoord.e, coordinateDecimals), u: PSNM_roundCoord(psCoord.u, coordinateDecimals), s: PSNM_roundCoord(psCoord.s, coordinateDecimals) };
      const psNodeSpace = PSNM_transformPsPosition(psRow.position, transform, coordinateDecimals);
      const psKey = PSNM_psKey(psRounded, coordinateDecimals);
      const psBore = Number(psRow.p1bore);
      const isMandatoryPs = psRow.isMandatoryPs === true;
      const candidates = [];
      logger.debug('INFO', 'PS_PARSED', `${psName} parsed. Matching will compare PS E/U/S against every base-transformed Node E/U/S.`, { psName, sourcePosition: psRow.position, psCoord: psRounded, psNodeSpace, psKey, psBore, isMandatoryPs, boreMode });

      for (const nodeRow of nodeCandidates) {
        const delta = PSNM_distancePs(psRounded, nodeRow.nodePs);
        const coordType = PSNM_classifyCoordinate({ psKey, nodePsKey: nodeRow.nodePsKey, delta, cfg });
        const boreMatch = Number.isFinite(psBore) && nodeRow.nodeBoreMm != null && Math.abs(psBore - nodeRow.nodeBoreMm) <= 1e-6;
        const boreStatus = PSNM_boreStatus({ boreMode, boreMatch, psBore, nodeBoreMm: nodeRow.nodeBoreMm, boreConflict: nodeRow.boreConflict });
        const matchType = PSNM_effectiveMatchType(coordType, boreStatus, boreMode);
        const candidate = {
          psName,
          position: psRow.position,
          isMandatoryPs,
          psMandatorySource: isMandatoryPs ? (psRow.mandatorySource || 'PS_TABLE') : '',
          psE: psRounded.e,
          psU: psRounded.u,
          psS: psRounded.s,
          transformedX: psNodeSpace.x,
          transformedY: psNodeSpace.y,
          transformedZ: psNodeSpace.z,
          matchingNode: nodeRow.node,
          occurrenceId: nodeRow.occurrenceId,
          isMandatory: nodeRow.isMandatoryNode,
          isMandatoryNode: nodeRow.isMandatoryNode,
          nodeMandatorySource: nodeRow.mandatorySource,
          mandatoryPairRank: null,
          isTerminal: nodeRow.isTerminal,
          rowIndex: nodeRow.rowIndex,
          nodeX: nodeRow.coord.x,
          nodeY: nodeRow.coord.y,
          nodeZ: nodeRow.coord.z,
          nodeE: nodeRow.nodePs.e,
          nodeU: nodeRow.nodePs.u,
          nodeS: nodeRow.nodePs.s,
          coordMatchType: coordType,
          matchType,
          boreMode,
          psBore: Number.isFinite(psBore) ? psBore : null,
          nodeOdMm: nodeRow.odMm,
          nodeRoundedOdMm: nodeRow.roundedOdMm,
          nodeBoreMm: nodeRow.nodeBoreMm,
          directBoreMm: nodeRow.directBoreMm,
          odDerivedBoreMm: nodeRow.odDerivedBoreMm,
          nodeBoreSource: nodeRow.nodeBoreSource,
          boreConflict: nodeRow.boreConflict,
          boreStatus,
          dxMm: delta.dx,
          dyMm: delta.dy,
          dzMm: delta.dz,
          maxAxisDeltaMm: delta.maxAxisDeltaMm,
          euclideanDeltaMm: delta.euclideanDeltaMm,
          decision: 'REJECTED_NO_MATCH',
          reason: coordType === 'NO_MATCH' ? 'Outside enabled coordinate tolerance.' : 'Rejected by bore policy or ranking.',
        };
        candidate.mandatoryPairRank = PSNM_mandatoryPairRank(candidate);
        logger.debug(matchType === 'NO_MATCH' ? 'DEBUG' : 'INFO', matchType === 'NO_MATCH' ? 'CANDIDATE_REJECTED' : 'CANDIDATE_ACCEPTED', `Candidate ${nodeRow.occurrenceId} evaluated for ${psName} after node base transform.`, candidate);
        if (matchType !== 'NO_MATCH') candidates.push(candidate);
      }
      candidates.sort(PSNM_candidateCompare);
      if (!candidates.length) {
        logger.user(isMandatoryPs ? 'WARNING' : 'INFO', isMandatoryPs ? 'Mandatory PS Unmapped' : 'Optional PS Unmapped', 'PS Table', psName, 'No base-transformed Node XYZ row found within enabled tolerance and bore policy.', 'Check base anchor, bore mode, load full Node XYZ table, or increase Approx tolerance.', { psName, psCoord: psRounded, psBore, isMandatoryPs, boreMode });
        rows.push({ psName, position: psRow.position, isMandatoryPs, psMandatorySource: psRow.mandatorySource || '', psE: psRounded.e, psU: psRounded.u, psS: psRounded.s, transformedX: psNodeSpace.x, transformedY: psNodeSpace.y, transformedZ: psNodeSpace.z, matchingNode: '', occurrenceId: '', isMandatory: false, isMandatoryNode: false, matchType: 'NO_MATCH', coordMatchType: 'NO_MATCH', finalStatus: 'UNMAPPED', boreMode, psBore: Number.isFinite(psBore) ? psBore : null, nodeOdMm: null, nodeRoundedOdMm: null, nodeBoreMm: null, nodeBoreSource: 'MISSING', boreConflict: false, boreStatus: 'N/A', dxMm: null, dyMm: null, dzMm: null, maxAxisDeltaMm: null, euclideanDeltaMm: null });
        continue;
      }
      const top = candidates[0];
      const ambiguous = candidates.length > 1 && PSNM_isAmbiguousTie(candidates[0], candidates[1]);
      if (ambiguous) {
        const tied = candidates.filter((candidate) => PSNM_isAmbiguousTie(top, candidate));
        tied.forEach((candidate) => { candidate.decision = 'AMBIGUOUS'; candidate.reason = 'Equivalent top-ranked candidate. Manual review required.'; candidateRows.push(candidate); });
        candidates.filter((candidate) => !tied.includes(candidate)).forEach((candidate) => { candidate.decision = 'REJECTED_BY_RANK'; candidate.reason = 'Lower ranked than ambiguous top candidate set.'; candidateRows.push(candidate); });
        logger.user('WARNING', 'Ambiguous Match', 'PS Table', psName, 'Multiple equivalent base-transformed candidate nodes found for the same PS coordinate.', 'Use Candidate Resolver and add a manual override if needed.', { psName, tiedCandidates: tied.map((c) => ({ node: c.matchingNode, occurrenceId: c.occurrenceId })), boreMode });
        rows.push({ ...top, matchingNode: '', occurrenceId: '', matchType: 'AMBIGUOUS', finalStatus: 'USER_REVIEW_REQUIRED', candidateCount: tied.length });
        continue;
      }
      const selected = top;
      selected.decision = 'SELECTED';
      selected.reason = selected.isMandatoryPs && selected.isMandatoryNode ? 'Selected as best-ranked mandatory PS to mandatory Node candidate.' : selected.isMandatoryNode ? 'Selected as best-ranked candidate; mandatory node priority applied.' : 'Selected as best-ranked candidate by coordinate, mandatory pairing, bore policy, and delta.';
      candidates.slice(1).forEach((candidate) => { candidate.decision = 'REJECTED_BY_RANK'; candidate.reason = 'A higher ranked candidate was selected.'; });
      candidateRows.push(...candidates);
      const selectedNode = nodeCandidates.find((node) => node.occurrenceId === selected.occurrenceId);
      if (selectedNode) selectedNode.selected = true;
      const finalStatus = PSNM_finalStatus(selected, boreMode);
      rows.push({ ...selected, finalStatus });
      if (boreMode === 'ignore') logger.user('WARNING', 'Coordinate Only Match', 'Match Result', `${psName} → ${selected.matchingNode}`, 'Bore was ignored by user-selected mode.', 'Use Strict Bore for engineering-certified output.', selected);
      else if (selected.boreStatus !== 'PASS') logger.user('WARNING', 'Bore Not Verified', 'Match Result', `${psName} → ${selected.matchingNode}`, `Coordinate match accepted with bore status ${selected.boreStatus}.`, 'Review bore source/conflict before final export.', selected);
      else logger.user('INFO', 'Match Accepted', 'Match Result', `${psName} → ${selected.matchingNode}`, `${selected.matchType} selected with max axis delta ${selected.maxAxisDeltaMm.toFixed(3)} mm.`, 'No action required.', selected);
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
    const row = { node, mandatorySource: 'MANDATORY_NODE_LIST', inNodeTable: occurrences.length > 0, occurrences: occurrences.length, coveredOccurrences: coveredOccurrences.length, status, occurrenceIds: occurrences.map((item) => item.occurrenceId), matchedPsNames: rows.filter((match) => match.matchingNode === node && match.finalStatus?.startsWith('MATCHED')).map((match) => match.psName) };
    mandatoryCoverageRows.push(row);
    if (status === 'MISSING_FROM_NODE_TABLE') logger.user('ERROR', 'Mandatory Node Missing', 'Mandatory Node List', node, 'Node is mandatory but absent from Node XYZ table.', 'Verify exported Node XYZ table or mandatory list.', row);
    else if (status === 'UNCOVERED') logger.user('WARNING', 'Mandatory Node Uncovered', 'Mandatory Node List', node, 'Node exists in Node XYZ table but no PS matched to it after base transform.', 'Check whether PS Name is missing, base anchor is wrong, or tolerance is too small.', row);
  }
  for (const nodeRow of nodeCandidates) {
    if (!nodeRow.selected && nodeRow.isMandatoryNode === true && !mandatorySet.has(nodeRow.node)) {
      mandatoryCoverageRows.push({ node: nodeRow.node, mandatorySource: nodeRow.mandatorySource || 'NODE_TABLE', inNodeTable: true, occurrences: 1, coveredOccurrences: 0, status: 'UNCOVERED', occurrenceIds: [nodeRow.occurrenceId], matchedPsNames: [] });
      logger.user('WARNING', 'Mandatory Node Uncovered', 'Node XYZ Table', nodeRow.node, 'Node row is mandatory but no PS matched to this occurrence.', 'Check PS table, base anchor, tolerance, or bore mode.', { node: nodeRow.node, occurrenceId: nodeRow.occurrenceId });
    } else if (!nodeRow.selected && nodeRow.isMandatoryNode !== true) {
      logger.debug('DEBUG', 'UNUSED_NODE', `Node ${nodeRow.occurrenceId} was not selected.`, { node: nodeRow.node, occurrenceId: nodeRow.occurrenceId, nodePs: nodeRow.nodePs });
    }
  }

  const mandatoryPsCoverageRows = psRows.filter((psRow) => psRow.isMandatoryPs === true).map((psRow) => {
    const match = rows.find((row) => row.psName === psRow.psName);
    const status = !match || match.finalStatus === 'UNMAPPED' ? 'UNMAPPED' : match.finalStatus === 'USER_REVIEW_REQUIRED' ? 'AMBIGUOUS' : 'COVERED';
    const row = { psName: psRow.psName, mandatorySource: psRow.mandatorySource || 'PS_TABLE', matchedNode: match?.matchingNode || '', occurrenceId: match?.occurrenceId || '', nodeMandatory: match?.isMandatoryNode === true, status };
    if (status === 'UNMAPPED') logger.user('WARNING', 'Mandatory PS Unmapped', 'PS Table', psRow.psName, 'Mandatory PS did not map to any node.', 'Check coordinates, bore mode, and node table coverage.', row);
    else if (status === 'AMBIGUOUS') logger.user('WARNING', 'Mandatory PS Ambiguous', 'PS Table', psRow.psName, 'Mandatory PS has ambiguous candidate nodes.', 'Resolve manually in Candidate Resolver.', row);
    return row;
  });

  return { transform, boreMode, rows, candidateRows, mandatoryCoverageRows, mandatoryPsCoverageRows, userLog: logger.userLog, debugLog: logger.debugLog };
}
