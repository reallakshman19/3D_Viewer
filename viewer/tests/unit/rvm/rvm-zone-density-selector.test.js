import assert from 'node:assert/strict';
import { buildSelectorRows, applyZoneDensitySelection } from '../../../tabs/RvmZoneDensitySelectorBridge.js';

const instructions = [
  { sourcePath: '/STRUCTURE/BTRM-1000-CU-PI/P1', type: 'PIPE', renderPrimitive: 'PIPE_CYLINDER', displayName: 'P1' },
  { sourcePath: '/STRUCTURE/BTRM-1000-CU-SU/S1', type: 'STRUCTURE', renderPrimitive: 'BOX_BBOX', displayName: 'S1' },
  { sourcePath: '/STRUCTURE/BTRM-1000-CU-CI/GRID/G1', type: 'STRUCTURE', renderPrimitive: 'GENERIC_BBOX_PLACEHOLDER', displayName: 'G1' },
  { sourcePath: '/STRUCTURE/BTRM-1000-CU-CI/FDNS/F1', type: 'STRUCTURE', renderPrimitive: 'GENERIC_BBOX_PLACEHOLDER', displayName: 'F1' },
];

const rows = buildSelectorRows({ instructions, manifestNodes: [], fileName: 'GAS_2026Apr26-0828.rvm' });
assert.ok(rows.some((row) => row.key === '/BTRM-1000-CU-PI'));
assert.ok(rows.some((row) => row.key === '/BTRM-1000-CU-SU'));
assert.ok(rows.some((row) => row.key === '/BTRM-1000-CU-CI'));
assert.ok(rows.every((row) => Number(row.depth) <= 2));

const filtered = applyZoneDensitySelection({ instructions }, {
  mode: 'selected',
  selectedZones: ['/BTRM-1000-CU-PI', '/BTRM-1000-CU-CI'],
  zoneDensities: { '/BTRM-1000-CU-PI': 100, '/BTRM-1000-CU-CI': 50 },
  selectorSource: 'test',
});
assert.equal(filtered.diagnostics.zoneSelection.schemaVersion, 'browser-rvm-zone-selection/v3-density-hierarchy');
assert.ok(filtered.instructions.every((item) => !String(item.sourcePath).includes('CU-SU')));
assert.ok(filtered.instructions.some((item) => item.sourcePath.includes('CU-PI')));
assert.equal(filtered.diagnostics.lodSelection.perZoneDensity, true);

console.log('rvm-zone-density-selector.test.js passed');
