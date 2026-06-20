import assert from 'node:assert/strict';
import { TextEncoder } from 'node:util';
import { parseRvmArrayBuffer } from '../../../rvm/BrowserRvmHierarchyParser.js';

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

function buildNestedRvm() {
  const records = [
    record('HEAD', [1, 2, 22], asciiBytes('AVEVA E3D Design Design Mk3.1.7.2\0')),
    record('MODL', [1, 1, 1], asciiBytes('RBB\0/RBB1\0')),
    record('CNTB', [1, 2, 4], asciiBytes('ZONE /RHBG-1000-CU-PI-P\0')),
    record('CNTB', [1, 2, 9], asciiBytes('PIPE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('CNTB', [1, 2, 12], asciiBytes('BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('CNTB', [1, 2, 15], asciiBytes('GASKET 1 of BRANCH 1 of PIPE 1 of ZONE /RHBG-1000-CU-PI-P\0')),
    record('PRIM', [1, 1, 8], floatBytes([
      0, 0, 0.001,
      0.001, 0, 0,
      0, 0.001, 0,
      100, 20, 0,
      -50, -10, -10,
      50, 10, 10,
      10, 100
    ])),
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
assert.ok(parsed.diagnostics.hierarchyGroupCount >= 4, 'owner path should create zone/pipe/branch/component groups');

const root = parsed.hierarchy[0];
assert.equal(root.attributes.BROWSER_RVM_HIERARCHY_GROUPED, 'true');
assert.ok(findByName(root, 'ZONE /RHBG-1000-CU-PI-P'));
assert.ok(findByName(root, 'PIPE 1'));
assert.ok(findByName(root, 'BRANCH 1'));
assert.ok(findByName(root, 'GASKET 1'));

const gasket = findByName(root, 'GASKET 1');
assert.ok(gasket.children.some((child) => child.type === 'GASK' || child.type === 'PIPE'), 'component group should retain parsed primitive leaf');
assert.ok(parsed.indexJson.nodes.some((node) => node.name === 'GASKET 1'));

console.log('Browser RVM hierarchy grouping test passed');
