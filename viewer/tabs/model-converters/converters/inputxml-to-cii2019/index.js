export const inputXmlToCii2019Converter = {
  id: 'inputxml_to_cii2019',
  label: 'InputXML -> CII 2019',
  group: 'CII',
  inputs: [
    { role: 'primary', label: 'InputXML Input', accept: '.xml,.XML', required: true }
  ],
  options: [],
  defaults: {},
  description: 'Convert InputXML to CII 2019 format directly.',
  run: async (context) => {}
};
