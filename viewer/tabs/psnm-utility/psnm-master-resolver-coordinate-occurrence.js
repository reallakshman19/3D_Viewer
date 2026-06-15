import {
  PSNM_parsePsPosition,
  PSNM_parsePsRows,
} from './psnm-match-engine.js';
import {
  PSNM_makeMasterPsRow,
  PSNM_MASTER_STATUS,
  PSNM_isAuditStatus,
  PSNM_normalizePsName,
} from './psnm-master-types.js';
import {
  PSNM_parseTable4A,
  PSNM_recomputeMasterPsRow,
  PSNM_resolveMasterPsTable as PSNM_resolveLegacyMasterPsTable,
} from './psnm-master-resolver.js';
import { PSNM_logPsTableLogic } from './psnm-table-logic-log.js';

function clean(value) {
  return String(value ?? '').trim();
}

function numericCoordKeyFromPosition(positionRaw, decimals = 3) {
  try {
    const parsed = PSNM_parsePsPosition(positionRaw);
    return [parsed.e, parsed.u, parsed.s]
      .map((value) => Number(value).toFixed(decimals))
      .join('|');
  } catch {
    return '';
  }
}

function appendRemark(row, remark) {
  const note = clean(remark);
  if (!note) return row;
  const existing = clean(row.remarks || '');
  if (existing.includes(note)) return row;
  row.remarks = [existing, note].filter(Boolean).join(' | ');
  return row;
}

function markWarning(row, remark) {
  if (!PSNM_isAuditStatus(row.auditStatus || row.status) && row.status === PSNM_MASTER_STATUS.OK) {
    row.status = PSNM_MASTER_STATUS.WARNING;
  }
  return appendRemark(row, remark);
}

function occurrenceIdFor(psKey, index) {
  const base = clean(psKey) || 'PS-UNNAMED';
  return `${base}#${String(index).padStart(3, '0')}`;
}

function parseTable1Rows(table1Text, logger) {
  const rows = PSNM_parsePsRows(table1Text, logger);
  return rows;
}

function applyPsOverrideToRows(rows, override, logger) {
  const psKey = PSNM_normalizePsName(override.psName);
  const matches = rows.filter((row) => row.psKey === psKey || PSNM_normalizePsName(row.psName) === psKey);
  if (!matches.length) return false;

  for (const existing of matches) {
    existing.isMandatoryPs = existing.isMandatoryPs || override.isMandatoryPs;
    existing.mandatorySource = [existing.mandatorySource, override.mandatorySource].filter(Boolean).join(';');
    if (override.p1boreOverride != null) existing.p1bore = override.p1boreOverride;
    if (override.positionOverride) {
      existing.positionRaw = override.positionOverride;
      try {
        const parsed = PSNM_parsePsPosition(existing.positionRaw);
        existing.psE = parsed.e;
        existing.psU = parsed.u;
        existing.psS = parsed.s;
        existing.psCoordKey = numericCoordKeyFromPosition(existing.positionRaw);
      } catch (error) {
        existing.status = PSNM_MASTER_STATUS.INVALID_POSITION;
        logger?.user?.('ERROR', 'Invalid PS Position', existing.sourceTable || 'Master PS', existing.psName, error.message || String(error), 'Correct PS position format: E ...mm S/N ...mm U ...mm.', { rowId: existing.rowId });
      }
    }
    if (override.remarks) appendRemark(existing, override.remarks);
  }
  return true;
}

function duplicateSummary(groups) {
  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, count: items.length, rows: items }));
}

export { PSNM_parseTable4A, PSNM_recomputeMasterPsRow };

