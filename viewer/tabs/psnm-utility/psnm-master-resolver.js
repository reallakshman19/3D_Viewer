import {
  PSNM_parsePsPosition,
  PSNM_parsePsRows,
} from './psnm-match-engine.js';
import {
  PSNM_makeMasterPsRow,
  PSNM_MASTER_STATUS,
  PSNM_normalizePsName,
} from './psnm-master-types.js';

function PSNM_number(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function PSNM_splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((cell) => cell.trim());
  return raw.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function PSNM_isTrue(value) {
  return /^(yes|y|true|1|m|mandatory|required|req|must)$/i.test(String(value ?? '').trim());
}

export function PSNM_parseTable4A(text, logger = null) {
  const rows = [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^-{3,}$/.test(line));

  let headers = null;
  for (const [index, line] of lines.entries()) {
    const cells = PSNM_splitCells(line);
    const lowered = cells.map((cell) => cell.toLowerCase().replace(/[_.-]+/g, ' ').trim());
    const looksLikeHeader = lowered.some((cell) => cell.includes('ps name') || cell === 'psname' || cell === 'mandatory ps name');
    if (index === 0 && looksLikeHeader) {
      headers = lowered;
      continue;
    }

    const byHeader = {};
    if (headers) headers.forEach((header, cellIndex) => { byHeader[header] = cells[cellIndex] ?? ''; });

    const psName = PSNM_normalizePsName(
      byHeader['ps name'] || byHeader.psname || byHeader['mandatory ps name'] || cells[0] || line
    );
    if (!psName || /^mandatory ps name$/i.test(psName)) continue;

    const mandatoryRaw = byHeader.mandatory || byHeader.required || cells[1] || 'YES';
    const p1boreOverride = PSNM_number(byHeader.p1bore || byHeader.bore || byHeader.dn || byHeader.nb || cells[2]);
    const positionOverride = byHeader.position || byHeader['position override'] || cells[3] || '';
    const remarks = byHeader.remarks || byHeader.remark || byHeader.note || cells[4] || '';

    rows.push({
      psName,
      isMandatoryPs: PSNM_isTrue(mandatoryRaw) || !headers,
      mandatorySource: 'TABLE4A',
      p1boreOverride: Number.isFinite(p1boreOverride) ? p1boreOverride : null,
      positionOverride,
      remarks,
      sourceRow: index + 1,
    });
  }

  if (!rows.length && String(text || '').trim()) {
    logger?.user?.('WARNING', 'Table 4A Empty', 'Table 4A', 'PS override', 'No PS mandatory/override rows were parsed.', 'Check Table 4A format. Use either Mandatory PS Name list or PS NAME / Mandatory / p1bore override.', {});
  }
  return rows;
}

function PSNM_parseMasterPsPosition(row, logger = null) {
  try {
    const parsed = PSNM_parsePsPosition(row.positionRaw);
    row.psE = parsed.e;
    row.psU = parsed.u;
    row.psS = parsed.s;
    if (row.status === PSNM_MASTER_STATUS.INVALID_POSITION) row.status = PSNM_MASTER_STATUS.OK;
  } catch (error) {
    row.psE = null;
    row.psU = null;
    row.psS = null;
    row.status = row.positionRaw ? PSNM_MASTER_STATUS.INVALID_POSITION : row.status;
    if (row.positionRaw) {
      logger?.user?.('ERROR', 'Invalid PS Position', row.sourceTable || 'Master PS', row.psName, error.message || String(error), 'Correct PS position format: E ...mm S ...mm U ...mm.', { rowId: row.rowId });
    }
  }
  return row;
}

export function PSNM_recomputeMasterPsRow(row, logger = null) {
  row.psKey = PSNM_normalizePsName(row.psName);
  if (row.enabled === false) row.status = PSNM_MASTER_STATUS.DISABLED;
  if (row.status !== PSNM_MASTER_STATUS.MISSING_FROM_TABLE1 && row.enabled !== false) {
    row.status = PSNM_MASTER_STATUS.OK;
    PSNM_parseMasterPsPosition(row, logger);
  }
  return row;
}

export function PSNM_resolveMasterPsTable({ table1Text, table4AText, logger = null }) {
  const table1Rows = PSNM_parsePsRows(table1Text, logger);
  const table4ARows = PSNM_parseTable4A(table4AText, logger);
  const byPs = new Map();
  const duplicateKeys = new Set();

  for (const row of table1Rows) {
    const psKey = PSNM_normalizePsName(row.psName);
    if (!psKey) continue;
    if (byPs.has(psKey)) {
      duplicateKeys.add(psKey);
      logger?.user?.('WARNING', 'Duplicate PS', 'Table 1', row.psName, 'Duplicate PS name found. First row kept in Master PS No.', 'Review duplicate PS in Table 1 before matching.', { psName: row.psName, rowIndex: row.rowIndex });
      continue;
    }

    const master = PSNM_makeMasterPsRow({
      psKey,
      psName: row.psName,
      positionRaw: row.position,
      p1bore: Number.isFinite(row.p1bore) ? row.p1bore : null,
      isMandatoryPs: row.isMandatoryPs === true,
      mandatorySource: row.isMandatoryPs ? 'TABLE1' : '',
      sourceTable: 'TABLE1',
      sourceRow: row.rowIndex,
      status: PSNM_MASTER_STATUS.OK,
    });
    PSNM_parseMasterPsPosition(master, logger);
    byPs.set(psKey, master);
  }

  for (const override of table4ARows) {
    const psKey = PSNM_normalizePsName(override.psName);
    if (!psKey) continue;
    const existing = byPs.get(psKey);

    if (!existing) {
      const missing = PSNM_makeMasterPsRow({
        psKey,
        psName: override.psName,
        p1bore: override.p1boreOverride,
        positionRaw: override.positionOverride || '',
        isMandatoryPs: override.isMandatoryPs === true,
        mandatorySource: override.isMandatoryPs ? 'TABLE4A' : '',
        sourceTable: 'TABLE4A',
        sourceRow: override.sourceRow,
        status: PSNM_MASTER_STATUS.MISSING_FROM_TABLE1,
        remarks: override.remarks || 'Listed in Table 4A but absent from Table 1.',
      });
      if (override.positionOverride) PSNM_parseMasterPsPosition(missing, logger);
      byPs.set(psKey, missing);
      logger?.user?.('WARNING', 'Mandatory PS Missing', 'Table 4A', override.psName, 'PS is mandatory/overridden in Table 4A but absent from Table 1.', 'Add this PS to Table 1 or remove it from Table 4A.', { psName: override.psName });
      continue;
    }

    if (override.isMandatoryPs) {
      existing.isMandatoryPs = true;
      existing.mandatorySource = existing.mandatorySource ? `${existing.mandatorySource};TABLE4A` : 'TABLE4A';
    }
    if (override.p1boreOverride != null) {
      existing.p1bore = override.p1boreOverride;
      existing.userEdited = true;
      existing.sourceTable = `${existing.sourceTable};TABLE4A_OVERRIDE`;
    }
    if (override.positionOverride) {
      existing.positionRaw = override.positionOverride;
      existing.userEdited = true;
      existing.sourceTable = `${existing.sourceTable};TABLE4A_OVERRIDE`;
      PSNM_parseMasterPsPosition(existing, logger);
    }
    if (override.remarks) existing.remarks = override.remarks;
  }

  for (const key of duplicateKeys) {
    const row = byPs.get(key);
    if (row && row.status === PSNM_MASTER_STATUS.OK) row.status = PSNM_MASTER_STATUS.DUPLICATE_PS;
  }

  const rows = Array.from(byPs.values());
  return {
    rows,
    table1Rows,
    table4ARows,
    issues: rows.filter((row) => row.status !== PSNM_MASTER_STATUS.OK),
  };
}
