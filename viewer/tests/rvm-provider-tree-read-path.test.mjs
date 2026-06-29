import assert from 'node:assert/strict';
import {
  RVM_PROVIDER_TREE_READ_PATH_VERSION,
  RVM_SOURCE_PROVIDER_TREE_PILOT_VERSION,
  hierarchyNodesForPayload,
  isSourceProviderTreePilotPayload,
  providerTreeNodesForPayload,
} from '../tabs/RvmFormatNeutralHierarchy.js';

assert.equal(RVM_PROVIDER_TREE_READ_PATH_VERSION, '20260628-rvm-provider-tree-read-path-1');
assert.equal(RVM_SOURCE_PROVIDER_TREE_PILOT_VERSION, '20260628-rvm-source-provider-tree-pilot-1');

const payload = {
  sourceKind: 'stagedjson',
  indexJson: { nodes: [{ canonicalObjectId: 'legacy-1', name: 'Legacy 1', kind: 'LEGACY' }] },
  providerResult: {
    sourceKind: 'stagedjson',
    nodes: [
      { id: 'provider-1', parentId: '', label: 'Provider Root', kind: 'GROUP', renderObjectIds: ['mesh-root'] },
      { id: 'provider-1/pipe-1', parentId: 'provider-1', label: 'Provider Pipe', kind: 'PIPE', renderObjectIds: ['mesh-pipe'] },
    ],
  },
};

assert.equal(isSourceProviderTreePilotPayload(payload), true, 'stagedJSON must be eligible for provider-tree pilot');

const legacyDefault = hierarchyNodesForPayload(payload);
assert.equal(legacyDefault[0].canonicalObjectId, 'legacy-1', 'provider tree path must be disabled by default');

const providerNodes = providerTreeNodesForPayload(payload);
assert.equal(providerNodes.length, 2);
assert.equal(providerNodes[0].canonicalObjectId, 'provider-1');
assert.equal(providerNodes[1].parentCanonicalObjectId, 'provider-1');
assert.equal(providerNodes[1].name, 'Provider Pipe');
assert.deepEqual(providerNodes[1].renderObjectIds, ['mesh-pipe']);

const providerOptIn = hierarchyNodesForPayload(payload, { useProviderTreeReadPath: true });
assert.equal(providerOptIn[0].canonicalObjectId, 'provider-1', 'explicit source-preview opt-in must use provider nodes');
assert.equal(providerOptIn[1].parentCanonicalObjectId, 'provider-1');

const rvmPayload = {
  sourceKind: 'rvm',
  indexJson: { nodes: [{ canonicalObjectId: 'rvm-legacy' }] },
  providerResult: { sourceKind: 'rvm', nodes: [{ id: 'rvm-provider' }] },
};
assert.equal(isSourceProviderTreePilotPayload(rvmPayload), false, 'binary RVM must not be eligible for source provider-tree pilot');
assert.equal(hierarchyNodesForPayload(rvmPayload, { useProviderTreeReadPath: true })[0].canonicalObjectId, 'rvm-legacy', 'binary RVM must fall back to legacy nodes even with opt-in');

const emptyProviderFallback = hierarchyNodesForPayload({ sourceKind: 'stagedjson', indexJson: { nodes: [{ canonicalObjectId: 'legacy-fallback' }] }, providerResult: { sourceKind: 'stagedjson', nodes: [] } }, { useProviderTreeReadPath: true });
assert.equal(emptyProviderFallback[0].canonicalObjectId, 'legacy-fallback', 'empty provider result must fall back to legacy nodes');

console.log('Verified source-only provider-backed tree pilot.');
