import assert from 'node:assert/strict';
import { componentModelToRvm } from '../converters/inputxml-rvm/RvmxComponentModelToRvm.js';
import { parseRvmArrayBuffer } from '../rvm/BrowserRvmHierarchyTransformParser.js';
import { filterBrowserRvmRenderInstructions } from '../rvm/BrowserRvmInstructionFilterV2.js';
import { RVM_PRIMITIVE_CAPABILITY_REGISTRY_VERSION } from '../rvm/RvmPrimitiveCapabilityRegistry.js';

function exactArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function primitiveNodes(parsed) {
  return (parsed.indexJson?.nodes || []).filter((node) => node.attributes?.RVM_RECORD_TAG === 'PRIM');
}

const model = {
  components: [
    { type: 'PIPE', refNo: 'P-1', bore: 100, ep1: { x: 0, y: 0, z: 0 }, ep2: { x: 1000, y: 0, z: 0 } },
    { type: 'REDUCER', refNo: 'R-1', bore: 100, attributes: { BORE2: 80 }, ep1: { x: 1000, y: 0, z: 0 }, ep2: { x: 1300, y: 0, z: 0 } },
    { type: 'BEND', refNo: 'B-1', bore: 100, bendRadius: 150, ep1: { x: 1300, y: 0, z: 0 }, ep2: { x: 1500, y: 0, z: 0 } },
    { type: 'PIPE', refNo: 'P-2', bore: 100, ep1: { x: 1500, y: 0, z: 0 }, ep2: { x: 1500, y: 500, z: 0 } },
  ],
};

const exported = componentModelToRvm(model, { modelName: 'DECODER-CAPABILITY' });
const parsed = await parseRvmArrayBuffer(exactArrayBuffer(exported.rvm), { fileName: 'decoder-capability.rvm', attText: exported.att });

assert.equal(parsed.schemaVersion, 'browser-rvm-hierarchy-transform-wrapper/v5-facetgroup-contract', 'active wrapper schema should remain stable');
assert.equal(parsed.diagnostics.transformParserSchemaVersion, 'browser-rvm-transform-parser/v5-primitive-capability');
assert.equal(parsed.diagnostics.rvmPrimitiveCapabilityRegistryVersion, RVM_PRIMITIVE_CAPABILITY_REGISTRY_VERSION);
assert.ok(parsed.diagnostics.rvmPrimTransformAppliedCount >= 4, 'transform parser must apply PRIM transforms');
assert.equal(parsed.diagnostics.rvmPrimitiveBlockedCodeCount, 0, 'writer-generated fixture must not contain blocked primitive codes');
assert.ok(parsed.diagnostics.rvmPrimitiveStableWriterCodeCount >= 2, 'fixture must include stable writer-ready codes');
assert.ok(parsed.diagnostics.rvmPrimitiveLegacyUnlockCodeCount >= 2, 'fixture must include legacy-unlocked torus/snout codes');
assert.equal(parsed.diagnostics.rvmPrimitiveCapabilityStatusCounts['stable-writer-ready'], parsed.diagnostics.rvmPrimitiveStableWriterCodeCount);
assert.equal(parsed.diagnostics.rvmPrimitiveCapabilityStatusCounts['explicit-legacy-unlock-required'], parsed.diagnostics.rvmPrimitiveLegacyUnlockCodeCount);
assert.ok(parsed.diagnostics.rvmPrimitiveCapabilityCounts['8:CYLINDER'] >= 2, 'diagnostics must count cylinder capability');
assert.ok(parsed.diagnostics.rvmPrimitiveCapabilityCounts['7:SNOUT'] >= 1, 'diagnostics must count snout capability');
assert.ok(parsed.diagnostics.rvmPrimitiveCapabilityCounts['4:TORUS'] >= 1, 'diagnostics must count torus capability');

const nodes = primitiveNodes(parsed);
assert.equal(nodes.length, exported.audit.records.length, 'parsed PRIM nodes must match writer audit records');
const byCode = new Map();
for (const node of nodes) {
  const attrs = node.attributes || {};
  const code = attrs.RVM_PRIMITIVE_CODE;
  byCode.set(code, (byCode.get(code) || 0) + 1);
  assert.equal(attrs.RVM_PRIMITIVE_CAPABILITY_REGISTRY_VERSION, RVM_PRIMITIVE_CAPABILITY_REGISTRY_VERSION, `node ${node.name} must carry registry version`);
  assert.ok(attrs.RVM_PRIMITIVE_CAPABILITY_NAME, `node ${node.name} must carry capability name`);
  assert.ok(attrs.RVM_PRIMITIVE_WRITER_STATUS, `node ${node.name} must carry writer status`);
  assert.notEqual(attrs.RVM_PRIMITIVE_WRITER_STATUS, 'blocked', `writer-generated node ${node.name} must not be marked blocked`);
  assert.ok(attrs.RVM_NATIVE_PRIMITIVE_PARAMS?.includes('writerStatus'), `node ${node.name} native params must include writer status`);
}