export function PSNM_resolveMasterPsTable({ table1Text, table4AText, logger = null }) {
  let table1Rows = parseTable1Rows(table1Text, logger);
  const table4ARows = PSNM_parseTable4A(table4AText, logger);

  // Keep the legacy fallback for unusual paste formats. Normal parsed tables use
  // the coordinate-occurrence model below so duplicate PS labels are not dropped.
  if (!table1Rows.length && clean(table1Text)) {
    const legacy = PSNM_resolveLegacyMasterPsTable({ table1Text, table4AText, logger });
    return {
      ...legacy,
      coordinateOccurrenceMode: 'LEGACY_FALLBACK',
    };
  }

  PSNM_logPsTableLogic({ logger, table1Text, table1Rows, table4AText, table4ARows });

  const rows = [];
  const byPsKey = new Map();
  const byCoordKey = new Map();
  const byPsAndCoord = new Map();

  for (const row of table1Rows) {
    const auditStatus = row.auditStatus || '';
    const visiblePsName = row.psName || (auditStatus ? `(missing PS name row ${row.rowIndex})` : '');
    const psKey = PSNM_normalizePsName(visiblePsName);
    if (!psKey) continue;

    const currentPsCount = (byPsKey.get(psKey)?.length || 0) + 1;
    const psOccurrenceId = occurrenceIdFor(psKey, currentPsCount);
    const coordKey = numericCoordKeyFromPosition(row.position);
    const psAndCoordKey = `${psKey}||${coordKey || 'NO_COORD'} `;

    const master = PSNM_makeMasterPsRow({
      psKey,
      psName: visiblePsName,
      positionRaw: row.position,
      p1bore: Number.isFinite(row.p1bore) ? row.p1bore : null,
      isMandatoryPs: row.isMandatoryPs === true,
      mandatorySource: row.isMandatoryPs ? 'TABLE1' : '',
      sourceTable: 'TABLE1',
      sourceRow: row.rowIndex,
      status: auditStatus || PSNM_MASTER_STATUS.OK,
      auditStatus,
      auditSeverity: row.auditSeverity || '',
      auditAction: row.auditAction || '',
      remarks: row.auditAction || '',
    });

    master.psOccurrenceId = psOccurrenceId;
    master.psOccurrenceIndex = currentPsCount;
    master.psCoordKey = coordKey;
    master.coordinateIdentityKey = `${coordKey || 'NO_COORD'}||${psKey}||${row.rowIndex ?? rows.length + 1}`;

    try {
      const parsed = PSNM_parsePsPosition(master.positionRaw);
      master.psE = parsed.e;
      master.psU = parsed.u;
      master.psS = parsed.s;
    } catch (error) {
      master.psE = null;
      master.psU = null;
      master.psS = null;
      master.status = master.positionRaw ? PSNM_MASTER_STATUS.INVALID_POSITION : master.status;
      if (master.positionRaw) {
        logger?.user?.('ERROR', 'Invalid PS Position', master.sourceTable || 'Master PS', master.psName, error.message || String(error), 'Correct PS position format: E ...mm S/N ...mm U ...mm.', { rowId: master.rowId });
      }
    }

    if (!byPsKey.has(psKey)) byPsKey.set(psKey, []);
    byPsKey.get(psKey).push(master);
    if (coordKey) {
      if (!byCoordKey.has(coordKey)) byCoordKey.set(coordKey, []);
      byCoordKey.get(coordKey).push(master);
    }
    if (!byPsAndCoord.has(psAndCoordKey)) byPsAndCoord.set(psAndCoordKey, []);
    byPsAndCoord.get(psAndCoordKey).push(master);
    rows.push(master);
  }

  for (const group of duplicateSummary(byPsKey)) {
    const distinctCoords = new Set(group.rows.map((row) => row.psCoordKey || 'NO_COORD'));
    const reason = distinctCoords.size > 1
      ? `Same PS Name appears at ${distinctCoords.size} different coordinate(s). Retained as separate coordinate occurrences.`
      : 'Same PS Name appears more than once at the same coordinate. Retained with duplicate-coordinate warning.';
    for (const row of group.rows) markWarning(row, reason);
    logger?.user?.('WARNING', 'Duplicate PS Occurrence', 'Table 1', group.key, reason, 'Review Master PS occurrence IDs. Coordinate-first matching keeps these rows instead of dropping later PS labels.', { psName: group.key, count: group.count, distinctCoordinateCount: distinctCoords.size });
  }

  for (const group of duplicateSummary(byCoordKey)) {
    const names = Array.from(new Set(group.rows.map((row) => row.psName).filter(Boolean)));
    const reason = names.length > 1
      ? `Multiple PS labels share coordinate key ${group.key}: ${names.join(', ')}.`
      : `Duplicate PS coordinate key ${group.key}.`;
    for (const row of group.rows) markWarning(row, reason);
    logger?.user?.('WARNING', 'Duplicate PS Coordinate', 'Table 1', group.key, reason, 'Coordinate is the matching basis; review duplicate PS coordinates before final acceptance.', { coordKey: group.key, psNames: names, count: group.count });
  }

  for (const group of duplicateSummary(byPsAndCoord)) {
    if (group.rows.length <= 1) continue;
    for (const row of group.rows) markWarning(row, 'Same PS Name and same coordinate appears more than once. Verify duplicate source rows.');
  }

  for (const override of table4ARows) {
    const psKey = PSNM_normalizePsName(override.psName);
    if (!psKey) continue;
    if (applyPsOverrideToRows(rows, override, logger)) continue;

    const missing = PSNM_makeMasterPsRow({
      psKey,
      psName: override.psName,
      p1bore: override.p1boreOverride,
      positionRaw: override.positionOverride,
      isMandatoryPs: override.isMandatoryPs,
      mandatorySource: 'TABLE4A',
      sourceTable: 'TABLE4A',
      sourceRow: override.sourceRow,
      status: PSNM_MASTER_STATUS.MISSING_FROM_TABLE1,
      remarks: override.remarks || 'Listed in Table 4A but absent from Table 1.',
    });
    missing.psOccurrenceId = occurrenceIdFor(psKey, 1);
    missing.psOccurrenceIndex = 1;
    missing.psCoordKey = numericCoordKeyFromPosition(missing.positionRaw);
    if (missing.positionRaw) PSNM_recomputeMasterPsRow(missing, logger);
    rows.push(missing);
    logger?.user?.('WARNING', 'Mandatory PS Missing', 'Table 4A', override.psName, 'PS is mandatory/overridden in Table 4A but absent from Table 1.', 'Add this PS to Table 1 or remove it from Table 4A.', { psName: override.psName });
  }

  const finalRows = rows.map((row) => PSNM_recomputeMasterPsRow(row, logger));
  return {
    rows: finalRows,
    table1Rows,
    table4ARows,
    issues: finalRows.filter((row) => row.status !== PSNM_MASTER_STATUS.OK),
    duplicateKeys: Array.from(byPsKey.entries()).filter(([, items]) => items.length > 1).map(([key]) => key),
    duplicateCoordinateKeys: Array.from(byCoordKey.entries()).filter(([, items]) => items.length > 1).map(([key]) => key),
    coordinateOccurrenceMode: 'COORDINATE_OCCURRENCE',
  };
}
