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

const noisyNode = new THREE.Object3D();
noisyNode.name = 'node-label:IX-A-IX-PE-00001-SUP-1-SUPPORT_POINT';
noisyNode.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'IX-A-IX-PE-00001-SUP-1-SUPPORT_POINT',
};
root.add(noisyNode);

const cleanNode = new THREE.Object3D();
cleanNode.name = 'node-label:205';
cleanNode.position.set(3, 0, 0);
cleanNode.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'NODE 205',
};
root.add(cleanNode);

const nakedComponentLabel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
nakedComponentLabel.name = 'NO-ANCHOR-LABEL';
nakedComponentLabel.userData = {
  glbShape: 'flange-ring-pair',
  labelText: 'NO-ANCHOR-LABEL',
};
root.add(nakedComponentLabel);

const labels = collectGlbLabelAnchors(root);
assert.equal(labels.length, 2, 'collector should keep explicit anchors only and skip pseudo node labels');
assert.deepEqual(labels.map((label) => label.text).sort(), ['205', 'VALVE-TEST']);
assert.equal(labels.find((label) => label.text === 'VALVE-TEST')?.kind, 'valve');
assert.equal(labels.find((label) => label.text === '205')?.kind, 'node');
assert.deepEqual(summarizeGlbLabels(labels), {
  total: 2,
  node: 1,
  support: 0,
  valve: 1,
  flange: 0,
  tee: 0,
  terminal: 0,
  component: 0,
});

console.log('glb-label-overlay-toggle.test.js passed');
