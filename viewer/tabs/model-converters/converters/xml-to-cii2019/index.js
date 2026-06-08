export const xmlToCii2019Converter = {
  id: 'xml_to_cii',
  label: 'XML -> CII 2019',
  group: 'CAESAR II',
  inputs: [
    { role: 'primary', label: 'Input XML', accept: '.xml,.XML', required: true },
    { role: 'secondary', label: 'Staged JSON', accept: '.json', required: false }
  ],
  options: [],
  defaults: {},
  description: 'Convert generic PSI XML to CII 2019 format, with optional staged JSON context.',
  run: async (context) => {}
};
