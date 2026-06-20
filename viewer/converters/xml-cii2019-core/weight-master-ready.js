export function hasXmlCiiWeightMasterRows(config) {
  return Array.isArray(config?.weight?.masterRows) && config.weight.masterRows.length > 0;
}

export async function ensureXmlCiiWeightMasterRows(config) {
  return {
    config: config || {},
    loaded: hasXmlCiiWeightMasterRows(config) === false,
    count: Array.isArray(config?.weight?.masterRows) ? config.weight.masterRows.length : 0,
    source: 'ready-helper'
  };
}
