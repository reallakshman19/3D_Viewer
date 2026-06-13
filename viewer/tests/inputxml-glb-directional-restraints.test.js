import assert from 'node:assert/strict';

import { buildExportScene } from '../js/pcf2glb/glb/buildExportScene.js';

function support(id, kind, axis = { x: 1, y: 0, z: 0 }, extra = {}) {
  const { component = {}, attributes = {} } = extra;
  return {
    id,
    type: 'SUPPORT',
    bore: component.bore ?? 20,
    coOrds: { x: 0, y: 0, z: 0 },
    ep1: { x: 0, y: 0, z: 0 },
    refNo: id,
    supportKind: kind,
    attributes: {
      COMPONENT_IDENTIFIER: id,
      SUPPORT_TAG: id,
      SUPPORT_KIND: kind,
      CAESAR_SUPPORT_KIND: kind,
      caesarXCosine: String(axis.x),
      caesarYCosine: String(axis.y),
      caesarZCosine: String(axis.z),
      ...attributes,
    },
    raw: {
      caesarSupportKind: kind,
      caesarXCosine: String(axis.x),
      caesarYCosine: String(axis.y),
      caesarZCosine: String(axis.z),
    },
    ...component,
  };
}

function supportObject(component) {
  const scene = buildExportScene({ components: [component] });
  const object = scene.getObjectByName(component.id);
  assert.ok(object, `${component.id} should be present in GLB scene`);
  assert.equal(object.userData.directionalSupportEnhanced, true);
  assert.ok(object.userData.directionalSupportSymbolCount > 0);
  assert.ok(object.userData.supportSymbolScale >= 18, `${component.id} should use visible engineering scale`);
  return object;
}

function child(object, name) {
  const found = object.getObjectByName(name);
  assert.ok(found, `${object.name} should contain ${name}`);
  return found;
}

const guide = supportObject(support('GUIDE-X', 'GUIDE', { x: 1, y: 0, z: 0 }));
child(guide, 'GUIDE-X-directional-symbols');
child(guide, 'GUIDE-X-guide-bar-positive');
child(guide, 'GUIDE-X-guide-bar-negative');
child(guide, 'GUIDE-X-guide-axis-positive');
child(guide, 'GUIDE-X-guide-axis-negative');
assert.equal(guide.userData.supportKind, 'GUIDE');
assert.deepEqual(guide.userData.supportAxis, { x: 1, y: 0, z: 0 });

const lineStop = supportObject(support('LS-Z', 'LINESTOP', { x: 0, y: 0, z: 1 }));
child(lineStop, 'LS-Z-linestop-plate-positive');
child(lineStop, 'LS-Z-linestop-plate-negative');
child(lineStop, 'LS-Z-linestop-axis-positive');
child(lineStop, 'LS-Z-linestop-axis-negative');
assert.equal(lineStop.userData.supportKind, 'LINESTOP');

const limit = supportObject(support('LIMIT-X', 'LIMIT', { x: -1, y: 0, z: 0 }));
child(limit, 'LIMIT-X-limit-stop-plate');
child(limit, 'LIMIT-X-limit-axis');
assert.equal(limit.userData.supportKind, 'LIMIT');
assert.deepEqual(limit.userData.supportAxis, { x: -1, y: 0, z: 0 });

const anchor = supportObject(support('ANCHOR', 'ANCHOR'));
child(anchor, 'ANCHOR-anchor-block');
for (let index = 1; index <= 6; index += 1) child(anchor, `ANCHOR-anchor-axis-${index}`);
assert.equal(anchor.userData.supportKind, 'ANCHOR');

const hanger = supportObject(support('HANGER', 'HANGER', { x: 0, y: 1, z: 0 }));
child(hanger, 'HANGER-hanger-rod');
child(hanger, 'HANGER-hanger-ring');
assert.equal(hanger.userData.supportKind, 'HANGER');

const spring = supportObject(support('SPRING', 'SPRING', { x: 0, y: 1, z: 0 }));
child(spring, 'SPRING-hanger-rod');
child(spring, 'SPRING-hanger-ring');
assert.equal(spring.userData.supportKind, 'SPRING');

const rest = supportObject(support('REST-Y', 'REST', { x: 0, y: 1, z: 0 }));
child(rest, 'REST-Y-rest-base');
child(rest, 'REST-Y-rest-axis');
assert.equal(rest.userData.supportKind, 'REST');

const largeGuide = supportObject(support('GUIDE-LARGE', 'GUIDE', { x: 1, y: 0, z: 0 }, { component: { bore: 300 } }));
assert.ok(largeGuide.userData.supportSymbolScale > guide.userData.supportSymbolScale);

console.log('inputxml-glb-directional-restraints.test.js passed');
