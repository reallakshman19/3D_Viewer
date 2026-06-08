export const rvmAttrToXmlCiiConverter = {
  id: 'rvmattr_to_xml_cii',
  label: 'ATT/RVM -> XML -> CII',
  group: 'RVM',
  inputs: [
    { role: 'primary', label: 'RVM Input', accept: '.rvm,.RVM', required: true },
    { role: 'secondary', label: 'ATT/TXT Attribute File', accept: '.att,.ATT,.txt,.TXT' }
  ],
  options: [],
  defaults: {},
  description: 'Convert ATT/RVM directly through to CII format.',
  run: async (context) => {}
};
