export const PSNM_MASTER_STATUS = Object.freeze({
  OK: 'OK',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  DISABLED: 'DISABLED',
  MISSING_FROM_TABLE1: 'MISSING_FROM_TABLE1',
  INVALID_POSITION: 'INVALID_POSITION',
  DUPLICATE_PS: 'DUPLICATE_PS',
});

let PSNM_ROW_SEQUENCE = 0;

function PSNM_nextRowId(prefix) {
  PSNM_ROW_SEQUENCE += 1;
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${PSNM_ROW_SEQUENCE.toString(36)}`;
}

export function PSNM_normalizePsName(value) {
  return String(value ?? '').trim().replace(/\.$/, '');
}

export function PSNM_makeMasterPsRow(seed = {}) {
  return {
    rowId: seed.rowId || PSNM_nextRowId('ps'),
    psKey: seed.psKey || PSNM_normalizePsName(seed.psName || ''),
    psName: seed.psName || '',
    positionRaw: seed.positionRaw || '',
    psE: seed.psE ?? null,
    psU: seed.psU ?? null,
    psS: seed.psS ?? null,
    p1bore: seed.p1bore ?? null,
    isMandatoryPs: seed.isMandatoryPs === true,
    mandatorySource: seed.mandatorySource || '',
    sourceTable: seed.sourceTable || '',
    sourceRow: seed.sourceRow ?? null,
    status: seed.status || PSNM_MASTER_STATUS.OK,
    enabled: seed.enabled !== false,
    userEdited: seed.userEdited === true,
    remarks: seed.remarks || '',
  };
}

export function PSNM_cloneMasterPsRow(row) {
  return PSNM_makeMasterPsRow({ ...row, rowId: row.rowId });
}

export const PSNM_EDITABLE_MASTER_PS_FIELDS = new Set([
  'psName',
  'positionRaw',
  'p1bore',
  'isMandatoryPs',
  'enabled',
  'remarks',
]);
