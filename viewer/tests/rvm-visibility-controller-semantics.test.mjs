import assert from 'node:assert/strict';
import { RvmVisibilityController } from '../rvm-viewer/RvmVisibilityController.js';

function mesh(name) {
  return { isMesh: true, name, visible: true, userData: { name } };
}

function group(objects) {
  return { traverse(callback) { objects.forEach(callback); } };
}

const objects = [mesh('A'), mesh('B'), mesh('C')];
const controller = new RvmVisibilityController(group(objects), null);

controller.hide(['B']);
assert.equal(objects.find((obj) => obj.name === 'A').visible, true, 'hide must leave unhidden objects visible');
assert.equal(objects.find((obj) => obj.name === 'B').visible, false, 'hide must hide selected object');
assert.equal(controller.getVisibilityState().hiddenCount, 1, 'hide must report hidden count');
assert.equal(controller.getVisibilityState().isolatedCount, 0, 'hide must clear isolate mode');

controller.show(['B']);
assert.equal(objects.find((obj) => obj.name === 'B').visible, true, 'show selected must unhide selected object in hidden mode');
assert.equal(controller.getVisibilityState().hiddenCount, 0, 'show selected must clear selected hidden IDs');

controller.isolate(['A']);
assert.equal(objects.find((obj) => obj.name === 'A').visible, true, 'isolate must show isolated object');
assert.equal(objects.find((obj) => obj.name === 'B').visible, false, 'isolate must hide non-isolated object');
assert.equal(controller.getVisibilityState().isolatedCount, 1, 'isolate must report isolated count');

controller.show(['B']);
assert.equal(objects.find((obj) => obj.name === 'B').visible, true, 'show selected in isolate mode must add selected object to visible isolate set');
assert.deepEqual(new Set(controller.getIsolatedCanonicalIds()), new Set(['A', 'B']), 'show selected in isolate mode must preserve existing isolate set and add selected IDs');
assert.equal(controller.getVisibilityState().isolatedCount, 2, 'diagnostics must reflect expanded isolate set');

controller.showAll();
assert.equal(objects.every((obj) => obj.visible), true, 'showAll must make all objects visible');
assert.equal(controller.getVisibilityState().hiddenCount, 0, 'showAll must clear hidden count');
assert.equal(controller.getVisibilityState().isolatedCount, 0, 'showAll must clear isolated count');

console.log('Verified RVM visibility controller selected-show semantics.');
