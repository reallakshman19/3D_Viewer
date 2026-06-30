import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/stage/render/StagePreviewCameraControls.js',
  'viewer/stage/render/StageThreePreviewRenderer.js',
  'viewer/tabs/viewer3d-json-tab-renderer.js',
  'viewer/tests/viewer3d-json-preview-controls.test.js',
];
const sourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const blacklist = [
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
  'OrbitControls',
  'MutationObserver',
  'parseRvm',
  'RvmParser',
  'readRvm',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const controls = read('viewer/stage/render/StagePreviewCameraControls.js');
const renderer = read('viewer/stage/render/StageThreePreviewRenderer.js');
const tabRenderer = read('viewer/tabs/viewer3d-json-tab-renderer.js');

for (const name of ['attachStagePreviewCameraControls', 'detachStagePreviewCameraControls', 'fitStagePreviewCamera', 'resetStagePreviewCamera']) {
  assert.match(controls, new RegExp(`export function ${name}`));
}
for (const token of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) assert.ok(controls.includes(token));
for (const token of ['addEventListener', 'removeEventListener', 'preventDefault', 'cameraControls']) assert.ok(controls.includes(token));
for (const token of ['attachStagePreviewCameraControls', 'detachStagePreviewCameraControls', 'fitStagePreviewToRenderPlan', 'resetStagePreview']) {
  assert.ok(renderer.includes(token) || tabRenderer.includes(token), `missing ${token}`);
}
assert.match(tabRenderer, /runPreviewCommand/);
assert.match(tabRenderer, /fitStagePreviewToRenderPlan/);
assert.match(tabRenderer, /resetStagePreview/);
assert.match(tabRenderer, /previewFitPending/);

for (const token of blacklist) {
  for (const file of sourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer preview controls source tests passed');
