import {
  PSNM_boreFromOdMm,
  PSNM_parseNodeDiaRows,
  PSNM_parseNodePosition,
  PSNM_parseNodeRows,
  PSNM_transformNodeToPsPosition,
} from './psnm-match-engine.js';
import {
  PSNM_makeMasterNodeRow,
  PSNM_MASTER_STATUS,
} from './psnm-master-types.js';
import { PSNM_logNodeTableLogic } from './psnm-table-logic-log.js';

function PSNM_number(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return NaN;
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function PSNM_optionalNumber(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return null;
  const n = Number(text.replace(/,/g, ''));
  if (Number.isFinite(n)) return n;
  const parsed = PSNM_number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function PSNM_bool(value) {
  return /^(yes|y|true|1|m|mandatory|required|req|must)$/i.test(String(value ?? '').trim());
}

function PSNM_splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((cell) => cell.trim());
  return raw.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function PSNM_normHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function PSNM_occurrenceId(node, index) {
  return `${node}#${String(index).padStart(3, '0')}`;
}

export function PSNM_parseTable4B(text, logger = null) {
  const rows = [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^-{3,}$/.test(line));
  let headers = null;

  for (const [index, line] of lines.entries()) {
    const cells = PSNM_splitCells(line);
    const lowered = cells.map(PSNM_normHeader);
    const looksLikeHeader = index === 0 && lowered.some((cell) => cell === 'node' || cell.includes('mandatory node'));
    if (looksLikeHeader) {
      headers = lowered;
      continue;
    }

    const byHeader = {};
    if (headers) headers.forEach((header, cellIndex) => { byHeader[header] = cells[cellIndex] ?? ''; });

    const node = String(byHeader.node || byHeader['mandatory node no'] || byHeader['mandatory node'] || cells[0] || '').trim();
    if (!node || /^mandatory node/i.test(node)) continue;

    const mandatoryRaw = byHeader.mandatory || byHeader.required || byHeader['is mandatory'] || cells[1] || 'YES';
    const boreOverride = PSNM_number(byHeader.bore || byHeader.dn || byHeader.nb || byHeader['bore override'] || cells[2]);
    const occurrenceId = byHeader.occurrence || byHeader['occurrence id'] || cells[3] || '';
    const remarks = byHeader.remarks || byHeader.remark || byHeader.note || cells[4] || '';

    rows.push({
      node,
      isMandatoryNode: PSNM_bool(mandatoryRaw) || !headers,
      mandatorySource: 'TABLE4B',
      boreOverride: Number.isFinite(boreOverride) ? boreOverride : null,
      occurrenceId: occurrenceId.trim(),
      remarks,
      sourceRow: index + 1,
    });
  }

  if (!rows.length && String(text || '').trim()) {
    logger?.user?.('WARNING', 'Table 4B Empty', 'Table 4B', 'Node override', 'No node mandatory/override rows were parsed.', 'Check Table 4B format. Use either Mandatory Node No list or Node / Mandatory / Bore override.', {});
  }
  return rows;
}

function PSNM_nodeCoordsFromRow(row) {
  if (Number.isFinite(row.rawX) && Number.isFinite(row.rawY) && Number.isFinite(row.rawZ)) {
    return { x: row.rawX, y: row.rawY, z: row.rawZ };
  }
  if (Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z)) {
    return { x: row.x, y: row.y, z: row.z };
  }
  if (row.position) return PSNM_parseNodePosition(row.position);
  return { x: NaN, y: NaN, z: NaN };
}

export function PSNM_applyMasterNodeTransform(masterNodeRows = [], transform, coordinateDecimals = 0) {
  for (const row of masterNodeRows) {
    if (row.enabled === false || row.status === PSNM_MASTER_STATUS.INVALID_COORDINATE || row.status === PSNM_MASTER_STATUS.MISSING_FROM_TABLE2) {
      row.nodeE = null;
      row.nodeU = null;
      row.nodeS = null;
      continue;
    }
    try {
      const ps = PSNM_transformNodeToPsPosition({ x: Number(row.rawX), y: Number(row.rawY), z: Number(row.rawZ) }, transform, coordinateDecimals);
      row.nodeE = ps.e;
      row.nodeU = ps.u;
      row.nodeS = ps.s;
    } catch {
      row.nodeE = null;
      row.nodeU = null;
      row.nodeS = null;
    }
  }
  return masterNodeRows;
}

export function PSNM_recomputeMasterNodeRow(row, transform = null, coordinateDecimals = 0) {
  row.node = String(row.node ?? '').trim();
  if (Number(row.occurrenceIndex) > 0 && row.node) row.occurrenceId = PSNM_occurrenceId(row.node, Number(row.occurrenceIndex));
  row.rawX = PSNM_optionalNumber(row.rawX);
  row.rawY = PSNM_optionalNumber(row.rawY);
  row.rawZ = PSNM_optionalNumber(row.rawZ);
  row.finalNodeBore = PSNM_optionalNumber(row.finalNodeBore);
  row.isTerminal = row.node === '-1';

  if (row.enabled === false) row.status = PSNM_MASTER_STATUS.DISABLED;
  else if (!row.node || !Number.isFinite(row.rawX) || !Number.isFinite(row.rawY) || !Number.isFinite(row.rawZ)) row.status = PSNM_MASTER_STATUS.INVALID_COORDINATE;
  else if (row.boreConflict) row.status = PSNM_MASTER_STATUS.BORE_CONFLICT;
  else if (row.finalNodeBore == null) row.status = PSNM_MASTER_STATUS.MISSING_BORE;
  else row.status = PSNM_MASTER_STATUS.OK;

  if (transform) PSNM_applyMasterNodeTransform([row], transform, coordinateDecimals);
  return row;
}

export function PSNM_resolveMasterNodeTable({ table2Text, table3Text, table4BText, logger = null }) {
  const table2Rows = PSNM_parseNodeRows(table2Text, logger);
  const table3Rows = PSNM_parseNodeDiaRows(table3Text, logger);
  const table4BRows = PSNM_parseTable4B(table4BText, logger);
  PSNM_logNodeTableLogic({ logger, table2Text, table2Rows, table3Text, table3Rows, table4BText, table4BRows });

  const odByNode = new Map();
  for (const dia of table3Rows) {
    const node = String(dia.node);
    if (!odByNode.has(node)) odByNode.set(node, dia.odMm);
    else if (Math.abs(odByNode.get(node) - dia.odMm) > 1e-9) {
      logger?.user?.('WARNING', 'Duplicate Node Dia', 'Table 3', node, 'Conflicting Node Dia values found. First value kept.', 'Clean Table 3 duplicate dia rows.', { node, first: odByNode.get(node), duplicate: dia.odMm });
    }
  }

  const overridesByNode = new Map();
  for (const item of table4BRows) {
    if (!overridesByNode.has(item.node)) overridesByNode.set(item.node, []);
    overridesByNode.get(item.node).push(item);
  }

  const occurrenceCounter = new Map();
  const masterRows = [];

  for (const sourceRow of table2Rows) {
    const node = String(sourceRow.node);
    const occurrenceIndex = (occurrenceCounter.get(node) || 0) + 1;
    occurrenceCounter.set(node, occurrenceIndex);
    const occurrenceId = PSNM_occurrenceId(node, occurrenceIndex);
    let coords = { x: NaN, y: NaN, z: NaN };
    try { coords = PSNM_nodeCoordsFromRow(sourceRow); } catch {}

    const table2Bore = Number.isFinite(sourceRow.directBoreMm) ? sourceRow.directBoreMm : null;
    const table3Od = odByNode.get(node) ?? null;
    const table3DerivedBore = table3Od == null ? null : PSNM_boreFromOdMm(table3Od);
    const overrides = overridesByNode.get(node) || [];
    const occurrenceOverride = overrides.find((item) => item.occurrenceId === occurrenceId) || overrides.find((item) => !item.occurrenceId);

    let finalNodeBore = null;
    let boreSource = 'MISSING';
    let boreConflict = false;

    if (occurrenceOverride?.boreOverride != null) {
      finalNodeBore = occurrenceOverride.boreOverride;
      boreSource = 'TABLE4B_OVERRIDE';
      boreConflict = (table2Bore != null && Math.abs(table2Bore - finalNodeBore) > 1e-9) || (table3DerivedBore != null && Math.abs(table3DerivedBore - finalNodeBore) > 1e-9);
    } else if (table2Bore != null) {
      finalNodeBore = table2Bore;
      boreSource = 'TABLE2_BORE';
      boreConflict = table3DerivedBore != null && Math.abs(table3DerivedBore - table2Bore) > 1e-9;
      if (boreConflict) boreSource = 'TABLE2_BORE_CONFLICT_PRIMARY';
    } else if (table3DerivedBore != null) {
      finalNodeBore = table3DerivedBore;
      boreSource = 'TABLE3_OD_MAP';
    }

    const mandatorySources = [];
    if (sourceRow.isMandatoryNode) mandatorySources.push('TABLE2');
    if (occurrenceOverride?.isMandatoryNode) mandatorySources.push('TABLE4B');

    const master = PSNM_makeMasterNodeRow({
      node,
      occurrenceIndex,
      occurrenceId,
      rawX: coords.x,
      rawY: coords.y,
      rawZ: coords.z,
      table2Bore,
      table3Od,
      table3DerivedBore,
      finalNodeBore,
      boreSource,
      boreConflict,
      isMandatoryNode: mandatorySources.length > 0,
      mandatorySource: mandatorySources.join(';'),
      isTerminal: node === '-1',
      sourceTable: occurrenceOverride ? 'TABLE2;TABLE4B' : 'TABLE2',
      sourceRow: sourceRow.rowIndex,
      remarks: occurrenceOverride?.remarks || '',
    });
    PSNM_recomputeMasterNodeRow(master);
    masterRows.push(master);
  }

  for (const override of table4BRows) {
    const existing = masterRows.some((row) => row.node === override.node && (!override.occurrenceId || row.occurrenceId === override.occurrenceId));
    if (existing) continue;
    const missing = PSNM_makeMasterNodeRow({
      node: override.node,
      occurrenceIndex: 0,
      occurrenceId: override.occurrenceId || `${override.node}#000`,
      finalNodeBore: override.boreOverride,
      boreSource: override.boreOverride != null ? 'TABLE4B_OVERRIDE' : 'MISSING',
      isMandatoryNode: override.isMandatoryNode === true,
      mandatorySource: override.isMandatoryNode ? 'TABLE4B' : '',
      sourceTable: 'TABLE4B',
      sourceRow: override.sourceRow,
      status: PSNM_MASTER_STATUS.MISSING_FROM_TABLE2,
      remarks: override.remarks || 'Listed in Table 4B but absent from Table 2.',
    });
    masterRows.push(missing);
    logger?.user?.('WARNING', 'Mandatory Node Missing', 'Table 4B', override.node, 'Node is mandatory/overridden in Table 4B but absent from Table 2.', 'Add this Node to Table 2 or remove it from Table 4B.', { node: override.node, occurrenceId: override.occurrenceId });
  }

  return {
    rows: masterRows,
    table2Rows,
    table3Rows,
    table4BRows,
    issues: masterRows.filter((row) => row.status !== PSNM_MASTER_STATUS.OK),
  };
}
