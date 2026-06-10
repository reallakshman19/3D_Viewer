export const WORKFLOW_MODES = Object.freeze({
  XML_CII_2019: 'xml_cii_2019',
  JSON_RVM_PCF: 'json_rvm_pcf',
});

export function assertWorkflowAdapter(adapter) {
  const required = [
    'id',
    'label',
    'getPhaseModel',
    'loadSource',
    'buildMasterContext',
    'buildRegexModel',
    'buildImportMastersModel',
    'buildPreviewModel',
    'runDiagnostics',
    'runWeightMatch',
    'runSupportTypes',
    'buildConfigModel',
    'runFinal',
  ];

  for (const key of required) {
    if (!adapter || adapter[key] == null) {
      throw new Error(`Workflow adapter missing required member: ${key}`);
    }
  }

  return adapter;
}
