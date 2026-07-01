import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/stage/render/StageRenderPlan.js',
  'viewer/stage/contracts/StageWorkerAcceptance.js',
  'viewer/tests/viewer3d-json-component-aware-render-plan.test.js',
  'viewer/tests/viewer3d-json-render-plan-validation.test.js',
  'viewer/tests/viewer3d-json-render-plan-source-guards.test.js',
];
const guardedSourceFiles = [
  'viewer/stage/render/StageRenderPlan.js',
  'viewer/stage/contracts/StageWorkerAcceptance.js',
];
const banned = [
  'viewer/tabs/',
  'viewer/stage/ui/',
  'viewer/stage/worker/',
  'three',
  'indexedDB',
  'parseRvm',
  'readRvm',
  'RvmParser',
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
];
const semanticNameTokens = ['/PS-', 'VALVE_ASSEMBLY', 'FLANGE', 'SUPPORT_ASSEMBLY', 'ownerPath', '.name'];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const planSource = read('viewer/stage/render/StageRenderPlan.js');

for (const token of banned) {
  for (const file of guardedSourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const token of semanticNameTokens) {
  assert.equal(planSource.includes(token), false, `StageRenderPlan uses semantic-name token ${token}`);
}
for (const token of ['STAGE_RENDER_ENTRY_KINDS', 'STAGE_RENDER_RECIPE_SOURCES', 'STAGE_RENDER_SUPPORT_LEVELS', 'buildComponentAwareStageRenderPlan', 'createComponentRenderPlanEntry', 'createAssemblyRenderPlanEntry', 'createDiagnosticRenderPlanEntry']) {
  assert.ok(planSource.includes(token), `StageRenderPlan missing ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('StageRenderPlan source guard tests passed');
