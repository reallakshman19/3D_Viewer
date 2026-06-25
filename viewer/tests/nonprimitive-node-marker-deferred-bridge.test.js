import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  applyFromSource,
  clear,
  getCsv,
  getDiagnostics,
  getMarkers,
  getStaleStatus,
  getXmlCiiTables,
  installRvmNonPrimitiveNodeMarkerBridge,
} from '../tabs/RvmNonPrimitiveNodeMarkerBridge.js';

const loader = await fs.readFile(new URL('../tabs/RvmDeferredBridgeLoader.js', import.meta.url), 'utf8');
const renderer = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const bridge = await fs.readFile(new URL('../tabs/RvmNonPrimitiveNodeMarkerBridge.js', import.meta.url), 'utf8');

assert.match(loader, /id: 'nonprimitive-node-markers'/, 'sourcePreview group includes node marker bridge');
assert.match(loader, /RvmNonPrimitiveNodeMarkerBridge\.js\?v=20260625-node-marker-deferred-1/, 'deferred loader imports node marker bridge with cache key');
assert.match(loader, /installRvmNonPrimitiveNodeMarkerBridge/, 'deferred loader installs node marker bridge');
assert.match(loader, /__PCF_GLB_RVM_NON_PRIMITIVE_NODE_MARKERS__\?\.applyFromSource/, 'loader refresh path applies node markers');
assert.match(loader, /__PCF_GLB_RVM_NON_PRIMITIVE_NODE_MARKERS__\?\.clear/, 'loader clear path clears node marker runtime');
assert.doesNotMatch(renderer, /RvmNonPrimitiveNodeMarkerBridge\.js\?v=/, 'renderer must not eagerly import node marker bridge');
assert.doesNotMatch(renderer, /installRvmNonPrimitiveNodeMarkerBridge\(\)/, 'renderer must not eagerly install node marker bridge');
assert.match(bridge, /rvm-non-primitive-node-marker-bridge\/v1/, 'bridge exposes versioned schema');
assert.match(bridge, /non-primitive-node-marker-api\/v2|evaluateNodeMarkerStaleness/, 'bridge uses stale-aware node marker API');
assert.doesNotMatch(bridge, /RvmSelectionAdapter|objectSearch|selectObject|pickObject/, 'bridge does not use primitive RVM selection or search');

const source = {
  schema: 'managed-stage/staged-json-export/v1',
  sourceFile: 'node-marker-bridge.json',
  branches: [{
    branchName: '/BR-BRIDGE/B1',
    children: [
      { name: 'PIPE-A', type: 'PIPE', attributes: { APOS: [0, 0, 0], LPOS: [100, 0, 0], BORE: '100', P1: '4140', ComponentRefNo: 'PIPE-A' } },
      { name: 'FLANGE-A', type: 'FLANGE', attributes: { APOS: [100, 0, 0], LPOS: [150, 0, 0], ComponentRefNo: 'FLG-A' } },
    ],
  }],
};

const apiA = installRvmNonPrimitiveNodeMarkerBridge();
const apiB = installRvmNonPrimitiveNodeMarkerBridge();
assert.equal(apiA, apiB, 'bridge install is idempotent');
assert.equal(apiA.schema, 'rvm-non-primitive-node-marker-bridge/v1');

const viewer = {
  sourceKind: 'json',
  modelGroup: { userData: { __rvmNonPrimitiveSourceHierarchy: source, __rvmNonPrimitiveSourceKind: 'json', fileName: 'node-marker-bridge.json' } },
};
const build = applyFromSource({ viewer, source, sourceKind: 'json', fileName: 'node-marker-bridge.json', options: { startNodeNumber: 700 } });
assert.equal(build.markers.length, 1);
assert.equal(getMarkers(viewer)[0].nodeNumber, 700);
assert.equal(getXmlCiiTables(viewer).branchRows[0].BranchName, '/BR-BRIDGE/B1');
assert.match(getCsv(viewer), /# branchRows/);
assert.equal(getDiagnostics(viewer).markerCount, 1);
assert.equal(getStaleStatus(viewer).status, 'fresh');

const cleared = clear(viewer, 'test-clear');
assert.equal(cleared.status, 'cleared');
assert.deepEqual(getMarkers(viewer), []);
assert.equal(getXmlCiiTables(viewer), null);
assert.equal(getDiagnostics(viewer).status, 'cleared');

console.log('nonprimitive-node-marker-deferred-bridge passed');
