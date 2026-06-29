import assert from 'node:assert/strict';
import {
  RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION,
  isNativeHierarchyProviderKind,
  isSourceHierarchyProviderKind,
  makeHierarchyProviderNode,
  makeHierarchyProviderResult,
  providerResultFromFormatNeutralState,
  providerResultFromNativeRvmPayload,
} from '../tabs/RvmHierarchyProviderContract.js';

assert.equal(RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION, '20260628-rvm-hierarchy-provider-contract-1');
assert.equal(isSourceHierarchyProviderKind('stagedjson'), true);
assert.equal(isSourceHierarchyProviderKind('uxml'), true);
assert.equal(isSourceHierarchyProviderKind('rvm'), false);
assert.equal(isNativeHierarchyProviderKind('rvm'), true);
assert.equal(isNativeHierarchyProviderKind('binary-rvm'), true);

const sourceNode = makeHierarchyProviderNode({
  canonicalObjectId: 'BR-1/FL-1',
  parentCanonicalObjectId: 'BR-1',
  name: 'Flange 1',
  kind: 'flange',
  sourceKind: 'stagedjson',
  attributes: { TAG: 'FL-1', TYPE: 'FLANGE' },
  renderObjectIds: ['mesh-1'],
});
assert.deepEqual({ id: sourceNode.id, parentId: sourceNode.parentId, label: sourceNode.label, kind: sourceNode.kind, sourceKind: sourceNode.sourceKind, renderObjectIds: sourceNode.renderObjectIds }, { id: 'BR-1/FL-1', parentId: 'BR-1', label: 'Flange 1', kind: 'FLANGE', sourceKind: 'stagedjson', renderObjectIds: ['mesh-1'] });

const sourceResult = makeHierarchyProviderResult({
  providerId: 'format-neutral-source',
  sourceKind: 'stagedjson',
  fileName: 'sample.stagedjson',
  nodes: [sourceNode],
});
assert.equal(sourceResult.sourceAuthority, 'source-document');
assert.equal(sourceResult.nodeCount, 1);
assert.equal(sourceResult.nodes[0].sourceKind, 'stagedjson');

const stateResult = providerResultFromFormatNeutralState({
  sourceKind: 'uxml',
  fileName: 'sample.uxml.json',
  nodes: [{ id: 'A', name: 'A' }],
  metadata: { schema: 'uxml' },
});
assert.equal(stateResult.providerId, 'format-neutral-source');
assert.equal(stateResult.sourceKind, 'uxml');
assert.equal(stateResult.sourceAuthority, 'source-document');

const nativeResult = providerResultFromNativeRvmPayload({
  fileName: 'model.rvm',
  manifest: { nodes: [{ id: 'R1', name: 'RVM Node', kind: 'GROUP' }] },
});
assert.equal(nativeResult.providerId, 'native-rvm');
assert.equal(nativeResult.sourceKind, 'rvm');
assert.equal(nativeResult.sourceAuthority, 'native-rvm');
assert.equal(nativeResult.nodeCount, 1);

console.log('Verified RVM hierarchy provider contract.');
