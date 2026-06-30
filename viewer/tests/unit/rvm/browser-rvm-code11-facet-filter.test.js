import assert from 'node:assert/strict';
import { filterBrowserRvmRenderInstructions } from '../../../rvm/BrowserRvmInstructionFilterV2.js';

const decodedFacetParams = {
  version: 1,
  kind: 11,
  kindName: 'FacetGroup',
  decoded: true,
  facetGroup: true,
  polygonCount: 1,
  contourCount: 1,
  vertexCount: 4,
  polygons: [
    {
      contourCount: 1,
      contours: [
        {
          vertexCount: 4,
          vertices: [0, 0, 0, 100, 0, 0, 100, 50, 0, 0, 50, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        },
      ],
    },
  ],
};

const instructionSet = {
  schemaVersion: 'test-code11-filter',
  count: 2,
  instructions: [
    {
      sourcePath: 'ROOT/BRANCH//PS-171036.10/RVM_PRIM_CODE_11',
      sourceName: 'RVM_PRIM_CODE_11',
      displayName: 'RVM_PRIM_CODE_11',
      type: 'SUPPORT',
      kind: 'SUPPORT',
      renderPrimitive: 'FACET_GROUP_BBOX_PLACEHOLDER',
      bbox: '162.525,159.958,100.750,162.675,160.058,100.756',
      attributes: {
        TYPE: 'SUPPORT',
        RVM_OWNER_NAME: '/PS-171036.10',
        RVM_PRIMITIVE_CODE: '11',
        RVM_NATIVE_PRIMITIVE_PARAMS: JSON.stringify(decodedFacetParams),
      },
    },
    {
      sourcePath: 'ROOT/BRANCH//PS-171035.6H/RVM_PRIM_CODE_11',
      sourceName: 'RVM_PRIM_CODE_11',
      displayName: 'RVM_PRIM_CODE_11',
      type: 'SUPPORT',
      kind: 'SUPPORT',
      renderPrimitive: 'FACET_GROUP_BBOX_PLACEHOLDER',
      bbox: '157.550,160.149,100.750,157.650,160.249,100.915',
      attributes: {
        TYPE: 'SUPPORT',
        RVM_OWNER_NAME: '/PS-171035.6H',
        RVM_PRIMITIVE_CODE: '11',
        RVM_NATIVE_PRIMITIVE_PARAMS: JSON.stringify({ version: 1, kind: 11, decoded: false, facetGroup: true }),
      },
    },
  ],
};

const filtered = filterBrowserRvmRenderInstructions(instructionSet);
assert.equal(filtered.count, 4);
assert.equal(filtered.diagnostics.code11FacetGuardedCount, 2);
assert.equal(filtered.diagnostics.code11FacetDecodedCount, 1);
assert.equal(filtered.diagnostics.code11FacetWireframeFallbackCount, 1);
assert.equal(filtered.diagnostics.code11FacetXMarkerCount, 2);

const [decoded, fallback, markerA, markerB] = filtered.instructions;
assert.equal(decoded.type, 'FACET_GROUP');
assert.equal(decoded.kind, 'FACET_GROUP');
assert.equal(decoded.renderPrimitive, 'FACET_GROUP_BBOX_PLACEHOLDER');
assert.equal(decoded.attributes.TYPE, 'SUPPORT');
assert.equal(decoded.attributes.RVM_BROWSER_CODE11_RENDER_POLICY, 'native-facetgroup-only-no-semantic-placeholder-promotion');
assert.equal(decoded.attributes.RVM_BROWSER_CODE11_NATIVE_FACET_DECODED, 'true');

assert.equal(fallback.type, 'FACET_GROUP_UNDECODED');
assert.equal(fallback.kind, 'FACET_GROUP');
assert.equal(fallback.renderPrimitive, 'FACET_GROUP_BBOX_PLACEHOLDER');
assert.equal(fallback.attributes.TYPE, 'SUPPORT');
assert.equal(fallback.attributes.RVM_BROWSER_CODE11_RENDER_POLICY, 'wireframe-bbox-plus-subtle-x-diagnostic-no-synthetic-support-stand');
assert.equal(fallback.attributes.RVM_BROWSER_CODE11_NATIVE_FACET_DECODED, 'false');

for (const marker of [markerA, markerB]) {
  assert.equal(marker.type, 'DIAGNOSTIC');
  assert.equal(marker.kind, 'UNDECODED_FACET_X_MARKER');
  assert.equal(marker.renderPrimitive, 'CYLINDER_BBOX');
  assert.equal(marker.attributes.RVM_BROWSER_CODE11_X_MARKER, 'true');
  assert.ok(marker.radius > 0 && marker.radius <= 0.01);
}

console.log('Browser RVM code 11 facet render guard test passed');
