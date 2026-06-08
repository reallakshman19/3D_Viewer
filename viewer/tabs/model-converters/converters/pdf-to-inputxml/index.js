export const pdfToInputXmlConverter = {
  id: 'pdf_to_inputxml',
  label: 'PDF -> InputXML (2019)',
  group: 'PDF',
  inputs: [
    { role: 'primary', label: 'PDF Input', accept: '.pdf,.PDF', required: true }
  ],
  options: [],
  defaults: {},
  description: 'Extract text from PDF and convert to InputXML 2019.',
  run: async (context) => {}
};
