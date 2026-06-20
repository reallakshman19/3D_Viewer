export function hasXmlCiiWeightMasterRows(config) {
  return Array.isArray(config?.weight?.masterRows) && config.weight.masterRows.length > 0;
}
