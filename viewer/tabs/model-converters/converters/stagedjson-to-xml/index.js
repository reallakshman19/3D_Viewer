export const stagedJsonToXmlConverter = {
  id: 'stagedjson_to_xml',
  label: 'StagedJSON -> XML',
  group: 'JSON',
  inputs: [
    { role: 'primary', label: 'Staged JSON Input', accept: '.json,.JSON', required: true }
  ],
  options: [],
  defaults: {},
  description: 'Convert Staged JSON to XML.',
  run: async (context) => {}
};
