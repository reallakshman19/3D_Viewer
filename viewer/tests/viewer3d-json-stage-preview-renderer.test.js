import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const files = [
  'viewer/stage/render/StageThreePreviewRenderer.js',
  'viewer/stage/render/StagePreviewGeometry.js',
  'viewer/stage/render/StagePreviewDisposal.js',
  'viewer/stage/render/StagePreviewCameraControls.js',
  'viewer/stage/render/StagePreviewPicking.js',
  'viewer/tabs/viewer3d-json-tab-renderer.js',
  'viewer/tabs/viewer3d-json-tab.css',
  'viewer/tests/viewer3d-json-stage-preview-renderer.test.js',
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
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const renderer = read('viewer/stage/render/StageThreePreviewRenderer.js');
const geometry = read('viewer/stage/render/StagePreviewGeometry.js');
const disposal = read('viewer/stage/render/StagePreviewDisposal.js');
const controls = read('viewer/stage/render/StagePreviewCameraControls.js');
const picking = read('viewer/stage/render/StagePreviewPicking.js');
const tabRenderer = read('viewer/tabs/viewer3d-json-tab-renderer.js');
const css = read('viewer/tabs/viewer3d-json-tab.css');
const combined = [renderer, geometry, disposal, controls, picking, tabRenderer].join('\n');

assert.match(renderer, /import \* as THREE from 'three'/);
for (const name of ['createStageThreePreviewRenderer', 'renderStagePreview', 'disposeStageThreePreviewRenderer']) {
  assert.match(renderer, new RegExp(`export function ${name}`));
}
for (const token of ['renderer.dispose', 'removeEventListener', 'domElement.remove']) assert.ok(renderer.includes(token));
for (const token of ['geometry.dispose', 'material.dispose']) assert.ok(disposal.includes(token));
for (const token of ['CYLINDER', 'BOX', 'ELBOW', 'FACET_GROUP', 'UNKNOWN_DIAGNOSTIC', 'hidden']) assert.ok(combined.includes(token));
for (const token of ['TorusGeometry', 'CylinderGeometry', 'BoxGeometry', 'EdgesGeometry']) assert.ok(geometry.includes(token));
for (const token of ['attachStagePreviewCameraControls', 'detachStagePreviewCameraControls', 'objectIndex']) assert.ok(renderer.includes(token));
for (const token of ['attachStagePreviewPicking', 'detachStagePreviewPicking', 'setStagePreviewSelectionCallback']) assert.ok(renderer.includes(token));
for (const token of ['primitiveId', 'componentId', 'nodeId', 'renderEntryId']) assert.ok(renderer.includes(token));

assert.match(tabRenderer, /StageThreePreviewRenderer\.js/);
assert.match(tabRenderer, /renderStagePreview/);
assert.match(tabRenderer, /fitStagePreviewToRenderPlan/);
assert.match(tabRenderer, /resetStagePreview/);
assert.match(tabRenderer, /updateStagePreviewSelection/);
assert.match(tabRenderer, /setStagePreviewSelectionCallback/);
assert.match(tabRenderer, /applyPreviewSelection/);
assert.match(tabRenderer, /Selected \$\{ref\.type\}/);
assert.match(tabRenderer, /StageRenderPlan\.v1/);
assert.match(tabRenderer, /EMPTY_CANVAS_TEXT/);
assert.match(tabRenderer, /previewText/);
assert.match(css, /json-viewer-webgl-canvas/);

for (const token of blacklist) {
  for (const file of sourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const token of ['parseRvm', 'RvmParser', 'readRvm']) {
  assert.equal(combined.includes(token), false, `preview renderer contains ${token}`);
}
for (const token of ['ownerPath', '.name', '/PS-', 'VALVE', 'FLANGE', 'SUPPORT']) {
  assert.equal(geometry.includes(token), false, `geometry factory uses semantic-name token ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer stage preview renderer source tests passed');
