import assert from 'node:assert/strict';
import {
  isRvmNonPrimitiveSourceKind,
  isRvmPrimitiveSourceKind,
  isRvmSourcePreviewKind,
  normalizeRvmSourceKind,
  sourceKindFromContext,
  sourceKindFromFileName,
} from '../RvmSourceKindPolicy.js';

const filenameCases = new Map([
  ['model.json', 'json'],
  ['model.jscon', 'jscon'],
  ['line.uxml', 'inputxml'],
  ['line.uxml.json', 'inputxml'],
  ['line.inputxml', 'inputxml'],
  ['model.stagedjson', 'stagedjson'],
  ['model.staged.json', 'stagedjson'],
  ['BM_CII_INPUT_managed_stage.json', 'stagedjson'],
  ['BM-CII-INPUT-managed-stage.json', 'stagedjson'],
  ['notes.txt', 'txt'],
  ['native.rvm', 'rvm'],
  ['native.rev', 'rev'],
  ['native.glb', 'glb'],
  ['native.gltf', 'gltf'],
]);

for (const [fileName, expected] of filenameCases) {
  assert.equal(sourceKindFromFileName(fileName), expected, `sourceKindFromFileName(${fileName})`);
}

const normalizeCases = new Map([
  ['.json', 'json'],
  ['aveva-json', 'json'],
  ['xml', 'inputxml'],
  ['uxml', 'inputxml'],
  ['staged-json', 'stagedjson'],
  ['staged_json', 'stagedjson'],
  ['staged.json', 'stagedjson'],
  ['rvm_binary', 'rvm'],
  ['rvm-binary', 'rvm'],
]);

for (const [value, expected] of normalizeCases) {
  assert.equal(normalizeRvmSourceKind(value), expected, `normalizeRvmSourceKind(${value})`);
}

assert.equal(sourceKindFromContext({ fileExtension: 'json', fileName: 'model.staged.json' }), 'stagedjson', 'precise staged filename wins over generic extension');
assert.equal(sourceKindFromContext({ fileExtension: 'json', fileName: 'line.uxml.json' }), 'inputxml', 'precise UXML filename wins over generic extension');
assert.equal(sourceKindFromContext({ fileExtension: 'json', fileName: 'BM_CII_INPUT_managed_stage.json' }), 'stagedjson', 'managed-stage filename wins over generic extension');
assert.equal(sourceKindFromContext({ sourceKind: 'json', fileName: 'model.staged.json' }), 'json', 'explicit sourceKind wins over filename');
assert.equal(sourceKindFromContext({ loadedSourceKind: 'staged.json' }), 'stagedjson', 'loaded staged.json normalizes');

for (const primitive of ['rvm', 'rev', 'glb', 'gltf']) {
  assert.equal(isRvmPrimitiveSourceKind(primitive), true, `${primitive} is primitive`);
  assert.equal(isRvmSourcePreviewKind(primitive), false, `${primitive} is not source-preview`);
}

for (const sourcePreview of ['json', 'jscon', 'inputxml', 'txt', 'source-preview', 'stagedjson']) {
  assert.equal(isRvmSourcePreviewKind(sourcePreview), true, `${sourcePreview} is source-preview`);
  assert.equal(isRvmNonPrimitiveSourceKind(sourcePreview), true, `${sourcePreview} is non-primitive`);
}

console.log('rvm source kind policy regression passed');
