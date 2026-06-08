export const stagedJsonToInputXmlConverter = {
  id: 'stagedjson_to_inputxml',
  label: 'StagedJSON -> InputXML',
  group: 'JSON',
  inputs: [
    { role: 'primary', label: 'Staged JSON Input', accept: '.json,.JSON', required: true }
  ],
  options: [],
  defaults: {},
  description: 'Convert Staged JSON to InputXML.',
  run: async (context) => {}
};
