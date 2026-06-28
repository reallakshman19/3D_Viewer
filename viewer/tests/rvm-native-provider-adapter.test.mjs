import assert from 'node:assert/strict';
import {
  RVM_NATIVE_HIERARCHY_PROVIDER_ADAPTER_VERSION,
  attachNativeRvmHierarchyProvider,
  makeNativeRvmHierarchyProvider,
} from '../tabs/RvmNativeHierarchyProviderAdapter.js';
import { RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION } from '../tabs/RvmHierarchyProviderContract.js';

const payload = {
  fileName: 'sample.rvm',
  manifest: {
    fileName: 'sample.rvm',
    nodes: [
      { id: 'RVM-ROOT', name: 'RVM Root', kind: 'GROUP' },
      { id: 'RVM-PIPE-1', parentId: 'RVM-ROOT', name: 'Pipe 1', kind: 'PIPE', renderObjectIds: ['mesh-pipe-1'] },
    ],
  },
};

const provider = makeNativeRvmHierarchyProvider(payload);
assert.equal(provider.version, RVM_NATIVE_HIERARCHY_PROVIDER_ADAPTER_VERSION);
assert.equal(provider.providerContractVersion, RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION);
assert.equal(provider.providerId, 'native-rvm');
assert.equal(provider.sourceKind, 'rvm');
assert.equal(provider.sourceAuthority, 'native-rvm');
assert.equal(provider.readOnly, true);
assert.equal(provider.nodeCount, 2);
assert.equal(provider.providerResult.sourceAuthority, 'native-rvm');
assert.equal(provider.providerResult.nodes[1].renderObjectIds[0], 'mesh-pipe-1');

const target = {};
const attached = attachNativeRvmHierarchyProvider(target, payload);
assert.equal(attached, provider.providerId === 'native-rvm' ? attached : null);
assert.equal(target.rvmNativeHierarchyProvider.sourceKind, 'rvm');
assert.equal(target.rvmHierarchyProviderResult.nodeCount, 2);
assert.equal(attachNativeRvmHierarchyProvider(null, payload), null);

console.log('Verified native RVM hierarchy provider adapter.');
