import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  buildNodeMarkerOverrideStoreContext,
  loadNodeMarkerOverrideSet,
  nodeMarkerOverrideStorageKey,
  removeNodeMarkerOverride,
  saveNodeMarkerOverrideSet,
  upsertNodeMarkerOverride,
} from '../overlays/nodes/NodeMarkerOverrideStore.js';

const storeSource = await fs.readFile(new URL('../overlays/nodes/NodeMarkerOverrideStore.js', import.meta.url), 'utf8');
const bridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveNodeMarkerBridge.js', import.meta.url), 'utf8');
const detailsBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveNodeMarkerDetailsPanelBridge.js', import.meta.url), 'utf8');

assert.match(storeSource, /non-primitive-node-marker-override-store\/v1/, 'override store exposes schema');
assert.match(storeSource, /sourceRevision/, 'override store context includes sourceRevision');
assert.match(storeSource, /sourceFile/, 'override store context includes sourceFile');
assert.match(storeSource, /overrideHash/, 'override store stores override hash');
assert.match(bridgeSource, /loadNodeMarkerOverrideSet/, 'node marker bridge loads persisted overrides');
assert.match(bridgeSource, /saveNodeMarkerOverrideSet/, 'node marker bridge saves persisted overrides');
assert.match(bridgeSource, /saveOverride|clearOverride|persistOverrides|getOverrides/, 'node marker bridge exposes override API methods');
assert.match(detailsBridgeSource, /saveOverrideFromPanel|clearOverrideFromPanel|readOverrideFromPanel/, 'details panel bridge wires override UI to bridge API');

const memory = new Map();
const storage = {
  getItem: (key) => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, value),
};

const context = buildNodeMarkerOverrideStoreContext({
  sourceKind: 'json',
  sourceSubKind: 'managed-stage',
  sourceFile: 'BM_CII_INPUT.XML',
  sourceRevision: 'rev-001',
});
assert.equal(context.sourceKind, 'json');
assert.equal(context.sourceSubKind, 'managed-stage');
assert.equal(context.sourceFile, 'BM_CII_INPUT.XML');
assert.equal(context.sourceRevision, 'rev-001');

const key = nodeMarkerOverrideStorageKey(context);
assert.match(key, /^rvm\.nodeMarkers\.overrides\.v1:/);
assert.equal(loadNodeMarkerOverrideSet(context, storage).overrides.length, 0, 'empty store returns no overrides');

const overrides = upsertNodeMarkerOverride([], {
  markerId: 'NODE-00001',
  sourcePath: '/INPUTXML/BM/PIPE-A',
  nodeNumber: 777,
  branchName: '/BR-CERT/B1',
  componentRefNo: 'CERT-REF-777',
  locked: true,
  reason: 'certified by user',
});
assert.equal(overrides.length, 1);
assert.equal(overrides[0].nodeNumber, 777);
assert.equal(overrides[0].locked, true);

const payload = saveNodeMarkerOverrideSet(context, overrides, storage);
assert.equal(payload.schema, 'non-primitive-node-marker-override-store/v1');
assert.equal(payload.overrides.length, 1);
assert.equal(payload.context.sourceRevision, 'rev-001');
assert.ok(payload.overrideHash, 'persisted payload has overrideHash');

const loaded = loadNodeMarkerOverrideSet(context, storage);
assert.equal(loaded.overrides.length, 1);
assert.equal(loaded.overrides[0].markerId, 'NODE-00001');
assert.equal(loaded.overrides[0].componentRefNo, 'CERT-REF-777');
assert.equal(loaded.overrideHash, payload.overrideHash, 'loaded hash is stable');

const replaced = upsertNodeMarkerOverride(loaded.overrides, { markerId: 'NODE-00001', nodeNumber: 778, suppressExport: true });
assert.equal(replaced.length, 1, 'upsert replaces existing marker override');
assert.equal(replaced[0].nodeNumber, 778);
assert.equal(replaced[0].suppressExport, true);

const removed = removeNodeMarkerOverride(replaced, { markerId: 'NODE-00001' });
assert.equal(removed.length, 0, 'clear override removes matching marker override');

const changedRevisionContext = { ...context, sourceRevision: 'rev-002' };
assert.notEqual(nodeMarkerOverrideStorageKey(context), nodeMarkerOverrideStorageKey(changedRevisionContext), 'sourceRevision scopes persisted override keys');
assert.equal(loadNodeMarkerOverrideSet(changedRevisionContext, storage).overrides.length, 0, 'different source revision does not reuse stale overrides');

console.log('nonprimitive-node-marker-override-persistence passed');
