import assert from 'node:assert/strict';
import { componentModelToRvm } from '../converters/inputxml-rvm/RvmxComponentModelToRvm.js';

function readTag(view, offset) {
  let out = '';
  for (let i = 0; i < 4; i += 1) out += String.fromCharCode(view.getUint8(offset + i * 4 + 3));
  return out;
}

function readF32Array(view, offset, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(view.getFloat32(offset + i * 4, false));
  return out;
}

function parsePrimChunks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = [];
  let offset = 0;
  const seen = new Set();
  while (offset + 24 <= bytes.byteLength && !seen.has(offset)) {
    seen.add(offset);
    const tag = readTag(view, offset);
    const nextOffset = view.getUint32(offset + 16, false);
    if (!tag || nextOffset <= offset || nextOffset > bytes.byteLength) break;
    if (tag === 'PRIM') {
      const bodyOffset = offset + 24;
      const bodyBytes = nextOffset - bodyOffset;
      const bodyWords = bodyBytes / 4;
      const version = view.getUint32(bodyOffset, false);
      const kind = view.getUint32(bodyOffset + 4, false);
      const matrix = readF32Array(view, bodyOffset + 8, 12);
      const bbox = readF32Array(view, bodyOffset + 56, 6);
      const paramWords = bodyWords - 2 - 12 - 6;
      const params = readF32Array(view, bodyOffset + 80, paramWords);
      records.push({ offset, nextOffset, chunkBytes: nextOffset - offset, bodyBytes, bodyWords, version, kind, matrix, bbox, paramWords, params });
    }
    if (tag === 'END:') break;
    offset = nextOffset;
  }
  return records;
}

const model = {
  components: [
    { type: 'PIPE', refNo: 'P-1', bore: 100, ep1: { x: 0, y: 0, z: 0 }, ep2: { x: 1000, y: 0, z: 0 } },
    { type: 'FLANGE', refNo: 'F-1', bore: 100, ep1: { x: 1000, y: 0, z: 0 }, ep2: { x: 1180, y: 0, z: 0 } },
    { type: 'REDUCER', refNo: 'R-1', bore: 100, attributes: { BORE2: 80 }, ep1: { x: 1180, y: 0, z: 0 }, ep2: { x: 1480, y: 0, z: 0 } },
    { type: 'VALVE', refNo: 'V-1', bore: 100, ep1: { x: 1480, y: 0, z: 0 }, ep2: { x: 1780, y: 0, z: 0 } },
    { type: 'BEND', refNo: 'B-1', bore: 100, bendRadius: 150, ep1: { x: 1780, y: 0, z: 0 }, ep2: { x: 1980, y: 0, z: 0 } },
    { type: 'PIPE', refNo: 'P-2', bore: 100, ep1: { x: 1980, y: 0, z: 0 }, ep2: { x: 1980, y: 500, z: 0 } },
    { type: 'SUPPORT', refNo: 'S-1', kind: 'GUIDE', bore: 100, coOrds: { x: 500, y: -80, z: 0 } },
  ],
};

const result = componentModelToRvm(model, { modelName: 'WRITER-ALIGNMENT' });
assert.ok(result.rvm instanceof Uint8Array, 'writer must return binary RVM bytes');
assert.ok(result.audit, 'writer must return primitive audit metadata');
assert.equal(result.audit.schema, 'inputxml-rvm-writer-primitive-audit/v1');
assert.equal(result.audit.primitiveCount, result.primitiveCount, 'audit primitive count must match writer primitive count');

const records = parsePrimChunks(result.rvm);
assert.equal(records.length, result.audit.records.length, 'binary PRIM chunk count must match audit record count');
assert.ok(records.some((record) => record.kind === 4), 'fixture must exercise legacy torus code 4');
assert.ok(records.some((record) => record.kind === 7), 'fixture must exercise legacy snout code 7');
assert.ok(records.some((record) => record.kind === 8), 'fixture must exercise stable cylinder code 8');
assert.ok(records.some((record) => record.kind === 2), 'fixture must exercise stable box code 2');

for (const [index, record] of records.entries()) {
  const audit = result.audit.records[index];
  assert.equal(record.version, 1, `PRIM ${index} must use record version 1`);
  assert.equal(record.kind, audit.kind, `PRIM ${index} kind must match audit`);
  assert.equal(record.matrix.length, audit.matrixWords, `PRIM ${index} matrix word count must match audit`);
  assert.equal(record.bbox.length, audit.bboxWords, `PRIM ${index} bbox word count must match audit`);
  assert.equal(record.paramWords, audit.paramWords, `PRIM ${index} param word count must match audit`);
  assert.equal(record.bodyWords, audit.bodyWords, `PRIM ${index} body word count must match audit`);
  assert.equal(record.bodyBytes, audit.bodyBytes, `PRIM ${index} body byte count must match audit`);
  assert.equal(record.chunkBytes, audit.chunkBytes, `PRIM ${index} chunk byte count must match audit`);
  assert.ok(record.matrix.every(Number.isFinite), `PRIM ${index} matrix must contain finite floats`);
  assert.ok(record.bbox.every(Number.isFinite), `PRIM ${index} bbox must contain finite floats`);
}

const expectedParamWords = new Map([[2, 3], [4, 3], [7, 9], [8, 2]]);
for (const record of result.audit.records) {
  assert.equal(record.matrixWords, 12, `kind ${record.kind} must audit a 12-word M_3x4 matrix`);
  assert.equal(record.bboxWords, 6, `kind ${record.kind} must audit a 6-word local bbox`);
  assert.equal(record.paramWords, expectedParamWords.get(record.kind), `kind ${record.kind} must audit expected parameter word count`);
  if (record.kind === 4) assert.equal(record.unlockKeyUsed, 'legacy-inputxml-rvm-torus', 'torus audit must record explicit legacy unlock key');
  if (record.kind === 7) assert.equal(record.unlockKeyUsed, 'legacy-inputxml-rvm-snout', 'snout audit must record explicit legacy unlock key');
}

assert.deepEqual(result.audit.primitiveKinds, {
  '2': 2,
  '4': 1,
  '7': 3,
  '8': 6,
}, 'fixture primitive kind histogram must be deterministic');

console.log('rvm writer/decoder alignment audit passed');
