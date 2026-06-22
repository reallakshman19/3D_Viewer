import assert from 'node:assert/strict';
import { TextEncoder } from 'node:util';
import { parseRvmArrayBuffer } from '../../../rvm/BrowserRvmHierarchyParser.js';
import { collectBrowserRvmRenderInstructions } from '../../../rvm/BrowserRvmRenderContractAdapter.js';

function record(tag, ints, payloadBytes = new Uint8Array()) {
  return { tag, ints, payloadBytes };
}

function asciiBytes(text) {
  return new TextEncoder().encode(text);
}

function floatBytes(values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, false));
  return bytes;
}

function primFloats(originX = 100, originY = 20, originZ = 0) {
  return floatBytes([
    0, 0, 0.001,
    0.001, 0, 0,
    0, 0.001, 0,
    originX, originY, originZ,
    -50, -10, -10,
    50, 10, 10,
    10, 100
  ]);
}

function buildNestedRvm() {
  const records = [
    record('HEAD', [1, 2, 22], asciiBytes('AVEVA E3D Design Design Mk3.1.7.2\0')),
    record('MODL', [1, 1, 1], asciiBytes('RBB\0/RBB1\0')),
    record('CNTB', [1, 2, 4], asciiBytes('ZONE /RHBG-1000-CU-PI-P\0')),
    record('CNTB', [1, 2, 9], asciiBytes('PIPE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('CNTB', [1, 2, 12], asciiBytes('BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('CNTB', [1, 2, 15], asciiBytes('GASKET 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('PRIM', [1, 1, 8], primFloats(100, 20, 0)),
    record('CNTB', [1, 2, 15], asciiBytes('RTORUS 1 of EQUIPMENT /TRANCHE-2-ROAD\0')),
    record('PRIM', [1, 1, 3], primFloats(400, 20, 0)),
    record('CNTB', [1, 2, 15], asciiBytes('INSTRUMENT 1 of BRANCH 1 of PIPE 2 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('PRIM', [1, 1, 11], primFloats(800, 20, 0)),
    record('CNTB', [1, 2, 15], asciiBytes('REDUCER 1 of BRANCH 1 of PIPE 2 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('PRIM', [1, 1, 5], primFloats(1000, 20, 0)),
    record('CNTB', [1, 2, 15], asciiBytes('STRUCTURE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('PRIM', [1, 1, 2], primFloats(1200, 20, 0)),
    record('CNTE', [1, 2, 80]),
    record('CNTE', [1, 2, 67]),
    record('CNTE', [1, 2, 67]),
    record('CNTE', [1, 2, 67]),
    record('END:', [1, 1, 0])
  ];

  const lengths = records.map((item) => 32 + item.payloadBytes.length);
  const offsets = [];
  let cursor = 0;
  for (const len of lengths) {
    offsets.push(cursor);
    cursor += len;
  }
  const bytes = new Uint8Array(cursor);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < records.length; i += 1) {
    const item = records[i];
    const offset = offsets[i];
    for (let c = 0; c < 4; c += 1) view.setUint32(offset + c * 4, item.tag.charCodeAt(c), false);
    view.setUint32(offset + 16, offset + lengths[i], false);
    view.setUint32(offset + 20, item.ints[0], false);
    view.setUint32(offset + 24, item.ints[1], false);
    view.setUint32(offset + 28, item.ints[2], false);
    bytes.set(item.payloadBytes, offset + 32);
  }
  return bytes.buffer;
}

function findByName(node, name) {
  if (node?.name === name) return node;
  for (const child of Array.isArray(node?.children) ? node.children : []) {
    const found = findByName(child, name);
    if (found) return found;
  }
  return null;
}

const parsed = await parseRvmArrayBuffer(buildNestedRvm(), { fileName: 'RHBG.RVM' });
assert.equal(parsed.ok, true);
assert.equal(parsed.diagnostics.parseFidelity, 'PARTIAL_BINARY_PRIM_RECORDS');
assert.equal(parsed.diagnostics.hierarchyGrouped, true);
assert.equal(parsed.diagnostics.primitiveSemantics, 'owner-name-and-rhbg-prim-code-map');
assert.equal(parsed.diagnostics.primitiveSemanticsVersion, 'rhbg-prim-code-map/v2');
assert.equal(parsed.diagnostics.hierarchySchemaVersion, 'browser-rvm-hierarchy-wrapper/v6');
assert.equal(parsed.diagnostics.geometryQualityVersion, 'rvm-geometry-quality/v2');
assert.equal(parsed.diagnostics.geometryContractVersion, 'rvm-browser-geometry-contract/v1');
assert.ok(parsed.diagnostics.hierarchyGroupCount >= 4, 'owner path should create zone/pipe/branch/component groups');
assert.equal(parsed.diagnostics.primitiveCodeCounts['3'], 1);
assert.equal(parsed.diagnostics.primitiveCodeCounts['5'], 1);
assert.equal(parsed.diagnostics.primitiveCodeCounts['11'], 1);
assert.equal(parsed.diagnostics.primitiveTypeCounts.GASK, 2);
assert.equal(parsed.diagnostics.primitiveTypeCounts.INSTRUMENT, 1);
assert.equal(parsed.diagnostics.primitiveTypeCounts.REDUCER, 1);
assert.equal(parsed.diagnostics.primitiveTypeCounts.STRUCTURE, 1);
assert.equal(parsed.diagnostics.primitiveSemanticSourceCounts['owner-name'], 5);
assert.equal(parsed.diagnostics.geometryLeafCount, 5);
assert.equal(parsed.diagnostics.geometrySpanAxisCounts.X, 5);
assert.equal(parsed.diagnostics.geometrySourceCounts['binary-rvm-record'], 5);
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
assert.equal(renderInstructions.schemaVersion, 'rvm-browser-render-instructions/v4-preserve-raw-support-cylinders');
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
assert.equal(rtorusLeaf.attributes.RVM_PRIMITIVE_KIND, 'TORUS');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_PRIMITIVE_CLASS, 'TORUS');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_PRIMITIVE_SEMANTIC_SOURCE, 'owner-name');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_PRIMITIVE_SEMANTIC_VERSION, 'rhbg-prim-code-map/v2');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_GEOMETRY_QUALITY_VERSION, 'rvm-geometry-quality/v2');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_GEOMETRY_QUALITY, 'bbox-derived');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_GEOMETRY_SOURCE, 'binary-rvm-record');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_SPAN_AXIS, 'X');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_SPAN_LENGTH, '100.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_EXTENT_Y, '20.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_EXTENT_Z, '20.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_GEOMETRY_CONTRACT_VERSION, 'rvm-browser-geometry-contract/v1');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_RENDER_PRIMITIVE, 'TORUS_BBOX_PLACEHOLDER');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_RENDER_SOURCE, 'bbox-derived-browser-contract');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_CENTER, '400.000,20.000,0.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_AXIS_START, '350.000,20.000,0.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_AXIS_END, '450.000,20.000,0.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_LENGTH, '100.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_RADIUS, '10.000');
assert.equal(rtorusLeaf.attributes.RVM_BROWSER_DIAMETER, '20.000');

const rtorusInstruction = renderInstructions.instructions.find((item) => item.sourcePath.includes('RTORUS 1'));
assert.ok(rtorusInstruction, 'RTORUS render instruction should be collected');
assert.equal(rtorusInstruction.schemaVersion, 'rvm-browser-render-instructions/v4-preserve-raw-support-cylinders');
assert.equal(rtorusInstruction.renderPrimitive, 'TORUS_BBOX_PLACEHOLDER');
assert.equal(rtorusInstruction.kind, 'TORUS');
assert.deepEqual(rtorusInstruction.center, { x: 400, y: 20, z: 0 });
assert.deepEqual(rtorusInstruction.axisStart, { x: 350, y: 20, z: 0 });
assert.deepEqual(rtorusInstruction.axisEnd, { x: 450, y: 20, z: 0 });
assert.equal(rtorusInstruction.length, 100);
assert.equal(rtorusInstruction.radius, 10);
assert.equal(rtorusInstruction.diameter, 20);

const instrument = findByName(root, 'INSTRUMENT 1');
const instrumentLeaf = instrument.children.find((child) => child.attributes?.RVM_PRIMITIVE_CODE === '11');
assert.ok(instrumentLeaf, 'INSTRUMENT code-11 PRIM should remain under the instrument owner group');
assert.equal(instrumentLeaf.type, 'INSTRUMENT');
assert.equal(instrumentLeaf.attributes.RVM_BROWSER_PRIMITIVE_CLASS, 'INSTRUMENT');
assert.equal(instrumentLeaf.attributes.RVM_BROWSER_GEOMETRY_QUALITY, 'bbox-derived');
assert.equal(instrumentLeaf.attributes.RVM_BROWSER_RENDER_PRIMITIVE, 'INSTRUMENT_BBOX_PLACEHOLDER');

const reducer = findByName(root, 'REDUCER 1');
const reducerLeaf = reducer.children.find((child) => child.attributes?.RVM_PRIMITIVE_CODE === '5');
assert.ok(reducerLeaf, 'REDUCER owner should enrich generic code-5 PRIM');
assert.equal(reducerLeaf.type, 'REDUCER');
assert.equal(reducerLeaf.attributes.RVM_PRIMITIVE_KIND, 'CONE');
assert.equal(reducerLeaf.attributes.RVM_BROWSER_RENDER_PRIMITIVE, 'CONE_BBOX_PLACEHOLDER');

const structure = findByName(root, 'STRUCTURE 1');
const structureLeaf = structure.children.find((child) => child.attributes?.RVM_PRIMITIVE_CODE === '2');
assert.ok(structureLeaf, 'STRUCTURE owner should override generic box code');
assert.equal(structureLeaf.type, 'STRUCTURE');
assert.equal(structureLeaf.attributes.RVM_BROWSER_PRIMITIVE_CLASS, 'STRUCTURE');
assert.equal(structureLeaf.attributes.RVM_BROWSER_SPAN_AXIS, 'X');
assert.equal(structureLeaf.attributes.RVM_BROWSER_RENDER_PRIMITIVE, 'BOX_BBOX');

assert.ok(parsed.indexJson.nodes.some((node) => node.name === 'GASKET 1'));
assert.ok(parsed.indexJson.nodes.some((node) => node.kind === 'INSTRUMENT'));
assert.ok(parsed.indexJson.nodes.some((node) => node.kind === 'REDUCER'));
assert.ok(parsed.indexJson.nodes.some((node) => node.kind === 'STRUCTURE'));
assert.ok(parsed.indexJson.nodes.some((node) => node.attributes.RVM_BROWSER_GEOMETRY_QUALITY_VERSION === 'rvm-geometry-quality/v2'));
assert.ok(parsed.indexJson.nodes.some((node) => node.attributes.RVM_BROWSER_GEOMETRY_CONTRACT_VERSION === 'rvm-browser-geometry-contract/v1'));
console.log('Browser RVM hierarchy grouping test passed');
