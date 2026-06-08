export const pdfToInputXmlCii2014Converter = {
  id: 'pdf_to_inputxml_cii14',
  label: 'PDF -> InputXML (2014)',
  group: 'PDF',
  inputs: [
    { role: 'primary', label: 'PDF Input', accept: '.pdf,.PDF', required: true }
  ],
  options: [],
  defaults: {},
  description: 'Extract text from PDF and convert to InputXML 2014.',
  run: async (context) => {}
};
