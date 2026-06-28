import assert from 'node:assert/strict';
import {
  makeHierarchyControllerState,
} from '../tabs/RvmFormatNeutralHierarchy.js';
import { RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION } from '../tabs/RvmHierarchyProviderContract.js';

const state = makeHierarchyControllerState({
  sourceKind: 'stagedjson',
  fileName: 'sample.stagedjson',
  metadata: { schema: 'inputxml-managed-stage/v1' },
  nodes: [
    { id: 'BR-1', name: 'Branch 1', kind: 'BRANCH' },
    { id: 'BR-1/FL-1', parentId: 'BR-1', name: 'Flange 1', kind: 'FLANGE', renderObjectIds: ['mesh-1'] },
  ],
});

assert.equal(state.controller, 'format-neutral');
assert.equal(state.providerContractVersion, RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION);
assert.ok(state.providerResult, 'format-neutral state must expose providerResult');
assert.equal(state.hierarchyProviderResult, state.providerResult, 'hierarchyProviderResult alias must point to providerResult');
assert.equal(state.providerResult.providerId, 'format-neutral-source');
assert.equal(state.providerResult.sourceKind, 'stagedjson');
assert.equal(state.providerResult.sourceAuthority, 'source-document');
assert.equal(state.providerResult.nodeCount, 2);
assert.deepEqual(state.providerResult.nodes[1].renderObjectIds, ['mesh-1']);
assert.equal(state.providerResult.nodes[1].parentId, 'BR-1');

console.log('Verified source hierarchy provider state wiring.');
