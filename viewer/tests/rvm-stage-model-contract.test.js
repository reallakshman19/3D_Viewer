import assert from 'node:assert/strict';
import {
  RVM_STAGE_SCHEMA,
  STAGE_RENDER_KINDS,
  STAGE_SEMANTIC_TYPES,
  createEmptyRvmStageModel,
  normalizeRenderQuality,
  validateRvmStageModel,
} from '../stage/contracts/RvmStageModelContract.js';

const model = createEmptyRvmStageModel({ fileName: 'sample.rvm', fileSize: 1024, fileHash: 'sha256-demo' });
assert.equal(model.schema, RVM_STAGE_SCHEMA);
assert.equal(model.source.fileName, 'sample.rvm');
assert.equal(model.hierarchy.rootId, 'node-root');

model.hierarchy.nodes.push({
  id: 'node-000001',
  parentId: 'node-root',
  name: '/PIPE-001',
  path: '/AREA/PIPE-001',
  kind: 'RVM_NATIVE_CONTAINER',
  componentIds: ['comp-000001'],
  primitiveIds: ['prim-000001'],
  bboxWorld: [0, 0, 0, 2, 1, 1],
});
model.components.push({
  id: 'comp-000001',
  nodeId: 'node-000001',
  semanticType: 'PIPE',
  name: '/PIPE-001',
  ownerPath: '/AREA/PIPE-001',
  primitiveIds: ['prim-000001'],
  bboxWorld: [0, 0, 0, 2, 1, 1],
  confidence: { geometry: 'native', semantic: 'attribute' },
  renderPolicy: {
    full: 'native-assembly',
    medium: 'simplified-assembly',
    light: 'proxy',
    skeleton: 'centerline-symbol',
    hidden: 'hide',
  },
  diagnostics: [],
});
model.primitives.push({
  id: 'prim-000001',
  nodeId: 'node-000001',
  componentId: 'comp-000001',
  native: { recordOffset: 128, code: 8, kind: 'Cylinder', decoded: true },
  transform: {
    matrix3x4: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    bboxLocal: [0, 0, 0, 2, 1, 1],
    bboxWorld: [0, 0, 0, 2, 1, 1],
  },
  params: { radius: 0.1 },
  renderKind: 'CYLINDER',
  materialId: 'mat-001',
  diagnostics: [],
});

const result = validateRvmStageModel(model);
assert.equal(result.valid, true, result.errors.join('\n'));

const invalid = createEmptyRvmStageModel();
invalid.primitives.push({
  id: 'prim-bad',
  nodeId: 'node-root',
  componentId: 'comp-missing',
  native: { code: '4' },
  transform: { matrix3x4: [1, 2, 3] },
  renderKind: 'GIANT_SUPPORT_STAND',
});
const invalidResult = validateRvmStageModel(invalid);
assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.errors.some((line) => line.includes('renderKind is invalid')));
assert.ok(invalidResult.errors.some((line) => line.includes('native.code must be a number')));

assert.ok(STAGE_RENDER_KINDS.includes('ELBOW'));
assert.ok(STAGE_RENDER_KINDS.includes('SUPPORT_ASSEMBLY'));
assert.ok(STAGE_SEMANTIC_TYPES.includes('SUPPORT'));
assert.equal(normalizeRenderQuality('100'), 'full');
assert.equal(normalizeRenderQuality('50'), 'light');
assert.equal(normalizeRenderQuality('hide'), 'hidden');

console.log('RvmStageModel.v1 contract tests passed');
