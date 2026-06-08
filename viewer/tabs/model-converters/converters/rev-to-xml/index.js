export const revToXmlConverter = {
  id: 'rev_to_xml',
  label: 'REV -> XML',
  group: 'REV',
  inputs: [
    { role: 'primary', label: 'REV Input', accept: '.rev,.REV,.txt,.TXT', required: true }
  ],
  options: [
    { key: 'coordFactor', label: 'Coord Factor', type: 'number', step: '0.01' },
    { key: 'nodeStart', label: 'Node Start', type: 'number', step: '1' },
    { key: 'nodeStep', label: 'Node Step', type: 'number', step: '1' },
    { key: 'nodeMergeTolerance', label: 'Node Merge Tol.', type: 'number', step: '0.01' },
    { key: 'source', label: 'Source', type: 'text' },
    { key: 'purpose', label: 'Purpose', type: 'text' },
    { key: 'titleLine', label: 'Title Line', type: 'text' },
    { key: 'enablePsiRigidLogic', label: 'Enable PSI Rigid Logic', type: 'checkbox' }
  ],
  defaults: {
    coordFactor: 1000,
    nodeStart: 10,
    nodeStep: 10,
    nodeMergeTolerance: 0.5,
    source: 'AVEVA PSI',
    purpose: 'Preliminary stress run',
    titleLine: 'PSI stress Output',
    enablePsiRigidLogic: false
  },
  description: 'Convert REV text export to PSI116-style XML.',
  run: async (context) => {}
};
