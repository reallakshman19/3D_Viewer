export const revToPcfConverter = {
  id: 'rev_to_pcf',
  label: 'REV -> PCF',
  group: 'REV',
  inputs: [
    { role: 'primary', label: 'REV Input', accept: '.rev,.REV,.txt,.TXT', required: true }
  ],
  options: [
    { key: 'coordFactor', label: 'Coord Factor', type: 'number', step: '0.01' },
    { key: 'topologyMergeTolerance', label: 'Topology Merge Tol.', type: 'number', step: '0.01' },
    { key: 'pipelineReference', label: 'Pipeline Reference', type: 'text' },
    { key: 'projectIdentifier', label: 'Project Identifier', type: 'text' },
    { key: 'excludeGroupTokens', label: 'Exclude Group Tokens (comma-separated)', type: 'text' }
  ],
  defaults: {
    coordFactor: 1000,
    topologyMergeTolerance: 0.5,
    pipelineReference: '',
    projectIdentifier: '',
    excludeGroupTokens: '-PIPESUPP'
  },
  description: 'Convert REV text export to PCF.',
  run: async (context) => {}
};
