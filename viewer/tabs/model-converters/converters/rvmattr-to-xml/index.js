export const rvmAttrToXmlConverter = {
  id: 'rvmattr_to_xml',
  label: 'ATT/RVM -> XML',
  group: 'RVM',
  inputs: [
    { role: 'primary', label: 'RVM Input', accept: '.rvm,.RVM', required: true },
    { role: 'secondary', label: 'ATT/TXT Attribute File', accept: '.att,.ATT,.txt,.TXT' }
  ],
  options: [],
  defaults: {},
  description: 'Convert ATT/RVM pairs to XML.',
  run: async (context) => {}
};