assert.ok((byCode.get('8') || 0) >= 2, 'parsed nodes must include cylinders');
assert.ok((byCode.get('7') || 0) >= 1, 'parsed nodes must include snout');
assert.ok((byCode.get('4') || 0) >= 1, 'parsed nodes must include torus');

const decodedFacetParams = {
  version: 1,
  kind: 11,
  kindName: 'FacetGroup',
  decoded: true,
  facetGroup: true,
  polygonCount: 1,
  contourCount: 1,
  vertexCount: 4,
  polygons: [{ contourCount: 1, contours: [{ vertexCount: 4, vertices: [0, 0, 0, 100, 0, 0, 100, 50, 0, 0, 50, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1] }] }],
};
const filtered = filterBrowserRvmRenderInstructions({
  schemaVersion: 'test-code11-filter',
  instructions: [
    {
      sourcePath: 'ROOT/BRANCH//PS-171036.10/RVM_PRIM_CODE_11',
      sourceName: 'RVM_PRIM_CODE_11',
      displayName: 'RVM_PRIM_CODE_11',
      type: 'SUPPORT',
      kind: 'SUPPORT',
      renderPrimitive: 'FACET_GROUP_BBOX_PLACEHOLDER',
      bbox: '162.525,159.958,100.750,162.675,160.058,100.756',
      attributes: { TYPE: 'SUPPORT', RVM_OWNER_NAME: '/PS-171036.10', RVM_PRIMITIVE_CODE: '11', RVM_NATIVE_PRIMITIVE_PARAMS: JSON.stringify(decodedFacetParams) },
    },
    {
      sourcePath: 'ROOT/BRANCH//PS-171035.6H/RVM_PRIM_CODE_11',
      sourceName: 'RVM_PRIM_CODE_11',
      displayName: 'RVM_PRIM_CODE_11',
      type: 'SUPPORT',
      kind: 'SUPPORT',
      renderPrimitive: 'FACET_GROUP_BBOX_PLACEHOLDER',
      bbox: '157.550,160.149,100.750,157.650,160.249,100.915',
      attributes: { TYPE: 'SUPPORT', RVM_OWNER_NAME: '/PS-171035.6H', RVM_PRIMITIVE_CODE: '11', RVM_NATIVE_PRIMITIVE_PARAMS: JSON.stringify({ version: 1, kind: 11, decoded: false, facetGroup: true }) },
    },
  ],
});
assert.equal(filtered.diagnostics.code11FacetGuardedCount, 2, 'code 11 support facet instructions must be guarded from semantic placeholder promotion');
assert.equal(filtered.diagnostics.code11FacetDecodedCount, 1, 'decoded code 11 facets must remain native facet candidates');
assert.equal(filtered.diagnostics.code11FacetWireframeFallbackCount, 1, 'undecoded code 11 facets must fall back to diagnostic geometry only');
assert.equal(filtered.diagnostics.code11FacetXMarkerCount, 2, 'undecoded code 11 facets should add two small X-marker strokes');
assert.equal(filtered.instructions[0].type, 'FACET_GROUP');
assert.equal(filtered.instructions[0].attributes.TYPE, 'SUPPORT');
assert.equal(filtered.instructions[0].attributes.RVM_BROWSER_CODE11_RENDER_POLICY, 'native-facetgroup-only-no-semantic-placeholder-promotion');
assert.equal(filtered.instructions[1].type, 'FACET_GROUP_UNDECODED');
assert.equal(filtered.instructions[1].attributes.RVM_BROWSER_CODE11_RENDER_POLICY, 'wireframe-bbox-plus-subtle-x-diagnostic-no-synthetic-support-stand');
const xMarkers = filtered.instructions.filter((item) => item.kind === 'UNDECODED_FACET_X_MARKER');
assert.equal(xMarkers.length, 2, 'fallback must use two subtle X-marker strokes');
assert.ok(xMarkers.every((item) => item.renderPrimitive === 'CYLINDER_BBOX'), 'X-marker strokes must render as small cylinders, not support placeholders');
assert.ok(xMarkers.every((item) => item.radius > 0 && item.radius <= 0.01), 'X-marker strokes must remain subtle');
assert.ok(xMarkers.every((item) => item.attributes.RVM_BROWSER_CODE11_X_MARKER === 'true'), 'X-marker strokes must be explicitly identifiable');

console.log('rvm primitive decoder capability integration passed');
