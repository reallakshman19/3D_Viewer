import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RVM_PRIMITIVE_CAPABILITY_REGISTRY_VERSION,
  RVM_PRIMITIVE_WRITER_STATUS,
  assertRvmPrimitiveCodeEmitAllowed,
  canEmitRvmPrimitiveCode,
  getRvmPrimitiveCapability,
  isBlockedRvmPrimitiveCode,
  isStableRvmPrimitiveWriterCode,
  listRvmPrimitiveCapabilities,
} from '../rvm/RvmPrimitiveCapabilityRegistry.js';
import { componentModelToRvm } from '../converters/inputxml-rvm/RvmxComponentModelToRvm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

assert.equal(RVM_PRIMITIVE_CAPABILITY_REGISTRY_VERSION, '20260628-rvm-primitive-capability-registry-1');

const byCode = new Map(listRvmPrimitiveCapabilities().map((entry) => [entry.code, entry]));
for (const code of [1, 2, 3, 4, 5, 7, 8, 9, 11]) {
  assert.ok(byCode.has(code), `registry must declare code ${code}`);
}

for (const code of [1, 2, 8, 9]) {
  assert.equal(isStableRvmPrimitiveWriterCode(code), true, `code ${code} must be stable writer-ready`);
  assert.equal(canEmitRvmPrimitiveCode(code), true, `code ${code} must emit without unlock`);
  assert.doesNotThrow(() => assertRvmPrimitiveCodeEmitAllowed(code, { context: 'stable-test' }));
}

for (const code of [3, 5, 11, 42]) {
  assert.equal(isBlockedRvmPrimitiveCode(code), true, `code ${code} must be blocked`);
  assert.equal(canEmitRvmPrimitiveCode(code), false, `code ${code} must not emit`);
  assert.throws(() => assertRvmPrimitiveCodeEmitAllowed(code, { context: 'blocked-test' }), /not writer-ready/);
}

const torus = getRvmPrimitiveCapability(4);
assert.equal(torus.writerStatus, RVM_PRIMITIVE_WRITER_STATUS.EXPLICIT_LEGACY_UNLOCK);
assert.equal(canEmitRvmPrimitiveCode(4), false, 'code 4 must not emit without explicit unlock');
assert.equal(canEmitRvmPrimitiveCode(4, { unlockKey: 'legacy-inputxml-rvm-torus' }), true, 'code 4 explicit legacy unlock must be accepted');
assert.throws(() => assertRvmPrimitiveCodeEmitAllowed(4, { context: 'torus-default' }), /required unlock key: legacy-inputxml-rvm-torus/);

const snout = getRvmPrimitiveCapability(7);
assert.equal(snout.writerStatus, RVM_PRIMITIVE_WRITER_STATUS.EXPLICIT_LEGACY_UNLOCK);
assert.equal(canEmitRvmPrimitiveCode(7), false, 'code 7 must not emit without explicit unlock');
assert.equal(canEmitRvmPrimitiveCode(7, { unlockKey: 'legacy-inputxml-rvm-snout' }), true, 'code 7 explicit legacy unlock must be accepted');
assert.throws(() => assertRvmPrimitiveCodeEmitAllowed(7, { context: 'snout-default' }), /required unlock key: legacy-inputxml-rvm-snout/);

assert.equal(getRvmPrimitiveCapability(3).observedBodyLength, 96, 'code 3 observed body length must be recorded');
assert.equal(getRvmPrimitiveCapability(4).observedBodyLength, 92, 'code 4 observed body length must be recorded');
assert.equal(getRvmPrimitiveCapability(5).observedBodyLength, 88, 'code 5 observed body length must be recorded');
assert.equal(getRvmPrimitiveCapability(7).observedBodyLength, 116, 'code 7 observed body length must be recorded');
assert.equal(getRvmPrimitiveCapability(11).observedBodyLength, 708, 'code 11 observed body length must be recorded');

const writerSource = read('converters/inputxml-rvm/RvmxComponentModelToRvm.js');
assert.match(writerSource, /RvmPrimitiveCapabilityRegistry\.js/, 'inputxml-rvm writer must import the primitive capability registry');
assert.match(writerSource, /assertRvmPrimitiveCodeEmitAllowed/, 'inputxml-rvm writer must assert primitive emit capability');
assert.match(writerSource, /legacy-inputxml-rvm-torus/, 'code 4 writer path must use explicit torus legacy unlock');
assert.match(writerSource, /legacy-inputxml-rvm-snout/, 'code 7 writer path must use explicit snout legacy unlock');

const reducerModel = {
  components: [{
    type: 'REDUCER',
    refNo: 'R-1',
    bore: 100,
    attributes: { BORE2: 80 },
    ep1: { x: 0, y: 0, z: 0 },
    ep2: { x: 1000, y: 0, z: 0 },
  }],
};
const reducerExport = componentModelToRvm(reducerModel, { modelName: 'REGISTRY-REDUCER' });
assert.ok(reducerExport.rvm instanceof Uint8Array, 'legacy snout writer path must remain exportable through explicit unlock');
assert.ok(reducerExport.rvm.length > 0, 'legacy snout writer path must produce binary bytes');
assert.equal(reducerExport.primitiveCount, 1, 'reducer fixture should emit one primitive');

const bendModel = {
  components: [
    { type: 'BEND', refNo: 'B-1', bore: 100, bendRadius: 150, ep1: { x: 0, y: 0, z: 0 }, ep2: { x: 1000, y: 0, z: 0 } },
    { type: 'PIPE', refNo: 'P-2', bore: 100, ep1: { x: 1000, y: 0, z: 0 }, ep2: { x: 1000, y: 1000, z: 0 } },
  ],
};
const bendExport = componentModelToRvm(bendModel, { modelName: 'REGISTRY-BEND' });
assert.ok(bendExport.rvm instanceof Uint8Array, 'legacy torus writer path must remain exportable through explicit unlock');
assert.ok(bendExport.rvm.length > 0, 'legacy torus writer path must produce binary bytes');
assert.ok(bendExport.primitiveCount >= 3, 'bend fixture should emit cylinder/torus primitives without bypassing registry');

console.log('rvm primitive capability registry tests passed');
