export const inputXmlToCii2014Converter = {
  id: 'inputxml14_to_cii',
  label: 'InputXML 2014 -> CII',
  group: 'CII',
  inputs: [
    { role: 'primary', label: 'InputXML 2014 Input', accept: '.xml,.XML', required: true }
  ],
  options: [],
  defaults: {},
  description: 'Convert old InputXML format to CII format.',
  run: async (context) => {}
};
