import assert from 'node:assert/strict';
import { parseRvmArrayBuffer } from '../../../rvm/BrowserRvmHierarchyParser.js';
import { collectBrowserRvmRenderInstructions } from '../../../rvm/BrowserRvmRenderContractAdapter.js';

function findByName(node, name) {
  if (!node) return null;
  if (node.name === name) return node;
  for (const child of node.children || []) {
    const match = findByName(child, name);
    if (match) return match;
  }
  return null;
}

function makeRecord(tag, bodyBytes = []) {
  const tagBytes = new TextEncoder().encode(tag.padEnd(4, ' '));
  const body = Uint8Array.from(bodyBytes);
  const record = new Uint8Array(8 + body.length);
  record.set(tagBytes, 0);
  new DataView(record.buffer).setUint32(4, body.length, true);
  record.set(body, 8);
  return record;
}

function f32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setFloat32(0, value, true);
  return Array.from(out);
}

function i32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, true);
  return Array.from(out);
}

function prim(code, owner, bbox, extra = []) {
  const ownerBytes = Array.from(new TextEncoder().encode(owner));
  const floats = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
    0, 0, 0,
    ...bbox,
    ...extra,
  ].flatMap(f32);
  return makeRecord('PRIM', [
    ...i32(code),
    ...i32(ownerBytes.length),
    ...ownerBytes,
    ...floats,
  ]);
}

function concatRecords(records) {
  const total = records.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const record of records) {
    out.set(record, offset);
    offset += record.length;
  }
  return out.buffer;
}

const buffer = concatRecords([
  prim(3, 'RTORUS 1 of GASKET 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P', [-1, -1, -1, 1, 1, 1]),
  prim(3, 'GASKET 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P', [-1, -1, -1, 1, 1, 1]),
  prim(11, 'INSTRUMENT 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P', [-1, -1, -1, 1, 1, 1]),
  prim(7, 'REDUCER 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P', [-1, -1, -2, 1, 1, 2]),
  prim(2, 'STRUCTURE 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P', [-2, -2, -2, 2, 2, 2]),
]);

const parsed = await parseRvmArrayBuffer(buffer, { fileName: 'synthetic.rvm' });
assert.equal(parsed.diagnostics.hierarchySchemaVersion, 'browser-rvm-hierarchy-wrapper/v6');
assert.equal(parsed.diagnostics.hierarchyGrouped, true);
assert.equal(parsed.diagnostics.primitiveSemanticsVersion, 'rhbg-prim-code-map/v2');
assert.equal(parsed.diagnostics.primitiveTypeCounts.GASK, 2);
assert.equal(parsed.diagnostics.primitiveTypeCounts.INSTRUMENT, 1);
assert.equal(parsed.diagnostics.primitiveTypeCounts.REDUCER, 1);
assert.equal(parsed.diagnostics.primitiveTypeCounts.STRUCTURE, 1);
assert.equal(parsed.diagnostics.primitiveKindCounts.TORUS, 2);
assert.equal(parsed.diagnostics.primitiveKindCounts.INSTRUMENT, 1);
assert.equal(parsed.diagnostics.primitiveKindCounts.CONE, 1);
assert.equal(parsed.diagnostics.primitiveKindCounts.STRUCTURE, 1);
assert.equal(parsed.diagnostics.primitiveCodeCounts['3'], 2);
assert.equal(parsed.diagnostics.primitiveCodeCounts['11'], 1);
assert.equal(parsed.diagnostics.primitiveCodeCounts['7'], 1);
assert.equal(parsed.diagnostics.primitiveCodeCounts['2'], 1);
assert.equal(parsed.diagnostics.semanticLeafCount, 5);
assert.equal(parsed.diagnostics.geometryLeafCount, 5);
assert.equal(parsed.diagnostics.geometryMissingBboxCount, 0);
assert.equal(parsed.diagnostics.geometryApproximateCount, 0);
assert.equal(parsed.diagnostics.geometryContractLeafCount, 5);
assert.equal(parsed.diagnostics.geometryContractSourceCounts['bbox-derived-browser-contract'], 5);
assert.equal(parsed.diagnostics.geometryContractCounts.TORUS_BBOX_PLACEHOLDER, 2);
assert.equal(parsed.diagnostics.geometryContractCounts.INSTRUMENT_BBOX_PLACEHOLDER, 1);
assert.equal(parsed.diagnostics.geometryContractCounts.CONE_BBOX_PLACEHOLDER, 1);
assert.equal(parsed.diagnostics.geometryContractCounts.BOX_BBOX, 1);

const root = parsed.hierarchy[0];
assert.equal(root.attributes.BROWSER_RVM_HIERARCHY_GROUPED, 'true');
assert.equal(root.attributes.BROWSER_RVM_HIERARCHY_SCHEMA, 'browser-rvm-hierarchy-wrapper/v6');
assert.equal(root.attributes.BROWSER_RVM_PRIMITIVE_SEMANTICS, 'owner-name-and-rhbg-prim-code-map');
assert.equal(root.attributes.BROWSER_RVM_PRIMITIVE_SEMANTICS_VERSION, 'rhbg-prim-code-map/v2');
assert.equal(root.attributes.BROWSER_RVM_GEOMETRY_QUALITY_VERSION, 'rvm-geometry-quality/v2');
assert.equal(root.attributes.BROWSER_RVM_GEOMETRY_CONTRACT_VERSION, 'rvm-browser-geometry-contract/v1');
assert.ok(findByName(root, 'ZONE /RHBG-1000-CU-PI-P'));
assert.ok(findByName(root, 'PIPE 1'));
assert.ok(findByName(root, 'BRANCH 1'));
assert.ok(findByName(root, 'GASKET 1'));
assert.ok(findByName(root, 'RTORUS 1'));
assert.ok(findByName(root, 'INSTRUMENT 1'));
assert.ok(findByName(root, 'REDUCER 1'));
assert.ok(findByName(root, 'STRUCTURE 1'));

const renderInstructions = collectBrowserRvmRenderInstructions(parsed.hierarchy);
assert.equal(renderInstructions.schemaVersion, 'rvm-browser-render-instructions/v3-support-hints');
assert.equal(renderInstructions.count, 5);
assert.equal(renderInstructions.diagnostics.instructionCount, 5);
assert.equal(renderInstructions.diagnostics.contractCounts.TORUS_BBOX_PLACEHOLDER, 2);
assert.equal(renderInstructions.diagnostics.contractCounts.INSTRUMENT_BBOX_PLACEHOLDER, 1);
assert.equal(renderInstructions.diagnostics.contractCounts.CONE_BBOX_PLACEHOLDER, 1);
assert.equal(renderInstructions.diagnostics.contractCounts.BOX_BBOX, 1);
assert.equal(renderInstructions.diagnostics.sourceCounts['bbox-derived-browser-contract'], 5);
assert.equal(renderInstructions.diagnostics.attCounts.plain, 5);
assert.equal(renderInstructions.diagnostics.supportHintCount, 0);

const gasket = findByName(root, 'GASKET 1');
assert.ok(gasket.children.some((child) => child.type === 'GASK'), 'gasket group should retain GASK primitive leaf');
const rtorus = findByName(root, 'RTORUS 1');
const rtorusLeaf = rtorus.children.find((child) => child.attributes?.RVM_PRIMITIVE_CODE === '3');
assert.ok(rtorusLeaf, 'RTORUS code-3 PRIM should remain under the RTORUS owner group');
assert.equal(rtorusLeaf.type, 'GASK');
console.log('Browser RVM hierarchy contract test passed');
