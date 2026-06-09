export function PSNM_masterPsToMatchRows(masterPsRows = []) {
  return masterPsRows
    .filter((row) => row && row.enabled !== false)
    .filter((row) => row.status === 'OK' || row.status === 'WARNING')
    .filter((row) => row.positionRaw)
    .map((row, index) => ({
      psName: row.psName,
      position: row.positionRaw,
      p1bore: row.p1bore,
      isMandatoryPs: row.isMandatoryPs === true,
      mandatorySource: row.mandatorySource || '',
      rowIndex: row.sourceRow ?? index + 1,
      masterPsRowId: row.rowId,
      sourceTable: row.sourceTable,
    }));
}

export function PSNM_masterPsCoverageRows(masterPsRows = [], matchRows = []) {
  return masterPsRows
    .filter((row) => row && row.enabled !== false && row.isMandatoryPs === true)
    .map((row) => {
      const match = matchRows.find((item) => item.masterPsRowId === row.rowId || item.psName === row.psName);
      if (row.status === 'MISSING_FROM_TABLE1') {
        return {
          psName: row.psName,
          mandatorySource: row.mandatorySource || 'TABLE4A',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: 'MISSING_FROM_TABLE1',
          masterRowId: row.rowId,
        };
      }
      if (!match || match.finalStatus === 'UNMAPPED') {
        return {
          psName: row.psName,
          mandatorySource: row.mandatorySource || '',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: 'UNMAPPED',
          masterRowId: row.rowId,
        };
      }
      if (match.finalStatus === 'USER_REVIEW_REQUIRED' || match.matchType === 'AMBIGUOUS') {
        return {
          psName: row.psName,
          mandatorySource: row.mandatorySource || '',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: 'AMBIGUOUS',
          masterRowId: row.rowId,
        };
      }
      return {
        psName: row.psName,
        mandatorySource: row.mandatorySource || '',
        matchedNode: match.matchingNode || '',
        occurrenceId: match.occurrenceId || '',
        nodeMandatory: match.isMandatoryNode === true,
        status: 'COVERED',
        masterRowId: row.rowId,
      };
    });
}
