import { runLegacyConverter } from '../../core/converter-runner.js';

export const rvmToRevConverter = {
  id: 'rvm_to_rev',
  label: 'RVM -> REV',
  group: 'RVM',
  inputs: [
    { role: 'primary', label: 'RVM Input', accept: '.rvm,.RVM', required: true },
    { role: 'secondary', label: 'ATT/TXT Attribute File (optional)', accept: '.att,.ATT,.txt,.TXT' }
  ],
  options: [],
  defaults: {},
  description: 'Convert RVM source to REV text.',
  run: async (context) => {
    return runLegacyConverter('rvm_to_rev', context);
  }
};
