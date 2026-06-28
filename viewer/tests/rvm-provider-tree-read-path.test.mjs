import assert from 'node:assert/strict';
import {
  RVM_PROVIDER_TREE_READ_PATH_VERSION,
  hierarchyNodesForPayload,
  providerTreeNodesForPayload,
} from '../tabs/RvmFormatNeutralHierarchy.js';

assert.equal(RVM_PROVIDER_TREE_READ_PATH_VERSION, '20260628-rvm-provider-tree-read-path-1');

const payload = {
  indexJson: { nodes: [{ canonicalObjectId: 'legacy-1', name: 'Legacy 1', kind: 'LEGACY' }] },
  providerResult: {
    nodes: [
      { id: 'provider-1', parentId: '', label: 'Provider Root', kind: 'GROUP', renderObjectIds: ['mesh-root'] },
      { id: 'provider-1/pipe-1', parentId: 'provider-1', label: 'Provider Pipe', kind: 'PIPE', renderObjectIds: ['mesh-pipe'] },
    ],
  },
};

const legacyDefault = hierarchyNodesForPayload(payload);
assert.equal(legacyDefault[0].canonicalObjectId, 'legacy-1', 'provider tree path must be disabled by default');

const providerNodes = providerTreeNodesForPayload(payload);
assert.equal(providerNodes.length, 2);
assert.equal(providerNodes[0].canonicalObjectId, 'provider-1');
assert.equal(providerNodes[1].parentCanonicalObjectId, 'provider-1');
assert.equal(providerNodes[1].name, 'Provider Pipe');
assert.deepEqual(providerNodes[1].renderObjectIds, ['mesh-pipe']);

const providerOptIn = hierarchyNodesForPayload(payload, { useProviderTreeReadPath: true });
assert.equal(providerOptIn[0].canonicalObjectId, 'provider-1', 'explicit opt-in must use provider nodes');
assert.equal(providerOptIn[1].parentCanonicalObjectId, 'provider-1');

const emptyProviderFallback = hierarchyNodesForPayload({ indexJson: { nodes: [{ canonicalObjectId: 'legacy-fallback' }] }, providerResult: { nodes: [] } }, { useProviderTreeReadPath: true });
assert.equal(emptyProviderFallback[0].canonicalObjectId, 'legacy-fallback', 'empty provider result must fall back to legacy nodes');

console.log('Verified disabled provider-backed tree read path.');
