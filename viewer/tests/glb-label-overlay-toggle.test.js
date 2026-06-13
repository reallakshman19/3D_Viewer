import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  collectGlbLabelAnchors,
  DEFAULT_GLB_LABEL_VISIBILITY,
  shouldShowGlbLabelKind,
  summarizeGlbLabels,
} from '../js/pcf2glb/advanced/glbLabelOverlay.js';

assert.equal(shouldShowGlbLabelKind('node', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('support', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('tee', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('terminal', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('valve', DEFAULT_GLB_LABEL_VISIBILITY), false);
assert.equal(shouldShowGlbLabelKind('flange', DEFAULT_GLB_LABEL_VISIBILITY), false);
assert.equal(shouldShowGlbLabelKind('component', DEFAULT_GLB_LABEL_VISIBILITY), false);

const noNodes = { ...DEFAULT_GLB_LABEL_VISIBILITY, node: false };
assert.equal(shouldShowGlbLabelKind('node', noNodes), false);
assert.equal(shouldShowGlbLabelKind('support', noNodes), true);

const onlyNodes = Object.fromEntries(Object.keys(DEFAULT_GLB_LABEL_VISIBILITY).map((key) => [key, false]));
onlyNodes.node = true;
assert.equal(shouldShowGlbLabelKind('node', onlyNodes), true);
assert.equal(shouldShowGlbLabelKind('support', onlyNodes), false);
assert.equal(shouldShowGlbLabelKind('valve', onlyNodes), false);
assert.equal(shouldShowGlbLabelKind('unknown-kind', onlyNodes), false);

const root = new THREE.Group();
const valve = new THREE.Group();
valve.name = 'VALVE-TEST';
valve.userData = {
  pcfId: 'VALVE-TEST',
  glbShape: 'valve-body-handwheel',
  labelText: 'VALVE-TEST',
};

const valveBody = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
valveBody.name = 'VALVE-TEST-valve-body';
valveBody.position.set(1, 0, 0);
valveBody.userData = { ...valve.userData };

const valveWheel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
valveWheel.name = 'VALVE-TEST-valve-handwheel';
valveWheel.position.set(2, 0, 0);
valveWheel.userData = { ...valve.userData };

const valveLabelAnchor = new THREE.Object3D();
valveLabelAnchor.name = 'label:VALVE-TEST';
valveLabelAnchor.position.set(0, 5, 0);
valveLabelAnchor.userData = { ...valve.userData, labelAnchor: true };

valve.add(valveBody, valveWheel, valveLabelAnchor);
root.add(valve);

const labels = collectGlbLabelAnchors(root);
assert.equal(labels.length, 1, 'mesh-part labels should dedupe into one logical valve label');
assert.equal(labels[0].text, 'VALVE-TEST');
assert.equal(labels[0].kind, 'valve');
assert.equal(labels[0].sourceName, 'label:VALVE-TEST');
assert.deepEqual(summarizeGlbLabels(labels), {
  total: 1,
  node: 0,
  support: 0,
  valve: 1,
  flange: 0,
  tee: 0,
  terminal: 0,
  component: 0,
});

console.log('glb-label-overlay-toggle.test.js passed');
